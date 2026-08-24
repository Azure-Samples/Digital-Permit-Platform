"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import type { PolicyLifecycleStatus } from "@/lib/policy/service";
import {
  POLICY_REGIME_CONFIG,
  POLICY_REGIMES,
  type PolicyRegime,
} from "@/lib/policy/regimes";
import { PolicyVersionActions } from "./policy-version-actions";

interface PolicyListItem {
  id: string;
  regime: PolicyRegime;
  title: string;
  councilName: string;
  versionLabel: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  sourceFilename: string | null;
  searchable: boolean;
  searchIndexTruncated: boolean;
  searchableCharacters: number;
  createdAt: string;
  uploaderName: string | null;
  status: PolicyLifecycleStatus;
}

const statusLabels: Record<PolicyLifecycleStatus, string> = {
  active: "Active",
  superseded: "Previous",
  draft: "Draft",
};

export function PolicyManager({
  policies,
  defaultCouncilName,
  taxiModulesEnabled,
}: {
  policies: PolicyListItem[];
  defaultCouncilName: string;
  taxiModulesEnabled: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [regime, setRegime] = useState<PolicyRegime>("licensing_act_2003");
  const [title, setTitle] = useState(
    POLICY_REGIME_CONFIG.licensing_act_2003.documentTitle,
  );

  function chooseRegime(nextRegime: PolicyRegime) {
    setRegime(nextRegime);
    setTitle(POLICY_REGIME_CONFIG[nextRegime].documentTitle);
  }

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
      <section className="border-t border-govuk-mid-grey pt-8 mb-12" id="upload-policy">
        <h2>Upload a new or revised statement</h2>
        <p className="max-w-3xl text-govuk-dark-grey mb-6">
          Each upload creates a draft. Review the retained original before activation;
          activating it replaces the current statement without deleting earlier editions.
        </p>
        <form onSubmit={uploadPolicy} className="max-w-3xl" encType="multipart/form-data">
          {error && (
            <div className="govuk-warning-text" role="alert">
              <strong>There is a problem:</strong> {error}
            </div>
          )}

          <fieldset className="govuk-form-group">
            <legend className="govuk-label font-bold">Policy area</legend>
            <div className="grid gap-3 md:grid-cols-2">
              {POLICY_REGIMES.map((policyRegime) => {
                const config = POLICY_REGIME_CONFIG[policyRegime];
                const selected = regime === policyRegime;
                return (
                  <label
                    key={policyRegime}
                    className={`cursor-pointer border-2 p-4 ${
                      selected
                        ? "border-govuk-blue bg-[#eef6fb]"
                        : "border-govuk-mid-grey bg-white"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="regime"
                        value={policyRegime}
                        checked={selected}
                        onChange={() => chooseRegime(policyRegime)}
                        className="mt-1 h-5 w-5 shrink-0"
                      />
                      <span>
                        <strong className="block">{config.label}</strong>
                        <span className="mt-1 block text-sm text-govuk-dark-grey">
                          {config.description}
                        </span>
                        <span className="mt-2 block text-xs text-govuk-dark-grey">
                          {config.requirement}
                        </span>
                        {policyRegime === "taxi_private_hire" && !taxiModulesEnabled && (
                          <span className="mt-2 block text-xs font-bold text-[#8a4500]">
                            Taxi modules are currently disabled. You can prepare a draft now,
                            but review module readiness before activation.
                          </span>
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="govuk-form-group">
            <label className="govuk-label" htmlFor="policy-file">
              Statement document
            </label>
            <p className="govuk-hint">
              Upload the council-approved PDF or DOCX where possible. Markdown and plain
              text are also accepted. Long statements are supported up to 50MB.
            </p>
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
                Edition or year label
              </label>
              <p className="govuk-hint">For example, 2026–2031 or 2027 revision.</p>
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
              Statement title
            </label>
            <input
              className="govuk-input"
              id="title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
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
            <p className="govuk-hint">
              Record what changed in this edition, or leave blank to use the opening text.
            </p>
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
            {uploading ? "Uploading..." : "Upload policy draft"}
          </button>
        </form>
      </section>

      <section>
        <h2>Policy history</h2>
        <p className="max-w-3xl text-govuk-dark-grey mb-6">
          Previous active statements are retained and can be made active again. Drafts
          can be deleted before they have ever taken effect.
        </p>
        {policies.length === 0 ? (
          <p>No statement versions have been uploaded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="govuk-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Policy area</th>
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
                    <td className="text-sm font-bold">
                      {POLICY_REGIME_CONFIG[policy.regime].shortLabel}
                    </td>
                    <td>
                      <Link href={`/staff/policy/manage/${policy.id}`} className="font-bold">
                        {policy.title}
                      </Link>
                      <br />
                      <span className="text-sm text-govuk-dark-grey">
                        {policy.versionLabel}
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
                      <span className="block text-govuk-dark-grey">
                        uploaded {new Date(policy.createdAt).toLocaleDateString("en-GB")}
                      </span>
                      {!policy.searchable && (
                        <span className="block font-bold text-[#8a4500]">
                          Original only · Copilot unavailable
                        </span>
                      )}
                      {policy.searchIndexTruncated && (
                        <span className="block font-bold text-[#8a4500]">
                          Partial Copilot index · {policy.searchableCharacters.toLocaleString()} characters
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`govuk-tag ${
                          policy.status === "active"
                            ? ""
                            : policy.status === "draft"
                              ? "govuk-tag--yellow"
                              : "govuk-tag--grey"
                        }`}
                      >
                        {statusLabels[policy.status]}
                      </span>
                    </td>
                    <td>
                      <PolicyVersionActions
                        policyId={policy.id}
                        status={policy.status}
                        regime={policy.regime}
                        taxiModulesEnabled={taxiModulesEnabled}
                      />
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