// ─────────────────────────────────────────────────────────────
// Application service
// ─────────────────────────────────────────────────────────────
import { prisma } from "../db";
import { writeAuditLog } from "../audit";
import { generateReferenceNumber } from "../reference";
import { Prisma, type ApplicationStatus } from "@prisma/client";

export interface CreateApplicationInput {
  moduleId: string;
  moduleVersionId: string;
  applicationType: string;
  applicantId: string;
  organisationId?: string;
}

export function mergeDraftAnswers(
  currentAnswers: Record<string, unknown>,
  sectionKey: string,
  sectionAnswers: Record<string, unknown>,
) {
  return {
    ...currentAnswers,
    [sectionKey]: sectionAnswers,
  };
}

/**
 * Create a new draft application.
 */
export async function createApplication(input: CreateApplicationInput) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const version = await transaction.moduleVersion.findUnique({
          where: { id: input.moduleVersionId },
          include: { module: true },
        });
        if (!version || version.moduleId !== input.moduleId || !version.module.enabled || !version.isActive || version.visibility !== "PUBLIC" || !version.acceptingApplications || !version.applicationTypes.includes(input.applicationType)) {
          throw new Error("This module is not accepting this application type.");
        }
        const now = new Date();
        const prefix = generateReferenceNumber(version.module.moduleKey, 0, now).replace(/\d+$/, "");
        let sequence = await transaction.application.count({ where: { referenceNumber: { startsWith: prefix } } }) + 1;
        let referenceNumber = generateReferenceNumber(version.module.moduleKey, sequence, now);
        while (await transaction.application.findUnique({ where: { referenceNumber }, select: { id: true } })) {
          sequence += 1;
          referenceNumber = generateReferenceNumber(version.module.moduleKey, sequence, now);
        }
        const application = await transaction.application.create({ data: {
          referenceNumber,
          moduleId: input.moduleId,
          moduleVersionId: input.moduleVersionId,
          applicationType: input.applicationType,
          applicantId: input.applicantId,
          organisationId: input.organisationId,
          status: "DRAFT",
          answers: {},
        } });
        await transaction.auditLog.create({ data: {
          userId: input.applicantId,
          applicationId: application.id,
          action: "application.create",
          entityType: "Application",
          entityId: application.id,
          newValues: { referenceNumber, moduleKey: version.module.moduleKey, applicationType: input.applicationType },
        } });
        return application;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2034"].includes(error.code) || attempt === 4) throw error;
    }
  }
  throw new Error("Application could not be created. Try again.");
}

/**
 * Save draft answers for an application section.
 */
export async function saveDraftAnswers(
  applicationId: string,
  sectionKey: string,
  answers: Record<string, unknown>,
  userId: string
) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!app) throw new Error("Application not found");
  if (app.applicantId !== userId) throw new Error("Not your application");
  if (app.status !== "DRAFT") throw new Error("Application is not in draft status");

  const currentAnswers = (app.answers as Record<string, unknown>) ?? {};
  const updatedAnswers = mergeDraftAnswers(currentAnswers, sectionKey, answers);

  await prisma.application.update({
    where: { id: applicationId },
    data: { answers: updatedAnswers as any },
  });

  await writeAuditLog({
    userId,
    applicationId,
    action: "application.save_draft",
    entityType: "Application",
    entityId: applicationId,
    newValues: { section: sectionKey },
  });

  return updatedAnswers;
}

/**
 * Get applications for a specific applicant.
 */
