# Deploying FastShip to Google Cloud (parallel alternative)

A second option alongside [`deployment-azure.md`](./deployment-azure.md), sized the same way (MVP/staging), for comparison before picking one.

## Architecture

```
                         ┌─────────────────────────────┐
                         │   GitHub Actions (CI/CD)     │
                         │ build → push Artifact Reg.   │
                         │ → migrate job → deploy       │
                         │ (Workload Identity Federation,│
                         │  no service-account keys)     │
                         └───────────────┬──────────────┘
                                          │
                    ┌─────────────────────▼─────────────────────┐
                    │           Cloud Run (asia-southeast1)        │
                    │                                               │
                    │  ┌───────────┐  ┌──────────────┐  ┌────────┐ │
                    │  │  api      │  │ celery-worker │  │ celery-│ │
                    │  │(FastAPI+  │  │ (CPU always   │  │  beat  │ │
                    │  │Socket.IO, │  │  allocated,   │  │(CPU alw│ │
                    │  │CPU always │  │  1 instance   │  │alloc,  │ │
                    │  │allocated, │  │  fixed)       │  │1 inst  │ │
                    │  │1 instance,│  │               │  │fixed,  │ │
                    │  │session    │  └──────┬────────┘  │singleton│ │
                    │  │affinity)  │         │            └───┬────┘ │
                    │  └─────┬─────┘         │                │      │
                    └────────┼────────────────┼────────────────┼─────┘
                              │                │                │
                              │ Serverless VPC Access connector       │
                              │ (Cloud SQL uses its own built-in      │
                              │  connector instead; Memorystore is    │
                              │  always VPC-internal, so this exists  │
                              │  specifically to reach Redis)         │
                    ┌─────────▼────────────────▼────────────────▼────┐
              ┌─────▼──────┐                                  ┌────────▼───────┐
              │  Cloud SQL │                                  │  Memorystore    │
              │for Postgre-│                                  │  for Redis      │
              │SQL (shared-│                                  │  (Basic, 1GB)   │
              │core, db-   │                                  │  — geo, locks,  │
              │f1-micro)   │                                  │  cache, broker  │
              └────────────┘                                  └─────────────────┘

        Supporting: Artifact Registry (images), Secret Manager (JWT/DB/Redis secrets),
                    Cloud Logging + Cloud Monitoring (observability, included by default)
```

## Component mapping

| Existing piece | GCP service | Notes |
|---|---|---|
| `backend/Dockerfile` (api) | Cloud Run service `api` | CPU always allocated (`cpu_idle = false`) — needed for persistent WebSocket connections; session affinity on; 1 instance fixed, same reason as the Azure plan |
| Celery worker | Cloud Run service `celery-worker` | CPU always allocated, `min_instance_count = max_instance_count = 1`; no `ports` block — pure background process |
| Celery beat | Cloud Run service `celery-beat` | Same as worker — **singleton**, never scale past 1 instance |
| `alembic upgrade head` | Cloud Run **Job** `db-migrate` | Manually/pipeline-triggered, not baked into service startup |
| PostgreSQL | Cloud SQL for PostgreSQL, shared-core `db-f1-micro` | Reached via Cloud Run's built-in Cloud SQL connector (Unix socket, IAM-scoped) — no VPC needed just for this |
| Redis | Memorystore for Redis, Basic tier, 1GB | Memorystore has **no public IP option** — always VPC-internal, which is why this deployment also provisions a small custom VPC + Serverless VPC Access connector (`infra-gcp/modules/memorystore_redis/`) purely to let Cloud Run reach it |
| Docker image | Artifact Registry | Regional Docker repo |
| Secrets | Secret Manager | Cloud Run services read secrets via `value_source.secret_key_ref`, granted through the shared runtime service account |
| Logs/metrics | Cloud Logging + Cloud Monitoring | Included by default for Cloud Run, no separate resource to provision |

### Cost model difference worth knowing

Cloud Run's **CPU-always-allocated** mode (required here — `celery-worker`/`celery-beat` must keep running between requests, and `api` holds persistent WebSocket connections) bills a flat rate whether the instance is busy or idle. Azure Container Apps' Consumption plan, by contrast, has a real idle-rate discount (~1/3 the active rate). For this specific workload shape (always-on background workers + long-lived WebSockets), that structurally makes Cloud Run's realistic cost higher than Container Apps' — reflected in the numbers below, not just rounding noise.

## Infrastructure as code (Terraform)

