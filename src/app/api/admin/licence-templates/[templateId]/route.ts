import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isTrustedMutationOrigin } from "@/lib/http/origin";

const assignmentsSchema = z.object({
  moduleIds: z.array(z.string().uuid()).min(1),
});

async function requireAdmin(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Only administrators can manage licence templates." },
        { status: 403 },
      ),
    };
  }
  if (!isTrustedMutationOrigin(request)) {
    return {
      error: NextResponse.json({ error: "Invalid request origin." }, { status: 403 }),
    };
  }
  return { session };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const access = await requireAdmin(request);
  if ("error" in access) return access.error;

  try {
    const { templateId } = await params;
    const body = await request.json();
    const parsed = assignmentsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Select at least one valid licence type." },
        { status: 400 },
      );
    }
    const moduleIds = [...new Set(parsed.data.moduleIds)];
    const [template, modules] = await Promise.all([
      prisma.licenceTemplate.findUnique({
        where: { id: templateId },
        select: {
          name: true,
          assignments: { select: { moduleId: true } },
        },
      }),
      prisma.licenceModule.findMany({
        where: { id: { in: moduleIds } },
        select: { id: true },
      }),
    ]);
    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    if (modules.length !== moduleIds.length) {
      return NextResponse.json(
        { error: "One or more selected licence types no longer exist." },
        { status: 409 },
      );
    }

    await prisma.$transaction([
      prisma.licenceTemplateAssignment.deleteMany({ where: { templateId } }),
      prisma.licenceTemplateAssignment.createMany({
        data: moduleIds.map((moduleId) => ({ templateId, moduleId })),
      }),
    ]);
    await writeAuditLog({
      userId: access.session.user.id,
      action: "licence.template.assign",
      entityType: "LicenceTemplate",
      entityId: templateId,
      previousValues: {
        moduleIds: template.assignments.map(({ moduleId }) => moduleId),
      },
      newValues: { moduleIds },
    });

    return NextResponse.json({ id: templateId, moduleIds });
  } catch (error) {
    console.error("Licence template assignment failed:", error);
    return NextResponse.json(
      { error: "Licence template assignment failed." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const access = await requireAdmin(request);
  if ("error" in access) return access.error;

  const { templateId } = await params;
  const template = await prisma.licenceTemplate.findUnique({
    where: { id: templateId },
    select: { name: true, originalFilename: true },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  await prisma.licenceTemplate.delete({ where: { id: templateId } });
  await writeAuditLog({
    userId: access.session.user.id,
    action: "licence.template.delete",
    entityType: "LicenceTemplate",
    entityId: templateId,
    previousValues: template,
  });
  return NextResponse.json({ id: templateId });
}