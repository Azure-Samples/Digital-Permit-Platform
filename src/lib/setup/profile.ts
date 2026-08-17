import type { CouncilProfile, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ValidatedSetupLogo } from "./logo";
import {
  parseSetupManifest,
  type SetupManifest,
  type SetupModulePack,
} from "./manifest";
import type { CouncilProfileView } from "@/types/council-profile";
import { SetupInputError } from "./errors";

export const COUNCIL_PROFILE_ID = "primary";

export const DEFAULT_COUNCIL_PROFILE: CouncilProfileView = {
  configured: false,
  setupVersion: "1.0",
  organisationName: "Contoso Council",
  serviceName:
    process.env.NEXT_PUBLIC_APP_NAME || "Digital Permit Platform",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.gov.uk",
  supportPhone:
    process.env.NEXT_PUBLIC_SUPPORT_PHONE || "0300 000 0000",
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
  environmentName: process.env.AZURE_ENV_NAME || "local",
  azureRegion: process.env.AZURE_LOCATION || "uksouth",
  enableAi: process.env.ENABLE_AI === "true",
  seedDemoData: process.env.SEED_DEMO_DATA !== "false",
  authenticationMode:
    process.env.AUTHENTICATION_MODE === "entra" ? "entra" : "demo",
  externalTenant: null,
  workforceTenant: null,
  selectedModules: [],
  setupCompletedAt: null,
  updatedAt: null,
};

export const DEFAULT_COUNCIL_PRESENTATION = {
  setupVersion: DEFAULT_COUNCIL_PROFILE.setupVersion,
  organisationName: DEFAULT_COUNCIL_PROFILE.organisationName,
  serviceName: DEFAULT_COUNCIL_PROFILE.serviceName,
  supportEmail: DEFAULT_COUNCIL_PROFILE.supportEmail,
  supportPhone: DEFAULT_COUNCIL_PROFILE.supportPhone,
  primaryColour: DEFAULT_COUNCIL_PROFILE.primaryColour,
  accentColour: DEFAULT_COUNCIL_PROFILE.accentColour,
  logoFileName: null,
  logoMimeType: null,
  logoHash: null,
  logoData: null,
  logoScale: 100,
  logoBackdrop: "none",
  showOrganisationName: DEFAULT_COUNCIL_PROFILE.showOrganisationName,
  setupCompletedAt: null,
  configuredById: null,
} as const;

export async function getCouncilProfile(): Promise<CouncilProfileView> {
  const profile = await prisma.councilProfile.findUnique({
    where: { id: COUNCIL_PROFILE_ID },
  });
  return profile ? toCouncilProfileView(profile) : DEFAULT_COUNCIL_PROFILE;
}

export async function getCouncilLogo() {
  return prisma.councilProfile.findUnique({
    where: { id: COUNCIL_PROFILE_ID },
    select: {
      logoData: true,
      logoFileName: true,
      logoMimeType: true,
      logoHash: true,
    },
  });
}

