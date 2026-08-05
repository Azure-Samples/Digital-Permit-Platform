import { redirect, notFound } from "next/navigation";
import { getSessionOrNull } from "@/lib/permissions";
import { getModuleByKey } from "@/lib/modules/registry";
import { createApplication } from "@/lib/modules/applications";
import { resolveFee } from "@/lib/payments";
import { prisma } from "@/lib/db";
import { ApplicationWizard } from "@/components/applicant/application-wizard";

export const dynamic = "force-dynamic";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ moduleKey: string; applicationId: string }>;
}) {
  const resolvedParams = await params;
  const session = await getSessionOrNull();
  if (!session) redirect(`/auth/login?callbackUrl=/apply/${resolvedParams.moduleKey}/new`);

  const module = await getModuleByKey(resolvedParams.moduleKey);
  if (!module) return notFound();

  const version = module.activeVersion;
  const applicationId = resolvedParams.applicationId;

  // If "new", create a fresh application
  if (applicationId === "new") {
    const app = await createApplication({
      moduleId: module.id,
      moduleVersionId: version.id,
      applicationType: "new",
      applicantId: session.user.id,
    });
    redirect(`/apply/${resolvedParams.moduleKey}/${app.id}`);
  }

  // Load existing application
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      documents: {
        select: {
          id: true,
          requirementKey: true,
          originalFilename: true,
          status: true,
        },
      },
    },
  });

  if (!application) return notFound();
  if (application.applicantId !== session.user.id) return notFound();
  if (application.status !== "DRAFT") {
    redirect(`/dashboard/applications/${applicationId}`);
  }

  const fee = resolveFee(version.feeSchedule as Record<string, unknown>, application.applicationType);

  return (
    <ApplicationWizard
      applicationId={application.id}
      referenceNumber={application.referenceNumber}
      moduleKey={module.moduleKey}
      moduleName={module.displayName}
      formSchema={version.formSchema}
      documentRequirements={version.documentRequirements}
      paymentMode={version.paymentMode}
      feeAmount={fee}
      savedAnswers={(application.answers as Record<string, unknown>) ?? {}}
      uploadedDocuments={application.documents}
      userName={session.user.name}
    />
  );
}
