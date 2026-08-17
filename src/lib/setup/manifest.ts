import { z } from "zod";

export const SETUP_SCHEMA_VERSION = "1.0" as const;
export const PUBLIC_IMPACT_CONFIRMATION = "publish-platform-settings" as const;
export const RESET_DEFAULTS_CONFIRMATION = "reset-contoso-defaults" as const;
export const SETUP_MODULE_PACKS = [
  "blue-badge",
  "taxi-private-hire",
  "premises",
  "street-trading",
] as const;

const hexColourSchema = z.string().regex(/^#[0-9a-f]{6}$/i, {
  message: "Use a six-digit colour such as #123b5d.",
});

const optionalText = (maximum: number) =>
  z
    .union([z.string().trim().max(maximum), z.null()])
    .transform((value) => value || null);

const domainSchema = z
  .union([
    z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
        "Enter a domain such as permits.example.gov.uk without https://.",
      ),
    z.literal(""),
    z.null(),
  ])
  .transform((value) => value || null);

const tenantSchema = optionalText(253);

export const setupManifestSchema = z
  .object({
    schemaVersion: z.literal(SETUP_SCHEMA_VERSION),
    generatedAt: z.string().datetime({ offset: true }),
    organisation: z
      .object({
        name: z.string().trim().min(2).max(120),
        serviceName: z.string().trim().min(2).max(120),
        supportEmail: z.string().trim().toLowerCase().email().max(254),
        supportPhone: z
          .string()
          .trim()
          .regex(/^[0-9()+.\s-]{7,30}$/, "Enter a valid support telephone number."),
        publicDomain: domainSchema,
      })
      .strict(),
    brand: z
      .object({
        primaryColour: hexColourSchema,
        accentColour: hexColourSchema,
        logoAction: z.enum(["keep", "replace", "remove"]).default("keep"),
        logoFileName: optionalText(180),
        logoScale: z.number().int().min(50).max(200).default(100),
        logoBackdrop: z.enum(["none", "white"]).default("none"),
        showOrganisationName: z.boolean().default(true),
      })
      .strict(),
    azure: z
      .object({
        profile: z.enum(["pilot", "production"]),
        environmentName: z
          .string()
          .trim()
          .toLowerCase()
          .min(2)
          .max(30)
          .regex(
            /^[a-z][a-z0-9-]*[a-z0-9]$/,
            "Use 2-30 lowercase letters, numbers, or hyphens, starting with a letter.",
          ),
        region: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9]+$/, "Choose a valid Azure region."),
        enableAi: z.boolean(),
        seedDemoData: z.boolean(),
      })
      .strict(),
    identity: z
      .object({
        mode: z.enum(["demo", "entra"]),
        externalTenant: tenantSchema,
        workforceTenant: tenantSchema,
      })
      .strict(),
    modules: z.array(z.enum(SETUP_MODULE_PACKS)).min(1).max(SETUP_MODULE_PACKS.length),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (contrastRatio("#ffffff", manifest.brand.primaryColour) < 4.5) {
      context.addIssue({
        code: "custom",
        path: ["brand", "primaryColour"],
        message: "The header colour must have at least 4.5:1 contrast with white text.",
      });
    }

    if (manifest.brand.logoAction === "replace" && !manifest.brand.logoFileName) {
      context.addIssue({
        code: "custom",
        path: ["brand", "logoFileName"],
        message: "A replacement logo must include its original filename.",
      });
    }

    if (manifest.identity.mode === "entra") {
      if (!manifest.identity.externalTenant) {
        context.addIssue({
          code: "custom",
          path: ["identity", "externalTenant"],
          message: "Enter the External ID tenant for applicant sign-in.",
        });
      }
      if (!manifest.identity.workforceTenant) {
        context.addIssue({
          code: "custom",
          path: ["identity", "workforceTenant"],
          message: "Enter the workforce tenant for staff sign-in.",
        });
      }
    }

    if (manifest.azure.profile === "production") {
      if (manifest.azure.seedDemoData) {
        context.addIssue({
          code: "custom",
          path: ["azure", "seedDemoData"],
          message: "Production-intent environments cannot include demonstration data.",
        });
      }
      if (manifest.identity.mode !== "entra") {
        context.addIssue({
          code: "custom",
          path: ["identity", "mode"],
          message: "Production-intent environments require Microsoft Entra identity.",
        });
      }
    }
  });

export type SetupManifest = z.infer<typeof setupManifestSchema>;
export type SetupModulePack = (typeof SETUP_MODULE_PACKS)[number];

export interface SetupDeploymentPreview {
  applicationChanges: Array<{
    area: "profile" | "branding";
    summary: string;
  }>;
  azureValues: Array<{
    name: string;
    value: string;
    sensitive: false;
  }>;
  requiresAzureDeployment: true;
  requiresDirectoryConsent: boolean;
}

export function parseSetupManifest(input: unknown): SetupManifest {
  return setupManifestSchema.parse(input);
}

export function hasPublicImpactConfirmation(value: FormDataEntryValue | null) {
  return value === PUBLIC_IMPACT_CONFIRMATION;
}

export function hasResetDefaultsConfirmation(value: unknown) {
  return value === RESET_DEFAULTS_CONFIRMATION;
}

export function buildSetupDeploymentPreview(
  manifest: SetupManifest,
): SetupDeploymentPreview {
  return {
    applicationChanges: [
      {
        area: "profile",
        summary: `Set the public service to ${manifest.organisation.serviceName} for ${manifest.organisation.name}.`,
      },
      {
        area: "branding",
        summary: `Apply header ${manifest.brand.primaryColour} and accent ${manifest.brand.accentColour}.`,
      },
    ],
    azureValues: [
      { name: "AZURE_LOCATION", value: manifest.azure.region, sensitive: false },
      { name: "ENABLE_AI", value: String(manifest.azure.enableAi), sensitive: false },
      {
        name: "AUTHENTICATION_MODE",
        value: manifest.identity.mode,
        sensitive: false,
      },
      {
        name: "SEED_DEMO_DATA",
        value: String(manifest.azure.seedDemoData),
        sensitive: false,
      },
      {
        name: "NEXT_PUBLIC_DEMO_MODE",
        value: String(manifest.identity.mode === "demo"),
        sensitive: false,
      },
    ],
    requiresAzureDeployment: true,
    requiresDirectoryConsent: manifest.identity.mode === "entra",
  };
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(value: string): number {
  const channels = [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)].map(
    (channel) => {
      const normalised = Number.parseInt(channel, 16) / 255;
      return normalised <= 0.03928
        ? normalised / 12.92
        : ((normalised + 0.055) / 1.055) ** 2.4;
    },
  );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}