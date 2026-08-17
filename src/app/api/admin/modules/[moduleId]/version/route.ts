import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createModuleVersion } from "@/lib/modules/registry";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { assertUuid } from "@/lib/http/validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isTrustedMutationOrigin(req)) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }

    const resolvedParams = await params;
    const invalid = assertUuid(resolvedParams.moduleId, "moduleId");
    if (invalid) return invalid;

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Malformed request body." },
        { status: 400 },
      );
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Malformed request body." },
        { status: 400 },
      );
    }

    const version = await createModuleVersion(
      resolvedParams.moduleId,
      {
        formSchema: (body.formSchema as never) ?? [],
        documentRequirements: (body.documentRequirements as never) ?? [],
        workflowDefinition: (body.workflowDefinition as never) ?? [],
        reviewChecklist: (body.reviewChecklist as never) ?? [],
        feeSchedule: body.feeSchedule as never,
        publicDescription:
          typeof body.publicDescription === "string"
            ? body.publicDescription
            : undefined,
        helpText:
          typeof body.helpText === "string" ? body.helpText : undefined,
        beforeYouStartText:
          typeof body.beforeYouStartText === "string"
            ? body.beforeYouStartText
            : undefined,
        visibility: body.visibility as never,
        paymentMode:
          typeof body.paymentMode === "string" ? body.paymentMode : undefined,
        applicationTypes: Array.isArray(body.applicationTypes)
          ? (body.applicationTypes as string[])
          : undefined,
        submissionMailbox:
          typeof body.submissionMailbox === "string"
            ? body.submissionMailbox
            : undefined,
        acceptingApplications:
          typeof body.acceptingApplications === "boolean"
            ? body.acceptingApplications
            : undefined,
      },
      session.user.id
    );

    return NextResponse.json({ success: true, versionId: version.id });
  } catch (error) {
    console.error(
      "Module version create error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500 }
    );
  }
}
