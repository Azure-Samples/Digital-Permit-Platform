import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LicenceGenerator } from "@/components/staff/licence-generator";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { prisma } from "@/lib/db";
import {
  STANDARD_LICENCE_TEMPLATE_ID,
  STANDARD_LICENCE_TEMPLATE_PATH,
} from "@/lib/licence-template-fields";
import { requireRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function GenerateLicencePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await requireRole("REVIEWER", "MANAGER", "ADMIN").catch(
    () => null,
  );
  const { caseId } = await params;
  if (!session) {
    redirect(`/auth/login?callbackUrl=/staff/cases/${caseId}/generate-licence`);
  }

  const application = await prisma.application.findUnique({
    where: { id: caseId },
    select: {
      decisionOutcome: true,
      referenceNumber: true,
      module: {
        select: {
          displayName: true,
          licenceTemplates: {
            orderBy: { template: { createdAt: "desc" } },
            select: {
              template: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  originalFilename: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!application) return notFound();
  if (application.decisionOutcome !== "approved") {
    redirect(`/staff/cases/${caseId}`);
  }

  const navigation = getNavigationForRole(session.user.role, "/staff");
  const uploadedTemplates = application.module.licenceTemplates.map(
    ({ template }) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      filename: template.originalFilename,
    }),
  );
  const templates = [
    ...uploadedTemplates,
    {
      id: STANDARD_LICENCE_TEMPLATE_ID,
      name: "Standard licence template",
      description: "A general licence document available to every licence type.",
      filename: STANDARD_LICENCE_TEMPLATE_PATH.split("/").pop() ?? "standard-licence.docx",
      standard: true,
    },
  ];

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal - Staff"
        navigation={navigation}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container max-w-govuk-two-thirds">
          <Link href={`/staff/cases/${caseId}`} className="text-sm">
            Back to case
          </Link>

          <div className="govuk-panel bg-govuk-green text-white p-8 text-center mt-4">
            <h1 className="govuk-panel__title text-white">Application approved</h1>
            <div className="govuk-panel__body">
              {application.module.displayName}
              <br />
              <strong>{application.referenceNumber}</strong>
            </div>
          </div>

          <LicenceGenerator
            caseId={caseId}
            moduleName={application.module.displayName}
            templates={templates}
          />

          <p className="text-sm text-govuk-dark-grey mt-8">
            Generated documents are saved to the case record with the template name
            recorded in the audit trail.
          </p>
        </div>
      </main>

      <GovFooter />
    </>
  );
}