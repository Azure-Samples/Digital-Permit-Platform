import type { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { externalIdIssuer } from "./config";
import {
  type EntraIdProfile,
  EXTERNAL_ID_PROVIDER_ID,
  mapWorkforceRole,
  normalizeIssuer,
  parseIdentityClaims,
  WORKFORCE_PROVIDER_ID,
} from "./claims";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
  teamId: string | null;
}

interface ResolveIdentityOptions {
  provider: string;
  profile: EntraIdProfile;
  expectedIssuer: string;
  expectedTenantId: string;
  role: SystemRole;
}

function toAuthenticatedUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: SystemRole;
  teamId: string | null;
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role,
    teamId: user.teamId,
  };
}

async function resolveIdentity({
  provider,
  profile,
  expectedIssuer,
  expectedTenantId,
  role,
}: ResolveIdentityOptions): Promise<AuthenticatedUser> {
  const claims = parseIdentityClaims(profile);
  if (normalizeIssuer(claims.issuer) !== normalizeIssuer(expectedIssuer)) {
    throw new Error("The identity token issuer is not trusted.");
  }
  if (claims.tenantId.toLowerCase() !== expectedTenantId.toLowerCase()) {
    throw new Error("The identity token tenant is not trusted.");
  }

  return prisma.$transaction(async (transaction) => {
    const existingIdentity = await transaction.externalIdentity.findUnique({
      where: {
        issuer_subject: {
          issuer: normalizeIssuer(claims.issuer),
          subject: claims.subject,
        },
      },
      include: { user: true },
    });

    if (existingIdentity) {
      if (existingIdentity.provider !== provider || !existingIdentity.user.active) {
        throw new Error("This identity is not allowed to sign in.");
      }
      if (
        provider === EXTERNAL_ID_PROVIDER_ID &&
        existingIdentity.user.role !== "APPLICANT"
      ) {
        throw new Error("Applicant identities cannot access staff roles.");
      }

      const roleChanged = existingIdentity.user.role !== role;
      const user =
        !roleChanged
          ? existingIdentity.user
          : await transaction.user.update({
              where: { id: existingIdentity.user.id },
              data: { role },
            });
      if (roleChanged) {
        await transaction.auditLog.create({
          data: {
            userId: user.id,
            action: "identity.role_sync",
            entityType: "ExternalIdentity",
            entityId: existingIdentity.id,
            previousValues: { role: existingIdentity.user.role },
            newValues: { role },
          },
        });
      }
      await transaction.externalIdentity.update({
        where: { id: existingIdentity.id },
        data: { lastSignInAt: new Date() },
      });
      return toAuthenticatedUser(user);
    }

    const emailOwner = await transaction.user.findUnique({
      where: { email: claims.email },
      select: { id: true },
    });
    if (emailOwner) {
      throw new Error(
        "An account already uses this email address and must be linked by an administrator.",
      );
    }

    const user = await transaction.user.create({
      data: {
        email: claims.email,
        firstName: claims.firstName,
        lastName: claims.lastName,
        role,
        emailVerified: claims.emailVerified,
        ...(role === "APPLICANT"
          ? { applicantProfile: { create: {} } }
          : {}),
      },
    });
    const identity = await transaction.externalIdentity.create({
      data: {
        provider,
        issuer: normalizeIssuer(claims.issuer),
        subject: claims.subject,
        emailAtLink: claims.email,
        userId: user.id,
      },
    });
    await transaction.auditLog.create({
      data: {
        userId: user.id,
        action: "identity.link",
        entityType: "ExternalIdentity",
        entityId: identity.id,
        newValues: { provider, role },
      },
    });

    return toAuthenticatedUser(user);
  });
}

export function resolveApplicantIdentity(
  profile: EntraIdProfile,
  tenantId: string,
) {
  return resolveIdentity({
    provider: EXTERNAL_ID_PROVIDER_ID,
    profile,
    expectedIssuer: externalIdIssuer(tenantId),
    expectedTenantId: tenantId,
    role: "APPLICANT",
  });
}

export function resolveWorkforceIdentity(
  profile: EntraIdProfile,
  tenantId: string,
) {
  const role = mapWorkforceRole(profile.roles);
  if (!role) {
    throw new Error("A Digital Permit Platform app role is required.");
  }

  return resolveIdentity({
    provider: WORKFORCE_PROVIDER_ID,
    profile,
    expectedIssuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    expectedTenantId: tenantId,
    role,
  });
}