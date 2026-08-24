import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, BookOpen, Settings } from "lucide-react";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { isAiConfigured } from "@/lib/ai/openai";
import { PolicyWorkspace } from "@/components/ai/policy-workspace";
import { prisma } from "@/lib/db";
import {
  isPolicyRegime,
  POLICY_REGIME_CONFIG,
  POLICY_REGIMES,
} from "@/lib/policy/regimes";

export const dynamic = "force-dynamic";

export default async function PolicyCopilotPage() {
  const session = await requireRole("REVIEWER", "MANAGER", "ADMIN").catch(
    () => null
  );
  if (!session) redirect("/auth/login?callbackUrl=/staff/policy");

  const activePolicies = await prisma.licensingPolicy.findMany({
    where: { isActive: true, regime: { in: [...POLICY_REGIMES] } },
    select: {
      id: true,
      regime: true,
      councilName: true,
      title: true,
      versionLabel: true,
      _count: { select: { sections: true } },
    },
    orderBy: { effectiveFrom: "desc" },
  });
  const policies = activePolicies.filter(
    (policy): policy is typeof policy & { regime: "licensing_act_2003" | "taxi_private_hire" } =>
      isPolicyRegime(policy.regime),
  );
  const taxiPolicyActive = policies.some(
    (policy) => policy.regime === "taxi_private_hire",
  );
  const aiReady = isAiConfigured();
  const canManagePolicy = new Set(["MANAGER", "ADMIN"]).has(session.user.role);

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal – Staff"
        navigation={getNavigationForRole(session.user.role, "/staff/policy")}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <nav className="govuk-breadcrumbs mb-4">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/staff">Dashboard</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">Policy Copilot</li>
            </ol>
          </nav>

          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-govuk-blue" />
            <h1 className="!mb-0">Policy Copilot</h1>
          </div>
          <p className="text-govuk-dark-grey max-w-3xl mb-6">
            {taxiPolicyActive
              ? "Analyse a licence or ask one question across the council's active Licensing Act and taxi/private-hire policies. Policy Copilot selects the relevant source automatically and keeps each legal regime distinct."
              : "Analyse a licence or ask questions against the council's active Licensing Act policy. Add a taxi/private-hire policy if the council offers those services."}
          </p>

          {policies.length > 0 ? (
            <div className="mb-6 grid gap-3 lg:grid-cols-2">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="flex items-start gap-3 border border-govuk-mid-grey bg-white p-4"
                >
                  <BookOpen className="mt-1 h-5 w-5 shrink-0 text-govuk-blue" />
                  <div>
                    <p className="text-xs font-bold uppercase text-govuk-dark-grey">
                      {POLICY_REGIME_CONFIG[policy.regime].shortLabel}
                    </p>
                    <p className="font-bold">{policy.title}</p>
                    <p className="text-sm text-govuk-dark-grey">
                      In force {policy.versionLabel} ·{" "}
                      {policy._count.sections > 0
                        ? "searchable"
                        : "original document only"}{" "}
                      ·{" "}
                      <Link
                        href={`/staff/policy/document?regime=${policy.regime}`}
                        className="text-sm"
                      >
                        View policy
                      </Link>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="govuk-warning-text mb-6">
              <span className="text-govuk-red font-bold text-2xl">!</span>
              <p>
                No licensing policy is active.{" "}
                {canManagePolicy ? (
                  <Link href="/staff/policy/manage">Upload and activate the council statement</Link>
                ) : (
                  "Ask a manager or administrator to import one."
                )}
              </p>
            </div>
          )}

          {policies.some((policy) => policy._count.sections === 0) && (
            <div className="govuk-warning-text mb-6">
              <span className="text-govuk-red font-bold text-2xl">!</span>
              <p>
                One or more active policies have no searchable text. Staff can still
                view or download those originals, but Copilot cannot use them.
              </p>
            </div>
          )}

          {!aiReady && (
            <div className="govuk-warning-text mb-6">
              <span className="text-govuk-red font-bold text-2xl">!</span>
              <p>
                AI is not configured on this environment (no Azure OpenAI endpoint or
                API key). The interface is visible but analysis will not run.
              </p>
            </div>
          )}

          {canManagePolicy && (
            <div className="mb-6">
              <Link
                href="/staff/policy/manage"
                className="govuk-button govuk-button--secondary inline-flex items-center gap-2"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Open licensing policy
              </Link>
            </div>
          )}

          <PolicyWorkspace activeRegimes={policies.map((policy) => policy.regime)} />
        </div>
      </main>

      <GovFooter />
    </>
  );
}
