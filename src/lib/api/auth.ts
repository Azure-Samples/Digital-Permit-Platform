// ─────────────────────────────────────────────────────────────
// External API authentication (Bearer API keys)
// ─────────────────────────────────────────────────────────────
// Verifies the Authorization: Bearer <key> header against a hashed,
// active, non-expired ApiClient record, enforces the required scope
// and applies a per-client rate limit. No secret is ever logged.
// ─────────────────────────────────────────────────────────────
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { hashApiKey } from "./keys";
import { apiError } from "./response";
import type { ApiScope } from "./scopes";

export interface AuthenticatedApiClient {
  id: string;
  name: string;
  scopes: string[];
}

type AuthResult =
  | { ok: true; client: AuthenticatedApiClient }
  | { ok: false; response: NextResponse };

// Generous per-minute budget for server-to-server polling.
const RATE_LIMIT = { max: 120, windowMs: 60_000 };

function unauthorized(message: string): AuthResult {
  return {
    ok: false,
    response: apiError(401, "unauthorized", message, {
      "WWW-Authenticate": 'Bearer realm="Digital Permit Platform API"',
    }),
  };
}

export async function authenticateApiRequest(
  request: Request,
  requiredScope: ApiScope,
): Promise<AuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return unauthorized(
      "Provide your API key as an Authorization: Bearer <key> header.",
    );
  }

  const keyHash = hashApiKey(match[1]);
  const client = await prisma.apiClient.findUnique({ where: { keyHash } });
  if (!client || !client.isActive || client.revokedAt) {
    return unauthorized("The API key is invalid or has been revoked.");
  }
  if (client.expiresAt && client.expiresAt.getTime() <= Date.now()) {
    return unauthorized("The API key has expired.");
  }

  const rate = checkRateLimit(`api-client:${client.id}`, RATE_LIMIT);
  if (!rate.allowed) {
    return {
      ok: false,
      response: apiError(429, "rate_limited", "Too many requests. Slow down.", {
        "Retry-After": String(rate.retryAfterSeconds),
      }),
    };
  }

  if (!client.scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: apiError(
        403,
        "insufficient_scope",
        `This API key is missing the required scope: ${requiredScope}.`,
      ),
    };
  }

  // Best-effort usage timestamp; never block the request on it.
  void prisma.apiClient
    .update({ where: { id: client.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    ok: true,
    client: { id: client.id, name: client.name, scopes: client.scopes },
  };
}
