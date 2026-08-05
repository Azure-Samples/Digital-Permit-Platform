import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { StatusTag } from "@/components/ui/status-tag";
import { SlaBanner } from "@/components/ui/sla-badge";
import { requireRole } from "@/lib/permissions";
import { getApplicationDetail } from "@/lib/modules/applications";
import { computeApplicationSla } from "@/lib/sla";
import { getApplicantDisplayName } from "@/lib/applicant-name";
import { formatAnswerValue } from "@/lib/format";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type { FormSection, DocumentRequirement, WorkflowStage, ChecklistItem } from "@/types/module";
import { ApplicationInsight } from "@/components/ai/application-insight";

export const dynamic = "force-dynamic";

async function addNoteAction(formData: FormData) {
  "use server";
  const applicationId = formData.get("applicationId") as string;
  const authorId = formData.get("authorId") as string;
  const content = formData.get("content") as string;

  if (!content?.trim()) return;

  await prisma.caseNote.create({
    data: {
      applicationId,
      authorId,
      content: content.trim(),
      isInternal: true,
    },
  });

  await writeAuditLog({
    userId: authorId,
    applicationId,
    action: "case.note.add",
    entityType: "CaseNote",
    entityId: applicationId,
  });

  redirect(`/staff/cases/${applicationId}`);
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await requireRole("REVIEWER", "MANAGER", "ADMIN").catch(
    () => null
  );
  if (!session) redirect("/auth/login?callbackUrl=/staff");

  const resolvedParams = await params;
  const app = await getApplicationDetail(resolvedParams.caseId);
  if (!app) return notFound();

  const formSchema = (app.moduleVersion.formSchema as unknown as FormSection[]) ?? [];
  const docRequirements = (app.moduleVersion.documentRequirements as unknown as DocumentRequirement[]) ?? [];
  const workflowDef = (app.moduleVersion.workflowDefinition as unknown as WorkflowStage[]) ?? [];
  const reviewChecklist = (app.moduleVersion.reviewChecklist as unknown as ChecklistItem[]) ?? [];
  const answers = (app.answers as Record<string, unknown>) ?? {};

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal – Staff"
        navigation={getNavigationForRole(session.user.role, "/staff/queue")}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <nav className="govuk-breadcrumbs mb-4">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/staff">Dashboard</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/staff/queue">Work queue</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">
                {app.referenceNumber}
              </li>
            </ol>
          </nav>

          <div className="flex flex-wrap justify-between items-start mb-6">
            <div>
              <span className="govuk-tag mb-2">{app.module.category}</span>
              <h1 className="mt-1">{app.module.displayName}</h1>
              <p className="text-govuk-dark-grey">
                Ref: {app.referenceNumber} · Type:{" "}
                {app.applicationType.charAt(0).toUpperCase() +
                  app.applicationType.slice(1)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusTag status={app.status} />
              {app.currentStage && (
                <span className="govuk-tag govuk-tag--purple">
                  {app.currentStage}
                </span>
              )}
            </div>
          </div>

          <SlaBanner sla={computeApplicationSla(app)} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Applicant details */}
              <section className="bg-white border border-govuk-mid-grey p-6">
                <h2>Applicant details</h2>
                <dl className="govuk-summary-list">
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key">Name</dt>
                    <dd className="govuk-summary-list__value">
                      {getApplicantDisplayName(app.answers as Record<string, unknown>, app.applicant.firstName, app.applicant.lastName)}
                    </dd>
                  </div>
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key">Email</dt>
                    <dd className="govuk-summary-list__value">
                      {app.applicant.email}
                    </dd>
                  </div>
                  {app.applicant.applicantProfile && (
                    <>
                      <div className="govuk-summary-list__row">
                        <dt className="govuk-summary-list__key">Type</dt>
                        <dd className="govuk-summary-list__value">
                          {app.applicant.applicantProfile.applicantType}
                        </dd>
                      </div>
                      {app.applicant.applicantProfile.postcode && (
                        <div className="govuk-summary-list__row">
                          <dt className="govuk-summary-list__key">Postcode</dt>
                          <dd className="govuk-summary-list__value">
                            {app.applicant.applicantProfile.postcode}
                          </dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>
              </section>

              {/* Application answers */}
              <section className="bg-white border border-govuk-mid-grey p-6">
                <h2>Application answers</h2>
                {formSchema.map((section) => {
                  const sectionAnswers =
                    (answers[section.key] as Record<string, unknown>) ?? {};
                  return (
                    <div key={section.key} className="mb-6">
                      <h3 className="border-b border-govuk-mid-grey pb-2 mb-3">
                        {section.title}
                      </h3>
                      <dl className="govuk-summary-list">
                        {section.fields.map((f) => {
                          const val = sectionAnswers[f.key];
                          if (val === undefined || val === null || val === "")
                            return null;
                          return (
                            <div
                              key={f.key}
                              className="govuk-summary-list__row"
                            >
                              <dt className="govuk-summary-list__key">
                                {f.label}
                              </dt>
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
                      const req = docRequirements.find(
                        (r) => r.key === doc.requirementKey
                      );
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between border-b border-govuk-mid-grey pb-2"
                        >
                          <div>
                            <p className="font-bold text-sm">
                              {req?.label ?? doc.requirementKey}
                            </p>
                            <p className="text-sm text-govuk-dark-grey">
                              {doc.originalFilename} ·{" "}
                              {(doc.fileSizeBytes / 1024).toFixed(0)}KB ·{" "}
                              {doc.mimeType}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`govuk-tag text-xs ${
                                doc.status === "VERIFIED"
                                  ? "govuk-tag--green"
                                  : doc.status === "REJECTED"
                                  ? "govuk-tag--red"
                                  : "govuk-tag--grey"
                              }`}
                            >
                              {doc.status}
                            </span>
                            <Link
                              href={`/api/documents/${doc.id}/download`}
                              className="text-sm"
                            >
                              View
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Check for missing documents */}
                {docRequirements.some(
                  (r) =>
                    r.required &&
                    !app.documents.find(
                      (d) => d.requirementKey === r.key
                    )
                ) && (
                  <div className="govuk-warning-text mt-4">
                    <strong>Missing required documents:</strong>
                    <ul className="list-disc ml-6 mt-1">
                      {docRequirements
                        .filter(
                          (r) =>
                            r.required &&
                            !app.documents.find(
                              (d) => d.requirementKey === r.key
                            )
                        )
                        .map((r) => (
                          <li key={r.key}>{r.label}</li>
                        ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* Review checklist */}
              {reviewChecklist.length > 0 && (
                <section className="bg-white border border-govuk-mid-grey p-6">
                  <h2>Review checklist</h2>
                  <div className="space-y-3">
                    {reviewChecklist.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-start gap-3 border-b border-govuk-mid-grey pb-2"
                      >
                        <input
                          type="checkbox"
                          className="h-5 w-5 mt-0.5"
                          id={`check-${item.key}`}
                        />
                        <label htmlFor={`check-${item.key}`}>
                          <span className="font-bold">{item.label}</span>
                          {item.description && (
                            <p className="text-sm text-govuk-dark-grey">
                              {item.description}
                            </p>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* AI policy insight */}
              <ApplicationInsight applicationId={app.id} />

              {/* Workflow timeline */}
              <section className="bg-white border border-govuk-mid-grey p-6">
                <h2>Case timeline</h2>
                {app.workflowEvents.length === 0 ? (
                  <p className="text-govuk-dark-grey">No events recorded.</p>
                ) : (
                  <ol className="relative border-l-2 border-govuk-mid-grey ml-4 space-y-6 mt-4">
                    {app.workflowEvents.map((evt) => (
                      <li key={evt.id} className="ml-6">
                        <span className="absolute w-3 h-3 bg-govuk-blue rounded-full -left-[7px]" />
                        <time className="text-xs text-govuk-dark-grey">
                          {format(new Date(evt.createdAt), "d MMM yyyy HH:mm")}
                        </time>
                        <p className="font-bold text-sm">
                          {evt.action}
                          {evt.fromStage && (
                            <span className="text-govuk-dark-grey font-normal">
                              {" "}
                              ({evt.fromStage} → {evt.toStage})
                            </span>
                          )}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {/* Case notes */}
              <section className="bg-white border border-govuk-mid-grey p-6">
                <h2>Internal notes ({app.caseNotes.length})</h2>
                {app.caseNotes.map((note) => (
                  <div
                    key={note.id}
                    className="border-b border-govuk-mid-grey pb-3 mb-3"
                  >
                    <p className="text-sm text-govuk-dark-grey">
                      {note.author.firstName} {note.author.lastName} ·{" "}
                      {format(new Date(note.createdAt), "d MMM yyyy HH:mm")}
                    </p>
                    <p className="mt-1">{note.content}</p>
                  </div>
                ))}

                <form action={addNoteAction} className="mt-4">
                  <input type="hidden" name="applicationId" value={app.id} />
                  <input type="hidden" name="authorId" value={session.user.id} />
                  <textarea
                    name="content"
                    className="govuk-textarea"
                    placeholder="Add an internal note..."
                    rows={3}
                    required
                  />
                  <button type="submit" className="govuk-button text-sm mt-2">
                    Add note
                  </button>
                </form>
              </section>
            </div>

            {/* Sidebar – Actions */}
            <div className="lg:col-span-1 space-y-4">
              {/* Quick actions */}
              <div className="bg-white border border-govuk-mid-grey p-4">
                <h3 className="text-govuk-m mb-4">Actions</h3>
                <div className="space-y-2">
                  <Link
                    href={`/staff/cases/${app.id}/assign`}
                    className="govuk-button govuk-button--secondary w-full text-center no-underline text-sm"
                  >
                    Assign officer
                  </Link>
                  <Link
                    href={`/staff/cases/${app.id}/request-info`}
                    className="govuk-button govuk-button--secondary w-full text-center no-underline text-sm"
                  >
                    Request information
                  </Link>
                  <Link
                    href={`/staff/cases/${app.id}/advance`}
                    className="govuk-button w-full text-center no-underline text-sm"
                  >
                    Advance workflow
                  </Link>
                  {(session.user.role === "REVIEWER" ||
                    session.user.role === "MANAGER" ||
                    session.user.role === "ADMIN") && (
                    <Link
                        href={`/staff/cases/${app.id}/decide`}
                        className="govuk-button w-full text-center no-underline text-sm"
                      >
                        Record decision
                      </Link>
                  )}
                  <Link
                    href={`/staff/cases/${app.id}/edit-answers`}
                    className="govuk-button govuk-button--secondary w-full text-center no-underline text-sm"
                  >
                    Edit application
                  </Link>
                  {app.status === "APPROVED" && (
                    <Link
                      href={`/staff/cases/${app.id}/generate-licence`}
                      className="govuk-button w-full text-center no-underline text-sm bg-[#00703c] shadow-[0_2px_0_#002d18]"
                    >
                      Generate licence
                    </Link>
                  )}
                </div>
              </div>

              {/* Assignment info */}
              <div className="bg-white border border-govuk-mid-grey p-4">
                <h3 className="text-govuk-m mb-3">Assignment</h3>
                <dl className="govuk-summary-list">
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key text-sm">
                      Assigned to
                    </dt>
                    <dd className="govuk-summary-list__value text-sm">
                      {app.assignedOfficer
                        ? `${app.assignedOfficer.firstName} ${app.assignedOfficer.lastName}`
                        : "Unassigned"}
                    </dd>
                  </div>
                  <div className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key text-sm">
                      Current stage
                    </dt>
                    <dd className="govuk-summary-list__value text-sm">
                      {app.currentStage ?? "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Workflow stages */}
              {workflowDef.length > 0 && (
                <div className="bg-white border border-govuk-mid-grey p-4">
                  <h3 className="text-govuk-m mb-3">Workflow stages</h3>
                  <ol className="space-y-2">
                    {workflowDef.map((stage) => {
                      const isCurrent = app.currentStage === stage.key;
                      const isPassed =
                        app.workflowEvents.some(
                          (e) => e.fromStage === stage.key
                        ) ||
                        (app.workflowEvents.some(
                          (e) => e.toStage === stage.key
                        ) &&
                          !isCurrent);

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
                          {stage.slaBusinessDays && (
                            <span className="text-xs text-govuk-dark-grey ml-1">
                              ({stage.slaBusinessDays} days SLA)
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {/* Payments */}
              <div className="bg-white border border-govuk-mid-grey p-4">
                <h3 className="text-govuk-m mb-3">Payments</h3>
                {app.payments.length === 0 ? (
                  <p className="text-sm text-govuk-dark-grey">
                    No payments recorded.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {app.payments.map((p) => (
                      <li key={p.id} className="text-sm">
                        £{Number(p.amount).toFixed(2)} –{" "}
                        <span
                          className={`govuk-tag text-xs ${
                            p.status === "COMPLETED"
                              ? "govuk-tag--green"
                              : "govuk-tag--yellow"
                          }`}
                        >
                          {p.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Consultations */}
              {app.consultations.length > 0 && (
                <div className="bg-white border border-govuk-mid-grey p-4">
                  <h3 className="text-govuk-m mb-3">Consultations</h3>
                  <ul className="space-y-2">
                    {app.consultations.map((c) => (
                      <li key={c.id} className="text-sm">
                        <span className="font-bold">{c.responsibleBody}</span>
                        <br />
                        <span
                          className={`govuk-tag text-xs ${
                            c.status === "OBJECTION"
                              ? "govuk-tag--red"
                              : c.status === "NO_OBJECTION"
                              ? "govuk-tag--green"
                              : "govuk-tag--grey"
                          }`}
                        >
                          {c.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tasks */}
              {(app.inspections.length > 0 ||
                app.trainingTasks.length > 0 ||
                app.hearings.length > 0) && (
                <div className="bg-white border border-govuk-mid-grey p-4">
                  <h3 className="text-govuk-m mb-3">Tasks</h3>
                  <ul className="space-y-2 text-sm">
                    {app.inspections.map((t) => (
                      <li key={t.id}>
                        🔍 {t.inspectionType} – {t.status}
                      </li>
                    ))}
                    {app.trainingTasks.map((t) => (
                      <li key={t.id}>
                        📚 {t.taskType} – {t.status}
                      </li>
                    ))}
                    {app.hearings.map((t) => (
                      <li key={t.id}>
                        ⚖️ {t.hearingType} – {t.status}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <GovFooter />
    </>
  );
}
