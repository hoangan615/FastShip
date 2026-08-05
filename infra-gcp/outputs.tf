output "api_url" {
  value = module.cloud_run_api.url
}

output "artifact_registry_repository_url" {
  value = module.artifact_registry.repository_url
}

output "cloud_sql_connection_name" {
  value = module.cloud_sql.connection_name
}

output "redis_host" {
  value = module.memorystore_redis.host
}

output "runtime_service_account_email" {
  value = google_service_account.runtime.email
}
