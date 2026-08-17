// ─────────────────────────────────────────────────────────────
// Policy grounding context
// ─────────────────────────────────────────────────────────────
// Builds a bounded retrieval context that grounds the AI in this
// council's Statement of Licensing Policy without placing the full
// source document into every model prompt.
// ─────────────────────────────────────────────────────────────
import { prisma } from "@/lib/db";
import {
  DEFAULT_POLICY_REGIME,
  POLICY_REGIME_CONFIG,
  POLICY_REGIMES,
  TAXI_POLICY_REGIME,
  type PolicyRegime,
} from "@/lib/policy/regimes";
import type { Citation } from "./types";

export interface PolicyContext {
  policyId: string;
  regime: PolicyRegime;
  councilName: string;
  title: string;
  versionLabel: string;
  summary: string;
  sourceFilename: string | null;
  sourceMimeType: string | null;
  /** All sections, for citation lookups. */
  sections: Array<{ ref: string; heading: string; category: string; content: string }>;
}

export const MAX_POLICY_GROUNDING_CHARACTERS = 48_000;
const MAX_SECTION_EXCERPT_CHARACTERS = 12_000;
const POLICY_SEARCH_CHUNK_CHARACTERS = 6_000;
const POLICY_SEARCH_CHUNK_OVERLAP = 800;
const STOP_WORDS = new Set([
  "about", "after", "again", "against", "application", "because", "before",
  "being", "between", "could", "council", "does", "from", "have", "into",
  "licence", "licensing", "policy", "should", "statement", "their", "there",
  "these", "they", "this", "those", "under", "what", "when", "where", "which",
  "with", "would", "your",
]);
const TAXI_QUERY_PATTERN =
  /\b(?:taxi|taxis|hackney|private hire|phv|minicab|taximeter|plying|taxi rank|driver badge|operator licence|vehicle plate|nr3s|fit and proper|wheelchair accessible vehicle)\b/i;
const LICENSING_ACT_QUERY_PATTERN =
  /\b(?:alcohol|premises|club premises|temporary event|\bten\b|dps|designated premises|licensable activit|late night refreshment|regulated entertainment|cumulative impact|challenge 25|personal licence)\b/i;

function queryTerms(query: string) {
  return Array.from(
    new Set(
      (query.toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? []).filter(
        (term) => !STOP_WORDS.has(term),
      ),
    ),
  ).slice(0, 80);
}

function sectionScore(
  section: PolicyContext["sections"][number],
  index: number,
  terms: string[],
  searchableContent = section.content,
) {
  const heading = section.heading.toLowerCase();
  const content = searchableContent.toLowerCase();
  const categoryWeight: Record<string, number> = {
    cumulative_impact: 12,
    objectives: 10,
    conditions: 8,
    children: 7,
    hours: 7,
    enforcement: 5,
    applicant_guidance: 4,
    entertainment: 4,
    general: 1,
  };
  let score = (categoryWeight[section.category] ?? 1) + (index === 0 ? 6 : 0);
  for (const term of terms) {
    if (heading.includes(term)) score += 16;
    if (content.includes(term)) score += 3;
  }
  return score;
}

function sectionChunks(
  section: PolicyContext["sections"][number],
  sectionIndex: number,
) {
  if (section.content.length <= POLICY_SEARCH_CHUNK_CHARACTERS) {
    return [{ section, sectionIndex, chunkIndex: 0, content: section.content }];
  }
  const chunks = [];
  const step = POLICY_SEARCH_CHUNK_CHARACTERS - POLICY_SEARCH_CHUNK_OVERLAP;
  for (let start = 0, chunkIndex = 0; start < section.content.length; start += step, chunkIndex += 1) {
    chunks.push({
      section,
      sectionIndex,
      chunkIndex,
      content: section.content.slice(start, start + POLICY_SEARCH_CHUNK_CHARACTERS),
    });
  }
  return chunks;
}

function excerptSection(content: string, terms: string[], maximum: number) {
  if (content.length <= maximum) return content;
  const lower = content.toLowerCase();
  const matchIndexes = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0);
  const focus = matchIndexes.length > 0 ? Math.min(...matchIndexes) : 0;
  const start = Math.max(0, Math.min(focus - Math.floor(maximum / 3), content.length - maximum));
  const excerpt = content.slice(start, start + maximum).trim();
  return `${start > 0 ? "[Earlier text omitted] " : ""}${excerpt}${
    start + maximum < content.length ? " [Later text omitted]" : ""
  }`;
}

