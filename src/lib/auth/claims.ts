import type { SystemRole } from "@prisma/client";

export const EXTERNAL_ID_PROVIDER_ID = "entra-external-id";
export const WORKFORCE_PROVIDER_ID = "entra-workforce";

export const WORKFORCE_APP_ROLES = {
  reviewer: "Dpp.Reviewer",
  manager: "Dpp.Manager",
  administrator: "Dpp.Administrator",
} as const;

export interface EntraIdProfile extends Record<string, unknown> {
  sub?: string;
  iss?: string;
  tid?: string;
  oid?: string;
  email?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  email_verified?: boolean;
  emails?: unknown;
  roles?: unknown;
}

export interface IdentityClaims {
  issuer: string;
  subject: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveEmail(profile: EntraIdProfile): string | null {
  const directEmail =
    nonEmptyString(profile.email) ?? nonEmptyString(profile.preferred_username);
  if (directEmail) return directEmail.toLowerCase();

  if (Array.isArray(profile.emails)) {
    const arrayEmail = profile.emails
      .map(nonEmptyString)
      .find((value): value is string => Boolean(value));
    if (arrayEmail) return arrayEmail.toLowerCase();
  }

  return null;
}

function resolveNames(profile: EntraIdProfile, email: string) {
  const givenName = nonEmptyString(profile.given_name);
  const familyName = nonEmptyString(profile.family_name);
  if (givenName && familyName) {
    return { firstName: givenName, lastName: familyName };
  }

  const nameParts = (nonEmptyString(profile.name) ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const firstName = givenName ?? nameParts.shift() ?? email.split("@")[0];
  const lastName = familyName ?? nameParts.join(" ") ?? "";

  return {
    firstName,
    lastName: lastName || "Account",
  };
}

export function parseIdentityClaims(profile: EntraIdProfile): IdentityClaims {
  const issuer = nonEmptyString(profile.iss);
  const subject = nonEmptyString(profile.sub);
  const tenantId = nonEmptyString(profile.tid);
  const email = resolveEmail(profile);

  if (!issuer || !subject || !tenantId || !email) {
    throw new Error("The identity token is missing required claims.");
  }

  const names = resolveNames(profile, email);
  return {
    issuer,
    subject,
    tenantId,
    email,
    ...names,
    emailVerified: profile.email_verified === true,
  };
}

export function mapWorkforceRole(roles: unknown): SystemRole | null {
  if (!Array.isArray(roles)) return null;

  const assignedRoles = new Set(
    roles.filter((role): role is string => typeof role === "string"),
  );
  if (assignedRoles.has(WORKFORCE_APP_ROLES.administrator)) return "ADMIN";
  if (assignedRoles.has(WORKFORCE_APP_ROLES.manager)) return "MANAGER";
  if (assignedRoles.has(WORKFORCE_APP_ROLES.reviewer)) return "REVIEWER";
  return null;
}

export function normalizeIssuer(issuer: string): string {
  const url = new URL(issuer);
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}