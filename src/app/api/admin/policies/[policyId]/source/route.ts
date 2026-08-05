import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ policyId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role === "APPLICANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { policyId } = await params;
  const policy = await prisma.licensingPolicy.findUnique({
    where: { id: policyId },
    select: {
      isActive: true,
      sourceFilename: true,
      sourceMimeType: true,
      sourceFileData: true,
    },
  });
  if (!policy?.sourceFileData || !policy.sourceFilename) {
    return NextResponse.json({ error: "Source document not found." }, { status: 404 });
  }
  if (
    !policy.isActive &&
    !new Set(["MANAGER", "ADMIN"]).has(session.user.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return new NextResponse(policy.sourceFileData, {
    headers: {
      "Content-Type": policy.sourceMimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(policy.sourceFilename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}