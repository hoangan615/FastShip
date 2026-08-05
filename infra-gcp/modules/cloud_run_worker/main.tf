resource "google_cloud_run_v2_service" "worker" {
  project  = var.project_id
  name     = "${var.environment_name}-worker"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = var.runtime_service_account_email

    scaling {
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
      args    = ["-A", "app.workers.celery_app", "worker", "--loglevel=info"]
      # deliberately no `ports` block — this is a pure background process,
      # not an HTTP server, and Cloud Run does not require a listening
      # port for services that don't declare one.

      resources {
        limits = {
          cpu    = "0.25"
          memory = "0.5Gi"
        }
        cpu_idle = false # must keep polling the broker between requests, since there are none
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
