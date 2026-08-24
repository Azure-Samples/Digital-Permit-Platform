import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { PolicyDocumentView } from "@/components/policy/policy-document-view";
import { requireRole } from "@/lib/permissions";
import { getActivePolicyContext } from "@/lib/ai/policy-context";
import {
  DEFAULT_POLICY_REGIME,
  isPolicyRegime,
  POLICY_REGIME_CONFIG,
} from "@/lib/policy/regimes";

export const dynamic = "force-dynamic";

export default async function PolicyDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ regime?: string }>;
}) {
  const session = await requireRole("REVIEWER", "MANAGER", "ADMIN").catch(
    () => null
  );
  if (!session) redirect("/auth/login?callbackUrl=/staff/policy/document");

  const requestedRegime = (await searchParams).regime;
  const regime = isPolicyRegime(requestedRegime)
    ? requestedRegime
    : DEFAULT_POLICY_REGIME;
  const policy = await getActivePolicyContext(regime);
  if (!policy) return notFound();

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
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/staff/policy">Policy Copilot</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">Policy document</li>
            </ol>
          </nav>

          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-7 w-7 text-govuk-blue" />
            <h1 className="!mb-0">{policy.title}</h1>
          </div>
          <p className="text-govuk-dark-grey mb-6">
            {POLICY_REGIME_CONFIG[policy.regime].label} · {policy.councilName} · in force {policy.versionLabel}
          </p>

          <PolicyDocumentView
            summary={policy.summary}
            sections={policy.sections}
            sourceHref={
              policy.sourceFilename
                ? `/api/admin/policies/${policy.policyId}/source`
                : undefined
            }
            sourceFilename={policy.sourceFilename}
            sourceMimeType={policy.sourceMimeType}
          />
        </div>
      </main>

      <GovFooter />
    </>
  );
}
