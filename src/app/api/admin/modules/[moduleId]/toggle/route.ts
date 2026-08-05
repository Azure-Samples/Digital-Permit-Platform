import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { toggleModule } from "@/lib/modules/registry";
import { prisma } from "@/lib/db";

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
    const current = await prisma.licenceModule.findUnique({
      where: { id: resolvedParams.moduleId },
    });
    if (!current) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    await toggleModule(resolvedParams.moduleId, !current.enabled, session.user.id);

    // Redirect back to admin
    return NextResponse.redirect(new URL("/admin", req.url));
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to toggle module" },
      { status: 500 }
    );
  }
}
