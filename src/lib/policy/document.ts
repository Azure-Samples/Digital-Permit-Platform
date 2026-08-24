import path from "node:path";
import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import { normalizePolicyText } from "./import";

export const POLICY_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
] as const;

export const MAX_POLICY_FILE_SIZE_MB = 50;
export const MAX_POLICY_TEXT_CHARACTERS = 2_000_000;
const MAX_POLICY_PDF_PAGES = 1_000;
const MAX_DOCX_ENTRIES = 250;
const MAX_DOCX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_DOCX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_DOCX_COMPRESSION_RATIO = 100;
const POLICY_PARSE_TIMEOUT_MS = 60_000;

export class PolicyTextUnavailableError extends Error {}

export interface PolicyTextExtractionResult {
  text: string;
  searchIndexTruncated: boolean;
}

type PolicyDocumentType = "pdf" | "docx" | "text";

const requireFromHere = createRequire(import.meta.url);
const parserModulePaths = {
  pdf: requireFromHere.resolve("pdf-parse/lib/pdf-parse.js"),
  mammoth: requireFromHere.resolve("mammoth"),
  jszip: requireFromHere.resolve("jszip"),
};

const parserWorkerSource = `
const { parentPort, workerData } = require("node:worker_threads");

async function parse() {
  const buffer = Buffer.from(workerData.buffer);
  let text = "";
  if (workerData.documentType === "pdf") {
    const pdfParse = require(workerData.modules.pdf);
    const parsed = await pdfParse(buffer);
    if ((parsed.numpages || 0) > workerData.maxPdfPages) {
      throw new Error("The PDF contains too many pages.");
    }
    text = parsed.text || "";
  } else {
    const JSZip = require(workerData.modules.jszip);
    const zip = await JSZip.loadAsync(buffer, { createFolders: false });
    const entries = Object.values(zip.files);
    if (entries.length > workerData.maxDocxEntries) {
      throw new Error("The DOCX archive contains too many entries.");
    }
    let uncompressedBytes = 0;
    let compressedBytes = 0;
    for (const entry of entries) {
      if (entry.dir) continue;
      const uncompressedSize = Number(entry._data?.uncompressedSize || 0);
      const compressedSize = Number(entry._data?.compressedSize || 0);
      if (uncompressedSize > workerData.maxDocxEntryBytes) {
        throw new Error("The DOCX archive contains an oversized entry.");
      }
      uncompressedBytes += uncompressedSize;
      compressedBytes += compressedSize;
    }
    if (uncompressedBytes > workerData.maxDocxUncompressedBytes) {
      throw new Error("The expanded DOCX document is too large.");
    }
    if (
      compressedBytes > 0 &&
      uncompressedBytes / compressedBytes > workerData.maxDocxCompressionRatio
    ) {
      throw new Error("The DOCX compression ratio is not accepted.");
    }
    const mammoth = require(workerData.modules.mammoth);
    text = (await mammoth.extractRawText({ buffer })).value || "";
  }
  const searchIndexTruncated = text.length > workerData.maxTextCharacters;
  text = text.slice(0, workerData.maxTextCharacters);
  parentPort.postMessage({ text, searchIndexTruncated });
}

parse().catch((error) => {
  parentPort.postMessage({ error: error instanceof Error ? error.message : "Document parsing failed." });
});
`;

function parseInBoundedWorker(
  buffer: Buffer,
  documentType: "pdf" | "docx",
): Promise<PolicyTextExtractionResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(parserWorkerSource, {
      eval: true,
      workerData: {
        buffer: Uint8Array.from(buffer),
        documentType,
        modules: parserModulePaths,
        maxTextCharacters: MAX_POLICY_TEXT_CHARACTERS,
        maxPdfPages: MAX_POLICY_PDF_PAGES,
        maxDocxEntries: MAX_DOCX_ENTRIES,
        maxDocxUncompressedBytes: MAX_DOCX_UNCOMPRESSED_BYTES,
        maxDocxEntryBytes: MAX_DOCX_ENTRY_BYTES,
        maxDocxCompressionRatio: MAX_DOCX_COMPRESSION_RATIO,
      },
      resourceLimits: {
        maxOldGenerationSizeMb: 256,
        maxYoungGenerationSizeMb: 64,
        stackSizeMb: 4,
      },
    });
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      void worker.terminate();
      callback();
    };
    const timeout = setTimeout(() => {
      finish(() => reject(new Error("Policy document parsing timed out.")));
    }, POLICY_PARSE_TIMEOUT_MS);
    worker.once("message", (message: {
      text?: string;
      searchIndexTruncated?: boolean;
      error?: string;
    }) => {
      finish(() =>
        message.error
          ? reject(new Error(message.error))
          : resolve({
              text: message.text ?? "",
              searchIndexTruncated: Boolean(message.searchIndexTruncated),
            }),
      );
    });
    worker.once("error", () => {
      finish(() => reject(new Error("Policy document parsing failed safely.")));
    });
    worker.once("exit", (code) => {
      if (code !== 0) {
        finish(() => reject(new Error("Policy document parsing exceeded its resource limit.")));
      }
    });
  });
}

export function sanitizePolicyFilename(filename: string): string {
  const sanitized = [...path.basename(filename)]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
  const extension = path.extname(sanitized).slice(0, 20);
  const stem = path.basename(sanitized, extension);
  return `${stem.slice(0, Math.max(1, 240 - extension.length))}${extension}`;
}

export function detectPolicyDocumentType(
  filename: string,
  mimeType: string,
): PolicyDocumentType | null {
  const extension = path.extname(filename).toLowerCase();
  if (mimeType === "application/pdf" && extension === ".pdf") return "pdf";
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
    extension === ".docx"
  ) {
    return "docx";
  }
  if (
    ["text/plain", "text/markdown"].includes(mimeType) &&
    [".txt", ".md", ".markdown"].includes(extension)
  ) {
    return "text";
  }
  return null;
}

function validateSignature(buffer: Buffer, type: PolicyDocumentType) {
  if (type === "pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("The file does not contain a valid PDF signature.");
  }
  if (type === "docx" && buffer.subarray(0, 2).toString("ascii") !== "PK") {
    throw new Error("The file does not contain a valid DOCX signature.");
  }
  if (type === "text" && buffer.includes(0)) {
    throw new Error("The text file contains binary data.");
  }
}

export async function extractPolicyDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<PolicyTextExtractionResult> {
  const documentType = detectPolicyDocumentType(filename, mimeType);
  if (!documentType) {
    throw new Error("Upload a PDF, DOCX, Markdown, or plain-text policy document.");
  }
  validateSignature(buffer, documentType);

  const extracted =
    documentType === "text"
      ? {
          text: buffer.toString("utf8"),
          searchIndexTruncated: buffer.length > MAX_POLICY_TEXT_CHARACTERS,
        }
      : await parseInBoundedWorker(buffer, documentType);

  const normalized = normalizePolicyText(extracted.text);
  if (normalized.length < 200) {
    throw new PolicyTextUnavailableError(
      documentType === "pdf"
        ? "Very little searchable text was extracted. The PDF may be scanned or image-only."
        : "The policy document does not contain enough readable text.",
    );
  }
  return {
    text: normalized.slice(0, MAX_POLICY_TEXT_CHARACTERS),
    searchIndexTruncated:
      extracted.searchIndexTruncated || normalized.length > MAX_POLICY_TEXT_CHARACTERS,
  };
}

export async function extractPolicyDocumentText(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  return (await extractPolicyDocument(buffer, filename, mimeType)).text;
}