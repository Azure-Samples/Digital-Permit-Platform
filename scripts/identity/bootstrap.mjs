import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import {
  APPLICANT_PROVIDER_ID,
  assertManagedUserFlow,
  BOOTSTRAP_APP_TAG,
  buildApplicationCreatePayload,
  buildExternalIdUserFlowPayload,
  buildPasswordCredential,
  buildRedirectUris,
  escapeODataString,
  mergeFlowApplications,
  mergeWorkforceRoles,
  normalizeApplicationOrigin,
  normalizeTenantSubdomain,
  requireGuid,
  safeCommandLabel,
  WORKFORCE_PROVIDER_ID,
} from "./bootstrap-config.mjs";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const azExecutable = process.platform === "win32" ? "az.cmd" : "az";
const azdExecutable = process.platform === "win32" ? "azd.exe" : "azd";
const graphBaseUrl = "https://graph.microsoft.com/v1.0";
const placeholderGuid = "00000000-0000-4000-8000-000000000000";
const externalGraphScopes = [
  "Application.ReadWrite.All",
  "EventListener.ReadWrite.All",
];
const workforceGraphScopes = ["Application.ReadWrite.All"];

function printUsage() {
  console.log(`Usage:
  npm run setup:identity -- --external-tenant <tenant-id-or-domain> [options]

Options:
  --environment <name>          Select or create an azd environment
  --external-subdomain <name>  Override automatic external subdomain discovery
  --workforce-tenant <id>      Override the current Azure CLI tenant
  --application-url <url>      Override SERVICE_WEB_URI
  --application-name <name>    Override NEXT_PUBLIC_APP_NAME
  --subscription <guid>        Azure subscription for a new environment
  --location <region>          Azure location for a new environment
  --secret-days <1-730>        Client secret lifetime (default: 180)
  --rotate-secrets             Add and activate new client credentials
  --deploy                     Run azd up after identity setup
  --yes                        Skip setup confirmation; sign-in prompts may remain
  --plan                       Show the planned configuration without changes
  --help                       Show this help`);
}

