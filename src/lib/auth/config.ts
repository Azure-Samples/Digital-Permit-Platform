const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

type Environment = Readonly<Record<string, string | undefined>>;

interface EntraClientConfiguration {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface ExternalIdConfiguration extends EntraClientConfiguration {
  tenantSubdomain: string;
}

export type WorkforceConfiguration = EntraClientConfiguration;

export function externalIdDiscoveryUrl(
  tenantSubdomain: string,
  tenantId: string,
): string {
  return `https://${tenantSubdomain}.ciamlogin.com/${tenantId}/v2.0/.well-known/openid-configuration`;
}

export function externalIdIssuer(tenantId: string): string {
  return `https://${tenantId}.ciamlogin.com/${tenantId}/v2.0`;
}

function optionalConfiguration<T extends Record<string, string | undefined>>(
  label: string,
  values: T,
): { [Key in keyof T]: string } | null {
  const entries = Object.entries(values);
  if (entries.every(([, value]) => !value?.trim())) return null;

  const missing = entries
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`${label} configuration is missing: ${missing.join(", ")}`);
  }

  return Object.fromEntries(
    entries.map(([name, value]) => [name, value?.trim() ?? ""]),
  ) as { [Key in keyof T]: string };
}

function validateGuid(label: string, value: string) {
  if (!GUID_PATTERN.test(value)) {
    throw new Error(`${label} must be a GUID.`);
  }
}

export function getExternalIdConfiguration(
  env: Environment = process.env,
): ExternalIdConfiguration | null {
  const configuration = optionalConfiguration("External ID", {
    tenantId: env.ENTRA_EXTERNAL_ID_TENANT_ID,
    tenantSubdomain: env.ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN,
    clientId: env.ENTRA_EXTERNAL_ID_CLIENT_ID,
    clientSecret: env.ENTRA_EXTERNAL_ID_CLIENT_SECRET,
  });
  if (!configuration) return null;

  validateGuid("ENTRA_EXTERNAL_ID_TENANT_ID", configuration.tenantId);
  validateGuid("ENTRA_EXTERNAL_ID_CLIENT_ID", configuration.clientId);
  if (!SUBDOMAIN_PATTERN.test(configuration.tenantSubdomain)) {
    throw new Error(
      "ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN must be a valid tenant subdomain.",
    );
  }
  return {
    ...configuration,
    tenantId: configuration.tenantId.toLowerCase(),
    tenantSubdomain: configuration.tenantSubdomain.toLowerCase(),
    clientId: configuration.clientId.toLowerCase(),
  };
}

export function getWorkforceConfiguration(
  env: Environment = process.env,
): WorkforceConfiguration | null {
  const configuration = optionalConfiguration("Workforce ID", {
    tenantId: env.ENTRA_WORKFORCE_TENANT_ID,
    clientId: env.ENTRA_WORKFORCE_CLIENT_ID,
    clientSecret: env.ENTRA_WORKFORCE_CLIENT_SECRET,
  });
  if (!configuration) return null;

  validateGuid("ENTRA_WORKFORCE_TENANT_ID", configuration.tenantId);
  validateGuid("ENTRA_WORKFORCE_CLIENT_ID", configuration.clientId);
  return {
    ...configuration,
    tenantId: configuration.tenantId.toLowerCase(),
    clientId: configuration.clientId.toLowerCase(),
  };
}

export function isDemoCredentialsEnabled(
  env: Environment = process.env,
): boolean {
  return env.AUTH_ENABLE_DEMO_CREDENTIALS === "true";
}