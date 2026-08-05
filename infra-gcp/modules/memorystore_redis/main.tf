# Memorystore instances are always VPC-internal (no public IP option),
# unlike Cloud SQL which Cloud Run can reach via its built-in connector
# without any VPC setup. So this module also owns the minimal VPC +
# Serverless VPC Access connector needed for the Cloud Run services to
# reach Redis — the other real piece of "networking" this GCP deployment
# needs, versus none for Azure's Container Apps (public-endpoint) posture.

resource "google_compute_network" "vpc" {
  project                 = var.project_id
  name                    = "${var.environment_name}-vpc"
  auto_create_subnetworks = true
}

resource "google_vpc_access_connector" "connector" {
  project       = var.project_id
  name          = "${var.environment_name}-conn"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"
  min_instances = 2
  max_instances = 3
}

resource "google_redis_instance" "cache" {
  project            = var.project_id
  name               = "${var.environment_name}-redis"
  region             = var.region
  tier               = "BASIC" # no HA/failover — matches the MVP posture of Azure Managed Redis Balanced B0 in the parallel Azure plan
  memory_size_gb     = 1
  redis_version      = "REDIS_7_2"
  authorized_network = google_compute_network.vpc.id
}
