import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { isAiConfigured } from "@/lib/ai/openai";
import { runApplicationInsight } from "@/lib/ai/analysis-service";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { assertUuid } from "@/lib/http/validation";

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
  const invalid = assertUuid(applicationId, "applicationId");
  if (invalid) return invalid;
  const insight = await prisma.applicationPolicyInsight.findUnique({
    where: { applicationId: applicationId as string },
  });
  return NextResponse.json({ insight });
}

// POST — start (or refresh) generation of the policy insight.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !STAFF_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured on this environment." },
      { status: 503 }
    );
  }

  let payload: { applicationId?: unknown } = {};
  try {
    payload = (await req.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const invalidId = assertUuid(payload.applicationId, "applicationId");
  if (invalidId) return invalidId;
  const applicationId = payload.applicationId as string;

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
