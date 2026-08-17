import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { isAiConfigured } from "@/lib/ai/openai";
import { runApplicationInsight } from "@/lib/ai/analysis-service";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { policyRegimeForModule } from "@/lib/policy/regimes";
import { isPolicyInsightCurrent } from "@/lib/policy/insight-provenance";

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
  const [insight, application] = await Promise.all([
    prisma.applicationPolicyInsight.findUnique({ where: { applicationId } }),
    prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        module: { select: { category: true, moduleKey: true } },
      },
    }),
  ]);
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const policyRegime = policyRegimeForModule(
    application.module.category,
    application.module.moduleKey,
  );
  const activePolicy = await prisma.licensingPolicy.findFirst({
    where: { regime: policyRegime, isActive: true },
    select: { id: true, regime: true, versionLabel: true },
  });
  const current = isPolicyInsightCurrent(
    insight,
    activePolicy
      ? {
          id: activePolicy.id,
          regime: policyRegime,
          versionLabel: activePolicy.versionLabel,
        }
      : null,
  );
  return NextResponse.json({
    insight: current ? insight : null,
    stale: Boolean(insight && !current),
    policyRegime,
  });
}

// POST — start (or refresh) generation of the policy insight.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !STAFF_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
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
      policyId: null,
      policyRegime: null,
      policyVersionLabel: null,
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
