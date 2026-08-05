import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { PolicyDocumentView } from "@/components/policy/policy-document-view";
import { PolicyVersionActions } from "@/components/policy/policy-version-actions";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function PolicyVersionPreviewPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const session = await requireRole("MANAGER", "ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/staff/policy/manage");
  const { policyId } = await params;
  const policy = await prisma.licensingPolicy.findUnique({
    where: { id: policyId },
    select: {
      id: true,
      title: true,
      councilName: true,
      versionLabel: true,
      summary: true,
      isActive: true,
      sourceFilename: true,
      sections: { orderBy: { sortOrder: "asc" } },
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!policy) return notFound();

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal - Staff"
        navigation={getNavigationForRole(session.user.role, "/staff/policy")}
        userName={session.user.name}
        userRole={session.user.role}
      />
      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <nav className="govuk-breadcrumbs mb-6" aria-label="Breadcrumb">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/staff/policy">Policy Copilot</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/staff/policy/manage">Manage policies</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">Preview version</li>
            </ol>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-5 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="h-7 w-7 text-govuk-blue" aria-hidden="true" />
                <h1 className="!mb-0">{policy.title}</h1>
              </div>
              <p className="text-govuk-dark-grey">
                {policy.councilName} · {policy.versionLabel} · {policy.sections.length} sections
              </p>
              <span className={policy.isActive ? "govuk-tag" : "govuk-tag govuk-tag--grey"}>
                {policy.isActive ? "Active" : "Draft"}
              </span>
            </div>
            <PolicyVersionActions policyId={policy.id} isActive={policy.isActive} />
          </div>

          <PolicyDocumentView
            summary={policy.summary}
            sections={policy.sections}
            sourceHref={
              policy.sourceFilename
                ? `/api/admin/policies/${policy.id}/source`
                : undefined
            }
            sourceFilename={policy.sourceFilename}
          />
        </div>
      </main>
      <GovFooter />
    </>
  );
}