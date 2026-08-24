import { authenticateApiRequest } from "@/lib/api/auth";
import { apiError, apiJson } from "@/lib/api/response";
import { apiApplicationInclude, serializeApplication } from "@/lib/api/serialize";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const auth = await authenticateApiRequest(request, "applications:read");
  if (!auth.ok) return auth.response;

  const { reference } = await params;
  const application = await prisma.application.findUnique({
    where: { referenceNumber: reference },
    include: apiApplicationInclude,
  });

  if (!application) {
    return apiError(404, "not_found", `No application with reference ${reference}.`);
  }

  return apiJson({ data: serializeApplication(application) });
}
