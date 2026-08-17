# Configuration

Configuration has four scopes:

- local runtime values in ignored `.env` files;
- `azd` environment values used by hooks and Bicep;
- the active council profile stored in PostgreSQL and managed through `/setup`;
- module configuration stored and versioned in PostgreSQL.

Do not commit real secrets or customer values. `.env.example` contains synthetic local defaults only.

## Local environment variables

### Application and public UI

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | No | Contoso sample name | Public bootstrap fallback before a council profile is applied |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public application origin embedded at build time |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | No | Synthetic address | Bootstrap support fallback before setup |
| `NEXT_PUBLIC_SUPPORT_PHONE` | No | Synthetic number | Bootstrap telephone fallback before setup |
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

Policy imports have a separate fixed allowlist: PDF, DOCX, Markdown and plain text. The policy library accepts source documents up to 50MB, verifies matching filename/MIME signatures, and retains the complete original in PostgreSQL for private viewing or download. PDF/DOCX parsing runs in a bounded worker with a 60-second timeout and memory limit; PDFs are limited to 1,000 pages and DOCX archives retain entry-count, expanded-size, entry-size and compression-ratio protections. Up to 2,000,000 extracted characters are indexed internally. Longer source files are still retained, and activation has no text-length restriction.

Uploaded PDFs are displayed from the retained original rather than being regenerated as web content. Policy Copilot ranks the stored sections against each question or application and sends at most 48,000 relevant characters to the model. A scanned or image-only PDF can still be stored, viewed, downloaded and activated, but Policy Copilot remains unavailable for that version until searchable text is supplied.

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

## Runtime council profile

The singleton `CouncilProfile` overrides public application name/contact/brand fallbacks after an administrator publishes `/setup`. In-app Setup edits council and service names, support contacts, constrained colours, a bounded logo, and whether the council name appears beside a custom logo. The same record retains module/deployment/domain/identity metadata established elsewhere, but the main application preserves those fields and does not expose them for editing. Module availability and versions are controlled only through the administrator **Modules** area.

Profile mutations require an authenticated administrator and trusted same-origin request. They are written with an append-only audit snapshot that excludes logo bytes. The active logo is served through a `nosniff` application route; unversioned reads are `no-store`, while hash-versioned reads are immutable.

**Reset to Contoso defaults** is a live platform reset, not a browser-draft reset. It restores the Contoso council name and packaged wordmark, the environment-resolved default service/support values, and the default `#0b2e5e` / `#009fe3` colours. It clears uploaded logo data and marks presentation setup as incomplete. The reset is audited and deliberately preserves the deployed domain, Azure/identity intent, selected-module metadata, and every module's enabled/versioned state.

The setup manifest and API never accept or return passwords, client secrets, tokens, database URLs, or generated deployment secrets.

## Policy regimes and taxi readiness

The policy library supports two independently versioned regimes, each with at most one active version:

