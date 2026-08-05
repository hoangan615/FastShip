# Manually/pipeline-triggered — deliberately NOT baked into the api
# service's startup command, so N instances never race to migrate the
# same database concurrently.
resource "google_cloud_run_v2_job" "migrate" {
  project  = var.project_id
  name     = "${var.environment_name}-db-migrate"
  location = var.region

  template {
    template {
      service_account = var.runtime_service_account_email
      max_retries     = 0
      timeout         = "600s"

      vpc_access {
        connector = var.vpc_connector_id
        egress    = "PRIVATE_RANGES_ONLY"
      }

      containers {
        image   = var.image
        command = ["alembic"]
        args    = ["upgrade", "head"]

        resources {
          limits = {
            cpu    = "0.5"
            memory = "1Gi"
          }
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = var.secret_ids["database-url"]
              version = "latest"
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image]
  }
}
