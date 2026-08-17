import { redirect } from "next/navigation";
import { LicenceTemplateManager } from "@/components/admin/licence-template-manager";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getLicenceConfig } from "@/lib/licence-generator";
import { getApplicationTemplatePlaceholders } from "@/lib/licence-templates";
import { requireRole } from "@/lib/permissions";
import type { FormSection } from "@/types/module";

export const dynamic = "force-dynamic";

async function saveGenerationSettingsAction(formData: FormData) {
  "use server";
  const session = await requireRole("ADMIN");
  const defaultDurationYears = Number.parseInt(
    String(formData.get("defaultDurationYears")),
    10,
  );
  const licenceNumberPrefix = String(
    formData.get("licenceNumberPrefix") ?? "",
  )
    .trim()
    .toUpperCase();

  if (
    !Number.isInteger(defaultDurationYears) ||
    defaultDurationYears < 1 ||
    defaultDurationYears > 10 ||
    !/^[A-Z0-9-]{1,12}$/.test(licenceNumberPrefix)
  ) {
    redirect("/admin/licence-management?settings=invalid");
  }

  await writeAuditLog({
    userId: session.user.id,
    action: "licence.config.set",
    entityType: "LicenceConfig",
    entityId: "global",
    newValues: {
      defaultDurationYears,
      licenceNumberPrefix,
    },
  });

  redirect("/admin/licence-management?settings=saved");
}

export default async function LicenceManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ settings?: string }>;
}) {
  const session = await requireRole("ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/admin/licence-management");

  const [config, modules, templates, recentLicences] = await Promise.all([
    getLicenceConfig(),
    prisma.licenceModule.findMany({
      orderBy: [
        { category: "asc" },
        { sortOrder: "asc" },
        { displayName: "asc" },
      ],
      select: {
        id: true,
        moduleKey: true,
        displayName: true,
        category: true,
        enabled: true,
        versions: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 1,
          select: { formSchema: true },
        },
      },
    }),
    prisma.licenceTemplate.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        originalFilename: true,
        fileSizeBytes: true,
        placeholders: true,
        createdAt: true,
        uploadedBy: { select: { firstName: true, lastName: true } },
        assignments: {
          orderBy: { module: { displayName: "asc" } },
          select: {
            moduleId: true,
            module: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: { action: "licence.generate" },
      include: {
        user: { select: { firstName: true, lastName: true } },
        application: {
          select: {
            referenceNumber: true,
            module: { select: { displayName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const resolvedSearchParams = await searchParams;
  const nav = getNavigationForRole(session.user.role, "/admin/licence-management");

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal - Admin"
        navigation={nav}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <span className="text-sm font-bold uppercase text-govuk-dark-grey">
            Document generation
          </span>
          <h1 className="mt-1 mb-3">Licence templates</h1>
          <p className="max-w-3xl text-lg text-govuk-dark-grey">
            Manage the Word documents staff use when issuing licences and permits.
            Assign a tailored template to one licence type or reuse it across several.
          </p>

          <LicenceTemplateManager
            modules={modules.map((module) => ({
              id: module.id,
              moduleKey: module.moduleKey,
              displayName: module.displayName,
              category: module.category,
              enabled: module.enabled,
              applicationFields: getApplicationTemplatePlaceholders(
                (module.versions[0]?.formSchema as unknown as FormSection[]) ?? [],
              ),
            }))}
            templates={templates.map((template) => ({
              id: template.id,
              name: template.name,
              description: template.description,
              originalFilename: template.originalFilename,
              fileSizeBytes: template.fileSizeBytes,
              placeholders: template.placeholders,
              createdAt: template.createdAt.toISOString(),
              uploaderName: template.uploadedBy
                ? `${template.uploadedBy.firstName} ${template.uploadedBy.lastName}`
                : null,
              assignments: template.assignments.map((assignment) => ({
                moduleId: assignment.moduleId,
                moduleName: assignment.module.displayName,
              })),
            }))}
          />

          <section
            className="border-t-2 border-govuk-black mt-12 pt-8"
            aria-labelledby="generation-settings-title"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div>
                <h2 id="generation-settings-title">Generation settings</h2>
                <p className="text-govuk-dark-grey">
                  These defaults apply when a staff member generates a licence document.
                </p>

                {resolvedSearchParams.settings === "saved" && (
                  <div className="govuk-notification-banner" role="status">
                    <div className="govuk-notification-banner__content">
                      <p className="font-bold mb-0">Generation settings saved.</p>
                    </div>
                  </div>
                )}
                {resolvedSearchParams.settings === "invalid" && (
                  <div className="govuk-error-summary" role="alert">
                    <h3 className="govuk-error-summary__title">
                      Settings were not saved
                    </h3>
                    <div className="govuk-error-summary__body">
                      Use a duration from 1 to 10 years and a prefix of up to 12
                      letters, numbers, or hyphens.
                    </div>
                  </div>
                )}

                <form action={saveGenerationSettingsAction} className="max-w-xl">
                  <div className="govuk-form-group">
                    <label
                      className="govuk-label font-bold"
                      htmlFor="defaultDurationYears"
                    >
                      Default licence duration (years)
                    </label>
                    <p className="govuk-hint">Used to calculate the expiry date.</p>
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
                    <label
                      className="govuk-label font-bold"
                      htmlFor="licenceNumberPrefix"
                    >
                      Licence number prefix
                    </label>
                    <p className="govuk-hint">
                      For example, PHD for Private Hire Driver.
                    </p>
                    <input
                      type="text"
                      id="licenceNumberPrefix"
                      name="licenceNumberPrefix"
                      className="govuk-input max-w-[220px] uppercase"
                      defaultValue={config.licenceNumberPrefix}
                      maxLength={12}
                      pattern="[A-Za-z0-9-]+"
                      required
                    />
                  </div>

                  <button type="submit" className="govuk-button">
                    Save generation settings
                  </button>
                </form>
              </div>

              <div>
                <h2>Current numbering</h2>
                <dl className="govuk-summary-list">
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key">Duration</dt>
                    <dd className="govuk-summary-list__value">
                      {config.defaultDurationYears} year
                      {config.defaultDurationYears === 1 ? "" : "s"}
                    </dd>
                  </div>
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key">Prefix</dt>
                    <dd className="govuk-summary-list__value font-mono">
                      {config.licenceNumberPrefix}
                    </dd>
                  </div>
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key">Example</dt>
                    <dd className="govuk-summary-list__value font-mono">
                      {config.licenceNumberPrefix}/{new Date().getFullYear()}/00001
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {recentLicences.length > 0 && (
            <section
              className="border-t border-govuk-mid-grey mt-10 pt-8"
              aria-labelledby="recent-licences-title"
            >
              <h2 id="recent-licences-title">Recently generated licences</h2>
              <div className="overflow-x-auto">
                <table className="govuk-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Licence type</th>
                      <th>Licence number</th>
                      <th>Generated by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLicences.map((log) => {
                      const values = log.newValues as Record<string, unknown> | null;
                      return (
                        <tr key={log.id}>
                          <td className="text-sm">
                            {log.createdAt.toLocaleDateString("en-GB")}
                          </td>
                          <td className="text-sm font-mono">
                            {log.application?.referenceNumber ?? "-"}
                          </td>
                          <td className="text-sm">
                            {log.application?.module.displayName ?? "-"}
                          </td>
                          <td className="text-sm font-mono">
                            {String(values?.licenceNumber ?? "-")}
                          </td>
                          <td className="text-sm">
                            {log.user
                              ? `${log.user.firstName} ${log.user.lastName}`
                              : "-"}
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