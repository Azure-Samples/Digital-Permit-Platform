import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPLICANT_PROVIDER_ID,
  assertManagedUserFlow,
  BOOTSTRAP_APP_TAG,
  BOOTSTRAP_FLOW_DESCRIPTION,
  buildApplicationCreatePayload,
  buildExternalIdUserFlowPayload,
  buildPasswordCredential,
  buildRedirectUris,
  escapeODataString,
  mergeFlowApplications,
  mergeWorkforceRoles,
  safeCommandLabel,
  WORKFORCE_PROVIDER_ID,
} from "../scripts/identity/bootstrap-config.mjs";
import { parseArguments } from "../scripts/identity/bootstrap.mjs";

const APP_ID = "11111111-1111-4111-8111-111111111111";

describe("identity bootstrap configuration", () => {
  it("builds local and production callbacks for each provider", () => {
    const applicantUris = buildRedirectUris(
      "https://permits.example.gov.uk/path?ignored=true",
      APPLICANT_PROVIDER_ID,
    );
    assert.deepEqual(applicantUris, [
      "http://127.0.0.1:3000/api/auth/callback/entra-external-id",
      "http://localhost:3000/api/auth/callback/entra-external-id",
      "https://permits.example.gov.uk/api/auth/callback/entra-external-id",
    ]);
    assert.ok(
      buildRedirectUris(undefined, WORKFORCE_PROVIDER_ID).every((uri) =>
        uri.endsWith("/api/auth/callback/entra-workforce"),
      ),
    );
    assert.throws(
      () => buildRedirectUris("http://permits.example.gov.uk", "provider"),
      /must use HTTPS/,
    );
  });

  it("adds the three managed workforce roles without replacing custom roles", () => {
    const roles = mergeWorkforceRoles([
      {
        id: "22222222-2222-4222-8222-222222222222",
        value: "Customer.CustomRole",
        displayName: "Custom",
        description: "Customer managed",
        allowedMemberTypes: ["User"],
        isEnabled: true,
        origin: "Application",
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        value: "Dpp.Reviewer",
      },
    ]);
    assert.equal(roles.length, 4);
    assert.equal(
      roles.find((role) => role.value === "Dpp.Reviewer")?.id,
      "33333333-3333-4333-8333-333333333333",
    );
    assert.ok(roles.some((role) => role.value === "Dpp.Manager"));
    assert.ok(roles.some((role) => role.value === "Dpp.Administrator"));
    assert.ok(roles.some((role) => role.value === "Customer.CustomRole"));
    assert.equal("origin" in roles[0], false);

    assert.throws(
      () =>
        mergeWorkforceRoles([
          {
            id: "8cbf3f14-15d5-4d13-9ec8-f35f457a8c4d",
            value: "Dpp.Manager",
          },
        ]),
      /reserved Dpp.Reviewer ID/,
    );
  });

  it("builds a single-tenant confidential web application", () => {
    const payload = buildApplicationCreatePayload({
      displayName: "Permit Platform Applicants",
      redirectUris: ["https://example.test/callback"],
      tags: [BOOTSTRAP_APP_TAG],
    });
    assert.equal(payload.signInAudience, "AzureADMyOrg");
    assert.deepEqual(payload.web.redirectUris, ["https://example.test/callback"]);
    assert.equal(payload.web.implicitGrantSettings.enableIdTokenIssuance, false);
    assert.deepEqual(payload.tags, [BOOTSTRAP_APP_TAG]);
  });

  it("creates and idempotently associates the applicant user flow", () => {
    const payload = buildExternalIdUserFlowPayload({
      displayName: "Permit applicants",
      appId: APP_ID,
    });
    assert.equal(
      payload["@odata.type"],
      "#microsoft.graph.externalUsersSelfServiceSignUpEventsFlow",
    );
    assert.deepEqual(payload.conditions.applications.includeApplications, [
      { appId: APP_ID },
    ]);
    assert.equal(
      payload.onAuthenticationMethodLoadStart.identityProviders[0].id,
      "EmailPassword-OAUTH",
    );
    assert.equal(
      payload.onAttributeCollection.attributeCollectionPage.views[0].inputs[1]
        .required,
      true,
    );
    assert.equal(payload.description, BOOTSTRAP_FLOW_DESCRIPTION);
    assert.equal(assertManagedUserFlow(payload), payload);
    assert.throws(
      () =>
        assertManagedUserFlow({
          ...payload,
          description: "Customer managed flow",
        }),
      /not owned/,
    );

    assert.deepEqual(
      mergeFlowApplications(
        {
          conditions: {
            applications: { includeApplications: [{ appId: APP_ID }] },
          },
        },
        APP_ID,
      ).applications.includeApplications,
      [{ appId: APP_ID }],
    );
  });

  it("creates bounded credentials and escapes OData values", () => {
    assert.deepEqual(
      buildPasswordCredential(
        "bootstrap",
        30,
        new Date("2026-01-01T00:00:00.000Z"),
      ),
      {
        passwordCredential: {
          displayName: "bootstrap",
          endDateTime: "2026-01-31T00:00:00.000Z",
        },
      },
    );
    assert.throws(() => buildPasswordCredential("bootstrap", 731), /between/);
    assert.equal(escapeODataString("Council's permits"), "Council''s permits");
  });

  it("parses safe non-interactive command options", () => {
    assert.deepEqual(
      parseArguments([
        "--external-tenant",
        APP_ID,
        "--secret-days",
        "90",
        "--subscription",
        "44444444-4444-4444-8444-444444444444",
        "--location",
        "uksouth",
        "--rotate-secrets",
        "--deploy",
        "--yes",
      ]),
      {
        externalTenant: APP_ID,
        secretDays: 90,
        subscription: "44444444-4444-4444-8444-444444444444",
        location: "uksouth",
        rotateSecrets: true,
        deploy: true,
        yes: true,
        plan: false,
      },
    );
    assert.throws(() => parseArguments(["--secret-days", "0"]), /between/);
    assert.throws(
      () => parseArguments(["--subscription", "not-a-guid"]),
      /must be a GUID/,
    );
    assert.throws(() => parseArguments(["--unknown"]), /Unknown option/);
  });

  it("reports useful command labels without positional values", () => {
    assert.equal(
      safeCommandLabel("/usr/local/bin/azd", [
        "--cwd",
        "/private/project",
        "env",
        "set",
        "CLIENT_SECRET",
        "secret-value",
      ]),
      "azd env set",
    );
    assert.equal(
      safeCommandLabel("az", [
        "account",
        "get-access-token",
        "--tenant",
        "tenant-id",
      ]),
      "az account get-access-token",
    );
  });
});