export async function applyCouncilProfile(input: {
  manifest: SetupManifest;
  logo: ValidatedSetupLogo | null;
  configuredById: string;
  publicImpactConfirmed: true;
  ipAddress?: string;
  userAgent?: string;
}): Promise<CouncilProfileView> {
  const manifest = parseSetupManifest(input.manifest);
  if (manifest.brand.logoAction === "replace" && !input.logo) {
    throw new SetupInputError("Choose the replacement council logo before applying setup.");
  }
  if (manifest.brand.logoAction !== "replace" && input.logo) {
    throw new SetupInputError("A logo file is only accepted when the manifest requests replacement.");
  }

  const completedAt = new Date();
  const profile = await prisma.$transaction(async (transaction) => {
    const previous = await transaction.councilProfile.findUnique({
      where: { id: COUNCIL_PROFILE_ID },
    });
    const logoFields = resolveLogoFields(previous, manifest, input.logo);
    const infrastructureIntent = resolveInfrastructureIntent(previous, manifest);
    const profileData = {
      setupVersion: manifest.schemaVersion,
      organisationName: manifest.organisation.name,
      serviceName: manifest.organisation.serviceName,
      supportEmail: manifest.organisation.supportEmail,
      supportPhone: manifest.organisation.supportPhone,
      primaryColour: manifest.brand.primaryColour.toLowerCase(),
      accentColour: manifest.brand.accentColour.toLowerCase(),
      logoScale: manifest.brand.logoScale,
      logoBackdrop: manifest.brand.logoBackdrop,
      showOrganisationName: manifest.brand.showOrganisationName,
      ...logoFields,
      ...infrastructureIntent,
      selectedModules: resolveSelectedModules(previous, manifest),
      setupCompletedAt: completedAt,
      configuredById: input.configuredById,
    } satisfies Prisma.CouncilProfileUncheckedCreateInput;

    const updated = await transaction.councilProfile.upsert({
      where: { id: COUNCIL_PROFILE_ID },
      create: { id: COUNCIL_PROFILE_ID, ...profileData },
      update: profileData,
    });

    await transaction.auditLog.create({
      data: {
        userId: input.configuredById,
        action: previous ? "council_profile.update" : "council_profile.create",
        entityType: "CouncilProfile",
        entityId: COUNCIL_PROFILE_ID,
        previousValues: previous ? profileAuditSnapshot(previous) : undefined,
        newValues: {
          ...profileAuditSnapshot(updated),
          publicImpactConfirmed: input.publicImpactConfirmed,
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    return updated;
  });

  return toCouncilProfileView(profile);
}

export async function resetCouncilProfile(input: {
  resetById: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<CouncilProfileView> {
  const profile = await prisma.$transaction(async (transaction) => {
    const previous = await transaction.councilProfile.findUnique({
      where: { id: COUNCIL_PROFILE_ID },
    });
    if (!previous) return null;

    const updated = await transaction.councilProfile.update({
      where: { id: COUNCIL_PROFILE_ID },
      data: { ...DEFAULT_COUNCIL_PRESENTATION },
    });

    await transaction.auditLog.create({
      data: {
        userId: input.resetById,
        action: "council_profile.reset",
        entityType: "CouncilProfile",
        entityId: COUNCIL_PROFILE_ID,
        previousValues: profileAuditSnapshot(previous),
        newValues: {
          ...profileAuditSnapshot(updated),
          resetToDefaults: true,
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    return updated;
  });

  return profile ? toCouncilProfileView(profile) : DEFAULT_COUNCIL_PROFILE;
}

type InfrastructureIntent = Pick<
  CouncilProfile,
  | "publicDomain"
  | "deploymentProfile"
  | "environmentName"
  | "azureRegion"
  | "enableAi"
  | "seedDemoData"
  | "authenticationMode"
  | "externalTenant"
  | "workforceTenant"
>;

export function resolveInfrastructureIntent(
  previous: InfrastructureIntent | null,
  manifest: SetupManifest,
): InfrastructureIntent {
  if (previous) {
    return {
      publicDomain: previous.publicDomain,
      deploymentProfile: previous.deploymentProfile,
      environmentName: previous.environmentName,
      azureRegion: previous.azureRegion,
      enableAi: previous.enableAi,
      seedDemoData: previous.seedDemoData,
      authenticationMode: previous.authenticationMode,
      externalTenant: previous.externalTenant,
      workforceTenant: previous.workforceTenant,
    };
  }

  return {
    publicDomain: manifest.organisation.publicDomain,
    deploymentProfile: manifest.azure.profile,
    environmentName: manifest.azure.environmentName,
    azureRegion: manifest.azure.region,
    enableAi: manifest.azure.enableAi,
    seedDemoData: manifest.azure.seedDemoData,
    authenticationMode: manifest.identity.mode,
    externalTenant: manifest.identity.externalTenant,
    workforceTenant: manifest.identity.workforceTenant,
  };
}

export function resolveSelectedModules(
  previous: Pick<CouncilProfile, "selectedModules"> | null,
  manifest: SetupManifest,
) {
  return previous?.selectedModules ?? manifest.modules;
}

function resolveLogoFields(
  previous: CouncilProfile | null,
  manifest: SetupManifest,
  logo: ValidatedSetupLogo | null,
) {
  if (manifest.brand.logoAction === "replace" && logo) {
    return {
      logoFileName: logo.fileName,
      logoMimeType: logo.mimeType,
      logoHash: logo.hash,
      logoData: new Uint8Array(logo.data).slice(),
    };
  }
  if (manifest.brand.logoAction === "remove") {
    return {
      logoFileName: null,
      logoMimeType: null,
      logoHash: null,
      logoData: null,
    };
  }
  return {
    logoFileName: previous?.logoFileName ?? null,
    logoMimeType: previous?.logoMimeType ?? null,
    logoHash: previous?.logoHash ?? null,
    logoData: previous?.logoData ?? null,
  };
}

function toCouncilProfileView(profile: CouncilProfile): CouncilProfileView {
  return {
    configured: Boolean(profile.setupCompletedAt),
    setupVersion: profile.setupVersion,
    organisationName: profile.organisationName,
    serviceName: profile.serviceName,
    supportEmail: profile.supportEmail,
    supportPhone: profile.supportPhone,
    publicDomain: profile.publicDomain,
    primaryColour: profile.primaryColour,
    accentColour: profile.accentColour,
    hasLogo: Boolean(profile.logoData && profile.logoMimeType),
    logoFileName: profile.logoFileName,
    logoVersion: profile.logoHash,
    logoScale: profile.logoScale,
    logoBackdrop: profile.logoBackdrop === "white" ? "white" : "none",
    showOrganisationName: profile.showOrganisationName,
    deploymentProfile:
      profile.deploymentProfile === "production" ? "production" : "pilot",
    environmentName: profile.environmentName,
    azureRegion: profile.azureRegion,
    enableAi: profile.enableAi,
    seedDemoData: profile.seedDemoData,
    authenticationMode:
      profile.authenticationMode === "entra" ? "entra" : "demo",
    externalTenant: profile.externalTenant,
    workforceTenant: profile.workforceTenant,
    selectedModules: profile.selectedModules.filter((module): module is SetupModulePack =>
      new Set<SetupModulePack>([
        "blue-badge",
        "taxi-private-hire",
        "premises",
        "street-trading",
      ]).has(module as SetupModulePack),
    ),
    setupCompletedAt: profile.setupCompletedAt?.toISOString() ?? null,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function profileAuditSnapshot(profile: CouncilProfile) {
  return {
    setupVersion: profile.setupVersion,
    organisationName: profile.organisationName,
    serviceName: profile.serviceName,
    supportEmail: profile.supportEmail,
    supportPhone: profile.supportPhone,
    publicDomain: profile.publicDomain,
    primaryColour: profile.primaryColour,
    accentColour: profile.accentColour,
    logoFileName: profile.logoFileName,
    logoHash: profile.logoHash,
    logoScale: profile.logoScale,
    logoBackdrop: profile.logoBackdrop,
    showOrganisationName: profile.showOrganisationName,
    deploymentProfile: profile.deploymentProfile,
    environmentName: profile.environmentName,
    azureRegion: profile.azureRegion,
    enableAi: profile.enableAi,
    seedDemoData: profile.seedDemoData,
    authenticationMode: profile.authenticationMode,
    externalTenant: profile.externalTenant,
    workforceTenant: profile.workforceTenant,
    selectedModules: profile.selectedModules,
    setupCompletedAt: profile.setupCompletedAt?.toISOString() ?? null,
    configuredById: profile.configuredById,
  };
}