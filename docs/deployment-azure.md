# Deploying FastShip to Azure

Architecture, IaC, and CI/CD for running the FastShip backend on **Azure Container Apps**, sized for an MVP/staging environment. See [`deployment-gcp.md`](./deployment-gcp.md) for the parallel Google Cloud option and a cost comparison between the two.

## Architecture

```
                         ┌─────────────────────────────┐
                         │   GitHub Actions (CI/CD)     │
                         │  build → push ACR → migrate  │
                         │  → update Container Apps     │
                         └───────────────┬──────────────┘
                                          │
                    ┌─────────────────────▼─────────────────────┐
                    │      Azure Container Apps Environment       │
                    │              (Southeast Asia)                │
                    │                                               │
                    │  ┌───────────┐  ┌──────────────┐  ┌────────┐ │
                    │  │  api      │  │ celery-worker │  │ celery-│ │
                    │  │ (FastAPI  │  │  (1 replica,  │  │  beat  │ │
                    │  │ +Socket.IO│  │   fixed)      │  │(1 repl,│ │
                    │  │ 1 replica,│  │               │  │singleton│ │
                    │  │ external  │  │               │  │  only) │ │
                    │  │ ingress,  │  └──────┬────────┘  └───┬────┘ │
                    │  │ WS+sticky)│         │                │      │
                    │  └─────┬─────┘         │                │      │
                    └────────┼────────────────┼────────────────┼─────┘
                              │                │                │
                    ┌─────────▼────────────────▼────────────────▼────┐
                    │                                                   │
              ┌─────▼──────┐                                  ┌────────▼───────┐
              │ Azure DB   │                                  │ Azure Managed   │
              │ for        │                                  │ Redis           │
              │ PostgreSQL │                                  │ (Balanced B0,   │
              │ Flexible   │                                  │  1GB) — geo,    │
              │ Server     │                                  │  locks, cache,  │
              │ (B1ms)     │                                  │  Celery broker  │
              └────────────┘                                  └─────────────────┘

        Supporting (not on the request path):
        Azure Container Registry (Basic) — image storage
        Azure Key Vault — JWT secret, DB/Redis connection strings
        Log Analytics + Application Insights — logs, metrics, tracing

        Not on Azure:
        Expo/EAS Build + App Store/Play Store — mobile app builds & OTA updates
```

## Component mapping

| Existing piece | Azure service | Notes |
|---|---|---|
| `backend/Dockerfile` (uvicorn + Socket.IO ASGI app) | Container App `api` | External ingress, target port 8000, WebSockets enabled |
| `celery -A app.workers.celery_app worker` | Container App `celery-worker` | Internal only, no ingress |
| `celery -A app.workers.celery_app beat` | Container App `celery-beat` | Internal only, **must stay at exactly 1 replica** — Celery beat is not safe to run concurrently |
| `alembic upgrade head` | Container Apps **Job** `db-migrate` | Run on-demand by the pipeline before updating `api`, not baked into container startup |
| PostgreSQL (`fastship` db) | Azure Database for PostgreSQL Flexible Server, Burstable B1ms (1 vCore/2GiB), 32GB storage | Firewall rule scoped to "allow Azure services" — see hardening note below |
| Redis (geo index, SETNX locks, score cache, Celery broker+backend) | Azure Managed Redis, Balanced B0 (1GB) | The classic "Azure Cache for Redis" is retiring April 2028; this deploy targets Azure Managed Redis (`Microsoft.Cache/redisEnterprise`) directly |
| Docker image | Azure Container Registry, Basic | Pulled via each app's managed identity (`AcrPull` role) — no admin credentials |
| `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL` | Azure Key Vault | Container Apps resolve these as Key Vault references at runtime via managed identity |
| Mobile app (`mobile/`) | *not deployed to Azure* | EAS Build produces the iOS/Android binaries; point `mobile/app.json`'s `extra.apiBaseUrl` at the `api` Container App's FQDN |

### Known limitation

`backend/app/modules/tracking/ws_manager.py`'s `socketio.AsyncServer` uses the default **in-memory** state manager. If `api` ever scales beyond 1 replica, WebSocket broadcasts (order status, shipper location) only reach clients connected to the same replica — a correctness bug, not just a performance one. This deploy pins `api` at exactly 1 replica to avoid it. Scaling past 1 replica requires first swapping in `socketio.AsyncRedisManager(redis_url)` plus the ingress sticky-session setting already configured in `infra/modules/containerApp-api.bicep`.

## Infrastructure as code

