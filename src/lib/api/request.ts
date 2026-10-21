// ─────────────────────────────────────────────────────────────
// External API request parsing and safety limits
// ─────────────────────────────────────────────────────────────
// Boundary helpers for the write API: enforce JSON content type,
// cap the request body, and read optional idempotency headers.
// ─────────────────────────────────────────────────────────────
import type { NextResponse } from "next/server";
import { apiError } from "./response";

// Write payloads are small structured JSON; binary documents are out of scope.
export const MAX_JSON_BODY_BYTES = 64 * 1024;

export type JsonBodyResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: NextResponse };

function tooLarge(maxBytes: number): NextResponse {
  return apiError(
    413,
    "payload_too_large",
    `The request body exceeds the ${maxBytes}-byte limit.`,
  );
}

function parseJsonObject(raw: string, maxBytes: number): JsonBodyResult {
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    return { ok: false, response: tooLarge(maxBytes) };
  }
  if (raw.trim() === "") {
    return {
      ok: false,
      response: apiError(400, "invalid_body", "Provide a JSON object body."),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      response: apiError(400, "invalid_json", "The request body is not valid JSON."),
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      response: apiError(400, "invalid_body", "The request body must be a JSON object."),
    };
  }

  return { ok: true, data: parsed as Record<string, unknown> };
}

function wrongContentType(request: Request): NextResponse | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return apiError(
      415,
      "unsupported_media_type",
      "Send a JSON body with Content-Type: application/json.",
    );
  }
  return null;
}

function declaredTooLarge(request: Request, maxBytes: number): NextResponse | null {
  const declaredLength = Number.parseInt(
    request.headers.get("content-length") ?? "",
    10,
  );
  return Number.isFinite(declaredLength) && declaredLength > maxBytes
    ? tooLarge(maxBytes)
    : null;
}

/**
 * Read and validate a required JSON object request body.
 * Rejects the wrong content type, oversized bodies, and non-object payloads.
 */
export async function readJsonObject(
  request: Request,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<JsonBodyResult> {
  const badType = wrongContentType(request);
  if (badType) return { ok: false, response: badType };
  const oversize = declaredTooLarge(request, maxBytes);
  if (oversize) return { ok: false, response: oversize };
  return parseJsonObject(await request.text(), maxBytes);
}

/** Like readJsonObject, but treats an absent or empty body as an empty object. */
export async function readOptionalJsonObject(
  request: Request,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<JsonBodyResult> {
  const oversize = declaredTooLarge(request, maxBytes);
  if (oversize) return { ok: false, response: oversize };
  const raw = await request.text();
  if (raw.trim() === "") return { ok: true, data: {} };
  const badType = wrongContentType(request);
  if (badType) return { ok: false, response: badType };
  return parseJsonObject(raw, maxBytes);
}

/** Read a bounded, trimmed Idempotency-Key header, or null when absent/invalid. */
export function idempotencyKeyFrom(request: Request): string | null {
  const value = request.headers.get("idempotency-key");
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 200 ? trimmed : null;
}
