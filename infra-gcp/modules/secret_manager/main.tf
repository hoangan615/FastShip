locals {
  secrets = {
    jwt-secret                = var.jwt_secret
    database-url              = var.database_url
    redis-url                 = var.redis_url
    celery-broker-url         = var.celery_broker_url
    celery-result-backend-url = var.celery_result_backend_url
  }
}

resource "google_secret_manager_secret" "secret" {
  for_each  = local.secrets
  project   = var.project_id
  secret_id = "${var.environment_name}-${each.key}"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "version" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.secret[each.key].id
  secret_data = each.value
}

resource "google_secret_manager_secret_iam_member" "accessor" {
  for_each  = local.secrets
  project   = var.project_id
  secret_id = google_secret_manager_secret.secret[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.runtime_service_account_email}"
}
