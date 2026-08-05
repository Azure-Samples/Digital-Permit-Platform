# Cost

## Important

This repository does not provide a quote. Azure prices vary by region, currency, agreement, tax, reservation, service updates, data volume, and usage. Use the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) and the target subscription's commercial terms before approval.

## Cost components

| Service | Main cost driver | Development default |
|---|---|---|
| Azure Container Apps | Active/idle vCPU and memory, requests, replicas | Web min 1/max 3; worker 1 |
| Azure Container Registry | Registry tier, storage, builds, egress | Basic |
| PostgreSQL Flexible Server | Compute tier/hours, storage, backup, IOPS | B1ms, 32 GB, 14-day backup |
| Azure Managed Redis | SKU and deployment hours | Balanced B0 |
| Blob Storage | Capacity, operations, retrieval, redundancy, egress | Hot LRS, versioning, soft delete |
| Key Vault | Operations, certificates/keys if added | Standard |
| Log Analytics | Ingested GB and retention | 30-day workspace retention |
| Application Insights | Telemetry ingestion and retention | 100% initial sampling |
| Azure OpenAI | Input, cached input, and output tokens | Disabled; gpt-4.1-mini when enabled |
| Networking | Private endpoints, NAT/Firewall, bandwidth | VNet; no private endpoints in default profile |

Azure Managed Redis and PostgreSQL are continuously provisioned and can dominate a low-traffic demonstration environment. Container Apps scale does not eliminate those baseline costs.

## Estimate method

1. Select the target region and commercial agreement.
2. Estimate environments: development, test, staging, production, and disaster recovery.
3. Estimate annual applications and seasonal peak concurrency.
4. Estimate uploaded document count, average size, versions, and retention.
5. Estimate database growth, backup retention, and read/write profile.
6. Estimate queue throughput and required Redis capacity/recovery.
7. Estimate telemetry GB/day and retention.
8. For each AI experience, estimate calls, input tokens, output tokens, retries, and cache rate.
9. Add network/security services required by the production design.
10. Add support, engineering, testing, security, accessibility, training, and change-management costs outside Azure consumption.

## AI calculation

For a model priced per one million tokens:

$$
C_{AI} = \frac{T_{input}}{10^6}P_{input} + \frac{T_{cached}}{10^6}P_{cached} + \frac{T_{output}}{10^6}P_{output}
$$

Monthly AI cost is affected by:

- policy context length;
- licence/application document length;
- chat history;
- response length;
- number of analysis/chat calls per application;
- polling/retry implementation;
- model selection and deployment type;
- evaluation and monitoring traffic.

Measure token use with synthetic representative workloads rather than relying only on prompt character counts.

## Profiles to model

### Evaluation

- one environment;
- development SKUs;
- synthetic data;
- AI disabled or tightly capped;
- short log retention;
- no production HA/DR.

### Pilot

- separate non-production and production environments;
- limited services/modules/users;
- real identity and support controls;
- tested backup/restore;
- AI only for approved cohorts;
- realistic monitoring and security ingestion.

### Production

- multiple lifecycle environments;
- production PostgreSQL SKU and HA;
- storage redundancy and longer retention;
- private endpoints, firewall/NAT, Defender, WAF/APIM where required;
- operational alerts and support coverage;
- tested DR environment or recovery design;
- model evaluation, monitoring, and budget guardrails.

## Optimisation levers

### Container Apps

- right-size CPU/memory from measured working set;
- keep web minimum replicas only where cold-start requirements justify it;
- use queue-length scaling for idempotent workers;
- remove unused environments and revisions;
- avoid excessive log output.

### PostgreSQL

- tune queries and indexes before scaling compute;
- right-size connection pools and SKU;
- review backup retention and geo-redundancy against RPO;
- archive/anonymise data according to approved retention;
- consider reserved capacity for stable production usage.

### Redis

- validate that queue volume requires the selected tier;
- set job removal policies and avoid unbounded completed/failed job retention;
- design queue payloads without large documents;
- choose persistence/geo features only from recovery requirements.

### Storage

- apply lifecycle rules after retention/legal review;
- avoid duplicate document storage where not required;
- clean abandoned drafts and expired SAS access paths;
- choose LRS/ZRS/GZRS from durability requirements, not cost alone.

### Monitoring

- set sampling based on incident and audit needs;
- filter noisy dependency/console events;
- use appropriate retention and archive tiers;
- create budgets for unexpected ingestion growth.

### AI

- use the smallest model that passes quality/safety thresholds;
- retrieve only relevant policy sections for larger corpora;
- bound chat history and output length;
- cache approved stable answers where appropriate and safe;
- avoid duplicate analysis calls;
- enforce per-feature/user budgets and alerts;
- disable unused AI experiences.

## Budget controls

Create Azure budgets and alerts before pilot. Tag resources with environment, service, owner, cost centre, and data classification according to policy. Review actual cost by environment and service after representative tests and before expanding usage.

Do not optimise away required security, accessibility, backup, logging, or reliability controls solely to meet a demonstration estimate.
