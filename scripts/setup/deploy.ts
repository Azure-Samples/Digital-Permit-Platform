import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { validateSetupLogo } from "../../src/lib/setup/logo";
import { parseSetupManifest } from "../../src/lib/setup/manifest";
import {
  buildAzdEnvironmentValues,
  buildIdentityBootstrapArguments,
  isVersionAtLeast,
  parseSemanticVersion,
  parseSetupDeployArguments,
} from "./deploy-config";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const azdExecutable = process.platform === "win32" ? "azd.exe" : "azd";
const nodeExecutable = process.execPath;

function printUsage() {
  console.log(`Usage:
  npm run setup:deploy -- --package <setup.zip> [options]

Options:
  --subscription <guid>  Pin the target Azure subscription
  --plan                 Validate and print the plan without Azure operations
  --yes                  Skip the final deployment confirmation
  --help                 Show this help

The launcher always runs azd provision --preview before any Azure deployment.`);
}

function run(
  executable: string,
  args: string[],
  options: { allowFailure?: boolean; inherit?: boolean } = {},
) {
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      AZURE_CONFIG_DIR:
        process.env.AZURE_CONFIG_DIR?.includes(["$", "{userHome}"].join(""))
          ? path.join(process.env.HOME ?? "", ".azure-work")
          : process.env.AZURE_CONFIG_DIR,
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = result.stderr?.trim().split("\n").at(-1);
    throw new Error(
      `${executable} ${args.join(" ")} failed with exit code ${result.status}${detail ? `: ${detail}` : "."}`,
    );
  }
  return result.status === 0 ? result.stdout.trim() : null;
}

async function loadPackage(packagePath: string) {
  const absolutePath = path.resolve(process.cwd(), packagePath);
  const bytes = await readFile(absolutePath);
  if (bytes.byteLength === 0 || bytes.byteLength > 2 * 1024 * 1024) {
    throw new Error("The setup package must be between 1 byte and 2 MB.");
  }

  const archive = await JSZip.loadAsync(bytes);
  const manifestEntry = archive.file("setup-manifest.json");
  if (!manifestEntry) throw new Error("The ZIP does not contain setup-manifest.json.");
  const manifest = parseSetupManifest(
    JSON.parse(await manifestEntry.async("string")),
  );

  if (manifest.brand.logoAction === "replace") {
    const logoFileName = manifest.brand.logoFileName;
    const logoEntry = logoFileName
      ? archive.file(`assets/${logoFileName}`)
      : null;
    if (!logoEntry || !logoFileName) {
      throw new Error("The setup package is missing its council logo asset.");
    }
    const extension = path.extname(logoFileName).toLowerCase();
    const mimeType =
      extension === ".png"
        ? "image/png"
        : extension === ".jpg" || extension === ".jpeg"
          ? "image/jpeg"
          : extension === ".webp"
            ? "image/webp"
            : extension === ".svg"
              ? "image/svg+xml"
              : "";
    validateSetupLogo({
      data: await logoEntry.async("uint8array"),
      fileName: logoFileName,
      mimeType,
    });
  }

  return {
    absolutePath,
    manifest,
    packageHash: createHash("sha256").update(bytes).digest("hex"),
  };
}

function assertSupportedAzdVersion() {
  const output = run(azdExecutable, ["version"]);
  const version = output ? parseSemanticVersion(output) : null;
  if (!version || !isVersionAtLeast(version, [1, 25, 0])) {
    throw new Error(
      "Azure Developer CLI 1.25.0 or later is required. Update azd and run the installer again.",
    );
  }
  return version.join(".");
}

function printPlan(
  packagePath: string,
  manifest: ReturnType<typeof parseSetupManifest>,
  subscription?: string,
) {
  console.log(`
Digital Permit Platform deployment plan
-----------------------------------------
Package:       ${packagePath}
Environment:   ${manifest.azure.environmentName}
Subscription:  ${subscription ?? "Select interactively in azd"}
Region:        ${manifest.azure.region}
Profile:       ${manifest.azure.profile}
AI:            ${manifest.azure.enableAi ? "Enabled" : "Disabled"}
Citizen login: ${manifest.identity.mode === "entra" ? "Self-registration with any email through External ID" : "Pilot accounts"}
Staff login:   ${manifest.identity.mode === "entra" ? "Council workforce Entra roles" : "Pilot accounts"}

Azure will provision Container Apps, PostgreSQL, Managed Redis, Storage,
Key Vault, Container Registry, Log Analytics, and Application Insights.
The launcher previews resource changes before asking permission to deploy.

Required Azure access: Owner, or Contributor plus User Access Administrator.
Production identity also requires directory administrator consent.
Azure resources are billable to the selected customer subscription.
`);
}

