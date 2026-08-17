// ─────────────────────────────────────────────────────────────
// Policy AI — core assistant logic
// ─────────────────────────────────────────────────────────────
import { getOpenAI, AI_MODEL } from "./openai";
import {
  licenceSummaryPrompt,
  compliancePrompt,
  officerChatPrompt,
  applicantChatPrompt,
} from "./prompts";
import {
  buildCombinedPolicyGroundingText,
  buildPolicyGroundingText,
  resolveCitations,
  type PolicyContext,
} from "./policy-context";
import type {
  LicenceSummary,
  ComplianceAssessment,
  Citation,
} from "./types";
import { languageName } from "./languages";

export { SUPPORTED_LANGUAGES, languageName } from "./languages";

const MAX_DOC_CHARS = 40_000; // guard against runaway token usage

// ── Text extraction ──────────────────────────────────────────

/** Extract plain text from an uploaded licence document. */
export async function extractLicenceText(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; note?: string }> {
  if (mimeType === "application/pdf") {
    try {
      // Import the library entry point directly to avoid pdf-parse's
      // debug harness which reads a test file at module load.
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js"))
        .default as (b: Buffer) => Promise<{ text: string }>;
      const parsed = await pdfParse(buffer);
      const text = (parsed.text || "").trim();
      if (text.length < 40) {
        return {
          text,
          note: "Very little text was extracted — this may be a scanned/image-only PDF that needs OCR.",
        };
      }
      return { text };
    } catch (err) {
      return {
        text: "",
        note: `Could not read PDF: ${(err as Error).message}`,
      };
    }
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === ""
  ) {
    return { text: buffer.toString("utf-8").trim() };
  }

  return {
    text: "",
    note: `Unsupported file type "${mimeType}". Upload a PDF or paste the licence text.`,
  };
}

// ── JSON helpers ─────────────────────────────────────────────

function parseJson<T>(raw: string | null): T {
  if (!raw) throw new Error("Empty AI response");
  // Strip accidental markdown fences.
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

// ── Licence analysis ─────────────────────────────────────────

export interface AnalyseResult {
  summary: LicenceSummary;
  tokensUsed: number;
}

/** Produce an at-a-glance structured summary of a licence document. */
export async function analyseLicence(text: string): Promise<AnalyseResult> {
  const openai = getOpenAI();
  const clipped = text.slice(0, MAX_DOC_CHARS);

  const res = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.1,
    max_tokens: 3200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: licenceSummaryPrompt() },
      {
        role: "user",
        content: `Summarise the following licence document:\n\n${clipped}`,
      },
    ],
  });

  const summary = parseJson<LicenceSummary>(res.choices[0]?.message?.content ?? null);
  // Defensive defaults so the UI never crashes on a partial model response.
  summary.licensableActivities ??= [];
  summary.mandatoryConditions ??= [];
  summary.operatingScheduleConditions ??= [];
  summary.responsibleAuthorityConditions ??= [];
  summary.objectiveRisks ??= [];
  summary.officerActions ??= [];

  return { summary, tokensUsed: res.usage?.total_tokens ?? 0 };
}

// ── Compliance assessment ────────────────────────────────────

export interface ComplianceResult {
  compliance: ComplianceAssessment;
  tokensUsed: number;
}

/** Assess a licence summary (or raw text) against the council policy. */
export async function assessCompliance(
  policyCtx: PolicyContext,
  subject: LicenceSummary | string
): Promise<ComplianceResult> {
  const openai = getOpenAI();
  const subjectText =
    typeof subject === "string"
      ? subject.slice(0, MAX_DOC_CHARS)
      : JSON.stringify(subject, null, 2);
  const groundingText = buildPolicyGroundingText(policyCtx, subjectText);

  const res = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.1,
    max_tokens: 1600,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: compliancePrompt(groundingText, policyCtx.regime),
      },
      {
        role: "user",
        content: `Assess this against the policy:\n\n${subjectText}`,
      },
    ],
  });

  const compliance = parseJson<ComplianceAssessment>(
    res.choices[0]?.message?.content ?? null
  );
  compliance.checks ??= [];
  compliance.recommendations ??= [];

  return { compliance, tokensUsed: res.usage?.total_tokens ?? 0 };
}

/** Assess a submitted application's answers against the council policy. */
export async function assessApplication(
  policyCtx: PolicyContext,
  application: {
    referenceNumber: string;
    moduleName: string;
    answers: Record<string, unknown>;
  }
): Promise<ComplianceResult> {
  const subject = [
    `Application reference: ${application.referenceNumber}`,
    `Licence type: ${application.moduleName}`,
    `Submitted answers:`,
    JSON.stringify(application.answers, null, 2),
  ].join("\n");
  return assessCompliance(policyCtx, subject);
}

// ── Chat ─────────────────────────────────────────────────────

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  answer: string;
  citations: Citation[];
  tokensUsed: number;
}

function extractCitations(
  policyContexts: PolicyContext[],
  answer: string
): Citation[] {
  const refs = new Set<string>();
  const namespaced =
    /(?:^|[^a-z_0-9])(licensing_act_2003|taxi_private_hire):(\d{1,3}(?:\.\d{1,3}){0,3})\b/gi;
  let match = namespaced.exec(answer);
  while (match !== null) {
    refs.add(`${match[1]}:${match[2]}`);
    match = namespaced.exec(answer);
  }
  if (policyContexts.length === 1) {
    const plain = /\b(\d{1,3}(?:\.\d{1,3}){1,3})\b/g;
    let plainMatch = plain.exec(answer);
    while (plainMatch !== null) {
      refs.add(`${policyContexts[0].regime}:${plainMatch[1]}`);
      plainMatch = plain.exec(answer);
    }
  }
  return resolveCitations(policyContexts, Array.from(refs));
}

/** Officer / police copilot chat, grounded in policy (+ optional licence). */
export async function chatOfficer(
  policyContexts: PolicyContext[],
  history: ChatTurn[],
  licenceContext?: string
): Promise<ChatResult> {
  const openai = getOpenAI();
  const groundingText = buildCombinedPolicyGroundingText(
    policyContexts,
    [...history.slice(-6).map((turn) => turn.content), licenceContext ?? ""].join("\n"),
  );
  const res = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.2,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content: officerChatPrompt(groundingText, licenceContext),
      },
      ...history,
    ],
  });
  const answer = res.choices[0]?.message?.content ?? "";
  return {
    answer,
    citations: extractCitations(policyContexts, answer),
    tokensUsed: res.usage?.total_tokens ?? 0,
  };
}

/** Multilingual applicant assistant chat, grounded in policy. */
export async function chatApplicant(
  policyContexts: PolicyContext[],
  history: ChatTurn[],
  langCode: string
): Promise<ChatResult> {
  const openai = getOpenAI();
  const groundingText = buildCombinedPolicyGroundingText(
    policyContexts,
    history.slice(-6).map((turn) => turn.content).join("\n"),
  );
  const res = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.3,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content: applicantChatPrompt(
          groundingText,
          languageName(langCode)
        ),
      },
      ...history,
    ],
  });
  const answer = res.choices[0]?.message?.content ?? "";
  return {
    answer,
    // Citations are matched on refs, which are language-agnostic.
    citations: extractCitations(policyContexts, answer),
    tokensUsed: res.usage?.total_tokens ?? 0,
  };
}
