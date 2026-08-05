import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, BookOpen, Settings } from "lucide-react";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { getActivePolicyContext } from "@/lib/ai/policy-context";
import { isAiConfigured } from "@/lib/ai/openai";
import { PolicyWorkspace } from "@/components/ai/policy-workspace";

export const dynamic = "force-dynamic";

export default async function PolicyCopilotPage() {
  const session = await requireRole("REVIEWER", "MANAGER", "ADMIN").catch(
    () => null
  );
  if (!session) redirect("/auth/login?callbackUrl=/staff/policy");

  const policy = await getActivePolicyContext();
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
            Upload or paste a licence and get an at-a-glance summary — holder, hours,
            licensable activities, mandatory conditions and risks — with an automatic
            check against the council&apos;s licensing policy. Built for licensing
            officers and the police.
          </p>

          {policy ? (
            <div className="bg-white border border-govuk-mid-grey p-4 mb-6 flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-govuk-blue shrink-0 mt-1" />
              <div>
                <p className="font-bold">
                  Grounded in: {policy.title}
                </p>
                <p className="text-sm text-govuk-dark-grey">
                  {policy.councilName} · in force {policy.versionLabel} ·{" "}
                  {policy.sections.length} sections.{" "}
                  <Link href="/staff/policy/document" className="text-sm">
                    View the policy
                  </Link>
                  {canManagePolicy && (
                    <>
                      {" · "}
                      <Link href="/staff/policy/manage" className="text-sm">
                        Manage policies
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="govuk-warning-text mb-6">
              <span className="text-govuk-red font-bold text-2xl">!</span>
              <p>
                No Statement of Licensing Policy is active.{" "}
                {canManagePolicy ? (
                  <Link href="/staff/policy/manage">Import and activate a policy</Link>
                ) : (
                  "Ask a manager or administrator to import one."
                )}
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
                Manage policy versions
              </Link>
            </div>
          )}

          <PolicyWorkspace />
        </div>
      </main>

      <GovFooter />
    </>
  );
}
