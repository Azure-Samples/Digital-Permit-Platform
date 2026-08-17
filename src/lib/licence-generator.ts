// ─────────────────────────────────────────────────────────────
// Licence document generator
// Fills a DOCX template with application data and returns a buffer
// ─────────────────────────────────────────────────────────────
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { getApplicantDisplayName } from "./applicant-name";
import { writeAuditLog } from "./audit";
import {
  buildLicenceTemplateData,
  renderLicenceTemplate,
} from "./licence-templates";
import {
  STANDARD_LICENCE_TEMPLATE_ID,
  STANDARD_LICENCE_TEMPLATE_PATH,
} from "./licence-template-fields";
import { getCouncilProfile } from "./setup/profile";
import type { FormSection } from "@/types/module";

/**
 * Get licence config (duration etc.) from the database or defaults.
 */
export async function getLicenceConfig() {
  // For now, store config in a simple key-value approach
  // In future this could be a dedicated table
  const configs = await prisma.auditLog.findMany({
    where: { action: "licence.config.set", entityType: "LicenceConfig" },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  const stored = configs[0]?.newValues as Record<string, unknown> | null;

  return {
    defaultDurationYears: (stored?.defaultDurationYears as number) ?? 3,
    licenceNumberPrefix: (stored?.licenceNumberPrefix as string) ?? "PHD",
  };
}

/**
 * Generate a unique licence number.
 * Format: PREFIX/YYYY/NNNNN
 */
export async function generateLicenceNumber(prefix = "PHD"): Promise<string> {
  const year = new Date().getFullYear();

  // Count existing licences this year to generate sequence
  const count = await prisma.application.count({
    where: {
      decisionOutcome: "approved",
      decidedAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  });

  const seq = String(count + 1).padStart(5, "0");
  return `${prefix}/${year}/${seq}`;
}

export interface GenerateLicenceResult {
  licenceNumber: string;
  storagePath: string;
  buffer: Buffer;
  templateId: string;
  templateName: string;
}

/**
 * Generate a filled licence document for an approved application.
 */
export async function generateLicenceDocument(
  applicationId: string,
  userId: string,
  templateId = STANDARD_LICENCE_TEMPLATE_ID,
): Promise<GenerateLicenceResult> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      applicant: {
        include: { applicantProfile: true },
      },
      module: true,
      moduleVersion: { select: { formSchema: true } },
    },
  });

  if (!app) throw new Error("Application not found");
  if (app.decisionOutcome !== "approved") {
    throw new Error("Application must be approved to generate a licence");
  }

  const [config, councilProfile] = await Promise.all([
    getLicenceConfig(),
    getCouncilProfile(),
  ]);
  const answers = (app.answers as Record<string, unknown>) ?? {};

  // Generate licence number
  const licenceNumber = await generateLicenceNumber(config.licenceNumberPrefix);

  // Calculate dates
  const commencementDate = new Date();
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + config.defaultDurationYears);

  // Get applicant name from form answers
  const licHolder = getApplicantDisplayName(
    answers,
    app.applicant.firstName,
    app.applicant.lastName
  );

  let template: Uint8Array;
  let templateName: string;
  if (templateId === STANDARD_LICENCE_TEMPLATE_ID) {
    template = await readFile(
      path.join(process.cwd(), STANDARD_LICENCE_TEMPLATE_PATH),
    );
    templateName = "Standard licence template";
  } else {
    const uploadedTemplate = await prisma.licenceTemplate.findFirst({
      where: {
        id: templateId,
        assignments: { some: { moduleId: app.moduleId } },
      },
      select: { name: true, fileData: true },
    });
    if (!uploadedTemplate) {
      throw new Error("The selected template is not assigned to this licence type");
    }
    template = new Uint8Array(uploadedTemplate.fileData);
    templateName = uploadedTemplate.name;
  }

  const templateData = buildLicenceTemplateData({
    answers,
    formSchema: app.moduleVersion.formSchema as unknown as FormSection[],
    moduleName: app.module.displayName,
    referenceNumber: app.referenceNumber,
    applicationType: app.applicationType,
    licenceNumber,
    issueDate: commencementDate,
    expiryDate,
    applicantName: licHolder,
    applicantProfile: app.applicant.applicantProfile,
    councilName: councilProfile.organisationName,
    serviceName: councilProfile.serviceName,
    supportEmail: councilProfile.supportEmail,
    supportPhone: councilProfile.supportPhone,
  });
  const filledDoc = await renderLicenceTemplate(template, templateData);

  const buffer = Buffer.from(filledDoc);

  // Store licence document in database (same approach as document uploads)
  const licenceDoc = await prisma.document.create({
    data: {
      applicationId,
      requirementKey: "licence_document",
      originalFilename: `licence_${licenceNumber.replace(/\//g, "_")}.docx`,
      storagePath: "db",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileSizeBytes: buffer.length,
      fileData: buffer,
      status: "VERIFIED",
      uploadedByUserId: userId,
    },
  });

  // Update application with licence info
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      decisionLetterUrl: licenceDoc.id,
      expiresAt: expiryDate,
    },
  });

  // Audit log
  await writeAuditLog({
    userId,
    applicationId,
    action: "licence.generate",
    entityType: "Application",
    entityId: applicationId,
    newValues: {
      licenceNumber,
      commencementDate: commencementDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      documentId: licenceDoc.id,
      templateId,
      templateName,
    },
  });

  return {
    licenceNumber,
    storagePath: licenceDoc.id,
    buffer,
    templateId,
    templateName,
  };
}
