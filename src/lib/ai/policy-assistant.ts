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
import { resolveCitations, type PolicyContext } from "./policy-context";
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

function stripDangerousKeys(_key: string, value: unknown) {
  if (_key === "__proto__" || _key === "constructor" || _key === "prototype") {
    return undefined;
  }
  return value;
}

function parseJson<T>(raw: string | null): T {
  if (!raw) throw new Error("Empty AI response");
  // Strip accidental markdown fences.
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned, stripDangerousKeys) as T;
}

// Prompt-injection defence: neutralise the sequences models most often
// obey from within user content, and clip anything unusually large.
export function sanitiseUserContent(input: string, maxChars = 4000): string {
  return input
    .slice(0, maxChars)
    .replace(/\r/g, "")
    .replace(/<\/?(system|policy|licence|instructions?)>/gi, "")
    .replace(/\bignore (all )?(previous|prior) instructions?\b/gi, "[filtered]")
    .replace(/\bdisregard (all )?(previous|prior) instructions?\b/gi, "[filtered]");
}

// ── Licence analysis ─────────────────────────────────────────

export interface AnalyseResult {
  summary: LicenceSummary;
  tokensUsed: number;
}

/** Produce an at-a-glance structured summary of a licence document. */
export async function analyseLicence(text: string): Promise<AnalyseResult> {
  const openai = getOpenAI();
  const clipped = sanitiseUserContent(text.slice(0, MAX_DOC_CHARS), MAX_DOC_CHARS);

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
      ? sanitiseUserContent(subject.slice(0, MAX_DOC_CHARS), MAX_DOC_CHARS)
      : JSON.stringify(subject, null, 2);

  const res = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.1,
    max_tokens: 1600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: compliancePrompt(policyCtx.groundingText) },
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
  policyCtx: PolicyContext | null,
  answer: string
): Citation[] {
  if (!policyCtx) return [];
  // Match refs like (5.3), [5.3], "section 5.3", or "5.3" near start of a clause.
  const refs = new Set<string>();
  const re = /\b(\d{1,2}\.\d{1,2})\b/g;
  let match = re.exec(answer);
  while (match !== null) {
    refs.add(match[1]);
    match = re.exec(answer);
  }
  return resolveCitations(policyCtx, Array.from(refs));
}

function sanitiseHistory(history: ChatTurn[]): ChatTurn[] {
  return history.map((turn) =>
    turn.role === "user"
      ? { role: "user", content: sanitiseUserContent(turn.content) }
      : turn,
  );
}

/** Officer / police copilot chat, grounded in policy (+ optional licence). */
export async function chatOfficer(
  policyCtx: PolicyContext,
  history: ChatTurn[],
  licenceContext?: string
): Promise<ChatResult> {
  const openai = getOpenAI();
  const res = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.2,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content: officerChatPrompt(policyCtx.groundingText, licenceContext),
      },
      ...sanitiseHistory(history),
    ],
  });
  const answer = res.choices[0]?.message?.content ?? "";
  return {
    answer,
    citations: extractCitations(policyCtx, answer),
    tokensUsed: res.usage?.total_tokens ?? 0,
  };
}

/** Multilingual applicant assistant chat, grounded in policy. */
export async function chatApplicant(
  policyCtx: PolicyContext,
  history: ChatTurn[],
  langCode: string
): Promise<ChatResult> {
  const openai = getOpenAI();
  const res = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.3,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content: applicantChatPrompt(
          policyCtx.groundingText,
          languageName(langCode)
        ),
      },
      ...sanitiseHistory(history),
    ],
  });
  const answer = res.choices[0]?.message?.content ?? "";
  return {
    answer,
    // Citations are matched on refs, which are language-agnostic.
    citations: extractCitations(policyCtx, answer),
    tokensUsed: res.usage?.total_tokens ?? 0,
  };
}
