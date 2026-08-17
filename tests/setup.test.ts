import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSetupDeploymentPreview,
  hasPublicImpactConfirmation,
  hasResetDefaultsConfirmation,
  parseSetupManifest,
  PUBLIC_IMPACT_CONFIRMATION,
  RESET_DEFAULTS_CONFIRMATION,
} from "../src/lib/setup/manifest";
import { validateSetupLogo } from "../src/lib/setup/logo";
import { assessLandscapeLogo } from "../src/lib/setup/logo-guidance";
import {
  DEFAULT_COUNCIL_PROFILE,
  DEFAULT_COUNCIL_PRESENTATION,
  resolveInfrastructureIntent,
  resolveSelectedModules,
} from "../src/lib/setup/profile";
import { buildSetupPackage } from "../src/lib/setup/package";
import { buildCustomerInstallerBundle } from "../src/lib/setup/installer-bundle";
import JSZip from "jszip";
import {
  buildAzdEnvironmentValues,
  buildIdentityBootstrapArguments,
  isVersionAtLeast,
  parseSemanticVersion,
  parseSetupDeployArguments,
} from "../scripts/setup/deploy-config";

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "1.0",
    generatedAt: "2026-08-11T10:00:00.000Z",
    organisation: {
      name: "Rivermere Council",
      serviceName: "Permits and licensing",
      supportEmail: "permits@rivermere.gov.uk",
      supportPhone: "0300 123 4100",
      publicDomain: "permits.rivermere.gov.uk",
    },
    brand: {
      primaryColour: "#123b5d",
      accentColour: "#e35205",
      logoAction: "replace",
      logoFileName: "rivermere-logo.svg",
    },
    azure: {
      profile: "pilot",
      environmentName: "rivermere-pilot",
      region: "uksouth",
      enableAi: false,
      seedDemoData: true,
    },
    identity: {
      mode: "demo",
      externalTenant: null,
      workforceTenant: null,
    },
    modules: ["blue-badge", "taxi-private-hire"],
    ...overrides,
  };
}

function executableBits(value: number | string | null | undefined) {
  const permissions =
    typeof value === "string" ? Number.parseInt(value, 8) : (value ?? 0);
  return permissions & 0o111;
}

describe("setup manifest", () => {
  it("accepts only the exact public-impact acknowledgement", () => {
    assert.equal(
      hasPublicImpactConfirmation(PUBLIC_IMPACT_CONFIRMATION),
      true,
    );
    assert.equal(hasPublicImpactConfirmation("true"), false);
    assert.equal(hasPublicImpactConfirmation(null), false);
  });

  it("accepts only the exact Contoso reset acknowledgement", () => {
    assert.equal(
      hasResetDefaultsConfirmation(RESET_DEFAULTS_CONFIRMATION),
      true,
    );
    assert.equal(hasResetDefaultsConfirmation("reset-defaults"), false);
    assert.equal(hasResetDefaultsConfirmation(null), false);
  });

  it("normalizes and accepts a valid pilot manifest", () => {
    const parsed = parseSetupManifest(manifest());

    assert.equal(parsed.organisation.supportEmail, "permits@rivermere.gov.uk");
    assert.equal(parsed.azure.environmentName, "rivermere-pilot");
    assert.deepEqual(parsed.modules, ["blue-badge", "taxi-private-hire"]);
    assert.equal(parsed.brand.showOrganisationName, true);
  });

  it("allows a full council wordmark to replace adjacent organisation text", () => {
    const parsed = parseSetupManifest(
      manifest({
        brand: {
          primaryColour: "#123b5d",
          accentColour: "#e35205",
          logoAction: "replace",
          logoFileName: "rivermere-logo.svg",
          showOrganisationName: false,
        },
      }),
    );

    assert.equal(parsed.brand.showOrganisationName, false);
  });

  it("accepts production intent only with Entra and no demo data", () => {
    const parsed = parseSetupManifest(
      manifest({
        azure: {
          profile: "production",
          environmentName: "rivermere-prod",
          region: "uksouth",
          enableAi: true,
          seedDemoData: false,
        },
        identity: {
          mode: "entra",
          externalTenant: "rivermereexternal.onmicrosoft.com",
          workforceTenant: "rivermere.gov.uk",
        },
      }),
    );

    assert.equal(parsed.azure.profile, "production");
    assert.equal(parsed.identity.mode, "entra");
  });

  it("rejects unsafe production and incomplete Entra settings", () => {
    assert.throws(
      () =>
        parseSetupManifest(
          manifest({
            azure: {
              profile: "production",
              environmentName: "rivermere-prod",
              region: "uksouth",
              enableAi: false,
              seedDemoData: true,
            },
          }),
        ),
      /Production-intent environments/,
    );

    assert.throws(
      () =>
        parseSetupManifest(
          manifest({
            identity: {
              mode: "entra",
              externalTenant: null,
              workforceTenant: null,
            },
          }),
        ),
      /External ID tenant/,
    );
  });

  it("rejects an inaccessible header colour", () => {
    assert.throws(
      () =>
        parseSetupManifest(
          manifest({
            brand: {
              primaryColour: "#f3c548",
              accentColour: "#e35205",
              logoAction: "remove",
              logoFileName: null,
            },
          }),
        ),
      /at least 4.5:1 contrast/,
    );
  });

  it("maps only non-secret deployment intent", () => {
    const preview = buildSetupDeploymentPreview(parseSetupManifest(manifest()));
    const serialized = JSON.stringify(preview);

    assert.equal(preview.requiresAzureDeployment, true);
    assert.equal(preview.requiresDirectoryConsent, false);
    assert.deepEqual(
      preview.azureValues.map(({ name, value }) => [name, value]),
      [
        ["AZURE_LOCATION", "uksouth"],
        ["ENABLE_AI", "false"],
        ["AUTHENTICATION_MODE", "demo"],
        ["SEED_DEMO_DATA", "true"],
        ["NEXT_PUBLIC_DEMO_MODE", "true"],
      ],
    );
    assert.doesNotMatch(serialized, /password|clientsecret|access[_-]?token/i);
  });
});

