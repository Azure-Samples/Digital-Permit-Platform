# Troubleshooting

## Diagnostic sequence

1. Capture the exact command, time, environment name, and final error without secrets.
2. Confirm tool versions and current directory.
3. Confirm authentication, subscription, region, and environment values.
4. Check the narrow component: build, Bicep, migration job, Container App revision, database, Redis, Storage, or OpenAI.
5. Apply one change and rerun the same failing check.

Never paste `azd env get-values`, connection strings, SAS URLs, tokens, or complete application data into a public issue.

## Local setup

### `node` or `npm` is not found

Verify Node.js 22+ is installed and the shell `PATH` includes its bin directory:

```bash
command -v node
node --version
npm --version
```

Restart the terminal after installing Node. Avoid overwriting `PATH` with a project variable.

### Port is already in use

Check common ports:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:5432 -sTCP:LISTEN
lsof -nP -iTCP:6379 -sTCP:LISTEN
```

Stop the conflicting process or change the local mapping. Do not run two platform copies against the same demo database unless intended.

### PostgreSQL is not ready

```bash
docker compose ps
docker compose logs db
pg_isready -h localhost -p 5432
```

If the schema changed while a stale volume remained, apply migrations. Delete volumes only when local data can be discarded:

```bash
docker compose down -v
docker compose up -d
npm run db:migrate:deploy
npm run db:seed:all
```

### Prisma client errors

Regenerate after dependency/schema changes:

```bash
npm run db:generate
npm run typecheck
```

Use the same Node architecture/runtime as the current install. Containers generate the Linux client during image build.

### Next.js build behaves like development

Do not carry `NODE_ENV=development` into a production build:

```bash
NODE_ENV=production npm run build
```

The Dockerfile sets `NODE_ENV=production` explicitly.

## Docker

### Web health check fails

Run and inspect the container:

```bash
docker run --rm -p 3000:3000 --env-file .env digital-permit-web:local
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/api/health/ready
```

`/api/health` checks process liveness. `/api/health/ready` requires a reachable database.

### Worker exits immediately

The worker requires `REDIS_URL`; some jobs also require database/storage settings. Inspect logs and verify the URL scheme/port. Azure Managed Redis must use `rediss://`.

## Azure Developer CLI

### Hook cannot run `azd` or `az`

Confirm both CLIs are installed and visible to the same shell:

```bash
azd version
az version
```

The postdeploy hook also requires the Container Apps CLI commands. Update Azure CLI/extensions when `az containerapp job` commands are unavailable.

### Preprovision cannot find `AZURE_LOCATION`

Create/select an environment through `azd` before running provisioning:

```bash
azd env new
azd env select
azd provision
```

### Bicep registry restore fails

AVM modules are fetched from the public Bicep registry. Check network/proxy access and retry:

```bash
az bicep restore --file infra/main.bicep --force
az bicep build --file infra/main.bicep
```

Do not replace verified modules with copied generated ARM JSON.

### Role assignment failure

The deploying principal needs permission for `Microsoft.Authorization/roleAssignments/write`. Assign **User Access Administrator** at the approved scope or use an organisation deployment identity with that permission.

Wait for managed-identity replication when an immediate role assignment intermittently reports the principal is not found, then rerun provisioning.

### Azure Policy denies a resource

Read the deny assignment/policy details. Common conflicts include allowed regions, required tags, public network access, SKU restrictions, and diagnostic settings. Adapt the template to policy; do not bypass organisational policy for the sample.

## Database and migrations

### Migration job fails

Find the latest execution:

```bash
az containerapp job execution list \
  --name "$(azd env get-value MIGRATIONS_JOB_NAME)" \
  --resource-group "$(azd env get-value AZURE_RESOURCE_GROUP)" \
  -o table
```

Inspect job/system logs in the portal or Log Analytics. Common causes:

- Key Vault reference not resolved;
- PostgreSQL not ready or private DNS/network path missing;
- migration SQL incompatible with existing data;
- image deployment did not replace the placeholder;
- demo seeding lacks `DEMO_PASSWORD` in production mode.

Do not repeatedly rerun a partially destructive migration until its database state is understood.

### Web readiness stays 503 after deployment

Check:

- PostgreSQL provisioning state;
- Container Apps VNet integration;
- PostgreSQL private DNS link;
- `database-url` Key Vault reference status;
- web identity **Key Vault Secrets User** assignment;
- latest revision logs.

## Redis and queues

### TLS or connection reset errors

Azure Managed Redis uses an encrypted endpoint and the configured port, normally 10000 in this template. The URL must begin with `rediss://`. Ensure reserved characters in the password are URI-encoded; Bicep does this when creating the URL.

### Jobs are not processed

- confirm the worker has a ready replica;
- compare web and worker `REDIS_URL` references;
- inspect failed jobs and worker logs;
- verify queue names match producers/consumers;
- confirm the sample worker behavior is implemented for that job type.

Notification and malware-scanning jobs are placeholders; logging a simulated result is expected until those integrations are replaced.

## Blob Storage

### Upload receives 403

Confirm the web identity has **Storage Blob Data Contributor** and the account name/container variables are correct. Storage shared-key access is disabled, so adding an account key is not the supported fix.

### Download URL receives 403

User-delegation SAS generation requires both Blob data access and **Storage Blob Delegator**. Check clock skew, role propagation, blob path, and SAS expiry. Never log the generated SAS URL.

### Azurite cannot connect locally

Use:

```dotenv
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
```

Confirm the Azurite container is running and port 10000 is free.

## Azure OpenAI

### AI controls are hidden or return 503

`AZURE_OPENAI_ENDPOINT` is empty when AI is disabled. Set `ENABLE_AI=true` and redeploy, or configure the local endpoint/deployment values.

### 401 or 403 from Azure OpenAI

In Azure, confirm the web identity has **Cognitive Services OpenAI User** on the account. Locally, run `az login` and assign the same data-plane role to your user.

Do not add an API key to work around a missing RBAC assignment in the supported Azure deployment.

### Model or quota deployment fails

Model versions, deployment types, and quota vary by region. Check the Foundry model catalog and subscription quota. Change `AZURE_OPENAI_LOCATION`, request quota, or deliberately update the Bicep model/version after compatibility evaluation.

### AI result remains processing

The current analyser runs work in the web process. A restart can interrupt it. Retry the analysis and inspect web exceptions. For guaranteed production processing, move analysis to a durable queue/job.

## Monitoring

### No Application Insights data

- confirm the Key Vault reference resolved;
- confirm the web/worker revision has `APPLICATIONINSIGHTS_CONNECTION_STRING` as a secret reference;
- generate traffic and wait for ingestion;
- check egress and public ingestion policy;
- inspect SDK initialization errors in console logs.

### Container log query returns no table

The included environment uses Log Analytics destination tables with `_CL` suffixes. Environments configured for Azure Monitor destination use different table names. Inspect workspace tables before reusing a query.

## Getting help

For reproducible sample defects, follow [SUPPORT.md](../SUPPORT.md). For subscription incidents, billing, capacity, quota, or service health, use Azure support. Report vulnerabilities privately through [SECURITY.md](../SECURITY.md).
