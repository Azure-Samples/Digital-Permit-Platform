// ─────────────────────────────────────────────────────────────
// Module registry service
// ─────────────────────────────────────────────────────────────
import { prisma } from "../db";
import { writeAuditLog } from "../audit";
import type {
  FormSection,
  DocumentRequirement,
  WorkflowStage,
  ChecklistItem,
  FeeSchedule,
} from "@/types/module";

/**
 * Get all enabled modules with their active versions, for the public catalogue.
 */
export async function getPublicModuleCatalogue() {
  const modules = await prisma.licenceModule.findMany({
    where: { enabled: true },
    include: {
      versions: {
        where: { isActive: true, visibility: "PUBLIC" },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return modules
    .filter((m) => m.versions.length > 0)
    .map((m) => ({
      id: m.id,
      moduleKey: m.moduleKey,
      displayName: m.displayName,
      category: m.category,
      sortOrder: m.sortOrder,
      publicDescription: m.versions[0].publicDescription,
      helpText: m.versions[0].helpText,
      beforeYouStartText: m.versions[0].beforeYouStartText,
      applicationTypes: m.versions[0].applicationTypes,
      paymentMode: m.versions[0].paymentMode,
      acceptingApplications: m.versions[0].acceptingApplications,
      versionId: m.versions[0].id,
    }));
}

/**
 * Get all modules for admin listing (includes draft/disabled).
 */
export async function getAllModules() {
  return prisma.licenceModule.findMany({
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
      _count: { select: { applications: true } },
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
}

/**
 * Get a single module with its active version and full configuration.
 */
export async function getModuleByKey(moduleKey: string) {
  const module = await prisma.licenceModule.findUnique({
    where: { moduleKey },
    include: {
      versions: {
        where: { isActive: true },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!module || module.versions.length === 0) return null;

  const version = module.versions[0];
  return {
    ...module,
    activeVersion: {
      ...version,
      formSchema: (version.formSchema as unknown) as FormSection[],
      documentRequirements: (version.documentRequirements as unknown) as DocumentRequirement[],
      workflowDefinition: (version.workflowDefinition as unknown) as WorkflowStage[],
      reviewChecklist: (version.reviewChecklist as unknown) as ChecklistItem[],
      feeSchedule: (version.feeSchedule as unknown) as FeeSchedule | null,
    },
  };
}

/**
 * Get a specific module version by ID.
 */
export async function getModuleVersion(versionId: string) {
  const version = await prisma.moduleVersion.findUnique({
    where: { id: versionId },
    include: {
      module: true,
      owningTeam: true,
    },
  });

  if (!version) return null;

  return {
    ...version,
    formSchema: (version.formSchema as unknown) as FormSection[],
    documentRequirements: (version.documentRequirements as unknown) as DocumentRequirement[],
    workflowDefinition: (version.workflowDefinition as unknown) as WorkflowStage[],
    reviewChecklist: (version.reviewChecklist as unknown) as ChecklistItem[],
    feeSchedule: (version.feeSchedule as unknown) as FeeSchedule | null,
  };
}

/**
 * Create a disabled draft module with a minimal first version.
 */
export async function createLicenceModule(
  data: {
    moduleKey: string;
    displayName: string;
    category: string;
    publicDescription?: string;
  },
  userId: string,
) {
  const existing = await prisma.licenceModule.findUnique({
    where: { moduleKey: data.moduleKey },
    select: { id: true },
  });
  if (existing) throw new Error("MODULE_KEY_EXISTS");

  const module = await prisma.licenceModule.create({
    data: {
      moduleKey: data.moduleKey,
      displayName: data.displayName,
      category: data.category,
      enabled: false,
      versions: {
        create: {
          version: 1,
          isActive: true,
          visibility: "DRAFT",
          publicDescription: data.publicDescription || null,
          applicationTypes: ["new"],
          paymentMode: "NO_FEE",
          formSchema: [],
          documentRequirements: [],
          workflowDefinition: [
            {
              key: "validation",
              label: "Application validation",
              order: 1,
              type: "validation",
              slaBusinessDays: 5,
              visibleToApplicant: true,
            },
            {
              key: "decision",
              label: "Decision",
              order: 2,
              type: "decision",
              slaBusinessDays: 5,
              visibleToApplicant: true,
            },
          ],
          reviewChecklist: [],
          acceptingApplications: false,
        },
      },
    },
  });

  await writeAuditLog({
    userId,
    action: "module.create",
    entityType: "LicenceModule",
    entityId: module.id,
    newValues: {
      moduleKey: module.moduleKey,
      displayName: module.displayName,
      category: module.category,
      enabled: module.enabled,
    },
  });

  return module;
}

/**
 * Toggle module enabled/disabled.
 */
export async function toggleModule(
  moduleId: string,
  enabled: boolean,
  userId: string
) {
  const prev = await prisma.licenceModule.findUnique({ where: { id: moduleId } });
  const module = await prisma.licenceModule.update({
    where: { id: moduleId },
    data: { enabled },
  });

  await writeAuditLog({
    userId,
    action: enabled ? "module.enable" : "module.disable",
    entityType: "LicenceModule",
    entityId: moduleId,
    previousValues: { enabled: prev?.enabled },
    newValues: { enabled },
  });

  return module;
}

/**
 * Create a new version of a module (preserving history).
 */
export async function createModuleVersion(
  moduleId: string,
  data: {
    formSchema: FormSection[];
    documentRequirements: DocumentRequirement[];
    workflowDefinition: WorkflowStage[];
    reviewChecklist: ChecklistItem[];
    feeSchedule?: FeeSchedule;
    publicDescription?: string;
    helpText?: string;
    beforeYouStartText?: string;
    visibility?: "PUBLIC" | "STAFF_ONLY" | "DRAFT";
    paymentMode?: string;
    applicationTypes?: string[];
    submissionMailbox?: string;
    owningTeamId?: string;
    acceptingApplications?: boolean;
  },
  userId: string
) {
  // Deactivate previous versions
  await prisma.moduleVersion.updateMany({
    where: { moduleId, isActive: true },
    data: { isActive: false },
  });

  // Get next version number
  const latest = await prisma.moduleVersion.findFirst({
    where: { moduleId },
    orderBy: { version: "desc" },
  });

  const newVersion = await prisma.moduleVersion.create({
    data: {
      moduleId,
      version: (latest?.version ?? 0) + 1,
      isActive: true,
      publishedAt: data.visibility === "PUBLIC" ? new Date() : null,
      visibility: (data.visibility as any) ?? "DRAFT",
      publicDescription: data.publicDescription,
      helpText: data.helpText,
      beforeYouStartText: data.beforeYouStartText,
      applicationTypes: data.applicationTypes ?? ["new"],
      paymentMode: (data.paymentMode as any) ?? "NO_FEE",
      feeSchedule: (data.feeSchedule as any) ?? undefined,
      formSchema: data.formSchema as any,
      documentRequirements: data.documentRequirements as any,
      workflowDefinition: data.workflowDefinition as any,
      reviewChecklist: data.reviewChecklist as any,
      submissionMailbox: data.submissionMailbox,
      owningTeamId: data.owningTeamId,
      acceptingApplications: data.acceptingApplications ?? true,
    },
  });

  await writeAuditLog({
    userId,
    action: "module.version.create",
    entityType: "ModuleVersion",
    entityId: newVersion.id,
    newValues: { moduleId, version: newVersion.version },
  });

  return newVersion;
}