describe("setup logo", () => {
  it("guides councils toward a sufficiently large landscape wordmark", () => {
    assert.equal(assessLandscapeLogo(1200, 300).suitable, true);
    assert.match(assessLandscapeLogo(400, 400).message, /too square/);
    assert.match(assessLandscapeLogo(500, 125).message, /at least 600 x 150px/);
  });

  it("accepts and fingerprints a passive SVG", () => {
    const source = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20"><title>Rivermere Council</title><path d="M0 0h100v20H0z"/></svg>',
    );
    const logo = validateSetupLogo({
      data: source,
      fileName: "Rivermere Council identity.svg",
      mimeType: "image/svg+xml",
    });

    assert.equal(logo.fileName, "Rivermere-Council-identity.svg");
    assert.equal(logo.hash.length, 64);
  });

  it("rejects active SVG and mismatched bitmap content", () => {
    assert.throws(
      () =>
        validateSetupLogo({
          data: new TextEncoder().encode("<svg><script>alert(1)</script></svg>"),
          fileName: "unsafe.svg",
          mimeType: "image/svg+xml",
        }),
      /active or externally referenced/,
    );
    assert.throws(
      () =>
        validateSetupLogo({
          data: new TextEncoder().encode("not an image"),
          fileName: "spoofed.png",
          mimeType: "image/png",
        }),
      /does not match a PNG/,
    );
  });
});

describe("platform publication boundary", () => {
  it("restores every Contoso presentation field without deployment or module state", () => {
    assert.deepEqual(DEFAULT_COUNCIL_PRESENTATION, {
      setupVersion: "1.0",
      organisationName: "Contoso Council",
      serviceName: DEFAULT_COUNCIL_PROFILE.serviceName,
      supportEmail: "support@example.gov.uk",
      supportPhone: "0300 000 0000",
      primaryColour: "#0b2e5e",
      accentColour: "#009fe3",
      logoFileName: null,
      logoMimeType: null,
      logoHash: null,
      logoData: null,
      logoScale: 100,
      logoBackdrop: "none",
      showOrganisationName: true,
      setupCompletedAt: null,
      configuredById: null,
    });
    assert.equal("selectedModules" in DEFAULT_COUNCIL_PRESENTATION, false);
    assert.equal("azureRegion" in DEFAULT_COUNCIL_PRESENTATION, false);
  });

  it("preserves installed infrastructure and identity intent", () => {
    const parsed = parseSetupManifest(manifest());
    const previous = {
      publicDomain: "live.example.gov.uk",
      deploymentProfile: "production",
      environmentName: "live-prod",
      azureRegion: "ukwest",
      enableAi: true,
      seedDemoData: false,
      authenticationMode: "entra",
      externalTenant: "external.example.gov.uk",
      workforceTenant: "workforce.example.gov.uk",
    };

    assert.deepEqual(resolveInfrastructureIntent(previous, parsed), previous);
  });

  it("leaves module selection under the module registry's control", () => {
    const parsed = parseSetupManifest(manifest({ modules: ["blue-badge"] }));

    assert.deepEqual(
      resolveSelectedModules(
        { selectedModules: ["premises", "street-trading"] },
        parsed,
      ),
      ["premises", "street-trading"],
    );
  });
});

