import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { getModuleBuilderOptions, getModuleForBuilder } from "@/lib/modules/registry";
import { toModuleDefinition } from "@/lib/modules/definition";
import { ModuleBuilder } from "@/components/admin/module-builder";

export const dynamic = "force-dynamic";

export default async function ModuleEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleKey: string }>;
  searchParams: Promise<{ tab?: string; saved?: string }>;
}) {
  const session = await requireRole("ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/admin");

  const resolvedParams = await params;
  const [module, options, query] = await Promise.all([
    getModuleForBuilder(resolvedParams.moduleKey),
    getModuleBuilderOptions(),
    searchParams,
  ]);
  if (!module) return notFound();
  const version = module.versions[0];

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
            key={module.id}
            userId={session.user.id}
            options={{ ...options, uploadLimitMb: Number(process.env.MAX_FILE_SIZE_MB) || 10 }}
            initialTab={query.tab}
            notice={query.saved === "1" ? "Draft module created. It is disabled and not accepting applications." : undefined}
            initial={{
              moduleId: module.id,
              moduleKey: module.moduleKey,
              displayName: module.displayName,
              category: module.category,
              enabled: module.enabled,
              versionId: version.id,
              versionNumber: version.version,
              definition: toModuleDefinition(version),
              liveVersion: module.liveVersion,
              history: module.versions.map((entry) => ({
                id: entry.id, version: entry.version, visibility: entry.visibility,
                isActive: entry.isActive, createdAt: entry.createdAt.toISOString(),
              })),
            }}
          />
        </div>
      </main>

      <GovFooter />
    </>
  );
}
