import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveDraftAnswers } from "@/lib/modules/applications";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { assertSlug, assertUuid } from "@/lib/http/validation";

export async function PUT(
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
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "sectionKey and answers are required" },
        { status: 400 },
      );
    }
    const { sectionKey, answers } = body as {
      sectionKey?: unknown;
      answers?: unknown;
    };
    const invalidSlug = assertSlug(sectionKey, "sectionKey");
    if (invalidSlug) return invalidSlug;
    if (
      typeof answers !== "object" ||
      answers === null ||
      Array.isArray(answers)
    ) {
      return NextResponse.json(
        { error: "answers must be an object." },
        { status: 400 },
      );
    }

    const updated = await saveDraftAnswers(
      resolvedParams.applicationId,
      sectionKey as string,
      answers as Record<string, unknown>,
      session.user.id
    );

    return NextResponse.json({ success: true, answers: updated });
  } catch (error) {
    console.error(
      "Answers save error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Failed to save answers" },
      { status: 400 },
    );
  }
}
