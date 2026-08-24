import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import JSZip from "jszip";

const root = process.cwd();
const defaultOutput = path.join(root, "dist", "digital-permit-platform-installer-source.zip");
const requiredFiles = [
  "Install-DigitalPermitPlatform.cmd",
  "Install-DigitalPermitPlatform.command",
  "install-digital-permit-platform.sh",
  "scripts/setup/Install-DigitalPermitPlatform.ps1",
  "scripts/setup/deploy.ts",
  "azure.yaml",
  "infra/main.bicep",
  "package.json",
  "package-lock.json",
];
const forbiddenPatterns = [
  /(^|\/)\.azure(\/|$)/,
  /(^|\/)\.env(?:\.|$)/,
  /(^|\/)deployment-result\.json$/,
  /(^|\/)(?:node_modules|\.next|dist)(\/|$)/,
];

function parseOutput(argv) {
  const outputIndex = argv.indexOf("--output");
  if (outputIndex === -1) return defaultOutput;
  const value = argv[outputIndex + 1];
  if (!value || value.startsWith("--")) {
    throw new Error("--output requires a file path.");
  }
  return path.resolve(root, value);
}

function listPublicFiles() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "buffer" },
  );
  if (result.status !== 0) {
    throw new Error("Unable to enumerate the public source files with Git.");
  }
  return result.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((fileName) => !forbiddenPatterns.some((pattern) => pattern.test(fileName)))
    .sort();
}

const outputPath = parseOutput(process.argv.slice(2));
const files = listPublicFiles();
for (const required of requiredFiles) {
  if (!files.includes(required)) {
    throw new Error(`The installer source is missing ${required}.`);
  }
}

const archive = new JSZip();
let sourceBytes = 0;
for (const fileName of files) {
  const absolutePath = path.join(root, fileName);
  const fileStat = await stat(absolutePath);
  if (!fileStat.isFile()) continue;
  if (fileStat.size > 5 * 1024 * 1024) {
    throw new Error(`The installer source file exceeds 5 MB: ${fileName}`);
  }
  sourceBytes += fileStat.size;
  if (sourceBytes > 30 * 1024 * 1024) {
    throw new Error("The expanded installer source exceeds 30 MB.");
  }
  archive.file(fileName, await readFile(absolutePath), {
    binary: true,
    unixPermissions:
      fileName.endsWith(".sh") || fileName.endsWith(".command")
        ? 0o100755
        : 0o100644,
  });
}

archive.file(
  "installer-source.json",
  JSON.stringify(
    {
      schemaVersion: "1.0",
      builtAt: new Date().toISOString(),
      fileCount: files.length,
      containsSecrets: false,
      entryPointWindows: "Install-DigitalPermitPlatform.cmd",
      entryPointUnix: "install-digital-permit-platform.sh",
    },
    null,
    2,
  ),
);

const output = await archive.generateAsync({
  type: "uint8array",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
  platform: "UNIX",
});
if (output.byteLength > 5 * 1024 * 1024) {
  throw new Error("The compressed installer source exceeds the 5 MB hosting limit.");
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, { mode: 0o600 });
console.log(
  `Created ${path.relative(root, outputPath)} (${files.length} files, ${output.byteLength} bytes).`,
);