export async function getApplicantApplications(applicantId: string) {
  return prisma.application.findMany({
    where: { applicantId },
    include: {
      module: true,
      moduleVersion: {
        select: {
          id: true,
          version: true,
          paymentMode: true,
        },
      },
      documents: { select: { id: true, requirementKey: true, status: true } },
      payments: { select: { id: true, status: true, amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get applications for staff work queue with filters.
 */
export async function getStaffWorkQueue(filters: {
  status?: ApplicationStatus[];
  moduleId?: string;
  teamId?: string;
  assignedOfficerId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const { page = 1, pageSize = 20 } = filters;
  const where: any = {};

  if (filters.status?.length) {
    where.status = { in: filters.status };
  }
  if (filters.moduleId) {
    where.moduleId = filters.moduleId;
  }
  if (filters.assignedOfficerId) {
    where.assignedOfficerId = filters.assignedOfficerId;
  }
  if (filters.search) {
    where.OR = [
      { referenceNumber: { contains: filters.search, mode: "insensitive" } },
      {
        applicant: {
          OR: [
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        module: true,
        moduleVersion: { select: { workflowDefinition: true } },
        workflowEvents: {
          select: { toStage: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignedOfficer: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: {
            documents: true,
            messages: true,
            consultations: true,
            inspections: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.application.count({ where }),
  ]);

  return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
}

/**
 * Get full application detail for case view.
 */
export async function getApplicationDetail(applicationId: string) {
  return prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      module: true,
      moduleVersion: true,
      applicant: {
        include: { applicantProfile: true },
      },
      organisation: true,
      assignedOfficer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      documents: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      workflowEvents: { orderBy: { createdAt: "asc" } },
      caseReviews: { orderBy: { createdAt: "desc" } },
      consultations: { orderBy: { createdAt: "desc" } },
      inspections: { orderBy: { createdAt: "desc" } },
      hearings: { orderBy: { createdAt: "desc" } },
      trainingTasks: { orderBy: { createdAt: "desc" } },
      messages: { orderBy: { createdAt: "desc" } },
      caseNotes: {
        include: {
          author: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

/**
 * Get dashboard metrics for staff.
 */
export async function getDashboardMetrics(teamId?: string) {
  const where = teamId
    ? {
        moduleVersion: {
          owningTeamId: teamId,
        },
      }
    : {};

  const [
    total,
    draft,
    submitted,
    underReview,
    awaitingInspection,
    awaitingConsultation,
    awaitingHearing,
    approved,
    refused,
  ] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.count({ where: { ...where, status: "DRAFT" } }),
    prisma.application.count({ where: { ...where, status: "SUBMITTED" } }),
    prisma.application.count({ where: { ...where, status: "UNDER_REVIEW" } }),
    prisma.application.count({ where: { ...where, status: "AWAITING_INSPECTION" } }),
    prisma.application.count({ where: { ...where, status: "AWAITING_CONSULTATION" } }),
    prisma.application.count({ where: { ...where, status: "AWAITING_HEARING" } }),
    prisma.application.count({ where: { ...where, status: "APPROVED" } }),
    prisma.application.count({ where: { ...where, status: "REFUSED" } }),
  ]);

  return {
    total,
    draft,
    submitted,
    underReview,
    awaitingInspection,
    awaitingConsultation,
    awaitingHearing,
    approved,
    refused,
    incomplete: total - draft - submitted - underReview - awaitingInspection - awaitingConsultation - awaitingHearing - approved - refused,
  };
}

/**
 * Duplicate a previous application (for renewals / re-applications).
 */
export async function duplicateApplication(
  sourceApplicationId: string,
  applicantId: string,
  applicationType = "renewal"
) {
  const source = await prisma.application.findUnique({
    where: { id: sourceApplicationId },
    include: { module: true },
  });

  if (!source) throw new Error("Source application not found");
  if (source.applicantId !== applicantId) throw new Error("Not your application");

  // Get current active version of the module
  const activeVersion = await prisma.moduleVersion.findFirst({
    where: { moduleId: source.moduleId, isActive: true },
    orderBy: { version: "desc" },
  });

  if (!activeVersion) throw new Error("No active module version");

  return createApplication({
    moduleId: source.moduleId,
    moduleVersionId: activeVersion.id,
    applicationType,
    applicantId,
    organisationId: source.organisationId ?? undefined,
  });
}
