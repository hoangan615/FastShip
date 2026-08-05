param namePrefix string
param location string
param environmentId string
param registryServer string
param image string
param keyVaultUri string

// Secrets are Key Vault *references* (resolved by the Container Apps
// control plane at runtime via the app's own managed identity) rather
// than values copied into the ARM deployment — the identity needs the
// "Key Vault Secrets User" role, granted in main.bicep. On the very
// first deploy that role assignment can still be propagating when this
// revision starts; if so, restart the revision once RBAC has caught up.
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-api'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: registryServer
          identity: 'system'
        }
      ]
      secrets: [
        { name: 'jwt-secret', keyVaultUrl: '${keyVaultUri}secrets/jwt-secret', identity: 'system' }
        { name: 'database-url', keyVaultUrl: '${keyVaultUri}secrets/database-url', identity: 'system' }
        { name: 'redis-url', keyVaultUrl: '${keyVaultUri}secrets/redis-url', identity: 'system' }
        { name: 'celery-broker-url', keyVaultUrl: '${keyVaultUri}secrets/celery-broker-url', identity: 'system' }
      ]
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto' // handles HTTP/1.1, HTTP/2, and WebSocket upgrade automatically
        stickySessions: {
          affinity: 'sticky' // required for Socket.IO's in-memory manager if this ever scales past 1 replica
        }
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'api'
          image: image
          command: [
            'uvicorn'
            'app.main:app'
            '--host'
            '0.0.0.0'
            '--port'
            '8000'
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'REDIS_URL', secretRef: 'redis-url' }
            { name: 'CELERY_BROKER_URL', secretRef: 'celery-broker-url' }
            { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'JWT_ALGORITHM', value: 'HS256' }
            { name: 'JWT_EXPIRE_MINUTES', value: '1440' }
            { name: 'ESCROW_BUFFER_HOURS', value: '48' }
            { name: 'MATCH_RADIUS_KM', value: '5.0' }
            { name: 'OFFER_TIMEOUT_SECONDS', value: '20' }
            { name: 'MERCHANT_RESPONSE_WINDOW_SECONDS', value: '300' }
            { name: 'MATCH_LOCK_TTL_SECONDS', value: '30' }
            { name: 'SHIPPER_OFFLINE_AFTER_SECONDS', value: '30' }
            { name: 'SLA_MINUTES', value: '60' }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1 // pinned: see the in-memory Socket.IO manager caveat in docs/deployment-azure.md
      }
    }
  }
}

output principalId string = app.identity.principalId
output fqdn string = app.properties.configuration.ingress.fqdn
