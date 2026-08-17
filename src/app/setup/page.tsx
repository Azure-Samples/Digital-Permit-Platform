import type { Metadata } from "next";
import { AzureInstallerWizard } from "@/components/setup/azure-installer-wizard";
import { SetupWizard } from "@/components/setup/setup-wizard";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { getSessionOrNull } from "@/lib/permissions";
import { getCouncilProfile } from "@/lib/setup/profile";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const installerMode = process.env.SETUP_INSTALLER_MODE === "true";
  return installerMode
    ? {
        title: "Azure installer | Digital Permit Platform",
        description:
          "Configure and deploy the Digital Permit Platform into your own Azure subscription.",
      }
    : {
        title: "Setup | Digital Permit Platform",
        description: "Configure the Digital Permit Platform for your council.",
      };
}

export default async function SetupPage() {
  const installerMode = process.env.SETUP_INSTALLER_MODE === "true";
  if (installerMode) {
    return (
      <AzureInstallerWizard
        deploymentSourceUrl={process.env.INSTALLER_SOURCE_URL ?? null}
      />
    );
  }

  const [profile, session] = await Promise.all([
    getCouncilProfile(),
    getSessionOrNull(),
  ]);
  const wizard = (
    <SetupWizard
      initialProfile={profile}
      authenticated={Boolean(session?.user)}
      canApply={session?.user.role === "ADMIN"}
    />
  );

  return (
    <div className="flex min-h-screen flex-col">
      <GovHeader
        serviceName="Licensing Portal - Admin"
        navigation={getNavigationForRole(session?.user.role, "/setup")}
        userName={session?.user.name}
        userRole={session?.user.role}
      />
      <div className="flex-1">{wizard}</div>
      <GovFooter />
    </div>
  );
}