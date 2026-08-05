# FastShip — GCP infrastructure orchestrator (parallel alternative to
# infra/ (Azure)). Provisions Cloud Run services mirroring
# backend/docker-compose.yml (api/celery-worker/celery-beat), backed by
# Cloud SQL for PostgreSQL and Memorystore for Redis, images from
# Artifact Registry, secrets from Secret Manager.
#
# First-time apply: leave `api_image`/`worker_image`/`beat_image`/
# `migrate_image` at their placeholder defaults (Artifact Registry is
# empty on a brand-new project). CI/CD (.github/workflows/deploy-backend-gcp.yml)
# updates them via `gcloud run deploy` on every subsequent push — Terraform
# itself ignores image-field drift after the first apply (see each Cloud
# Run module's `lifecycle.ignore_changes`).

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  required_apis = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "vpcaccess.googleapis.com",
    "iam.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each           = toset(local.required_apis)
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "${var.environment_name}-runtime"
  display_name = "FastShip Cloud Run runtime identity (api/worker/beat/migrate)"
  depends_on   = [google_project_service.apis]
}

resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

module "artifact_registry" {
  source           = "./modules/artifact_registry"
  project_id       = var.project_id
  region           = var.region
  environment_name = var.environment_name
  depends_on       = [google_project_service.apis]
}

module "cloud_sql" {
  source           = "./modules/cloud_sql"
  project_id       = var.project_id
  region           = var.region
  environment_name = var.environment_name
  admin_password   = var.postgres_admin_password
  depends_on       = [google_project_service.apis]
}

module "memorystore_redis" {
  source           = "./modules/memorystore_redis"
  project_id       = var.project_id
  region           = var.region
  environment_name = var.environment_name
  depends_on       = [google_project_service.apis]
}

locals {
  # Cloud Run reaches Cloud SQL through the built-in connector over a Unix
  # socket at this fixed path, keyed by the instance connection name —
  # not a normal host:port TCP DSN.
  database_url = "postgresql+asyncpg://${module.cloud_sql.user_name}:${var.postgres_admin_password}@/${module.cloud_sql.database_name}?host=/cloudsql/${module.cloud_sql.connection_name}"
  redis_base   = "redis://${module.memorystore_redis.host}:${module.memorystore_redis.port}"
}

module "secret_manager" {
  source                        = "./modules/secret_manager"
  project_id                    = var.project_id
  environment_name              = var.environment_name
  runtime_service_account_email = google_service_account.runtime.email
  jwt_secret                    = var.jwt_secret
  database_url                  = local.database_url
  redis_url                     = "${local.redis_base}/0"
  celery_broker_url             = "${local.redis_base}/1"
  celery_result_backend_url     = "${local.redis_base}/2"
}

module "cloud_run_api" {
  source                        = "./modules/cloud_run_api"
  project_id                    = var.project_id
  region                        = var.region
  environment_name              = var.environment_name
  image                         = var.api_image
  runtime_service_account_email = google_service_account.runtime.email
  vpc_connector_id              = module.memorystore_redis.vpc_connector_id
  secret_ids                    = module.secret_manager.secret_ids
}

module "cloud_run_worker" {
  source                        = "./modules/cloud_run_worker"
  project_id                    = var.project_id
  region                        = var.region
  environment_name              = var.environment_name
  image                         = var.worker_image
  runtime_service_account_email = google_service_account.runtime.email
  vpc_connector_id              = module.memorystore_redis.vpc_connector_id
  secret_ids                    = module.secret_manager.secret_ids
}

module "cloud_run_beat" {
  source                        = "./modules/cloud_run_beat"
  project_id                    = var.project_id
  region                        = var.region
  environment_name              = var.environment_name
  image                         = var.beat_image
  runtime_service_account_email = google_service_account.runtime.email
  vpc_connector_id              = module.memorystore_redis.vpc_connector_id
  secret_ids                    = module.secret_manager.secret_ids
}

module "cloud_run_job_migrate" {
  source                        = "./modules/cloud_run_job_migrate"
  project_id                    = var.project_id
  region                        = var.region
  environment_name              = var.environment_name
  image                         = var.migrate_image
  runtime_service_account_email = google_service_account.runtime.email
  vpc_connector_id              = module.memorystore_redis.vpc_connector_id
  secret_ids                    = module.secret_manager.secret_ids
}
