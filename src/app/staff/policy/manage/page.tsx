import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenCheck } from "lucide-react";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { PolicyManager } from "@/components/policy/policy-manager";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import {
  getPolicyLifecycleStatus,
  getPolicyReviewStatus,
} from "@/lib/policy/service";
import { getCouncilProfile } from "@/lib/setup/profile";
import {
  getTaxiPolicyReadiness,
  isPolicyRegime,
  isTaxiModule,
  POLICY_REGIME_CONFIG,
  POLICY_REGIMES,
  type PolicyRegime,
} from "@/lib/policy/regimes";

export const dynamic = "force-dynamic";

export default async function ManagePoliciesPage() {
  const session = await requireRole("MANAGER", "ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/staff/policy/manage");

  const [policies, councilProfile, modules] = await Promise.all([
    prisma.licensingPolicy.findMany({
      orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        regime: true,
        title: true,
        councilName: true,
        versionLabel: true,
        effectiveFrom: true,
        effectiveTo: true,
        isActive: true,
        sourceFilename: true,
        searchIndexTruncated: true,
        searchableCharacters: true,
        createdAt: true,
        uploadedBy: { select: { firstName: true, lastName: true } },
        _count: { select: { sections: true } },
      },
    }),
    getCouncilProfile(),
    prisma.licenceModule.findMany({
      select: { category: true, moduleKey: true, enabled: true },
    }),
  ]);
  const knownPolicies = policies.filter(
    (policy): policy is typeof policy & { regime: PolicyRegime } =>
      isPolicyRegime(policy.regime),
  );
  const policyHistory = policies.length
    ? await prisma.auditLog.findMany({
        where: {
          action: { in: ["policy.activate", "policy.supersede"] },
          entityType: "LicensingPolicy",
          entityId: { in: policies.map((policy) => policy.id) },
        },
        select: { entityId: true },
        distinct: ["entityId"],
      })
    : [];
  const historicalPolicyIds = new Set(
    policyHistory.flatMap((event) => (event.entityId ? [event.entityId] : [])),
  );
  const taxiModulesEnabled = modules.some(
    (module) => module.enabled && isTaxiModule(module.category, module.moduleKey),
  );
  const activePolicies = new Map(
    knownPolicies
      .filter((policy) => policy.isActive)
      .map((policy) => [policy.regime, policy]),
  );
  const taxiReadiness = getTaxiPolicyReadiness(
    taxiModulesEnabled,
    activePolicies.has("taxi_private_hire"),
  );

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
              <li className="govuk-breadcrumbs__list-item">Licensing policy</li>
            </ol>
          </nav>

          <div className="flex items-center gap-3 mb-2">
            <BookOpenCheck className="h-8 w-8 text-govuk-blue" aria-hidden="true" />
            <h1 className="!mb-0">Licensing policies</h1>
          </div>
          <p className="text-govuk-dark-grey max-w-3xl mb-8">
            Keep the council&apos;s Licensing Act and taxi/private-hire policy documents
            in one versioned library. Each policy area has its own active version,
            history and Policy Copilot grounding.
          </p>

          <div className="mb-10 grid gap-5 lg:grid-cols-2">
            {POLICY_REGIMES.map((regime) => {
              const config = POLICY_REGIME_CONFIG[regime];
              const activePolicy = activePolicies.get(regime);
              const reviewStatus = activePolicy
                ? getPolicyReviewStatus(activePolicy.effectiveTo)
                : null;
              const searchable = Boolean(activePolicy?._count.sections);
              const partialIndex = Boolean(activePolicy?.searchIndexTruncated);
              const taxiMismatch =
                regime === "taxi_private_hire" &&
                new Set(["policy-missing", "modules-disabled"]).has(taxiReadiness);
              const needsAttention =
                !activePolicy ||
                reviewStatus !== "current" ||
                taxiMismatch ||
                !searchable ||
                partialIndex;
              return (
                <section
                  key={regime}
                  className={`border-l-4 p-5 ${
                    needsAttention
                      ? "border-[#b35900] bg-[#fff7e6]"
                      : "border-govuk-green bg-[#e9f5ee]"
                  }`}
                  aria-labelledby={`${regime}-heading`}
                >
                  <p className="mb-1 text-sm font-bold uppercase text-govuk-dark-grey">
                    {needsAttention ? "Needs attention" : "Ready"}
                  </p>
                  <h2 id={`${regime}-heading`} className="!mb-2 text-xl">
                    {config.label}
                  </h2>
                  <p className="mb-2 text-sm">{config.description}</p>
                  <p className="mb-3 text-xs text-govuk-dark-grey">
                    {config.legalBasis}. {config.requirement}
                  </p>
                  {activePolicy ? (
                    <>
                      <p className="mb-2 font-bold">{activePolicy.title}</p>
                      <p className="mb-3 text-sm text-govuk-dark-grey">
                        {activePolicy.versionLabel} · effective {activePolicy.effectiveFrom.toLocaleDateString("en-GB")}
                        {activePolicy.effectiveTo
                          ? ` to ${activePolicy.effectiveTo.toLocaleDateString("en-GB")}`
                          : " onwards"}
                      </p>
                      {reviewStatus === "expired" && (
                        <p className="mb-3 font-bold text-govuk-red">The effective period has ended.</p>
                      )}
                      {!searchable && (
                        <p className="mb-3 font-bold text-[#8a4500]">
                          The official document is active, but Policy Copilot cannot search it.
                        </p>
                      )}
                      {partialIndex && (
                        <p className="mb-3 font-bold text-[#8a4500]">
                          Policy Copilot searches a partial {activePolicy.searchableCharacters.toLocaleString()}-character index. Use the original document for complete review.
                        </p>
                      )}
                      <Link href={`/staff/policy/manage/${activePolicy.id}`} className="font-bold">
                        Review active policy
                      </Link>
                    </>
                  ) : (
                    <p className="mb-3 font-bold">
                      {regime === "taxi_private_hire" && !taxiModulesEnabled
                        ? "Taxi services are disabled; no active policy is expected."
                        : "No active policy is configured."}
                    </p>
                  )}
                  {regime === "taxi_private_hire" && taxiReadiness === "policy-missing" && (
                    <p className="mt-3 font-bold text-[#8a4500]">
                      Taxi modules are enabled. DfT recommends publishing and maintaining a cohesive policy.
                    </p>
                  )}
                  {regime === "taxi_private_hire" && taxiReadiness === "modules-disabled" && (
                    <p className="mt-3 font-bold text-[#8a4500]">
                      A taxi policy is active, but every taxi module is disabled.
                    </p>
                  )}
                </section>
              );
            })}
          </div>

          <PolicyManager
            defaultCouncilName={councilProfile.organisationName}
            taxiModulesEnabled={taxiModulesEnabled}
            policies={knownPolicies.map((policy) => ({
              id: policy.id,
              regime: policy.regime,
              title: policy.title,
              councilName: policy.councilName,
              versionLabel: policy.versionLabel,
              effectiveFrom: policy.effectiveFrom.toISOString(),
              effectiveTo: policy.effectiveTo?.toISOString() ?? null,
              isActive: policy.isActive,
              sourceFilename: policy.sourceFilename,
              searchable: policy._count.sections > 0,
              searchIndexTruncated: policy.searchIndexTruncated,
              searchableCharacters: policy.searchableCharacters,
              createdAt: policy.createdAt.toISOString(),
              uploaderName: policy.uploadedBy
                ? `${policy.uploadedBy.firstName} ${policy.uploadedBy.lastName}`
                : null,
              status: getPolicyLifecycleStatus(
                policy.isActive,
                historicalPolicyIds.has(policy.id),
              ),
            }))}
          />
        </div>
      </main>
      <GovFooter />
    </>
  );
}