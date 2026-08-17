import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { PolicyDocumentView } from "@/components/policy/policy-document-view";
import { PolicyVersionActions } from "@/components/policy/policy-version-actions";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { getPolicyLifecycleStatus } from "@/lib/policy/service";
import {
  isPolicyRegime,
  isTaxiModule,
  POLICY_REGIME_CONFIG,
} from "@/lib/policy/regimes";

export const dynamic = "force-dynamic";

export default async function PolicyVersionPreviewPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const session = await requireRole("MANAGER", "ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/staff/policy/manage");
  const { policyId } = await params;
  const policy = await prisma.licensingPolicy.findUnique({
    where: { id: policyId },
    select: {
      id: true,
      regime: true,
      title: true,
      councilName: true,
      versionLabel: true,
      effectiveFrom: true,
      effectiveTo: true,
      summary: true,
      isActive: true,
      sourceFilename: true,
      sourceMimeType: true,
      searchIndexTruncated: true,
      searchableCharacters: true,
      sections: { orderBy: { sortOrder: "asc" } },
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!policy || !isPolicyRegime(policy.regime)) return notFound();
  const regimeConfig = POLICY_REGIME_CONFIG[policy.regime];
  const historyEvent = await prisma.auditLog.findFirst({
    where: {
      action: { in: ["policy.activate", "policy.supersede"] },
      entityType: "LicensingPolicy",
      entityId: policy.id,
    },
    select: { id: true },
  });
  const status = getPolicyLifecycleStatus(policy.isActive, Boolean(historyEvent));
  const taxiModulesEnabled =
    policy.regime !== "taxi_private_hire" ||
    (await prisma.licenceModule.findMany({
      where: { enabled: true },
      select: { category: true, moduleKey: true },
    })).some((module) => isTaxiModule(module.category, module.moduleKey));

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal - Staff"
        navigation={getNavigationForRole(session.user.role, "/staff/policy/manage")}
        userName={session.user.name}
        userRole={session.user.role}
      />
      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <nav className="govuk-breadcrumbs mb-6" aria-label="Breadcrumb">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/staff">Dashboard</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/staff/policy/manage">Licensing policy</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">Preview version</li>
            </ol>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-5 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="h-7 w-7 text-govuk-blue" aria-hidden="true" />
                <h1 className="!mb-0">{policy.title}</h1>
              </div>
              <p className="text-govuk-dark-grey">
                {regimeConfig.label} · {policy.councilName} · {policy.versionLabel} · effective {" "}
                {policy.effectiveFrom.toLocaleDateString("en-GB")}
                {policy.effectiveTo
                  ? ` to ${policy.effectiveTo.toLocaleDateString("en-GB")}`
                  : " onwards"}
                {" · "}
                {policy.sections.length > 0
                  ? "searchable for Policy Copilot"
                  : "original document only"}
              </p>
              <p className="mb-2 text-xs text-govuk-dark-grey">
                {regimeConfig.legalBasis}. {regimeConfig.requirement}
              </p>
              <span
                className={`govuk-tag ${
                  status === "active"
                    ? ""
                    : status === "draft"
                      ? "govuk-tag--yellow"
                      : "govuk-tag--grey"
                }`}
              >
                {status === "active" ? "Active" : status === "draft" ? "Draft" : "Previous"}
              </span>
            </div>
            <PolicyVersionActions
              policyId={policy.id}
              status={status}
              regime={policy.regime}
              taxiModulesEnabled={taxiModulesEnabled}
            />
          </div>

          <PolicyDocumentView
            summary={policy.summary}
            sections={policy.sections}
            sourceHref={
              policy.sourceFilename
                ? `/api/admin/policies/${policy.id}/source`
                : undefined
            }
            sourceFilename={policy.sourceFilename}
            sourceMimeType={policy.sourceMimeType}
          />
          {policy.searchIndexTruncated && (
            <div className="govuk-warning-text mt-6" role="status">
              <strong>Policy Copilot has a partial search index.</strong>{" "}
              {policy.searchableCharacters.toLocaleString()} characters are searchable.
              Review the retained original for provisions outside the index.
            </div>
          )}
        </div>
      </main>
      <GovFooter />
    </>
  );
}