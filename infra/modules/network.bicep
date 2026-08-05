targetScope = 'resourceGroup'

@description('Azure region for the network resources.')
param location string

@description('Name of the virtual network.')
param virtualNetworkName string

@description('Tags applied to all network resources.')
param tags object

var postgresPrivateDnsZoneName = 'private.postgres.database.azure.com'

module virtualNetwork 'br/public:avm/res/network/virtual-network:0.10.0' = {
  name: 'virtual-network'
  params: {
    name: virtualNetworkName
    location: location
    addressPrefixes: [
      '10.40.0.0/16'
    ]
    ipamPoolNumberOfIpAddresses: null
    virtualNetworkBgpCommunity: null
    subnets: [
      {
        name: 'snet-container-apps'
        addressPrefix: '10.40.0.0/23'
        delegation: 'Microsoft.App/environments'
      }
      {
        name: 'snet-postgresql'
        addressPrefix: '10.40.2.0/24'
        delegation: 'Microsoft.DBforPostgreSQL/flexibleServers'
      }
    ]
    dnsServers: []
    ddosProtectionPlanResourceId: null
    peerings: []
    diagnosticSettings: []
    lock: null
    roleAssignments: []
    tags: tags
    enableTelemetry: false
    enableVmProtection: false
    ipAllocations: []
  }
}

module postgresPrivateDns 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  name: 'postgres-private-dns'
  params: {
    name: postgresPrivateDnsZoneName
    a: []
    aaaa: []
    cname: []
    mx: []
    ptr: []
    soa: []
    srv: []
    txt: []
    virtualNetworkLinks: [
      {
        name: 'link-${take(uniqueString(virtualNetwork.outputs.resourceId), 8)}'
        virtualNetworkResourceId: virtualNetwork.outputs.resourceId
        registrationEnabled: false
      }
    ]
    roleAssignments: []
    tags: tags
    lock: null
    enableTelemetry: false
  }
}

output virtualNetworkResourceId string = virtualNetwork.outputs.resourceId
output containerAppsSubnetResourceId string = virtualNetwork.outputs.subnetResourceIds[0]
output postgresSubnetResourceId string = virtualNetwork.outputs.subnetResourceIds[1]
output postgresPrivateDnsZoneResourceId string = postgresPrivateDns.outputs.resourceId