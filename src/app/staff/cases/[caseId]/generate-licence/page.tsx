"use client";

import { use, useState } from "react";
import Link from "next/link";
import { GovHeader } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";

interface GenerateLicencePageProps {
  params: Promise<{ caseId: string }>;
}

export default function GenerateLicencePage({ params }: GenerateLicencePageProps) {
  const { caseId } = use(params);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/applications/${caseId}/licence`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate licence");
      }

      // Download the file and open in new tab
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate licence");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <GovHeader serviceName="Licensing Portal – Staff" />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container max-w-govuk-two-thirds">
          <Link href={`/staff/cases/${caseId}`} className="text-sm">
            ← Back to case
          </Link>

          {!generated ? (
            <>
              <div className="govuk-panel bg-govuk-green text-white p-8 text-center mt-4">
                <h1 className="govuk-panel__title text-white">
                  Application approved
                </h1>
                <div className="govuk-panel__body">
                  The application has been approved successfully.
                </div>
              </div>

              <h2 className="mt-8">Generate licence document</h2>
              <p className="text-govuk-dark-grey mb-4">
                Click below to generate the licence document from the template.
                It will open in a new tab for you to print or save.
              </p>

              {error && (
                <div className="govuk-warning-text mb-4" role="alert">
                  <strong>Error:</strong> {error}
                </div>
              )}

              <button
                type="button"
                className="govuk-button govuk-button--start"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? "Generating..." : "Generate licence document"}
              </button>
            </>
          ) : (
            <>
              <div className="govuk-panel bg-govuk-green text-white p-8 text-center mt-4">
                <h1 className="govuk-panel__title text-white">
                  Licence generated
                </h1>
                <div className="govuk-panel__body">
                  The licence document has been generated and opened in a new tab.
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <p>The licence document has been:</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Generated with a unique licence number</li>
                  <li>Saved to the case record</li>
                  <li>Opened in a new browser tab</li>
                </ul>

                <p className="text-govuk-dark-grey text-sm mt-4">
                  In future, this will also be emailed to the applicant
                  automatically.
                </p>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    className="govuk-button govuk-button--secondary"
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    {generating ? "Generating..." : "Generate again"}
                  </button>
                  <Link
                    href={`/staff/cases/${caseId}`}
                    className="govuk-button no-underline"
                  >
                    Back to case
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <GovFooter />
    </>
  );
}
