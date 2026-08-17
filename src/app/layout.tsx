import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { CouncilProfileProvider } from "@/components/ui/council-profile-provider";
import {
  DEFAULT_COUNCIL_PROFILE,
  getCouncilProfile,
} from "@/lib/setup/profile";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const installerMode = process.env.SETUP_INSTALLER_MODE === "true";
  const profile = installerMode ? DEFAULT_COUNCIL_PROFILE : await getCouncilProfile();
  return {
    title: installerMode
      ? "Digital Permit Platform Azure installer"
      : `${profile.serviceName} | ${profile.organisationName}`,
    description: installerMode
      ? "Configure and deploy the Digital Permit Platform into your own Azure subscription."
      : `Apply for and manage licences and permits from ${profile.organisationName}.`,
    icons: { icon: "/favicon.svg" },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const installerMode = process.env.SETUP_INSTALLER_MODE === "true";
  const profile = installerMode ? DEFAULT_COUNCIL_PROFILE : await getCouncilProfile();
  const showSampleBanner = installerMode
    ? false
    : profile.configured
      ? profile.seedDemoData
      : process.env.NEXT_PUBLIC_SHOW_SAMPLE_BANNER !== "false";
  const brandStyle = {
    "--brand-primary": profile.primaryColour,
    "--brand-accent": profile.accentColour,
  } as CSSProperties;

  return (
    <html lang="en" className="govuk-template" style={brandStyle}>
      <body className="min-h-screen flex flex-col">
        <CouncilProfileProvider profile={profile}>
          {showSampleBanner && (
            <div
              role="status"
              className="bg-[#f47738] text-govuk-black text-center text-xs font-bold py-1.5 px-4 print:hidden"
            >
              Sample application. Do not enter real personal, payment, or identity data.
            </div>
          )}
          {children}
        </CouncilProfileProvider>
      </body>
    </html>
  );
}