describe("setup package", () => {
  it("contains a portable manifest and explicit logo asset without secrets", async () => {
    const parsed = parseSetupManifest(manifest());
    const logoData = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><title>Rivermere</title></svg>',
    );
    const packageData = await buildSetupPackage({
      manifest: parsed,
      logo: { data: logoData, fileName: "rivermere-logo.svg" },
    });
    const archive = await JSZip.loadAsync(packageData);
    const packageManifest = JSON.parse(
      await archive.file("setup-manifest.json")!.async("string"),
    );

    assert.deepEqual(Object.keys(archive.files).sort(), [
      "README.txt",
      "assets/",
      "assets/rivermere-logo.svg",
      "setup-manifest.json",
    ]);
    assert.equal(packageManifest.brand.logoAction, "replace");
    assert.equal(packageManifest.brand.logoFileName, "rivermere-logo.svg");
    assert.doesNotMatch(
      JSON.stringify(packageManifest),
      /password|clientsecret|access[_-]?token/i,
    );
  });
});

describe("customer installer bundle", () => {
  it("combines the deployment project and council package behind a Start file", async () => {
    const source = new JSZip();
    source.file("Install-DigitalPermitPlatform.cmd", "@echo off");
    source.file("Install-DigitalPermitPlatform.command", "#!/usr/bin/env bash");
    source.file("install-digital-permit-platform.sh", "#!/usr/bin/env bash");
    source.file("scripts/setup/Install-DigitalPermitPlatform.ps1", "Write-Host start");
    source.file("azure.yaml", "name: digital-permit-platform");
    const setupPackage = await buildSetupPackage({
      manifest: parseSetupManifest(manifest()),
    });

    const bundle = await buildCustomerInstallerBundle({
      sourceBundle: await source.generateAsync({ type: "uint8array" }),
      setupPackage,
      setupPackageName: "rivermere-setup.zip",
    });
    const archive = await JSZip.loadAsync(bundle);

    assert.ok(archive.file("Install-DigitalPermitPlatform.cmd"));
    assert.equal(
      executableBits(
        archive.file("Install-DigitalPermitPlatform.command")?.unixPermissions,
      ),
      0o111,
    );
    assert.equal(
      executableBits(
        archive.file("install-digital-permit-platform.sh")?.unixPermissions,
      ),
      0o111,
    );
    assert.ok(archive.file("rivermere-setup.zip"));
    assert.match(
      await archive.file("START-HERE.txt")!.async("string"),
      /double-click Install-DigitalPermitPlatform\.command/,
    );
  });

  it("rejects a source archive without the customer Start file", async () => {
    const source = new JSZip();
    source.file("azure.yaml", "name: digital-permit-platform");
    await assert.rejects(
      buildCustomerInstallerBundle({
        sourceBundle: await source.generateAsync({ type: "uint8array" }),
        setupPackage: new Uint8Array([1]),
      }),
      /does not contain the Windows Start file/,
    );
  });
});

describe("customer deployment launcher", () => {
  it("requires the supported Azure Developer CLI version", () => {
    assert.deepEqual(parseSemanticVersion("azd version 1.25.3"), [1, 25, 3]);
    assert.equal(isVersionAtLeast([1, 25, 0], [1, 25, 0]), true);
    assert.equal(isVersionAtLeast([1, 24, 9], [1, 25, 0]), false);
  });

  it("parses a non-mutating package plan", () => {
    assert.deepEqual(
      parseSetupDeployArguments([
        "--package",
        "council.zip",
        "--subscription",
        "11111111-1111-4111-8111-111111111111",
        "--plan",
      ]),
      {
        packagePath: "council.zip",
        subscription: "11111111-1111-4111-8111-111111111111",
        plan: true,
        yes: false,
        help: false,
      },
    );
    assert.throws(
      () => parseSetupDeployArguments(["--package", "council.zip", "--unknown"]),
      /Unknown option/,
    );
  });

  it("maps pilot values without secrets", () => {
    const parsed = parseSetupManifest(manifest());
    const values = buildAzdEnvironmentValues(parsed);

    assert.equal(values.get("AUTHENTICATION_MODE"), "demo");
    assert.equal(values.get("SEED_DEMO_DATA"), "true");
    assert.equal(values.get("NEXT_PUBLIC_APP_NAME"), "Permits and licensing");
    assert.doesNotMatch(
      JSON.stringify([...values]),
      /password|clientsecret|access[_-]?token/i,
    );
  });

  it("hands full identity to the existing citizen and workforce bootstrap", () => {
    const parsed = parseSetupManifest(
      manifest({
        azure: {
          profile: "production",
          environmentName: "rivermere-prod",
          region: "uksouth",
          enableAi: false,
          seedDemoData: false,
        },
        identity: {
          mode: "entra",
          externalTenant: "rivermere-external.onmicrosoft.com",
          workforceTenant: "11111111-1111-4111-8111-111111111111",
        },
      }),
    );
    const values = buildAzdEnvironmentValues(parsed);
    const args = buildIdentityBootstrapArguments(
      parsed,
      "22222222-2222-4222-8222-222222222222",
    );

    assert.equal(values.get("SEED_DEMO_DATA"), "false");
    assert.equal(values.get("NEXT_PUBLIC_DEMO_MODE"), "false");
    assert.ok(args?.includes("rivermere-external.onmicrosoft.com"));
    assert.ok(args?.includes("--deploy"));
  });
});