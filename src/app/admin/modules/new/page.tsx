import Link from "next/link";
import { redirect } from "next/navigation";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { ModuleBuilder } from "@/components/admin/module-builder";
import { getModuleBuilderOptions } from "@/lib/modules/registry";
import { requireRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function NewModulePage() {
  const session = await requireRole("ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/admin/modules/new");
  const options = await getModuleBuilderOptions();

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
          <nav className="govuk-breadcrumbs mb-6" aria-label="Breadcrumb">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/admin">Modules</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">Create module</li>
            </ol>
          </nav>

          <ModuleBuilder userId={session.user.id} options={{ ...options, uploadLimitMb: Number(process.env.MAX_FILE_SIZE_MB) || 10 }} />
        </div>
      </main>
      <GovFooter />
    </>
  );
}