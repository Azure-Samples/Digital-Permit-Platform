# Configuration

Configuration has three scopes:

- local runtime values in ignored `.env` files;
- `azd` environment values used by hooks and Bicep;
- module configuration stored and versioned in PostgreSQL.

Do not commit real secrets or customer values. `.env.example` contains synthetic local defaults only.

## Local environment variables

### Application and public UI

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | No | Contoso sample name | Embedded into the client build; changing it requires a rebuild |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public application origin embedded at build time |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | No | Synthetic address | Displayed in the footer; embedded at build time |
| `NEXT_PUBLIC_SUPPORT_PHONE` | No | Synthetic number | Displayed in the footer; embedded at build time |
| `NEXT_PUBLIC_DEMO_MODE` | No | `true` locally | Shows synthetic demo-user guidance; not an access-control setting |
| `NEXT_PUBLIC_SHOW_SAMPLE_BANNER` | No | `true` | Shows the warning not to enter real data |
| `NEXT_PUBLIC_MAX_FILE_SIZE_MB` | No | `10` | Client display value; keep aligned with `MAX_FILE_SIZE_MB` |
| `NODE_ENV` | Managed | `development` locally | Use `production` for builds and deployed containers |

All `NEXT_PUBLIC_*` values are visible to browsers. Never place secrets in them.

### Database and authentication

| Variable | Required | Secret | Notes |
|---|---|---:|---|
| `DATABASE_URL` | Yes | Yes | Prisma PostgreSQL URL; Azure requires TLS |
| `NEXTAUTH_URL` | Yes outside local defaults | No | Canonical application origin used by NextAuth |
| `NEXTAUTH_SECRET` | Yes | Yes | Random signing secret; rotate under a planned session invalidation |
| `AUTH_ENABLE_DEMO_CREDENTIALS` | No | No | Server-side access-control switch for local password sign-in and registration; exact value must be `true` |
| `DEMO_PASSWORD` | Required when production-mode seeding runs | Yes | Password assigned to synthetic users; migration job only in Azure |

The Azure template stores the database URL and session/demo secrets in Key Vault. The web app does not receive `DEMO_PASSWORD`; only the migration job does.

### Microsoft Entra identity

Configure all values for a provider or leave all of that provider's values empty. Partial provider configuration stops application startup rather than creating an ambiguous sign-in path.

| Variable | Required | Secret | Notes |
|---|---|---:|---|
| `ENTRA_EXTERNAL_ID_TENANT_ID` | For applicant External ID | No | External directory tenant GUID |
| `ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN` | For applicant External ID | No | Prefix used by `<subdomain>.ciamlogin.com` |
| `ENTRA_EXTERNAL_ID_CLIENT_ID` | For applicant External ID | No | Web app registration client GUID |
| `ENTRA_EXTERNAL_ID_CLIENT_SECRET` | For applicant External ID | Yes | External tenant app credential |
| `ENTRA_WORKFORCE_TENANT_ID` | For workforce ID | No | Council workforce tenant GUID |
| `ENTRA_WORKFORCE_CLIENT_ID` | For workforce ID | No | Workforce web app registration client GUID |
| `ENTRA_WORKFORCE_CLIENT_SECRET` | For workforce ID | Yes | Workforce app credential |

The External ID callback is `/api/auth/callback/entra-external-id`; the workforce callback is `/api/auth/callback/entra-workforce`. Workforce tokens must contain `Dpp.Reviewer`, `Dpp.Manager`, or `Dpp.Administrator` in the `roles` claim. See [Identity](identity.md) for app registrations, user flows, role assignments, and rotation.

For normal adoption, do not set these values individually. Run `npm run setup:identity -- --external-tenant <tenant> --deploy`; the command discovers or creates marked directory resources and writes the complete `azd` contract without logging secrets. It records `ENTRA_EXTERNAL_ID_USER_FLOW_ID`, `ENTRA_WORKFORCE_SERVICE_PRINCIPAL_ID`, credential key IDs, and expiry dates for credentials it creates or can unambiguously identify.

### Redis and queues

| Variable | Required | Secret | Notes |
|---|---|---:|---|
| `REDIS_URL` | Yes for queue operations | Yes | `redis://` locally, `rediss://` in Azure; username/password are URL-decoded |

The Azure URL uses port 10000 and TLS. The connection factory enables TLS whenever the scheme is `rediss:`.

### Blob Storage

| Variable | Required | Secret | Notes |
|---|---|---:|---|
| `AZURE_STORAGE_CONNECTION_STRING` | Local only | Yes | `UseDevelopmentStorage=true` selects Azurite |
| `AZURE_STORAGE_ACCOUNT_NAME` | Azure only | No | Selects managed-identity authentication when no connection string is present |
| `AZURE_STORAGE_CONTAINER_DOCUMENTS` | No | No | Defaults to `documents` |
| `AZURE_STORAGE_CONTAINER_EXPORTS` | Reserved | No | Provisioned for extension work; current storage helper writes documents only |

Do not set an Azure account connection string in deployed environments. The Bicep template disables Storage shared-key access and supplies only the account name.

### Azure OpenAI

