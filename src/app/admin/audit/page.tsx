import Link from "next/link";
import { redirect } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { getAuditTrail } from "@/lib/audit";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    entity?: string;
    page?: string;
  }>;
}) {
  const session = await requireRole("ADMIN", "MANAGER").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/admin/audit");

  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const auditData = await getAuditTrail(
    {
      action: resolvedSearchParams.action || undefined,
      entityType: resolvedSearchParams.entity || undefined,
    },
    page,
    50
  );

  const nav = getNavigationForRole(session.user.role, "/admin/audit");

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal – Admin"
        navigation={nav}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <h1>Audit log</h1>
          <p className="text-govuk-dark-grey mb-6">
            Immutable record of all system actions. Showing {auditData.items.length} of {auditData.total} entries.
          </p>

          {/* Filters */}
          <form method="GET" action="/admin/audit" className="flex flex-wrap gap-3 mb-6">
            <div>
              <label className="govuk-label text-sm" htmlFor="action">Action</label>
              <input
                type="text"
                id="action"
                name="action"
                className="govuk-input text-sm"
                placeholder="e.g. application.submit"
                defaultValue={resolvedSearchParams.action}
              />
            </div>
            <div>
              <label className="govuk-label text-sm" htmlFor="entity">Entity type</label>
              <select id="entity" name="entity" className="govuk-select text-sm">
                <option value="">All</option>
                {["Application", "Document", "Payment", "User", "LicenceModule", "ModuleVersion"].map((e) => (
                  <option key={e} value={e} selected={resolvedSearchParams.entity === e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="self-end">
              <button type="submit" className="govuk-button text-sm">Filter</button>
            </div>
            <div className="self-end">
              <Link href="/admin/audit" className="govuk-button govuk-button--secondary text-sm no-underline">
                Clear
              </Link>
            </div>
          </form>

          {auditData.items.length === 0 ? (
            <div className="govuk-inset-text">No audit entries found.</div>
          ) : (
            <div className="bg-white border border-govuk-mid-grey overflow-x-auto">
              <table className="govuk-table">
                <thead>
                  <tr>
                    <th className="govuk-table__header">Time</th>
                    <th className="govuk-table__header">User</th>
                    <th className="govuk-table__header">Action</th>
                    <th className="govuk-table__header">Entity</th>
                    <th className="govuk-table__header">Entity ID</th>
                    <th className="govuk-table__header">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditData.items.map((entry) => (
                    <tr key={entry.id}>
                      <td className="govuk-table__cell text-xs whitespace-nowrap">
                        {format(new Date(entry.createdAt), "d MMM yyyy HH:mm:ss")}
                      </td>
                      <td className="govuk-table__cell text-sm">
                        {entry.user
                          ? `${entry.user.firstName} ${entry.user.lastName}`
                          : "System"}
                      </td>
                      <td className="govuk-table__cell">
                        <code className="text-xs bg-govuk-light-grey px-1 py-0.5">
                          {entry.action}
                        </code>
                      </td>
                      <td className="govuk-table__cell text-sm">
                        {entry.entityType}
                      </td>
                      <td className="govuk-table__cell font-mono text-xs">
                        {entry.entityId.substring(0, 8)}...
                      </td>
                      <td className="govuk-table__cell text-xs">
                        {entry.newValues && (
                          <details>
                            <summary className="cursor-pointer text-govuk-blue">View</summary>
                            <pre className="mt-1 text-xs max-w-xs overflow-auto bg-govuk-light-grey p-2">
                              {JSON.stringify(entry.newValues, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {auditData.pages > 1 && (
            <nav className="flex justify-between items-center mt-4" aria-label="Pagination">
              <span className="text-sm text-govuk-dark-grey">
                Page {auditData.page} of {auditData.pages}
              </span>
              <div className="flex gap-2">
                {auditData.page > 1 && (
                  <Link
                    href={`/admin/audit?${new URLSearchParams({ ...resolvedSearchParams, page: String(auditData.page - 1) })}`}
                    className="govuk-button govuk-button--secondary text-sm no-underline"
                  >
                    Previous
                  </Link>
                )}
                {auditData.page < auditData.pages && (
                  <Link
                    href={`/admin/audit?${new URLSearchParams({ ...resolvedSearchParams, page: String(auditData.page + 1) })}`}
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
