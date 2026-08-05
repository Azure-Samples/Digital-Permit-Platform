"use client";

import { useState, useCallback } from "react";

interface DocumentItem {
  id: string;
  requirementKey: string;
  originalFilename: string;
  fileSizeBytes: number;
  status: string;
  rejectionReason: string | null;
}

interface DocRequirement {
  key: string;
  label: string;
  description?: string;
  required: boolean;
}

interface Props {
  applicationId: string;
  documents: DocumentItem[];
  docRequirements: DocRequirement[];
  applicationStatus: string;
}

export function DocumentReupload({
  applicationId,
  documents,
  docRequirements,
  applicationStatus,
}: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [docs, setDocs] = useState(documents);

  const rejectedDocs = docs.filter((d) => d.status === "REJECTED");
  const isClosed = ["APPROVED", "REFUSED", "WITHDRAWN", "CANCELLED"].includes(
    applicationStatus,
  );

  const handleReupload = useCallback(
    async (requirementKey: string, file: File) => {
      setUploading(requirementKey);
      setError(null);
      setSuccess(null);

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

        // Update local state – replace old doc
        setDocs((prev) =>
          prev.map((d) =>
            d.requirementKey === requirementKey
              ? { ...d, status: "UPLOADED", originalFilename: file.name, rejectionReason: null }
              : d,
          ),
        );
        setSuccess(
          `"${file.name}" uploaded successfully for ${requirementKey}. It will be reviewed shortly.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(null);
      }
    },
    [applicationId],
  );

  return (
    <section className="bg-white border border-govuk-mid-grey p-6">
      <h2>Documents ({docs.length})</h2>

      {/* Alert for rejected documents */}
      {rejectedDocs.length > 0 && !isClosed && (
        <div className="govuk-warning-text mb-4" role="alert">
          <strong className="text-govuk-red">Action required:</strong>{" "}
          {rejectedDocs.length} document(s) need to be re-uploaded. Please
          upload replacement documents below.
        </div>
      )}

      {error && (
        <div className="govuk-warning-text mb-4" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-govuk-green p-4 mb-4">
          <p className="text-sm text-govuk-green font-bold">{success}</p>
        </div>
      )}

      {docs.length === 0 ? (
        <p className="text-govuk-dark-grey">No documents uploaded.</p>
      ) : (
        <div className="space-y-4">
          {docs.map((doc) => {
            const req = docRequirements.find((r) => r.key === doc.requirementKey);
            const isRejected = doc.status === "REJECTED";
            const isUploading = uploading === doc.requirementKey;

            return (
              <div
                key={doc.id}
                className={`border p-4 ${
                  isRejected
                    ? "border-govuk-red bg-red-50"
                    : doc.status === "VERIFIED"
                      ? "border-govuk-green bg-green-50"
                      : "border-govuk-mid-grey"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-sm">
                      {req?.label ?? doc.requirementKey}
                    </p>
                    <p className="text-sm text-govuk-dark-grey">
                      {doc.originalFilename} ·{" "}
                      {(doc.fileSizeBytes / 1024).toFixed(0)}KB
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`govuk-tag text-xs ${
                        doc.status === "VERIFIED"
                          ? "govuk-tag--green"
                          : doc.status === "REJECTED"
                            ? "govuk-tag--red"
                            : "govuk-tag--grey"
                      }`}
                    >
                      {doc.status === "UPLOADED" ? "Received" : doc.status}
                    </span>
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="text-sm text-govuk-blue underline"
                    >
                      View
                    </a>
                  </div>
                </div>

                {/* Rejection reason + reupload */}
                {isRejected && !isClosed && (
                  <div className="mt-3 border-t border-red-200 pt-3">
                    {doc.rejectionReason && (
                      <p className="text-sm text-govuk-red mb-2">
                        <strong>Reason for rejection:</strong>{" "}
                        {doc.rejectionReason}
                      </p>
                    )}
                    <label
                      className={`govuk-button govuk-button--secondary inline-flex items-center gap-2 text-sm ${
                        isUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      }`}
                    >
                      {isUploading ? "Uploading…" : "Upload replacement"}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        disabled={isUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleReupload(doc.requirementKey, file);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Generic upload prompt for non-closed applications */}
      {!isClosed && rejectedDocs.length === 0 && (
        <div className="mt-4 govuk-inset-text">
          <p className="text-sm">
            Need to upload additional documents? You can still add them from
            the documents step of your application.
          </p>
        </div>
      )}
    </section>
  );
}
