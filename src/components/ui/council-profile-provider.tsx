"use client";

import { createContext, useContext } from "react";
import type { CouncilProfileView } from "@/types/council-profile";

const fallbackProfile: CouncilProfileView = {
  configured: false,
  setupVersion: "1.0",
  organisationName: "Contoso Council",
  serviceName: "Digital Permit Platform",
  supportEmail: "support@example.gov.uk",
  supportPhone: "0300 000 0000",
  publicDomain: null,
  primaryColour: "#0b2e5e",
  accentColour: "#009fe3",
  hasLogo: false,
  logoFileName: null,
  logoVersion: null,
  logoScale: 100,
  logoBackdrop: "none",
  showOrganisationName: true,
  deploymentProfile: "pilot",
  environmentName: "local",
  azureRegion: "uksouth",
  enableAi: false,
  seedDemoData: true,
  authenticationMode: "demo",
  externalTenant: null,
  workforceTenant: null,
  selectedModules: [],
  setupCompletedAt: null,
  updatedAt: null,
};

const CouncilProfileContext = createContext(fallbackProfile);

export function CouncilProfileProvider({
  profile,
  children,
}: {
  profile: CouncilProfileView;
  children: React.ReactNode;
}) {
  return (
    <CouncilProfileContext.Provider value={profile}>
      {children}
    </CouncilProfileContext.Provider>
  );
}

export function useCouncilProfile() {
  return useContext(CouncilProfileContext);
}