# Identity

## Supported model

The platform separates public applicants from council staff:

| Audience | Identity service | Application role source | Local role |
|---|---|---|---|
| Residents and businesses | Microsoft Entra External ID external tenant | The application fixes this provider to applicant access | `APPLICANT` |
| Officers | Microsoft Entra ID workforce tenant | `Dpp.Reviewer` app role | `REVIEWER` |
| Managers | Microsoft Entra ID workforce tenant | `Dpp.Manager` app role | `MANAGER` |
| Administrators | Microsoft Entra ID workforce tenant | `Dpp.Administrator` app role | `ADMIN` |

External ID supplies Microsoft-hosted self-service sign-up, sign-in, password reset, email one-time passcodes, social federation, branding, multifactor authentication, and Conditional Access options. The application uses standards-based OpenID Connect authorization code flow through NextAuth.

Residents and businesses do not need a council email domain, workforce account, or pre-existing Microsoft Entra account. They use **Citizen sign in or create an account**, enter an ordinary personal or business email address, verify it, and complete the council-branded External ID flow. On first successful sign-in, the application creates its own local `APPLICANT` record linked by immutable issuer and subject identifiers. Staff never use this route for workforce access.

Demo credentials remain available only when `AUTH_ENABLE_DEMO_CREDENTIALS=true`. Azure deployment derives that server-side value from `AUTHENTICATION_MODE`; `NEXT_PUBLIC_DEMO_MODE` controls sample UI only and is not an access-control setting.

## Authentication modes

| `AUTHENTICATION_MODE` | Applicant External ID | Workforce ID | Demo credentials |
|---|---:|---:|---:|
| `demo` | No | No | Yes |
| `entra` | Yes | Yes | No |
| `hybrid` | Yes | Yes | Yes |

Use `demo` only for evaluation. Use `entra` for a shared or production-intent environment. `hybrid` supports a controlled transition but retains password-based sample accounts and should not be treated as the production end state.

## Prerequisites

You need permission to configure two directories:

