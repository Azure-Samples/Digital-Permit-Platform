# Operations

## Service inventory

| Component | Operational role |
|---|---|
| Web Container App | User interface, API routes, authentication, uploads, AI requests |
| Worker Container App | Notifications, SLA timers, document-scan placeholder, reminders |
| Migration Container Apps Job | Prisma migrations and optional synthetic seeding |
| PostgreSQL | Authoritative application, configuration, audit, and AI data |
| Azure Managed Redis | Queue and delayed-job state |
| Blob Storage | Uploaded documents and exports |
| Key Vault | Runtime secret values |
| Application Insights | Request/dependency traces and application telemetry |
| Log Analytics | Container console and platform logs |

## Health endpoints

| Endpoint | Meaning | Probe |
|---|---|---|
| `/api/health` | Node/Next process can respond | startup and liveness |
| `/api/health/ready` | Process can query PostgreSQL | readiness |

The liveness endpoint deliberately does not query dependencies; a database outage should remove a replica from traffic without creating a restart loop. The readiness endpoint returns 503 when PostgreSQL is unavailable.

The worker has no HTTP ingress. Monitor it through replica count, restart metrics, Redis queue behavior, and logs.

## Logs and traces

Container Apps sends platform and console logs to Log Analytics. Application Insights is initialised in both web and worker when its connection string is present.

### Recent application errors

```kusto
exceptions
| where timestamp > ago(24h)
| project timestamp, operation_Name, problemId, outerMessage, cloud_RoleName
| order by timestamp desc
```

### Slow web requests

```kusto
requests
| where timestamp > ago(24h)
| summarize requests=count(), p95=percentile(duration, 95), failures=countif(success == false)
    by operation_Name
| order by p95 desc
```

### Failed dependencies

```kusto
dependencies
| where timestamp > ago(24h) and success == false
| summarize failures=count() by target, type, resultCode
| order by failures desc
```

### Container restarts and platform events

```kusto
ContainerAppSystemLogs_CL
| where TimeGenerated > ago(24h)
| where Reason_s in ("Restarting", "BackOff", "Failed", "Unhealthy")
| project TimeGenerated, ContainerAppName_s, RevisionName_s, Reason_s, Log_s
| order by TimeGenerated desc
```

### Worker console failures

```kusto
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(24h)
| where ContainerAppName_s endswith "-worker"
| where Log_s has_any ("error", "failed", "exception")
| project TimeGenerated, ContainerAppName_s, RevisionName_s, Log_s
| order by TimeGenerated desc
```

Table/column names differ when the Container Apps environment uses the Azure Monitor destination instead of the Log Analytics destination included here.

## Recommended alerts

Start with alerts for:

- web readiness failures or sustained 5xx rate;
- p95 request latency above the service target;
- Container App replica restart spikes;
- zero ready web or worker replicas;
- PostgreSQL CPU, storage, connections, and failed connections;
- Redis memory, server load, connections, evictions, and errors;
- queue failed/delayed job accumulation;
- Blob authorization or availability failures;
- Key Vault denied requests;
- migration job failure;
- Azure OpenAI throttling, errors, latency, and token spend;
- Application Insights ingestion gaps;
- approaching budget thresholds.

Route alerts to an owned action group. Document severity, acknowledgement, escalation, and recovery action for each alert.

## Deployment and rollback

`azd deploy` creates new Container App revisions for changed images. The included apps use single-revision mode.

Before deployment:

1. run CI gates;
2. review Bicep and dependency changes;
3. back up or confirm restore points before destructive migrations;
4. communicate expected service impact;
5. confirm migration compatibility with both old and new revisions.

Prefer expand-and-contract database migrations:

1. add backwards-compatible schema;
2. deploy code that supports old/new data;
3. migrate/backfill;
4. remove old fields in a later release.

Application rollback can target a previous image/revision, but a destructive database migration may not be reversible. Every migration needs an explicit recovery plan.

## Backup and restore

### PostgreSQL

The development template enables 14-day automated backup retention. Production should select retention, geo-redundancy, HA, and restore objectives from RTO/RPO.

