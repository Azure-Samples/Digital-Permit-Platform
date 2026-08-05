import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { getApplicantDisplayName } from "@/lib/applicant-name";

export const dynamic = "force-dynamic";

async function requestInfoAction(formData: FormData) {
  "use server";
  const applicationId = formData.get("applicationId") as string;
  const userId = formData.get("userId") as string;
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;

  // Create message to applicant
  await prisma.message.create({
    data: {
      applicationId,
      authorId: userId,
      subject,
      body,
      isFromStaff: true,
    },
  });

  // Update application status
  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "AWAITING_DOCUMENTS" },
  });

  await writeAuditLog({
    userId,
    applicationId,
    action: "case.request_info",
    entityType: "Application",
    entityId: applicationId,
    newValues: { subject, status: "AWAITING_DOCUMENTS" },
  });

  redirect(`/staff/cases/${applicationId}`);
}

export default async function RequestInfoPage({
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
      applicant: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!app) return notFound();

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
          <h1 className="mt-4">Request further information</h1>
          <p className="text-govuk-dark-grey mb-4">
            {app.module.displayName} · Ref: {app.referenceNumber}
          </p>
          <div className="govuk-inset-text mb-6">
            This will send a message to{" "}
            <strong>
              {getApplicantDisplayName(app.answers as Record<string, unknown>, app.applicant.firstName, app.applicant.lastName)}
            </strong>{" "}
            ({app.applicant.email}) and set the application status to
            &quot;Awaiting documents&quot;.
          </div>

          <form action={requestInfoAction}>
            <input type="hidden" name="applicationId" value={resolvedParams.caseId} />
            <input type="hidden" name="userId" value={session.user.id} />

            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="subject">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                className="govuk-input"
                required
                defaultValue="Further information required"
              />
            </div>

            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="body">
                Message to applicant
              </label>
              <p className="govuk-hint">
                Explain what documents or information are needed.
              </p>
              <textarea
                id="body"
                name="body"
                className="govuk-textarea"
                rows={6}
                required
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button type="submit" className="govuk-button">
                Send request
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
