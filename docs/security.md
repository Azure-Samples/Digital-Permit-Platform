# Security

## Security position

This solution accelerator demonstrates secure Azure patterns where practical, but it is not a security accreditation, penetration-tested product, or compliance guarantee. The default topology is intentionally accessible for evaluation. Adopters own the production threat model and control implementation.

Never enter real personal, identity, payment, medical, criminal-record, or customer data into an unassessed sample environment.

## Data classes

A real permit platform can process:

- names, addresses, contact details, dates of birth, and signatures;
- identity documents and photographs;
- driving, immigration, criminal-record, medical, disability, and benefit evidence;
- business ownership, premises, vehicle, animal, and financial information;
- officer notes, representations, consultation responses, and decisions;
- chat prompts and uploaded licence documents sent for AI processing;
- audit, device, IP, telemetry, and support data.

Complete a data inventory, records-of-processing assessment, DPIA where required, retention schedule, data-subject-rights process, and lawful-basis review before production use.

## Implemented controls

### Azure platform

- separate user-assigned managed identities for web, worker, and migrations;
- managed-identity ACR pulls with the registry admin user disabled;
- Blob Storage shared-key access disabled;
- keyless Azure OpenAI calls with local authentication disabled;
- least-privilege Blob, Key Vault, ACR, and OpenAI role assignments;
- Key Vault RBAC, soft delete, and purge protection;
- Container App Key Vault references for database, Redis, session, demo, and telemetry values;
- Key Vault-backed External ID and workforce OIDC client credentials when Entra authentication is enabled;
- PostgreSQL public access disabled on a delegated subnet with private DNS;
- TLS for PostgreSQL and Redis;
- HTTPS-only Container Apps ingress;
- Storage public blob access disabled;
- short-lived read-only user-delegation SAS for Blob downloads;
- non-root web and worker containers;
- Log Analytics and Application Insights integration;
- deterministic Bicep and lockfile-based dependencies.

### Application

- bcrypt password hashes for sample credential accounts;
- tenant-scoped OIDC validation for applicant External ID and workforce Entra ID;
- PKCE, state, nonce, signature, issuer, audience, and tenant checks through the OIDC flow;
- immutable `(issuer, subject)` account links with no automatic email-based merging;
- applicant identities constrained to `APPLICANT` and workforce roles sourced from signed app-role claims;
- local registration and password sign-in gated by a server-side demo setting;
- idempotent identity bootstrap using temporary delegated Graph consent, bounded credentials, no secret output, and no persistent deployment identity with directory write permissions;
- same-origin validation on policy import, activation, draft deletion, AI chat and application-insight generation in addition to authenticated role checks;
- resource-limited PDF/DOCX policy parsing with archive expansion and extracted-text bounds;
- sandboxed, same-origin-only inline PDF policy viewing with private/no-store responses and explicit download fallback;
- server-side session and role checks on protected workflows;
- bounded JWT session lifetime;
- file-size and MIME allowlists;
- generated random object names rather than user-controlled Blob paths;
- append-only audit records for material operations;
- AI routes restricted by role where officer access is required;
- officer conversations bound to the authenticated user; anonymous applicant conversations bound to a high-entropy browser-held access key;
- per-request policy-regime routing, namespaced citations, cached-insight provenance and stale-cache suppression;
- bounded in-process throttling for anonymous applicant chat;
- no raw HTML rendering for AI Markdown;
- no card-data handling in the included payment patterns;
- generic synthetic sample data and a visible sample-data warning.

## Trust boundaries

