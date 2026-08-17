"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  ExternalLink,
  KeyRound,
  Laptop,
  LockKeyhole,
  PackageOpen,
  PoundSterling,
  Server,
  ShieldCheck,
  Store,
} from "lucide-react";
import { buildCustomerInstallerBundle } from "@/lib/setup/installer-bundle";
import {
  parseSetupManifest,
  SETUP_SCHEMA_VERSION,
  type SetupManifest,
  type SetupModulePack,
} from "@/lib/setup/manifest";
import { buildSetupPackage } from "@/lib/setup/package";

const STORAGE_KEY = "dpp-customer-installer-v1";

type InstallerStepId = "welcome" | "platform" | "azure" | "identity" | "review";
type DeploymentProfile = "pilot" | "production";
type IdentityMode = "demo" | "entra";

interface InstallerDraft {
  organisationName: string;
  serviceName: string;
  supportEmail: string;
  supportPhone: string;
  profile: DeploymentProfile;
  environmentName: string;
  region: string;
  enableAi: boolean;
  identityMode: IdentityMode;
  externalTenant: string;
  workforceTenant: string;
  modules: SetupModulePack[];
}

const steps: Array<{
  id: InstallerStepId;
  label: string;
  shortLabel: string;
  icon: typeof Cloud;
}> = [
  { id: "welcome", label: "Before you start", shortLabel: "Start", icon: ShieldCheck },
  { id: "platform", label: "Council service", shortLabel: "Council", icon: Building2 },
  { id: "azure", label: "Azure plan", shortLabel: "Azure", icon: Cloud },
  { id: "identity", label: "Accounts", shortLabel: "Accounts", icon: KeyRound },
  { id: "review", label: "Download installer", shortLabel: "Download", icon: Download },
];

const serviceOptions: Array<{
  id: SetupModulePack;
  label: string;
  description: string;
}> = [
  { id: "blue-badge", label: "Blue Badge", description: "Applications, evidence and mobility assessment" },
  { id: "taxi-private-hire", label: "Taxi and private hire", description: "Driver, vehicle and operator licensing" },
  { id: "premises", label: "Premises licensing", description: "Applications, consultation and decisions" },
  { id: "street-trading", label: "Street trading", description: "Annual, daily and event consents" },
];

