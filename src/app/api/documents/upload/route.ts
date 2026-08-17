import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import {
  assertContentLength,
  assertSlug,
  assertUuid,
  fileSignatureMatchesMime,
} from "@/lib/http/validation";
import { requestClientAddress } from "@/lib/http/rate-limit";

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
const MAX_UPLOAD_BYTES = MAX_SIZE_MB * 1024 * 1024;
const MAX_FORMDATA_BYTES = MAX_UPLOAD_BYTES + 128 * 1024; // small overhead for multipart framing

function sanitizeOriginalFilename(name: string): string {
  const trimmed = name.replace(/[\r\n\t\0]/g, "").slice(-240).trim();
  if (!trimmed) return "upload";
  const basename = trimmed.split(/[\\/]/).pop() ?? "upload";
  return basename.replace(/[<>"|]/g, "_") || "upload";
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isTrustedMutationOrigin(req)) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }

    const oversized = assertContentLength(req, MAX_FORMDATA_BYTES);
    if (oversized) return oversized;

    const formData = await req.formData();
    const file = formData.get("file");
    const applicationId = formData.get("applicationId");
    const requirementKey = formData.get("requirementKey");

    if (!(file instanceof File) || typeof applicationId !== "string" || typeof requirementKey !== "string") {
      return NextResponse.json(
        { error: "file, applicationId, and requirementKey are required" },
        { status: 400 },
      );
    }

    const idInvalid = assertUuid(applicationId, "applicationId");
    if (idInvalid) return idInvalid;
    const slugInvalid = assertSlug(requirementKey, "requirementKey");
    if (slugInvalid) return slugInvalid;

    // Verify application belongs to user
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, applicantId: true },
    });

    if (!application || application.applicantId !== session.user.id) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    // Validate MIME allow-list before touching disk again.
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not accepted` },
        { status: 400 },
      );
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_SIZE_MB}MB limit` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength !== file.size) {
      return NextResponse.json(
        { error: "Uploaded file size did not match its content." },
        { status: 400 },
      );
    }
    if (!fileSignatureMatchesMime(buffer.subarray(0, 16), file.type)) {
      return NextResponse.json(
        { error: "The file content does not match the declared type." },
        { status: 400 },
      );
    }

    const originalFilename = sanitizeOriginalFilename(file.name);

    const document = await prisma.document.create({
      data: {
        applicationId,
        requirementKey,
        originalFilename,
        storagePath: "db",
        mimeType: file.type,
        fileSizeBytes: file.size,
        fileData: buffer,
        status: "UPLOADED",
        uploadedByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      applicationId,
      action: "document.upload",
      entityType: "Document",
      entityId: document.id,
      newValues: {
        mimeType: file.type,
        sizeBytes: file.size,
        requirementKey,
      },
      ipAddress: requestClientAddress(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
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
    console.error(
      "Upload error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
