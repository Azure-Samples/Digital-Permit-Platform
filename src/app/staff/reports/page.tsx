import Link from "next/link";
import { redirect } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getApplicantDisplayName } from "@/lib/applicant-name";

export const dynamic = "force-dynamic";

export default async function StaffReportsPage() {
  const session = await requireRole("MANAGER", "ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/staff/reports");

  // Gather report data
  const [
    totalApplications,
    byStatus,
    byModule,
    _byMonth,
    recentDecisions,
  ] = await Promise.all([
    prisma.application.count(),
    prisma.application.groupBy({
      by: ["status"],
      _count: true,
      orderBy: { _count: { status: "desc" } },
    }),
    prisma.application.groupBy({
      by: ["moduleId"],
      _count: true,
      orderBy: { _count: { moduleId: "desc" } },
      take: 15,
    }),
    prisma.application.groupBy({
      by: ["submittedAt"],
      _count: true,
      where: { submittedAt: { not: null } },
    }),
    prisma.application.findMany({
      where: { decidedAt: { not: null } },
      include: {
        module: { select: { displayName: true } },
        applicant: { select: { firstName: true, lastName: true } },
      },
      orderBy: { decidedAt: "desc" },
      take: 10,
    }),
  ]);

  // Get module names for the by-module report
  const moduleIds = byModule.map((m) => m.moduleId);
  const modules = await prisma.licenceModule.findMany({
    where: { id: { in: moduleIds } },
    select: { id: true, displayName: true, category: true },
  });
  const moduleMap = Object.fromEntries(modules.map((m) => [m.id, m]));

  const nav = getNavigationForRole(session.user.role, "/staff/reports");

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal – Staff"
        navigation={nav}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <h1>Reports</h1>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="stat-card">
              <div className="stat-card__value">{totalApplications}</div>
              <div className="stat-card__label">Total applications</div>
            </div>
            {byStatus.slice(0, 3).map((s) => (
              <div key={s.status} className="stat-card">
                <div className="stat-card__value">{s._count}</div>
                <div className="stat-card__label">
                  {s.status.replace(/_/g, " ")}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Applications by status */}
            <section className="bg-white border border-govuk-mid-grey p-6">
              <h2>Applications by status</h2>
              <table className="govuk-table">
                <thead>
                  <tr>
                    <th className="govuk-table__header">Status</th>
                    <th className="govuk-table__header text-right">Count</th>
                    <th className="govuk-table__header text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {byStatus.map((s) => (
                    <tr key={s.status}>
                      <td className="govuk-table__cell text-sm">
                        {s.status.replace(/_/g, " ")}
                      </td>
                      <td className="govuk-table__cell text-sm text-right font-bold">
                        {s._count}
                      </td>
                      <td className="govuk-table__cell text-sm text-right">
                        {totalApplications > 0
                          ? ((s._count / totalApplications) * 100).toFixed(1)
                          : 0}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Applications by module */}
            <section className="bg-white border border-govuk-mid-grey p-6">
              <h2>Applications by licence type</h2>
              <table className="govuk-table">
                <thead>
                  <tr>
                    <th className="govuk-table__header">Licence</th>
                    <th className="govuk-table__header text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {byModule.map((m) => {
                    const mod = moduleMap[m.moduleId];
                    return (
                      <tr key={m.moduleId}>
                        <td className="govuk-table__cell text-sm">
                          {mod?.displayName ?? m.moduleId}
                          {mod?.category && (
                            <span className="text-govuk-dark-grey text-xs ml-1">
                              ({mod.category})
                            </span>
                          )}
                        </td>
                        <td className="govuk-table__cell text-sm text-right font-bold">
                          {m._count}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>

          {/* Recent decisions */}
          {recentDecisions.length > 0 && (
            <section className="bg-white border border-govuk-mid-grey p-6 mb-8">
              <h2>Recent decisions</h2>
              <table className="govuk-table">
                <thead>
                  <tr>
                    <th className="govuk-table__header">Reference</th>
                    <th className="govuk-table__header">Licence</th>
                    <th className="govuk-table__header">Applicant</th>
                    <th className="govuk-table__header">Outcome</th>
                    <th className="govuk-table__header">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDecisions.map((d) => (
                    <tr key={d.id}>
                      <td className="govuk-table__cell font-mono text-sm">
                        <Link href={`/staff/cases/${d.id}`}>
                          {d.referenceNumber}
                        </Link>
                      </td>
                      <td className="govuk-table__cell text-sm">
                        {d.module.displayName}
                      </td>
                      <td className="govuk-table__cell text-sm">
                        {getApplicantDisplayName(d.answers as Record<string, unknown>, d.applicant.firstName, d.applicant.lastName)}
                      </td>
                      <td className="govuk-table__cell">
                        <span
                          className={`govuk-tag text-xs ${
                            d.decisionOutcome === "approved"
                              ? "govuk-tag--green"
                              : d.decisionOutcome === "refused"
                              ? "govuk-tag--red"
                              : "govuk-tag--grey"
                          }`}
                        >
                          {d.decisionOutcome ?? "—"}
                        </span>
                      </td>
                      <td className="govuk-table__cell text-sm">
                        {d.decidedAt
                          ? new Date(d.decidedAt).toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </main>

      <GovFooter />
    </>
  );
}
