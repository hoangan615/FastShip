resource "google_cloud_run_v2_service" "beat" {
  project  = var.project_id
  name     = "${var.environment_name}-beat"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = var.runtime_service_account_email

    scaling {
      # Celery beat is a singleton scheduler — never scale this past 1
      # instance, or scheduled tasks (batch_update_scores, release_due_escrow)
      # will fire multiple times per tick.
      min_instance_count = 1
      max_instance_count = 1
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image   = var.image
      command = ["celery"]
      args    = ["-A", "app.workers.celery_app", "beat", "--loglevel=info"]

      resources {
        limits = {
          cpu    = "0.25"
          memory = "0.5Gi"
        }
        cpu_idle = false
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
      env {
        name = "REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["redis-url"]
            version = "latest"
          }
        }
      }
      env {
        name = "CELERY_BROKER_URL"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["celery-broker-url"]
            version = "latest"
          }
        }
      }
      env {
        name = "CELERY_RESULT_BACKEND"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["celery-result-backend-url"]
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}
