import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

// Allowed MIME types
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const applicationId = formData.get("applicationId") as string;
    const requirementKey = formData.get("requirementKey") as string;

    if (!file || !applicationId || !requirementKey) {
      return NextResponse.json(
        { error: "file, applicationId, and requirementKey are required" },
        { status: 400 }
      );
    }

    // Verify application belongs to user
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application || application.applicantId !== session.user.id) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not accepted` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_SIZE_MB}MB limit` },
        { status: 400 }
      );
    }

    // Read file into buffer and store directly in Postgres
    const buffer = Buffer.from(await file.arrayBuffer());

    const document = await prisma.document.create({
      data: {
        applicationId,
        requirementKey,
        originalFilename: file.name,
        storagePath: "db",
        mimeType: file.type,
        fileSizeBytes: file.size,
        fileData: buffer,
        status: "UPLOADED",
        uploadedByUserId: session.user.id,
      },
    });

    // Audit log
    await writeAuditLog({
      userId: session.user.id,
      applicationId,
      action: "document.upload",
      entityType: "Document",
      entityId: document.id,
      newValues: {
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        requirementKey,
      },
    });

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        requirementKey: document.requirementKey,
        originalFilename: document.originalFilename,
        status: document.status,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
