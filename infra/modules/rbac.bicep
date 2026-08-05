targetScope = 'resourceGroup'

@description('Resource ID of the Azure Container Registry.')
param registryResourceId string

@description('Resource ID of the Storage account.')
param storageResourceId string

@description('Resource ID of the Key Vault.')
param keyVaultResourceId string

@description('Whether Microsoft Entra end-user authentication is enabled.')
param enableEntra bool

@description('Whether Azure OpenAI is provisioned.')
param enableAi bool

@description('Resource ID of the Azure OpenAI account when AI is enabled.')
param openAiResourceId string = ''

@description('Principal ID of the web application identity.')
param webPrincipalId string

@description('Principal ID of the worker identity.')
param workerPrincipalId string

@description('Principal ID of the migrations identity.')
param migrationsPrincipalId string

var acrPullRoleDefinitionId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var storageBlobDataContributorRoleDefinitionId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var storageBlobDelegatorRoleDefinitionId = 'db58b8e5-c6ad-4a2a-8342-4190687cbf4a'
var keyVaultSecretsUserRoleDefinitionId = '4633458b-17de-408a-b874-0445c86b69e6'
var cognitiveServicesOpenAiUserRoleDefinitionId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
var appPrincipalIds = [
  webPrincipalId
  workerPrincipalId
  migrationsPrincipalId
]

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: last(split(registryResourceId, '/'))
}

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: last(split(storageResourceId, '/'))
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: last(split(keyVaultResourceId, '/'))
}

resource databaseSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = {
  parent: keyVault
  name: 'database-url'
}

resource redisSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = {
  parent: keyVault
  name: 'redis-url'
}

resource nextAuthSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = {
  parent: keyVault
  name: 'nextauth-secret'
}

resource demoPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = {
  parent: keyVault
  name: 'demo-password'
}

resource applicationInsightsSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = {
  parent: keyVault
  name: 'applicationinsights-connection-string'
}

resource externalIdClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = if (enableEntra) {
  parent: keyVault
  name: 'entra-external-id-client-secret'
}

resource workforceClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = if (enableEntra) {
  parent: keyVault
  name: 'entra-workforce-client-secret'
}

resource openAi 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = if (enableAi) {
  name: last(split(openAiResourceId, '/'))
}

resource acrPullAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for principalId in appPrincipalIds: {
  scope: registry
  name: guid(registry.id, principalId, acrPullRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleDefinitionId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}]

resource webDatabaseSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: databaseSecret
  name: guid(databaseSecret.id, webPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource webRedisSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: redisSecret
  name: guid(redisSecret.id, webPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource webNextAuthSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: nextAuthSecret
  name: guid(nextAuthSecret.id, webPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource webApplicationInsightsSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: applicationInsightsSecret
  name: guid(applicationInsightsSecret.id, webPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource webExternalIdClientSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableEntra) {
  scope: externalIdClientSecret
  name: guid(externalIdClientSecret.id, webPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource webWorkforceClientSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableEntra) {
  scope: workforceClientSecret
  name: guid(workforceClientSecret.id, webPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource workerDatabaseSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: databaseSecret
  name: guid(databaseSecret.id, workerPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: workerPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource workerRedisSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: redisSecret
  name: guid(redisSecret.id, workerPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: workerPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource workerApplicationInsightsSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: applicationInsightsSecret
  name: guid(applicationInsightsSecret.id, workerPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: workerPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource migrationsDatabaseSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: databaseSecret
  name: guid(databaseSecret.id, migrationsPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: migrationsPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource migrationsDemoPasswordSecretReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: demoPasswordSecret
  name: guid(demoPasswordSecret.id, migrationsPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleDefinitionId)
    principalId: migrationsPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource webStorageContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, webPrincipalId, storageBlobDataContributorRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleDefinitionId)
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource webStorageDelegator 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, webPrincipalId, storageBlobDelegatorRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDelegatorRoleDefinitionId)
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource workerStorageContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, workerPrincipalId, storageBlobDataContributorRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleDefinitionId)
    principalId: workerPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource webOpenAiUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableAi) {
  scope: openAi
  name: guid(openAi.id, webPrincipalId, cognitiveServicesOpenAiUserRoleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesOpenAiUserRoleDefinitionId)
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}