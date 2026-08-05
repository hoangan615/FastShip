param namePrefix string
param location string
param environmentId string
param registryServer string
param image string
param keyVaultUri string

// Manually/pipeline-triggered — deliberately NOT baked into the api
// container's startup command, so N replicas never race to migrate the
// same database concurrently.
resource job 'Microsoft.App/jobs@2024-03-01' = {
  name: '${namePrefix}-db-migrate'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: environmentId
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 600
      replicaRetryLimit: 0
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: registryServer
          identity: 'system'
        }
      ]
      secrets: [
        { name: 'database-url', keyVaultUrl: '${keyVaultUri}secrets/database-url', identity: 'system' }
      ]
    }
    template: {
      containers: [
        {
          name: 'db-migrate'
          image: image
          command: [
            'alembic'
            'upgrade'
            'head'
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
          ]
        }
      ]
    }
  }
}

output principalId string = job.identity.principalId
output jobName string = job.name
