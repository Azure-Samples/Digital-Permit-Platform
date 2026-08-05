export interface ImportedPolicySection {
  ref: string;
  heading: string;
  content: string;
  category: string;
  keywords: string[];
  sortOrder: number;
}

const CATEGORY_RULES: Array<{
  category: string;
  terms: string[];
}> = [
  {
    category: "cumulative_impact",
    terms: ["cumulative impact", "saturation", "special policy"],
  },
  {
    category: "objectives",
    terms: ["licensing objective", "crime and disorder", "public safety"],
  },
  {
    category: "children",
    terms: ["protection of children", "children from harm", "under 18"],
  },
  {
    category: "hours",
    terms: ["opening hours", "licensing hours", "terminal hour"],
  },
  {
    category: "conditions",
    terms: ["conditions", "operating schedule", "mandatory condition"],
  },
  {
    category: "entertainment",
    terms: ["regulated entertainment", "live music", "late night refreshment"],
  },
  {
    category: "enforcement",
    terms: ["enforcement", "inspection", "review of a licence", "revocation"],
  },
  {
    category: "applicant_guidance",
    terms: ["advice for applicants", "making an application", "applicants"],
  },
];

const KEYWORD_TERMS = [
  "licensing objectives",
  "crime and disorder",
  "public safety",
  "public nuisance",
  "protection of children",
  "cumulative impact",
  "operating schedule",
  "mandatory conditions",
  "opening hours",
  "regulated entertainment",
  "late night refreshment",
  "temporary event notice",
  "representations",
  "enforcement",
  "review",
  "revocation",
];

export function normalizePolicyText(input: string): string {
  return input
    .replaceAll("\u0000", "")
    .replaceAll("\u00a0", " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isLikelyHeading(text: string): boolean {
  if (text.length < 3 || text.length > 150) return false;
  if (/[.!?;:]$/.test(text)) return false;
  return text.split(/\s+/).length <= 20;
}

function parseHeading(line: string): { ref: string; heading: string } | null {
  const numeric = line.match(/^(\d{1,3}(?:\.\d{1,3}){0,3})[.)]?\s+(.+)$/);
  if (numeric && isLikelyHeading(numeric[2])) {
    return { ref: numeric[1], heading: numeric[2] };
  }

  const section = line.match(/^section\s+(\d{1,3})\s*[-:.)]?\s*(.+)$/i);
  if (section && isLikelyHeading(section[2])) {
    return { ref: section[1], heading: section[2] };
  }
  return null;
}

export function inferPolicyCategory(heading: string, content: string): string {
  const searchable = `${heading}\n${content}`.toLowerCase();
  return (
    CATEGORY_RULES.find(({ terms }) =>
      terms.some((term) => searchable.includes(term)),
    )?.category ?? "general"
  );
}

export function extractPolicyKeywords(
  heading: string,
  content: string,
): string[] {
  const searchable = `${heading}\n${content}`.toLowerCase();
  return KEYWORD_TERMS.filter((term) => searchable.includes(term)).slice(0, 12);
}

function fallbackSections(text: string, maxCharacters = 6_000) {
  const paragraphs = text
    .split(/\n\n+/)
    .filter(Boolean)
    .flatMap((paragraph) => {
      if (paragraph.length <= maxCharacters) return [paragraph];
      const chunks: string[] = [];
      let remaining = paragraph;
      while (remaining.length > maxCharacters) {
        const window = remaining.slice(0, maxCharacters + 1);
        const boundary = Math.max(window.lastIndexOf(" "), window.lastIndexOf("\n"));
        const splitAt = boundary >= maxCharacters * 0.6 ? boundary : maxCharacters;
        chunks.push(remaining.slice(0, splitAt).trim());
        remaining = remaining.slice(splitAt).trim();
      }
      if (remaining) chunks.push(remaining);
      return chunks;
    });
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxCharacters) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function splitPolicyIntoSections(input: string): ImportedPolicySection[] {
  const text = normalizePolicyText(input);
  if (!text) return [];

  const lines = text.split("\n");
  const headings = lines
    .map((line, index) => ({ index, parsed: parseHeading(line) }))
    .filter(
      (entry): entry is { index: number; parsed: { ref: string; heading: string } } =>
        Boolean(entry.parsed),
    );

  if (headings.length < 2) {
    return fallbackSections(text).map((content, sortOrder) => {
      const heading = sortOrder === 0 ? "Policy overview" : `Policy part ${sortOrder + 1}`;
      return {
        ref: String(sortOrder + 1),
        heading,
        content,
        category: inferPolicyCategory(heading, content),
        keywords: extractPolicyKeywords(heading, content),
        sortOrder,
      };
    });
  }

  const sections: ImportedPolicySection[] = [];
  const preamble = lines.slice(0, headings[0].index).join("\n").trim();
  if (preamble) {
    sections.push({
      ref: "0",
      heading: "Policy overview",
      content: preamble,
      category: inferPolicyCategory("Policy overview", preamble),
      keywords: extractPolicyKeywords("Policy overview", preamble),
      sortOrder: 0,
    });
  }

  const refCounts = new Map<string, number>();
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const next = headings[index + 1];
    const content = lines
      .slice(heading.index + 1, next?.index ?? lines.length)
      .join("\n")
      .trim();
    if (!content) continue;

    const seen = refCounts.get(heading.parsed.ref) ?? 0;
    refCounts.set(heading.parsed.ref, seen + 1);
    const ref = seen === 0 ? heading.parsed.ref : `${heading.parsed.ref}.${seen + 1}`;
    sections.push({
      ref,
      heading: heading.parsed.heading,
      content,
      category: inferPolicyCategory(heading.parsed.heading, content),
      keywords: extractPolicyKeywords(heading.parsed.heading, content),
      sortOrder: sections.length,
    });
  }
  return sections;
}

export function buildPolicySummary(input: string, maxCharacters = 1_200): string {
  const text = normalizePolicyText(input).replace(/\n+/g, " ");
  if (text.length <= maxCharacters) return text;
  const shortened = text.slice(0, maxCharacters + 1);
  const boundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, boundary > maxCharacters * 0.7 ? boundary : maxCharacters).trim()}...`;
}