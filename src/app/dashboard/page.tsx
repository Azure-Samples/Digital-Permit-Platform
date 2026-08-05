import Link from "next/link";
import { redirect } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { StatusTag } from "@/components/ui/status-tag";
import { getSessionOrNull } from "@/lib/permissions";
import { getApplicantApplications } from "@/lib/modules/applications";
import { formatDistanceToNow, format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ApplicantDashboard() {
  const session = await getSessionOrNull();
  if (!session) redirect("/auth/login?callbackUrl=/dashboard");

  // Staff users should use the staff dashboard
  const role = session.user.role;
  if (role === "REVIEWER" || role === "MANAGER" || role === "ADMIN") {
    redirect("/staff");
  }

  const applications = await getApplicantApplications(session.user.id);

  const drafts = applications.filter((a) => a.status === "DRAFT");
  const active = applications.filter(
    (a) =>
      !["DRAFT", "APPROVED", "REFUSED", "WITHDRAWN", "CANCELLED"].includes(
        a.status
      )
  );
  const completed = applications.filter((a) =>
    ["APPROVED", "REFUSED", "WITHDRAWN", "CANCELLED"].includes(a.status)
  );

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal"
        navigation={getNavigationForRole(session.user.role, "/dashboard")}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <h1>My applications</h1>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="stat-card">
              <div className="stat-card__value text-govuk-dark-grey">
                {drafts.length}
              </div>
              <div className="stat-card__label">Drafts</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value text-govuk-blue">
                {active.length}
              </div>
              <div className="stat-card__label">In progress</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value text-govuk-green">
                {completed.filter((a) => a.status === "APPROVED").length}
              </div>
              <div className="stat-card__label">Approved</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__value">
                {applications.length}
              </div>
              <div className="stat-card__label">Total</div>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2>Start a new application</h2>
            <Link href="/licences" className="govuk-button no-underline">
              Browse licences
            </Link>
          </div>

          {/* Drafts */}
          {drafts.length > 0 && (
            <section className="mb-8">
              <h2 className="border-b-2 border-govuk-blue pb-2">
                Draft applications ({drafts.length})
              </h2>
              <div className="space-y-3 mt-4">
                {drafts.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white border border-govuk-mid-grey p-4 flex flex-col sm:flex-row sm:items-center justify-between"
                  >
                    <div>
                      <Link
                        href={`/apply/${app.module.moduleKey}/${app.id}`}
                        className="font-bold"
                      >
                        {app.module.displayName}
                      </Link>
                      <p className="text-sm text-govuk-dark-grey">
                        Ref: {app.referenceNumber} · Started{" "}
                        {formatDistanceToNow(new Date(app.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-2 sm:mt-0">
                      <StatusTag status={app.status} />
                      <Link
                        href={`/apply/${app.module.moduleKey}/${app.id}`}
                        className="govuk-button govuk-button--secondary text-sm no-underline py-1 px-3"
                      >
                        Continue
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active applications */}
          {active.length > 0 && (
            <section className="mb-8">
              <h2 className="border-b-2 border-govuk-green pb-2">
                Active applications ({active.length})
              </h2>
              <div className="space-y-3 mt-4">
                {active.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white border border-govuk-mid-grey p-4 flex flex-col sm:flex-row sm:items-center justify-between"
                  >
                    <div>
                      <Link
                        href={`/dashboard/applications/${app.id}`}
                        className="font-bold"
                      >
                        {app.module.displayName}
                      </Link>
                      <p className="text-sm text-govuk-dark-grey">
                        Ref: {app.referenceNumber}
                        {app.submittedAt &&
                          ` · Submitted ${format(
                            new Date(app.submittedAt),
                            "d MMM yyyy"
                          )}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-2 sm:mt-0">
                      <StatusTag status={app.status} />
                      <Link
                        href={`/dashboard/applications/${app.id}`}
                        className="text-govuk-blue text-sm"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section className="mb-8">
              <h2 className="border-b-2 border-govuk-dark-grey pb-2">
                Completed applications ({completed.length})
              </h2>
              <div className="space-y-3 mt-4">
                {completed.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white border border-govuk-mid-grey p-4 flex flex-col sm:flex-row sm:items-center justify-between"
                  >
                    <div>
                      <Link
                        href={`/dashboard/applications/${app.id}`}
                        className="font-bold"
                      >
                        {app.module.displayName}
                      </Link>
                      <p className="text-sm text-govuk-dark-grey">
                        Ref: {app.referenceNumber}
                        {app.decidedAt &&
                          ` · Decision ${format(
                            new Date(app.decidedAt),
                            "d MMM yyyy"
                          )}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-2 sm:mt-0">
                      <StatusTag status={app.status} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {applications.length === 0 && (
            <div className="text-center py-12 bg-white border border-govuk-mid-grey">
              <h2 className="text-govuk-dark-grey">No applications yet</h2>
              <p className="text-govuk-dark-grey mb-6">
                Browse our licence catalogue to find the licence you need.
              </p>
              <Link href="/licences" className="govuk-button no-underline">
                Browse licences
              </Link>
            </div>
          )}
        </div>
      </main>

      <GovFooter />
    </>
  );
}
