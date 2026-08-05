import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveDraftAnswers } from "@/lib/modules/applications";

export async function PUT(
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
    const { sectionKey, answers } = body;

    if (!sectionKey || typeof answers !== "object") {
      return NextResponse.json(
        { error: "sectionKey and answers are required" },
        { status: 400 }
      );
    }

    const updated = await saveDraftAnswers(
      resolvedParams.applicationId,
      sectionKey,
      answers,
      session.user.id
    );

    return NextResponse.json({ success: true, answers: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save answers";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