```
infra/
├── main.bicep                        # orchestrator — wires every module together
├── main.parameters.json              # dev/default parameter values
├── main.parameters.prod.json         # production overrides
└── modules/
    ├── logAnalytics.bicep            # workspace + Application Insights
    ├── containerRegistry.bicep       # ACR Basic
    ├── containerAppsEnv.bicep        # Managed Environment
    ├── postgres.bicep                # Flexible Server + firewall rule + database
    ├── redis.bicep                   # redisEnterprise (Balanced_B0) + database
    ├── keyvault.bicep                # Key Vault + secrets
    ├── containerApp-api.bicep
    ├── containerApp-worker.bicep
    ├── containerApp-beat.bicep
    ├── containerAppJob-migrate.bicep
    └── roleAssignment.bicep          # shared AcrPull / Key Vault Secrets User grants
```

Validated with the Bicep CLI (`bicep build infra/main.bicep`) — compiles cleanly to a valid ARM template with no errors or warnings.

## CI/CD

```
.github/workflows/
├── deploy-backend.yml   # on push to main (backend/** changes): build in ACR, run migration, update the 3 apps, smoke-test
└── infra-deploy.yml     # manual dispatch only: az deployment group create against infra/main.bicep
```

`deploy-backend.yml` authenticates via OIDC federated credential (`azure/login`, no client secret stored in GitHub) and needs these repo settings:

- **Secrets**: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- **Variables**: `AZURE_RESOURCE_GROUP`, `AZURE_ACR_NAME`, `AZURE_API_APP_NAME`, `AZURE_WORKER_APP_NAME`, `AZURE_BEAT_APP_NAME`, `AZURE_MIGRATE_JOB_NAME`, `AZURE_LOCATION`

`infra-deploy.yml` additionally needs `POSTGRES_ADMIN_PASSWORD` and `JWT_SECRET` as repo secrets (never committed to `infra/main.parameters*.json`, which only hold placeholder text).

## First-time deployment runbook

1. Create an Azure AD app registration with a federated credential trusting this GitHub repo, and grant it `Contributor` + `User Access Administrator` (or a tighter custom role covering resource creation + RBAC assignment) on the target subscription/resource group. Record its client ID as `AZURE_CLIENT_ID`.
2. `az login`, then either:
   - Run `infra-deploy.yml` from the Actions tab (recommended — exercises the same path CI will use later), or
   - Locally: `az group create -n fastship-rg -l southeastasia && az deployment group create -g fastship-rg -f infra/main.bicep -p infra/main.parameters.json --parameters postgresAdminPassword=<secret> jwtSecret=<secret>`
   
   This provisions everything with a placeholder image (ACR starts empty).
3. Configure the `deploy-backend.yml` secrets/variables listed above (resource names come from the `main.bicep` outputs / your chosen `environmentName`).
4. Push to `main` (or run `deploy-backend.yml` manually) to build the real image, run migrations, and deploy it.
5. Point `mobile/app.json`'s `extra.apiBaseUrl` at the `api` Container App's FQDN (`az containerapp show ... --query properties.configuration.ingress.fqdn`), rebuild via EAS.
6. Smoke-test the critical path (register → order → match → deliver) exactly as verified locally during development.

## Monthly cost estimate — Southeast Asia, MVP sizing

All figures are estimates from currently-published US pricing (Container Apps, PostgreSQL Flexible Server, Azure Managed Redis, ACR) with a +15% Southeast Asia adjustment. Re-check with the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) before committing budget.

| Service | Realistic MVP estimate | Upper bound (100% active) |
|---|---|---|
| Container Apps — `api` (0.5 vCPU/1GiB, 1 replica) | ~$21/mo | ~$45/mo |
| Container Apps — `celery-worker` (0.25 vCPU/0.5GiB, 1 replica) | ~$9/mo | ~$22/mo |
| Container Apps — `celery-beat` (0.25 vCPU/0.5GiB, 1 replica) | ~$8/mo | ~$22/mo |
| Azure DB for PostgreSQL Flexible Server (B1ms) + 32GB storage | ~$19/mo | fixed |
| Azure Managed Redis (Balanced B0, 1GB) | ~$15/mo | fixed |
| Azure Container Registry (Basic) | ~$6/mo | fixed |
| Key Vault | <$1/mo | <$1/mo |
| Log Analytics + Application Insights | $0–5/mo | $0–10/mo |
| Outbound data transfer | $0–5/mo | $5–15/mo |
| **Total** | **≈ $80–90/mo** | **≈ $155–175/mo** |

Not billed by Azure: Expo EAS Build/Submit for the mobile app (free tier covers limited builds; paid plans from ~$29/mo), Apple Developer Program ($99/yr), Google Play Console ($25 one-time).

**To go cheaper**: the free monthly grant (180,000 vCPU-seconds + 360,000 GiB-seconds) is already netted into the estimate above; the biggest further lever is moving `celery-worker`/`celery-beat` to scale-to-zero with KEDA triggers (adds cold-start latency, and isn't safe for `beat`'s scheduling reliability, so not recommended as a first move).
