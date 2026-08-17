import { authenticateApiRequest } from "@/lib/api/auth";
import { apiJson } from "@/lib/api/response";
import { serializePolicy } from "@/lib/api/serialize";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request, "policies:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("active") === "false";

  const policies = await prisma.licensingPolicy.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ regime: "asc" }, { effectiveFrom: "desc" }],
    select: {
      regime: true,
      title: true,
      versionLabel: true,
      councilName: true,
      effectiveFrom: true,
      effectiveTo: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return apiJson({ data: policies.map(serializePolicy) });
}
