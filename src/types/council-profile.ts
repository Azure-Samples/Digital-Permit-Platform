import type { SetupModulePack } from "@/lib/setup/manifest";

export interface CouncilProfileView {
  configured: boolean;
  setupVersion: string;
  organisationName: string;
  serviceName: string;
  supportEmail: string;
  supportPhone: string;
  publicDomain: string | null;
  primaryColour: string;
  accentColour: string;
  hasLogo: boolean;
  logoFileName: string | null;
  logoVersion: string | null;
  logoScale: number;
  logoBackdrop: "none" | "white";
  showOrganisationName: boolean;
  deploymentProfile: "pilot" | "production";
  environmentName: string;
  azureRegion: string;
  enableAi: boolean;
  seedDemoData: boolean;
  authenticationMode: "demo" | "entra";
  externalTenant: string | null;
  workforceTenant: string | null;
  selectedModules: SetupModulePack[];
  setupCompletedAt: string | null;
  updatedAt: string | null;
}