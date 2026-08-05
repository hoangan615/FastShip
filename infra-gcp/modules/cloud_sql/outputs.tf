output "connection_name" {
  value = google_sql_database_instance.instance.connection_name
}

output "public_ip_address" {
  value = google_sql_database_instance.instance.public_ip_address
}

output "database_name" {
  value = google_sql_database.database.name
}

output "user_name" {
  value = google_sql_user.app_user.name
}