```
infra-gcp/
├── main.tf                        # provider + module wiring, shared runtime service account, required API enablement
├── variables.tf
├── outputs.tf
├── terraform.tfvars.example
└── modules/
    ├── artifact_registry/
    ├── cloud_sql/
    ├── memorystore_redis/          # also owns the VPC + Serverless VPC Access connector
    ├── secret_manager/
    ├── cloud_run_api/
    ├── cloud_run_worker/
    ├── cloud_run_beat/
    └── cloud_run_job_migrate/
```

Validated with the real Terraform CLI + `hashicorp/google` provider: `terraform init && terraform validate` — both succeed cleanly against the actual provider schema (this catches attribute-name mistakes that a purely visual review wouldn't).

## CI/CD

```
.github/workflows/
└── deploy-backend-gcp.yml   # on push to main (backend/** changes): Cloud Build, migration job (--wait), deploy 3 services, smoke-test
```

Authenticates via Workload Identity Federation (`google-github-actions/auth`, no service-account JSON key committed anywhere). Needs these repo settings:

- **Secrets**: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`
- **Variables**: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_ARTIFACT_REPO`, `GCP_API_SERVICE_NAME`, `GCP_WORKER_SERVICE_NAME`, `GCP_BEAT_SERVICE_NAME`, `GCP_MIGRATE_JOB_NAME`

## First-time deployment runbook

1. `gcloud auth login`, set the target project, enable billing.
2. Create a Workload Identity Federation pool + provider trusting this GitHub repo, and a deploy service account with `roles/run.admin`, `roles/artifactregistry.writer`, `roles/cloudbuild.builds.editor`, `roles/iam.serviceAccountUser` — record the provider resource name and SA email as the two GitHub secrets above.
3. `cd infra-gcp && terraform init && terraform apply -var project_id=<id> -var postgres_admin_password=<secret> -var jwt_secret=<secret>` — provisions everything with a placeholder image (Artifact Registry starts empty).
4. Configure `deploy-backend-gcp.yml`'s secrets/variables.
5. Push to `main` (or run the workflow manually) to build the real image, run migrations, and deploy.
6. Point `mobile/app.json`'s `extra.apiBaseUrl` at the `api` Cloud Run service's URL (`terraform output api_url`), rebuild via EAS.
7. Same critical-path smoke test as the Azure runbook.

## Monthly cost estimate — asia-southeast1, MVP sizing

Same caveat as the Azure table: estimates from currently-published US pricing with a +15% Southeast Asia adjustment; re-verify with the [GCP Pricing Calculator](https://cloud.google.com/products/calculator).

| Service | Realistic MVP estimate |
|---|---|
| Cloud Run — `api` (0.5 vCPU/1GiB, always-allocated, 1 instance) | ~$47/mo |
| Cloud Run — `celery-worker` (0.25 vCPU/0.5GiB, always-allocated, 1 instance) | ~$24/mo |
| Cloud Run — `celery-beat` (0.25 vCPU/0.5GiB, always-allocated, 1 instance) | ~$24/mo |
| Cloud SQL PostgreSQL (`db-f1-micro`) + ~10GB SSD | ~$13/mo |
| Memorystore for Redis (Basic, 1GB) | ~$18/mo |
| Artifact Registry | ~$2/mo |
| Secret Manager | <$1/mo |
| Cloud Logging + Monitoring | $0–5/mo |
| Network egress | $5–10/mo |
| **Total** | **≈ $135–145/mo** |

**Cheaper GCP alternative for a true bootstrap-stage MVP**: skip Cloud Run entirely and run `backend/docker-compose.yml` as-is on a single Compute Engine `e2-small` VM (~$13–15/mo total). Loses per-service scaling/isolation and shifts OS patching onto you, but is the cheapest possible GCP path.

## Azure vs. GCP — bottom line

| | Azure (Container Apps) | GCP (Cloud Run) |
|---|---|---|
| Realistic MVP monthly cost | **≈ $80–90** | ≈ $135–145 |
| Why the gap | Idle replicas bill at ~1/3 the active rate | CPU-always-allocated has no idle discount |
| Networking for the database | Firewall rule (or optional Private Endpoint) | Built-in Cloud SQL connector, no VPC setup needed |
| Networking for Redis | None extra — Managed Redis reachable directly | Requires a VPC + Serverless VPC Access connector (Memorystore has no public IP) |
| Redis service maturity | Azure Managed Redis is the *new* path (classic Redis Cache retiring 2028) | Memorystore is GCP's long-standing, stable managed Redis |
| Cheapest possible path | Container Apps is already close to the floor for this shape | Single `e2-small` VM running docker-compose, ~$13–15/mo |

**Recommendation**: Azure Container Apps for lower steady-state cost on this specific workload (persistent WebSockets + always-on Celery), unless there's an existing reason to standardize on GCP — in which case the single-VM docker-compose path beats Cloud Run's per-service model on cost.
