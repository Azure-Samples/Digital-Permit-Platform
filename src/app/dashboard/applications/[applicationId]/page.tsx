import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { StatusTag } from "@/components/ui/status-tag";
import { getSessionOrNull } from "@/lib/permissions";
import { formatAnswerValue } from "@/lib/format";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import type { FormSection, DocumentRequirement, WorkflowStage } from "@/types/module";

export const dynamic = "force-dynamic";

export default async function ApplicantApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const session = await getSessionOrNull();
  if (!session) redirect("/auth/login");

  const resolvedParams = await params;
  const app = await prisma.application.findUnique({
    where: { id: resolvedParams.applicationId },
    include: {
      module: true,
      moduleVersion: true,
      documents: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      workflowEvents: { orderBy: { createdAt: "asc" } },
      messages: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!app) return notFound();
  if (app.applicantId !== session.user.id) return notFound();

  const formSchema = (app.moduleVersion.formSchema as unknown as FormSection[]) ?? [];
  const docRequirements = (app.moduleVersion.documentRequirements as unknown as DocumentRequirement[]) ?? [];
  const workflowDef = (app.moduleVersion.workflowDefinition as unknown as WorkflowStage[]) ?? [];
  const answers = (app.answers as Record<string, unknown>) ?? {};

  const nav = getNavigationForRole(session.user.role, "/dashboard");

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal"
        navigation={nav}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <nav className="govuk-breadcrumbs mb-4">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/dashboard">My applications</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">
                {app.referenceNumber}
              </li>
            </ol>
          </nav>

          <div className="flex flex-wrap justify-between items-start mb-6">
            <div>
              <h1 className="mt-1">{app.module.displayName}</h1>
              <p className="text-govuk-dark-grey">
                Ref: {app.referenceNumber} · Type:{" "}
                {app.applicationType.charAt(0).toUpperCase() + app.applicationType.slice(1)}
              </p>
            </div>
            <StatusTag status={app.status} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Status banner */}
              {app.status === "APPROVED" && (
                <div className="govuk-panel bg-govuk-green text-white p-6">
                  <h2 className="text-white text-xl mb-1">Application approved</h2>
                  <p>Your application has been approved.</p>
                  {app.expiresAt && (
                    <p className="mt-1">Licence expires: {format(new Date(app.expiresAt), "d MMM yyyy")}</p>
                  )}
                </div>
              )}

              {app.status === "REFUSED" && (
                <div className="bg-red-50 border-l-4 border-govuk-red p-6">
                  <h2 className="text-govuk-red">Application refused</h2>
                  {app.decisionReason && <p className="mt-2">{app.decisionReason}</p>}
                </div>
              )}

              {/* Application answers */}
              <section className="bg-white border border-govuk-mid-grey p-6">
                <h2>Your application</h2>
                {formSchema.map((section) => {
                  const sectionAnswers = (answers[section.key] as Record<string, unknown>) ?? {};
                  return (
                    <div key={section.key} className="mb-6">
                      <h3 className="border-b border-govuk-mid-grey pb-2 mb-3">
                        {section.title}
                      </h3>
                      <dl className="govuk-summary-list">
                        {section.fields.map((f) => {
                          const val = sectionAnswers[f.key];
                          if (val === undefined || val === null || val === "") return null;
                          return (
                            <div key={f.key} className="govuk-summary-list__row">
                              <dt className="govuk-summary-list__key">{f.label}</dt>
                              <dd className="govuk-summary-list__value">
                                {formatAnswerValue(val, f.key)}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </div>
                  );
                })}
              </section>

              {/* Documents */}
              <section className="bg-white border border-govuk-mid-grey p-6">
                <h2>Documents ({app.documents.length})</h2>
                {app.documents.length === 0 ? (
                  <p className="text-govuk-dark-grey">No documents uploaded.</p>
                ) : (
                  <div className="space-y-3">
                    {app.documents.map((doc) => {
                      const req = docRequirements.find((r) => r.key === doc.requirementKey);
                      return (
                        <div key={doc.id} className="flex items-center justify-between border-b border-govuk-mid-grey pb-2">
                          <div>
                            <p className="font-bold text-sm">{req?.label ?? doc.requirementKey}</p>
                            <p className="text-sm text-govuk-dark-grey">
                              {doc.originalFilename} · {(doc.fileSizeBytes / 1024).toFixed(0)}KB
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`govuk-tag text-xs ${
                              doc.status === "VERIFIED" ? "govuk-tag--green"
                              : doc.status === "REJECTED" ? "govuk-tag--red"
                              : "govuk-tag--grey"
                            }`}>
                              {doc.status === "UPLOADED" ? "Received" : doc.status}
                            </span>
                            <Link href={`/api/documents/${doc.id}/download`} className="text-sm">
                              View
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Upload more docs (if not decided) */}
                {!["APPROVED", "REFUSED", "WITHDRAWN", "CANCELLED"].includes(app.status) && (
                  <div className="mt-4 govuk-inset-text">
                    <p className="text-sm">
                      Need to upload additional documents? You can still add them from
                      the documents step of your application.
                    </p>
                  </div>
                )}
              </section>

              {/* Messages from staff */}
              {app.messages.length > 0 && (
                <section className="bg-white border border-govuk-mid-grey p-6">
                  <h2>Messages ({app.messages.length})</h2>
                  <div className="space-y-4">
                    {app.messages.map((msg) => (
                      <div key={msg.id} className={`border-l-4 p-4 ${
                        msg.isFromStaff ? "border-govuk-blue bg-blue-50" : "border-govuk-mid-grey"
                      }`}>
                        <p className="text-sm text-govuk-dark-grey mb-1">
                          {msg.isFromStaff ? "From licensing team" : "You"} ·{" "}
                          {format(new Date(msg.createdAt), "d MMM yyyy HH:mm")}
                        </p>
                        <p className="font-bold text-sm">{msg.subject}</p>
                        <p className="mt-1">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Timeline */}
              <section className="bg-white border border-govuk-mid-grey p-6">
                <h2>Application timeline</h2>
                {app.workflowEvents.length === 0 ? (
                  <p className="text-govuk-dark-grey">No events recorded yet.</p>
                ) : (
                  <ol className="relative border-l-2 border-govuk-mid-grey ml-4 space-y-6 mt-4">
                    {app.workflowEvents
                      .filter((e) => {
                        // Only show stages marked as visible to applicant
                        const stage = workflowDef.find((s) => s.key === e.toStage);
                        return stage?.visibleToApplicant !== false;
                      })
                      .map((evt) => {
                        const stage = workflowDef.find((s) => s.key === evt.toStage);
                        return (
                          <li key={evt.id} className="ml-6">
                            <span className="absolute w-3 h-3 bg-govuk-blue rounded-full -left-[7px]" />
                            <time className="text-xs text-govuk-dark-grey">
                              {format(new Date(evt.createdAt), "d MMM yyyy HH:mm")}
                            </time>
                            <p className="font-bold text-sm">
                              {stage?.label ?? evt.toStage}
                            </p>
                          </li>
                        );
                      })}
                  </ol>
                )}
              </section>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white border border-govuk-mid-grey p-4">
                <h3 className="text-govuk-m mb-3">Application details</h3>
                <dl className="govuk-summary-list">
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key text-sm">Status</dt>
                    <dd className="govuk-summary-list__value">
                      <StatusTag status={app.status} />
                    </dd>
                  </div>
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key text-sm">Current stage</dt>
                    <dd className="govuk-summary-list__value text-sm">
                      {(() => {
                        const stage = workflowDef.find((s) => s.key === app.currentStage);
                        return stage?.label ?? app.currentStage ?? "—";
                      })()}
                    </dd>
                  </div>
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key text-sm">Submitted</dt>
                    <dd className="govuk-summary-list__value text-sm">
                      {app.submittedAt
                        ? format(new Date(app.submittedAt), "d MMM yyyy")
                        : "Not submitted"}
                    </dd>
                  </div>
                  {app.decidedAt && (
                    <div className="govuk-summary-list__row">
                      <dt className="govuk-summary-list__key text-sm">Decision</dt>
                      <dd className="govuk-summary-list__value text-sm">
                        {format(new Date(app.decidedAt), "d MMM yyyy")}
                      </dd>
                    </div>
                  )}
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key text-sm">Documents</dt>
                    <dd className="govuk-summary-list__value text-sm">
                      {app.documents.length} uploaded
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Workflow progress */}
              {workflowDef.length > 0 && (
                <div className="bg-white border border-govuk-mid-grey p-4">
                  <h3 className="text-govuk-m mb-3">Progress</h3>
                  <ol className="space-y-2">
                    {workflowDef
                      .filter((stage) => stage.visibleToApplicant !== false)
                      .map((stage) => {
                        const isCurrent = app.currentStage === stage.key;
                        const isPassed = app.workflowEvents.some(
                          (e) => e.fromStage === stage.key
                        );
                        return (
                          <li
                            key={stage.key}
                            className={`text-sm px-3 py-2 border-l-4 ${
                              isCurrent
                                ? "border-govuk-blue bg-blue-50 font-bold"
                                : isPassed
                                ? "border-govuk-green"
                                : "border-govuk-mid-grey"
                            }`}
                          >
                            {stage.label}
                          </li>
                        );
                      })}
                  </ol>
                </div>
              )}

              <div className="bg-white border border-govuk-mid-grey p-4">
                <h3 className="text-govuk-m mb-3">Need help?</h3>
                <p className="text-sm text-govuk-dark-grey mb-3">
                  Contact the licensing team if you have questions about your
                  application.
                </p>
                <p className="text-sm">
                  <Link href="mailto:licensing@contoso.gov.uk">
                    licensing@contoso.gov.uk
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <GovFooter />
    </>
  );
}
