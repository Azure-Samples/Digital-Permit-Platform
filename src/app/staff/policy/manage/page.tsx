import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenCheck } from "lucide-react";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { PolicyManager } from "@/components/policy/policy-manager";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ManagePoliciesPage() {
  const session = await requireRole("MANAGER", "ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/staff/policy/manage");

  const policies = await prisma.licensingPolicy.findMany({
    orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      councilName: true,
      versionLabel: true,
      effectiveFrom: true,
      effectiveTo: true,
      isActive: true,
      sourceFilename: true,
      createdAt: true,
      uploadedBy: { select: { firstName: true, lastName: true } },
      _count: { select: { sections: true } },
    },
  });
  const activePolicy = policies.find((policy) => policy.isActive);

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
              <li className="govuk-breadcrumbs__list-item">Manage policies</li>
            </ol>
          </nav>

          <div className="flex items-center gap-3 mb-2">
            <BookOpenCheck className="h-8 w-8 text-govuk-blue" aria-hidden="true" />
            <h1 className="!mb-0">Statement of Licensing Policy</h1>
          </div>
          <p className="text-govuk-dark-grey max-w-3xl mb-8">
            Imported documents remain drafts until reviewed and activated. Policy Copilot and application insight use only the active version.
          </p>

          <PolicyManager
            defaultCouncilName={activePolicy?.councilName ?? ""}
            policies={policies.map((policy) => ({
              id: policy.id,
              title: policy.title,
              councilName: policy.councilName,
              versionLabel: policy.versionLabel,
              effectiveFrom: policy.effectiveFrom.toISOString(),
              effectiveTo: policy.effectiveTo?.toISOString() ?? null,
              isActive: policy.isActive,
              sourceFilename: policy.sourceFilename,
              createdAt: policy.createdAt.toISOString(),
              uploaderName: policy.uploadedBy
                ? `${policy.uploadedBy.firstName} ${policy.uploadedBy.lastName}`
                : null,
              sectionCount: policy._count.sections,
            }))}
          />
        </div>
      </main>
      <GovFooter />
    </>
  );
}