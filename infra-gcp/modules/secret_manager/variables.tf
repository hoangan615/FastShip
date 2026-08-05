variable "project_id" {
  type = string
}

variable "environment_name" {
  type = string
}

variable "runtime_service_account_email" {
  type = string
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "redis_url" {
  type      = string
  sensitive = true
}

variable "celery_broker_url" {
  type      = string
  sensitive = true
}

variable "celery_result_backend_url" {
  type      = string
  sensitive = true
}
