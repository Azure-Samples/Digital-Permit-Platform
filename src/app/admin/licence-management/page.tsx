import { redirect } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { getLicenceConfig } from "@/lib/licence-generator";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function saveConfigAction(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const defaultDurationYears = parseInt(formData.get("defaultDurationYears") as string, 10);
  const licenceNumberPrefix = formData.get("licenceNumberPrefix") as string;
  const templatePath = formData.get("templatePath") as string;

  await writeAuditLog({
    userId,
    action: "licence.config.set",
    entityType: "LicenceConfig",
    entityId: "global",
    newValues: {
      defaultDurationYears,
      licenceNumberPrefix,
      templatePath,
    },
  });

  redirect("/admin/licence-management");
}

export default async function LicenceManagementPage() {
  const session = await requireRole("ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/admin/licence-management");

  const config = await getLicenceConfig();

  // Get recent licence generations
  const recentLicences = await prisma.auditLog.findMany({
    where: { action: "licence.generate" },
    include: {
      user: { select: { firstName: true, lastName: true } },
      application: {
        select: { referenceNumber: true, module: { select: { displayName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const nav = getNavigationForRole(session.user.role, "/admin/licence-management");

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
          <h1>Licence management</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Configuration */}
            <section className="bg-white border border-govuk-mid-grey p-6">
              <h2>Licence configuration</h2>
              <p className="text-govuk-dark-grey text-sm mb-4">
                These settings control how licences are generated when
                applications are approved.
              </p>

              <form action={saveConfigAction}>
                <input type="hidden" name="userId" value={session.user.id} />

                <div className="govuk-form-group">
                  <label className="govuk-label" htmlFor="defaultDurationYears">
                    Default licence duration (years)
                  </label>
                  <p className="govuk-hint">
                    How many years a licence is valid from the date of issue
                  </p>
                  <input
                    type="number"
                    id="defaultDurationYears"
                    name="defaultDurationYears"
                    className="govuk-input max-w-[120px]"
                    defaultValue={config.defaultDurationYears}
                    min={1}
                    max={10}
                    required
                  />
                </div>

                <div className="govuk-form-group">
                  <label className="govuk-label" htmlFor="licenceNumberPrefix">
                    Licence number prefix
                  </label>
                  <p className="govuk-hint">
                    e.g. PHD for Private Hire Driver, HCD for Hackney Carriage
                    Driver
                  </p>
                  <input
                    type="text"
                    id="licenceNumberPrefix"
                    name="licenceNumberPrefix"
                    className="govuk-input max-w-[200px]"
                    defaultValue={config.licenceNumberPrefix}
                    required
                  />
                </div>

                <div className="govuk-form-group">
                  <label className="govuk-label" htmlFor="templatePath">
                    Template file path
                  </label>
                  <p className="govuk-hint">
                    Path to the DOCX template file relative to the project root.
                    Use placeholders: {"{{lic_no}}"}, {"{{commencement_date}}"},
                    {"{{expiry_date}}"}, {"{{lic_holder}}"},
                    {"{{lic_holder_address}}"}
                  </p>
                  <input
                    type="text"
                    id="templatePath"
                    name="templatePath"
                    className="govuk-input"
                    defaultValue={config.templatePath}
                    required
                  />
                </div>

                <button type="submit" className="govuk-button">
                  Save configuration
                </button>
              </form>
            </section>

            {/* Current settings summary */}
            <section className="bg-white border border-govuk-mid-grey p-6">
              <h2>Current settings</h2>
              <dl className="govuk-summary-list">
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Duration</dt>
                  <dd className="govuk-summary-list__value">
                    {config.defaultDurationYears} year
                    {config.defaultDurationYears !== 1 ? "s" : ""}
                  </dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Prefix</dt>
                  <dd className="govuk-summary-list__value font-mono">
                    {config.licenceNumberPrefix}
                  </dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Template</dt>
                  <dd className="govuk-summary-list__value text-sm">
                    {config.templatePath}
                  </dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Example number</dt>
                  <dd className="govuk-summary-list__value font-mono">
                    {config.licenceNumberPrefix}/{new Date().getFullYear()}/00001
                  </dd>
                </div>
              </dl>

              <h3 className="mt-6 text-govuk-m">Available template placeholders</h3>
              <ul className="text-sm space-y-1 mt-2">
                <li>
                  <code className="bg-govuk-light-grey px-1">{"{{lic_no}}"}</code>{" "}
                  – Unique licence number
                </li>
                <li>
                  <code className="bg-govuk-light-grey px-1">
                    {"{{commencement_date}}"}
                  </code>{" "}
                  – Start date (DD/MM/YYYY)
                </li>
                <li>
                  <code className="bg-govuk-light-grey px-1">
                    {"{{expiry_date}}"}
                  </code>{" "}
                  – Expiry date (DD/MM/YYYY)
                </li>
                <li>
                  <code className="bg-govuk-light-grey px-1">
                    {"{{lic_holder}}"}
                  </code>{" "}
                  – Full name from application
                </li>
                <li>
                  <code className="bg-govuk-light-grey px-1">
                    {"{{lic_holder_address}}"}
                  </code>{" "}
                  – Multi-line address
                </li>
              </ul>
            </section>
          </div>

          {/* Recent licence generations */}
          {recentLicences.length > 0 && (
            <section className="mt-8">
              <h2>Recently generated licences</h2>
              <div className="bg-white border border-govuk-mid-grey overflow-x-auto">
                <table className="govuk-table">
                  <thead>
                    <tr>
                      <th className="govuk-table__header">Date</th>
                      <th className="govuk-table__header">Reference</th>
                      <th className="govuk-table__header">Module</th>
                      <th className="govuk-table__header">Licence No.</th>
                      <th className="govuk-table__header">Generated by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLicences.map((log) => {
                      const vals = log.newValues as Record<string, unknown> | null;
                      return (
                        <tr key={log.id}>
                          <td className="govuk-table__cell text-sm">
                            {new Date(log.createdAt).toLocaleDateString("en-GB")}
                          </td>
                          <td className="govuk-table__cell text-sm font-mono">
                            {log.application?.referenceNumber ?? "—"}
                          </td>
                          <td className="govuk-table__cell text-sm">
                            {(log.application as any)?.module?.displayName ?? "—"}
                          </td>
                          <td className="govuk-table__cell text-sm font-mono">
                            {(vals?.licenceNumber as string) ?? "—"}
                          </td>
                          <td className="govuk-table__cell text-sm">
                            {log.user
                              ? `${log.user.firstName} ${log.user.lastName}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>

      <GovFooter />
    </>
  );
}
