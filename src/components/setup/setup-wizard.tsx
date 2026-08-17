"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  ImageUp,
  PackageOpen,
  Palette,
  RefreshCcw,
  Rocket,
} from "lucide-react";
import {
  contrastRatio,
  parseSetupManifest,
  PUBLIC_IMPACT_CONFIRMATION,
  RESET_DEFAULTS_CONFIRMATION,
  SETUP_SCHEMA_VERSION,
  type SetupDeploymentPreview,
  type SetupManifest,
  type SetupModulePack,
} from "@/lib/setup/manifest";
import type { CouncilProfileView } from "@/types/council-profile";
import {
  assessLandscapeLogo,
  RECOMMENDED_LOGO_HEIGHT,
  RECOMMENDED_LOGO_WIDTH,
} from "@/lib/setup/logo-guidance";

type DeploymentProfile = "pilot" | "production";
type AuthenticationMode = "demo" | "entra";

interface SetupDraft {
  organisationName: string;
  serviceName: string;
  supportEmail: string;
  supportPhone: string;
  publicDomain: string;
  logoDataUrl: string;
  logoFileName: string;
  logoAction: "keep" | "replace" | "remove";
  showOrganisationName: boolean;
  logoScale: number;
  logoBackdrop: "none" | "white";
  primaryColour: string;
  accentColour: string;
  deploymentProfile: DeploymentProfile;
  environmentName: string;
  azureRegion: string;
  enableAi: boolean;
  seedDemoData: boolean;
  authenticationMode: AuthenticationMode;
  externalTenant: string;
  workforceTenant: string;
  modules: SetupModulePack[];
}

type SetupStepId =
  | "council"
  | "brand"
  | "publish";

