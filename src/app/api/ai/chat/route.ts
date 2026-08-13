import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAiConfigured } from "@/lib/ai/openai";
import { getActivePolicyContext } from "@/lib/ai/policy-context";
import {
  chatOfficer,
  chatApplicant,
  languageName,
  type ChatTurn,
} from "@/lib/ai/policy-assistant";
import { licenceContextFromSummary } from "@/lib/ai/analysis-service";
import type { LicenceSummary } from "@/lib/ai/types";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { assertUuid } from "@/lib/http/validation";
import {
  checkRateLimit,
  requestClientAddress,
} from "@/lib/http/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_ROLES = new Set(["REVIEWER", "MANAGER", "ADMIN"]);
const MAX_HISTORY = 16;
const MAX_MESSAGE_CHARS = 2000;
const LANGUAGE_PATTERN = /^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$/;
const APPLICANT_LIMIT = { windowMs: 60_000, max: 10 };
const OFFICER_LIMIT = { windowMs: 60_000, max: 30 };

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured on this environment." },
      { status: 503 }
    );
  }

  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  const session = await getServerSession(authOptions);

  let body: {
    conversationId?: string;
    message?: string;
    persona?: "officer" | "applicant";
    language?: string;
    analysisId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const persona = body.persona === "officer" ? "officer" : "applicant";
  const message = (typeof body.message === "string" ? body.message : "").trim();
  const language =
    typeof body.language === "string" && LANGUAGE_PATTERN.test(body.language)
      ? body.language
      : "en";

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      {
        error: `Message is too long (${MAX_MESSAGE_CHARS} character limit).`,
      },
      { status: 400 }
    );
  }

  if (body.conversationId !== undefined) {
    const invalid = assertUuid(body.conversationId, "conversationId");
    if (invalid) return invalid;
  }
  if (body.analysisId !== undefined) {
    const invalid = assertUuid(body.analysisId, "analysisId");
    if (invalid) return invalid;
  }

  // Officer copilot is staff-only; the applicant assistant is open to the public.
  if (persona === "officer") {
    if (!session?.user || !STAFF_ROLES.has(session.user.role)) {
      return NextResponse.json(
        { error: "The officer copilot is available to licensing staff only." },
        { status: 403 }
      );
    }
  }

  // Rate-limit: the applicant chat is anonymous, so key by client address;
  // the officer copilot is authenticated, so key by user id.
  const clientAddress = requestClientAddress(req);
  const rateKey =
    persona === "officer"
      ? `chat:officer:${session?.user?.id ?? clientAddress}`
      : `chat:applicant:${clientAddress}`;
  const rateLimit = checkRateLimit(
    rateKey,
    persona === "officer" ? OFFICER_LIMIT : APPLICANT_LIMIT,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "X-RateLimit-Reset": String(rateLimit.resetEpochSeconds),
        },
      },
    );
  }

  const policyCtx = await getActivePolicyContext();
  if (!policyCtx) {
    return NextResponse.json(
      { error: "No licensing policy is configured yet." },
      { status: 503 }
    );
  }

  // ── Load or create the conversation ────────────────────────
  let conversation = body.conversationId
    ? await prisma.assistantConversation.findUnique({
        where: { id: body.conversationId },
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: 50 },
        },
      })
    : null;

  if (!conversation) {
    const created = await prisma.assistantConversation.create({
      data: {
        persona,
        language,
        userId: session?.user?.id ?? null,
        analysisId: persona === "officer" ? body.analysisId ?? null : null,
        title: message.slice(0, 80),
      },
    });
    conversation = { ...created, messages: [] };
  }

  // Build history for the model from persisted turns.
  const history: ChatTurn[] = conversation.messages
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  history.push({ role: "user", content: message });

  // Persist the user's message.
  await prisma.assistantMessage.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  // ── Officer: attach the licence under review, if any ───────
  let licenceContext: string | undefined;
  const analysisId = conversation.analysisId ?? body.analysisId;
  if (persona === "officer" && analysisId) {
    const analysis = await prisma.licenceAnalysis.findUnique({
      where: { id: analysisId },
      select: { summary: true },
    });
    if (analysis?.summary) {
      try {
        licenceContext = licenceContextFromSummary(
          analysis.summary as unknown as LicenceSummary
        );
      } catch {
        /* ignore malformed summary */
      }
    }
  }

  // ── Call the model ─────────────────────────────────────────
  try {
    const result =
      persona === "officer"
        ? await chatOfficer(policyCtx, history, licenceContext)
        : await chatApplicant(policyCtx, history, language);

    await prisma.assistantMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: result.answer,
        citations: result.citations as unknown as object,
        tokensUsed: result.tokensUsed,
      },
    });
    await prisma.assistantConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      answer: result.answer,
      citations: result.citations,
      language,
      languageName: languageName(language),
    });
  } catch (err) {
    console.error(
      "AI chat error:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json(
      { error: "The assistant could not respond." },
      { status: 502 }
    );
  }
}
