import Link from "next/link";
import { redirect } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { StatusTag } from "@/components/ui/status-tag";
import { SlaBadge, SlaAlert } from "@/components/ui/sla-badge";
import { requireRole } from "@/lib/permissions";
import { getStaffWorkQueue, getDashboardMetrics } from "@/lib/modules/applications";
import { computeApplicationSla, summariseSla } from "@/lib/sla";
import { getApplicantDisplayName } from "@/lib/applicant-name";

export const dynamic = "force-dynamic";

export default async function StaffDashboard() {
  const session = await requireRole("REVIEWER", "MANAGER", "ADMIN").catch(
    () => null
  );
  if (!session) redirect("/auth/login?callbackUrl=/staff");

  const [metrics, workQueue] = await Promise.all([
    getDashboardMetrics(session.user.teamId ?? undefined),
    getStaffWorkQueue({
      status: [
        "SUBMITTED",
        "UNDER_REVIEW",
        "AWAITING_INSPECTION",
        "AWAITING_CONSULTATION",
        "AWAITING_HEARING",
        "AWAITING_DOCUMENTS",
      ],
      page: 1,
      pageSize: 20,
    }),
  ]);

  const staffNav = getNavigationForRole(session.user.role, "/staff");

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal – Staff"
        navigation={staffNav}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <h1>Staff dashboard</h1>

          <SlaAlert {...summariseSla(workQueue.items)} />

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: "Submitted", value: metrics.submitted, color: "text-govuk-blue" },
              {
                label: "Under review",
                value: metrics.underReview,
                color: "text-purple-700",
              },
              {
                label: "Awaiting inspection",
                value: metrics.awaitingInspection,
                color: "text-orange-600",
              },
              {
                label: "Awaiting consultation",
                value: metrics.awaitingConsultation,
                color: "text-orange-600",
              },
              {
                label: "Approved",
                value: metrics.approved,
                color: "text-govuk-green",
              },
              {
                label: "Refused",
                value: metrics.refused,
                color: "text-govuk-red",
              },
              {
                label: "Drafts",
                value: metrics.draft,
                color: "text-govuk-dark-grey",
              },
              {
                label: "Awaiting hearing",
                value: metrics.awaitingHearing,
                color: "text-orange-600",
              },
              { label: "Total", value: metrics.total, color: "" },
            ].map((stat) => (
              <div key={stat.label} className="stat-card">
                <div className={`stat-card__value ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="stat-card__label">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Recent submissions */}
          <h2>Recent submissions</h2>
          {workQueue.items.length === 0 ? (
            <p className="text-govuk-dark-grey">No applications in the queue.</p>
          ) : (
            <div className="bg-white border border-govuk-mid-grey overflow-x-auto">
              <table className="govuk-table">
                <thead>
                  <tr>
                    <th className="govuk-table__header">Reference</th>
                    <th className="govuk-table__header">Licence type</th>
                    <th className="govuk-table__header">Applicant</th>
                    <th className="govuk-table__header">Status</th>
                    <th className="govuk-table__header">SLA</th>
                    <th className="govuk-table__header">Assigned to</th>
                    <th className="govuk-table__header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workQueue.items.map((app) => (
                    <tr key={app.id}>
                      <td className="govuk-table__cell font-mono text-sm">
                        {app.referenceNumber}
                      </td>
                      <td className="govuk-table__cell">
                        {app.module.displayName}
                      </td>
                      <td className="govuk-table__cell">
                        {getApplicantDisplayName(app.answers as Record<string, unknown>, app.applicant.firstName, app.applicant.lastName)}
                      </td>
                      <td className="govuk-table__cell">
                        <StatusTag status={app.status} />
                      </td>
                      <td className="govuk-table__cell">
                        <SlaBadge sla={computeApplicationSla(app)} />
                      </td>
                      <td className="govuk-table__cell">
                        {app.assignedOfficer
                          ? `${app.assignedOfficer.firstName} ${app.assignedOfficer.lastName}`
                          : "—"}
                      </td>
                      <td className="govuk-table__cell">
                        <Link
                          href={`/staff/cases/${app.id}`}
                          className="text-sm"
                        >
                          View case
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {workQueue.pages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-govuk-dark-grey">
                Showing {workQueue.items.length} of {workQueue.total}
              </span>
              <Link href="/staff/queue" className="text-sm">
                View all →
              </Link>
            </div>
          )}
        </div>
      </main>

      <GovFooter />
    </>
  );
}