export function parseArguments(argv) {
  const options = {
    secretDays: 180,
    rotateSecrets: false,
    deploy: false,
    yes: false,
    plan: false,
  };
  const valueOptions = new Map([
    ["--environment", "environment"],
    ["--external-tenant", "externalTenant"],
    ["--external-subdomain", "externalSubdomain"],
    ["--workforce-tenant", "workforceTenant"],
    ["--application-url", "applicationUrl"],
    ["--application-name", "applicationName"],
    ["--subscription", "subscription"],
    ["--location", "location"],
    ["--secret-days", "secretDays"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (valueOptions.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      options[valueOptions.get(argument)] =
        argument === "--secret-days" ? Number(value) : value;
      index += 1;
      continue;
    }
    if (argument === "--rotate-secrets") options.rotateSecrets = true;
    else if (argument === "--deploy") options.deploy = true;
    else if (argument === "--yes") options.yes = true;
    else if (argument === "--plan") options.plan = true;
    else if (argument === "--help") options.help = true;
    else throw new Error(`Unknown option: ${argument}`);
  }

  if (
    !Number.isInteger(options.secretDays) ||
    options.secretDays < 1 ||
    options.secretDays > 730
  ) {
    throw new Error("--secret-days must be an integer between 1 and 730.");
  }
  if (options.subscription) {
    options.subscription = requireGuid(
      options.subscription,
      "Azure subscription ID",
    );
  }
  if (options.location && !/^[a-z0-9]+$/.test(options.location)) {
    throw new Error("--location must be an Azure region name such as uksouth.");
  }
  return options;
}

function run(executable, args, { allowFailure = false, inherit = false } = {}) {
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    if (allowFailure) return null;
    throw new Error(`Unable to run ${executable}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    if (allowFailure) return null;
    const detail = result.stderr?.trim().split("\n").at(-1) || "command failed";
    throw new Error(`${safeCommandLabel(executable, args)} failed: ${detail}`);
  }
  return inherit ? "" : result.stdout.trim();
}

function runAzd(args, options) {
  return run(azdExecutable, ["--cwd", projectRoot, ...args], options);
}

function getAzdValue(name) {
  return runAzd(["env", "get-value", name, "--no-prompt"], {
    allowFailure: true,
  });
}

function setAzdValue(name, value) {
  runAzd(["env", "set", name, value, "--no-prompt"]);
}

function isConfiguredValue(value) {
  return Boolean(
    value &&
      value !== "disabled" &&
      value !== placeholderGuid &&
      !value.startsWith("00000000-"),
  );
}

function ensureEnvironment(
  requestedEnvironment,
  interactive,
  subscription,
  location,
) {
  if (requestedEnvironment) {
    const environments = JSON.parse(
      runAzd(["env", "list", "--output", "json"]),
    );
    const exists = environments.some(
      (environment) => environment.Name === requestedEnvironment,
    );
    if (exists) {
      runAzd(["env", "select", requestedEnvironment, "--no-prompt"]);
      if (subscription) setAzdValue("AZURE_SUBSCRIPTION_ID", subscription);
      if (location) setAzdValue("AZURE_LOCATION", location);
    } else {
      runAzd([
        "env",
        "new",
        requestedEnvironment,
        ...(subscription ? ["--subscription", subscription] : []),
        ...(location ? ["--location", location] : []),
        "--no-prompt",
      ]);
    }
    return requestedEnvironment;
  }

  const currentEnvironment = getAzdValue("AZURE_ENV_NAME");
  if (currentEnvironment) return currentEnvironment;

  if (!interactive) {
    throw new Error("No azd environment is selected. Pass --environment <name>.");
  }
  return null;
}

function decodeTokenPermissions(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    );
    return new Set([
      ...(payload.scp?.split(" ") ?? []),
      ...(Array.isArray(payload.roles) ? payload.roles : []),
    ]);
  } catch {
    return new Set();
  }
}

function getGraphToken(tenant, label, scopes) {
  const scopeArgument = scopes
    .map((scope) => `https://graph.microsoft.com/${scope}`)
    .join(" ");
  const tokenArgs = [
    "account",
    "get-access-token",
    "--tenant",
    tenant,
    "--scope",
    scopeArgument,
    "--query",
    "accessToken",
    "--output",
    "tsv",
    "--only-show-errors",
  ];
  let token = run(azExecutable, tokenArgs, { allowFailure: true });
  const granted = token ? decodeTokenPermissions(token) : new Set();
  const missing = scopes.filter((scope) => !granted.has(scope));

  if (!token || missing.length > 0) {
    console.log(`\nMicrosoft Entra sign-in required for ${label}.`);
    run(
      azExecutable,
      [
        "login",
        "--tenant",
        tenant,
        "--allow-no-subscriptions",
        "--scope",
        scopeArgument,
        "--output",
        "none",
        "--only-show-errors",
      ],
      { inherit: true },
    );
    token = run(azExecutable, tokenArgs);
  }

  const finalPermissions = decodeTokenPermissions(token);
  const finalMissing = scopes.filter((scope) => !finalPermissions.has(scope));
  if (finalMissing.length > 0) {
    throw new Error(
      `${label} did not grant required Microsoft Graph scopes: ${finalMissing.join(", ")}.`,
    );
  }
  return token;
}

async function graphRequest(token, method, path, body) {
  const url = path.startsWith("https://") ? path : `${graphBaseUrl}${path}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });

    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : 1000 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message =
        errorBody?.error?.message ?? `${response.status} ${response.statusText}`;
      throw new Error(`Microsoft Graph ${method} ${path} failed: ${message}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }
  throw new Error(`Microsoft Graph ${method} ${path} exceeded retry limit.`);
}

async function graphCollection(token, path) {
  const values = [];
  let nextPath = path;
  while (nextPath) {
    const page = await graphRequest(token, "GET", nextPath);
    values.push(...(page.value ?? []));
    nextPath = page["@odata.nextLink"] ?? null;
  }
  return values;
}

async function getOrganization(token) {
  const organizations = await graphCollection(
    token,
    "/organization?$select=id,displayName,verifiedDomains",
  );
  if (organizations.length !== 1) {
    throw new Error("Unable to identify the signed-in Microsoft Entra tenant.");
  }
  return organizations[0];
}

function tenantSubdomainFromOrganization(organization) {
  const domain = organization.verifiedDomains?.find(
    (candidate) =>
      candidate.name?.endsWith(".onmicrosoft.com") &&
      (candidate.isInitial || candidate.isDefault),
  );
  if (!domain) {
    throw new Error(
      "External tenant subdomain could not be discovered. Pass --external-subdomain.",
    );
  }
  return normalizeTenantSubdomain(domain.name);
}

async function findApplication(token, clientId, displayName, markerTag) {
  const matchedByClientId = isConfiguredValue(clientId);
  const filter = matchedByClientId
    ? `appId eq '${escapeODataString(clientId)}'`
    : `displayName eq '${escapeODataString(displayName)}'`;
  const applications = await graphCollection(
    token,
    `/applications?$filter=${encodeURIComponent(filter)}&$select=id,appId,displayName,web,appRoles,tags,passwordCredentials`,
  );
  if (applications.length > 1) {
    throw new Error(`More than one app registration is named ${displayName}.`);
  }
  const application = applications[0] ?? null;
  if (
    application &&
    !matchedByClientId &&
    !application.tags?.includes(markerTag)
  ) {
    throw new Error(
      `App registration ${displayName} already exists but is not owned by setup:identity. Set its client ID in azd or choose another application name.`,
    );
  }
  return application;
}

async function ensureApplication({
  token,
  clientId,
  displayName,
  redirectUris,
  workforce,
  markerTag,
}) {
  let application = await findApplication(
    token,
    clientId,
    displayName,
    markerTag,
  );
  const appRoles = workforce
    ? mergeWorkforceRoles(application?.appRoles ?? [])
    : [];

  const tags = [...new Set([...(application?.tags ?? []), BOOTSTRAP_APP_TAG, markerTag])];

  if (!application) {
    application = await graphRequest(
      token,
      "POST",
      "/applications",
      buildApplicationCreatePayload({
        displayName,
        redirectUris,
        appRoles,
        tags,
      }),
    );
    console.log(`Created app registration: ${displayName}`);
  } else {
    await graphRequest(token, "PATCH", `/applications/${application.id}`, {
      web: {
        redirectUris,
        implicitGrantSettings: {
          enableAccessTokenIssuance: false,
          enableIdTokenIssuance: false,
        },
      },
      ...(workforce ? { appRoles } : {}),
      tags,
    });
    console.log(`Updated app registration: ${displayName}`);
  }
  return { ...application, appRoles };
}

async function ensureServicePrincipal(token, application, assignmentRequired) {
  const servicePrincipals = await graphCollection(
    token,
    `/servicePrincipals?$filter=${encodeURIComponent(`appId eq '${application.appId}'`)}&$select=id,appId,appRoleAssignmentRequired`,
  );
  let servicePrincipal = servicePrincipals[0];
  if (!servicePrincipal) {
    servicePrincipal = await graphRequest(token, "POST", "/servicePrincipals", {
      appId: application.appId,
    });
  }
  if (servicePrincipal.appRoleAssignmentRequired !== assignmentRequired) {
    await graphRequest(
      token,
      "PATCH",
      `/servicePrincipals/${servicePrincipal.id}`,
      { appRoleAssignmentRequired: assignmentRequired },
    );
  }
  return servicePrincipal;
}

async function ensureUserFlow(token, displayName, applicantAppId) {
  const flows = await graphCollection(
    token,
    "/identity/authenticationEventsFlows?$select=id,displayName",
  );
  const matches = flows.filter((flow) => flow.displayName === displayName);
  if (matches.length > 1) {
    throw new Error(`More than one user flow is named ${displayName}.`);
  }
  if (matches.length === 0) {
    const flow = await graphRequest(
      token,
      "POST",
      "/identity/authenticationEventsFlows",
      buildExternalIdUserFlowPayload({ displayName, appId: applicantAppId }),
    );
    console.log(`Created and associated External ID user flow: ${displayName}`);
    return flow;
  }

  const flow = await graphRequest(
    token,
    "GET",
    `/identity/authenticationEventsFlows/${matches[0].id}`,
  );
  assertManagedUserFlow(flow);
  await graphRequest(
    token,
    "PATCH",
    `/identity/authenticationEventsFlows/${flow.id}`,
    { conditions: mergeFlowApplications(flow, applicantAppId) },
  );
  console.log(`Verified External ID user flow association: ${displayName}`);
  return flow;
}

async function addApplicationPassword(token, application, displayName, secretDays) {
  const credential = await graphRequest(
    token,
    "POST",
    `/applications/${application.id}/addPassword`,
    buildPasswordCredential(displayName, secretDays),
  );
  if (!credential.secretText) {
    throw new Error(`Microsoft Graph did not return a secret for ${displayName}.`);
  }
  return credential;
}

async function removeApplicationPassword(token, application, keyId) {
  await graphRequest(
    token,
    "POST",
    `/applications/${application.id}/removePassword`,
    { keyId },
  );
}

function optionalGuid(value) {
  try {
    return requireGuid(value, "Credential key ID");
  } catch {
    return null;
  }
}

async function ensureCredential({
  token,
  application,
  displayName,
  secretDays,
  rotate,
  secretName,
  keyIdName,
  previousKeyIdName,
  expiresName,
}) {
  const existingSecret = getAzdValue(secretName);
  const storedKeyId = optionalGuid(getAzdValue(keyIdName));
  const inferredCredential = storedKeyId
    ? application.passwordCredentials?.find(
        (credential) => credential.keyId === storedKeyId,
      )
    : application.passwordCredentials?.length === 1
      ? application.passwordCredentials[0]
      : null;

  if (isConfiguredValue(existingSecret) && !rotate) {
    if (storedKeyId && !inferredCredential) {
      throw new Error(
        `${secretName} no longer matches an active Entra credential. Rerun with --rotate-secrets.`,
      );
    }
    if (inferredCredential?.keyId) {
      setAzdValue(keyIdName, inferredCredential.keyId);
      setAzdValue(expiresName, inferredCredential.endDateTime);
    } else {
      console.warn(
        `Credential expiry for ${secretName} could not be inferred; use --rotate-secrets to establish tracked metadata.`,
      );
    }
    return {
      previousKeyId: optionalGuid(getAzdValue(previousKeyIdName)),
      created: false,
    };
  }

  const credential = await addApplicationPassword(
    token,
    application,
    displayName,
    secretDays,
  );
  const previousValues = new Map([
    [secretName, existingSecret ?? "disabled"],
    [keyIdName, getAzdValue(keyIdName) ?? "none"],
    [previousKeyIdName, getAzdValue(previousKeyIdName) ?? "none"],
    [expiresName, getAzdValue(expiresName) ?? "unknown"],
  ]);
  try {
    if (storedKeyId) setAzdValue(previousKeyIdName, storedKeyId);
    setAzdValue(keyIdName, credential.keyId);
    setAzdValue(expiresName, credential.endDateTime);
    setAzdValue(secretName, credential.secretText);
  } catch (error) {
    try {
      for (const [name, value] of previousValues) setAzdValue(name, value);
    } catch {
      throw new Error(
        `${error.message} Local rollback also failed; Entra credential ${credential.keyId} remains active for safe recovery.`,
      );
    }
    await removeApplicationPassword(token, application, credential.keyId);
    throw error;
  }

  return { previousKeyId: storedKeyId, created: true };
}

async function prunePreviousCredential({
  token,
  application,
  previousKeyId,
  previousKeyIdName,
}) {
  if (!previousKeyId) return;
  await removeApplicationPassword(token, application, previousKeyId);
  setAzdValue(previousKeyIdName, "none");
}

function printPlan(options) {
  if (!options.externalTenant || !options.externalSubdomain) {
    throw new Error(
      "--plan requires --external-tenant and --external-subdomain.",
    );
  }
  if (!options.workforceTenant || !options.applicationUrl) {
    throw new Error(
      "--plan requires --workforce-tenant and --application-url.",
    );
  }
  const applicationName = options.applicationName ?? "Digital Permit Platform";
  const environment = options.environment ?? "pilot";
  normalizeApplicationOrigin(options.applicationUrl);
  normalizeTenantSubdomain(options.externalSubdomain);
  console.log(`Identity bootstrap plan (${environment})
- Create or update ${applicationName} - ${environment} - Applicants
- Register ${buildRedirectUris(options.applicationUrl, APPLICANT_PROVIDER_ID).length} applicant callback URLs
- Create or update and associate an email/password External ID user flow
- Create or update ${applicationName} - ${environment} - Workforce
- Configure Dpp.Reviewer, Dpp.Manager, and Dpp.Administrator app roles
- Require workforce app-role assignment
- Create ${options.secretDays}-day client credentials without printing them
- Persist Entra IDs and secrets to the selected azd environment
- Disable demo authentication and sample seeding
${options.deploy ? "- Run azd up" : "- Leave deployment unchanged"}

No changes were made.`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }
  if (options.plan) {
    printPlan(options);
    return;
  }

  run(azExecutable, ["version", "--output", "none"]);
  run(azdExecutable, ["version"]);

  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  let provisionalValues;
  let identityContractCommitted = false;
  try {
    let environment = ensureEnvironment(
      options.environment,
      true,
      options.subscription,
      options.location,
    );
    if (!environment) {
      environment = (await terminal.question("azd environment name [pilot]: ")).trim() || "pilot";
      ensureEnvironment(
        environment,
        true,
        options.subscription,
        options.location,
      );
    }

    const applicationName =
      options.applicationName ??
      getAzdValue("NEXT_PUBLIC_APP_NAME") ??
      "Digital Permit Platform";
    const externalTenant =
      options.externalTenant ??
      (isConfiguredValue(getAzdValue("ENTRA_EXTERNAL_ID_TENANT_ID"))
        ? getAzdValue("ENTRA_EXTERNAL_ID_TENANT_ID")
        : null) ??
      (await terminal.question("External ID tenant ID or primary domain: ")).trim();
    if (!externalTenant) throw new Error("External ID tenant is required.");

    const detectedWorkforceTenant = run(
      azExecutable,
      ["account", "show", "--query", "tenantId", "--output", "tsv"],
      { allowFailure: true },
    );
    const workforceTenant =
      options.workforceTenant ??
      (isConfiguredValue(getAzdValue("ENTRA_WORKFORCE_TENANT_ID"))
        ? getAzdValue("ENTRA_WORKFORCE_TENANT_ID")
        : null) ??
      detectedWorkforceTenant;
    if (!workforceTenant) {
      throw new Error(
        "Workforce tenant could not be detected. Pass --workforce-tenant.",
      );
    }

    let applicationUrl =
      options.applicationUrl ?? getAzdValue("SERVICE_WEB_URI");
    let confirmed = options.yes;
    if (!applicationUrl) {
      console.log(`\nNo deployed application URL was found. The bootstrap will provision the
Azure infrastructure in demo-disabled placeholder mode to obtain its HTTPS URL.
No application image or synthetic data is deployed during this step.`);
      if (!confirmed) {
        const answer = (await terminal.question("Provision infrastructure? [y/N]: "))
          .trim()
          .toLowerCase();
        if (!new Set(["y", "yes"]).has(answer)) {
          console.log("No Azure resources or directory objects were changed.");
          return;
        }
        confirmed = true;
      }

      const azdAuthStatus = runAzd(
        ["auth", "login", "--check-status", "--no-prompt"],
        {
          allowFailure: true,
        },
      );
      if (azdAuthStatus === null) {
        console.log("\nAzure Developer CLI sign-in required.");
        runAzd(["auth", "login"], { inherit: true });
      }
      const provisioningDefaults = new Map([
        ["AUTHENTICATION_MODE", "demo"],
        ["SEED_DEMO_DATA", "true"],
        ["NEXT_PUBLIC_DEMO_MODE", "true"],
        ["NEXT_PUBLIC_SHOW_SAMPLE_BANNER", "true"],
      ]);
      provisionalValues = new Map(
        [...provisioningDefaults].map(([name, fallback]) => [
          name,
          getAzdValue(name) ?? fallback,
        ]),
      );
      setAzdValue("AUTHENTICATION_MODE", "demo");
      setAzdValue("SEED_DEMO_DATA", "false");
      setAzdValue("NEXT_PUBLIC_DEMO_MODE", "false");
      setAzdValue("NEXT_PUBLIC_SHOW_SAMPLE_BANNER", "false");
      runAzd(["provision"], { inherit: true });
      applicationUrl = getAzdValue("SERVICE_WEB_URI");
      if (!applicationUrl) {
        throw new Error("Azure provisioning did not return SERVICE_WEB_URI.");
      }
    }

    const applicationOrigin = normalizeApplicationOrigin(applicationUrl);
    if (!applicationOrigin.startsWith("https://")) {
      throw new Error("The deployed application URL must use HTTPS.");
    }

    const applicantDisplayName = `${applicationName} - ${environment} - Applicants`;
    const workforceDisplayName = `${applicationName} - ${environment} - Workforce`;
    const flowDisplayName = `${applicationName} - ${environment} - Applicant sign-up`;
    const applicantMarkerTag = `${BOOTSTRAP_APP_TAG}.Applicant`;
    const workforceMarkerTag = `${BOOTSTRAP_APP_TAG}.Workforce`;

    console.log(`\nThis command will configure:
- External tenant: ${externalTenant}
- Workforce tenant: ${workforceTenant}
- Application: ${applicationOrigin}
- azd environment: ${environment}

It creates or reuses two app registrations, service principals, a basic applicant
user flow, three workforce app roles, and client credentials. Secret values are
written to azd without being displayed.`);
    if (!confirmed) {
      const answer = (await terminal.question("Continue? [y/N]: ")).trim().toLowerCase();
      if (!new Set(["y", "yes"]).has(answer)) {
        console.log("No changes were made.");
        return;
      }
    }

    const externalToken = getGraphToken(
      externalTenant,
      "the External ID tenant",
      externalGraphScopes,
    );
    const externalOrganization = await getOrganization(externalToken);
    const externalTenantId = requireGuid(
      externalOrganization.id,
      "External tenant ID",
    );
    const externalSubdomain = normalizeTenantSubdomain(
      options.externalSubdomain ??
        (isConfiguredValue(getAzdValue("ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN"))
          ? getAzdValue("ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN")
          : tenantSubdomainFromOrganization(externalOrganization)),
    );

    const applicantApp = await ensureApplication({
      token: externalToken,
      clientId: getAzdValue("ENTRA_EXTERNAL_ID_CLIENT_ID"),
      displayName: applicantDisplayName,
      redirectUris: buildRedirectUris(applicationOrigin, APPLICANT_PROVIDER_ID),
      workforce: false,
      markerTag: applicantMarkerTag,
    });
    await ensureServicePrincipal(externalToken, applicantApp, false);
    const userFlow = await ensureUserFlow(
      externalToken,
      flowDisplayName,
      applicantApp.appId,
    );
    setAzdValue("ENTRA_EXTERNAL_ID_TENANT_ID", externalTenantId);
    setAzdValue("ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN", externalSubdomain);
    setAzdValue("ENTRA_EXTERNAL_ID_CLIENT_ID", applicantApp.appId);
    setAzdValue("ENTRA_EXTERNAL_ID_USER_FLOW_ID", userFlow.id);
    const externalCredential = await ensureCredential({
      token: externalToken,
      application: applicantApp,
      displayName: `Digital Permit Platform ${environment}`,
      secretDays: options.secretDays,
      rotate: options.rotateSecrets,
      secretName: "ENTRA_EXTERNAL_ID_CLIENT_SECRET",
      keyIdName: "ENTRA_EXTERNAL_ID_CLIENT_SECRET_KEY_ID",
      previousKeyIdName: "ENTRA_EXTERNAL_ID_PREVIOUS_CLIENT_SECRET_KEY_ID",
      expiresName: "ENTRA_EXTERNAL_ID_CLIENT_SECRET_EXPIRES_ON",
    });

    const workforceToken = getGraphToken(
      workforceTenant,
      "the workforce tenant",
      workforceGraphScopes,
    );
    const workforceOrganization = await getOrganization(workforceToken);
    const workforceTenantId = requireGuid(
      workforceOrganization.id,
      "Workforce tenant ID",
    );
    const workforceApp = await ensureApplication({
      token: workforceToken,
      clientId: getAzdValue("ENTRA_WORKFORCE_CLIENT_ID"),
      displayName: workforceDisplayName,
      redirectUris: buildRedirectUris(applicationOrigin, WORKFORCE_PROVIDER_ID),
      workforce: true,
      markerTag: workforceMarkerTag,
    });
    const workforceServicePrincipal = await ensureServicePrincipal(
      workforceToken,
      workforceApp,
      true,
    );
    setAzdValue("ENTRA_WORKFORCE_TENANT_ID", workforceTenantId);
    setAzdValue("ENTRA_WORKFORCE_CLIENT_ID", workforceApp.appId);
    setAzdValue(
      "ENTRA_WORKFORCE_SERVICE_PRINCIPAL_ID",
      workforceServicePrincipal.id,
    );
    const workforceCredential = await ensureCredential({
      token: workforceToken,
      application: workforceApp,
      displayName: `Digital Permit Platform ${environment}`,
      secretDays: options.secretDays,
      rotate: options.rotateSecrets,
      secretName: "ENTRA_WORKFORCE_CLIENT_SECRET",
      keyIdName: "ENTRA_WORKFORCE_CLIENT_SECRET_KEY_ID",
      previousKeyIdName: "ENTRA_WORKFORCE_PREVIOUS_CLIENT_SECRET_KEY_ID",
      expiresName: "ENTRA_WORKFORCE_CLIENT_SECRET_EXPIRES_ON",
    });

    for (const [name, value] of [
      ["AUTHENTICATION_MODE", "entra"],
      ["SEED_DEMO_DATA", "false"],
      ["NEXT_PUBLIC_DEMO_MODE", "false"],
      ["NEXT_PUBLIC_SHOW_SAMPLE_BANNER", "false"],
    ]) {
      setAzdValue(name, value);
    }
    identityContractCommitted = true;

    console.log(`\nIdentity bootstrap completed without printing credentials.

Remaining adopter decisions:
1. Assign workforce users or groups to Dpp.Reviewer, Dpp.Manager, or Dpp.Administrator.
2. Review MFA, Conditional Access, branding, password reset, and access-review policy.
3. Test applicant sign-up and one user in each workforce role.`);

    if (options.deploy) {
      console.log("\nApplying the Entra-enabled Azure configuration...");
      runAzd(["up", "--no-prompt"], { inherit: true });
      await prunePreviousCredential({
        token: externalToken,
        application: applicantApp,
        previousKeyId: externalCredential.previousKeyId,
        previousKeyIdName: "ENTRA_EXTERNAL_ID_PREVIOUS_CLIENT_SECRET_KEY_ID",
      });
      await prunePreviousCredential({
        token: workforceToken,
        application: workforceApp,
        previousKeyId: workforceCredential.previousKeyId,
        previousKeyIdName: "ENTRA_WORKFORCE_PREVIOUS_CLIENT_SECRET_KEY_ID",
      });
    } else {
      console.log("\nRun azd up to apply the Entra-enabled configuration.");
      if (
        externalCredential.previousKeyId ||
        workforceCredential.previousKeyId
      ) {
        console.log(
          "Previous credentials are retained for rollback until a successful --deploy run.",
        );
      }
    }
  } catch (error) {
    if (provisionalValues && !identityContractCommitted) {
      try {
        for (const [name, value] of provisionalValues) setAzdValue(name, value);
        console.error("Restored pre-bootstrap azd authentication settings.");
      } catch {
        console.error(
          "Unable to restore every temporary azd setting; rerun setup:identity to resume safely.",
        );
      }
    }
    throw error;
  } finally {
    terminal.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`Identity bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  });
}