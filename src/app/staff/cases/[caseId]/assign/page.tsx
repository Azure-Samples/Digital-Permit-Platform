import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function assignAction(formData: FormData) {
  "use server";
  const applicationId = formData.get("applicationId") as string;
  const officerId = formData.get("officerId") as string;
  const userId = formData.get("userId") as string;

  const prev = await prisma.application.findUnique({ where: { id: applicationId } });

  await prisma.application.update({
    where: { id: applicationId },
    data: { assignedOfficerId: officerId || null },
  });

  await writeAuditLog({
    userId,
    applicationId,
    action: "case.assign",
    entityType: "Application",
    entityId: applicationId,
    previousValues: { assignedOfficerId: prev?.assignedOfficerId },
    newValues: { assignedOfficerId: officerId || null },
  });

  redirect(`/staff/cases/${applicationId}`);
}

export default async function AssignPage({
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
      assignedOfficer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!app) return notFound();

  const officers = await prisma.user.findMany({
    where: { role: { in: ["REVIEWER", "MANAGER", "ADMIN"] }, active: true },
    select: { id: true, firstName: true, lastName: true, role: true },
    orderBy: { firstName: "asc" },
  });

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
          <h1 className="mt-4">Assign officer</h1>
          <p className="text-govuk-dark-grey mb-2">
            {app.module.displayName} · Ref: {app.referenceNumber}
          </p>
          {app.assignedOfficer && (
            <p className="mb-4">
              Currently assigned to:{" "}
              <strong>{app.assignedOfficer.firstName} {app.assignedOfficer.lastName}</strong>
            </p>
          )}

          <form action={assignAction}>
            <input type="hidden" name="applicationId" value={resolvedParams.caseId} />
            <input type="hidden" name="userId" value={session.user.id} />

            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="officerId">
                Select officer
              </label>
              <select id="officerId" name="officerId" className="govuk-select">
                <option value="">Unassigned</option>
                {officers.map((o) => (
                  <option
                    key={o.id}
                    value={o.id}
                    selected={o.id === app.assignedOfficer?.id}
                  >
                    {o.firstName} {o.lastName} ({o.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <button type="submit" className="govuk-button">
                Assign
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
