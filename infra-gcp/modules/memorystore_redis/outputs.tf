output "host" {
  value = google_redis_instance.cache.host
}

output "port" {
  value = google_redis_instance.cache.port
}

output "vpc_connector_id" {
  value = google_vpc_access_connector.connector.id
}
