import type { SetupManifest } from "../../src/lib/setup/manifest";

export interface SetupDeployOptions {
  packagePath?: string;
  subscription?: string;
  plan: boolean;
  yes: boolean;
  help: boolean;
}

export function parseSemanticVersion(output: string) {
  const match = output.match(/\b(\d+)\.(\d+)\.(\d+)\b/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}

export function isVersionAtLeast(
  actual: readonly number[],
  minimum: readonly number[],
) {
  for (let index = 0; index < Math.max(actual.length, minimum.length); index += 1) {
    const difference = (actual[index] ?? 0) - (minimum[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

export function parseSetupDeployArguments(argv: string[]): SetupDeployOptions {
  const options: SetupDeployOptions = {
    plan: false,
    yes: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--package" || argument === "--subscription") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      if (argument === "--package") options.packagePath = value;
      else options.subscription = value;
      index += 1;
    } else if (argument === "--plan") options.plan = true;
    else if (argument === "--yes") options.yes = true;
    else if (argument === "--help") options.help = true;
    else throw new Error(`Unknown option: ${argument}`);
  }

  if (
    options.subscription &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      options.subscription,
    )
  ) {
    throw new Error("--subscription must be an Azure subscription GUID.");
  }
  if (!options.help && !options.packagePath) {
    throw new Error("--package is required.");
  }

  return options;
}

export function buildAzdEnvironmentValues(manifest: SetupManifest) {
  const fullIdentity = manifest.identity.mode === "entra";
  return new Map<string, string>([
    ["ENABLE_AI", String(manifest.azure.enableAi)],
    ["AZURE_OPENAI_LOCATION", manifest.azure.region],
    ["AUTHENTICATION_MODE", "demo"],
    [
      "SEED_DEMO_DATA",
      String(fullIdentity ? false : manifest.azure.seedDemoData),
    ],
    ["NEXT_PUBLIC_APP_NAME", manifest.organisation.serviceName],
    ["NEXT_PUBLIC_SUPPORT_EMAIL", manifest.organisation.supportEmail],
    ["NEXT_PUBLIC_SUPPORT_PHONE", manifest.organisation.supportPhone],
    ["NEXT_PUBLIC_DEMO_MODE", String(!fullIdentity)],
    ["NEXT_PUBLIC_SHOW_SAMPLE_BANNER", String(!fullIdentity)],
  ]);
}

export function buildIdentityBootstrapArguments(
  manifest: SetupManifest,
  subscription?: string,
) {
  if (manifest.identity.mode !== "entra") return null;
  if (!manifest.identity.externalTenant || !manifest.identity.workforceTenant) {
    throw new Error(
      "Full identity deployment requires both citizen and workforce tenants.",
    );
  }

  return [
    "scripts/identity/bootstrap.mjs",
    "--environment",
    manifest.azure.environmentName,
    "--external-tenant",
    manifest.identity.externalTenant,
    "--workforce-tenant",
    manifest.identity.workforceTenant,
    "--location",
    manifest.azure.region,
    ...(subscription ? ["--subscription", subscription] : []),
    "--application-name",
    manifest.organisation.serviceName,
    "--deploy",
  ];
}