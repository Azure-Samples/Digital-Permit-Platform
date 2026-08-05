import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_ROLES = new Set(["REVIEWER", "MANAGER", "ADMIN"]);

// GET — poll the status/result of a licence analysis.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !STAFF_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const analysis = await prisma.licenceAnalysis.findUnique({
    where: { id: resolvedParams.id },
    select: {
      id: true,
      title: true,
      status: true,
      summary: true,
      compliance: true,
      errorMessage: true,
      tokensUsed: true,
      model: true,
      createdAt: true,
    },
  });

  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(analysis);
}
