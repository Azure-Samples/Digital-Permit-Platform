import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const azdExecutable = process.platform === "win32" ? "azd.exe" : "azd";

function runAzd(args) {
  const result = spawnSync(azdExecutable, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw new Error(`Unable to run azd: ${result.error.message}`);
  }

  return result;
}

function getEnvironmentValue(name) {
  const result = runAzd(["env", "get-value", name, "--no-prompt"]);
  return result.status === 0 && result.stdout.trim()
    ? result.stdout.trim()
    : undefined;
}

function setEnvironmentValue(name, value) {
  const result = runAzd(["env", "set", name, value, "--no-prompt"]);
  if (result.status !== 0) {
    throw new Error(`Unable to persist required azd environment value ${name}.`);
  }
}

function generatedPassword(prefix) {
  return `${prefix}!${randomBytes(32).toString("base64url")}`;
}

const generatedValues = [
  ["DATABASE_PASSWORD", () => generatedPassword("DppDb")],
  ["NEXTAUTH_SECRET", () => randomBytes(48).toString("base64url")],
  ["DEMO_PASSWORD", () => generatedPassword("DppDemo")],
];

const defaultValues = [
  ["ENABLE_AI", "false"],
  ["AZURE_OPENAI_CAPACITY", "10"],
  ["AUTHENTICATION_MODE", "demo"],
  ["ENTRA_EXTERNAL_ID_TENANT_ID", "00000000-0000-4000-8000-000000000000"],
  ["ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN", "disabled"],
  ["ENTRA_EXTERNAL_ID_CLIENT_ID", "00000000-0000-4000-8000-000000000000"],
  ["ENTRA_EXTERNAL_ID_CLIENT_SECRET", "disabled"],
  ["ENTRA_WORKFORCE_TENANT_ID", "00000000-0000-4000-8000-000000000000"],
  ["ENTRA_WORKFORCE_CLIENT_ID", "00000000-0000-4000-8000-000000000000"],
  ["ENTRA_WORKFORCE_CLIENT_SECRET", "disabled"],
  ["SEED_DEMO_DATA", "true"],
  ["NEXT_PUBLIC_APP_NAME", "Digital Permit Platform"],
  ["NEXT_PUBLIC_SUPPORT_EMAIL", "support@example.gov.uk"],
  ["NEXT_PUBLIC_SUPPORT_PHONE", "0300 000 0000"],
  ["NEXT_PUBLIC_DEMO_MODE", "true"],
  ["NEXT_PUBLIC_SHOW_SAMPLE_BANNER", "true"],
];

let initializedCount = 0;

for (const [name, createValue] of generatedValues) {
  if (!getEnvironmentValue(name)) {
    setEnvironmentValue(name, createValue());
    initializedCount += 1;
  }
}

for (const [name, value] of defaultValues) {
  if (!getEnvironmentValue(name)) {
    setEnvironmentValue(name, value);
    initializedCount += 1;
  }
}

const authenticationMode = getEnvironmentValue("AUTHENTICATION_MODE");
if (!new Set(["demo", "entra", "hybrid"]).has(authenticationMode)) {
  throw new Error(
    "AUTHENTICATION_MODE must be one of: demo, entra, or hybrid.",
  );
}

if (authenticationMode !== "demo") {
  const entraSettings = [
    "ENTRA_EXTERNAL_ID_TENANT_ID",
    "ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN",
    "ENTRA_EXTERNAL_ID_CLIENT_ID",
    "ENTRA_EXTERNAL_ID_CLIENT_SECRET",
    "ENTRA_WORKFORCE_TENANT_ID",
    "ENTRA_WORKFORCE_CLIENT_ID",
    "ENTRA_WORKFORCE_CLIENT_SECRET",
  ];
  const missingSettings = entraSettings.filter((name) => {
    const value = getEnvironmentValue(name);
    return !value || value === "disabled" || value.startsWith("00000000-");
  });
  if (missingSettings.length > 0) {
    throw new Error(
      `AUTHENTICATION_MODE=${authenticationMode} requires these azd values: ${missingSettings.join(", ")}`,
    );
  }
}

if (!getEnvironmentValue("AZURE_OPENAI_LOCATION")) {
  const primaryLocation =
    getEnvironmentValue("AZURE_LOCATION") || process.env.AZURE_LOCATION;
  if (!primaryLocation) {
    throw new Error(
      "AZURE_LOCATION must be selected before the preprovision hook runs.",
    );
  }
  setEnvironmentValue("AZURE_OPENAI_LOCATION", primaryLocation);
  initializedCount += 1;
}

console.log(
  initializedCount > 0
    ? `Initialized ${initializedCount} missing azd environment values. Secret values were not printed.`
    : "Required azd environment values already exist; no values were changed.",
);