1. a [Microsoft Entra External ID external tenant](https://learn.microsoft.com/entra/external-id/customers/how-to-create-external-tenant-portal) for applicants;
2. the council workforce tenant for officers, managers, and administrators.

The guided bootstrap uses delegated Microsoft Graph access only while it runs. The operator needs **Application Administrator** or **Cloud Application Administrator** in both tenants, plus **External ID User Flow Administrator** in the external tenant. The browser consent requests are limited to `Application.ReadWrite.All` and, for the external tenant, `EventListener.ReadWrite.All`. Tenant consent policy can require a Privileged Role Administrator or Global Administrator to approve these scopes the first time.

## Guided setup

Provide the one value the accelerator cannot safely choose for an organisation: the existing External ID tenant.

```bash
npm run setup:identity -- --external-tenant <tenant-id-or-domain> --deploy
```

The command performs these operations idempotently:

| Operation | Automated |
|---|---:|
| Create or select an `azd` environment and obtain subscription/location interactively | Yes |
| Provision Azure infrastructure to obtain the callback URL when needed | Yes |
| Detect the selected `azd` environment, deployed URL, product name and workforce tenant | Yes |
| Create or reuse the applicant app registration and service principal | Yes |
| Register localhost and deployed applicant callbacks | Yes |
| Create and associate an email/password sign-up and sign-in user flow | Yes |
| Discover the external tenant ID and subdomain | Yes |
| Create or reuse the workforce app registration and service principal | Yes |
| Create the reviewer, manager and administrator app roles | Yes |
| Require explicit workforce assignment | Yes |
| Create bounded client credentials and save them to `azd` without displaying them | Yes |
| Disable demo authentication, demo seeding and the sample banner | Yes |
| Reprovision and deploy the Entra-enabled application with `--deploy` | Yes |

Use a no-change preview when required by change control:

```bash
npm run setup:identity -- \
	--plan \
	--environment pilot \
	--external-tenant <external-tenant-guid> \
	--external-subdomain <external-subdomain> \
	--workforce-tenant <workforce-tenant-guid> \
	--application-url https://permits.example.gov.uk
```

Useful options:

| Option | Purpose |
|---|---|
| `--environment <name>` | Select or create an `azd` environment |
| `--workforce-tenant <guid>` | Override workforce tenant auto-detection |
| `--application-url <url>` | Override `SERVICE_WEB_URI` |
| `--subscription <guid>` | Select the subscription for a new environment |
| `--location <region>` | Select the Azure region for a new environment |
| `--secret-days <1-730>` | Set credential lifetime; default is 180 days |
| `--rotate-secrets` | Add tracked replacement credentials; old credentials remain until deployment succeeds |
| `--deploy` | Run `azd up`, verify command success, then remove superseded credentials |
| `--yes` | Skip bootstrap confirmation; Azure or Graph sign-in can still prompt |

The initial provision uses demo-disabled placeholder mode and does not run migrations or seed data. The first application deployment therefore starts with Entra enabled and `SEED_DEMO_DATA=false`.

The script marks the apps and flow it creates. A same-name directory object without that marker is rejected unless its client ID is explicitly configured, preventing the bootstrap from taking over an unrelated customer application. It retries transient Graph failures and preserves customer-defined workforce app roles.

New credentials are written to `azd` immediately with their key ID and expiry metadata. If persistence fails, the new credential is removed. If a later tenant operation fails, rerunning resumes from the stored state instead of creating duplicate credentials. During rotation, the previous credential is retained for rollback and removed only after `--deploy` succeeds.

The script never logs access tokens or client-secret values. `azd env set` requires the value as a short-lived child-process argument, so run setup from a protected administrator workstation and avoid concurrent untrusted local users or process-capture tooling. The secret is then stored in the local ignored `azd` environment and in Key Vault during provision.

For fully non-interactive infrastructure selection, pass `--environment`, `--subscription`, `--location`, `--workforce-tenant` and `--yes`, and authenticate both CLIs in advance. Directory consent or Conditional Access can still require an interactive sign-in.

### Remaining adopter decisions

The accelerator deliberately does not guess organisational policy. After bootstrap:

1. assign approved users or groups to `Dpp.Reviewer`, `Dpp.Manager`, or `Dpp.Administrator`;
2. apply MFA, Conditional Access, access-review, session and break-glass policy;
3. review External ID branding, password reset and any optional social/federated providers;
4. test one applicant and one user in each workforce role.

The rest of this guide is a manual fallback and reference for organisations that do not permit delegated Graph automation.

## Redirect URIs

Register Web redirect URIs for each provider. The provider ID is part of the callback path and must match exactly.

| Provider | Local redirect URI | Azure redirect URI |
|---|---|---|
| Applicant External ID | `http://localhost:3000/api/auth/callback/entra-external-id` | `https://<application-host>/api/auth/callback/entra-external-id` |
| Workforce ID | `http://localhost:3000/api/auth/callback/entra-workforce` | `https://<application-host>/api/auth/callback/entra-workforce` |

The generated Container Apps host is available as `SERVICE_WEB_URI` after initial provisioning. Use a verified custom domain for stable production redirect URIs.

## Manual applicant configuration

### Register the web application

In the external tenant:

1. Open **Entra ID** > **App registrations** > **New registration**.
2. Use **Accounts in this organizational directory only**.
3. Add the applicant Web redirect URIs shown above.
4. Record the **Application (client) ID** and **Directory (tenant) ID**.
5. Record the external tenant subdomain. For `example.onmicrosoft.com`, the subdomain is `example`.
6. Create a client credential under **Certificates & secrets** using the shortest lifetime permitted by policy. Record the secret value once; do not record its secret ID.

No Microsoft Graph application permission is required by the included sign-in flow. It requests only `openid profile email`.

### Create and associate a user flow

Follow Microsoft's [sign-up and sign-in user-flow guidance](https://learn.microsoft.com/entra/external-id/customers/how-to-user-flow-sign-up-sign-in-customers):

1. Open **Entra ID** > **External Identities** > **User flows** in the external tenant.
2. Create a combined sign-up and sign-in flow.
3. Select the approved sign-in methods, such as email with password or email one-time passcode.
4. Collect **Email address**, **Given name**, **Surname**, and **Display name**.
5. Add the registered application to the user flow.
6. Configure branding, password reset, multifactor authentication, and Conditional Access according to policy.
7. Run the user flow from the Entra admin center before testing through the application.

External ID publishes metadata at:

```text
https://<tenant-subdomain>.ciamlogin.com/<tenant-id>/v2.0/.well-known/openid-configuration
```

The host difference is intentional: Microsoft documents that this tenant-subdomain discovery endpoint returns the issuer `https://<tenant-id>.ciamlogin.com/<tenant-id>/v2.0`. Do not rewrite the issuer to use the discovery host.

The app validates the metadata issuer, token signature, audience, nonce, state, PKCE verifier, `tid`, `iss`, and `sub` through the OIDC client and its own tenant checks.

## Manual workforce configuration

### Register the web application

In the workforce tenant:

1. Open **Entra ID** > **App registrations** > **New registration**.
2. Use **Accounts in this organizational directory only**.
3. Add the workforce Web redirect URIs shown above.
4. Record the **Application (client) ID** and **Directory (tenant) ID**.
5. Create a client credential under **Certificates & secrets** and record its value.

The application does not infer staff access from email, domain, group names, or tenant membership. A signed app-role claim is mandatory.

### Define app roles

Under **App registrations** > your application > **App roles**, create these roles with **Users/Groups** as the allowed member type:

| Display name | Value | Description |
|---|---|---|
| Permit reviewer | `Dpp.Reviewer` | Review and progress assigned permit cases |
| Permit manager | `Dpp.Manager` | Manage queues, assignments, decisions, reports, and policy |
| Permit administrator | `Dpp.Administrator` | Configure modules, users, teams, and platform administration |

See [add app roles and receive them in tokens](https://learn.microsoft.com/entra/identity-platform/howto-add-app-roles-in-apps). Role values are an application contract; changing them requires a coordinated code and directory deployment.

### Assign access

1. Open **Enterprise applications** > the application's service principal.
2. Set **Assignment required?** to **Yes**.
3. Assign approved users or groups to exactly the roles they require.
4. Use access reviews and privileged-access processes for manager and administrator assignments.
5. Test one user for each role and one unassigned user.

If multiple supported roles are present, the application uses `ADMIN`, then `MANAGER`, then `REVIEWER` precedence. Removing all supported roles blocks the next sign-in. Existing JWT sessions can remain valid for up to eight hours, so define an emergency session-revocation process and align session duration with Conditional Access policy.

## Manual Azure environment configuration

A manual two-phase deployment is available when the bootstrap cannot be approved:

1. deploy once in `demo` mode to obtain `SERVICE_WEB_URI`;
2. add the Azure callback URIs to both app registrations and associate the External ID user flow;
3. set the Entra values and switch to `entra` mode;
4. disable sample seeding and the sample banner, then run `azd up` again.

Set non-secret values:

```bash
azd env set ENTRA_EXTERNAL_ID_TENANT_ID <external-tenant-guid>
azd env set ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN <external-tenant-subdomain>
azd env set ENTRA_EXTERNAL_ID_CLIENT_ID <external-app-client-guid>
azd env set ENTRA_WORKFORCE_TENANT_ID <workforce-tenant-guid>
azd env set ENTRA_WORKFORCE_CLIENT_ID <workforce-app-client-guid>
```

Set secrets without putting their values literally in shell history:

```bash
read -s "EXTERNAL_SECRET?External ID client secret: "
azd env set ENTRA_EXTERNAL_ID_CLIENT_SECRET "$EXTERNAL_SECRET"
unset EXTERNAL_SECRET

read -s "WORKFORCE_SECRET?Workforce client secret: "
azd env set ENTRA_WORKFORCE_CLIENT_SECRET "$WORKFORCE_SECRET"
unset WORKFORCE_SECRET
```

Then select production-intent settings:

```bash
azd env set AUTHENTICATION_MODE entra
azd env set SEED_DEMO_DATA false
azd env set NEXT_PUBLIC_DEMO_MODE false
azd env set NEXT_PUBLIC_SHOW_SAMPLE_BANNER false
azd up
```

The preprovision hook rejects `entra` and `hybrid` modes when any required value is missing. Bicep stores both client secrets in Key Vault and injects them through versionless Container App secret references. They are not build arguments or Bicep outputs.

For normal adoption, prefer `npm run setup:identity -- --external-tenant <tenant> --deploy`; it performs these settings and directory operations together.

## Configure local OIDC testing

Keep `AUTH_ENABLE_DEMO_CREDENTIALS=true` for the normal local sample. To test Entra providers, add the seven `ENTRA_*` variables from `.env.example`. Set `AUTH_ENABLE_DEMO_CREDENTIALS=false` to test the production sign-in surface.

Never commit `.env`. Use separate app registrations or credentials for local development, and remove localhost redirect URIs from production-only registrations when policy requires that separation.

## Account linking and provisioning

The database links an OIDC identity with the immutable tuple `(issuer, subject)`. Email is stored as contact information and as audit context at first link, but it is never the identity key.

- A first External ID sign-in creates an `APPLICANT` user and applicant profile.
- A first workforce sign-in creates a staff user only when a supported `roles` claim is present.
- Workforce role changes are synchronized from the signed token at sign-in.
- An applicant identity can never resolve to a staff role.
- An inactive linked user cannot sign in.
- If an unlinked identity presents an email already used by another account, sign-in is denied. The app never merges accounts by email.

A production service should add an audited administrator workflow for resolving legitimate account-linking conflicts after identity proofing. Direct database edits are not an operating procedure.

## Validation

Test all of the following before release:

1. new applicant sign-up, sign-out, sign-in, password reset, and application tracking;
2. each workforce app role and an unassigned workforce user;
3. applicant attempts to access staff and administrator routes;
4. staff role removal, downgrade, user disablement, and emergency revocation;
5. duplicate-email conflict handling without automatic linking;
6. invalid tenant, issuer, audience, callback URI, expired secret, and missing-claim failures;
7. Conditional Access, MFA, session lifetime, audit, privacy, and support journeys;
8. client-secret rotation with an overlap period and rollback plan.

Microsoft references:

- [External ID customer overview](https://learn.microsoft.com/entra/external-id/customers/overview-customers-ciam)
- [External ID token endpoints and issuers](https://learn.microsoft.com/entra/identity-platform/security-tokens#token-endpoints-and-issuers)
- [OpenID Connect on the Microsoft identity platform](https://learn.microsoft.com/entra/identity-platform/v2-protocols-oidc)
- [Configure app roles](https://learn.microsoft.com/entra/identity-platform/howto-add-app-roles-in-apps)