Test:

- point-in-time restore into a separate server;
- application connection and schema validation;
- secrets and DNS update procedure;
- data consistency and audit continuity;
- measured restore time.

### Blob Storage

The template enables versioning and 7-day blob/container soft delete with LRS. Production may require ZRS/GZRS, longer retention, lifecycle rules, immutable storage, or a separate backup strategy.

### Redis

Redis is queue state, not the authoritative case store, but losing delayed/retry jobs can affect service delivery. Select persistence/export or active geo-replication based on queue recovery requirements. Design idempotent producers/consumers so work can be replayed.

### Configuration and secrets

Bicep and source control recover infrastructure/configuration definitions. Key Vault secret values and external integration state require a separately approved recovery process. Do not rely on source control for secrets.

## Policy version operations

Policy uploads create inactive versions. Managers and administrators review the retained original and activate one version independently for each supported regime (`licensing_act_2003` and `taxi_private_hire`); activation and serializable draft deletion are audited. The previous version remains inactive and can be reactivated without redeployment. Retain the uploaded source document so policy owners can compare retrieval and citations with the approved original.

Before Licensing Act activation, test cumulative-impact wording, hours, conditions and applicant guidance. Before taxi-policy activation, test fit-and-proper criteria, safeguarding, NR3S, driver/operator requirements, vehicle standards, accessibility, conditions, enforcement and any local legislation. After either activation, run representative Policy Copilot and application-insight checks for that regime and retain the evidence with the policy change record. Cached insights whose policy ID/regime/version no longer match are hidden until regenerated.

When taxi modules are enabled without an active taxi policy, or an active taxi policy exists while all taxi modules are disabled, the Modules and Licensing policies screens show a readiness mismatch. Resolve it deliberately; policy activation does not enable modules and module changes do not activate policy. DfT recommends a cohesive taxi/private-hire policy, but it is not the statutory section 5 Licensing Act statement.

## Scaling

### Web

The default scales from one to three replicas on HTTP concurrency. Tune with load tests that include authentication, database queries, uploads, and AI polling. PostgreSQL connection limits can become the bottleneck before CPU.

### Worker

The default has one replica and in-process concurrency per queue. Before scaling out:

- confirm each job is idempotent;
- ensure external integrations support duplicate/retry requests;
- set queue concurrency and backoff intentionally;
- monitor Redis and database load;
- add a queue-length KEDA rule if workload requires elastic workers.

### Database

Monitor query latency, connections, CPU, storage, and IOPS. Optimise indexes/query shapes before simply increasing SKU. Prisma clients exist per process/replica, so account for aggregate connection pools.

## Secret rotation

Document and rehearse rotation for database, Redis, and session secrets. A generic sequence is:

1. create/obtain the new credential;
2. update the Key Vault secret;
3. force or wait for a Container App revision/restart to refresh the versionless reference;
4. validate health and dependent operations;
5. revoke the old credential;
6. retain an audit record.

Redis supports primary/secondary keys; use a staged key rotation. Changing `NEXTAUTH_SECRET` signs out active users.

## Incident response

Runbooks should cover:

- suspected account or staff-role compromise;
- exposed connection string, SAS, or deployment secret;
- malicious document upload;
- data exfiltration or unauthorised case access;
- incorrect mass module configuration or fee change;
- failed/destructive migration;
- queue backlog and duplicate notifications;
- Azure OpenAI unsafe output, prompt injection, or data-handling incident;
- regional Azure service outage.

Preserve relevant audit and platform logs, restrict access, rotate credentials, and follow organisational privacy/security notification obligations.

## Routine tasks

| Frequency | Task |
|---|---|
| Daily | Review availability, failures, queue backlog, security alerts, migration jobs |
| Weekly | Review latency, capacity, failed jobs, AI errors/feedback, backup status |
| Monthly | Restore sample, dependency/container updates, access review, cost review |
| Quarterly | Incident/restore rehearsal, role review, policy/model evaluation, capacity forecast |
| On change | Regression, accessibility, security, migration, cost, and documentation review |
