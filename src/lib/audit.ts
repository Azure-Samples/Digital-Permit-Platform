// ─────────────────────────────────────────────────────────────
// Immutable audit logger
// ─────────────────────────────────────────────────────────────
import { prisma } from "./db";

export interface AuditEntry {
  userId?: string;
  applicationId?: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(entry: AuditEntry) {
  return prisma.auditLog.create({
    data: {
      userId: entry.userId,
      applicationId: entry.applicationId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      previousValues: (entry.previousValues ?? undefined) as any,
      newValues: (entry.newValues ?? undefined) as any,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    },
  });
}

export async function getAuditTrail(
  filters: {
    applicationId?: string;
    userId?: string;
    entityType?: string;
    action?: string;
    from?: Date;
    to?: Date;
  },
  page = 1,
  pageSize = 50
) {
  const where: Record<string, unknown> = {};
  if (filters.applicationId) where.applicationId = filters.applicationId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.action) where.action = filters.action;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
}
