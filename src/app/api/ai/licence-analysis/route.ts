import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { isAiConfigured } from "@/lib/ai/openai";
import { runLicenceAnalysis } from "@/lib/ai/analysis-service";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import {
  assertContentLength,
  assertUuid,
  fileSignatureMatchesMime,
} from "@/lib/http/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_ROLES = new Set(["REVIEWER", "MANAGER", "ADMIN"]);
const ALLOWED_TYPES = new Set(["application/pdf", "text/plain", "text/markdown"]);
const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10);
const MAX_UPLOAD_BYTES = MAX_SIZE_MB * 1024 * 1024;
const MAX_FORMDATA_BYTES = MAX_UPLOAD_BYTES + 128 * 1024;
const MAX_PASTED_TEXT = 200_000;

// POST — start a new licence analysis. Accepts either a multipart file
// upload ("file") or a JSON body with pasted text ({ text, title }).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!STAFF_ROLES.has(session.user.role)) {
    return NextResponse.json(
      { error: "Only licensing officers and police can analyse licences." },
      { status: 403 }
    );
  }
  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured on this environment." },
      { status: 503 }
    );
  }

  const contentType = req.headers.get("content-type") || "";

  let title = "Pasted licence text";
  let mimeType: string | null = null;
  let filename: string | null = null;
  let fileData: Uint8Array<ArrayBuffer> | null = null;
  let pastedText: string | null = null;
  let applicationId: string | null = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      const oversized = assertContentLength(req, MAX_FORMDATA_BYTES);
      if (oversized) return oversized;

      const form = await req.formData();
      const file = form.get("file");
      const rawApplicationId = form.get("applicationId");
      applicationId = typeof rawApplicationId === "string" ? rawApplicationId : null;

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided." }, { status: 400 });
      }
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `File type ${file.type || "unknown"} is not accepted. Upload a PDF or text file, or paste the text.` },
          { status: 400 }
        );
      }
      if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `File exceeds the ${MAX_SIZE_MB}MB limit.` },
          { status: 413 }
        );
      }
      const buffer = new Uint8Array(await file.arrayBuffer());
      if (buffer.byteLength !== file.size) {
        return NextResponse.json(
          { error: "Uploaded file size did not match its content." },
          { status: 400 },
        );
      }
      if (
        file.type === "application/pdf" &&
        !fileSignatureMatchesMime(buffer.subarray(0, 16), file.type)
      ) {
        return NextResponse.json(
          { error: "The file content does not match the declared type." },
          { status: 400 },
        );
      }
      fileData = buffer;
      mimeType = file.type;
      filename = file.name.replace(/[\r\n\t\0]/g, "").slice(-240);
      title = filename || "Uploaded licence document";
    } else {
      const body = await req.json();
      const rawText = typeof body?.text === "string" ? body.text : "";
      pastedText = rawText.trim().slice(0, MAX_PASTED_TEXT) || null;
      const rawApplicationId = body?.applicationId;
      applicationId = typeof rawApplicationId === "string" ? rawApplicationId : null;
      if (typeof body?.title === "string") title = body.title.slice(0, 200);
      if (!pastedText || pastedText.length < 40) {
        return NextResponse.json(
          { error: "Please paste at least a few lines of the licence text." },
          { status: 400 }
        );
      }
      mimeType = "text/plain";
    }
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (applicationId !== null) {
    const invalid = assertUuid(applicationId, "applicationId");
    if (invalid) return invalid;
  }

  const analysis = await prisma.licenceAnalysis.create({
    data: {
      title,
      sourceType: fileData ? "upload" : "paste",
      originalFilename: filename,
      mimeType,
      fileData: fileData ?? undefined,
      extractedText: pastedText ?? undefined,
      status: "PROCESSING",
      uploadedById: session.user.id,
      applicationId: applicationId ?? undefined,
    },
    select: { id: true, status: true, title: true },
  });

  await writeAuditLog({
    userId: session.user.id,
    applicationId: applicationId ?? undefined,
    action: "ai.licence_analysis.start",
    entityType: "LicenceAnalysis",
    entityId: analysis.id,
    newValues: { title, source: fileData ? "upload" : "paste" },
  });

  // Fire-and-forget: the long-lived Node server keeps processing after we respond.
  void runLicenceAnalysis(analysis.id);

  return NextResponse.json({ id: analysis.id, status: analysis.status });
}
