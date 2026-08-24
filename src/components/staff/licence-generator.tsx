"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileText } from "lucide-react";
import { STANDARD_LICENCE_TEMPLATE_ID } from "@/lib/licence-template-fields";

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  filename: string;
  standard?: boolean;
}

export function LicenceGenerator({
  caseId,
  moduleName,
  templates,
}: {
  caseId: string;
  moduleName: string;
  templates: TemplateOption[];
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templates[0]?.id ?? STANDARD_LICENCE_TEMPLATE_ID,
  );
  const [generating, setGenerating] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setGeneratedTemplate("");

    try {
      const response = await fetch(`/api/applications/${caseId}/licence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate licence");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ?? "licence.docx";
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setGeneratedTemplate(
        templates.find((template) => template.id === selectedTemplateId)?.name ??
          "Selected template",
      );
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate licence",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      {generatedTemplate && (
        <div className="govuk-notification-banner govuk-notification-banner--success mt-6" role="status">
          <div className="govuk-notification-banner__content flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold mb-1">Licence generated and downloaded</p>
              <p className="mb-0 text-sm">
                {generatedTemplate} was filled, saved to the case, and downloaded as a DOCX file.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mt-8" aria-labelledby="choose-template-title">
        <h2 id="choose-template-title">Choose a document template</h2>
        <p className="text-govuk-dark-grey">
          These templates are available for {moduleName}. Review the downloaded document before issuing it.
        </p>

        {error && (
          <div className="govuk-error-summary" role="alert">
            <h3 className="govuk-error-summary__title">The licence was not generated</h3>
            <div className="govuk-error-summary__body">{error}</div>
          </div>
        )}

        <fieldset className="govuk-fieldset mt-6">
          <legend className="sr-only">Document template</legend>
          <div className="border-t border-govuk-mid-grey">
            {templates.map((template) => (
              <label
                key={template.id}
                className={`flex cursor-pointer items-start gap-4 border-b border-govuk-mid-grey p-4 ${
                  selectedTemplateId === template.id ? "bg-govuk-light-blue" : "bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="templateId"
                  value={template.id}
                  checked={selectedTemplateId === template.id}
                  onChange={() => setSelectedTemplateId(template.id)}
                  className="mt-1 h-5 w-5 shrink-0"
                />
                <FileText className="h-6 w-6 shrink-0 text-govuk-blue" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong>{template.name}</strong>
                    <span className={`govuk-tag ${template.standard ? "" : "govuk-tag--grey"}`}>
                      {template.standard ? "Standard" : "Tailored"}
                    </span>
                  </span>
                  <span className="block text-sm text-govuk-dark-grey mt-1 break-words">
                    {template.description || template.filename}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          className="govuk-button govuk-button--start inline-flex items-center gap-2 mt-6"
          onClick={handleGenerate}
          disabled={generating}
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          {generating ? "Generating..." : "Generate and download licence"}
        </button>
      </section>
    </>
  );
}