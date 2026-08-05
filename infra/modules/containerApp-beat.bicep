param namePrefix string
param location string
param environmentId string
param registryServer string
param image string
param keyVaultUri string

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-beat'
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
        { name: 'database-url', keyVaultUrl: '${keyVaultUri}secrets/database-url', identity: 'system' }
        { name: 'redis-url', keyVaultUrl: '${keyVaultUri}secrets/redis-url', identity: 'system' }
        { name: 'celery-broker-url', keyVaultUrl: '${keyVaultUri}secrets/celery-broker-url', identity: 'system' }
        { name: 'celery-result-backend-url', keyVaultUrl: '${keyVaultUri}secrets/celery-result-backend-url', identity: 'system' }
      ]
    }
    template: {
      containers: [
        {
          name: 'celery-beat'
          image: image
          command: [
            'celery'
            '-A'
            'app.workers.celery_app'
            'beat'
            '--loglevel=info'
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'REDIS_URL', secretRef: 'redis-url' }
            { name: 'CELERY_BROKER_URL', secretRef: 'celery-broker-url' }
            { name: 'CELERY_RESULT_BACKEND', secretRef: 'celery-result-backend-url' }
          ]
        }
      ]
      scale: {
        // Celery beat is a singleton scheduler — never scale this past 1
        // replica, or scheduled tasks (batch_update_scores, release_due_escrow)
        // will fire multiple times per tick.
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

output principalId string = app.identity.principalId
