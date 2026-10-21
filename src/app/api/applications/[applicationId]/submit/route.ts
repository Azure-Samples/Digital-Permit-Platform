import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitApplication } from "@/lib/workflow/engine";
import { createPayment, resolveFee } from "@/lib/payments";
import { prisma } from "@/lib/db";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { assertUuid } from "@/lib/http/validation";
import { validateAnswers } from "@/lib/api/validate";
import { getRequiredDocuments } from "@/lib/conditions";
import type { DocumentRequirement, FormSection } from "@/types/module";

const PAYMENT_REFERENCE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isTrustedMutationOrigin(req)) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }

    const resolvedParams = await params;
    const invalid = assertUuid(resolvedParams.applicationId, "applicationId");
    if (invalid) return invalid;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Malformed request body." },
        { status: 400 },
      );
    }
    const { declarationAccepted, paymentReference } = (body ?? {}) as {
      declarationAccepted?: unknown;
      paymentReference?: unknown;
    };

    if (declarationAccepted !== true) {
      return NextResponse.json(
        { error: "You must accept the declaration" },
        { status: 400 }
      );
    }
    if (
      paymentReference !== undefined &&
      (typeof paymentReference !== "string" ||
        (paymentReference !== "" && !PAYMENT_REFERENCE_PATTERN.test(paymentReference)))
    ) {
      return NextResponse.json(
        { error: "Invalid payment reference." },
        { status: 400 },
      );
    }

    const application = await prisma.application.findUnique({
      where: { id: resolvedParams.applicationId },
      include: { moduleVersion: true, documents: { select: { requirementKey: true, status: true } } },
    });
    if (!application || application.applicantId !== session.user.id) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (application.status !== "DRAFT") return NextResponse.json({ error: "This application has already been submitted." }, { status: 409 });
    const answers = application.answers as Record<string, Record<string, unknown>>;
    const validation = validateAnswers(application.moduleVersion.formSchema as unknown as FormSection[], answers);
    if (!validation.ok) return NextResponse.json({ error: "Complete the required application questions before submitting.", errors: validation.errors }, { status: 422 });
    const flatAnswers = Object.assign({}, ...Object.values(answers)) as Record<string, unknown>;
    const missingDocuments = getRequiredDocuments(application.moduleVersion.documentRequirements as unknown as DocumentRequirement[], flatAnswers)
      .filter((requirement) => requirement.required && !application.documents.some((document) => document.requirementKey === requirement.key && document.status !== "REJECTED"));
    if (missingDocuments.length) return NextResponse.json({ error: "Upload the required supporting documents before submitting." }, { status: 422 });
    if (application.moduleVersion.paymentMode === "MANUAL_REFERENCE" && (typeof paymentReference !== "string" || !paymentReference.trim())) return NextResponse.json({ error: "Enter the payment reference before submitting." }, { status: 422 });

    // Optimistic lock: only accept the declaration when the record is still
    // in DRAFT. Two concurrent submissions cannot both flip the row.
    const claimed = await prisma.application.updateMany({
      where: {
        id: resolvedParams.applicationId,
        applicantId: session.user.id,
        status: "DRAFT",
      },
      data: {
        declarationAccepted: true,
        declarationTimestamp: new Date(),
        declarationSignatory: session.user.name,
      },
    });
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "Application is not available to submit." },
        { status: 409 },
      );
    }

    if (typeof paymentReference === "string" && paymentReference.length > 0) {
      const app = await prisma.application.findUnique({
        where: { id: resolvedParams.applicationId },
        include: { moduleVersion: true },
      });

      if (app) {
        await createPayment({
          applicationId: resolvedParams.applicationId,
          amount: resolveFee(app.moduleVersion.feeSchedule as Record<string, unknown> | null, app.applicationType),
          paymentMode: app.moduleVersion.paymentMode,
          externalReference: paymentReference,
          userId: session.user.id,
        });
      }
    }

    // Submit and start workflow
    const result = await submitApplication(resolvedParams.applicationId, session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      status: result.newStatus,
      stage: result.toStage,
    });
  } catch (error) {
    console.error(
      "Submit error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "Submission failed" }, { status: 400 });
  }
}
