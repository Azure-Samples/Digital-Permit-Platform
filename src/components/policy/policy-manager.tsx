"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { PolicyVersionActions } from "./policy-version-actions";

interface PolicyListItem {
  id: string;
  title: string;
  councilName: string;
  versionLabel: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  sourceFilename: string | null;
  createdAt: string;
  uploaderName: string | null;
  sectionCount: number;
}

export function PolicyManager({
  policies,
  defaultCouncilName,
}: {
  policies: PolicyListItem[];
  defaultCouncilName: string;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function uploadPolicy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setError("");
    const response = await fetch("/api/admin/policies", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "Policy upload failed.");
      setUploading(false);
      return;
    }
    router.push(`/staff/policy/manage/${body.id}`);
    router.refresh();
  }

  return (
    <>
      <section className="border-t border-govuk-mid-grey pt-6 mb-10">
        <h2>Import a policy version</h2>
        <form onSubmit={uploadPolicy} className="max-w-3xl" encType="multipart/form-data">
          {error && (
            <div className="govuk-warning-text" role="alert">
              <strong>There is a problem:</strong> {error}
            </div>
          )}

          <div className="govuk-form-group">
            <label className="govuk-label" htmlFor="policy-file">
              Policy document
            </label>
            <p className="govuk-hint">PDF, DOCX, Markdown, or text. Maximum 10MB.</p>
            <input
              id="policy-file"
              name="file"
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="councilName">
                Licensing authority
              </label>
              <input
                className="govuk-input"
                id="councilName"
                name="councilName"
                defaultValue={defaultCouncilName}
                minLength={2}
                maxLength={120}
                required
              />
            </div>
            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="versionLabel">
                Version label
              </label>
              <input
                className="govuk-input"
                id="versionLabel"
                name="versionLabel"
                placeholder="2026-2031"
                maxLength={80}
                required
              />
            </div>
          </div>

          <div className="govuk-form-group">
            <label className="govuk-label" htmlFor="title">
              Policy title
            </label>
            <input
              className="govuk-input"
              id="title"
              name="title"
              defaultValue="Statement of Licensing Policy"
              minLength={5}
              maxLength={200}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="effectiveFrom">
                Effective from
              </label>
              <input
                className="govuk-input"
                id="effectiveFrom"
                name="effectiveFrom"
                type="date"
                required
              />
            </div>
            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="effectiveTo">
                Effective to (optional)
              </label>
              <input
                className="govuk-input"
                id="effectiveTo"
                name="effectiveTo"
                type="date"
              />
            </div>
          </div>

          <div className="govuk-form-group">
            <label className="govuk-label" htmlFor="summary">
              Summary (optional)
            </label>
            <p className="govuk-hint">Leave blank to use the opening policy text.</p>
            <textarea
              className="govuk-textarea"
              id="summary"
              name="summary"
              rows={4}
              maxLength={2000}
            />
          </div>

          <button
            type="submit"
            className="govuk-button inline-flex items-center gap-2"
            disabled={uploading}
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            {uploading ? "Importing..." : "Import draft"}
          </button>
        </form>
      </section>

      <section>
        <h2>Policy versions</h2>
        {policies.length === 0 ? (
          <p>No policy versions have been imported.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="govuk-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Effective dates</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr key={policy.id}>
                    <td>
                      <Link href={`/staff/policy/manage/${policy.id}`} className="font-bold">
                        {policy.title}
                      </Link>
                      <br />
                      <span className="text-sm text-govuk-dark-grey">
                        {policy.versionLabel} · {policy.sectionCount} sections
                      </span>
                    </td>
                    <td className="text-sm">
                      {new Date(policy.effectiveFrom).toLocaleDateString("en-GB")}
                      {policy.effectiveTo
                        ? ` to ${new Date(policy.effectiveTo).toLocaleDateString("en-GB")}`
                        : " onwards"}
                    </td>
                    <td className="text-sm">
                      {policy.sourceFilename ?? "Seeded content"}
                      {policy.uploaderName && (
                        <span className="block text-govuk-dark-grey">
                          by {policy.uploaderName}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={policy.isActive ? "govuk-tag" : "govuk-tag govuk-tag--grey"}>
                        {policy.isActive ? "Active" : "Draft"}
                      </span>
                    </td>
                    <td>
                      <PolicyVersionActions policyId={policy.id} isActive={policy.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}