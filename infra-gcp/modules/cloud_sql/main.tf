resource "google_sql_database_instance" "instance" {
  project             = var.project_id
  name                = "${var.environment_name}-pg"
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = false # MVP posture — flip to true once this holds real data

  settings {
    tier              = "db-f1-micro" # shared-core, cost-optimized; upgrade to a dedicated-core tier (e.g. db-custom-1-3840) before real production load
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = false
    }

    ip_configuration {
      ipv4_enabled = true # MVP posture — Cloud Run's built-in Cloud SQL connector doesn't require this; kept on for easy manual/local debugging. Disable + use private IP for a hardened setup.
    }
  }
}

resource "google_sql_database" "database" {
  project  = var.project_id
  name     = "fastship"
  instance = google_sql_database_instance.instance.name
}

resource "google_sql_user" "app_user" {
  project  = var.project_id
  name     = "fastshipadmin"
  instance = google_sql_database_instance.instance.name
  password = var.admin_password
}