async function writeDeploymentReceipt(input: {
  environmentName: string;
  subscriptionId: string | null;
  serviceUri: string;
  packageHash: string;
  azdVersion: string;
}) {
  const receipt = {
    schemaVersion: "1.0",
    completedAt: new Date().toISOString(),
    environmentName: input.environmentName,
    subscriptionId: input.subscriptionId,
    applicationUrl: input.serviceUri,
    setupUrl: `${input.serviceUri}/setup`,
    setupPackageSha256: input.packageHash,
    azureDeveloperCliVersion: input.azdVersion,
    containsSecrets: false,
  };
  await writeFile(
    path.join(projectRoot, "deployment-result.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { mode: 0o600 },
  );
}

async function ensureEnvironment(
  environmentName: string,
  location: string,
  subscription?: string,
) {
  if (existsSync(path.join(projectRoot, ".azure", environmentName))) {
    run(azdExecutable, ["env", "select", environmentName, "--no-prompt"], {
      inherit: true,
    });
    return;
  }
  run(
    azdExecutable,
    [
      "env",
      "new",
      environmentName,
      "--location",
      location,
      ...(subscription ? ["--subscription", subscription] : []),
      "--no-prompt",
    ],
    { inherit: true },
  );
}

async function main() {
  const options = parseSetupDeployArguments(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  console.log("[1/6] Validating the customer setup package...");
  const setupPackage = await loadPackage(options.packagePath!);
  const { manifest } = setupPackage;
  printPlan(setupPackage.absolutePath, manifest, options.subscription);
  console.log("Non-secret azd values:");
  for (const [name, value] of buildAzdEnvironmentValues(manifest)) {
    console.log(`  ${name}=${value}`);
  }
  if (options.plan) {
    console.log("\nPlan only: no local azd environment or Azure resources changed.");
    return;
  }

  console.log("\n[2/6] Checking Microsoft deployment tools...");
  const azdVersion = assertSupportedAzdVersion();
  if (manifest.identity.mode === "entra") {
    run(process.platform === "win32" ? "az.cmd" : "az", ["version", "--output", "none"]);
  }

  console.log("\n[3/6] Checking Microsoft sign-in...");
  if (
    run(
      azdExecutable,
      ["auth", "login", "--check-status", "--no-prompt"],
      { allowFailure: true },
    ) === null
  ) {
    console.log("Microsoft sign-in is required. Complete sign-in and MFA in the browser window.");
    run(azdExecutable, ["auth", "login"], { inherit: true });
  }

  console.log("\n[4/6] Preparing the customer-owned Azure environment...");
  await ensureEnvironment(
    manifest.azure.environmentName,
    manifest.azure.region,
    options.subscription,
  );
  for (const [name, value] of buildAzdEnvironmentValues(manifest)) {
    run(azdExecutable, ["env", "set", name, value, "--no-prompt"]);
  }

  console.log("\n[5/6] Previewing Azure resource changes...");
  run(
    azdExecutable,
    [
      "provision",
      "--preview",
      "--environment",
      manifest.azure.environmentName,
      "--location",
      manifest.azure.region,
      ...(options.subscription ? ["--subscription", options.subscription] : []),
    ],
    { inherit: true },
  );

  if (!options.yes) {
    const terminal = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = (await terminal.question(
      "Approve these billable Azure resource changes and deploy? [y/N]: ",
    ))
      .trim()
      .toLowerCase();
    terminal.close();
    if (!new Set(["y", "yes"]).has(answer)) {
      console.log("No Azure resources were changed.");
      return;
    }
  }

  console.log("\n[6/6] Deploying the approved plan...");
  const identityArgs = buildIdentityBootstrapArguments(
    manifest,
    options.subscription,
  );
  if (identityArgs) {
    console.log("\nConfiguring citizen self-registration and staff Entra...");
    run(nodeExecutable, identityArgs, { inherit: true });
  } else {
    console.log("\nProvisioning and deploying the online pilot...");
    run(
      azdExecutable,
      ["up", "--environment", manifest.azure.environmentName],
      { inherit: true },
    );
  }

  const serviceUri = run(azdExecutable, [
    "env",
    "get-value",
    "SERVICE_WEB_URI",
    "--environment",
    manifest.azure.environmentName,
  ]);
  if (!serviceUri) throw new Error("Deployment completed without an application URL.");
  const subscriptionId = run(
    azdExecutable,
    [
      "env",
      "get-value",
      "AZURE_SUBSCRIPTION_ID",
      "--environment",
      manifest.azure.environmentName,
    ],
    { allowFailure: true },
  );
  await writeDeploymentReceipt({
    environmentName: manifest.azure.environmentName,
    subscriptionId,
    serviceUri,
    packageHash: setupPackage.packageHash,
    azdVersion,
  });
  console.log(`
Deployment completed.
Online application: ${serviceUri}
Platform settings:  ${serviceUri}/setup
Deployment receipt: ${path.join(projectRoot, "deployment-result.json")}

Next steps:
1. Open Setup in the deployed application and choose Platform.
2. Import ${path.basename(setupPackage.absolutePath)}.
3. Sign in as an administrator, review, and publish the council profile.
${manifest.identity.mode === "entra" ? "4. Assign a staff user/group to Dpp.Administrator before applying setup." : "4. Retrieve the pilot password with: azd env get-value DEMO_PASSWORD"}
`);
}

main().catch((error) => {
  console.error(`\nInstallation stopped: ${error instanceof Error ? error.message : error}`);
  console.error(
    "It is safe to rerun the installer. The same azd environment is selected and Bicep deployments are repeatable.",
  );
  console.error(
    "Microsoft guidance: https://learn.microsoft.com/azure/developer/azure-developer-cli/",
  );
  process.exitCode = 1;
});