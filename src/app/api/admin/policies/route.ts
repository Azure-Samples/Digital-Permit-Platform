import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import {
  extractPolicyDocument,
  MAX_POLICY_FILE_SIZE_MB,
  POLICY_UPLOAD_MIME_TYPES,
  PolicyTextUnavailableError,
  sanitizePolicyFilename,
} from "@/lib/policy/document";
import {
  buildPolicySummary,
  splitPolicyIntoSections,
} from "@/lib/policy/import";
import { importPolicyVersion } from "@/lib/policy/service";
import {
  DEFAULT_POLICY_REGIME,
  POLICY_REGIMES,
} from "@/lib/policy/regimes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const policyMetadataSchema = z
  .object({
    regime: z.preprocess(
      (value) => value || DEFAULT_POLICY_REGIME,
      z.enum(POLICY_REGIMES),
    ),
    councilName: z.string().trim().min(2).max(120),
    title: z.string().trim().min(5).max(200),
    versionLabel: z.string().trim().min(1).max(80),
    effectiveFrom: z.string().date(),
    effectiveTo: z.union([z.string().date(), z.literal("")]),
    summary: z.string().trim().max(2_000),
  })
  .refine(
    ({ effectiveFrom, effectiveTo }) =>
      !effectiveTo || effectiveTo >= effectiveFrom,
    { message: "Effective-to date must be on or after effective-from date." },
  );

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!new Set(["MANAGER", "ADMIN"]).has(session.user.role)) {
    return NextResponse.json(
      { error: "Only managers and administrators can import policy versions." },
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
      return NextResponse.json({ error: "Choose a policy document." }, { status: 400 });
    }
    if (!POLICY_UPLOAD_MIME_TYPES.includes(file.type as never)) {
      return NextResponse.json(
        { error: "Upload a PDF, DOCX, Markdown, or plain-text policy document." },
        { status: 400 },
      );
    }
    if (file.size === 0 || file.size > MAX_POLICY_FILE_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Policy documents must be between 1 byte and ${MAX_POLICY_FILE_SIZE_MB}MB.` },
        { status: 400 },
      );
    }

    const parsed = policyMetadataSchema.safeParse({
      regime: form.get("regime"),
      councilName: form.get("councilName"),
      title: form.get("title"),
      versionLabel: form.get("versionLabel"),
      effectiveFrom: form.get("effectiveFrom"),
      effectiveTo: form.get("effectiveTo") ?? "",
      summary: form.get("summary") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Policy metadata is invalid." },
        { status: 400 },
      );
    }

    const sourceFilename = sanitizePolicyFilename(file.name);
    const sourceFileData = Buffer.from(await file.arrayBuffer());
    let extractedText = "";
    let searchIndexTruncated = false;
    let extractionWarning: string | null = null;
    try {
      const extraction = await extractPolicyDocument(
        sourceFileData,
        sourceFilename,
        file.type,
      );
      extractedText = extraction.text;
      searchIndexTruncated = extraction.searchIndexTruncated;
    } catch (error) {
      if (!(error instanceof PolicyTextUnavailableError)) throw error;
      extractionWarning = error.message;
    }
    const sections = extractedText ? splitPolicyIntoSections(extractedText) : [];

    const policy = await importPolicyVersion({
      ...parsed.data,
      effectiveFrom: new Date(`${parsed.data.effectiveFrom}T00:00:00.000Z`),
      effectiveTo: parsed.data.effectiveTo
        ? new Date(`${parsed.data.effectiveTo}T23:59:59.999Z`)
        : undefined,
      summary:
        parsed.data.summary ||
        (extractedText
          ? buildPolicySummary(extractedText)
          : "The original statement document is retained. No searchable text was extracted for Policy Copilot."),
      sourceFilename,
      sourceMimeType: file.type,
      sourceFileData: Uint8Array.from(sourceFileData),
      sourceHash: createHash("sha256").update(sourceFileData).digest("hex"),
      searchIndexTruncated,
      searchableCharacters: extractedText.length,
      uploadedById: session.user.id,
      sections,
    });
    return NextResponse.json(
      { ...policy, extractionWarning, searchIndexTruncated },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This exact policy file has already been imported for this policy area." },
        { status: 409 },
      );
    }
    console.error("Policy import failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Policy import failed." },
      { status: 422 },
    );
  }
}