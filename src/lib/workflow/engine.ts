// ─────────────────────────────────────────────────────────────
// Workflow engine – configuration-driven state machine
// ─────────────────────────────────────────────────────────────
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { writeAuditLog } from "../audit";
import type { WorkflowStage } from "@/types/module";

/**
 * Map workflow stage types to application status.
 * This allows the generic workflow engine to set the correct
 * application status as it transitions between stages.
 */
const STAGE_TYPE_TO_STATUS: Record<string, ApplicationStatus> = {
  validation: "UNDER_REVIEW",
  review: "UNDER_REVIEW",
  inspection: "AWAITING_INSPECTION",
  consultation: "AWAITING_CONSULTATION",
  hearing: "AWAITING_HEARING",
  training: "UNDER_REVIEW",
  decision: "UNDER_REVIEW",
  custom: "UNDER_REVIEW",
};

export interface TransitionResult {
  success: boolean;
  fromStage: string | null;
  toStage: string;
  newStatus: ApplicationStatus;
  error?: string;
}

/**
 * Get the workflow definition for an application's module version.
 */
export async function getWorkflowDefinition(
  applicationId: string
): Promise<WorkflowStage[]> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { moduleVersion: true },
  });

  if (!app) throw new Error("Application not found");
  return (app.moduleVersion.workflowDefinition as unknown as WorkflowStage[]) || [];
}

/**
 * Get the current stage definition for an application.
 */
export async function getCurrentStage(
  applicationId: string
): Promise<WorkflowStage | null> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!app?.currentStage) return null;

  const stages = await getWorkflowDefinition(applicationId);
  return stages.find((s) => s.key === app.currentStage) ?? null;
}

/**
 * Get the next stage in the workflow.
 */
export async function getNextStage(
  applicationId: string
): Promise<WorkflowStage | null> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!app) return null;

  const stages = await getWorkflowDefinition(applicationId);
  if (stages.length === 0) return null;

  if (!app.currentStage) {
    return stages[0] ?? null;
  }

  const currentIndex = stages.findIndex((s) => s.key === app.currentStage);
  if (currentIndex === -1 || currentIndex >= stages.length - 1) return null;

  return stages[currentIndex + 1] ?? null;
}

/**
 * Transition an application to a specific workflow stage.
 */
export async function transitionTo(
  applicationId: string,
  toStageKey: string,
  action: string,
  performedById: string,
  metadata?: Record<string, unknown>
): Promise<TransitionResult> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!app) {
    return {
      success: false,
      fromStage: null,
      toStage: toStageKey,
      newStatus: "DRAFT",
      error: "Application not found",
    };
  }

  const stages = await getWorkflowDefinition(applicationId);
  const targetStage = stages.find((s) => s.key === toStageKey);

  if (!targetStage) {
    return {
      success: false,
      fromStage: app.currentStage,
      toStage: toStageKey,
      newStatus: app.status,
      error: `Stage '${toStageKey}' not found in workflow definition`,
    };
  }

  const newStatus = STAGE_TYPE_TO_STATUS[targetStage.type] || "UNDER_REVIEW";

  // Update application
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      currentStage: toStageKey,
      status: newStatus,
    },
  });

  // Record workflow event
  await prisma.workflowEvent.create({
    data: {
      applicationId,
      fromStage: app.currentStage,
      toStage: toStageKey,
      action,
      performedById,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });

  // Audit
  await writeAuditLog({
    userId: performedById,
    applicationId,
    action: `workflow.${action}`,
    entityType: "Application",
    entityId: applicationId,
    previousValues: { stage: app.currentStage, status: app.status },
    newValues: { stage: toStageKey, status: newStatus },
  });

  return {
    success: true,
    fromStage: app.currentStage,
    toStage: toStageKey,
    newStatus,
  };
}

/**
 * Advance to the next workflow stage.
 */
export async function advanceWorkflow(
  applicationId: string,
  performedById: string,
  metadata?: Record<string, unknown>
): Promise<TransitionResult> {
  const next = await getNextStage(applicationId);
  if (!next) {
    return {
      success: false,
      fromStage: null,
      toStage: "",
      newStatus: "UNDER_REVIEW",
      error: "No next stage available",
    };
  }

  return transitionTo(applicationId, next.key, "advance", performedById, metadata);
}

/**
 * Submit an application – initialise the workflow.
 */
export async function submitApplication(
  applicationId: string,
  userId: string
): Promise<TransitionResult> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { moduleVersion: true },
  });

  if (!app) {
    return {
      success: false,
      fromStage: null,
      toStage: "",
      newStatus: "DRAFT",
      error: "Application not found",
    };
  }

  if (app.status !== "DRAFT") {
    return {
      success: false,
      fromStage: app.currentStage,
      toStage: "",
      newStatus: app.status,
      error: "Application has already been submitted",
    };
  }

  const stages = (app.moduleVersion.workflowDefinition as unknown as WorkflowStage[]) || [];
  const firstStage = stages[0];

  const newStatus: ApplicationStatus = firstStage
    ? STAGE_TYPE_TO_STATUS[firstStage.type] || "SUBMITTED"
    : "SUBMITTED";

  // Optimistic lock: only the first concurrent caller flips the row out of
  // DRAFT. Later callers see count = 0 and are told the application is not
  // available to submit; they must not re-run workflow events or auditing.
  const claimed = await prisma.application.updateMany({
    where: { id: applicationId, status: "DRAFT" },
    data: {
      status: newStatus,
      currentStage: firstStage?.key ?? null,
      submittedAt: new Date(),
    },
  });
  if (claimed.count === 0) {
    return {
      success: false,
      fromStage: app.currentStage,
      toStage: "",
      newStatus: app.status,
      error: "Application has already been submitted",
    };
  }

  if (firstStage) {
    await prisma.workflowEvent.create({
      data: {
        applicationId,
        fromStage: null,
        toStage: firstStage.key,
        action: "submit",
        performedById: userId,
      },
    });
  }

  await writeAuditLog({
    userId,
    applicationId,
    action: "application.submit",
    entityType: "Application",
    entityId: applicationId,
    newValues: { status: newStatus, stage: firstStage?.key },
  });

  return {
    success: true,
    fromStage: null,
    toStage: firstStage?.key ?? "submitted",
    newStatus,
  };
}

/**
 * Record a decision on an application.
 */
export async function recordDecision(
  applicationId: string,
  outcome: "APPROVED" | "REFUSED" | "WITHDRAWN",
  reason: string,
  decidedById: string
): Promise<void> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!app) throw new Error("Application not found");

  const status: ApplicationStatus = outcome;

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      status,
      decisionOutcome: outcome.toLowerCase(),
      decisionReason: reason,
      decidedAt: new Date(),
    },
  });

  await prisma.workflowEvent.create({
    data: {
      applicationId,
      fromStage: app.currentStage,
      toStage: `decision_${outcome.toLowerCase()}`,
      action: "decision",
      performedById: decidedById,
      metadata: { outcome, reason },
    },
  });

  await writeAuditLog({
    userId: decidedById,
    applicationId,
    action: "application.decision",
    entityType: "Application",
    entityId: applicationId,
    previousValues: { status: app.status },
    newValues: { status, outcome, reason },
  });
}
