import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { contentDispositionHeader } from "@/lib/http/content-disposition";
import { assertUuid } from "@/lib/http/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const invalid = assertUuid(resolvedParams.documentId, "documentId");
  if (invalid) return invalid;

  const doc = await prisma.document.findUnique({
    where: { id: resolvedParams.documentId },
    include: { application: { select: { applicantId: true } } },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Applicants can only download their own docs; staff can download any
  const isStaff = ["REVIEWER", "MANAGER", "ADMIN"].includes(session.user.role);
  if (!isStaff && doc.application.applicantId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!doc.fileData) {
    return NextResponse.json({ error: "File data not available" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(doc.fileData), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": contentDispositionHeader(
        "inline",
        doc.originalFilename,
      ),
      "Content-Length": String(doc.fileSizeBytes),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
