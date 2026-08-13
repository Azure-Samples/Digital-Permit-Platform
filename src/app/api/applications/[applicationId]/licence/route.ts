import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateLicenceDocument } from "@/lib/licence-generator";
import { contentDispositionHeader } from "@/lib/http/content-disposition";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !["REVIEWER", "MANAGER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const result = await generateLicenceDocument(
      resolvedParams.applicationId,
      session.user.id
    );

    // Return the filled DOCX as a download
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": contentDispositionHeader(
          "attachment",
          `licence_${result.licenceNumber.replace(/\//g, "_")}.docx`,
        ),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate licence";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
