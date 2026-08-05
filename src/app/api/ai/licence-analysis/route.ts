import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { isAiConfigured } from "@/lib/ai/openai";
import { runLicenceAnalysis } from "@/lib/ai/analysis-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_ROLES = new Set(["REVIEWER", "MANAGER", "ADMIN"]);
const ALLOWED_TYPES = new Set(["application/pdf", "text/plain", "text/markdown"]);
const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10);

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
      const form = await req.formData();
      const file = form.get("file") as File | null;
      applicationId = (form.get("applicationId") as string) || null;

      if (!file) {
        return NextResponse.json({ error: "No file provided." }, { status: 400 });
      }
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `File type ${file.type || "unknown"} is not accepted. Upload a PDF or text file, or paste the text.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        return NextResponse.json(
          { error: `File exceeds the ${MAX_SIZE_MB}MB limit.` },
          { status: 400 }
        );
      }
      fileData = new Uint8Array(await file.arrayBuffer());
      mimeType = file.type;
      filename = file.name;
      title = file.name;
    } else {
      const body = await req.json();
      pastedText = (body.text as string)?.trim() || null;
      applicationId = (body.applicationId as string) || null;
      if (body.title) title = String(body.title).slice(0, 200);
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
