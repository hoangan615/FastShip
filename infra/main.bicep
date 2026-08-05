// FastShip — Azure infrastructure orchestrator.
// Provisions a Container Apps Environment running the api/celery-worker/
// celery-beat services (mirroring backend/docker-compose.yml) backed by
// PostgreSQL Flexible Server and Azure Managed Redis, with images pulled
// from a dedicated Container Registry and secrets sourced from Key Vault.
//
// First-time deploy: leave `apiImage`/`workerImage`/`beatImage` at their
// placeholder defaults (ACR is empty on a brand-new environment). CI/CD
// (.github/workflows/deploy-backend.yml) updates them to the real image
// on every subsequent push.

targetScope = 'resourceGroup'

@description('Short name used as a prefix for every resource, e.g. "fastship-prod".')
@minLength(3)
@maxLength(20)
param environmentName string = 'fastship-prod'

@description('Azure region for all resources.')
param location string = 'southeastasia'

@description('PostgreSQL administrator login name.')
param postgresAdminLogin string = 'fastshipadmin'

@description('PostgreSQL administrator password.')
@secure()
param postgresAdminPassword string

@description('JWT signing secret for the API.')
@secure()
param jwtSecret string

@description('Full container image reference for the api app, e.g. myacr.azurecr.io/fastship-api:abc123. Left at the placeholder on first deploy since ACR starts empty.')
param apiImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Full container image reference for the celery-worker app.')
param workerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Full container image reference for the celery-beat app.')
param beatImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Full container image reference for the db-migrate job.')
param migrateImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

var namePrefix = environmentName
var postgresDbName = 'fastship'

module logAnalytics 'modules/logAnalytics.bicep' = {
  name: 'logAnalytics'
  params: {
    namePrefix: namePrefix
    location: location
  }
}

module containerRegistry 'modules/containerRegistry.bicep' = {
  name: 'containerRegistry'
  params: {
    namePrefix: namePrefix
    location: location
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    namePrefix: namePrefix
    location: location
    administratorLogin: postgresAdminLogin
    administratorPassword: postgresAdminPassword
    databaseName: postgresDbName
  }
}

module redis 'modules/redis.bicep' = {
  name: 'redis'
  params: {
    namePrefix: namePrefix
    location: location
  }
}

var databaseUrl = 'postgresql+asyncpg://${postgresAdminLogin}:${postgresAdminPassword}@${postgres.outputs.fqdn}:5432/${postgresDbName}'
var redisUrlBase = 'rediss://:${redis.outputs.primaryKey}@${redis.outputs.hostName}:${redis.outputs.sslPort}'

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyVault'
  params: {
    namePrefix: namePrefix
    location: location
    jwtSecret: jwtSecret
    databaseUrl: databaseUrl
    redisUrl: '${redisUrlBase}/0'
    celeryBrokerUrl: '${redisUrlBase}/1'
    celeryResultBackendUrl: '${redisUrlBase}/2'
  }
}

module containerAppsEnv 'modules/containerAppsEnv.bicep' = {
  name: 'containerAppsEnv'
  params: {
    namePrefix: namePrefix
    location: location
    logAnalyticsCustomerId: logAnalytics.outputs.customerId
    logAnalyticsSharedKey: logAnalytics.outputs.primarySharedKey
  }
}

module apiApp 'modules/containerApp-api.bicep' = {
  name: 'apiApp'
  params: {
    namePrefix: namePrefix
    location: location
    environmentId: containerAppsEnv.outputs.environmentId
    registryServer: containerRegistry.outputs.loginServer
    image: apiImage
    keyVaultUri: keyVault.outputs.vaultUri
  }
}

module workerApp 'modules/containerApp-worker.bicep' = {
  name: 'workerApp'
  params: {
    namePrefix: namePrefix
    location: location
    environmentId: containerAppsEnv.outputs.environmentId
    registryServer: containerRegistry.outputs.loginServer
    image: workerImage
    keyVaultUri: keyVault.outputs.vaultUri
  }
}

module beatApp 'modules/containerApp-beat.bicep' = {
  name: 'beatApp'
  params: {
    namePrefix: namePrefix
    location: location
    environmentId: containerAppsEnv.outputs.environmentId
    registryServer: containerRegistry.outputs.loginServer
    image: beatImage
    keyVaultUri: keyVault.outputs.vaultUri
  }
}

module migrateJob 'modules/containerAppJob-migrate.bicep' = {
  name: 'migrateJob'
  params: {
    namePrefix: namePrefix
    location: location
    environmentId: containerAppsEnv.outputs.environmentId
    registryServer: containerRegistry.outputs.loginServer
    image: migrateImage
    keyVaultUri: keyVault.outputs.vaultUri
  }
}

// --- RBAC: let every app/job pull images from ACR and read Key Vault secrets ---
// (indirected through modules/roleAssignment.bicep — see its header comment
// for why a plain `guid(module.outputs.x, ...)` resource name doesn't work here)

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User

module acrPullApi 'modules/roleAssignment.bicep' = {
  name: 'acrPullApi'
  params: {
    targetResourceId: containerRegistry.outputs.registryId
    principalId: apiApp.outputs.principalId
    roleDefinitionId: acrPullRoleId
  }
}

module acrPullWorker 'modules/roleAssignment.bicep' = {
  name: 'acrPullWorker'
  params: {
    targetResourceId: containerRegistry.outputs.registryId
    principalId: workerApp.outputs.principalId
    roleDefinitionId: acrPullRoleId
  }
}

module acrPullBeat 'modules/roleAssignment.bicep' = {
  name: 'acrPullBeat'
  params: {
    targetResourceId: containerRegistry.outputs.registryId
    principalId: beatApp.outputs.principalId
    roleDefinitionId: acrPullRoleId
  }
}

module acrPullMigrate 'modules/roleAssignment.bicep' = {
  name: 'acrPullMigrate'
  params: {
    targetResourceId: containerRegistry.outputs.registryId
    principalId: migrateJob.outputs.principalId
    roleDefinitionId: acrPullRoleId
  }
}

module kvSecretsApi 'modules/roleAssignment.bicep' = {
  name: 'kvSecretsApi'
  params: {
    targetResourceId: keyVault.outputs.vaultId
    principalId: apiApp.outputs.principalId
    roleDefinitionId: keyVaultSecretsUserRoleId
  }
}

module kvSecretsWorker 'modules/roleAssignment.bicep' = {
  name: 'kvSecretsWorker'
  params: {
    targetResourceId: keyVault.outputs.vaultId
    principalId: workerApp.outputs.principalId
    roleDefinitionId: keyVaultSecretsUserRoleId
  }
}

module kvSecretsBeat 'modules/roleAssignment.bicep' = {
  name: 'kvSecretsBeat'
  params: {
    targetResourceId: keyVault.outputs.vaultId
    principalId: beatApp.outputs.principalId
    roleDefinitionId: keyVaultSecretsUserRoleId
  }
}

module kvSecretsMigrate 'modules/roleAssignment.bicep' = {
  name: 'kvSecretsMigrate'
  params: {
    targetResourceId: keyVault.outputs.vaultId
    principalId: migrateJob.outputs.principalId
    roleDefinitionId: keyVaultSecretsUserRoleId
  }
}

output apiFqdn string = apiApp.outputs.fqdn
output acrLoginServer string = containerRegistry.outputs.loginServer
output postgresFqdn string = postgres.outputs.fqdn
output redisHostName string = redis.outputs.hostName
output keyVaultName string = keyVault.outputs.vaultName
