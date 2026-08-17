import Link from "next/link";
import { Download, ExternalLink, FileText } from "lucide-react";

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
  sourceMimeType?: string | null;
}

function sectionAnchor(ref: string, index: number) {
  return `policy-section-${ref.replace(/[^a-z0-9-]/gi, "-")}-${index}`;
}

export function PolicyDocumentView({
  summary,
  sections,
  sourceHref,
  sourceFilename,
  sourceMimeType,
}: PolicyDocumentViewProps) {
  if (sourceHref && sourceFilename) {
    const isPdf = sourceMimeType === "application/pdf";
    const inlineHref = `${sourceHref}?view=inline`;
    return (
      <div>
        <section className="mb-6 border-l-4 border-govuk-blue bg-[#eef6fb] p-4">
          <p>{summary}</p>
        </section>
        {sections.length === 0 && (
          <div className="govuk-warning-text mb-6" role="status">
            <strong>The original statement is stored, but it has no searchable text.</strong>{" "}
            Staff can view and download it normally. Policy Copilot will remain unavailable
            for this version unless a text-based PDF or DOCX is uploaded.
          </div>
        )}

        <section aria-labelledby="original-policy-heading">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="original-policy-heading" className="!mb-1">
                Original statement document
              </h2>
              <p className="text-sm text-govuk-dark-grey">{sourceFilename}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {isPdf && (
                <Link
                  href={inlineHref}
                  target="_blank"
                  rel="noreferrer"
                  className="govuk-button govuk-button--secondary inline-flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open PDF
                </Link>
              )}
              <Link
                href={sourceHref}
                className="govuk-button govuk-button--secondary inline-flex items-center gap-2"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download original
              </Link>
            </div>
          </div>

          {isPdf ? (
            <iframe
              src={inlineHref}
              title={`PDF preview of ${sourceFilename}`}
              sandbox="allow-scripts allow-downloads"
              referrerPolicy="no-referrer"
              className="h-[75vh] min-h-[620px] w-full border border-govuk-mid-grey bg-white"
            />
          ) : (
            <div className="border border-govuk-mid-grey bg-white p-6">
              <FileText className="mb-3 h-8 w-8 text-govuk-blue" aria-hidden="true" />
              <p className="font-bold">Preview is available for PDF statements.</p>
              <p className="mb-0 text-govuk-dark-grey">
                Download the retained {sourceFilename.split(".").pop()?.toUpperCase() ?? "source"} document to review it in its original format.
              </p>
            </div>
          )}
        </section>
      </div>
    );
  }

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
          <p className="mt-5 text-sm text-govuk-dark-grey">
            This seeded demonstration record has no retained source file.
          </p>
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