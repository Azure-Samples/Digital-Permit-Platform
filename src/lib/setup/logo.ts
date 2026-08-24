import { createHash } from "node:crypto";
import path from "node:path";
import { SetupInputError } from "./errors";

export const MAX_SETUP_LOGO_BYTES = 1024 * 1024;
export const SETUP_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

type SetupLogoMimeType = (typeof SETUP_LOGO_MIME_TYPES)[number];

export interface ValidatedSetupLogo {
  data: Uint8Array;
  fileName: string;
  mimeType: SetupLogoMimeType;
  hash: string;
}

export function validateSetupLogo(input: {
  data: Uint8Array;
  fileName: string;
  mimeType: string;
}): ValidatedSetupLogo {
  if (input.data.byteLength === 0 || input.data.byteLength > MAX_SETUP_LOGO_BYTES) {
    throw new SetupInputError("Council logos must be between 1 byte and 1 MB.");
  }
  if (!SETUP_LOGO_MIME_TYPES.includes(input.mimeType as SetupLogoMimeType)) {
    throw new SetupInputError("Upload a PNG, JPEG, WebP, or SVG council logo.");
  }

  const mimeType = input.mimeType as SetupLogoMimeType;
  assertMatchingSignature(input.data, mimeType);
  if (mimeType === "image/svg+xml") assertSafeSvg(input.data);

  const extension = extensionForMimeType(mimeType);
  const baseName = path
    .basename(input.fileName, path.extname(input.fileName))
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || "council-logo";
  const data = Uint8Array.from(input.data);

  return {
    data,
    fileName: `${baseName}.${extension}`,
    mimeType,
    hash: createHash("sha256").update(data).digest("hex"),
  };
}

function assertMatchingSignature(data: Uint8Array, mimeType: SetupLogoMimeType) {
  const startsWith = (...bytes: number[]) =>
    bytes.every((byte, index) => data[index] === byte);

  if (mimeType === "image/png" && !startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    throw new SetupInputError("The file content does not match a PNG image.");
  }
  if (mimeType === "image/jpeg" && !startsWith(0xff, 0xd8, 0xff)) {
    throw new SetupInputError("The file content does not match a JPEG image.");
  }
  if (
    mimeType === "image/webp" &&
    !(
      new TextDecoder("ascii").decode(data.slice(0, 4)) === "RIFF" &&
      new TextDecoder("ascii").decode(data.slice(8, 12)) === "WEBP"
    )
  ) {
    throw new SetupInputError("The file content does not match a WebP image.");
  }
  if (mimeType === "image/svg+xml") {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(data).trim();
    if (!/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(source)) {
      throw new SetupInputError("The file content does not match an SVG image.");
    }
  }
}

function assertSafeSvg(data: Uint8Array) {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(data);
  const unsafePatterns = [
    /<\s*(?:script|iframe|object|embed|foreignObject)\b/i,
    /\bon[a-z]+\s*=/i,
    /(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|data:|javascript:)/i,
    /url\s*\(\s*["']?\s*(?:https?:|\/\/|data:|javascript:)/i,
    /<!\s*(?:DOCTYPE|ENTITY)\b/i,
  ];
  if (unsafePatterns.some((pattern) => pattern.test(source))) {
    throw new SetupInputError("The SVG contains active or externally referenced content.");
  }
}

function extensionForMimeType(mimeType: SetupLogoMimeType) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
  }
}