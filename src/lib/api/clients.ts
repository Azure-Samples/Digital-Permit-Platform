// ─────────────────────────────────────────────────────────────
// External API client management (administrator side)
// ─────────────────────────────────────────────────────────────
import { prisma } from "@/lib/db";
import { generateApiKey } from "./keys";
import { normaliseScopes } from "./scopes";

export interface ApiClientSummary {
  id: string;
  name: string;
  description: string | null;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export class ApiClientInputError extends Error {}

const MAX_EXPIRY_DAYS = 3650;

function toSummary(client: {
  id: string;
  name: string;
  description: string | null;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): ApiClientSummary {
  return {
    id: client.id,
    name: client.name,
    description: client.description,
    keyPrefix: client.keyPrefix,
    scopes: client.scopes,
    isActive: client.isActive,
    expiresAt: client.expiresAt?.toISOString() ?? null,
    lastUsedAt: client.lastUsedAt?.toISOString() ?? null,
    revokedAt: client.revokedAt?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
  };
}

export async function listApiClients(): Promise<ApiClientSummary[]> {
  const clients = await prisma.apiClient.findMany({
    orderBy: { createdAt: "desc" },
  });
  return clients.map(toSummary);
}

export async function createApiClient(input: {
  name: unknown;
  description: unknown;
  scopes: unknown;
  expiresInDays: unknown;
  createdById: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ client: ApiClientSummary; plaintext: string }> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 120) {
    throw new ApiClientInputError("Give the API client a name of 2 to 120 characters.");
  }

  const description =
    typeof input.description === "string" && input.description.trim()
      ? input.description.trim().slice(0, 500)
      : null;

  const scopes = normaliseScopes(input.scopes);
  if (scopes.length === 0) {
    throw new ApiClientInputError("Select at least one valid scope for the API client.");
  }

  let expiresAt: Date | null = null;
  if (input.expiresInDays !== null && input.expiresInDays !== undefined && input.expiresInDays !== "") {
    const days = Number(input.expiresInDays);
    if (!Number.isInteger(days) || days < 1 || days > MAX_EXPIRY_DAYS) {
      throw new ApiClientInputError(
        `Expiry must be a whole number of days between 1 and ${MAX_EXPIRY_DAYS}.`,
      );
    }
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const key = generateApiKey();

  const created = await prisma.$transaction(async (transaction) => {
    const client = await transaction.apiClient.create({
      data: {
        name,
        description,
        scopes,
        expiresAt,
        keyPrefix: key.keyPrefix,
        keyHash: key.keyHash,
        createdById: input.createdById,
      },
    });

    await transaction.auditLog.create({
      data: {
        userId: input.createdById,
        action: "api_client.create",
        entityType: "ApiClient",
        entityId: client.id,
        newValues: {
          name: client.name,
          scopes: client.scopes,
          keyPrefix: client.keyPrefix,
          expiresAt: client.expiresAt?.toISOString() ?? null,
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    return client;
  });

  return { client: toSummary(created), plaintext: key.plaintext };
}

export async function revokeApiClient(input: {
  id: string;
  revokedById: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<ApiClientSummary> {
  const client = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.apiClient.findUnique({
      where: { id: input.id },
    });
    if (!existing) throw new ApiClientInputError("API client not found.");
    if (!existing.isActive) return existing;

    const updated = await transaction.apiClient.update({
      where: { id: input.id },
      data: { isActive: false, revokedAt: new Date() },
    });

    await transaction.auditLog.create({
      data: {
        userId: input.revokedById,
        action: "api_client.revoke",
        entityType: "ApiClient",
        entityId: updated.id,
        previousValues: { keyPrefix: existing.keyPrefix, isActive: true },
        newValues: { keyPrefix: updated.keyPrefix, isActive: false },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    return updated;
  });

  return toSummary(client);
}
