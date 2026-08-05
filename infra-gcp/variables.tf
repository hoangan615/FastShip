variable "project_id" {
  description = "GCP project ID to deploy into."
  type        = string
}

variable "region" {
  description = "GCP region for all resources."
  type        = string
  default     = "asia-southeast1"
}

variable "environment_name" {
  description = "Short name used as a prefix for resource names, e.g. \"fastship-prod\"."
  type        = string
  default     = "fastship-prod"
}

variable "postgres_admin_password" {
  description = "Cloud SQL PostgreSQL admin/app user password."
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret for the API."
  type        = string
  sensitive   = true
}

variable "api_image" {
  description = "Full image reference for the api service, e.g. asia-southeast1-docker.pkg.dev/PROJECT/fastship/api:sha. Left at a placeholder on first apply, since Artifact Registry starts empty."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "worker_image" {
  description = "Full image reference for the celery-worker service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "beat_image" {
  description = "Full image reference for the celery-beat service."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "migrate_image" {
  description = "Full image reference for the db-migrate job."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}
