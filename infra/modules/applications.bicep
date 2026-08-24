targetScope = 'resourceGroup'

@description('Azure region for the Container Apps resources.')
param location string

@description('Resource ID of the Container Apps managed environment.')
param environmentResourceId string

@description('Default domain of the Container Apps managed environment.')
param environmentDefaultDomain string

@description('Name of the web Container App.')
param webAppName string

@description('Name of the worker Container App.')
param workerAppName string

@description('Name of the migrations Container Apps Job.')
param migrationsJobName string

@description('Resource ID of the web user-assigned managed identity.')
param webIdentityResourceId string

@description('Resource ID of the worker user-assigned managed identity.')
param workerIdentityResourceId string

@description('Resource ID of the migrations user-assigned managed identity.')
param migrationsIdentityResourceId string

@description('Login server of the Azure Container Registry.')
param registryLoginServer string

@description('Versionless URI of the Key Vault, including the trailing slash.')
param keyVaultUri string

@description('Storage account name used by the application.')
param storageAccountName string

@description('Azure OpenAI endpoint, or an empty string when AI is disabled.')
param openAiEndpoint string

@description('Azure OpenAI deployment name exposed to the application.')
param openAiDeploymentName string

@description('Azure OpenAI data-plane API version.')
param openAiApiVersion string

@description('Authentication providers enabled for the web application.')
@allowed([
  'demo'
  'entra'
  'hybrid'
])
param authenticationMode string

@description('Directory tenant ID of the Microsoft Entra External ID tenant.')
param externalIdTenantId string

@description('Subdomain of the Microsoft Entra External ID tenant.')
param externalIdTenantSubdomain string

@description('Application client ID registered in the Microsoft Entra External ID tenant.')
param externalIdClientId string

@description('Directory tenant ID of the council workforce tenant.')
param workforceTenantId string

@description('Application client ID registered in the council workforce tenant.')
param workforceClientId string

@description('Public display name of the application.')
param applicationName string

@description('Public support email address.')
param supportEmail string

@description('Public support telephone number.')
param supportPhone string

@description('Whether demo mode is enabled, represented as a lowercase string.')
@allowed([
  'true'
  'false'
])
param demoMode string

@description('Whether the sample banner is shown, represented as a lowercase string.')
@allowed([
  'true'
  'false'
])
param showSampleBanner string

@description('Whether the migrations job also seeds synthetic demo data.')
@allowed([
  'true'
  'false'
])
param seedDemoData string

@description('Base tags applied to all application resources.')
param tags object

var webUrl = 'https://${webAppName}.${environmentDefaultDomain}'
var databaseSecretUri = '${keyVaultUri}secrets/database-url'
var redisSecretUri = '${keyVaultUri}secrets/redis-url'
var nextAuthSecretUri = '${keyVaultUri}secrets/nextauth-secret'
var externalIdClientSecretUri = '${keyVaultUri}secrets/entra-external-id-client-secret'
var workforceClientSecretUri = '${keyVaultUri}secrets/entra-workforce-client-secret'
var demoPasswordSecretUri = '${keyVaultUri}secrets/demo-password'
var applicationInsightsSecretUri = '${keyVaultUri}secrets/applicationinsights-connection-string'
var entraEnabled = authenticationMode == 'entra' || authenticationMode == 'hybrid'
var demoCredentialsEnabled = authenticationMode == 'demo' || authenticationMode == 'hybrid'
var placeholderWebImage = 'docker.io/traefik/whoami:v1.11.0'
var placeholderWorkerImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
var placeholderMigrationsImage = 'docker.io/library/node:22-alpine'