| Boundary | Main threats | Required review |
|---|---|---|
| Browser to web ingress | Account takeover, injection, abuse, session theft | Identity, WAF/rate limits, secure headers, session policy, testing |
| Entra tenants to web callback | Token substitution, wrong tenant, role escalation, stale access | OIDC validation, exact callbacks, app roles, assignment required, MFA, revocation tests |
| Web to PostgreSQL | Credential theft, injection, excessive privilege | Private network, TLS verification, role design, rotation, audit |
| Web/worker to Redis | Queue manipulation, credential theft, denial of service | Private Link/Entra evaluation, TLS, key rotation, queue validation |
| Web/worker to Blob | Unauthorised evidence access, malicious files | RBAC, SAS scope/expiry, quarantine, malware scanning, retention |
| Web to Azure OpenAI | Sensitive prompt leakage, unsafe output, prompt injection | Data minimisation, safety filters, evaluation, logging controls, oversight |
| Administrator configuration | Privilege abuse, unsafe rules, unreviewed fees/workflows | Workforce identity, MFA, four-eyes approval, change audit, rollback |
| CI/CD to Azure | Supply-chain compromise, overprivileged deployment | OIDC, protected environments, dependency/code scanning, provenance |

## Known sample limitations

- The default `demo` mode enables credentials and applicant registration for evaluation; use `entra` mode for production-intent environments.
- External ID and workforce integrations require customer-owned tenant policy, branding, MFA, Conditional Access, lifecycle, access review, and support configuration.
- OIDC app registrations currently use client secrets. Short-lived credentials, overlap rotation, and monitoring are required; evaluate certificate/private-key client authentication for the target standard.
- The setup command passes new app secrets to `azd env set` as short-lived local process arguments because `azd` has no standard-input form for this operation. Run it on a protected administrator workstation; endpoint/process monitoring must treat command arguments as sensitive.
- JWT sessions can remain valid for up to eight hours after a directory role or assignment changes.
- An audited administrator workflow for legitimate identity-linking conflicts is not included; conflicts fail closed.
- Demo users share one generated password when seeding is enabled.
- API-wide distributed rate limiting is not implemented; `.env` values are placeholders. Anonymous applicant chat has a bounded per-replica limiter, which does not replace edge/API-gateway controls across multiple replicas.
- No WAF, bot protection, DDoS Network Protection plan, API gateway, or Front Door is provisioned.
- MIME validation does not inspect file signatures or content.
- Malware scanning is simulated and always returns safe.
- Email/SMS sending is not implemented.
- PostgreSQL uses a local administrator/password rather than Microsoft Entra-only authentication.
- Redis uses an access key rather than Microsoft Entra authentication.
- ACR, Storage, Key Vault, Redis, monitoring, and optional OpenAI public service endpoints remain enabled in the development profile.
- Storage and OpenAI use managed identity, but service-level network isolation is not included.
- Uploaded/generated document bytes can be stored in PostgreSQL as well as Blob Storage; retention must cover both.
- Uploaded policy source files are retained in PostgreSQL for audit and review; restrict policy management to managers/administrators and include these files in quarantine, malware-scanning, retention and backup decisions. Inline viewing is sandboxed but must remain disabled until an approved scan succeeds in a production design.
- AI analysis can run in the web process and is not guaranteed across restart or scale events.
- No central content moderation, prompt-injection detector, or automated AI evaluation pipeline is included.
- No bank-holiday calendar is applied to SLA calculations.
- No penetration test, threat-model sign-off, DPIA, accessibility audit, or legal review is included.

## Secrets and rotation

The `azd` preprovision hook creates secrets only when missing. Values are stored in local `azd` environment metadata and then in Key Vault. Protect the local environment directory as secret material.

Plan rotation for:

- PostgreSQL administrator credentials;
- Redis access keys;
- NextAuth signing secret;
- demo password where demo users exist;
- External ID and workforce app-registration client secrets;
- deployment identities and federated credentials;
- any added payment, email, or third-party integration secrets.

Changing `NEXTAUTH_SECRET` invalidates active sessions. Database, Redis, and OIDC client rotations require coordinated Key Vault updates and Container App revision/restart testing. Keep an overlap window for app credentials so a failed revision can roll back.

## Logging and privacy

Do not log:

