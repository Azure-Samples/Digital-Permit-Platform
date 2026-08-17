import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { MAX_LICENCE_TEMPLATE_FILE_SIZE_MB } from "@/lib/licence-template-fields";
import { inspectLicenceTemplate } from "@/lib/licence-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const metadataSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500),
  moduleIds: z.array(z.string().uuid()).min(1),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can upload licence templates." },
      { status: 403 },
    );
  }
  if (!isTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a DOCX template." }, { status: 400 });
    }
    if (
      file.size === 0 ||
      file.size > MAX_LICENCE_TEMPLATE_FILE_SIZE_MB * 1024 * 1024
    ) {
      return NextResponse.json(
        {
          error: `Templates must be between 1 byte and ${MAX_LICENCE_TEMPLATE_FILE_SIZE_MB}MB.`,
        },
        { status: 400 },
      );
    }

    const moduleIds = [
      ...new Set(
        form
          .getAll("moduleIds")
          .filter((value): value is string => typeof value === "string"),
      ),
    ];
    const parsed = metadataSchema.safeParse({
      name: form.get("name"),
      description: form.get("description") ?? "",
      moduleIds,
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Enter a template name and select at least one licence type.",
        },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const inspected = await inspectLicenceTemplate({
      filename: file.name,
      mimeType: file.type,
      bytes,
    });
    const modules = await prisma.licenceModule.findMany({
      where: { id: { in: parsed.data.moduleIds } },
      select: { id: true },
    });
    if (modules.length !== parsed.data.moduleIds.length) {
      return NextResponse.json(
        { error: "One or more selected licence types no longer exist." },
        { status: 409 },
      );
    }

    const template = await prisma.licenceTemplate.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        originalFilename: inspected.filename,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: bytes.byteLength,
        fileData: bytes,
        placeholders: inspected.placeholders,
        uploadedById: session.user.id,
        assignments: {
          create: parsed.data.moduleIds.map((moduleId) => ({ moduleId })),
        },
      },
      select: { id: true },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "licence.template.upload",
      entityType: "LicenceTemplate",
      entityId: template.id,
      newValues: {
        name: parsed.data.name,
        filename: inspected.filename,
        moduleIds: parsed.data.moduleIds,
        placeholders: inspected.placeholders,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Licence template upload failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Licence template upload failed.",
      },
      { status: 422 },
    );
  }
}