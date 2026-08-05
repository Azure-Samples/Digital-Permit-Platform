import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
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
