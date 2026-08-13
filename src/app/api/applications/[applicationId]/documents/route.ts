import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertUuid } from "@/lib/http/validation";

const STAFF_ROLES = new Set(["REVIEWER", "MANAGER", "ADMIN"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const invalid = assertUuid(resolvedParams.applicationId, "applicationId");
  if (invalid) return invalid;

  const application = await prisma.application.findUnique({
    where: { id: resolvedParams.applicationId },
    select: { applicantId: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isStaff = STAFF_ROLES.has(session.user.role);
  if (!isStaff && application.applicantId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.document.findMany({
    where: { applicationId: resolvedParams.applicationId },
    select: {
      id: true,
      requirementKey: true,
      originalFilename: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(documents);
}
