# Deployment

## Deployment model

The supported deployment path uses the Azure Developer CLI (`azd`) and Bicep. It provisions a new resource group per `azd` environment, remotely builds three images in Azure Container Registry, deploys Container Apps, and runs database migrations as a one-shot Container Apps Job.

No Azure resource is shared or expected to exist before deployment.

## Prerequisites

### Tools

- Azure Developer CLI 1.25 or later
- Azure CLI
- Git
- Node.js 22 or later for hooks and local validation
- Docker only for local image builds
- access to an External ID tenant and the council workforce tenant when `AUTHENTICATION_MODE` is `entra` or `hybrid`

Verify:

```bash
azd version
az version
node --version
```

### Azure permissions

The deployment creates resources and Azure role assignments. The deploying principal normally needs:

- **Contributor** on the subscription or target scope; and
- **User Access Administrator** for role assignments.

An **Owner** assignment includes both capabilities but is broader than necessary. Follow the organisation's privileged-access process rather than granting standing access solely for this sample.

### Resource providers

Ensure these providers can be registered:

- `Microsoft.App`
- `Microsoft.ContainerRegistry`
- `Microsoft.DBforPostgreSQL`
- `Microsoft.Cache`
- `Microsoft.Storage`
- `Microsoft.KeyVault`
- `Microsoft.CognitiveServices` when AI is enabled
- `Microsoft.OperationalInsights`
- `Microsoft.Insights`
- `Microsoft.ManagedIdentity`
- `Microsoft.Network`

The deploying principal can check registration with:

```bash
az provider show --namespace Microsoft.App --query registrationState -o tsv
```

## Capacity and policy preflight

Before `azd up`, confirm:

1. the intended region is allowed by Azure Policy;
2. PostgreSQL `Standard_B1ms` and Azure Managed Redis `Balanced_B0` are available;
3. Container Apps environment and managed-environment quota is available;
4. required tags and naming policies are understood;
5. public-endpoint or private-network policies do not conflict with the development profile;
6. when AI is enabled, `gpt-4.1-mini` version `2025-04-14` supports Global Standard in the selected AI region and sufficient token quota exists.

Model availability changes independently of the application region. Keep `AZURE_OPENAI_LOCATION` separate from `AZURE_LOCATION`.

## Deploy a new environment

Authenticate and run:

```bash
azd auth login
azd up
```

`azd` prompts for:

- environment name;
- subscription;
- primary location.

Use a short environment name such as `dev`, `test01`, or `pilot`. It becomes part of resource names and tags.

### What the hooks do

The `preprovision` hook creates missing values once per environment:

- `DATABASE_PASSWORD`
- `NEXTAUTH_SECRET`
- `DEMO_PASSWORD`
- default AI, branding, and seed settings
- default `demo` authentication mode and disabled Entra placeholders

Existing values are never changed by the hook. Secret values are not printed.
For `entra` and `hybrid`, the hook fails unless all External ID and workforce tenant, client, and secret values are configured.

The `postdeploy` hook starts the migration job, overrides `SEED_DEMO_DATA` for that execution, and waits for `Succeeded`. Deployment fails if migrations fail or exceed 30 minutes.

## Configure before deployment

Set values after `azd env new` and before `azd up`, or update them and rerun `azd up`.

```bash
azd env set NEXT_PUBLIC_APP_NAME "Example Council Permit Platform"
azd env set NEXT_PUBLIC_SUPPORT_EMAIL "permits@example.gov.uk"
azd env set NEXT_PUBLIC_SUPPORT_PHONE "0300 123 4567"
azd env set NEXT_PUBLIC_DEMO_MODE true
azd env set NEXT_PUBLIC_SHOW_SAMPLE_BANNER true
azd env set SEED_DEMO_DATA true
```

Use `SEED_DEMO_DATA=false` outside demonstration environments. Demo mode is a UI flag; it is not a security boundary.

### Load the local licensing policy

After the first application deployment, a manager or administrator uses **Policy Copilot > Manage policy versions** to upload the authority's approved Statement of Licensing Policy. The application accepts text-based PDF, DOCX, Markdown and text files up to 10MB, preserves the source file, creates an inactive version, and extracts sections for preview. Activating the reviewed version switches Policy Copilot and application insight together; it does not require a redeployment.

Scanned image-only PDFs require OCR before upload. Do not enable policy-grounded AI for service users until the authority has reviewed the parsed sections and tested representative citations.

