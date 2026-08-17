import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role === "APPLICANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = await params;
  const template = await prisma.licenceTemplate.findUnique({
    where: { id: templateId },
    select: {
      originalFilename: true,
      mimeType: true,
      fileData: true,
    },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return new NextResponse(template.fileData, {
    headers: {
      "Content-Type": template.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(template.originalFilename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}