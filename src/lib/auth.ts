// ─────────────────────────────────────────────────────────────
// NextAuth configuration
// ─────────────────────────────────────────────────────────────
import type { NextAuthOptions } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./db";
import {
  type EntraIdProfile,
  EXTERNAL_ID_PROVIDER_ID,
  WORKFORCE_PROVIDER_ID,
} from "./auth/claims";
import {
  externalIdDiscoveryUrl,
  externalIdIssuer,
  getExternalIdConfiguration,
  getWorkforceConfiguration,
  isDemoCredentialsEnabled,
} from "./auth/config";
import {
  resolveApplicantIdentity,
  resolveWorkforceIdentity,
} from "./auth/identity";
import { safeAuthRedirect } from "./auth/redirect";

function createEntraProvider(
  options: Pick<
    OAuthConfig<EntraIdProfile>,
    | "id"
    | "name"
    | "wellKnown"
    | "issuer"
    | "clientId"
    | "clientSecret"
    | "profile"
  >,
): OAuthConfig<EntraIdProfile> {
  return {
    ...options,
    type: "oauth",
    idToken: true,
    authorization: { params: { scope: "openid profile email" } },
    checks: ["pkce", "state", "nonce"],
    client: { token_endpoint_auth_method: "client_secret_post" },
  };
}

const providers: NextAuthOptions["providers"] = [];
const externalId = getExternalIdConfiguration();
if (externalId) {
  providers.push(
    createEntraProvider({
      id: EXTERNAL_ID_PROVIDER_ID,
      name: "Applicant account",
      wellKnown: externalIdDiscoveryUrl(
        externalId.tenantSubdomain,
        externalId.tenantId,
      ),
      issuer: externalIdIssuer(externalId.tenantId),
      clientId: externalId.clientId,
      clientSecret: externalId.clientSecret,
      profile: (profile) =>
        resolveApplicantIdentity(profile, externalId.tenantId),
    }),
  );
}

const workforceId = getWorkforceConfiguration();
if (workforceId) {
  providers.push(
    createEntraProvider({
      id: WORKFORCE_PROVIDER_ID,
      name: "Council staff account",
      wellKnown: `https://login.microsoftonline.com/${workforceId.tenantId}/v2.0/.well-known/openid-configuration`,
      issuer: `https://login.microsoftonline.com/${workforceId.tenantId}/v2.0`,
      clientId: workforceId.clientId,
      clientSecret: workforceId.clientSecret,
      profile: (profile) =>
        resolveWorkforceIdentity(profile, workforceId.tenantId),
    }),
  );
}

if (isDemoCredentialsEnabled()) {
  providers.push(
    CredentialsProvider({
      name: "Demo credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user?.active || !user.passwordHash) return null;

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          teamId: user.teamId,
        };
      },
    }),
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 /* 8 hours */ },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.teamId = (user as any).teamId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).teamId = token.teamId;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      return safeAuthRedirect(url, baseUrl);
    },
  },
};
