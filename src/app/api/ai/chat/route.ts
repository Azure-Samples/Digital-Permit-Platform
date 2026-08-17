import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { isAiConfigured } from "@/lib/ai/openai";
import {
  detectPolicyRegimes,
  getActivePolicyContexts,
  selectPolicyContexts,
} from "@/lib/ai/policy-context";
import {
  isPolicyRegime,
  POLICY_REGIME_CONFIG,
  POLICY_REGIMES,
  type PolicyRegime,
} from "@/lib/policy/regimes";
import {
  canAccessConversation,
  createConversationAccessKey,
  hashConversationAccessKey,
} from "@/lib/ai/conversation-access";
import {
  chatOfficer,
  chatApplicant,
  languageName,
  type ChatTurn,
} from "@/lib/ai/policy-assistant";
import { licenceContextFromSummary } from "@/lib/ai/analysis-service";
import type { LicenceSummary } from "@/lib/ai/types";
import { checkRateLimit } from "@/lib/http/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_ROLES = new Set(["REVIEWER", "MANAGER", "ADMIN"]);
const MAX_HISTORY = 16; // cap turns sent to the model

export async function POST(req: NextRequest) {
  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured on this environment." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);

  let body: {
    conversationId?: string;
    conversationAccessKey?: string;
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
  const message = (body.message ?? "").trim();
  const language = body.language || "en";

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json(
      { error: "Message is too long (2000 character limit)." },
      { status: 400 }
    );
  }

  // Officer copilot is staff-only; the applicant assistant is open to the public.
  if (persona === "officer") {
    if (!session?.user || !STAFF_ROLES.has(session.user.role)) {
      return NextResponse.json(
        { error: "The officer copilot is available to licensing staff only." },
        { status: 403 }
      );
    }
  } else if (!session?.user) {
    const clientAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const rateLimit = checkRateLimit(`applicant-chat:${clientAddress}`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many assistant requests. Wait a moment and try again." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }
  }

  let conversation = body.conversationId
    ? await prisma.assistantConversation.findUnique({
        where: { id: body.conversationId },
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: 50 },
        },
      })
    : null;
  if (body.conversationId && !conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  if (
    conversation &&
    !canAccessConversation({
      conversationUserId: conversation.userId,
      conversationPersona: conversation.persona,
      requestedPersona: persona,
      sessionUserId: session?.user?.id ?? null,
      accessKeyHash: conversation.accessKeyHash,
      suppliedAccessKey: body.conversationAccessKey ?? null,
    })
  ) {
    return NextResponse.json({ error: "Forbidden conversation." }, { status: 403 });
  }
  if (
    conversation?.analysisId &&
    body.analysisId &&
    conversation.analysisId !== body.analysisId
  ) {
    return NextResponse.json(
      { error: "This conversation is attached to a different analysis." },
      { status: 409 },
    );
  }

  const history: ChatTurn[] = (conversation?.messages ?? [])
    .slice(-MAX_HISTORY)
    .map((storedMessage) => ({
      role: storedMessage.role as "user" | "assistant",
      content: storedMessage.content,
    }));

  let licenceContext: string | undefined;
  const analysisId = conversation?.analysisId ?? body.analysisId;
  if (persona === "officer" && analysisId) {
    const analysis = await prisma.licenceAnalysis.findUnique({
      where: { id: analysisId },
      select: { summary: true },
    });
    if (analysis?.summary) {
      try {
        licenceContext = licenceContextFromSummary(
          analysis.summary as unknown as LicenceSummary,
        );
      } catch {
        /* ignore malformed summary */
      }
    }
  }

  const activePolicyContexts = await getActivePolicyContexts();
  if (activePolicyContexts.length === 0) {
    return NextResponse.json(
      { error: "No licensing policy is configured yet." },
      { status: 503 }
    );
  }
  const rememberedRegimes = (conversation?.policyRegimes ?? []).filter(
    isPolicyRegime,
  );
  const licenceRegimes = licenceContext
    ? detectPolicyRegimes(licenceContext, [])
    : [];
  const fallbackRegimes: PolicyRegime[] =
    rememberedRegimes.length > 0
      ? rememberedRegimes
      : licenceRegimes.length > 0
        ? licenceRegimes
        : [...POLICY_REGIMES];
  const selection = selectPolicyContexts(
    activePolicyContexts,
    message,
    fallbackRegimes,
  );
  if (selection.contexts.length === 0) {
    const missingPolicy = selection.missingRegimes[0];
    return NextResponse.json(
      {
        error: missingPolicy
          ? `No active ${POLICY_REGIME_CONFIG[missingPolicy].label.toLowerCase()} is configured for this question.`
          : "No relevant licensing policy is configured for this question.",
      },
      { status: 503 },
    );
  }
  const unsearchablePolicies = selection.contexts.filter(
    (context) => context.sections.length === 0,
  );
  if (unsearchablePolicies.length > 0) {
    return NextResponse.json(
      {
        error: `${unsearchablePolicies
          .map((context) => context.title)
          .join(", ")} is stored, but has no searchable text. View the original document or upload a text-based PDF or DOCX to use Policy Copilot.`,
      },
      { status: 503 },
    );
  }

  let conversationAccessKey: string | undefined;
  if (!conversation) {
    conversationAccessKey = session?.user
      ? undefined
      : createConversationAccessKey();
    const created = await prisma.assistantConversation.create({
      data: {
        persona,
        language,
        userId: session?.user?.id ?? null,
        analysisId: persona === "officer" ? body.analysisId ?? null : null,
        policyRegimes: selection.requestedRegimes,
        accessKeyHash: conversationAccessKey
          ? hashConversationAccessKey(conversationAccessKey)
          : null,
        title: message.slice(0, 80),
      },
    });
    conversation = { ...created, messages: [] };
  } else if (
    conversation.policyRegimes.join("|") !== selection.requestedRegimes.join("|")
  ) {
    await prisma.assistantConversation.update({
      where: { id: conversation.id },
      data: { policyRegimes: selection.requestedRegimes },
    });
  }

  history.push({ role: "user", content: message });

  // Persist the user's message.
  await prisma.assistantMessage.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  // ── Call the model ─────────────────────────────────────────
  try {
    const result =
      persona === "officer"
        ? await chatOfficer(selection.contexts, history, licenceContext)
        : await chatApplicant(selection.contexts, history, language);

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
      conversationAccessKey,
      answer: result.answer,
      citations: result.citations,
      policies: selection.contexts.map((context) => ({
        regime: context.regime,
        title: context.title,
      })),
      language,
      languageName: languageName(language),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `The assistant could not respond: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
