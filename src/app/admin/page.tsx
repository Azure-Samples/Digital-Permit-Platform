import Link from "next/link";
import { redirect } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { getAllModules } from "@/lib/modules/registry";
import { AdminTour } from "@/components/tour/admin-tour";
import { TourLauncher } from "@/components/tour/tour-launcher";
import { prisma } from "@/lib/db";
import {
  getTaxiPolicyReadiness,
  isTaxiModule,
  TAXI_POLICY_REGIME,
} from "@/lib/policy/regimes";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await requireRole("ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/admin");

  const [modules, activeTaxiPolicy] = await Promise.all([
    getAllModules(),
    prisma.licensingPolicy.findFirst({
      where: { regime: TAXI_POLICY_REGIME, isActive: true },
      select: { id: true, title: true },
    }),
  ]);
  const taxiModulesEnabled = modules.some(
    (module) => module.enabled && isTaxiModule(module.category, module.moduleKey),
  );
  const taxiPolicyReadiness = getTaxiPolicyReadiness(
    taxiModulesEnabled,
    Boolean(activeTaxiPolicy),
  );

  // Group by category
  const grouped = modules.reduce<Record<string, typeof modules>>(
    (acc, mod) => {
      const cat = mod.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(mod);
      return acc;
    },
    {}
  );

  return (
    <>
      <AdminTour />
      <GovHeader
        serviceName="Licensing Portal – Admin"
        navigation={getNavigationForRole(session.user.role, "/admin")}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <div className="flex justify-between items-center mb-6">
            <h1>Module registry</h1>
            <div className="flex gap-3">
              <TourLauncher
                event="dpp:start-admin-tour"
                label="Take a tour"
                className="govuk-button govuk-button--secondary no-underline inline-flex items-center gap-2"
              />
              <Link
                id="admin-tour-create"
                href="/admin/modules/new"
                className="govuk-button no-underline"
              >
                Create module
              </Link>
            </div>
          </div>

          <p className="text-govuk-dark-grey mb-8 max-w-2xl">
            Manage licence modules. Each module defines a complete licence type
            with its form, documents, workflow, fees, and review checklist. Changes
            are versioned – historic applications retain their original module
            configuration.
          </p>

          {taxiPolicyReadiness === "policy-missing" && (
            <div className="mb-8 border-l-4 border-[#b35900] bg-[#fff7e6] p-4" role="status">
              <p className="font-bold">Taxi policy recommended</p>
              <p className="mb-2 text-sm">
                Taxi or private-hire modules are enabled, but no taxi and private hire
                licensing policy is active. DfT recommends a cohesive published policy;
                this is not the statutory Licensing Act 2003 statement.
              </p>
              <Link href="/staff/policy/manage#upload-policy" className="font-bold">
                Upload or activate a taxi policy
              </Link>
            </div>
          )}

          {taxiPolicyReadiness === "modules-disabled" && activeTaxiPolicy && (
            <div className="mb-8 border-l-4 border-[#b35900] bg-[#fff7e6] p-4" role="status">
              <p className="font-bold">Taxi policy active while services are disabled</p>
              <p className="mb-2 text-sm">
                {activeTaxiPolicy.title} is active, but all taxi and private-hire modules
                are disabled. Confirm whether the policy is retained for future use or
                enable the services the council provides.
              </p>
              <Link href="/staff/policy/manage" className="font-bold">
                Review licensing policies
              </Link>
            </div>
          )}

          {/* Summary stats */}
          <div id="admin-tour-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="stat-card">
              <div className="stat-card__value">{modules.length}</div>
              <div className="stat-card__label">Total modules</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value text-govuk-green">
                {modules.filter((m) => m.enabled).length}
              </div>
              <div className="stat-card__label">Enabled</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value text-govuk-dark-grey">
                {modules.filter((m) => !m.enabled).length}
              </div>
              <div className="stat-card__label">Disabled</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">
                {Object.keys(grouped).length}
              </div>
              <div className="stat-card__label">Categories</div>
            </div>
          </div>

          {/* Module listing by category */}
          {Object.entries(grouped).map(([category, mods]) => (
            <section
              key={category}
              id={
                category === Object.keys(grouped)[0]
                  ? "admin-tour-modules"
                  : category.toLowerCase() === "taxis and private hire"
                    ? "taxi-private-hire-modules"
                    : undefined
              }
              className="mb-8"
            >
              <h2 className="border-b-2 border-govuk-blue pb-2 mb-4">
                {category}
                <span className="text-govuk-dark-grey text-base font-normal ml-2">
                  ({mods.length} modules)
                </span>
              </h2>

              <div className="bg-white border border-govuk-mid-grey overflow-x-auto">
                <table className="govuk-table">
                  <thead>
                    <tr>
                      <th className="govuk-table__header">Module</th>
                      <th className="govuk-table__header">Key</th>
                      <th className="govuk-table__header">Status</th>
                      <th className="govuk-table__header">Visibility</th>
                      <th className="govuk-table__header">Version</th>
                      <th className="govuk-table__header">Applications</th>
                      <th className="govuk-table__header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mods.map((mod) => {
                      const latestVersion = mod.versions[0];
                      return (
                        <tr key={mod.id}>
                          <td className="govuk-table__cell font-bold">
                            {mod.displayName}
                          </td>
                          <td className="govuk-table__cell font-mono text-xs">
                            {mod.moduleKey}
                          </td>
                          <td className="govuk-table__cell">
                            <span
                              className={`govuk-tag text-xs ${
                                mod.enabled
                                  ? "govuk-tag--green"
                                  : "govuk-tag--grey"
                              }`}
                            >
                              {mod.enabled ? "Enabled" : "Disabled"}
                            </span>
                          </td>
                          <td className="govuk-table__cell text-sm">
                            {latestVersion?.visibility ?? "—"}
                          </td>
                          <td className="govuk-table__cell text-sm">
                            v{latestVersion?.version ?? 0}
                          </td>
                          <td className="govuk-table__cell text-sm">
                            {mod._count.applications}
                          </td>
                          <td className="govuk-table__cell">
                            <div className="flex gap-3">
                              <Link
                                id={mod.id === modules[0]?.id ? "admin-tour-edit" : undefined}
                                href={`/admin/modules/${mod.moduleKey}`}
                                className="text-sm"
                              >
                                Edit
                              </Link>
                              <form
                                action={`/api/admin/modules/${mod.id}/toggle`}
                                method="POST"
                              >
                                <button
                                  id={mod.id === modules[0]?.id ? "admin-tour-toggle" : undefined}
                                  type="submit"
                                  className="text-sm text-govuk-red underline"
                                >
                                  {mod.enabled ? "Disable" : "Enable"}
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </main>

      <GovFooter />
    </>
  );
}
