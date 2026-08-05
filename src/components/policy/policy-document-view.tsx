import Link from "next/link";
import { Download } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  objectives: "Licensing objectives",
  cumulative_impact: "Cumulative impact",
  hours: "Hours",
  children: "Protection of children",
  conditions: "Conditions",
  entertainment: "Entertainment",
  enforcement: "Enforcement",
  applicant_guidance: "Advice for applicants",
  general: "General",
};

interface PolicyDocumentViewProps {
  summary: string;
  sections: Array<{
    ref: string;
    heading: string;
    category: string;
    content: string;
  }>;
  sourceHref?: string;
  sourceFilename?: string | null;
}

function sectionAnchor(ref: string, index: number) {
  return `policy-section-${ref.replace(/[^a-z0-9-]/gi, "-")}-${index}`;
}

export function PolicyDocumentView({
  summary,
  sections,
  sourceHref,
  sourceFilename,
}: PolicyDocumentViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <nav className="lg:col-span-1" aria-label="Policy contents">
        <div className="bg-white border border-govuk-mid-grey p-4 lg:sticky lg:top-4">
          <p className="font-bold mb-2">Contents</p>
          <ul className="space-y-1 text-sm">
            {sections.map((section, index) => (
              <li key={`${section.ref}-${index}`}>
                <a
                  href={`#${sectionAnchor(section.ref, index)}`}
                  className="text-govuk-blue"
                >
                  {section.ref} {section.heading}
                </a>
              </li>
            ))}
          </ul>
          {sourceHref && sourceFilename && (
            <Link
              href={sourceHref}
              className="inline-flex items-center gap-2 mt-5 text-sm"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download source document
            </Link>
          )}
        </div>
      </nav>

      <div className="lg:col-span-3">
        <section className="bg-[#eef6fb] border-l-4 border-govuk-blue p-4 mb-6">
          <p>{summary}</p>
        </section>
        {sections.map((section, index) => (
          <article
            key={`${section.ref}-${index}`}
            id={sectionAnchor(section.ref, index)}
            className="bg-white border border-govuk-mid-grey p-5 mb-4 scroll-mt-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="govuk-tag">{section.ref}</span>
              <span className="text-xs text-govuk-dark-grey uppercase font-bold">
                {CATEGORY_LABELS[section.category] ?? section.category}
              </span>
            </div>
            <h2 className="!text-govuk-m">{section.heading}</h2>
            <p className="leading-relaxed whitespace-pre-line">{section.content}</p>
          </article>
        ))}
      </div>
    </div>
  );
}