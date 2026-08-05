# Infrastructure

The infrastructure is deployed at subscription scope through `infra/main.bicep` and the Azure Developer CLI. Azure Verified Modules are pinned to explicit versions for repeatability.

## Module map

| File | Responsibility |
|---|---|
| `main.bicep` | Resource group, public parameters, deployment outputs |
| `modules/platform.bicep` | Service composition, names, Key Vault secrets, and shared settings |
| `modules/network.bicep` | Virtual network, delegated subnets, and PostgreSQL private DNS |
| `modules/identities.bicep` | Separate web, worker, and migration managed identities |
| `modules/rbac.bicep` | ACR pull, Blob data/delegation, Key Vault, and Azure OpenAI roles |
| `modules/applications.bicep` | Web and worker Container Apps plus the migration Container Apps Job |
| `main.parameters.json` | Maps `azd` environment values to Bicep parameters |

## Resources

- Azure Container Apps environment integrated with a VNet
- web Container App with external HTTPS ingress and health probes
- worker Container App without ingress
- manual migration Container Apps Job
- Azure Container Registry with admin credentials disabled
- Azure Database for PostgreSQL Flexible Server on a delegated private subnet
- Azure Managed Redis with TLS 1.2 or later
- Storage account with shared-key access disabled and private Blob containers
- optional Azure OpenAI account with local authentication disabled
- Azure Key Vault with RBAC, soft delete, and purge protection
- Log Analytics and workspace-based Application Insights
- user-assigned managed identities and least-privilege role assignments

## Defaults

Defaults are intentionally sized for development and demonstration:

| Resource | Default |
|---|---|
| PostgreSQL | `Standard_B1ms`, 32 GB, 14-day backup, no HA |
| Azure Managed Redis | `Balanced_B0`, high availability enabled |
| Storage | `Standard_LRS`, hot tier, blob versioning and 7-day soft delete |
| Web | 0.5 vCPU, 1 GiB, 1-3 replicas |
| Worker | 0.25 vCPU, 0.5 GiB, 1 replica |
| Logs | 30-day Log Analytics retention |
| AI | disabled; `gpt-4.1-mini` Global Standard when enabled |

These are not production sizing recommendations. Review availability zones, backup retention, storage redundancy, Redis networking, private endpoints, model quota, scaling, diagnostic retention, Defender plans, and multi-region recovery against the target requirements.

## Validate

```bash
az bicep restore --file infra/main.bicep
az bicep build --file infra/main.bicep
azd show --no-prompt
```

For subscription-aware validation without deploying resources:

```bash
az deployment sub validate \
  --location <deployment-region> \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json
```

The JSON parameters file contains `azd` substitutions and is normally consumed through `azd provision`; direct Azure CLI validation requires concrete parameter values.

## Secret flow

The preprovision hook generates stable database, session, and demo secrets once per `azd` environment. In `entra` or `hybrid` mode, it also validates caller-supplied External ID and workforce app credentials. Bicep writes secrets to Key Vault. Container Apps use versionless Key Vault references through their user-assigned identities. Secret values are never emitted as Bicep outputs.

Directory app registrations and the External ID user flow are tenant-level prerequisites and are not created by this resource-group deployment. See [Identity](../docs/identity.md).

Application Insights is also delivered through a Key Vault-backed Container App secret. ACR, Blob Storage, and optional Azure OpenAI calls use managed identity rather than account keys.

## Image flow

`azd` remotely builds three services in ACR:

- `web` from `Dockerfile`;
- `worker` from `Dockerfile.worker`;
- `migrations` from `Dockerfile.worker` with a different job command.

Provisioning creates placeholder revisions. `azd deploy` replaces them with immutable image references, then the postdeploy hook starts the migration job and waits for completion.

## Cleanup

Use `azd down --purge` to remove the environment resource group. Purge protection can retain the deleted Key Vault for its configured retention period, which is intentional.
