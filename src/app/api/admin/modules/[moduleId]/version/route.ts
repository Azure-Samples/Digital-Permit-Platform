import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createModuleVersion } from "@/lib/modules/registry";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const body = await req.json();

    const version = await createModuleVersion(
      resolvedParams.moduleId,
      {
        formSchema: body.formSchema ?? [],
        documentRequirements: body.documentRequirements ?? [],
        workflowDefinition: body.workflowDefinition ?? [],
        reviewChecklist: body.reviewChecklist ?? [],
        feeSchedule: body.feeSchedule,
        publicDescription: body.publicDescription,
        helpText: body.helpText,
        beforeYouStartText: body.beforeYouStartText,
        visibility: body.visibility,
        paymentMode: body.paymentMode,
        applicationTypes: body.applicationTypes,
        submissionMailbox: body.submissionMailbox,
        acceptingApplications: body.acceptingApplications,
      },
      session.user.id
    );

    return NextResponse.json({ success: true, versionId: version.id });
  } catch (error) {
    console.error("Module version create error:", error);
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500 }
    );
  }
}