interface SetupStep {
  id: SetupStepId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

const STORAGE_KEY = "dpp-local-setup-draft-v1";

const steps: SetupStep[] = [
  { id: "council", label: "Council profile", shortLabel: "Profile", icon: Building2 },
  { id: "brand", label: "Brand and logo", shortLabel: "Brand", icon: Palette },
  { id: "publish", label: "Review and publish", shortLabel: "Publish", icon: Eye },
];

const stepIndex = Object.fromEntries(
  steps.map((step, index) => [step.id, index]),
) as Record<SetupStepId, number>;

const defaultDraft: SetupDraft = {
  organisationName: "Contoso Council",
  serviceName: "Digital Permit Platform",
  supportEmail: "support@example.gov.uk",
  supportPhone: "0300 000 0000",
  publicDomain: "",
  logoDataUrl: "",
  logoFileName: "",
  logoAction: "remove",
  showOrganisationName: true,
  logoScale: 100,
  logoBackdrop: "none",
  primaryColour: "#0b2e5e",
  accentColour: "#009fe3",
  deploymentProfile: "pilot",
  environmentName: "local",
  azureRegion: "uksouth",
  enableAi: false,
  seedDemoData: true,
  authenticationMode: "demo",
  externalTenant: "",
  workforceTenant: "",
  modules: [],
};

function isHexColour(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function textColourFor(background: string) {
  return contrastRatio("#ffffff", background) >= 4.5 ? "#ffffff" : "#0b0c0e";
}

function getStepValidationIssues(
  step: SetupStepId,
  draft: SetupDraft,
  headerContrast: number,
) {
  const issues: string[] = [];

  if (step === "council") {
    if (draft.organisationName.trim().length < 2) {
      issues.push("Enter the council or authority name.");
    }
    if (draft.serviceName.trim().length < 2) {
      issues.push("Enter the public service name.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.supportEmail.trim())) {
      issues.push("Enter a valid support email address.");
    }
    if (!/^[0-9()+.\s-]{7,30}$/.test(draft.supportPhone.trim())) {
      issues.push("Enter a valid support telephone number.");
    }
  }

  if (step === "brand") {
    if (!isHexColour(draft.primaryColour)) {
      issues.push("Enter a six-digit header colour, for example #123b5d.");
    } else if (headerContrast < 4.5) {
      issues.push("Choose a darker header colour that reaches 4.5:1 contrast with white text.");
    }
    if (!isHexColour(draft.accentColour)) {
      issues.push("Enter a six-digit accent colour, for example #e35205.");
    }
  }

  return issues;
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label className="setup-field-label block font-bold text-sm text-[#243b53] mb-2" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {hint && <p className="setup-field-hint text-sm text-[#52606d] mb-2">{hint}</p>}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="setup-text-input w-full border-2 border-[#7b8794] bg-white px-3 py-2.5 text-base text-[#102a43] focus:border-[#102a43] focus:outline-[3px] focus:outline-[#ffdd00]"
      />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="grid gap-2 border-b border-[#d9e2ec] py-4 sm:grid-cols-[180px_1fr_auto] sm:items-start">
      <dt className="font-bold text-[#243b53]">{label}</dt>
      <dd className="text-[#334e68]">{value}</dd>
      <dd>
        <button type="button" onClick={onEdit} className="font-bold text-sm text-[#1d70b8] underline hover:text-[#003078]">
          Change<span className="sr-only"> {label.toLowerCase()}</span>
        </button>
      </dd>
    </div>
  );
}

function draftFromProfile(profile: CouncilProfileView): SetupDraft {
  return {
    organisationName: profile.organisationName,
    serviceName: profile.serviceName,
    supportEmail: profile.supportEmail,
    supportPhone: profile.supportPhone,
    publicDomain: profile.publicDomain ?? "",
    logoDataUrl: profile.hasLogo
      ? `/api/setup/logo/${profile.logoVersion ?? "active"}`
      : "",
    logoFileName: profile.logoFileName ?? "",
    logoAction: profile.hasLogo ? "keep" : "remove",
    showOrganisationName: profile.showOrganisationName,
    logoScale: profile.logoScale,
    logoBackdrop: profile.logoBackdrop,
    primaryColour: profile.primaryColour,
    accentColour: profile.accentColour,
    deploymentProfile: profile.deploymentProfile,
    environmentName: profile.environmentName,
    azureRegion: profile.azureRegion,
    enableAi: profile.enableAi,
    seedDemoData: profile.seedDemoData,
    authenticationMode: profile.authenticationMode,
    externalTenant: profile.externalTenant ?? "",
    workforceTenant: profile.workforceTenant ?? "",
    modules: profile.selectedModules,
  };
}

function draftFromManifest(
  manifest: SetupManifest,
  logoDataUrl: string,
): SetupDraft {
  return {
    organisationName: manifest.organisation.name,
    serviceName: manifest.organisation.serviceName,
    supportEmail: manifest.organisation.supportEmail,
    supportPhone: manifest.organisation.supportPhone,
    publicDomain: manifest.organisation.publicDomain ?? "",
    logoDataUrl,
    logoFileName: manifest.brand.logoFileName ?? "",
    logoAction: logoDataUrl ? "replace" : "remove",
    showOrganisationName: manifest.brand.showOrganisationName,
    logoScale: manifest.brand.logoScale,
    logoBackdrop: manifest.brand.logoBackdrop,
    primaryColour: manifest.brand.primaryColour,
    accentColour: manifest.brand.accentColour,
    deploymentProfile: manifest.azure.profile,
    environmentName: manifest.azure.environmentName,
    azureRegion: manifest.azure.region,
    enableAi: manifest.azure.enableAi,
    seedDemoData: manifest.azure.seedDemoData,
    authenticationMode: manifest.identity.mode,
    externalTenant: manifest.identity.externalTenant ?? "",
    workforceTenant: manifest.identity.workforceTenant ?? "",
    modules: manifest.modules,
  };
}

export function SetupWizard({
  initialProfile,
  authenticated,
  canApply,
}: {
  initialProfile: CouncilProfileView;
  authenticated: boolean;
  canApply: boolean;
}) {
  const router = useRouter();
  const initialDraft = useMemo(
    () => draftFromProfile(initialProfile),
    [initialProfile],
  );
  const [draft, setDraft] = useState<SetupDraft>(initialDraft);
  const [activeStep, setActiveStep] = useState(0);
  const [highestStep, setHighestStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [complete, setComplete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [packageMessage, setPackageMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<SetupDeploymentPreview | null>(null);
  const [normalizedManifest, setNormalizedManifest] = useState<SetupManifest | null>(null);
  const [applyState, setApplyState] = useState<"idle" | "previewing" | "applying" | "applied">("idle");
  const [confirmApply, setConfirmApply] = useState(false);
  const [appliedProfile, setAppliedProfile] = useState<CouncilProfileView | null>(null);
  const [resetting, setResetting] = useState(false);
  const [isLocalEnvironment, setIsLocalEnvironment] = useState(false);
  const [logoDimensions, setLogoDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setIsLocalEnvironment(
      new Set(["localhost", "127.0.0.1", "::1"]).has(window.location.hostname),
    );
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SetupDraft>;
        setDraft({
          ...initialDraft,
          ...parsed,
          logoAction:
            parsed.logoAction ??
            (parsed.logoDataUrl ? "replace" : initialDraft.logoAction),
          showOrganisationName:
            parsed.showOrganisationName ?? initialDraft.showOrganisationName,
          modules: initialDraft.modules,
        });
      }
      if (new URLSearchParams(window.location.search).get("resume") === "apply") {
        setActiveStep(stepIndex.publish);
        setHighestStep((current) => Math.max(current, stepIndex.publish));
        setNotice("Your setup draft has been restored. Review it before publishing changes.");
      }
    } catch {
      setNotice("The saved draft could not be loaded. A fresh preview has been opened.");
    } finally {
      setHydrated(true);
    }
  }, [initialDraft]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      setNotice("This browser could not save the draft locally.");
    }
  }, [draft, hydrated]);

