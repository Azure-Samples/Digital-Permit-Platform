# Local Development

## Prerequisites

- Node.js 22 or later
- npm
- Docker Desktop or another Docker Compose-compatible runtime
- Git
- Azure CLI only for optional keyless Azure OpenAI testing

## First run

```bash
cp .env.example .env
npm ci
docker compose up -d
npm run db:generate
npm run db:migrate:deploy
npm run db:seed:all
npm run dev
```

Open:

- application: <http://localhost:3000>
- MailHog: <http://localhost:8025>

Run the queue worker in another terminal:

```bash
npm run worker
```

## Local services

| Service | Image | Port | Purpose |
|---|---|---:|---|
| PostgreSQL | `postgres:16-alpine` | 5432 | Application and policy data |
| Redis | `redis:7-alpine` | 6379 | BullMQ queues |
| Azurite | Microsoft Azurite | 10000-10002 | Blob, queue, and table emulation |
| MailHog | `mailhog/mailhog` | 1025, 8025 | SMTP capture and browser viewer |

The application currently logs placeholder notification behavior from the worker; MailHog is present for implementing and testing SMTP integration.

## Environment file

`.env` is ignored and must never be committed. Change at least:

```dotenv
NEXTAUTH_SECRET=<random-local-secret>
AUTH_ENABLE_DEMO_CREDENTIALS=true
DEMO_PASSWORD=<local-demo-password>
```

Generate a session secret with:

```bash
openssl rand -base64 32
```

The checked-in `.env.example` contains only local sample values.

## Seed data

Run all synthetic seeds:

```bash
npm run db:seed:all
```

Or run them separately:

```bash
npm run db:seed
npm run db:seed:policy
npm run db:seed:permits
npm run db:seed:demo
```

The seeds are designed to be repeatable. They create fictional Contoso users, teams, modules, policy sections, and applications.

## Demo users

| Role | Email |
|---|---|
| Applicant | `applicant@example.com` |
| Reviewer | `reviewer@example.com` |
| Manager | `manager@example.com` |
| Administrator | `admin@example.com` |

All seeded users use `DEMO_PASSWORD`. Never use the local default in a shared environment.

`AUTH_ENABLE_DEMO_CREDENTIALS` is the server-side switch for password sign-in and local registration. `NEXT_PUBLIC_DEMO_MODE` only controls sample guidance. Set the server switch to `false` when testing the production identity surface.

## Optional Microsoft Entra sign-in

Add the External ID and workforce `ENTRA_*` variables from `.env.example` to enable either OIDC provider locally. Each provider is all-or-nothing; partial configuration stops startup. Register the exact localhost callback URIs and follow [Identity](identity.md) for user-flow and app-role setup.

## Database changes

After editing `prisma/schema.prisma`:

```bash
npm run db:migrate -- --name concise_change_name
npm run db:generate
npm run typecheck
```

Commit both the schema change and generated migration SQL. Review destructive statements before applying them to data-bearing environments.

Reset local data only when it is safe to discard it:

```bash
npm run db:reset
```

Inspect local data with:

```bash
npm run db:studio
```

## Licence template

The generated licence uses a synthetic DOCX template. Regenerate it after changing `scripts/generate-licence-template.mjs`:

```bash
npm run templates:generate
```

Commit both the generator and `public/templates/private-hire-driver-licence.docx`. Keep real authority letterheads, signatures, addresses, or licence-holder data out of this public repository.

## Optional Azure OpenAI

The local app can call Azure OpenAI keylessly through your Azure CLI identity.

1. Sign in:

   ```bash
   az login
   ```

2. Ensure your user has **Cognitive Services OpenAI User** on the target account.
3. Set:

   ```dotenv
   AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com/
   AZURE_OPENAI_DEPLOYMENT=gpt-4.1-mini
   AZURE_OPENAI_API_VERSION=2024-10-21
   ```

4. Seed the policy and start the app.

Leave `OPENAI_API_KEY` unset for the Azure keyless path. AI UI degrades gracefully when no endpoint is configured.

The scripts `scripts/test-ai.ts` and `scripts/test-complex.ts` call a configured Azure OpenAI deployment and can incur cost. Use only synthetic inputs.

## Quality gates

Run before a pull request:

```bash
npm run lint
npm run typecheck
npm test
NODE_ENV=production npm run build
npm audit --audit-level=low
```

The production build requires a reachable database only for routes that query at request time; build-time generation must not depend on local Azure resources.

## Container checks

```bash
docker build -t digital-permit-web:local .
docker build -f Dockerfile.worker -t digital-permit-worker:local .
```

Both final images run as UID 1001. The web image exposes port 3000 and includes a liveness health check.

## Stop local services

```bash
docker compose down
```

Delete local volumes and all local data only when intended:

```bash
docker compose down -v
```

## Troubleshooting

See [Troubleshooting](troubleshooting.md). Common causes are occupied ports, stale Docker volumes after schema changes, missing Prisma generation, a weak/missing `NEXTAUTH_SECRET`, or Azure CLI identity not authorised for Azure OpenAI.
