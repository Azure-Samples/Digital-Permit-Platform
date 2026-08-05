import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitApplication } from "@/lib/workflow/engine";
import { createPayment } from "@/lib/payments";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const body = await req.json();
    const { declarationAccepted, paymentReference } = body;

    if (!declarationAccepted) {
      return NextResponse.json(
        { error: "You must accept the declaration" },
        { status: 400 }
      );
    }

    // Update declaration
    await prisma.application.update({
      where: { id: resolvedParams.applicationId },
      data: {
        declarationAccepted: true,
        declarationTimestamp: new Date(),
        declarationSignatory: session.user.name,
      },
    });

    // Record payment if provided
    if (paymentReference) {
      const app = await prisma.application.findUnique({
        where: { id: resolvedParams.applicationId },
        include: { moduleVersion: true },
      });

      if (app) {
        await createPayment({
          applicationId: resolvedParams.applicationId,
          amount: 0,
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
    const message =
      error instanceof Error ? error.message : "Submission failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
