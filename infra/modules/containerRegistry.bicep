param namePrefix string
param location string

// ACR names must be globally unique, alphanumeric only.
var registryName = replace('${namePrefix}acr', '-', '')

resource registry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: registryName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false // pulls are done via managed identity + AcrPull role, not admin credentials
  }
}

output registryId string = registry.id
output loginServer string = registry.properties.loginServer
