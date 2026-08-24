import path from "node:path";
import { createReport } from "docx-templates";
import JSZip from "jszip";
import type { FormSection } from "@/types/module";
import { formatAnswerValue, formatDateDDMMYYYY } from "./format";
import {
  LICENCE_TEMPLATE_MIME_TYPE,
  MAX_LICENCE_TEMPLATE_FILE_SIZE_MB,
  type TemplatePlaceholder,
} from "./licence-template-fields";

const ALLOWED_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  LICENCE_TEMPLATE_MIME_TYPE,
]);
const MAX_DOCX_ENTRIES = 250;
const MAX_DOCX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_DOCX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_DOCX_COMPRESSION_RATIO = 100;

interface ZipEntrySizes {
  compressedSize?: number;
  uncompressedSize?: number;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripXmlTags(value: string): string {
  let previous: string;
  let current = value;
  do {
    previous = current;
    current = current.replace(/<[^<>]*>/g, "");
  } while (current !== previous);
  return current;
}

export function sanitizeLicenceTemplateFilename(filename: string): string {
  const safe = path.basename(filename.replace(/\0/g, "")).replace(
    /[^A-Za-z0-9._ -]/g,
    "_",
  );
  return safe.slice(-240) || "licence-template.docx";
}

export async function inspectLicenceTemplate(input: {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<{ filename: string; placeholders: string[] }> {
  const filename = sanitizeLicenceTemplateFilename(input.filename);
  if (!filename.toLowerCase().endsWith(".docx")) {
    throw new Error("Upload a Microsoft Word DOCX template.");
  }
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new Error("Upload a Microsoft Word DOCX template.");
  }
  if (
    input.bytes.byteLength === 0 ||
    input.bytes.byteLength > MAX_LICENCE_TEMPLATE_FILE_SIZE_MB * 1024 * 1024
  ) {
    throw new Error(
      `Templates must be between 1 byte and ${MAX_LICENCE_TEMPLATE_FILE_SIZE_MB}MB.`,
    );
  }
  if (String.fromCharCode(...input.bytes.slice(0, 2)) !== "PK") {
    throw new Error("The selected file is not a valid DOCX document.");
  }

  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(input.bytes);
  } catch {
    throw new Error("The selected file is not a valid DOCX document.");
  }

  if (!archive.file("[Content_Types].xml")) {
    throw new Error("The selected file is not a valid DOCX document.");
  }
  const entries = Object.values(archive.files);
  if (entries.length > MAX_DOCX_ENTRIES) {
    throw new Error("The DOCX archive contains too many entries.");
  }
  let uncompressedBytes = 0;
  let compressedBytes = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    const sizes = (
      entry as unknown as { _data?: ZipEntrySizes }
    )._data;
    const uncompressedSize = Number(sizes?.uncompressedSize ?? 0);
    const compressedSize = Number(sizes?.compressedSize ?? 0);
    if (uncompressedSize > MAX_DOCX_ENTRY_BYTES) {
      throw new Error("The DOCX archive contains an oversized entry.");
    }
    uncompressedBytes += uncompressedSize;
    compressedBytes += compressedSize;
  }
  if (uncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
    throw new Error("The expanded DOCX document is too large.");
  }
  if (
    compressedBytes > 0 &&
    uncompressedBytes / compressedBytes > MAX_DOCX_COMPRESSION_RATIO
  ) {
    throw new Error("The DOCX compression ratio is not accepted.");
  }

  if (!archive.file("word/document.xml")) {
    throw new Error("The DOCX does not contain a Word document body.");
  }
  const contentEntries = entries.filter(
    (entry) =>
      !entry.dir &&
      /^word\/(document|header\d+|footer\d+)\.xml$/.test(entry.name),
  );
  const documentText = decodeXmlText(
    (
      await Promise.all(
        contentEntries.map(async (entry) => {
          const xml = await entry.async("string");
          return stripXmlTags(xml.replace(/<\/w:p>/g, "\n"));
        }),
      )
    ).join("\n"),
  );
  const placeholders = [
    ...new Set(
      Array.from(documentText.matchAll(/<\s*([A-Za-z][A-Za-z0-9_]*)\s*>/g),
        (match) => match[1],
      ),
    ),
  ].sort();