  function updateDraft<K extends keyof SetupDraft>(key: K, value: SetupDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function moveToStep(index: number) {
    if (index > highestStep) return;
    setActiveStep(index);
    setComplete(false);
    setPreview(null);
    setNormalizedManifest(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nextStep() {
    const next = Math.min(activeStep + 1, steps.length - 1);
    setHighestStep((current) => Math.max(current, next));
    setActiveStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousStep() {
    setActiveStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function resetToDefaults() {
    if (
      !window.confirm(
        "Reset the live platform to the Contoso Council defaults? This removes the published logo and restores the default name, colours and support details. Licence modules and Azure deployment settings will not change.",
      )
    ) {
      return;
    }

    setResetting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/setup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: RESET_DEFAULTS_CONFIRMATION }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Platform settings could not be reset.");
      }

      window.localStorage.removeItem(STORAGE_KEY);
      setDraft(draftFromProfile(result.profile));
      setActiveStep(0);
      setHighestStep(0);
      setComplete(false);
      setPreview(null);
      setNormalizedManifest(null);
      setApplyState("idle");
      setConfirmApply(false);
      setAppliedProfile(null);
      setPackageMessage(null);
      setNotice(result.message);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Platform settings could not be reset.");
    } finally {
      setResetting(false);
    }
  }

  async function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]).has(file.type)) {
      setNotice("Choose a PNG, JPG, WebP or SVG logo.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setNotice("Choose a logo smaller than 1 MB for this local preview.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const dimensions = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const image = new window.Image();
          image.onload = () =>
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => reject(new Error("The logo preview could not be read."));
          image.src = objectUrl;
        },
      );
      setLogoDimensions(dimensions);
    } catch (error) {
      setLogoDimensions(null);
      setNotice(
        error instanceof Error ? error.message : "The logo dimensions could not be read.",
      );
      return;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateDraft("logoDataUrl", String(reader.result));
      updateDraft("logoFileName", file.name);
      updateDraft("logoAction", "replace");
      setNotice(null);
    };
    reader.readAsDataURL(file);
  }

  async function handleSetupPackage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice(null);
    setPackageMessage(null);

    try {
      if (file.size === 0 || file.size > 2 * 1024 * 1024) {
        throw new Error("Choose a setup ZIP smaller than 2 MB.");
      }
      const { default: JSZip } = await import("jszip");
      const archive = await JSZip.loadAsync(file);
      const manifestFile = archive.file("setup-manifest.json");
      if (!manifestFile) {
        throw new Error("This ZIP does not contain setup-manifest.json.");
      }
      const manifest = parseSetupManifest(
        JSON.parse(await manifestFile.async("string")),
      );

      let logoDataUrl = "";
      if (manifest.brand.logoAction === "replace") {
        const logoFileName = manifest.brand.logoFileName;
        const logoEntry = logoFileName
          ? archive.file(`assets/${logoFileName}`)
          : null;
        if (!logoEntry || !logoFileName) {
          throw new Error("The setup package is missing its council logo asset.");
        }
        const logoBytes = await logoEntry.async("uint8array");
        if (logoBytes.byteLength === 0 || logoBytes.byteLength > 1024 * 1024) {
          throw new Error("The packaged council logo must be between 1 byte and 1 MB.");
        }
        const extension = logoFileName.split(".").pop()?.toLowerCase();
        const mimeType =
          extension === "png"
            ? "image/png"
            : extension === "jpg" || extension === "jpeg"
              ? "image/jpeg"
              : extension === "webp"
                ? "image/webp"
                : extension === "svg"
                  ? "image/svg+xml"
                  : null;
        if (!mimeType) {
          throw new Error("The packaged logo must be PNG, JPEG, WebP, or SVG.");
        }
        logoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("The packaged logo could not be read."));
          reader.readAsDataURL(new Blob([new Uint8Array(logoBytes).slice()], { type: mimeType }));
        });
      }

      setDraft(draftFromManifest(manifest, logoDataUrl));
      setActiveStep(0);
      setHighestStep(steps.length - 1);
      setComplete(false);
      setPreview(null);
      setNormalizedManifest(null);
      setApplyState("idle");
      setConfirmApply(false);
      setPackageMessage(
        `Loaded ${file.name}. Review each step, then apply it as an administrator.`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The setup package could not be imported.",
      );
    }
  }

  function buildManifest(): SetupManifest {
    return {
      schemaVersion: SETUP_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      organisation: {
        name: draft.organisationName,
        serviceName: draft.serviceName,
        supportEmail: draft.supportEmail,
        supportPhone: draft.supportPhone,
        publicDomain: draft.publicDomain,
      },
      brand: {
        primaryColour: draft.primaryColour,
        accentColour: draft.accentColour,
        logoAction: draft.logoAction,
        logoFileName: draft.logoFileName || null,
        logoScale: draft.logoScale ?? 100,
        logoBackdrop: draft.logoBackdrop ?? "none",
        showOrganisationName: draft.showOrganisationName ?? true,
      },
      azure: {
        profile: draft.deploymentProfile,
        environmentName: draft.environmentName,
        region: draft.azureRegion,
        enableAi: draft.enableAi,
        seedDemoData: draft.seedDemoData,
      },
      identity: {
        mode: draft.authenticationMode,
        externalTenant: draft.externalTenant || null,
        workforceTenant: draft.workforceTenant || null,
      },
      modules: draft.modules,
    };
  }

  async function prepareConfiguration() {
    setApplyState("previewing");
    setNotice(null);
    try {
      const response = await fetch("/api/setup/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildManifest()),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Check the setup details and try again.");
      setNormalizedManifest(result.manifest);
      setPreview(result.preview);
      setComplete(true);
      setConfirmApply(false);
      setApplyState("idle");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The setup preview could not be prepared.");
      setApplyState("idle");
    }
  }

  async function applyConfiguration() {
    if (!normalizedManifest || !confirmApply || !canApply) return;
    setApplyState("applying");
    setNotice(null);
    try {
      const form = new FormData();
      form.set("manifest", JSON.stringify(normalizedManifest));
      form.set("publicImpactConfirmed", PUBLIC_IMPACT_CONFIRMATION);
      if (normalizedManifest.brand.logoAction === "replace") {
        const logoResponse = await fetch(draft.logoDataUrl);
        if (!logoResponse.ok) throw new Error("The selected logo could not be read.");
        const logoBlob = await logoResponse.blob();
        form.set(
          "logo",
          new File([logoBlob], draft.logoFileName || "council-logo", {
            type: logoBlob.type,
          }),
        );
      }

      const response = await fetch("/api/setup", { method: "PUT", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Platform settings could not be published.");
      setAppliedProfile(result.profile);
      setApplyState("applied");
      window.localStorage.removeItem(STORAGE_KEY);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Platform settings could not be published.");
      setApplyState("idle");
    }
  }

  const primaryColour = isHexColour(draft.primaryColour)
    ? draft.primaryColour
    : defaultDraft.primaryColour;
  const accentColour = isHexColour(draft.accentColour)
    ? draft.accentColour
    : defaultDraft.accentColour;
  const headerContrast = contrastRatio("#ffffff", primaryColour);
  const accentText = textColourFor(accentColour);
  const previewStyle = {
    "--preview-primary": primaryColour,
    "--preview-accent": accentColour,
    "--preview-accent-text": accentText,
  } as CSSProperties;
  const activeStepDefinition = steps[activeStep];
  const activeStepId = activeStepDefinition.id;
  const activeStepNumber = activeStep + 1;
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === steps.length - 1;
  const validationIssues = getStepValidationIssues(
    activeStepId,
    draft,
    headerContrast,
  );
  const canContinue = validationIssues.length === 0;

  return (
    <div className="setup-wizard--embedded min-h-[70vh] bg-govuk-light-grey text-govuk-black">
      <div className="mx-auto min-h-[70vh] max-w-[1200px]">
        <nav className="border-b border-govuk-mid-grey bg-white" aria-label="Setup progress">
          <div className="flex min-w-0 items-stretch px-4 sm:px-6 lg:px-8">
            <ol className="grid min-w-0 flex-1 grid-cols-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCurrent = index === activeStep;
                const isComplete = index < highestStep;
                const isAvailable = index <= highestStep;
                return (
                  <li key={step.id} className="min-w-0">
                    <button
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => moveToStep(index)}
                      aria-current={isCurrent ? "step" : undefined}
                      className={`flex min-h-[76px] w-full min-w-0 flex-col items-center justify-center gap-1 border-b-4 px-2 py-2 text-center text-sm sm:min-h-14 sm:flex-row sm:gap-2 sm:px-3 ${
                        isCurrent
                          ? "border-[#1d70b8] bg-[#e8f1f8] font-bold text-[#102a43]"
                          : isAvailable
                            ? "border-transparent text-[#334e68] hover:bg-[#f5f7fa]"
                            : "cursor-not-allowed border-transparent text-[#9fb3c8]"
                      }`}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                          isComplete
                            ? "bg-[#00703c] text-white"
                            : isCurrent
                              ? "bg-[#1d70b8] text-white"
                              : "border border-[#9fb3c8] bg-white"
                        }`}
                      >
                        {isComplete ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
                      </span>
                      <span className="sm:hidden">{step.shortLabel}</span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {canApply && (
              <button
                type="button"
                onClick={resetToDefaults}
                disabled={resetting}
                className="ml-2 hidden shrink-0 items-center gap-2 px-2 text-sm font-bold text-govuk-blue underline disabled:cursor-wait disabled:opacity-60 lg:inline-flex"
              >
                <RefreshCcw className={`h-4 w-4 ${resetting ? "animate-spin" : ""}`} />
                {resetting ? "Resetting..." : "Reset to Contoso defaults"}
              </button>
            )}
          </div>
        </nav>

        <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8 lg:py-10" id="main-content">
          <div className="mx-auto max-w-[1100px]">
            {notice && (
              <div className="mb-6 flex items-start justify-between gap-4 border-l-4 border-[#d4351c] bg-white p-4" role="alert">
                <p className="text-sm text-[#334e68]">{notice}</p>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="font-bold text-sm text-[#1d70b8] underline"
                >
                  Dismiss
                </button>
              </div>
            )}
            {packageMessage && (
              <div
                className="mb-6 flex items-start gap-3 border-l-4 border-[#1d70b8] bg-white p-4"
                role="status"
              >
                <PackageOpen className="mt-0.5 h-5 w-5 shrink-0 text-[#1d70b8]" />
                <p className="text-sm leading-6 text-[#334e68]">{packageMessage}</p>
              </div>
            )}

            {complete ? (
              <section aria-labelledby="setup-ready-title">
                <div className="mb-8 border-l-8 border-[#00703c] bg-white p-6 sm:p-8">
                  <CheckCircle2 className="mb-5 h-12 w-12 text-[#00703c]" />
                  <p className="mb-2 text-sm font-bold uppercase tracking-[0.08em] text-[#00703c]">
                    {applyState === "applied" ? "Platform published" : "Ready to publish"}
                  </p>
                  <h1 id="setup-ready-title" className="mb-4 text-3xl font-bold text-[#102a43] sm:text-4xl">
                    {applyState === "applied"
                      ? `${appliedProfile?.organisationName ?? draft.organisationName} is live`
                      : "Are you sure you want to publish?"}
                  </h1>
                  <p className="max-w-2xl text-lg leading-7 text-[#486581]">
                    {applyState === "applied"
                      ? "The council identity, branding and contact details are now active across the application."
                      : "These settings affect the live service that citizens and staff use. Check every item carefully before continuing."}
                  </p>
                </div>

                {applyState === "applied" ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="border-t-4 border-[#1d70b8] bg-white p-5">
                        <p className="truncate text-xl font-bold">{draft.serviceName}</p>
                        <p className="text-sm text-[#52606d]">Public service name</p>
                      </div>
                      <div className="border-t-4 border-[#00703c] bg-white p-5">
                        <p className="text-2xl font-bold">Live</p>
                        <p className="text-sm text-[#52606d]">Citizen and staff visibility</p>
                      </div>
                    </div>
                    <div className="mt-6 border-l-4 border-[#1d70b8] bg-white p-5 text-sm leading-6 text-[#334e68]">
                      The published presentation settings are now active for residents and staff.
                    </div>
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link
                        href="/"
                        className="inline-flex items-center gap-2 bg-[#00703c] px-5 py-3 font-bold text-white no-underline shadow-[0_2px_0_#002d18] hover:bg-[#005a30] focus:outline-[3px] focus:outline-[#ffdd00]"
                      >
                        View configured platform
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                      <Link
                        href="/admin"
                        className="inline-flex items-center gap-2 border-2 border-[#52606d] bg-white px-5 py-3 font-bold text-[#243b53] no-underline hover:bg-[#f5f7fa] focus:outline-[3px] focus:outline-[#ffdd00]"
                      >
                        Open administration
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setComplete(false);
                        setActiveStep(0);
                        setHighestStep(steps.length - 1);
                        setApplyState("idle");
                      }}
                      className="mt-6 font-bold text-[#1d70b8] underline"
                    >
                      Reconfigure this platform
                    </button>
                  </>
                ) : (
                  <>
                    <div className="grid gap-6">
                      <div className="border-t-4 border-[#1d70b8] bg-white p-5">
                        <h2 className="mb-4 text-xl font-bold text-[#102a43]">Changes visible after publication</h2>
                        <ul className="space-y-4 text-sm leading-6 text-[#334e68]">
                          {preview?.applicationChanges.map((change) => (
                            <li key={change.area} className="flex gap-3">
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#00703c]" />
                              {change.summary}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-6 bg-white p-5">
                      {!authenticated ? (
                        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h2 className="mb-1 text-lg font-bold text-[#102a43]">Administrator approval required</h2>
                            <p className="text-sm text-[#52606d]">Your draft stays in this browser while you sign in.</p>
                          </div>
                          <Link
                            href="/auth/login?callbackUrl=/setup?resume=apply"
                            className="inline-flex items-center gap-2 bg-[#1d70b8] px-5 py-3 font-bold text-white no-underline hover:bg-[#003078]"
                          >
                            Sign in as administrator
                            <ArrowRight className="h-5 w-5" />
                          </Link>
                        </div>
                      ) : !canApply ? (
                        <div className="border-l-4 border-[#d4351c] pl-4">
                          <h2 className="mb-1 text-lg font-bold text-[#102a43]">Administrator access needed</h2>
                          <p className="text-sm text-[#52606d]">Your account can review this setup but cannot apply platform-wide configuration.</p>
                        </div>
                      ) : (
                        <div>
                          {isLocalEnvironment && (
                            <div className="mb-5 border-l-4 border-[#f47738] pl-4">
                              <h2 className="mb-1 text-lg font-bold text-[#102a43]">
                                Optional local preview
                              </h2>
                              <p className="text-sm leading-6 text-[#52606d]">
                                This publishes the presentation settings only to the local application on this computer.
                              </p>
                            </div>
                          )}
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={confirmApply}
                              onChange={(event) => setConfirmApply(event.target.checked)}
                              className="mt-1 h-5 w-5 shrink-0 accent-[#00703c] focus:outline-[3px] focus:outline-[#ffdd00]"
                            />
                            <span>
                              <span className="block font-bold text-[#102a43]">
                                I understand this will change the live service for citizens and staff
                              </span>
                              <span className="mt-1 block text-sm leading-6 text-[#52606d]">
                                I have checked the council name, logo, colours and support details, and I am authorised to publish them.
                              </span>
                            </span>
                          </label>
                          <button
                            type="button"
                            disabled={!confirmApply || applyState === "applying"}
                            onClick={() => void applyConfiguration()}
                            className="mt-5 inline-flex items-center gap-2 bg-[#00703c] px-5 py-3 font-bold text-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-[3px] focus:outline-[#ffdd00]"
                          >
                            <Rocket className="h-5 w-5" />
                            {applyState === "applying"
                              ? "Publishing platform..."
                              : initialProfile.configured
                                ? "Publish updated platform"
                                : "Publish platform"}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setComplete(false);
                          setActiveStep(stepIndex.publish);
                        }}
                        className="inline-flex items-center gap-2 px-1 py-3 font-bold text-[#1d70b8] underline"
                      >
                        <ArrowLeft className="h-5 w-5" />
                        Change platform settings
                      </button>
                    </div>
                  </>
                )}
              </section>
            ) : (
              <>
                <div className="mb-8 border-b border-[#bcccdc] pb-6">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#1d70b8]">
                    <span>
                      Step {activeStepNumber} of {steps.length}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{activeStepDefinition.label}</span>
                  </div>

                  {activeStepId === "council" && (
                    <>
                      <h1 className="mb-3 text-3xl font-bold tracking-normal text-[#102a43] sm:text-4xl">Set up your council platform</h1>
                      <p className="max-w-3xl text-lg leading-7 text-[#52606d]">
                        Start with the public-facing details residents and businesses will see across the service.
                      </p>
                    </>
                  )}
                  {activeStepId === "brand" && (
                    <>
                      <h1 className="mb-3 text-3xl font-bold tracking-normal text-[#102a43] sm:text-4xl">Make it recognisably yours</h1>
                      <p className="max-w-3xl text-lg leading-7 text-[#52606d]">
                        Add an approved logo and a restrained colour palette, then check the portal preview before continuing.
                      </p>
                    </>
                  )}
                  {activeStepId === "publish" && (
                    <>
                      <h1 className="mb-3 text-3xl font-bold tracking-normal text-[#102a43] sm:text-4xl">Review platform settings</h1>
                      <p className="max-w-3xl text-lg leading-7 text-[#52606d]">
                        Check what residents and staff will see before preparing these settings for publication.
                      </p>
                    </>
                  )}
                </div>

                {activeStepId === "council" && (
                  <section className="space-y-7" aria-label="Council profile">
                    <div className="flex flex-col items-start gap-4 border-l-4 border-[#1d70b8] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="mb-1 text-lg font-bold text-[#102a43]">
                          Continue from an installer package
                        </h2>
                        <p className="text-sm leading-6 text-[#52606d]">
                          If the installation assistant created a council settings ZIP, import it here. No passwords or tokens are stored in the package.
                        </p>
                      </div>
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 border-2 border-[#1d70b8] bg-white px-4 py-2.5 font-bold text-[#1d70b8] hover:bg-[#e8f1f8] focus-within:outline-[3px] focus-within:outline-[#ffdd00]">
                        <PackageOpen className="h-5 w-5" />
                        Import setup ZIP
                        <input
                          type="file"
                          accept=".zip,application/zip"
                          onChange={(event) => void handleSetupPackage(event)}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <TextField
                        id="organisation-name"
                        label="Council name"
                        value={draft.organisationName}
                        onChange={(value) => updateDraft("organisationName", value)}
                      />
                      <TextField
                        id="service-name"
                        label="Service name"
                        value={draft.serviceName}
                        onChange={(value) => updateDraft("serviceName", value)}
                      />
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <TextField
                        id="support-email"
                        label="Support email"
                        type="email"
                        value={draft.supportEmail}
                        onChange={(value) => updateDraft("supportEmail", value)}
                      />
                      <TextField
                        id="support-phone"
                        label="Support telephone"
                        type="tel"
                        value={draft.supportPhone}
                        onChange={(value) => updateDraft("supportPhone", value)}
                      />
                    </div>
                  </section>
                )}

                {activeStepId === "brand" && (
                  <section className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_460px]" aria-label="Brand and logo">
                    <div className="space-y-7">
                      <div>
                        <FieldLabel htmlFor="council-logo">Council logo</FieldLabel>
                        <div className="mb-3 border-l-4 border-govuk-blue bg-white p-4 text-sm leading-6 text-govuk-dark-grey">
                          <p className="font-bold text-govuk-black">Use the landscape council wordmark</p>
                          <p className="mt-1 mb-0">
                            Prefer SVG for a sharp transparent logo. For PNG, JPG or WebP, use a transparent or plain background and aim for {RECOMMENDED_LOGO_WIDTH} x {RECOMMENDED_LOGO_HEIGHT}px. Minimum recommended size is 600 x 150px. Maximum file size is 1 MB.
                          </p>
                        </div>
                        <label
                          htmlFor="council-logo"
                          className="flex min-h-32 cursor-pointer items-center gap-4 border-2 border-dashed border-[#7b8794] bg-white p-5 hover:border-[#1d70b8] hover:bg-[#f5f9fc] focus-within:outline-[3px] focus-within:outline-[#ffdd00]"
                        >
                          <span className="grid h-12 w-12 shrink-0 place-items-center bg-[#e8f1f8] text-[#1d70b8]">
                            <ImageUp className="h-6 w-6" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-bold text-[#1d70b8] underline">Choose a logo</span>
                            <span className="mt-1 block text-sm text-[#52606d]">
                              Landscape SVG preferred; PNG, JPG or WebP accepted
                            </span>
                            {draft.logoFileName && (
                              <span className="mt-2 block truncate text-sm font-bold text-[#243b53]">{draft.logoFileName}</span>
                            )}
                          </span>
                          <input
                            id="council-logo"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={handleLogo}
                            className="sr-only"
                          />
                        </label>
                        {logoDimensions && (() => {
                          const assessment = assessLandscapeLogo(
                            logoDimensions.width,
                            logoDimensions.height,
                          );
                          return (
                            <p
                              className={`mt-3 border-l-4 bg-white p-3 text-sm ${
                                assessment.suitable
                                  ? "border-govuk-green text-govuk-green"
                                  : "border-govuk-red text-govuk-red"
                              }`}
                              role="status"
                            >
                              <strong>{assessment.suitable ? "Suitable logo: " : "Check this logo: "}</strong>
                              {assessment.message}
                            </p>
                          );
                        })()}
                        {draft.logoDataUrl && (
                          <label className="mt-4 flex cursor-pointer items-start gap-3 border-y border-govuk-mid-grey bg-white p-4">
                            <input
                              type="checkbox"
                              className="mt-1 h-5 w-5 shrink-0"
                              checked={draft.showOrganisationName ?? true}
                              onChange={(event) =>
                                updateDraft("showOrganisationName", event.target.checked)
                              }
                            />
                            <span>
                              <strong className="block">Show council name beside the logo</strong>
                              <span className="mt-1 block text-sm text-govuk-dark-grey">
                                Turn this off when the uploaded landscape wordmark already includes the full council name.
                              </span>
                            </span>
                          </label>
                        )}
                        {draft.logoDataUrl && (
                          <div className="mt-4 border-y border-govuk-mid-grey bg-white p-4">
                            <label htmlFor="logo-scale" className="flex items-center justify-between">
                              <strong>Logo size</strong>
                              <span className="text-sm font-bold text-govuk-dark-grey">
                                {draft.logoScale ?? 100}%
                              </span>
                            </label>
                            <input
                              id="logo-scale"
                              type="range"
                              min={50}
                              max={200}
                              step={5}
                              value={draft.logoScale ?? 100}
                              onChange={(event) =>
                                updateDraft("logoScale", Number(event.target.value))
                              }
                              className="mt-2 w-full"
                              aria-describedby="logo-scale-hint"
                            />
                            <span
                              id="logo-scale-hint"
                              className="mt-1 block text-sm text-govuk-dark-grey"
                            >
                              Scale the logo in the header between 50% and 200% without re-uploading it.
                            </span>
                            <label className="mt-4 flex cursor-pointer items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1 h-5 w-5 shrink-0"
                                checked={draft.logoBackdrop === "white"}
                                onChange={(event) =>
                                  updateDraft(
                                    "logoBackdrop",
                                    event.target.checked ? "white" : "none",
                                  )
                                }
                              />
                              <span>
                                <strong className="block">Add a white panel behind the logo</strong>
                                <span className="mt-1 block text-sm text-govuk-dark-grey">
                                  Off by default so transparent PNG logos keep their transparency. Turn
                                  it on only if a dark logo is hard to see on the header colour.
                                </span>
                              </span>
                            </label>
                          </div>
                        )}
                        {draft.logoDataUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              updateDraft("logoDataUrl", "");
                              updateDraft("logoFileName", "");
                              updateDraft("logoAction", "remove");
                              setLogoDimensions(null);
                            }}
                            className="mt-2 text-sm font-bold text-[#d4351c] underline"
                          >
                            Remove logo
                          </button>
                        )}
                        {draft.logoAction === "remove" && initialProfile.hasLogo && (
                          <button
                            type="button"
                            onClick={() => {
                              updateDraft(
                                "logoDataUrl",
                                `/api/setup/logo/${initialProfile.logoVersion ?? "active"}`,
                              );
                              updateDraft("logoFileName", initialProfile.logoFileName ?? "council-logo");
                              updateDraft("logoAction", "keep");
                            }}
                            className="mt-2 ml-4 text-sm font-bold text-[#1d70b8] underline"
                          >
                            Keep current logo
                          </button>
                        )}
                      </div>

                      <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                          <FieldLabel htmlFor="primary-colour">Header colour</FieldLabel>
                          <div className="flex border-2 border-[#7b8794] bg-white focus-within:outline-[3px] focus-within:outline-[#ffdd00]">
                            <input
                              id="primary-colour-picker"
                              aria-label="Choose header colour"
                              type="color"
                              value={primaryColour}
                              onChange={(event) => updateDraft("primaryColour", event.target.value)}
                              className="h-12 w-14 cursor-pointer border-0 bg-white p-1"
                            />
                            <input
                              id="primary-colour"
                              value={draft.primaryColour}
                              onChange={(event) => updateDraft("primaryColour", event.target.value)}
                              className="min-w-0 flex-1 border-0 px-2 font-mono uppercase outline-none"
                              maxLength={7}
                            />
                          </div>
                          <p className={`mt-2 text-sm font-bold ${headerContrast >= 4.5 ? "text-[#00703c]" : "text-[#d4351c]"}`}>
                            {headerContrast >= 4.5 ? "Passes" : "Needs attention"} · {headerContrast.toFixed(1)}:1 with white text
                          </p>
                        </div>

                        <div>
                          <FieldLabel htmlFor="accent-colour">Accent colour</FieldLabel>
                          <div className="flex border-2 border-[#7b8794] bg-white focus-within:outline-[3px] focus-within:outline-[#ffdd00]">
                            <input
                              id="accent-colour-picker"
                              aria-label="Choose accent colour"
                              type="color"
                              value={accentColour}
                              onChange={(event) => updateDraft("accentColour", event.target.value)}
                              className="h-12 w-14 cursor-pointer border-0 bg-white p-1"
                            />
                            <input
                              id="accent-colour"
                              value={draft.accentColour}
                              onChange={(event) => updateDraft("accentColour", event.target.value)}
                              className="min-w-0 flex-1 border-0 px-2 font-mono uppercase outline-none"
                              maxLength={7}
                            />
                          </div>
                          <p className="mt-2 text-sm text-[#52606d]">Button text changes automatically for contrast.</p>
                        </div>
                      </div>
                    </div>

                    <div className="xl:sticky xl:top-6 xl:self-start">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="mb-0 flex items-center gap-2 text-base font-bold text-[#243b53]">
                          <Eye className="h-4 w-4" /> Live preview
                        </h2>
                        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#627d98]">Desktop</span>
                      </div>
                      <div className="overflow-hidden border border-[#9fb3c8] bg-white shadow-[0_3px_12px_rgba(16,42,67,0.12)]" style={previewStyle}>
                        <div
                          className="flex min-h-20 items-center justify-between gap-3 px-5 py-4"
                          style={{ backgroundColor: "var(--preview-primary)", color: "white" }}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {draft.logoDataUrl ? (
                              <span
                                className={`flex h-11 max-w-36 items-center ${
                                  draft.logoBackdrop === "white"
                                    ? "rounded-sm bg-white px-2 py-1"
                                    : ""
                                }`}
                              >
                                <Image
                                  src={draft.logoDataUrl}
                                  alt="Uploaded council logo preview"
                                  width={140}
                                  height={24}
                                  unoptimized
                                  className="h-auto max-w-full object-contain"
                                  style={{
                                    width: `${Math.round(120 * ((draft.logoScale ?? 100) / 100))}px`,
                                  }}
                                />
                              </span>
                            ) : (
                              <span className="grid h-11 w-11 shrink-0 place-items-center border-2 border-white text-sm font-bold">
                                {draft.organisationName
                                  .split(/\s+/)
                                  .slice(0, 2)
                                  .map((word) => word[0])
                                  .join("")
                                  .toUpperCase() || "RC"}
                              </span>
                            )}
                            {(!draft.logoDataUrl || draft.showOrganisationName !== false) && (
                              <span className="truncate text-sm font-bold">
                                {draft.organisationName || "Your council"}
                              </span>
                            )}
                          </div>
                          <span className="text-xs">Sign in</span>
                        </div>
                        <div className="h-1.5" style={{ backgroundColor: "var(--preview-accent)" }} />
                        <div className="border-b border-[#d9e2ec] px-5 py-3 text-sm font-bold text-[#243b53]">
                          {draft.serviceName || "Permits and licensing"}
                        </div>
                        <div className="min-h-[310px] bg-[#f7f8fa] p-6">
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#627d98]">Online services</p>
                          <h3 className="mb-3 text-2xl font-bold text-[#102a43]">Apply for a licence or permit</h3>
                          <p className="mb-6 text-sm leading-6 text-[#52606d]">
                            Find a service, check what you need and track your application online.
                          </p>
                          <button
                            type="button"
                            className="px-4 py-2.5 text-sm font-bold shadow-[0_2px_0_rgba(0,0,0,0.35)]"
                            style={{ backgroundColor: "var(--preview-accent)", color: "var(--preview-accent-text)" }}
                          >
                            Browse services
                          </button>
                          <div className="mt-7 grid grid-cols-2 gap-3">
                            <div className="border-t-4 border-[#1d70b8] bg-white p-3">
                              <span className="block text-sm font-bold text-[#102a43]">My applications</span>
                              <span className="mt-1 block text-xs text-[#627d98]">Save and track progress</span>
                            </div>
                            <div className="border-t-4 border-[#00703c] bg-white p-3">
                              <span className="block text-sm font-bold text-[#102a43]">Get help</span>
                              <span className="mt-1 block text-xs text-[#627d98]">Contact the service</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {activeStepId === "publish" && (
                  <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]" aria-label="Review setup">
                    <div>
                      <h2 className="mb-3 text-xl font-bold text-[#102a43]">Configuration summary</h2>
                      <dl className="border-t border-[#9fb3c8]">
                        <SummaryRow
                          label="Council"
                          value={
                            <>
                              <span className="block font-bold">{draft.organisationName}</span>
                              <span className="block text-sm mt-1">{draft.serviceName}</span>
                            </>
                          }
                          onEdit={() => moveToStep(stepIndex.council)}
                        />
                        <SummaryRow
                          label="Brand"
                          value={
                            <span className="flex flex-wrap items-center gap-3">
                              <span className="h-6 w-6 border border-[#7b8794]" style={{ backgroundColor: primaryColour }} />
                              <span className="font-mono text-sm uppercase">{primaryColour}</span>
                              <span className="h-6 w-6 border border-[#7b8794]" style={{ backgroundColor: accentColour }} />
                              <span className="font-mono text-sm uppercase">{accentColour}</span>
                            </span>
                          }
                          onEdit={() => moveToStep(stepIndex.brand)}
                        />
                      </dl>
                    </div>

                    <aside className="border-t-4 border-[#1d70b8] bg-white p-5 xl:self-start" aria-labelledby="readiness-title">
                      <h2 id="readiness-title" className="mb-4 text-lg font-bold text-[#102a43]">Readiness</h2>
                      <ul className="space-y-4 text-sm">
                        <li className="flex gap-3">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#00703c]" />
                          Council profile complete
                        </li>
                        <li className="flex gap-3">
                          {headerContrast >= 4.5 ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#00703c]" />
                          ) : (
                            <Palette className="h-5 w-5 shrink-0 text-[#d4351c]" />
                          )}
                          Header contrast {headerContrast >= 4.5 ? "passes" : "needs attention"}
                        </li>
                      </ul>
                      <div className="mt-5 border-l-4 border-[#d4351c] bg-[#f3f2f1] p-4 text-sm leading-6 text-[#0b0c0e]">
                        Publishing changes the live service used by citizens and staff. Check the logo, colours and contact details carefully.
                      </div>
                    </aside>
                  </section>
                )}

                {validationIssues.length > 0 && (
                  <div
                    id="step-validation"
                    className="mt-8 border-l-4 border-[#f47738] bg-white p-5"
                    role="status"
                    aria-live="polite"
                  >
                    <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-[#102a43]">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-[#b35900]" />
                      Complete this step to continue
                    </h2>
                    <ul className="list-disc space-y-1 pl-6 text-sm leading-6 text-[#334e68]">
                      {validationIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#bcccdc] pt-6">
                  <button
                    type="button"
                    onClick={previousStep}
                    disabled={isFirstStep}
                    className="inline-flex items-center gap-2 px-1 py-2 font-bold text-[#1d70b8] underline disabled:invisible"
                  >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                  </button>

                  {!isLastStep ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      disabled={!canContinue}
                      aria-describedby={!canContinue ? "step-validation" : undefined}
                      className="inline-flex items-center gap-2 bg-[#00703c] px-5 py-3 font-bold text-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-[3px] focus:outline-[#ffdd00]"
                    >
                      Save and continue
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void prepareConfiguration()}
                      disabled={!canContinue || applyState === "previewing"}
                      aria-describedby={!canContinue ? "step-validation" : undefined}
                      className="inline-flex items-center gap-2 bg-[#00703c] px-5 py-3 font-bold text-white shadow-[0_2px_0_#002d18] hover:bg-[#005a30] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-[3px] focus:outline-[#ffdd00]"
                    >
                      <Rocket className="h-5 w-5" />
                      {applyState === "previewing" ? "Checking settings..." : "Review publication"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}