import { authenticateApiRequest } from "@/lib/api/auth";
import { apiJson } from "@/lib/api/response";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request, "statistics:read");
  if (!auth.ok) return auth.response;

  const [total, byStatus, byModule, enabledModules] = await Promise.all([
    prisma.application.count(),
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.application.groupBy({ by: ["moduleId"], _count: { _all: true } }),
    prisma.licenceModule.count({ where: { enabled: true } }),
  ]);

  const moduleIds = byModule.map((row) => row.moduleId);
  const modules = await prisma.licenceModule.findMany({
    where: { id: { in: moduleIds } },
    select: { id: true, moduleKey: true, displayName: true },
  });
  const moduleById = new Map(modules.map((module) => [module.id, module]));

  return apiJson({
    data: {
      applications: {
        total,
        byStatus: Object.fromEntries(
          byStatus.map((row) => [row.status, row._count._all]),
        ),
        byModule: byModule
          .map((row) => ({
            module: moduleById.get(row.moduleId)?.moduleKey ?? row.moduleId,
            name: moduleById.get(row.moduleId)?.displayName ?? null,
            count: row._count._all,
          }))
          .sort((a, b) => b.count - a.count),
      },
      modules: { enabled: enabledModules },
      generatedAt: new Date().toISOString(),
    },
  });
}