  return { filename, placeholders };
}

export function getApplicationTemplatePlaceholders(
  sections: FormSection[],
): TemplatePlaceholder[] {
  const placeholders = new Map<string, TemplatePlaceholder>();
  for (const section of sections) {
    for (const field of section.fields) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(field.key)) continue;
      placeholders.set(field.key, {
        key: field.key,
        label: field.label,
        description: `Application field in ${section.title}`,
      });
    }
  }
  return [...placeholders.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

function flattenAnswers(
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};
  for (const value of Object.values(answers)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(flattened, value);
    }
  }
  return flattened;
}

function formatTemplateValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined || value === "") return "";
  return formatAnswerValue(value);
}

function buildAddressLines(
  flattened: Record<string, unknown>,
  fallback?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    town?: string | null;
    county?: string | null;
    postcode?: string | null;
  } | null,
): string {
  const address = flattened.address;
  if (typeof address === "object" && address !== null && !Array.isArray(address)) {
    const values = address as Record<string, unknown>;
    return [
      values.line1,
      values.line2,
      values.town || values.city,
      values.county,
      typeof values.postcode === "string"
        ? values.postcode.toUpperCase()
        : values.postcode,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    flattened.address_line_1 || flattened.addressLine1 || fallback?.addressLine1,
    flattened.address_line_2 || flattened.addressLine2 || fallback?.addressLine2,
    flattened.town || flattened.city || fallback?.town,
    flattened.county || fallback?.county,
    typeof (flattened.postcode || fallback?.postcode) === "string"
      ? String(flattened.postcode || fallback?.postcode).toUpperCase()
      : flattened.postcode || fallback?.postcode,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildLicenceTemplateData(input: {
  answers: Record<string, unknown>;
  formSchema?: FormSection[];
  moduleName: string;
  referenceNumber: string;
  applicationType: string;
  licenceNumber: string;
  issueDate: Date;
  expiryDate: Date;
  applicantName: string;
  applicantProfile?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    town?: string | null;
    county?: string | null;
    postcode?: string | null;
  } | null;
  councilName?: string;
  serviceName?: string;
  supportEmail?: string;
  supportPhone?: string;
}): Record<string, string | number | boolean> {
  const flattened = flattenAnswers(input.answers);
  const applicationFields: Record<string, string | number | boolean> = Object.fromEntries(
    getApplicationTemplatePlaceholders(input.formSchema ?? []).map(({ key }) => [
      key,
      "",
    ]),
  );
  for (const [key, value] of Object.entries(flattened)) {
    applicationFields[key] = formatTemplateValue(value);
  }
  const issueDate = formatDateDDMMYYYY(input.issueDate.toISOString().slice(0, 10));
  const expiryDate = formatDateDDMMYYYY(
    input.expiryDate.toISOString().slice(0, 10),
  );
  const applicantAddress = buildAddressLines(
    flattened,
    input.applicantProfile,
  );
  const applicationType = input.applicationType
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());

  return {
    ...applicationFields,
    council_name: input.councilName ?? "",
    service_name: input.serviceName ?? "",
    support_email: input.supportEmail ?? "",
    support_phone: input.supportPhone ?? "",
    licence_type: input.moduleName,
    licence_number: input.licenceNumber,
    application_reference: input.referenceNumber,
    application_type: applicationType,
    issue_date: issueDate,
    expiry_date: expiryDate,
    applicant_name: input.applicantName,
    applicant_address: applicantAddress,
    lic_no: input.licenceNumber,
    commencement_date: issueDate,
    lic_holder: input.applicantName,
    lic_holder_address: applicantAddress,
  };
}

export async function renderLicenceTemplate(
  template: Uint8Array,
  data: Record<string, string | number | boolean>,
): Promise<Uint8Array> {
  const angleBracketResult = await createReport({
    template,
    data,
    cmdDelimiter: ["<", ">"],
  });
  return createReport({
    template: angleBracketResult,
    data,
    cmdDelimiter: ["{{", "}}"],
  });
}