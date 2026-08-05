import Link from "next/link";
import { notFound, } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { getModuleByKey } from "@/lib/modules/registry";
import { getSessionOrNull } from "@/lib/permissions";
import type { DocumentRequirement, FormSection } from "@/types/module";

export const dynamic = "force-dynamic";

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ moduleKey: string }>;
}) {
  const resolvedParams = await params;
  const module = await getModuleByKey(resolvedParams.moduleKey);
  if (!module) return notFound();

  const session = await getSessionOrNull();
  const version = module.activeVersion;
  const feeSchedule = version.feeSchedule;

  // Resolve fee display
  let feeDisplay = "No fee";
  if (feeSchedule) {
    const fees = Object.entries(feeSchedule);
    if (fees.length === 1) {
      const val = fees[0][1];
      feeDisplay = `£${typeof val === "number" ? val.toFixed(2) : (val as any).baseAmount?.toFixed(2) ?? "TBC"}`;
    } else {
      feeDisplay = fees
        .map(([type, val]) => {
          const amount = typeof val === "number" ? val : (val as any).baseAmount;
          return `${type}: £${amount?.toFixed(2) ?? "TBC"}`;
        })
        .join(" | ");
    }
  }

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal"
        navigation={getNavigationForRole(session?.user?.role, `/licences/${resolvedParams.moduleKey}`)}
        userName={session?.user?.name}
        userRole={session?.user?.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <nav className="govuk-breadcrumbs mb-4">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/">Home</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/licences">All licences</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">
                {module.displayName}
              </li>
            </ol>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2">
              <span className="govuk-tag mb-3">{module.category}</span>
              <h1 className="mt-2">{module.displayName}</h1>

              {version.publicDescription && (
                <div className="govuk-inset-text text-lg">
                  {version.publicDescription}
                </div>
              )}

              {/* Before you start */}
              {version.beforeYouStartText && (
                <section className="mb-8">
                  <h2>Before you start</h2>
                  <div className="bg-white border border-govuk-mid-grey p-6">
                    <p className="whitespace-pre-line">
                      {version.beforeYouStartText}
                    </p>
                  </div>
                </section>
              )}

              {/* What you&apos;ll need */}
              <section className="mb-8">
                <h2>What you&apos;ll need</h2>

                {/* Documents */}
                {version.documentRequirements.length > 0 && (
                  <div className="mb-6">
                    <h3>Documents and evidence</h3>
                    <ul className="list-none space-y-2">
                      {version.documentRequirements.map(
                        (doc: DocumentRequirement) => (
                          <li
                            key={doc.key}
                            className="flex items-start gap-2"
                          >
                            <span
                              className={`mt-1 ${
                                doc.required
                                  ? "text-govuk-red"
                                  : "text-govuk-dark-grey"
                              }`}
                            >
                              {doc.required ? "●" : "○"}
                            </span>
                            <div>
                              <span className="font-bold">{doc.label}</span>
                              {doc.required && (
                                <span className="text-govuk-red text-sm ml-1">
                                  (required)
                                </span>
                              )}
                              {doc.description && (
                                <p className="text-sm text-govuk-dark-grey">
                                  {doc.description}
                                </p>
                              )}
                            </div>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

                {/* Forms overview */}
                {version.formSchema.length > 0 && (
                  <div className="mb-6">
                    <h3>Application sections</h3>
                    <ol className="list-decimal ml-6 space-y-1">
                      {version.formSchema.map((section: FormSection) => (
                        <li key={section.key}>
                          {section.title}
                          {section.description && (
                            <span className="text-govuk-dark-grey text-sm ml-1">
                              – {section.description}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </section>

              {/* Apply button */}
              {version.acceptingApplications ? (
                <div className="bg-govuk-light-grey p-6 border-l-4 border-govuk-green">
                  <h2 className="mb-2">Ready to apply?</h2>
                  <p className="mb-4 text-govuk-dark-grey">
                    You&apos;ll need to sign in or create an account to start
                    your application.
                  </p>
                  {session ? (
                    <form action={`/api/applications/create`} method="POST">
                      <input
                        type="hidden"
                        name="moduleKey"
                        value={module.moduleKey}
                      />
                      <input
                        type="hidden"
                        name="applicationType"
                        value="new"
                      />
                      <Link
                        href={`/apply/${module.moduleKey}/new`}
                        className="govuk-button govuk-button--start no-underline"
                      >
                        Start application
                      </Link>
                    </form>
                  ) : (
                    <Link
                      href={`/auth/login?callbackUrl=/licences/${module.moduleKey}`}
                      className="govuk-button govuk-button--start no-underline"
                    >
                      Sign in to apply
                    </Link>
                  )}
                </div>
              ) : (
                <div className="govuk-warning-text">
                  <strong>
                    This licence is not currently accepting online applications.
                  </strong>
                  <p className="mt-2">
                    Please contact the licensing team for more information.
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-1">
              <div className="bg-white border border-govuk-mid-grey p-4 mb-4">
                <h3 className="text-govuk-m mb-3">Key details</h3>
                <dl className="govuk-summary-list">
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key">Fee</dt>
                    <dd className="govuk-summary-list__value font-bold">
                      {feeDisplay}
                    </dd>
                  </div>
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key">Category</dt>
                    <dd className="govuk-summary-list__value">
                      {module.category}
                    </dd>
                  </div>
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key">Payment</dt>
                    <dd className="govuk-summary-list__value">
                      {version.paymentMode === "NO_FEE"
                        ? "No fee required"
                        : version.paymentMode === "EXTERNAL_REDIRECT"
                        ? "Online payment"
                        : version.paymentMode === "RECEIPT_UPLOAD"
                        ? "Upload receipt"
                        : "Payment reference"}
                    </dd>
                  </div>
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key">Application types</dt>
                    <dd className="govuk-summary-list__value">
                      {version.applicationTypes
                        .map(
                          (t: string) =>
                            t.charAt(0).toUpperCase() + t.slice(1)
                        )
                        .join(", ")}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-white border border-govuk-mid-grey p-4">
                <h3 className="text-govuk-m mb-3">Need help?</h3>
                <p className="text-sm text-govuk-dark-grey mb-3">
                  Contact the licensing team if you need assistance with your
                  application.
                </p>
                <p className="text-sm">
                  📧{" "}
                  <Link href="mailto:licensing@contoso.gov.uk">
                    licensing@contoso.gov.uk
                  </Link>
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <GovFooter />
    </>
  );
}
