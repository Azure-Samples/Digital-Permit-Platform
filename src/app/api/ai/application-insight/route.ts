import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { isAiConfigured } from "@/lib/ai/openai";
import { runApplicationInsight } from "@/lib/ai/analysis-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_ROLES = new Set(["REVIEWER", "MANAGER", "ADMIN"]);

// GET — read the cached policy insight for an application.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !STAFF_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const applicationId = req.nextUrl.searchParams.get("applicationId");
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId required" }, { status: 400 });
  }
  const insight = await prisma.applicationPolicyInsight.findUnique({
    where: { applicationId },
  });
  return NextResponse.json({ insight });
}

// POST — start (or refresh) generation of the policy insight.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !STAFF_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured on this environment." },
      { status: 503 }
    );
  }

  let applicationId: string | undefined;
  try {
    ({ applicationId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId required" }, { status: 400 });
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const insight = await prisma.applicationPolicyInsight.upsert({
    where: { applicationId },
    create: {
      applicationId,
      status: "PROCESSING",
      generatedById: session.user.id,
    },
    update: {
      status: "PROCESSING",
      errorMessage: null,
      generatedById: session.user.id,
    },
    select: { id: true, status: true },
  });

  await writeAuditLog({
    userId: session.user.id,
    applicationId,
    action: "ai.application_insight.start",
    entityType: "ApplicationPolicyInsight",
    entityId: insight.id,
  });

  void runApplicationInsight(applicationId);

  return NextResponse.json({ status: "PROCESSING" });
}
