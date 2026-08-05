param namePrefix string
param location string

// Azure Managed Redis (Microsoft.Cache/redisEnterprise) — the recommended
// path for new deployments; the classic Microsoft.Cache/redis ("Azure
// Cache for Redis") is being retired April 30, 2028.
resource cluster 'Microsoft.Cache/redisEnterprise@2025-04-01' = {
  name: '${namePrefix}-redis'
  location: location
  sku: {
    name: 'Balanced_B0'
  }
  properties: {
    minimumTlsVersion: '1.2'
  }
}

// NoCluster keeps classic single-shard behavior, including support for
// multiple numbered logical databases (SELECT 0/1/2), matching how the
// app already splits app cache (db 0) from Celery broker (db 1) and
// result backend (db 2) locally.
resource database 'Microsoft.Cache/redisEnterprise/databases@2025-04-01' = {
  parent: cluster
  name: 'default'
  properties: {
    clusteringPolicy: 'NoCluster'
    evictionPolicy: 'NoEviction'
    port: 10000
  }
}

output hostName string = cluster.properties.hostName
output sslPort int = database.properties.port
#disable-next-line outputs-should-not-contain-secrets // consumed immediately by keyvault.bicep within the same deployment to build the REDIS_URL secret, not exposed externally
output primaryKey string = database.listKeys().primaryKey
