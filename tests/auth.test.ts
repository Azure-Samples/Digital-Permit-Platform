import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapWorkforceRole,
  normalizeIssuer,
  parseIdentityClaims,
  WORKFORCE_APP_ROLES,
} from "../src/lib/auth/claims";
import {
  externalIdDiscoveryUrl,
  externalIdIssuer,
  getExternalIdConfiguration,
  getWorkforceConfiguration,
  isDemoCredentialsEnabled,
} from "../src/lib/auth/config";
import {
  safeAuthRedirect,
  safeRelativeCallbackUrl,
} from "../src/lib/auth/redirect";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";

describe("Entra identity claims", () => {
  it("extracts immutable identifiers and applicant details", () => {
    const claims = parseIdentityClaims({
      iss: `https://${TENANT_ID}.ciamlogin.com/${TENANT_ID}/v2.0`,
      sub: "pairwise-subject",
      tid: TENANT_ID,
      email: "Applicant@Example.com",
      given_name: "Amina",
      family_name: "Khan",
      email_verified: true,
    });

    assert.equal(claims.subject, "pairwise-subject");
    assert.equal(claims.email, "applicant@example.com");
    assert.equal(claims.firstName, "Amina");
    assert.equal(claims.lastName, "Khan");
    assert.equal(claims.emailVerified, true);
  });

  it("rejects a profile without required identity claims", () => {
    assert.throws(
      () => parseIdentityClaims({ sub: "subject", email: "a@example.com" }),
      /missing required claims/,
    );
  });

  it("normalizes equivalent issuer URLs", () => {
    assert.equal(
      normalizeIssuer("https://LOGIN.MICROSOFTONLINE.COM/tenant/v2.0/"),
      "https://login.microsoftonline.com/tenant/v2.0",
    );
  });
});

describe("workforce app roles", () => {
  it("maps configured app roles and gives precedence to the strongest role", () => {
    assert.equal(mapWorkforceRole([WORKFORCE_APP_ROLES.reviewer]), "REVIEWER");
    assert.equal(
      mapWorkforceRole([
        WORKFORCE_APP_ROLES.reviewer,
        WORKFORCE_APP_ROLES.manager,
      ]),
      "MANAGER",
    );
    assert.equal(
      mapWorkforceRole([
        WORKFORCE_APP_ROLES.manager,
        WORKFORCE_APP_ROLES.administrator,
      ]),
      "ADMIN",
    );
  });

  it("rejects absent and unrelated roles", () => {
    assert.equal(mapWorkforceRole(undefined), null);
    assert.equal(mapWorkforceRole(["Other.Application.Role"]), null);
  });
});

describe("authentication configuration", () => {
  it("uses the documented External ID discovery and issuer hosts", () => {
    assert.equal(
      externalIdDiscoveryUrl("example-external", TENANT_ID),
      `https://example-external.ciamlogin.com/${TENANT_ID}/v2.0/.well-known/openid-configuration`,
    );
    assert.equal(
      externalIdIssuer(TENANT_ID),
      `https://${TENANT_ID}.ciamlogin.com/${TENANT_ID}/v2.0`,
    );
  });

  it("disables optional providers when no values are set", () => {
    assert.equal(getExternalIdConfiguration({}), null);
    assert.equal(getWorkforceConfiguration({}), null);
  });

  it("requires every value when an optional provider is configured", () => {
    assert.throws(
      () =>
        getExternalIdConfiguration({
          ENTRA_EXTERNAL_ID_TENANT_ID: TENANT_ID,
        }),
      /configuration is missing/,
    );
  });

  it("accepts complete tenant-scoped provider settings", () => {
    assert.deepEqual(
      getExternalIdConfiguration({
        ENTRA_EXTERNAL_ID_TENANT_ID: TENANT_ID,
        ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN: "example-external",
        ENTRA_EXTERNAL_ID_CLIENT_ID: CLIENT_ID,
        ENTRA_EXTERNAL_ID_CLIENT_SECRET: "external-secret",
      }),
      {
        tenantId: TENANT_ID,
        tenantSubdomain: "example-external",
        clientId: CLIENT_ID,
        clientSecret: "external-secret",
      },
    );
    assert.deepEqual(
      getWorkforceConfiguration({
        ENTRA_WORKFORCE_TENANT_ID: TENANT_ID,
        ENTRA_WORKFORCE_CLIENT_ID: CLIENT_ID,
        ENTRA_WORKFORCE_CLIENT_SECRET: "workforce-secret",
      }),
      {
        tenantId: TENANT_ID,
        clientId: CLIENT_ID,
        clientSecret: "workforce-secret",
      },
    );
  });

  it("enables demo credentials only through the explicit server setting", () => {
    assert.equal(isDemoCredentialsEnabled({}), false);
    assert.equal(
      isDemoCredentialsEnabled({ AUTH_ENABLE_DEMO_CREDENTIALS: "false" }),
      false,
    );
    assert.equal(
      isDemoCredentialsEnabled({ AUTH_ENABLE_DEMO_CREDENTIALS: "true" }),
      true,
    );
  });
});

describe("authentication redirects", () => {
  it("accepts local callback paths and exact-origin absolute URLs", () => {
    assert.equal(
      safeRelativeCallbackUrl("/dashboard?view=open", "/dashboard"),
      "/dashboard?view=open",
    );
    assert.equal(
      safeAuthRedirect("/staff", "https://permits.example.gov.uk"),
      "https://permits.example.gov.uk/staff",
    );
    assert.equal(
      safeAuthRedirect(
        "https://permits.example.gov.uk/dashboard",
        "https://permits.example.gov.uk",
      ),
      "https://permits.example.gov.uk/dashboard",
    );
  });

  it("rejects protocol-relative URLs and deceptive origins", () => {
    assert.equal(
      safeRelativeCallbackUrl("//attacker.example/path", "/dashboard"),
      "/dashboard",
    );
    assert.equal(
      safeAuthRedirect(
        "https://permits.example.gov.uk.attacker.example/dashboard",
        "https://permits.example.gov.uk",
      ),
      "https://permits.example.gov.uk",
    );
    assert.equal(
      safeAuthRedirect(
        "/\\attacker.example/dashboard",
        "https://permits.example.gov.uk",
      ),
      "https://permits.example.gov.uk",
    );
  });
});