- uploaded file content;
- passwords, tokens, cookies, connection strings, or SAS URLs;
- complete application answers or policy prompts;
- identity, medical, criminal-record, or payment evidence.

The Azure Monitor SDK can capture request/dependency metadata. Define sampling, retention, IP handling, data residency, access, exports, and deletion before production. Review custom logs whenever adding integration diagnostics.

## Software supply chain

The repository includes lockfile installation, npm audit, Dependabot, CodeQL, secret scanning guidance, Bicep compilation, and container builds. Production pipelines should also consider:

- signed commits/tags and protected branches;
- build provenance and SBOM generation;
- image vulnerability scanning and admission policy;
- pinned GitHub Action commit SHAs according to organisational policy;
- approved base-image registries and update cadence;
- deployment separation of duties;
- artifact retention and rollback evidence.

## Production checklist

### Identity and authorisation

- [ ] Configure and approve the included External ID applicant and workforce Entra integrations; use `AUTHENTICATION_MODE=entra`.
- [ ] Enforce MFA and conditional access for staff and administrators.
- [ ] Assign workforce app roles through approved users/groups and test privilege changes, removal, revocation, and session latency.
- [ ] Define identity proofing and an audited support workflow for legitimate account-linking conflicts.
- [ ] Disable demo mode, demo seeding, and sample accounts.
- [ ] Review every page, action, and API route for object- and role-level authorisation.

### Data protection and privacy

- [ ] Complete data classification, privacy notice, lawful basis, DPIA, and retention schedule.
- [ ] Minimise collected fields and document requirements.
- [ ] Implement subject access, correction, deletion/restriction, and legal-hold workflows.
- [ ] Configure storage/database backup, encryption, access review, and tested restore.
- [ ] Define telemetry redaction, retention, residency, and access.

### Network and platform

- [ ] Decide public/private endpoint policy for ACR, Key Vault, Storage, Redis, OpenAI, and monitoring.
- [ ] Implement Private Link, private DNS, egress controls, and secure operator/build access where required.
- [ ] Add edge protection, WAF, rate limiting, and abuse detection.
- [ ] Select production SKUs, availability zones, redundancy, RTO, and RPO.
- [ ] Enable required Defender plans, diagnostic settings, alerts, and policy assignments.

### Application and integrations

- [ ] Implement real malware scanning with quarantine and fail-closed behavior.
- [ ] Integrate approved payments and notifications with idempotency and reconciliation.
- [ ] Add API input limits, rate limiting, secure headers, and abuse controls.
- [ ] Test file signatures, decompression/format risks, generated document safety, and download authorisation.
- [ ] Complete SAST, DAST, dependency, container, infrastructure, and penetration testing.

### AI

- [ ] Approve the intended uses, users, data, model, region, and human-oversight process.
- [ ] Replace synthetic policy with each applicable approved, versioned Licensing Act and taxi/private-hire source.
- [ ] Confirm the authority's taxi legal framework and local legislation; do not assume the standard 1847/1976 framework is exhaustive.
- [ ] Review internal indexing against each original source before activation and test regime routing, retrieval recall and representative citations after every policy change.
- [ ] Evaluate groundedness, citation accuracy, harmful content, prompt injection, multilingual quality, and failure behavior.
- [ ] Define monitoring, incident response, user feedback, model change control, and rollback.
- [ ] Ensure AI cannot make or silently alter a statutory decision.

### Service readiness

- [ ] Complete WCAG 2.2 AA audit and user research.
- [ ] Approve legal wording, forms, fees, SLAs, document templates, and policies.
- [ ] Establish support, on-call, incident, continuity, backup, restore, and change processes.
- [ ] Run load, soak, failover, restore, and migration rehearsal.
- [ ] Obtain security, privacy, accessibility, operational, and service-owner sign-off.

## Vulnerability reporting

Do not open public security issues. Follow [SECURITY.md](../SECURITY.md).
