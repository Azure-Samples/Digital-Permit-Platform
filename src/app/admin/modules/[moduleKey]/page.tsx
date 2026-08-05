import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { getModuleByKey } from "@/lib/modules/registry";
import { ModuleBuilder } from "@/components/admin/module-builder";

export const dynamic = "force-dynamic";

export default async function ModuleEditPage({
  params,
}: {
  params: Promise<{ moduleKey: string }>;
}) {
  const session = await requireRole("ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/admin");

  const resolvedParams = await params;
  const module = await getModuleByKey(resolvedParams.moduleKey);
  if (!module) return notFound();

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal – Admin"
        navigation={getNavigationForRole(session.user.role, "/admin")}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <nav className="govuk-breadcrumbs mb-4">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/admin">Modules</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">
                {module.displayName}
              </li>
            </ol>
          </nav>

          <ModuleBuilder
            moduleKey={module.moduleKey}
            displayName={module.displayName}
            category={module.category}
            moduleId={module.id}
            version={module.activeVersion}
          />
        </div>
      </main>

      <GovFooter />
    </>
  );
}
