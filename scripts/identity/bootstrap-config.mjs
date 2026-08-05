export const APPLICANT_PROVIDER_ID = "entra-external-id";
export const WORKFORCE_PROVIDER_ID = "entra-workforce";
export const BOOTSTRAP_APP_TAG = "DigitalPermitPlatform.IdentityBootstrap";
export const BOOTSTRAP_FLOW_DESCRIPTION =
  "Digital Permit Platform applicant sign-up and sign-in [managed by setup:identity]";

export const REQUIRED_WORKFORCE_ROLES = [
  {
    id: "8cbf3f14-15d5-4d13-9ec8-f35f457a8c4d",
    value: "Dpp.Reviewer",
    displayName: "Permit reviewer",
    description: "Review and progress assigned permit cases",
  },
  {
    id: "92f03c4e-4a0b-4fbe-92bd-7d7ab6269e5c",
    value: "Dpp.Manager",
    displayName: "Permit manager",
    description: "Manage queues, assignments, decisions, reports, and policy",
  },
  {
    id: "c1d538b6-28d3-47a2-a803-48d1f57e6d67",
    value: "Dpp.Administrator",
    displayName: "Permit administrator",
    description: "Configure modules, users, teams, and platform administration",
  },
];

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireGuid(value, label) {
  if (!GUID_PATTERN.test(value ?? "")) {
    throw new Error(`${label} must be a GUID.`);
  }
  return value.toLowerCase();
}

export function normalizeTenantSubdomain(value) {
  const subdomain = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.onmicrosoft\.com$/, "");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
    throw new Error("External tenant subdomain is invalid.");
  }
  return subdomain;
}

export function normalizeApplicationOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Application URL must be an absolute URL.");
  }

  const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    throw new Error("Application URL must use HTTPS except for localhost.");
  }
  return url.origin;
}

export function buildRedirectUris(applicationUrl, providerId) {
  const origins = new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  if (applicationUrl) origins.add(normalizeApplicationOrigin(applicationUrl));

  return [...origins]
    .sort()
    .map((origin) => `${origin}/api/auth/callback/${providerId}`);
}

export function mergeWorkforceRoles(existingRoles = []) {
  const requiredValues = new Set(
    REQUIRED_WORKFORCE_ROLES.map((role) => role.value),
  );
  const customRoles = existingRoles
    .filter((role) => !requiredValues.has(role.value))
    .map((role) => ({
      allowedMemberTypes: role.allowedMemberTypes,
      description: role.description,
      displayName: role.displayName,
      id: role.id,
      isEnabled: role.isEnabled,
      value: role.value,
    }));

  const roleIds = new Map();
  for (const role of existingRoles) {
    if (roleIds.has(role.id)) {
      throw new Error(
        `Existing app roles ${roleIds.get(role.id)} and ${role.value} share ID ${role.id}.`,
      );
    }
    roleIds.set(role.id, role.value);
  }

  const reservedIds = new Map(
    REQUIRED_WORKFORCE_ROLES.map((role) => [role.id, role.value]),
  );
  for (const role of existingRoles) {
    const expectedValue = reservedIds.get(role.id);
    if (expectedValue && role.value !== expectedValue) {
      throw new Error(
        `Existing app role ${role.value} uses the reserved ${expectedValue} ID ${role.id}.`,
      );
    }
  }

  for (const requiredRole of REQUIRED_WORKFORCE_ROLES) {
    const collision = customRoles.find((role) => role.id === requiredRole.id);
    if (collision) {
      throw new Error(
        `Existing app role ${collision.value} uses reserved ID ${requiredRole.id}.`,
      );
    }
  }

  const managedRoles = REQUIRED_WORKFORCE_ROLES.map((requiredRole) => {
    const existing = existingRoles.find(
      (role) => role.value === requiredRole.value,
    );
    return {
      allowedMemberTypes: ["User"],
      description: requiredRole.description,
      displayName: requiredRole.displayName,
      id: existing?.id ?? requiredRole.id,
      isEnabled: true,
      value: requiredRole.value,
    };
  });

  return [...customRoles, ...managedRoles];
}