export function buildPolicyGroundingText(
  policy: PolicyContext,
  query: string,
  maximumCharacters = MAX_POLICY_GROUNDING_CHARACTERS,
) {
  const prefix = [
    `POLICY: ${policy.title} (${policy.councilName})`,
    `POLICY REGIME: ${POLICY_REGIME_CONFIG[policy.regime].label}`,
    `POLICY KEY: ${policy.regime}`,
    `In force: ${policy.versionLabel}`,
    "The following are relevant excerpts selected from the complete retained source document.",
    `Summary: ${policy.summary.slice(0, 2_000)}`,
  ].join("\n");
  if (policy.sections.length === 0) {
    return `${prefix}\n\nNo searchable text was extracted. Consult the retained source document.`.slice(
      0,
      maximumCharacters,
    );
  }

  const terms = queryTerms(query);
  const ranked = policy.sections
    .flatMap((section, index) => sectionChunks(section, index))
    .map((chunk) => ({
      ...chunk,
      score: sectionScore(chunk.section, chunk.sectionIndex, terms, chunk.content),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.sectionIndex - right.sectionIndex ||
        left.chunkIndex - right.chunkIndex,
    );
  const parts = [prefix];
  let usedCharacters = prefix.length;

  for (const { section, chunkIndex, content: chunkContent } of ranked) {
    const heading = `[${policy.regime}:${section.ref}] ${section.heading}${
      section.content.length > POLICY_SEARCH_CHUNK_CHARACTERS
        ? ` (excerpt ${chunkIndex + 1})`
        : ""
    }`;
    const remaining = maximumCharacters - usedCharacters - heading.length - 4;
    if (remaining < 200) break;
    const content = excerptSection(
      chunkContent,
      terms,
      Math.min(MAX_SECTION_EXCERPT_CHARACTERS, remaining),
    );
    const formatted = `${heading}\n${content}`;
    parts.push(formatted);
    usedCharacters += formatted.length + 2;
  }

  return parts.join("\n\n").slice(0, maximumCharacters);
}

export function detectPolicyRegimes(
  query: string,
  fallbackRegimes: PolicyRegime[] = [...POLICY_REGIMES],
): PolicyRegime[] {
  const taxi = TAXI_QUERY_PATTERN.test(query);
  const licensingAct = LICENSING_ACT_QUERY_PATTERN.test(query);
  if (taxi && !licensingAct) return [TAXI_POLICY_REGIME];
  if (licensingAct && !taxi) return [DEFAULT_POLICY_REGIME];
  return [...fallbackRegimes];
}

export function selectPolicyContexts(
  contexts: PolicyContext[],
  query: string,
  fallbackRegimes?: PolicyRegime[],
) {
  const requestedRegimes = detectPolicyRegimes(query, fallbackRegimes);
  const selectedContexts = requestedRegimes.flatMap((regime) => {
    const context = contexts.find((candidate) => candidate.regime === regime);
    return context ? [context] : [];
  });
  return {
    contexts: selectedContexts,
    requestedRegimes,
    missingRegimes: requestedRegimes.filter(
      (regime) => !contexts.some((context) => context.regime === regime),
    ),
  };
}

export function buildCombinedPolicyGroundingText(
  contexts: PolicyContext[],
  query: string,
  maximumCharacters = MAX_POLICY_GROUNDING_CHARACTERS,
) {
  if (contexts.length === 0) return "";
  const perPolicyMaximum = Math.floor(maximumCharacters / contexts.length);
  return contexts
    .map((context) => buildPolicyGroundingText(context, query, perPolicyMaximum))
    .join("\n\n--- NEXT POLICY SOURCE ---\n\n")
    .slice(0, maximumCharacters);
}

function toPolicyContext(policy: {
  id: string;
  regime: string;
  councilName: string;
  title: string;
  versionLabel: string;
  summary: string;
  sourceFilename: string | null;
  sourceMimeType: string | null;
  sections: Array<{
    ref: string;
    heading: string;
    category: string;
    content: string;
  }>;
}): PolicyContext | null {
  if (!POLICY_REGIMES.includes(policy.regime as PolicyRegime)) return null;
  return {
    policyId: policy.id,
    regime: policy.regime as PolicyRegime,
    councilName: policy.councilName,
    title: policy.title,
    versionLabel: policy.versionLabel,
    summary: policy.summary,
    sourceFilename: policy.sourceFilename,
    sourceMimeType: policy.sourceMimeType,
    sections: policy.sections,
  };
}

export async function getActivePolicyContext(
  regime: PolicyRegime = DEFAULT_POLICY_REGIME,
): Promise<PolicyContext | null> {
  const policy = await prisma.licensingPolicy.findFirst({
    where: { isActive: true, regime },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!policy) return null;
  return toPolicyContext(policy);
}

export async function getActivePolicyContexts(): Promise<PolicyContext[]> {
  const policies = await prisma.licensingPolicy.findMany({
    where: { isActive: true, regime: { in: [...POLICY_REGIMES] } },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
    orderBy: { effectiveFrom: "desc" },
  });
  return policies.flatMap((policy) => {
    const context = toPolicyContext(policy);
    return context ? [context] : [];
  });
}

/** Resolve section refs the model cited back to headings for display. */
export function resolveCitations(
  policyContexts: PolicyContext | PolicyContext[] | null,
  refs: string[]
): Citation[] {
  const contexts = Array.isArray(policyContexts)
    ? policyContexts
    : policyContexts
      ? [policyContexts]
      : [];
  const out: Citation[] = [];
  for (const rawRef of refs) {
    const separator = rawRef.indexOf(":");
    const namedRegime = separator > 0 ? rawRef.slice(0, separator) : null;
    const ref = separator > 0 ? rawRef.slice(separator + 1) : rawRef;
    const context = contexts.find(
      (candidate) =>
        (!namedRegime || candidate.regime === namedRegime) &&
        candidate.sections.some((section) => section.ref === ref),
    );
    const match = context?.sections.find((section) => section.ref === ref);
    if (context && match) {
      out.push({
        ref: match.ref,
        heading: match.heading,
        policyTitle: context.title,
        regime: context.regime,
      });
    }
  }
  return out;
}
