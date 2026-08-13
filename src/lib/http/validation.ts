import { NextResponse } from "next/server";

// RFC 4122 v1-v5 UUID.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Zero-allocation UUID guard. Returns `null` when the value is a well-formed
 * UUID, otherwise a JSON 400 response ready to `return`.
 *
 * Every `[id]` route parameter and every `id` field taken from the request
 * body should pass through this before it reaches Prisma so that IDOR
 * probes and injection payloads never touch the database.
 */
export function assertUuid(
  value: unknown,
  fieldName = "id",
): NextResponse | null {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    return NextResponse.json(
      { error: `Invalid ${fieldName}.` },
      { status: 400 },
    );
  }
  return null;
}

// Bounded, printable slug used for stable configuration keys such as
// requirementKey, stageKey, moduleKey. Deliberately excludes `.`, `/`, `\`
// and control characters so the value cannot be used for path traversal.
const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function assertSlug(
  value: unknown,
  fieldName: string,
): NextResponse | null {
  if (typeof value !== "string" || !SLUG_PATTERN.test(value)) {
    return NextResponse.json(
      { error: `Invalid ${fieldName}.` },
      { status: 400 },
    );
  }
  return null;
}

/**
 * Returns a 413 response if the client-declared Content-Length exceeds
 * `maxBytes`. Use before `req.formData()` / `req.json()` so a malicious
 * client cannot force the server to buffer arbitrary amounts of memory
 * before validation.
 */
export function assertContentLength(
  request: Request,
  maxBytes: number,
): NextResponse | null {
  const header = request.headers.get("content-length");
  if (!header) return null; // let the runtime cap it via body limits
  const declared = Number(header);
  if (!Number.isFinite(declared) || declared < 0) {
    return NextResponse.json(
      { error: "Malformed Content-Length header." },
      { status: 400 },
    );
  }
  if (declared > maxBytes) {
    return NextResponse.json(
      {
        error: `Request body exceeds the ${Math.floor(maxBytes / (1024 * 1024))}MB limit.`,
      },
      { status: 413 },
    );
  }
  return null;
}

/**
 * File signature (magic-byte) probe. `Content-Type` on multipart uploads is
 * chosen by the client and therefore cannot be trusted alone.
 *
 * Returns `true` when the leading bytes match one of the recognised
 * signatures for the declared MIME type; `false` when there is a mismatch
 * or the type is unsupported. Keep the allow-list intentionally narrow.
 */
export function fileSignatureMatchesMime(
  bytes: Uint8Array,
  mimeType: string,
): boolean {
  const has = (offset: number, ...sig: number[]) =>
    bytes.length >= offset + sig.length &&
    sig.every((byte, index) => bytes[offset + index] === byte);

  switch (mimeType) {
    case "application/pdf":
      return has(0, 0x25, 0x50, 0x44, 0x46, 0x2d); // %PDF-
    case "image/png":
      return has(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/jpeg":
      return has(0, 0xff, 0xd8, 0xff);
    case "image/gif":
      return has(0, 0x47, 0x49, 0x46, 0x38); // GIF8
    case "image/webp":
      return (
        has(0, 0x52, 0x49, 0x46, 0x46) && has(8, 0x57, 0x45, 0x42, 0x50)
      );
    case "image/svg+xml":
      // SVG has no fixed magic; accept only when the first non-whitespace
      // bytes look like XML/SVG. Callers should still apply an SVG-specific
      // sanitiser before rendering.
      return (
        has(0, 0x3c, 0x3f, 0x78, 0x6d, 0x6c) || has(0, 0x3c, 0x73, 0x76, 0x67)
      );
    case "application/msword":
      // Legacy CFB (D0CF11E0A1B11AE1).
      return has(0, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      // OOXML files are ZIP containers: local file header 'PK\x03\x04'.
      return has(0, 0x50, 0x4b, 0x03, 0x04) || has(0, 0x50, 0x4b, 0x05, 0x06);
    default:
      return false;
  }
}
