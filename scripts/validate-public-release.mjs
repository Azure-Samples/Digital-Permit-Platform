import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requiredPaths = [
  "README.md",
  ".editorconfig",
  ".gitattributes",
  ".nvmrc",
  "LICENSE",
  "NOTICE",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "SUPPORT.md",
  "azure.yaml",
  "infra/main.bicep",
  "infra/main.parameters.json",
  "scripts/identity/bootstrap.mjs",
  "scripts/identity/bootstrap-config.mjs",
  "scripts/setup/deploy.ts",
  "scripts/setup/deploy-config.ts",
  "scripts/setup/build-installer-source.mjs",
  "scripts/setup/Install-DigitalPermitPlatform.ps1",
  "Install-DigitalPermitPlatform.cmd",
  "Install-DigitalPermitPlatform.command",
  "install-digital-permit-platform.sh",
  ".github/workflows/ci.yml",
  ".github/workflows/codeql.yml",
  ".github/dependabot.yml",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "docs/architecture.md",
  "docs/architecture.excalidraw",
  "docs/deployment.md",
  "docs/local-development.md",
  "docs/configuration.md",
  "docs/identity.md",
  "docs/installer.md",
  "docs/customization.md",
  "docs/security.md",
  "docs/responsible-ai.md",
  "docs/operations.md",
  "docs/cost.md",
  "docs/troubleshooting.md",
  "src/app/staff/policy/manage/page.tsx",
  "src/lib/policy/document.ts",
  "public/templates/private-hire-driver-licence.docx",
];

const forbiddenPaths = [
  ".env",
  "containerapp.yaml",
  "pitch",
  "public/film",
  "public/paperprocess.png",
  "public/council_topbar_logo.png",
  "src/app/film",
  "src/app/pitch",
  "src/components/film",
  "src/components/pitch",
  "src/lib/pitch",
  ["$", "{userHome}"].join(""),
];

const ignoredDirectories = new Set([".git", ".next", "dist", "node_modules"]);
const allowedAzureWorkflowFiles = new Set([
  path.join(".azure", "deployment-plan.md"),
  path.join(".azure", "validate-status.json"),
]);
const textExtensions = new Set([
  ".bicep",
  ".cmd",
  ".css",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".prisma",
  ".ps1",
  ".sh",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const forbiddenText = [
  new RegExp(["Shrop", "shire"].join(""), "i"),
  new RegExp(["Somer", "set"].join(""), "i"),
  new RegExp(["jolly", "glacier"].join(""), "i"),
  new RegExp(["licensing", "pocacr"].join(""), "i"),
  new RegExp(["Microsoft internal", " only"].join(""), "i"),
  new RegExp(["e44358c7-2fab-489b", "-8e3d-0d22ef7fc09c"].join(""), "i"),
];
const secretFilename = /(^|\/)(\.env(\..*)?|azureProfile\.json|clouds\.config|.*\.(pfx|pem|key))$/i;
const failures = [];

async function exists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

for (const required of requiredPaths) {
  if (!(await exists(required))) failures.push(`required path missing: ${required}`);
}
for (const forbidden of forbiddenPaths) {
  if (await exists(forbidden)) failures.push(`forbidden path present: ${forbidden}`);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, fullPath);

    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;

    if (
      relativePath.startsWith(`.azure${path.sep}`) &&
      !allowedAzureWorkflowFiles.has(relativePath)
    ) {
      failures.push(`forbidden Azure environment state: ${relativePath}`);
    }

    const fileStat = await stat(fullPath);
    if (fileStat.size > 5 * 1024 * 1024) {
      failures.push(`file exceeds 5 MiB: ${relativePath}`);
    }
    if (secretFilename.test(relativePath) && relativePath !== ".env.example") {
      failures.push(`sensitive filename present: ${relativePath}`);
    }

    if (!textExtensions.has(path.extname(entry.name))) continue;
    const content = await readFile(fullPath, "utf8");
    for (const pattern of forbiddenText) {
      if (pattern.test(content)) {
        failures.push(`forbidden text ${pattern} in ${relativePath}`);
      }
    }
  }
}

await walk(root);

if (failures.length > 0) {
  console.error(`Public release validation failed:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log("Public release validation passed.");