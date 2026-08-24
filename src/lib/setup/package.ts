import JSZip from "jszip";
import type { SetupManifest } from "./manifest";

export async function buildSetupPackage(input: {
  manifest: SetupManifest;
  logo?: { data: Uint8Array; fileName: string };
}) {
  const manifest = structuredClone(input.manifest);
  const archive = new JSZip();

  if (input.logo) {
    manifest.brand.logoAction = "replace";
    manifest.brand.logoFileName = input.logo.fileName;
    archive.file(`assets/${input.logo.fileName}`, input.logo.data);
  } else {
    manifest.brand.logoAction = "remove";
    manifest.brand.logoFileName = null;
  }

  archive.file("setup-manifest.json", JSON.stringify(manifest, null, 2));
  archive.file(
    "README.txt",
    "Digital Permit Platform setup package\n\nThis package contains no passwords, tokens, or client secrets. Review setup-manifest.json before use.\n",
  );

  return archive.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}