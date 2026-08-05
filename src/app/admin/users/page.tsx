
import { redirect } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await requireRole("ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/admin/users");

  const users = await prisma.user.findMany({
    include: {
      team: { select: { name: true } },
      _count: { select: { applications: true } },
    },
    orderBy: [{ role: "asc" }, { lastName: "asc" }],
  });

  const nav = getNavigationForRole(session.user.role, "/admin/users");

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
          <div className="flex justify-between items-center mb-6">
            <h1>Users</h1>
            <span className="text-govuk-dark-grey">{users.length} users</span>
          </div>

          <div className="bg-white border border-govuk-mid-grey overflow-x-auto">
            <table className="govuk-table">
              <thead>
                <tr>
                  <th className="govuk-table__header">Name</th>
                  <th className="govuk-table__header">Email</th>
                  <th className="govuk-table__header">Role</th>
                  <th className="govuk-table__header">Team</th>
                  <th className="govuk-table__header">Applications</th>
                  <th className="govuk-table__header">Status</th>
                  <th className="govuk-table__header">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="govuk-table__cell font-bold">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="govuk-table__cell text-sm">
                      {user.email}
                    </td>
                    <td className="govuk-table__cell">
                      <span
                        className={`govuk-tag text-xs ${
                          user.role === "ADMIN"
                            ? "govuk-tag--red"
                            : user.role === "MANAGER"
                            ? "govuk-tag--purple"
                            : user.role === "REVIEWER"
                            ? ""
                            : "govuk-tag--grey"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="govuk-table__cell text-sm">
                      {user.team?.name ?? "—"}
                    </td>
                    <td className="govuk-table__cell text-sm">
                      {user._count.applications}
                    </td>
                    <td className="govuk-table__cell">
                      <span
                        className={`govuk-tag text-xs ${
                          user.active ? "govuk-tag--green" : "govuk-tag--grey"
                        }`}
                      >
                        {user.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="govuk-table__cell text-sm">
                      {new Date(user.createdAt).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <GovFooter />
    </>
  );
}
