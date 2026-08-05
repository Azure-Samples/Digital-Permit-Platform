// ─────────────────────────────────────────────────────────────
// Licence document generator
// Fills a DOCX template with application data and returns a buffer
// ─────────────────────────────────────────────────────────────
import { createReport } from "docx-templates";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { getApplicantDisplayName } from "./applicant-name";
import { formatDateDDMMYYYY } from "./format";
import { writeAuditLog } from "./audit";

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
    templatePath:
      (stored?.templatePath as string) ??
      "public/templates/private-hire-driver-licence.docx",
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

/**
 * Build address lines from form answers.
 */
function buildAddressLines(
  answers: Record<string, unknown>
): string {
  // Flatten sections
  const flat: Record<string, unknown> = {};
  for (const [, v] of Object.entries(answers)) {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      Object.assign(flat, v);
    }
  }

  // Look for address object or individual fields
  const addr = flat["address"] as Record<string, string> | undefined;
  if (addr && typeof addr === "object") {
    return [addr.line1, addr.line2, addr.town, addr.county, addr.postcode?.toUpperCase()]
      .filter(Boolean)
      .join("\n");
  }

  // Try individual fields
  return [
    flat["address_line_1"] || flat["addressLine1"],
    flat["address_line_2"] || flat["addressLine2"],
    flat["town"] || flat["city"],
    flat["county"],
    (flat["postcode"] as string)?.toUpperCase(),
  ]
    .filter(Boolean)
    .join("\n");
}

export interface GenerateLicenceResult {
  licenceNumber: string;
  storagePath: string;
  buffer: Buffer;
}

/**
 * Generate a filled licence document for an approved application.
 */
export async function generateLicenceDocument(
  applicationId: string,
  userId: string
): Promise<GenerateLicenceResult> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      applicant: {
        include: { applicantProfile: true },
      },
      module: true,
    },
  });

  if (!app) throw new Error("Application not found");
  if (app.decisionOutcome !== "approved") {
    throw new Error("Application must be approved to generate a licence");
  }

  const config = await getLicenceConfig();
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

  // Build address
  const licHolderAddress = buildAddressLines(answers);

  // Read template
  const templatePath = path.join(process.cwd(), config.templatePath);
  const template = await readFile(templatePath);

  // Fill template
  const filledDoc = await createReport({
    template,
    data: {
      lic_no: licenceNumber,
      commencement_date: formatDateDDMMYYYY(
        commencementDate.toISOString().split("T")[0]
      ),
      expiry_date: formatDateDDMMYYYY(
        expiryDate.toISOString().split("T")[0]
      ),
      lic_holder: licHolder,
      lic_holder_address: licHolderAddress,
    },
    cmdDelimiter: ["{{", "}}"],
  });

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
    },
  });

  return { licenceNumber, storagePath: licenceDoc.id, buffer };
}
