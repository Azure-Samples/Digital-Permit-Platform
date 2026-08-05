targetScope = 'resourceGroup'

@description('Azure region for the managed identities.')
param location string

@description('Name of the web application identity.')
param webIdentityName string

@description('Name of the worker identity.')
param workerIdentityName string

@description('Name of the migrations job identity.')
param migrationsIdentityName string

@description('Tags applied to all managed identities.')
param tags object

module webIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.6.0' = {
  name: 'web-identity'
  params: {
    name: webIdentityName
    location: location
    federatedIdentityCredentials: []
    lock: null
    roleAssignments: []
    tags: tags
    enableTelemetry: false
    isolationScope: null
  }
}

module workerIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.6.0' = {
  name: 'worker-identity'
  params: {
    name: workerIdentityName
    location: location
    federatedIdentityCredentials: []
    lock: null
    roleAssignments: []
    tags: tags
    enableTelemetry: false
    isolationScope: null
  }
}

module migrationsIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.6.0' = {
  name: 'migrations-identity'
  params: {
    name: migrationsIdentityName
    location: location
    federatedIdentityCredentials: []
    lock: null
    roleAssignments: []
    tags: tags
    enableTelemetry: false
    isolationScope: null
  }
}

output webResourceId string = webIdentity.outputs.resourceId
output webPrincipalId string = webIdentity.outputs.principalId
output workerResourceId string = workerIdentity.outputs.resourceId
output workerPrincipalId string = workerIdentity.outputs.principalId
output migrationsResourceId string = migrationsIdentity.outputs.resourceId
output migrationsPrincipalId string = migrationsIdentity.outputs.principalId