export function buildApplicationCreatePayload({
  displayName,
  redirectUris,
  appRoles = [],
  tags,
}) {
  return {
    displayName,
    signInAudience: "AzureADMyOrg",
    web: {
      redirectUris,
      implicitGrantSettings: {
        enableAccessTokenIssuance: false,
        enableIdTokenIssuance: false,
      },
    },
    tags,
    ...(appRoles.length > 0 ? { appRoles } : {}),
  };
}

export function buildExternalIdUserFlowPayload({ displayName, appId }) {
  requireGuid(appId, "Applicant application client ID");
  return {
    "@odata.type":
      "#microsoft.graph.externalUsersSelfServiceSignUpEventsFlow",
    displayName,
    description: BOOTSTRAP_FLOW_DESCRIPTION,
    conditions: {
      applications: {
        includeApplications: [{ appId: appId.toLowerCase() }],
      },
    },
    onAuthenticationMethodLoadStart: {
      "@odata.type":
        "#microsoft.graph.onAuthenticationMethodLoadStartExternalUsersSelfServiceSignUp",
      identityProviders: [{ id: "EmailPassword-OAUTH" }],
    },
    onInteractiveAuthFlowStart: {
      "@odata.type":
        "#microsoft.graph.onInteractiveAuthFlowStartExternalUsersSelfServiceSignUp",
      isSignUpAllowed: true,
    },
    onAttributeCollection: {
      "@odata.type":
        "#microsoft.graph.onAttributeCollectionExternalUsersSelfServiceSignUp",
      attributes: [
        {
          id: "email",
          displayName: "Email Address",
          description: "Email address of the applicant",
          userFlowAttributeType: "builtIn",
          dataType: "string",
        },
        {
          id: "displayName",
          displayName: "Display Name",
          description: "Name of the applicant",
          userFlowAttributeType: "builtIn",
          dataType: "string",
        },
      ],
      attributeCollectionPage: {
        views: [
          {
            inputs: [
              {
                attribute: "email",
                label: "Email Address",
                inputType: "text",
                hidden: true,
                editable: false,
                writeToDirectory: true,
                required: true,
              },
              {
                attribute: "displayName",
                label: "Full name",
                inputType: "text",
                hidden: false,
                editable: true,
                writeToDirectory: true,
                required: true,
              },
            ],
          },
        ],
      },
    },
  };
}

export function assertManagedUserFlow(flow) {
  if (
    flow?.["@odata.type"] !==
    "#microsoft.graph.externalUsersSelfServiceSignUpEventsFlow"
  ) {
    throw new Error(
      `Existing flow ${flow?.displayName ?? flow?.id ?? "unknown"} is not an External ID sign-up flow.`,
    );
  }
  if (flow.description !== BOOTSTRAP_FLOW_DESCRIPTION) {
    throw new Error(
      `Existing flow ${flow.displayName} is not owned by setup:identity.`,
    );
  }
  return flow;
}

export function mergeFlowApplications(flow, appId) {
  requireGuid(appId, "Applicant application client ID");
  const existing =
    flow?.conditions?.applications?.includeApplications ?? [];
  const appIds = new Set(existing.map((application) => application.appId));
  appIds.add(appId.toLowerCase());
  return {
    applications: {
      includeApplications: [...appIds].sort().map((value) => ({ appId: value })),
    },
  };
}

export function buildPasswordCredential(displayName, secretDays, now = new Date()) {
  if (!Number.isInteger(secretDays) || secretDays < 1 || secretDays > 730) {
    throw new Error("Secret lifetime must be between 1 and 730 days.");
  }
  const endDateTime = new Date(now);
  endDateTime.setUTCDate(endDateTime.getUTCDate() + secretDays);
  return {
    passwordCredential: {
      displayName,
      endDateTime: endDateTime.toISOString(),
    },
  };
}

export function escapeODataString(value) {
  return String(value).replaceAll("'", "''");
}

export function safeCommandLabel(executable, args) {
  const executableName = executable.split(/[\\/]/).at(-1);
  const commandArgs = args[0] === "--cwd" ? args.slice(2) : args;
  const safeWords = commandArgs
    .filter((argument) => !argument.startsWith("-"))
    .slice(0, 2);
  return [executableName, ...safeWords].join(" ");
}