| Variable | Required | Secret | Notes |
|---|---|---:|---|
| `AZURE_OPENAI_ENDPOINT` | Only for AI | No | Azure OpenAI account endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | Only for AI | No | Deployment name; defaults to `gpt-4.1-mini` in the sample environment |
| `AZURE_OPENAI_API_VERSION` | No | No | Defaults to `2024-10-21` |
| `OPENAI_MODEL` | Alternative local setting | No | Used only when no Azure deployment variable is set |
| `OPENAI_API_KEY` | Optional fallback | Yes | Direct OpenAI-compatible fallback; not used or provisioned by the Azure template |

The supported Azure path uses `DefaultAzureCredential` and the web managed identity. Avoid API keys in Azure.

### Monitoring

| Variable | Required | Secret | Notes |
|---|---|---:|---|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No locally | Treat as sensitive config | Enables Azure Monitor OpenTelemetry in the web and worker processes |

The Azure template stores this connection string in Key Vault and injects it as a Container App secret reference. Instrumentation is disabled when the variable is empty.

### Upload validation

| Variable | Required | Default | Notes |
|---|---|---|---|
| `MAX_FILE_SIZE_MB` | No | `10` | Enforced by upload API routes |
| `ALLOWED_MIME_TYPES` | No | PDF, common images, DOC, DOCX, XLSX | Server-side MIME allowlist; not content inspection |

Policy imports have a separate fixed allowlist: PDF, DOCX, Markdown and plain text. They use `MAX_FILE_SIZE_MB` with a 10MB default, require matching filename/MIME signatures, and cap extracted text at 500,000 characters. PDF/DOCX parsing runs in a worker with a 15-second timeout and memory limit; DOCX archives also have entry-count, expanded-size, entry-size and compression-ratio limits. The current full-context AI mode permits activation only when policy section content is at most 120,000 characters.

MIME and size validation do not provide malware protection. Add scanning before marking files safe.

### Reserved integration settings

`.env.example` also includes SMTP and rate-limit settings as integration placeholders. The current worker logs notification jobs and does not send SMTP mail. The current API does not consume the rate-limit values. Do not claim either as an implemented production control until an integration and tests are added.

## Azure Developer CLI values

### Generated secrets

The preprovision hook creates these once when absent:

| Value | Used by |
|---|---|
| `DATABASE_PASSWORD` | PostgreSQL administrator and Key Vault database URL |
| `NEXTAUTH_SECRET` | Key Vault and web session signing |
| `DEMO_PASSWORD` | Key Vault and optional migration-job seeding |

To replace a generated value, set it explicitly and reprovision. Plan rotation because changing database or session secrets can interrupt service.

### Customer-supplied identity credentials

`ENTRA_EXTERNAL_ID_CLIENT_SECRET` and `ENTRA_WORKFORCE_CLIENT_SECRET` are created in their respective app registrations, not generated by the hook. Supply them through `azd env set` as described in [Identity](identity.md). In `entra` and `hybrid` modes, Bicep stores them in Key Vault and only the web identity receives read access to those individual secrets.

### Deployment settings

| Value | Default | Purpose |
|---|---|---|
| `AZURE_ENV_NAME` | Prompted | Environment/resource suffix and tag |
| `AZURE_LOCATION` | Prompted | Primary Azure region |
| `ENABLE_AI` | `false` | Provisions Azure OpenAI and role assignment |
| `AZURE_OPENAI_LOCATION` | Primary location | Separate AI region |
| `AZURE_OPENAI_CAPACITY` | `10` | Global Standard model capacity |
| `AUTHENTICATION_MODE` | `demo` | `demo`, `entra`, or `hybrid`; controls server-side providers |
| `ENTRA_EXTERNAL_ID_*` | Disabled placeholders | External tenant and app registration settings |
| `ENTRA_WORKFORCE_*` | Disabled placeholders | Workforce tenant and app registration settings |
| `SEED_DEMO_DATA` | `true` | Runs all synthetic seeds after migrations |
| `NEXT_PUBLIC_APP_NAME` | Digital Permit Platform | Public product/service name |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Synthetic placeholder | Public support address |
| `NEXT_PUBLIC_SUPPORT_PHONE` | Synthetic placeholder | Public support telephone |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | Demo-user UI guidance |
| `NEXT_PUBLIC_SHOW_SAMPLE_BANNER` | `true` | Sample-data warning |

Boolean values must be lowercase `true` or `false` for the Bicep and hook contracts.

## Module configuration

An active `ModuleVersion` can define:

- public description and before-you-start guidance;
- application types;
- form sections and fields;
- conditional field and document rules;
- document requirements and verification status;
- workflow stages, order, SLA days, reminders, and visibility;
- review checklist;
- fees and payment mode;
- owning team and submission mailbox;
- eligibility and retention settings;
- decision and notification templates;
- feature flags and application availability.

Use the administrator module builder for demonstration and controlled configuration. For production, define review, approval, promotion, rollback, and audit processes for module changes.

## Validation

After changing environment or module configuration:

1. build the app so all public values are embedded;
2. test applicant and staff journeys;
3. test hidden/required conditional fields and documents;
4. validate workflow transitions and SLA dates;
5. verify Key Vault references and managed-identity access;
6. confirm no secrets appear in logs, build arguments, screenshots, or outputs.
