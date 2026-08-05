"use client";

import { useState, useRef } from "react";
import type { DocumentRequirement } from "@/types/module";

interface DocumentUploadProps {
  requirements: DocumentRequirement[];
  uploadedDocuments: Array<{
    id: string;
    requirementKey: string;
    originalFilename: string;
    status: string;
  }>;
  answers: Record<string, unknown>;
  applicationId: string;
  onUploadComplete: () => void;
}

export function DocumentUpload({
  requirements,
  uploadedDocuments,
  answers,
  applicationId,
  onUploadComplete,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const _fileInputRef = useRef<HTMLInputElement>(null);

  // Filter requirements based on conditional logic
  const flatAnswers = Object.values(answers).reduce<Record<string, unknown>>(
    (acc, val) => ({ ...acc, ...(val as Record<string, unknown>) }),
    {}
  );

  const applicableRequirements = requirements.filter((req) => {
    if (!req.conditionalOn) return true;
    const { field, operator, value } = req.conditionalOn;
    const fieldValue = flatAnswers[field];
    switch (operator) {
      case "eq":
        return fieldValue === value;
      case "neq":
        return fieldValue !== value;
      case "exists":
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== "";
      default:
        return true;
    }
  });

  async function handleUpload(requirementKey: string, file: File) {
    setUploading(requirementKey);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("applicationId", applicationId);
      formData.append("requirementKey", requirementKey);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  function getDocumentStatus(requirementKey: string) {
    const doc = uploadedDocuments.find(
      (d) => d.requirementKey === requirementKey
    );
    if (!doc) return null;
    return doc;
  }

  return (
    <div>
      <h2>Documents and uploads</h2>
      <p className="govuk-hint">
        Upload the required documents below. Accepted formats: PDF, JPEG, PNG,
        DOC, DOCX. Maximum file size: {process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || "10"}MB.
      </p>

      {error && (
        <div className="govuk-warning-text" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="space-y-6 mt-6">
        {applicableRequirements.map((req) => {
          const existingDoc = getDocumentStatus(req.key);
          const isUploading = uploading === req.key;

          return (
            <div
              key={req.key}
              className={`border p-4 ${
                existingDoc
                  ? "border-govuk-green bg-green-50"
                  : req.required
                  ? "border-govuk-red bg-red-50"
                  : "border-govuk-mid-grey bg-white"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-base font-bold mb-1">
                    {req.label}
                    {req.required && (
                      <span className="text-govuk-red ml-1">
                        (required)
                      </span>
                    )}
                  </h3>
                  {req.description && (
                    <p className="text-sm text-govuk-dark-grey">
                      {req.description}
                    </p>
                  )}
                </div>
                {existingDoc && (
                  <span className="govuk-tag govuk-tag--green text-xs">
                    Uploaded
                  </span>
                )}
              </div>

              {existingDoc ? (
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm">
                    {existingDoc.originalFilename}
                  </span>
                  <label className="text-govuk-blue text-sm underline cursor-pointer">
                    Replace
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(req.key, file);
                      }}
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-2">
                  <label
                    className={`govuk-button govuk-button--secondary text-sm ${
                      isUploading ? "opacity-50" : ""
                    }`}
                  >
                    {isUploading ? "Uploading..." : "Choose file"}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(req.key, file);
                      }}
                    />
                  </label>
                </div>
              )}

              {req.verificationStatus === "needs_council_confirmation" && (
                <p className="text-xs text-govuk-dark-grey mt-2 italic">
                  Note: This requirement is based on the council&apos;s application
                  pack and may be subject to confirmation.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
