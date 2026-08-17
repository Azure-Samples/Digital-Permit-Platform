"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Trash2 } from "lucide-react";
import type { PolicyLifecycleStatus } from "@/lib/policy/service";
import type { PolicyRegime } from "@/lib/policy/regimes";

export function PolicyVersionActions({
  policyId,
  status,
  regime,
  taxiModulesEnabled = true,
  redirectAfterDelete = "/staff/policy/manage",
}: {
  policyId: string;
  status: PolicyLifecycleStatus;
  regime: PolicyRegime;
  taxiModulesEnabled?: boolean;
  redirectAfterDelete?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"activate" | "delete" | null>(null);
  const [error, setError] = useState("");

  async function runAction(action: "activate" | "delete") {
    const confirmation =
      action === "activate"
        ? regime === "taxi_private_hire" && !taxiModulesEnabled
          ? "Taxi and private-hire modules are currently disabled. Activate this policy anyway? This will not enable any services."
          : status === "superseded"
          ? "Make this previous statement active again? It will replace the version currently used by Policy Copilot and application insight."
          : "Activate this statement for all policy-grounded AI responses?"
        : "Delete this inactive policy draft? This cannot be undone.";
    if (!window.confirm(confirmation)) return;

    setPending(action);
    setError("");
    const response = await fetch(
      action === "activate"
        ? `/api/admin/policies/${policyId}/activate`
        : `/api/admin/policies/${policyId}`,
      { method: action === "activate" ? "POST" : "DELETE" },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? `Policy ${action} failed.`);
      setPending(null);
      return;
    }
    if (action === "delete") router.push(redirectAfterDelete);
    router.refresh();
    setPending(null);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {status !== "active" && (
          <button
            type="button"
            className="govuk-button inline-flex items-center gap-2"
            disabled={pending !== null}
            onClick={() => void runAction("activate")}
          >
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
            {pending === "activate"
              ? "Activating..."
              : status === "superseded"
                ? "Make active again"
                : "Activate statement"}
          </button>
        )}
        {status === "draft" && (
          <button
            type="button"
            className="govuk-button govuk-button--warning inline-flex items-center gap-2"
            disabled={pending !== null}
            onClick={() => void runAction("delete")}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {pending === "delete" ? "Deleting..." : "Delete draft"}
          </button>
        )}
      </div>
      {error && (
        <p className="text-govuk-red font-bold mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}