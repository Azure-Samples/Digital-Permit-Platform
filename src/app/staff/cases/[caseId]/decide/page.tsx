import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { recordDecision } from "@/lib/workflow/engine";
import { getApplicantDisplayName } from "@/lib/applicant-name";

export const dynamic = "force-dynamic";

async function decideAction(formData: FormData) {
  "use server";
  const applicationId = formData.get("applicationId") as string;
  const userId = formData.get("userId") as string;
  const outcome = formData.get("outcome") as "APPROVED" | "REFUSED" | "WITHDRAWN";
  const reason = formData.get("reason") as string;

  await recordDecision(applicationId, outcome, reason, userId);

  // If approved, redirect to licence generation page
  if (outcome === "APPROVED") {
    redirect(`/staff/cases/${applicationId}/generate-licence`);
  }

  redirect(`/staff/cases/${applicationId}`);
}

export default async function DecidePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await requireRole("REVIEWER", "MANAGER", "ADMIN").catch(() => null);
  if (!session) redirect("/auth/login");

  const resolvedParams = await params;
  const app = await prisma.application.findUnique({
    where: { id: resolvedParams.caseId },
    include: {
      module: { select: { displayName: true } },
      applicant: { select: { firstName: true, lastName: true } },
      moduleVersion: {
        select: { decisionTemplates: true },
      },
    },
  });
  if (!app) return notFound();

  const templates = (app.moduleVersion.decisionTemplates as Record<string, string>) ?? {};

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal – Staff"
        navigation={getNavigationForRole(session.user.role, "/staff/queue")}
        userName={session.user.name}
        userRole={session.user.role}
      />
      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container max-w-govuk-two-thirds">
          <Link href={`/staff/cases/${resolvedParams.caseId}`} className="text-sm">
            ← Back to case
          </Link>
          <h1 className="mt-4">Record decision</h1>
          <p className="text-govuk-dark-grey mb-2">
            {app.module.displayName} · Ref: {app.referenceNumber}
          </p>
          <p className="mb-6">
            Applicant:{" "}
            <strong>
              {getApplicantDisplayName(app.answers as Record<string, unknown>, app.applicant.firstName, app.applicant.lastName)}
            </strong>
          </p>

          {app.decisionOutcome && (
            <div className="govuk-warning-text mb-6">
              <strong>
                A decision has already been recorded: {app.decisionOutcome.toUpperCase()}
              </strong>
              <p className="mt-1">Recording a new decision will overwrite the previous one.</p>
            </div>
          )}

          <form action={decideAction}>
            <input type="hidden" name="applicationId" value={resolvedParams.caseId} />
            <input type="hidden" name="userId" value={session.user.id} />

            <div className="govuk-form-group">
              <fieldset className="govuk-fieldset">
                <legend className="govuk-fieldset__legend">Decision</legend>
                <div className="space-y-3 mt-2">
                  {[
                    { value: "APPROVED", label: "Approve", desc: "Grant the licence/permit", color: "text-govuk-green" },
                    { value: "REFUSED", label: "Refuse", desc: "Refuse the application", color: "text-govuk-red" },
                    { value: "WITHDRAWN", label: "Withdrawn", desc: "Application withdrawn by applicant", color: "text-govuk-dark-grey" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-start gap-3">
                      <input
                        type="radio"
                        id={`outcome-${opt.value}`}
                        name="outcome"
                        value={opt.value}
                        className="h-5 w-5 mt-0.5"
                        required
                      />
                      <label htmlFor={`outcome-${opt.value}`}>
                        <span className={`font-bold ${opt.color}`}>
                          {opt.label}
                        </span>
                        <span className="text-sm text-govuk-dark-grey block">
                          {opt.desc}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="reason">
                Decision reason / conditions
              </label>
              <p className="govuk-hint">
                Provide the reason for your decision. This will be included in the
                outcome letter sent to the applicant.
              </p>
              <textarea
                id="reason"
                name="reason"
                className="govuk-textarea"
                rows={6}
                required
                defaultValue={templates.approve ?? ""}
              />
            </div>

            <div className="govuk-warning-text mb-6">
              <strong>This action cannot be easily undone.</strong>
              <p className="mt-1">
                Please ensure you have completed all review checks before recording
                your decision.
              </p>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="govuk-button">
                Record decision
              </button>
              <Link
                href={`/staff/cases/${resolvedParams.caseId}`}
                className="govuk-button govuk-button--secondary no-underline"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
      <GovFooter />
    </>
  );
}
