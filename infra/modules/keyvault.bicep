param namePrefix string
param location string

@secure()
param jwtSecret string

@secure()
param databaseUrl string

@secure()
param redisUrl string

@secure()
param celeryBrokerUrl string

@secure()
param celeryResultBackendUrl string

// Key Vault names must be globally unique, <=24 chars, alphanumeric/hyphen.
var vaultName = take('${namePrefix}-kv', 24)

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true // access granted via role assignments in main.bicep, not legacy access policies
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

resource jwtSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'jwt-secret'
  properties: {
    value: jwtSecret
  }
}

resource databaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'database-url'
  properties: {
    value: databaseUrl
  }
}

resource redisUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'redis-url'
  properties: {
    value: redisUrl
  }
}

resource celeryBrokerUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'celery-broker-url'
  properties: {
    value: celeryBrokerUrl
  }
}

resource celeryResultBackendUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'celery-result-backend-url'
  properties: {
    value: celeryResultBackendUrl
  }
}

output vaultId string = vault.id
output vaultName string = vault.name
output vaultUri string = vault.properties.vaultUri
