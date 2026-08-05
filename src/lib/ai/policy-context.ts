// ─────────────────────────────────────────────────────────────
// Policy grounding context
// ─────────────────────────────────────────────────────────────
// Builds the retrieval context that grounds the AI in *this*
// council's Statement of Licensing Policy. For a POC the full
// policy is small enough to stuff into the prompt (RAG-lite);
// a production build would swap this for vector retrieval.
// ─────────────────────────────────────────────────────────────
import { prisma } from "@/lib/db";
import type { Citation } from "./types";

export interface PolicyContext {
  policyId: string;
  councilName: string;
  title: string;
  versionLabel: string;
  summary: string;
  sourceFilename: string | null;
  /** Formatted policy text for the system prompt. */
  groundingText: string;
  /** All sections, for citation lookups. */
  sections: Array<{ ref: string; heading: string; category: string; content: string }>;
}

/** Fetch the active policy and format it for grounding. Cached per request. */
export async function getActivePolicyContext(): Promise<PolicyContext | null> {
  const policy = await prisma.licensingPolicy.findFirst({
    where: { isActive: true, regime: "licensing_act_2003" },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!policy) return null;

  const sections = policy.sections.map((s) => ({
    ref: s.ref,
    heading: s.heading,
    category: s.category,
    content: s.content,
  }));

  const groundingText = [
    `POLICY: ${policy.title} (${policy.councilName})`,
    `In force: ${policy.versionLabel}`,
    "",
    ...policy.sections.map(
      (s) => `[${s.ref}] ${s.heading}\n${s.content}`
    ),
  ].join("\n\n");

  return {
    policyId: policy.id,
    councilName: policy.councilName,
    title: policy.title,
    versionLabel: policy.versionLabel,
    summary: policy.summary,
    sourceFilename: policy.sourceFilename,
    groundingText,
    sections,
  };
}

/** Resolve section refs the model cited back to headings for display. */
export function resolveCitations(
  ctx: PolicyContext | null,
  refs: string[]
): Citation[] {
  if (!ctx) return [];
  const out: Citation[] = [];
  for (const ref of refs) {
    const match = ctx.sections.find((s) => s.ref === ref);
    if (match) out.push({ ref: match.ref, heading: match.heading });
  }
  return out;
}
