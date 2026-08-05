import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { advanceWorkflow, getWorkflowDefinition, getCurrentStage, getNextStage } from "@/lib/workflow/engine";

export const dynamic = "force-dynamic";

async function advanceAction(formData: FormData) {
  "use server";
  const applicationId = formData.get("applicationId") as string;
  const userId = formData.get("userId") as string;
  const notes = formData.get("notes") as string;

  const result = await advanceWorkflow(applicationId, userId, notes ? { notes } : undefined);

  if (!result.success) {
    // In a real app, we'd show the error; for now redirect back
    redirect(`/staff/cases/${applicationId}`);
  }

  redirect(`/staff/cases/${applicationId}`);
}

export default async function AdvancePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await requireRole("REVIEWER", "MANAGER", "ADMIN").catch(() => null);
  if (!session) redirect("/auth/login");

  const resolvedParams = await params;
  const app = await prisma.application.findUnique({
    where: { id: resolvedParams.caseId },
    include: { module: { select: { displayName: true } } },
  });
  if (!app) return notFound();

  const stages = await getWorkflowDefinition(resolvedParams.caseId);
  const current = await getCurrentStage(resolvedParams.caseId);
  const next = await getNextStage(resolvedParams.caseId);

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
          <h1 className="mt-4">Advance workflow</h1>
          <p className="text-govuk-dark-grey mb-6">
            {app.module.displayName} · Ref: {app.referenceNumber}
          </p>

          {/* Workflow overview */}
          <div className="bg-white border border-govuk-mid-grey p-4 mb-6">
            <h2 className="text-govuk-m mb-3">Workflow stages</h2>
            <ol className="space-y-2">
              {stages.map((stage) => {
                const isCurrent = current?.key === stage.key;
                const isNext = next?.key === stage.key;
                return (
                  <li
                    key={stage.key}
                    className={`text-sm px-3 py-2 border-l-4 ${
                      isCurrent
                        ? "border-govuk-blue bg-blue-50 font-bold"
                        : isNext
                        ? "border-govuk-green bg-green-50"
                        : "border-govuk-mid-grey"
                    }`}
                  >
                    {stage.label}
                    {isCurrent && (
                      <span className="text-govuk-blue text-xs ml-2">← current</span>
                    )}
                    {isNext && (
                      <span className="text-govuk-green text-xs ml-2">← next</span>
                    )}
                    {stage.slaBusinessDays && (
                      <span className="text-govuk-dark-grey text-xs ml-2">
                        ({stage.slaBusinessDays} days SLA)
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          {next ? (
            <form action={advanceAction}>
              <input type="hidden" name="applicationId" value={resolvedParams.caseId} />
              <input type="hidden" name="userId" value={session.user.id} />

              <div className="govuk-inset-text mb-4">
                Moving from <strong>{current?.label ?? "—"}</strong> to{" "}
                <strong>{next.label}</strong>
              </div>

              <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="notes">
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  className="govuk-textarea"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button type="submit" className="govuk-button">
                  Advance to &quot;{next.label}&quot;
                </button>
                <Link
                  href={`/staff/cases/${resolvedParams.caseId}`}
                  className="govuk-button govuk-button--secondary no-underline"
                >
                  Cancel
                </Link>
              </div>
            </form>
          ) : (
            <div className="govuk-warning-text">
              <strong>No further stages available.</strong>
              <p className="mt-1">
                This application is at the final workflow stage. Use
                &quot;Record decision&quot; to approve or refuse.
              </p>
              <Link
                href={`/staff/cases/${resolvedParams.caseId}/decide`}
                className="govuk-button mt-4 no-underline"
              >
                Record decision
              </Link>
            </div>
          )}
        </div>
      </main>
      <GovFooter />
    </>
  );
}
