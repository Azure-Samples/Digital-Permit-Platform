import { redirect } from "next/navigation";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { listApiClients } from "@/lib/api/clients";
import { API_SCOPES, API_SCOPE_DESCRIPTIONS } from "@/lib/api/scopes";
import { ApiAccessManager } from "@/components/admin/api-access-manager";

export const dynamic = "force-dynamic";

export default async function AdminApiAccessPage() {
  const session = await requireRole("ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/admin/api-access");

  const clients = await listApiClients();
  const nav = getNavigationForRole(session.user.role, "/admin/api-access");
  const scopes = API_SCOPES.map((scope) => ({
    scope,
    description: API_SCOPE_DESCRIPTIONS[scope],
  }));

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal – Admin"
        navigation={nav}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <h1>API access</h1>
          <p className="text-govuk-dark-grey mb-8 max-w-2xl">
            Issue read-only API keys so approved downstream systems can query
            licensing data from this platform over the versioned{" "}
            <code>/api/v1</code> interface. Keys are shown once at creation and
            cannot be recovered — store them securely and revoke any that are no
            longer needed.
          </p>

          <ApiAccessManager initialClients={clients} scopes={scopes} />
        </div>
      </main>

      <GovFooter />
    </>
  );
}