const defaultDraft: InstallerDraft = {
  organisationName: "",
  serviceName: "Permits and licensing",
  supportEmail: "",
  supportPhone: "",
  profile: "pilot",
  environmentName: "council-permits",
  region: "uksouth",
  enableAi: false,
  identityMode: "demo",
  externalTenant: "",
  workforceTenant: "",
  modules: ["blue-badge", "taxi-private-hire"],
};

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  hint?: string;
}) {
  return (
    <div className="govuk-form-group">
      <label className="govuk-label" htmlFor={id}>{label}</label>
      {hint && <p className="govuk-hint">{hint}</p>}
      <input
        id={id}
        type={type}
        className="govuk-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function buildManifest(draft: InstallerDraft): SetupManifest {
  return parseSetupManifest({
    schemaVersion: SETUP_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    organisation: {
      name: draft.organisationName,
      serviceName: draft.serviceName,
      supportEmail: draft.supportEmail,
      supportPhone: draft.supportPhone,
      publicDomain: null,
    },
    brand: {
      primaryColour: "#0b2e5e",
      accentColour: "#009fe3",
      logoAction: "remove",
      logoFileName: null,
      showOrganisationName: true,
    },
    azure: {
      profile: draft.profile,
      environmentName: draft.environmentName,
      region: draft.region,
      enableAi: draft.enableAi,
      seedDemoData: draft.profile === "pilot",
    },
    identity: {
      mode: draft.identityMode,
      externalTenant: draft.externalTenant || null,
      workforceTenant: draft.workforceTenant || null,
    },
    modules: draft.modules,
  });
}

function validationIssues(step: InstallerStepId, draft: InstallerDraft) {
  const issues: string[] = [];
  if (step === "platform") {
    if (draft.organisationName.trim().length < 2) issues.push("Enter the council or authority name.");
    if (draft.serviceName.trim().length < 2) issues.push("Enter the service name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.supportEmail.trim())) {
      issues.push("Enter a valid support email address.");
    }
    if (!/^[0-9()+.\s-]{7,30}$/.test(draft.supportPhone.trim())) {
      issues.push("Enter a valid support telephone number.");
    }
    if (draft.modules.length === 0) issues.push("Choose at least one service to launch.");
  }
  if (step === "azure") {
    if (!/^[a-z][a-z0-9-]{0,28}[a-z0-9]$/.test(draft.environmentName)) {
      issues.push("Use 2-30 lowercase letters, numbers or hyphens for the environment name.");
    }
  }
  if (step === "identity") {
    if (draft.profile === "production" && draft.identityMode !== "entra") {
      issues.push("Production requires Microsoft Entra identity.");
    }
    if (draft.identityMode === "entra" && !draft.externalTenant.trim()) {
      issues.push("Enter the citizen External ID tenant.");
    }
    if (draft.identityMode === "entra" && !draft.workforceTenant.trim()) {
      issues.push("Enter the council workforce tenant.");
    }
  }
  return issues;
}

export function AzureInstallerWizard({
  deploymentSourceUrl,
}: {
  deploymentSourceUrl: string | null;
}) {
  const [draft, setDraft] = useState<InstallerDraft>(defaultDraft);
  const [activeStep, setActiveStep] = useState(0);
  const [highestStep, setHighestStep] = useState(0);
  const [readyAcknowledged, setReadyAcknowledged] = useState(false);
  const [deploymentAcknowledged, setDeploymentAcknowledged] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setDraft({ ...defaultDraft, ...JSON.parse(saved) });
    } catch {
      setError("A previous installer draft could not be restored.");
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      setError("This browser could not save the installer draft locally.");
    }
  }, [draft]);

  const step = steps[activeStep];
  const issues = validationIssues(step.id, draft);
  const canContinue =
    issues.length === 0 &&
    (step.id !== "welcome" || readyAcknowledged) &&
    (step.id !== "review" || deploymentAcknowledged);

  function update<K extends keyof InstallerDraft>(key: K, value: InstallerDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
    setDownloaded(false);
  }

  function next() {
    const nextStep = Math.min(activeStep + 1, steps.length - 1);
    setHighestStep((current) => Math.max(current, nextStep));
    setActiveStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setActiveStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function moveTo(index: number) {
    if (index > highestStep) return;
    setActiveStep(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleService(id: SetupModulePack) {
    update(
      "modules",
      draft.modules.includes(id)
        ? draft.modules.filter((module) => module !== id)
        : [...draft.modules, id],
    );
  }

  async function downloadInstaller() {
    if (!deploymentSourceUrl || !canContinue) return;
    setDownloading(true);
    setError("");
    try {
      const manifest = buildManifest(draft);
      const setupPackage = await buildSetupPackage({ manifest });
      const sourceResponse = await fetch(deploymentSourceUrl, { cache: "no-store" });
      if (!sourceResponse.ok) {
        throw new Error("The deployment project is temporarily unavailable. Try again shortly.");
      }
      const sourceBundle = new Uint8Array(await sourceResponse.arrayBuffer());
      const setupPackageName = `${draft.environmentName}-setup.zip`;
      const installer = await buildCustomerInstallerBundle({
        sourceBundle,
        setupPackage,
        setupPackageName,
      });
      const blob = new Blob([new Uint8Array(installer).slice()], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
      link.download = `digital-permit-platform-${draft.environmentName}-${timestamp}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "The customer installer could not be created.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f2f1] text-[#0b0c0e]">
      <header className="border-b-4 border-[#00a4ef] bg-[#0b2e5e] text-white">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-5 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center bg-white text-[#0b2e5e]">
              <Cloud className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">Get Digital Permit Platform</p>
              <p className="text-sm text-white/75">Customer Azure installer</p>
            </div>
          </div>
          <span className="hidden items-center gap-2 text-sm text-white/80 sm:flex">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Customer-owned deployment
          </span>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-76px)] w-full min-w-0 max-w-[1180px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="min-w-0 max-w-full border-b border-[#b1b4b6] bg-white lg:border-b-0 lg:border-r" aria-label="Installer progress">
          <div className="min-w-0 max-w-full px-4 py-4 sm:px-6 lg:sticky lg:top-0 lg:px-6 lg:py-8">
            <p className="hidden text-sm font-bold lg:block">Installation progress</p>
            <ol className="flex max-w-full gap-2 overflow-x-auto lg:mt-4 lg:block lg:space-y-1">
              {steps.map((item, index) => {
                const Icon = item.icon;
                const current = index === activeStep;
                const available = index <= highestStep;
                const complete = index < highestStep;
                return (
                  <li key={item.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      disabled={!available}
                      aria-current={current ? "step" : undefined}
                      onClick={() => moveTo(index)}
                      className={`flex min-w-[112px] items-center gap-3 border-b-4 px-3 py-3 text-left text-sm lg:w-full lg:min-w-0 lg:border-b-0 lg:border-l-4 ${
                        current
                          ? "border-[#1d70b8] bg-[#f3f2f1] font-bold"
                          : available
                            ? "border-transparent hover:bg-[#f3f2f1]"
                            : "cursor-not-allowed border-transparent text-[#b1b4b6]"
                      }`}
                    >
                      <span className={`grid h-7 w-7 shrink-0 place-items-center ${complete ? "bg-[#00703c] text-white" : current ? "bg-[#1d70b8] text-white" : "border border-[#b1b4b6]"}`}>
                        {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <span className="lg:hidden">{item.shortLabel}</span>
                      <span className="hidden lg:inline">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-7 hidden border-l-4 border-[#1d70b8] bg-[#f3f2f1] p-4 text-sm leading-6 text-[#505a5f] lg:block">
              No Azure credentials, passwords or tokens are sent to this website. Microsoft sign-in happens later on your computer.
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-12" id="main-content">
          <div className="max-w-3xl">
            <p className="mb-2 text-sm font-bold text-[#1d70b8]">Step {activeStep + 1} of {steps.length}</p>

            {error && (
              <div className="govuk-error-summary" role="alert">
                <h2 className="govuk-error-summary__title">There is a problem</h2>
                <div className="govuk-error-summary__body">{error}</div>
              </div>
            )}

            {step.id === "welcome" && (
              <section>
                <h1>Install Digital Permit Platform</h1>
                <p className="max-w-2xl text-lg text-[#505a5f]">
                  Create a council-owned permits service in an Azure subscription without cloning code or constructing deployment commands.
                </p>
                <div className="my-8 grid gap-px border border-[#b1b4b6] bg-[#b1b4b6] sm:grid-cols-3">
                  {[
                    [ShieldCheck, "Your subscription", "Resources and data remain in the council Azure estate"],
                    [Laptop, "Microsoft sign-in", "Authentication opens locally and supports council MFA"],
                    [CheckCircle2, "Preview first", "Azure changes are shown before you approve deployment"],
                  ].map(([Icon, title, description]) => {
                    const Visual = Icon as typeof ShieldCheck;
                    return (
                      <div key={String(title)} className="bg-white p-5">
                        <Visual className="mb-4 h-7 w-7 text-[#1d70b8]" aria-hidden="true" />
                        <h2 className="mb-2 text-lg">{String(title)}</h2>
                        <p className="mb-0 text-sm text-[#505a5f]">{String(description)}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="border-l-4 border-[#ffdd00] bg-white p-5">
                  <h2 className="text-lg">Before you start</h2>
                  <ul className="list-disc space-y-2 pl-6 text-sm leading-6">
                    <li>An active Azure subscription approved for this service.</li>
                    <li>A deployment owner with Contributor plus User Access Administrator, or equivalent Owner access.</li>
                    <li>For production identity, an External ID administrator and a workforce tenant administrator.</li>
                    <li>A Windows 10/11 computer is the simplest path. macOS and Linux are also supported.</li>
                    <li>Local computer administrator rights are only needed when required Microsoft tools are missing and device policy requires elevated installation.</li>
                  </ul>
                </div>
                <label className="mt-6 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5"
                    checked={readyAcknowledged}
                    onChange={(event) => setReadyAcknowledged(event.target.checked)}
                  />
                  <span>
                    <strong className="block">I have an approved Azure subscription and deployment owner</strong>
                    <span className="mt-1 block text-sm text-[#505a5f]">The installer will check permissions and policy during the Azure preview.</span>
                  </span>
                </label>
              </section>
            )}

            {step.id === "platform" && (
              <section>
                <h1>Describe the council service</h1>
                <p className="text-[#505a5f]">These basics create the deployment package. Logo, colours and detailed styling are published later inside the new application.</p>
                <div className="mt-7 grid gap-x-6 sm:grid-cols-2">
                  <Field id="installer-organisation" label="Council or authority name" value={draft.organisationName} onChange={(value) => update("organisationName", value)} />
                  <Field id="installer-service" label="Public service name" value={draft.serviceName} onChange={(value) => update("serviceName", value)} />
                  <Field id="installer-email" label="Support email" type="email" value={draft.supportEmail} onChange={(value) => update("supportEmail", value)} />
                  <Field id="installer-phone" label="Support telephone" type="tel" value={draft.supportPhone} onChange={(value) => update("supportPhone", value)} />
                </div>
                <fieldset className="mt-2">
                  <legend className="govuk-label">Services to include initially</legend>
                  <p className="govuk-hint">All licence types remain editable after deployment.</p>
                  <div className="grid gap-px border border-[#b1b4b6] bg-[#b1b4b6] sm:grid-cols-2">
                    {serviceOptions.map((service) => {
                      const selected = draft.modules.includes(service.id);
                      return (
                        <label key={service.id} className={`flex cursor-pointer items-start gap-3 bg-white p-4 ${selected ? "shadow-[inset_4px_0_0_#1d70b8]" : ""}`}>
                          <input type="checkbox" className="mt-1 h-5 w-5" checked={selected} onChange={() => toggleService(service.id)} />
                          <span><strong className="block">{service.label}</strong><span className="mt-1 block text-sm text-[#505a5f]">{service.description}</span></span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </section>
            )}

            {step.id === "azure" && (
              <section>
                <h1>Choose the Azure plan</h1>
                <p className="text-[#505a5f]">The installer uses secure defaults and creates one resource group for this environment.</p>
                <fieldset className="mt-7">
                  <legend className="govuk-label">Environment profile</legend>
                  <div className="grid gap-px border border-[#b1b4b6] bg-[#b1b4b6] sm:grid-cols-2">
                    {([
                      ["pilot", "Pilot", "Lower scale, synthetic accounts and sample data"],
                      ["production", "Production", "Production identity, no sample data and stricter checks"],
                    ] as const).map(([value, label, description]) => (
                      <label key={value} className={`cursor-pointer bg-white p-5 ${draft.profile === value ? "shadow-[inset_0_-4px_0_#1d70b8]" : ""}`}>
                        <input type="radio" name="installer-profile" className="mr-3 h-5 w-5 align-middle" checked={draft.profile === value} onChange={() => { update("profile", value); if (value === "production") update("identityMode", "entra"); }} />
                        <strong>{label}</strong><span className="mt-2 block text-sm text-[#505a5f]">{description}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-7 grid gap-x-6 sm:grid-cols-2">
                  <Field id="installer-environment" label="Environment name" hint="Used for Azure resource names and tags" value={draft.environmentName} onChange={(value) => update("environmentName", value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
                  <div className="govuk-form-group">
                    <label className="govuk-label" htmlFor="installer-region">Primary Azure region</label>
                    <p className="govuk-hint">Subject to council policy and service availability.</p>
                    <select id="installer-region" className="govuk-select" value={draft.region} onChange={(event) => update("region", event.target.value)}>
                      <option value="uksouth">UK South</option>
                      <option value="ukwest">UK West</option>
                      <option value="northeurope">North Europe</option>
                      <option value="westeurope">West Europe</option>
                      <option value="swedencentral">Sweden Central</option>
                    </select>
                  </div>
                </div>
                <label className="flex cursor-pointer items-start justify-between gap-4 border-y border-[#b1b4b6] bg-white p-5">
                  <span><strong className="block">Include policy assistance</strong><span className="mt-1 block text-sm text-[#505a5f]">Adds optional Azure OpenAI resources. Availability and quota are checked before deployment.</span></span>
                  <input type="checkbox" className="mt-1 h-5 w-5" checked={draft.enableAi} onChange={(event) => update("enableAi", event.target.checked)} />
                </label>
              </section>
            )}

            {step.id === "identity" && (
              <section>
                <h1>Choose citizen and staff accounts</h1>
                <p className="text-[#505a5f]">Production keeps public users separate from council workforce access.</p>
                <fieldset className="mt-7">
                  <legend className="sr-only">Account model</legend>
                  <div className="space-y-3">
                    {([
                      ["demo", "Pilot accounts", "Synthetic users for evaluation only"],
                      ["entra", "Microsoft Entra", "Citizen self-registration plus council workforce accounts"],
                    ] as const).map(([value, label, description]) => (
                      <label key={value} className={`flex cursor-pointer items-start gap-3 border-2 bg-white p-5 ${draft.identityMode === value ? "border-[#1d70b8]" : "border-[#b1b4b6]"}`}>
                        <input type="radio" name="installer-identity" className="mt-1 h-5 w-5" disabled={draft.profile === "production" && value === "demo"} checked={draft.identityMode === value} onChange={() => update("identityMode", value)} />
                        <span><strong className="block">{label}</strong><span className="mt-1 block text-sm text-[#505a5f]">{description}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {draft.identityMode === "entra" && (
                  <div className="mt-7">
                    <Field id="installer-external-tenant" label="Citizen External ID tenant" hint="Tenant domain or ID owned by the council" value={draft.externalTenant} onChange={(value) => update("externalTenant", value)} />
                    <Field id="installer-workforce-tenant" label="Council workforce tenant" hint="Verified domain or tenant ID used by staff" value={draft.workforceTenant} onChange={(value) => update("workforceTenant", value)} />
                    <div className="border-l-4 border-[#1d70b8] bg-white p-5 text-sm leading-6 text-[#505a5f]">
                      Microsoft prompts a directory administrator for consent locally. The hosted installer never sees that consent or any generated credential.
                    </div>
                  </div>
                )}
              </section>
            )}

            {step.id === "review" && (
              <section>
                <h1>Review and download</h1>
                <p className="text-[#505a5f]">You will receive one ZIP. Extract it and double-click the Windows Start file.</p>

                <div className="my-7 grid gap-px border border-[#b1b4b6] bg-[#b1b4b6] sm:grid-cols-2">
                  {[
                    [Building2, "Council", draft.organisationName],
                    [Cloud, "Azure", `${draft.profile} in ${draft.region}`],
                    [KeyRound, "Identity", draft.identityMode === "entra" ? "Microsoft Entra" : "Pilot accounts"],
                    [Store, "Initial services", String(draft.modules.length)],
                  ].map(([Icon, label, value]) => {
                    const Visual = Icon as typeof Building2;
                    return (
                      <div key={String(label)} className="flex gap-3 bg-white p-4">
                        <Visual className="h-5 w-5 shrink-0 text-[#1d70b8]" aria-hidden="true" />
                        <div><span className="block text-sm text-[#505a5f]">{String(label)}</span><strong className="block capitalize">{String(value)}</strong></div>
                      </div>
                    );
                  })}
                </div>

                <h2>Azure resources</h2>
                <div className="grid gap-px border border-[#b1b4b6] bg-[#b1b4b6] sm:grid-cols-2">
                  {[
                    [Server, "Container Apps", "Web, worker and migration workloads"],
                    [Database, "Managed data", "PostgreSQL, Redis and Blob Storage"],
                    [LockKeyhole, "Security", "Key Vault, managed identities and private networking"],
                    [Activity, "Operations", "Registry, logs, metrics and application tracing"],
                  ].map(([Icon, title, description]) => {
                    const Visual = Icon as typeof Server;
                    return (
                      <div key={String(title)} className="flex gap-3 bg-white p-4">
                        <Visual className="h-5 w-5 shrink-0 text-[#505a5f]" aria-hidden="true" />
                        <div><strong className="block">{String(title)}</strong><span className="mt-1 block text-sm text-[#505a5f]">{String(description)}</span></div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-7 flex gap-4 border-l-4 border-[#ffdd00] bg-white p-5">
                  <PoundSterling className="h-6 w-6 shrink-0 text-[#594d00]" aria-hidden="true" />
                  <div><h2 className="mb-1 text-lg">Azure charges apply</h2><p className="mb-0 text-sm text-[#505a5f]">Resources are billed to the selected council subscription. The local assistant shows the resource preview before asking for approval; review council policy, quota and expected cost.</p></div>
                </div>

                <label className="mt-6 flex cursor-pointer items-start gap-3">
                  <input type="checkbox" className="mt-1 h-5 w-5" checked={deploymentAcknowledged} onChange={(event) => setDeploymentAcknowledged(event.target.checked)} />
                  <span><strong className="block">I understand this package can create billable Azure resources</strong><span className="mt-1 block text-sm text-[#505a5f]">No resource is created until the deployment owner reviews the preview and confirms locally.</span></span>
                </label>

                {downloaded && (
                  <div className="mt-6 border-l-4 border-[#00703c] bg-white p-5" role="status">
                    <h2 className="mb-2 text-lg">Installer downloaded</h2>
                    <ol className="list-decimal space-y-2 pl-6 text-sm leading-6">
                      <li>Extract the newly downloaded ZIP on the deployment owner&apos;s computer.</li>
                      <li>Read START-HERE.txt.</li>
                      <li>On Windows, double-click Install-DigitalPermitPlatform.cmd.</li>
                      <li>Complete Microsoft sign-in and review the Azure preview.</li>
                    </ol>
                    <p className="mt-4 mb-0 text-sm leading-6 text-[#505a5f]">
                      On macOS, double-click <strong>Install-DigitalPermitPlatform.command</strong>. If an archive tool removes executable permissions, run <code>bash install-digital-permit-platform.sh</code> from Terminal instead; this fallback does not require the execute bit.
                    </p>
                  </div>
                )}
              </section>
            )}

            {issues.length > 0 && (
              <div className="mt-7 border-l-4 border-[#d4351c] bg-white p-5" role="status">
                <h2 className="mb-2 text-lg">Complete this step</h2>
                <ul className="list-disc space-y-1 pl-6 text-sm">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
              </div>
            )}

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#b1b4b6] pt-6">
              <button type="button" onClick={back} disabled={activeStep === 0} className="font-bold text-[#1d70b8] underline disabled:invisible">
                <ArrowLeft className="mr-2 inline h-5 w-5" />Back
              </button>
              {step.id === "review" ? (
                <button type="button" className="govuk-button govuk-button--start inline-flex items-center gap-2" disabled={!canContinue || downloading || !deploymentSourceUrl} onClick={() => void downloadInstaller()}>
                  <PackageOpen className="h-5 w-5" />
                  {downloading ? "Building installer..." : "Download customer installer"}
                </button>
              ) : (
                <button type="button" className="govuk-button inline-flex items-center gap-2" disabled={!canContinue} onClick={next}>
                  Save and continue<ArrowRight className="h-5 w-5" />
                </button>
              )}
            </div>

            <footer className="mt-12 border-t border-[#b1b4b6] pt-5 text-xs leading-5 text-[#505a5f]">
              Built with Microsoft Azure Developer CLI, Bicep and managed identities. <a href="https://learn.microsoft.com/azure/developer/azure-developer-cli/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">Microsoft documentation<ExternalLink className="h-3 w-3" /></a>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
