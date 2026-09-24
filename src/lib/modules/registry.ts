// ─────────────────────────────────────────────────────────────
// Module registry service
// ─────────────────────────────────────────────────────────────
import { Prisma, type ModuleVersion } from "@prisma/client";
import { prisma } from "../db";
import {
  createModuleDefinition,
  getModuleReadiness,
  moduleDefinitionSchema,
  moduleIdentitySchema,
  type DefinitionIssue,
  type ModuleDefinition,
} from "./definition";
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
  const modules = await prisma.licenceModule.findMany({
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
      _count: { select: { applications: true } },
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  const published = await prisma.moduleVersion.findMany({
    where: { isActive: true, visibility: { not: "DRAFT" } },
    select: { moduleId: true, version: true, visibility: true },
  });
  const liveVersions = new Map(published.map((version) => [version.moduleId, version]));
  return modules.map((module) => ({ ...module, liveVersion: liveVersions.get(module.id) ?? null }));
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

export class ModuleBuilderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issues: DefinitionIssue[] = [],
  ) {
    super(message);
  }
}

export async function getModuleBuilderOptions() {
  const [modules, teams] = await Promise.all([
    prisma.licenceModule.findMany({
      select: { id: true, moduleKey: true, displayName: true, category: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { modules, teams, categories: [...new Set(modules.map((module) => module.category))].sort() };
}

export async function getModuleForBuilder(moduleKey: string) {
  const [module, liveVersion] = await Promise.all([
    prisma.licenceModule.findUnique({
      where: { moduleKey },
      include: { versions: { orderBy: { version: "desc" }, take: 20 } },
    }),
    prisma.moduleVersion.findFirst({
      where: { module: { moduleKey }, isActive: true, visibility: { not: "DRAFT" } },
      orderBy: { version: "desc" },
      select: { id: true, version: true, visibility: true, acceptingApplications: true },
    }),
  ]);
  return module?.versions.length ? { ...module, liveVersion } : null;
}

function definitionData(definition: ModuleDefinition, previous?: ModuleVersion) {
  const json = (value: unknown) => value == null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
  return {
    visibility: definition.visibility,
    publicDescription: definition.publicDescription || null,
    helpText: definition.helpText || null,
    beforeYouStartText: definition.beforeYouStartText || null,
    applicationTypes: definition.applicationTypes,
    paymentMode: definition.paymentMode,
    feeSchedule: json(definition.feeSchedule),
    formSchema: json(definition.formSchema),
    documentRequirements: json(definition.documentRequirements),
    workflowDefinition: json(definition.workflowDefinition.map((stage, index) => ({ ...stage, order: index + 1 }))),
    reviewChecklist: json(definition.reviewChecklist),
    submissionMailbox: definition.submissionMailbox || null,
    owningTeamId: definition.owningTeamId || null,
    acceptingApplications: definition.acceptingApplications,
    eligibilityRules: json(definition.eligibilityRules === undefined ? previous?.eligibilityRules : definition.eligibilityRules),
    conditionalRules: json(definition.conditionalRules === undefined ? previous?.conditionalRules : definition.conditionalRules),
    notificationTemplates: json(definition.notificationTemplates === undefined ? previous?.notificationTemplates : definition.notificationTemplates),
    retentionPolicy: json(definition.retentionPolicy === undefined ? previous?.retentionPolicy : definition.retentionPolicy),
    decisionTemplates: json(definition.decisionTemplates === undefined ? previous?.decisionTemplates : definition.decisionTemplates),
    verificationStatus: definition.verificationStatus ?? previous?.verificationStatus ?? "NEEDS_COUNCIL_CONFIRMATION" as const,
  };
}

function translateWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new ModuleBuilderError("A module with that key already exists. Choose a different key.", 409);
    if (error.code === "P2025") throw new ModuleBuilderError("This module no longer exists.", 404);
    if (error.code === "P2003") throw new ModuleBuilderError("The selected team is no longer available. Choose another team.", 422);
  }
  throw error;
}

export async function createLicenceModule(
  data: {
    moduleKey: string;
    displayName: string;
    category: string;
    publicDescription?: string;
    definition?: ModuleDefinition;
  },
  userId: string,
) {
  const identity = moduleIdentitySchema.parse(data);
  const definition = moduleDefinitionSchema.parse(data.definition ?? {
    ...createModuleDefinition(), publicDescription: data.publicDescription ?? "",
  });
  try {
    return await prisma.$transaction(async (transaction) => {
      const module = await transaction.licenceModule.create({
        data: {
          ...identity,
          enabled: false,
          versions: { create: {
            ...definitionData(definition),
            version: 1,
            isActive: false,
            visibility: "DRAFT",
            acceptingApplications: false,
          } },
        },
        include: { versions: true },
      });
      await transaction.auditLog.create({ data: {
        userId, action: "module.create", entityType: "LicenceModule", entityId: module.id,
        newValues: { ...identity, enabled: false, version: 1 },
      } });
      return module;
    });
  } catch (error) {
    translateWriteError(error);
  }
}

/**
 * Toggle module enabled/disabled.
 */
export async function toggleModule(
  moduleId: string,
  enabled: boolean,
  userId: string
) {
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.licenceModule.findUnique({ where: { id: moduleId } });
    if (!previous) throw new ModuleBuilderError("Module not found.", 404);
    if (enabled && !await transaction.moduleVersion.findFirst({ where: { moduleId, isActive: true, visibility: { not: "DRAFT" } }, select: { id: true } })) {
      throw new ModuleBuilderError("Publish a version before enabling this module.", 422);
    }
    const module = await transaction.licenceModule.update({ where: { id: moduleId }, data: { enabled } });
    await transaction.auditLog.create({ data: {
      userId,
      action: enabled ? "module.enable" : "module.disable",
      entityType: "LicenceModule",
      entityId: moduleId,
      previousValues: { enabled: previous.enabled },
      newValues: { enabled },
    } });
    return module;
  });
}

/**
 * Create a new version of a module (preserving history).
 */
export async function createModuleVersion(
  moduleId: string,
  data: ModuleDefinition,
  userId: string,
  options: { intent: "draft" | "publish"; baseVersionId: string; enableModule?: boolean },
) {
  const definition = moduleDefinitionSchema.parse(data);
  const publishing = options.intent === "publish";
  if (publishing) {
    const issues = getModuleReadiness(definition, Number(process.env.MAX_FILE_SIZE_MB) || 10);
    if (definition.visibility === "DRAFT") issues.push({ area: "general", path: "visibility", message: "Choose public or staff-only visibility before publishing." });
    if (issues.length) throw new ModuleBuilderError("Resolve the validation issues before publishing.", 422, issues);
  }
  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.licenceModule.update({ where: { id: moduleId }, data: { updatedAt: new Date() } });
      const latest = await transaction.moduleVersion.findFirst({ where: { moduleId }, orderBy: { version: "desc" } });
      if (!latest || latest.id !== options.baseVersionId) {
        throw new ModuleBuilderError("Another administrator saved a newer version. Export your changes, then reload the latest version before saving.", 409);
      }
      if (publishing) {
        await transaction.moduleVersion.updateMany({ where: { moduleId, isActive: true }, data: { isActive: false } });
        if (options.enableModule !== undefined) {
          await transaction.licenceModule.update({ where: { id: moduleId }, data: { enabled: options.enableModule } });
        }
      }
      const version = await transaction.moduleVersion.create({ data: {
        ...definitionData(definition, latest),
        moduleId,
        version: latest.version + 1,
        isActive: publishing,
        publishedAt: publishing ? new Date() : null,
        visibility: publishing ? definition.visibility : "DRAFT",
        acceptingApplications: publishing ? definition.acceptingApplications : false,
      } });
      await transaction.auditLog.create({ data: {
        userId,
        action: publishing ? "module.version.publish" : "module.version.draft",
        entityType: "ModuleVersion",
        entityId: version.id,
        previousValues: { baseVersionId: latest.id },
        newValues: { moduleId, version: version.version, visibility: version.visibility, enabled: options.enableModule ?? null },
      } });
      return version;
    });
  } catch (error) {
    translateWriteError(error);
  }
}
