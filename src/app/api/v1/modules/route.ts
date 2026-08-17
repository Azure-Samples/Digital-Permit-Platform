import type { Prisma } from "@prisma/client";
import { authenticateApiRequest } from "@/lib/api/auth";
import { apiJson, parsePagination } from "@/lib/api/response";
import { serializeModule } from "@/lib/api/serialize";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request, "modules:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);

  const where: Prisma.LicenceModuleWhereInput = {};
  const categoryParam = url.searchParams.get("category");
  if (categoryParam) where.category = categoryParam;
  const enabledParam = url.searchParams.get("enabled");
  if (enabledParam === "true" || enabledParam === "false") {
    where.enabled = enabledParam === "true";
  }

  const [total, modules] = await Promise.all([
    prisma.licenceModule.count({ where }),
    prisma.licenceModule.findMany({
      where,
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      take: limit,
      skip: offset,
    }),
  ]);

  return apiJson({
    data: modules.map(serializeModule),
    pagination: { limit, offset, total },
  });
}
