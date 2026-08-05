// Small indirection module: a role-assignment `name` must be computable
// at the start of its own deployment, which a cross-module `.outputs.x`
// reference used inline in the parent template's `name:` property isn't
// (Bicep BCP120). Passing the same values in as *parameters* to this
// module sidesteps that, since parameters are resolved before this
// nested deployment starts.
//
// NOTE on scope: this assigns at the resource-group scope rather than
// scoped to the specific ACR/Key Vault resource, because the parent
// template only has each target's resourceId (a module output string),
// not a resource-typed reference it can pass as `scope:`. Since there is
// only one ACR and one Key Vault per resource group here, the practical
// blast radius is identical; tighten to resource-level scope via Bicep
// resource-typed module outputs if stricter least-privilege is required.
param principalId string
param roleDefinitionId string
param targetResourceId string

resource assignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(targetResourceId, principalId, roleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
