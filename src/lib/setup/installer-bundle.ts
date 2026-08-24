import JSZip from "jszip";

const MAX_SOURCE_BUNDLE_BYTES = 5 * 1024 * 1024;
const MAX_SETUP_PACKAGE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_ENTRIES = 1_500;
const MAX_EXPANDED_SOURCE_BYTES = 30 * 1024 * 1024;

function assertSafeArchivePath(fileName: string) {
  const normalized = fileName.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    /^[a-z]:\//i.test(normalized) ||
    normalized.split("/").includes("..")
  ) {
    throw new Error("The deployment source contains an unsafe file path.");
  }
}

function commonRootPrefix(fileNames: string[]) {
  const firstSegments = new Set(
    fileNames
      .filter((fileName) => fileName.includes("/"))
      .map((fileName) => fileName.split("/")[0]),
  );
  if (firstSegments.size !== 1) return "";
  const [segment] = [...firstSegments];
  return fileNames.every(
    (fileName) => fileName === `${segment}/` || fileName.startsWith(`${segment}/`),
  )
    ? `${segment}/`
    : "";
}

export async function buildCustomerInstallerBundle(input: {
  sourceBundle: Uint8Array;
  setupPackage: Uint8Array;
  setupPackageName?: string;
}) {
  if (
    input.sourceBundle.byteLength === 0 ||
    input.sourceBundle.byteLength > MAX_SOURCE_BUNDLE_BYTES
  ) {
    throw new Error("The deployment source bundle has an invalid size.");
  }
  if (
    input.setupPackage.byteLength === 0 ||
    input.setupPackage.byteLength > MAX_SETUP_PACKAGE_BYTES
  ) {
    throw new Error("The council setup package has an invalid size.");
  }

  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(input.sourceBundle, {
      createFolders: false,
    });
  } catch {
    throw new Error("The deployment source is not a valid ZIP archive.");
  }

  const entries = Object.values(archive.files);
  if (entries.length === 0 || entries.length > MAX_SOURCE_ENTRIES) {
    throw new Error("The deployment source contains an invalid number of files.");
  }

  let expandedBytes = 0;
  for (const entry of entries) {
    assertSafeArchivePath(entry.name);
    if (entry.dir) continue;
    const data = (entry as unknown as {
      _data?: { uncompressedSize?: number };
    })._data;
    expandedBytes += Number(data?.uncompressedSize ?? 0);
  }
  if (expandedBytes > MAX_EXPANDED_SOURCE_BYTES) {
    throw new Error("The expanded deployment source is too large.");
  }

  const rootPrefix = commonRootPrefix(entries.map((entry) => entry.name));
  const requiredLauncher = `${rootPrefix}Install-DigitalPermitPlatform.cmd`;
  if (!archive.file(requiredLauncher)) {
    throw new Error("The deployment source does not contain the Windows Start file.");
  }
  const unixLaunchers = [
    `${rootPrefix}Install-DigitalPermitPlatform.command`,
    `${rootPrefix}install-digital-permit-platform.sh`,
  ];
  for (const launcherPath of unixLaunchers) {
    const launcher = archive.file(launcherPath);
    if (!launcher) {
      throw new Error(`The deployment source does not contain ${launcherPath}.`);
    }
    launcher.unixPermissions = 0o100755;
  }

  const setupPackageName =
    input.setupPackageName?.replace(/[^A-Za-z0-9._-]/g, "-") ||
    "customer-setup.zip";
  archive.file(`${rootPrefix}${setupPackageName}`, input.setupPackage);
  archive.file(
    `${rootPrefix}START-HERE.txt`,
    [
      "DIGITAL PERMIT PLATFORM - START HERE",
      "",
      "Windows: double-click Install-DigitalPermitPlatform.cmd",
      "macOS: double-click Install-DigitalPermitPlatform.command",
      "Linux: open a terminal in this folder and run ./install-digital-permit-platform.sh",
      "",
      "If macOS reports Permission denied, open Terminal in this folder and run:",
      "bash install-digital-permit-platform.sh",
      "",
      "Microsoft sign-in happens on this computer. The hosted installer never receives your Azure credentials.",
      "Azure displays a resource preview and asks for approval before deployment.",
      "Local computer administrator rights are only needed if required Microsoft tools must be installed and device policy requires elevation.",
      "Azure deployment rights are separate: use Owner, or Contributor plus User Access Administrator, on the target Azure scope.",
      `Council setup package: ${setupPackageName}`,
      "",
      "Support and detailed guidance: docs/installer.md",
    ].join("\r\n"),
  );

  return archive.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "UNIX",
  });
}
