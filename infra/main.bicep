targetScope = 'subscription'

@description('Short environment name used as the suffix for all resource names.')
@minLength(1)
@maxLength(24)
param environmentName string

@description('Primary Azure region for the deployment.')
param location string

@description('Whether to provision Azure OpenAI and the gpt-4.1-mini deployment.')
param enableAi bool = false

@description('Azure region for Azure OpenAI. This can differ from the primary region for model availability and quota.')
param aiLocation string = location

@description('Capacity of the Global Standard gpt-4.1-mini deployment.')
@minValue(1)
param aiModelCapacity int = 10

@secure()
@description('Stable PostgreSQL administrator password generated once by the azd preprovision hook.')
param databasePassword string

@secure()
@description('Stable NextAuth signing secret generated once by the azd preprovision hook.')
param nextAuthSecret string

@description('Authentication providers enabled for the web application.')
@allowed([
  'demo'
  'entra'
  'hybrid'
])
param authenticationMode string = 'demo'

@description('Directory tenant ID of the Microsoft Entra External ID tenant.')
param externalIdTenantId string = '00000000-0000-4000-8000-000000000000'

@description('Subdomain of the Microsoft Entra External ID tenant, without ciamlogin.com.')
param externalIdTenantSubdomain string = 'disabled'

@description('Application client ID registered in the Microsoft Entra External ID tenant.')
param externalIdClientId string = '00000000-0000-4000-8000-000000000000'

@secure()
@description('Application client secret registered in the Microsoft Entra External ID tenant.')
param externalIdClientSecret string = ''

@description('Directory tenant ID of the council workforce tenant.')
param workforceTenantId string = '00000000-0000-4000-8000-000000000000'

@description('Application client ID registered in the council workforce tenant.')
param workforceClientId string = '00000000-0000-4000-8000-000000000000'

@secure()
@description('Application client secret registered in the council workforce tenant.')
param workforceClientSecret string = ''

@secure()
@description('Stable password for synthetic demo accounts generated once by the azd preprovision hook.')
param demoPassword string

@description('Whether the post-deployment migrations job also seeds synthetic demo data.')
param seedDemoData bool = true

@description('Public display name of the application.')
param applicationName string = 'Digital Permit Platform'

@description('Public support email address.')
param supportEmail string = 'support@example.gov.uk'

@description('Public support telephone number.')
param supportPhone string = '0300 000 0000'

@description('Whether demo mode is enabled.')
param demoMode bool = true

@description('Whether to display the sample-data banner.')
param showSampleBanner bool = true

@description('Optional tags to apply to all resources.')
param tags object = {}

var resourceGroupName = 'rg-dpp-${environmentName}'

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: union(tags, {
    'azd-env-name': environmentName
  })
}

module platform './modules/platform.bicep' = {
  name: 'platform'
  scope: resourceGroup
  params: {
    environmentName: environmentName
    location: location
    enableAi: enableAi
    aiLocation: aiLocation
    aiModelCapacity: aiModelCapacity
    databasePassword: databasePassword
    nextAuthSecret: nextAuthSecret
    authenticationMode: authenticationMode
    externalIdTenantId: externalIdTenantId
    externalIdTenantSubdomain: externalIdTenantSubdomain
    externalIdClientId: externalIdClientId
    externalIdClientSecret: externalIdClientSecret
    workforceTenantId: workforceTenantId
    workforceClientId: workforceClientId
    workforceClientSecret: workforceClientSecret
    demoPassword: demoPassword
    seedDemoData: seedDemoData
    applicationName: applicationName
    supportEmail: supportEmail
    supportPhone: supportPhone
    demoMode: demoMode
    showSampleBanner: showSampleBanner
    tags: tags
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = platform.outputs.registryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = platform.outputs.registryName
output SERVICE_WEB_URI string = platform.outputs.webUri
output WEB_APP_NAME string = platform.outputs.webAppName
output WORKER_APP_NAME string = platform.outputs.workerAppName
output MIGRATIONS_JOB_NAME string = platform.outputs.migrationsJobName
output AZURE_STORAGE_ACCOUNT_NAME string = platform.outputs.storageAccountName
output AZURE_KEY_VAULT_NAME string = platform.outputs.keyVaultName
output AZURE_OPENAI_ENDPOINT string = platform.outputs.openAiEndpoint
