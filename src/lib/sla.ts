// ─────────────────────────────────────────────────────────────
// SLA computation for applications.
//
// Each workflow stage can define `slaBusinessDays` (a target number of
// working days to complete that stage). This module works out where an
// application is against that target — e.g. "9 of 10 working days used,
// 1 day left" or "2 working days overdue" — so dashboards can warn staff.
// ─────────────────────────────────────────────────────────────
import { addBusinessDays, differenceInBusinessDays } from "date-fns";
import type { ApplicationStatus } from "@prisma/client";
import type { WorkflowStage } from "@/types/module";

export type SlaState = "on_track" | "due_soon" | "due_today" | "breached";

export interface SlaInfo {
  stageKey: string;
  stageLabel: string;
  slaBusinessDays: number;
  enteredAt: Date;
  dueDate: Date;
  /** Whole working days used since the stage was entered. */
  usedBusinessDays: number;
  /** Working days until the deadline (negative once overdue). */
  remainingBusinessDays: number;
  /** Working days past the deadline (0 unless breached). */
  overdueBusinessDays: number;
  state: SlaState;
}

/** Statuses where an application is actively being processed (SLA applies). */
const ACTIVE_STATUSES: ApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_INSPECTION",
  "AWAITING_CONSULTATION",
  "AWAITING_HEARING",
  "AWAITING_DOCUMENTS",
  "AWAITING_PAYMENT",
  "RETURNED",
  "INCOMPLETE",
];

interface AppLike {
  status: ApplicationStatus;
  currentStage: string | null;
  submittedAt: Date | string | null;
  createdAt: Date | string;
  workflowEvents?: Array<{ toStage: string; createdAt: Date | string }> | null;
  moduleVersion?: { workflowDefinition: unknown } | null;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

/**
 * Work out the SLA position for an application against its current stage.
 * Returns null when no SLA applies (inactive status, no stages, or the
 * current stage has no SLA target).
 */
export function computeApplicationSla(
  app: AppLike,
  now: Date = new Date()
): SlaInfo | null {
  if (!ACTIVE_STATUSES.includes(app.status)) return null;

  const stages =
    (app.moduleVersion?.workflowDefinition as WorkflowStage[] | undefined) ?? [];
  if (!Array.isArray(stages) || stages.length === 0) return null;

  // Prefer the recorded current stage; otherwise fall back to the earliest
  // stage that carries an SLA (so freshly submitted apps still show progress).
  let stage = app.currentStage
    ? stages.find((s) => s.key === app.currentStage)
    : undefined;
  if (!stage) {
    stage = [...stages]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .find((s) => s.slaBusinessDays && s.slaBusinessDays > 0);
  }
  if (!stage?.slaBusinessDays || stage.slaBusinessDays <= 0) return null;

  // When did the application enter this stage? Use the most recent workflow
  // event into the stage, else the submission date, else creation date.
  const entryFromEvents = (app.workflowEvents ?? [])
    .filter((e) => e.toStage === stage!.key)
    .map((e) => toDate(e.createdAt))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const enteredAt =
    entryFromEvents ?? toDate(app.submittedAt) ?? toDate(app.createdAt);
  if (!enteredAt) return null;

  const sla = stage.slaBusinessDays;
  const dueDate = addBusinessDays(enteredAt, sla);
  const usedBusinessDays = Math.max(0, differenceInBusinessDays(now, enteredAt));
  const remainingBusinessDays = differenceInBusinessDays(dueDate, now);
  const reminder = stage.reminderDays ?? 2;

  let state: SlaState;
  if (remainingBusinessDays < 0) state = "breached";
  else if (remainingBusinessDays === 0) state = "due_today";
  else if (remainingBusinessDays <= reminder) state = "due_soon";
  else state = "on_track";

  return {
    stageKey: stage.key,
    stageLabel: stage.label,
    slaBusinessDays: sla,
    enteredAt,
    dueDate,
    usedBusinessDays,
    remainingBusinessDays,
    overdueBusinessDays: remainingBusinessDays < 0 ? -remainingBusinessDays : 0,
    state,
  };
}

/** Roll up a list of applications into headline SLA counts for a banner. */
export function summariseSla(
  apps: AppLike[],
  now: Date = new Date()
): { breached: number; dueToday: number; dueSoon: number; total: number } {
  let breached = 0;
  let dueToday = 0;
  let dueSoon = 0;
  for (const app of apps) {
    const sla = computeApplicationSla(app, now);
    if (!sla) continue;
    if (sla.state === "breached") breached += 1;
    else if (sla.state === "due_today") dueToday += 1;
    else if (sla.state === "due_soon") dueSoon += 1;
  }
  return { breached, dueToday, dueSoon, total: breached + dueToday + dueSoon };
}