resource web 'Microsoft.App/containerApps@2025-01-01' = {
  name: webAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'web'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${webIdentityResourceId}': {}
    }
  }
  properties: {
    environmentId: environmentResourceId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: registryLoginServer
          identity: webIdentityResourceId
        }
      ]
      secrets: concat([
        {
          name: 'database-url'
          keyVaultUrl: databaseSecretUri
          identity: webIdentityResourceId
        }
        {
          name: 'redis-url'
          keyVaultUrl: redisSecretUri
          identity: webIdentityResourceId
        }
        {
          name: 'nextauth-secret'
          keyVaultUrl: nextAuthSecretUri
          identity: webIdentityResourceId
        }
        {
          name: 'applicationinsights-connection-string'
          keyVaultUrl: applicationInsightsSecretUri
          identity: webIdentityResourceId
        }
      ], entraEnabled ? [
        {
          name: 'entra-external-id-client-secret'
          keyVaultUrl: externalIdClientSecretUri
          identity: webIdentityResourceId
        }
        {
          name: 'entra-workforce-client-secret'
          keyVaultUrl: workforceClientSecretUri
          identity: webIdentityResourceId
        }
      ] : [])
    }
    template: {
      containers: [
        {
          name: 'web'
          image: placeholderWebImage
          env: concat([
            {
              name: 'WHOAMI_PORT_NUMBER'
              value: '3000'
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'REDIS_URL'
              secretRef: 'redis-url'
            }
            {
              name: 'NEXTAUTH_SECRET'
              secretRef: 'nextauth-secret'
            }
            {
              name: 'NEXTAUTH_URL'
              value: webUrl
            }
            {
              name: 'AZURE_STORAGE_ACCOUNT_NAME'
              value: storageAccountName
            }
            {
              name: 'AZURE_STORAGE_CONTAINER_DOCUMENTS'
              value: 'documents'
            }
            {
              name: 'AZURE_STORAGE_CONTAINER_EXPORTS'
              value: 'exports'
            }
            {
              name: 'AZURE_OPENAI_ENDPOINT'
              value: openAiEndpoint
            }
            {
              name: 'AZURE_OPENAI_DEPLOYMENT'
              value: openAiDeploymentName
            }
            {
              name: 'AZURE_OPENAI_API_VERSION'
              value: openAiApiVersion
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'applicationinsights-connection-string'
            }
            {
              name: 'NEXT_PUBLIC_APP_NAME'
              value: applicationName
            }
            {
              name: 'NEXT_PUBLIC_APP_URL'
              value: webUrl
            }
            {
              name: 'NEXT_PUBLIC_SUPPORT_EMAIL'
              value: supportEmail
            }
            {
              name: 'NEXT_PUBLIC_SUPPORT_PHONE'
              value: supportPhone
            }
            {
              name: 'NEXT_PUBLIC_DEMO_MODE'
              value: demoMode
            }
            {
              name: 'NEXT_PUBLIC_SHOW_SAMPLE_BANNER'
              value: showSampleBanner
            }
            {
              name: 'AUTH_ENABLE_DEMO_CREDENTIALS'
              value: demoCredentialsEnabled ? 'true' : 'false'
            }
          ], entraEnabled ? [
            {
              name: 'ENTRA_EXTERNAL_ID_TENANT_ID'
              value: externalIdTenantId
            }
            {
              name: 'ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN'
              value: externalIdTenantSubdomain
            }
            {
              name: 'ENTRA_EXTERNAL_ID_CLIENT_ID'
              value: externalIdClientId
            }
            {
              name: 'ENTRA_EXTERNAL_ID_CLIENT_SECRET'
              secretRef: 'entra-external-id-client-secret'
            }
            {
              name: 'ENTRA_WORKFORCE_TENANT_ID'
              value: workforceTenantId
            }
            {
              name: 'ENTRA_WORKFORCE_CLIENT_ID'
              value: workforceClientId
            }
            {
              name: 'ENTRA_WORKFORCE_CLIENT_SECRET'
              secretRef: 'entra-workforce-client-secret'
            }
          ] : [])
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 30
              successThreshold: 1
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 20
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
              successThreshold: 1
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health/ready'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 6
              successThreshold: 1
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

resource worker 'Microsoft.App/containerApps@2025-01-01' = {
  name: workerAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'worker'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${workerIdentityResourceId}': {}
    }
  }
  properties: {
    environmentId: environmentResourceId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: registryLoginServer
          identity: workerIdentityResourceId
        }
      ]
      secrets: [
        {
          name: 'database-url'
          keyVaultUrl: databaseSecretUri
          identity: workerIdentityResourceId
        }
        {
          name: 'redis-url'
          keyVaultUrl: redisSecretUri
          identity: workerIdentityResourceId
        }
        {
          name: 'applicationinsights-connection-string'
          keyVaultUrl: applicationInsightsSecretUri
          identity: workerIdentityResourceId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'worker'
          image: placeholderWorkerImage
          env: [
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'REDIS_URL'
              secretRef: 'redis-url'
            }
            {
              name: 'AZURE_STORAGE_ACCOUNT_NAME'
              value: storageAccountName
            }
            {
              name: 'AZURE_STORAGE_CONTAINER_DOCUMENTS'
              value: 'documents'
            }
            {
              name: 'AZURE_STORAGE_CONTAINER_EXPORTS'
              value: 'exports'
            }
            {
              name: 'AZURE_OPENAI_ENDPOINT'
              value: openAiEndpoint
            }
            {
              name: 'AZURE_OPENAI_DEPLOYMENT'
              value: openAiDeploymentName
            }
            {
              name: 'AZURE_OPENAI_API_VERSION'
              value: openAiApiVersion
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'applicationinsights-connection-string'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

resource migrations 'Microsoft.App/jobs@2025-01-01' = {
  name: migrationsJobName
  location: location
  tags: union(tags, {
    'azd-service-name': 'migrations'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${migrationsIdentityResourceId}': {}
    }
  }
  properties: {
    environmentId: environmentResourceId
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 1800
      replicaRetryLimit: 1
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: registryLoginServer
          identity: migrationsIdentityResourceId
        }
      ]
      secrets: [
        {
          name: 'database-url'
          keyVaultUrl: databaseSecretUri
          identity: migrationsIdentityResourceId
        }
        {
          name: 'demo-password'
          keyVaultUrl: demoPasswordSecretUri
          identity: migrationsIdentityResourceId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'migrations'
          image: placeholderMigrationsImage
          command: [
            '/bin/sh'
          ]
          args: [
            '-c'
            'npm run db:migrate:deploy && if [ "$SEED_DEMO_DATA" = "true" ]; then npm run db:seed:all; fi'
          ]
          env: [
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'DEMO_PASSWORD'
              secretRef: 'demo-password'
            }
            {
              name: 'SEED_DEMO_DATA'
              value: seedDemoData
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
    }
  }
}

output webFqdn string = '${web.name}.${environmentDefaultDomain}'
output webUri string = webUrl
output webAppName string = web.name
output workerAppName string = worker.name
output migrationsJobName string = migrations.name