| Regime key | Council document | Status and principal framework |
|---|---|---|
| `licensing_act_2003` | Statement of Licensing Policy | Statutory statement under [section 5 of the Licensing Act 2003](https://www.legislation.gov.uk/ukpga/2003/17/section/5) |
| `taxi_private_hire` | Hackney carriage and private hire licensing policy | Cohesive policy recommended by [DfT statutory standards](https://www.gov.uk/government/publications/statutory-taxi-and-private-hire-vehicle-standards/statutory-taxi-and-private-hire-vehicle-standards) and [best-practice guidance](https://www.gov.uk/government/publications/taxi-and-private-hire-vehicle-licensing-best-practice-guidance/taxi-and-private-hire-vehicle-licensing-best-practice-guidance-for-licensing-authorities-in-england); the policy document is not itself a mandatory statutory statement |

Outside London, hackney carriage powers commonly derive from the [Town Police Clauses Act 1847](https://www.legislation.gov.uk/ukpga/Vict/10-11/89/contents), while Part II of the [Local Government (Miscellaneous Provisions) Act 1976](https://www.legislation.gov.uk/ukpga/1976/57/part/II) covers hackney carriage and private-hire vehicles, drivers and operators where adopted. The [Taxis and Private Hire Vehicles (Safeguarding and Road Safety) Act 2022](https://www.legislation.gov.uk/ukpga/2022/14/contents), [Taxis and Private Hire Vehicles (Disabled Persons) Act 2022](https://www.legislation.gov.uk/ukpga/2022/29/contents), Equality Act 2010 and statutory DfT standards add further duties. London, Plymouth and authorities with local legislation can operate under different or modified provisions. Adopters must confirm their own legal basis.

The Modules registry remains authoritative for whether taxi services are offered. If any taxi/private-hire module is enabled without an active taxi policy, Modules and Licensing policies show a recommendation warning. If a taxi policy is active while every taxi module is disabled, both areas show the inverse mismatch. These are readiness warnings rather than legal or technical blockers: uploading or activating a policy never silently enables modules, and changing modules never silently activates a policy.

Policy Copilot uses one interface for both regimes. Taxi-specific questions and taxi applications use only the active taxi policy; Licensing Act questions use only the active statement; genuinely cross-cutting or ambiguous questions can retrieve bounded excerpts from both. Source references are namespaced by regime to avoid collisions between identically numbered sections.

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

## Licence document templates

Administrators manage generated Word documents at `/admin/licence-management`. The built-in standard DOCX template is available to every configured licence and permit type, including disabled modules. Administrators can also upload any number of tailored templates and assign each upload to one, several, or all licence types. Assignment changes do not alter documents already generated for a case.

Uploads must be genuine Microsoft Word `.docx` files no larger than 5MB. The server checks the extension, MIME type, ZIP structure, Word document body, and expanded document size before storing the file in PostgreSQL. Template upload, reassignment, deletion, and licence generation are audited. Uploaded source files are private, `no-store` downloads; the packaged standard template is a public starter asset and contains no customer data.

### Add fields to a DOCX template

Type merge fields as ordinary text in Microsoft Word using angle brackets. Do not use Word Mail Merge fields, add spaces inside the brackets, or split one field across differently formatted text runs.

Examples:

```text
Licence number: <licence_number>
Licence holder: <applicant_name>
Valid until: <expiry_date>
```

The **Field guide** tab lists and copies all supported system fields. It also derives application-specific fields from the active form schema for each licence type. Common system fields include:

| Field | Inserted value |
|---|---|
| `<council_name>` | Configured licensing authority |
| `<service_name>` | Configured service name |
| `<licence_type>` | Licence or permit display name |
| `<licence_number>` | Generated unique licence number |
| `<application_reference>` | Application reference |
| `<application_type>` | New, Renewal, Variation, or another configured type |
| `<issue_date>` | Generation date in `DD/MM/YYYY` format |
| `<expiry_date>` | Calculated expiry date in `DD/MM/YYYY` format |
| `<applicant_name>` | Applicant or licence-holder name |
| `<applicant_address>` | Multi-line application/profile address |
| `<support_email>` | Configured support email |
| `<support_phone>` | Configured support telephone |

Application field names use the field key from the active module form schema, for example `<date_of_birth>` or `<vehicle_registration>`. Values are formatted for display; dates use `DD/MM/YYYY`, address objects use readable lines, and fields without a saved answer become blank. The legacy `{{lic_no}}`, `{{commencement_date}}`, `{{expiry_date}}`, `{{lic_holder}}`, and `{{lic_holder_address}}` syntax remains supported for existing templates.

Staff choose from templates assigned to the case's licence type when generating an approved licence. The standard template is always offered as a fallback. The generated DOCX is stored on the case, and its template ID and name are recorded in the audit trail. Review a generated test document before operational use, particularly where Word formatting may have split a field into multiple runs.

## Validation

After changing environment or module configuration:

1. preview and apply the runtime council profile as an administrator;
2. test applicant and staff journeys, metadata, contacts, logo, and mobile header;
3. test hidden/required conditional fields and documents;
4. validate workflow transitions and SLA dates;
5. upload one tailored DOCX, assign it to multiple licence types, and confirm it appears only for matching approved cases;
6. generate the standard and tailored documents and check all required merge fields;
7. verify Key Vault references and managed-identity access;
8. confirm no secrets appear in logs, build arguments, screenshots, or outputs.
