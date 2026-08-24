import type { ApplicationStatus, Prisma } from "@prisma/client";
import { authenticateApiRequest } from "@/lib/api/auth";
import { apiError, apiJson, parsePagination } from "@/lib/api/response";
import { apiApplicationInclude, serializeApplication } from "@/lib/api/serialize";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPLICATION_STATUSES = new Set<ApplicationStatus>([
  "DRAFT",
  "SUBMITTED",
  "AWAITING_PAYMENT",
  "AWAITING_DOCUMENTS",
  "UNDER_REVIEW",
  "AWAITING_INSPECTION",
  "AWAITING_CONSULTATION",
  "AWAITING_HEARING",
  "APPROVED",
  "REFUSED",
  "WITHDRAWN",
  "INCOMPLETE",
  "RETURNED",
  "CANCELLED",
]);

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request, "applications:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);

  const where: Prisma.ApplicationWhereInput = {};

  const statusParam = url.searchParams.get("status");
  if (statusParam) {
    const status = statusParam.toUpperCase();
    if (!APPLICATION_STATUSES.has(status as ApplicationStatus)) {
      return apiError(400, "invalid_status", `Unknown status: ${statusParam}.`);
    }
    where.status = status as ApplicationStatus;
  }

  const moduleParam = url.searchParams.get("module");
  if (moduleParam) {
    where.module = { moduleKey: moduleParam };
  }

  const typeParam = url.searchParams.get("type");
  if (typeParam) {
    where.applicationType = typeParam;
  }

  const [total, applications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      include: apiApplicationInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return apiJson({
    data: applications.map(serializeApplication),
    pagination: { limit, offset, total },
  });
}
