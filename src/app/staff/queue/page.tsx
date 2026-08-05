import Link from "next/link";
import { redirect } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { StatusTag } from "@/components/ui/status-tag";
import { SlaBadge } from "@/components/ui/sla-badge";
import { requireRole } from "@/lib/permissions";
import { getStaffWorkQueue } from "@/lib/modules/applications";
import { computeApplicationSla } from "@/lib/sla";
import { getApplicantDisplayName } from "@/lib/applicant-name";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import type { ApplicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function WorkQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    module?: string;
    assigned?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const session = await requireRole("REVIEWER", "MANAGER", "ADMIN").catch(
    () => null
  );
  if (!session) redirect("/auth/login?callbackUrl=/staff/queue");

  const resolvedSearchParams = await searchParams;
  const modules = await prisma.licenceModule.findMany({
    where: { enabled: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: { id: true, moduleKey: true, displayName: true, category: true },
  });

  const officers = await prisma.user.findMany({
    where: { role: { in: ["REVIEWER", "MANAGER", "ADMIN"] } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  // Parse filters
  const statusFilter = resolvedSearchParams.status
    ? (resolvedSearchParams.status.split(",") as ApplicationStatus[])
    : undefined;
  const page = parseInt(resolvedSearchParams.page || "1", 10);

  const workQueue = await getStaffWorkQueue({
    status: statusFilter,
    moduleId: resolvedSearchParams.module || undefined,
    assignedOfficerId: resolvedSearchParams.assigned || undefined,
    search: resolvedSearchParams.search || undefined,
    page,
    pageSize: 25,
  });

  const nav = getNavigationForRole(session.user.role, "/staff/queue");

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
          <h1>Work queue</h1>

          {/* Filters */}
          <form method="GET" action="/staff/queue" className="bg-white border border-govuk-mid-grey p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="govuk-label text-sm" htmlFor="status">Status</label>
                <select id="status" name="status" className="govuk-select text-sm">
                  <option value="">All statuses</option>
                  {[
                    "SUBMITTED",
                    "UNDER_REVIEW",
                    "AWAITING_DOCUMENTS",
                    "AWAITING_INSPECTION",
                    "AWAITING_CONSULTATION",
                    "AWAITING_HEARING",
                    "APPROVED",
                    "REFUSED",
                  ].map((s) => (
                    <option key={s} value={s} selected={resolvedSearchParams.status === s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="govuk-label text-sm" htmlFor="module">Module</label>
                <select id="module" name="module" className="govuk-select text-sm">
                  <option value="">All modules</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id} selected={resolvedSearchParams.module === m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="govuk-label text-sm" htmlFor="assigned">Assigned to</label>
                <select id="assigned" name="assigned" className="govuk-select text-sm">
                  <option value="">Anyone</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id} selected={resolvedSearchParams.assigned === o.id}>
                      {o.firstName} {o.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="govuk-label text-sm" htmlFor="search">Search</label>
                <input
                  type="text"
                  id="search"
                  name="search"
                  className="govuk-input text-sm"
                  placeholder="Reference, name, email..."
                  defaultValue={resolvedSearchParams.search}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="submit" className="govuk-button text-sm">Apply filters</button>
              <Link href="/staff/queue" className="govuk-button govuk-button--secondary text-sm no-underline">
                Clear
              </Link>
            </div>
          </form>

          {/* Results */}
          <p className="text-sm text-govuk-dark-grey mb-3">
            Showing {workQueue.items.length} of {workQueue.total} applications
          </p>

          {workQueue.items.length === 0 ? (
            <div className="govuk-inset-text">
              No applications match your filters.
            </div>
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
                    <th className="govuk-table__header">Submitted</th>
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
                      <td className="govuk-table__cell text-sm">
                        {app.module.displayName}
                      </td>
                      <td className="govuk-table__cell text-sm">
                        {getApplicantDisplayName(app.answers as Record<string, unknown>, app.applicant.firstName, app.applicant.lastName)}
                        <br />
                        <span className="text-govuk-dark-grey text-xs">
                          {app.applicant.email}
                        </span>
                      </td>
                      <td className="govuk-table__cell">
                        <StatusTag status={app.status} />
                      </td>
                      <td className="govuk-table__cell">
                        <SlaBadge sla={computeApplicationSla(app)} />
                      </td>
                      <td className="govuk-table__cell text-sm">
                        {app.submittedAt
                          ? format(new Date(app.submittedAt), "d MMM yyyy")
                          : "—"}
                      </td>
                      <td className="govuk-table__cell text-sm">
                        {app.assignedOfficer
                          ? `${app.assignedOfficer.firstName} ${app.assignedOfficer.lastName}`
                          : "Unassigned"}
                      </td>
                      <td className="govuk-table__cell">
                        <Link href={`/staff/cases/${app.id}`} className="text-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {workQueue.pages > 1 && (
            <nav className="flex justify-between items-center mt-4" aria-label="Pagination">
              <span className="text-sm text-govuk-dark-grey">
                Page {workQueue.page} of {workQueue.pages}
              </span>
              <div className="flex gap-2">
                {workQueue.page > 1 && (
                  <Link
                    href={`/staff/queue?${new URLSearchParams({ ...resolvedSearchParams, page: String(workQueue.page - 1) })}`}
                    className="govuk-button govuk-button--secondary text-sm no-underline"
                  >
                    Previous
                  </Link>
                )}
                {workQueue.page < workQueue.pages && (
                  <Link
                    href={`/staff/queue?${new URLSearchParams({ ...resolvedSearchParams, page: String(workQueue.page + 1) })}`}
                    className="govuk-button govuk-button--secondary text-sm no-underline"
                  >
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </div>
      </main>

      <GovFooter />
    </>
  );
}