### Configure end-user identity

The default `azd up` path uses synthetic demo credentials for evaluation. For a new production-intent environment, use one guided command instead:

```bash
npm run setup:identity -- --external-tenant <tenant-id-or-domain> --deploy
```

When necessary, it creates/selects the `azd` environment and runs `azd provision` in demo-disabled placeholder mode to derive `SERVICE_WEB_URI` without deploying or seeding the application. It then derives the workforce tenant, creates both app registrations and service principals, creates and associates the applicant user flow, configures workforce roles and assignment enforcement, stores credentials in `azd`, switches to `entra`, disables demo data and performs the first `azd up`. Follow [Identity](identity.md) for required directory roles, a no-change preview and manual fallback.

Do not enable `entra` until both client credentials are set. Bicep stores them in Key Vault; only the web Container App receives versionless secret references.

### Enable optional AI

```bash
azd env set ENABLE_AI true
azd env set AZURE_OPENAI_LOCATION uksouth
azd env set AZURE_OPENAI_CAPACITY 10
azd up
```

If deployment reports unavailable model, SKU, or quota, select a supported region or update the model definition in `infra/modules/platform.bicep` after validating application compatibility.

## Deployment outputs

Inspect the environment:

```bash
azd env get-values
```

Important non-secret outputs include:

| Output | Meaning |
|---|---|
| `AZURE_RESOURCE_GROUP` | Environment resource group |
| `SERVICE_WEB_URI` | Public application URL |
| `WEB_APP_NAME` | Web Container App |
| `WORKER_APP_NAME` | Worker Container App |
| `MIGRATIONS_JOB_NAME` | Manual migration job |
| `AZURE_CONTAINER_REGISTRY_NAME` | ACR name |
| `AZURE_STORAGE_ACCOUNT_NAME` | Storage account |
| `AZURE_KEY_VAULT_NAME` | Key Vault |
| `AZURE_OPENAI_ENDPOINT` | Empty when AI is disabled |

Never share `azd env get-values` output without reviewing it; an `azd` environment also contains generated secrets.

## Update an environment

### Application-only change

```bash
azd deploy
```

This rebuilds and deploys all three services and runs the postdeploy migration job.

Deploy one service only when no schema or shared configuration changed:

```bash
azd deploy web
```

### Infrastructure change

```bash
azd provision
azd deploy
```

Run Bicep validation and review the planned cost/security impact before provisioning shared environments.

### Database migration

Add a checked-in Prisma migration; do not use `prisma db push` for managed environments.

```bash
npm run db:migrate -- --name describe_change
azd deploy
```

The migration image contains Prisma CLI and the checked-in migration directory. The job applies `prisma migrate deploy` before optional seed commands.

## Validate without deploying

```bash
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=low
az bicep restore --file infra/main.bicep
az bicep build --file infra/main.bicep
azd show --no-prompt
```

Subscription-aware `az deployment sub validate` requires concrete values in place of the `azd` substitutions in `infra/main.parameters.json`.

## CI/CD

The included validation workflow does not deploy Azure resources. For environment deployment:

1. use workload identity federation instead of a client secret;
2. scope the deployment identity to the target subscription or resource group;
3. protect production with GitHub environments and required reviewers;
4. run validation before `azd provision` or `azd deploy`;
5. keep environment secrets in the CI environment, not repository variables;
6. retain deployment and migration evidence.

Use `azd pipeline config` only after reviewing the generated permissions and workflow against organisational policy.

## Cleanup

Delete an environment with:

```bash
azd down --purge
```

Confirm that no required data or backups remain only in the environment. Key Vault purge protection intentionally prevents immediate permanent deletion until its retention window expires.

Remove local `azd` environment metadata separately when it is no longer needed:

```bash
azd env delete <environment-name>
```

## Deployment limitations

- The default is a development topology, not a multi-region production topology.
- PostgreSQL uses password authentication, with the password held in Key Vault. Evaluate Microsoft Entra-only database authentication for production.
- Redis uses access-key authentication held in Key Vault. Evaluate Microsoft Entra authentication and disable keys where the client/runtime design supports token refresh.
- Redis, Storage, Key Vault, ACR, and optional OpenAI retain public service endpoints in the default profile.
- Synthetic demo users and data are enabled by default for accelerator exploration.
- Migration seeding is idempotent but should be disabled for production datasets.

See [Security](security.md) and [Operations](operations.md) before adapting the template for production.
