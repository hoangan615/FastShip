resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  name     = "${var.environment_name}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account  = var.runtime_service_account_email
    session_affinity = true # required for Socket.IO's in-memory manager if this ever scales past 1 instance — same caveat as the Azure plan's sticky-sessions setting

    scaling {
      min_instance_count = 1
      max_instance_count = 1 # pinned: see the in-memory Socket.IO manager caveat in docs/deployment-gcp.md
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image   = var.image
      command = ["uvicorn"]
      args    = ["app.main:app", "--host", "0.0.0.0", "--port", "8000"]

      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = "0.5"
          memory = "1Gi"
        }
        cpu_idle = false # "CPU always allocated" — required to keep WebSocket connections and background scheduling calls (apply_async) alive between requests
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
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["jwt-secret"]
            version = "latest"
          }
        }
      }
      env {
        name  = "JWT_ALGORITHM"
        value = "HS256"
      }
      env {
        name  = "JWT_EXPIRE_MINUTES"
        value = "1440"
      }
      env {
        name  = "ESCROW_BUFFER_HOURS"
        value = "48"
      }
      env {
        name  = "MATCH_RADIUS_KM"
        value = "5.0"
      }
      env {
        name  = "OFFER_TIMEOUT_SECONDS"
        value = "20"
      }
      env {
        name  = "MERCHANT_RESPONSE_WINDOW_SECONDS"
        value = "300"
      }
      env {
        name  = "MATCH_LOCK_TTL_SECONDS"
        value = "30"
      }
      env {
        name  = "SHIPPER_OFFLINE_AFTER_SECONDS"
        value = "30"
      }
      env {
        name  = "SLA_MINUTES"
        value = "60"
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image] # image is updated out-of-band by the CI/CD workflow via `gcloud run deploy`, not by re-applying Terraform
  }
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers" # customer/merchant/shipper apps call this API directly; auth is handled at the app layer (JWT), not by Cloud Run IAM
}
