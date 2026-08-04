# FastShip

A delivery-matching platform connecting four roles — **Customer**, **Merchant**, **Shipper**,
**Operations** — built as a FastAPI modular monolith backend with a single Expo/React Native
app that adapts its navigation by role.

## Repository layout

```
FastShip/
├── backend/    FastAPI modular monolith (Catalog, Order, Matching, Payment, Tracking, Ops)
├── mobile/     Expo Router app, one codebase, role-based navigation stacks
├── shared/     Exported OpenAPI contract (optional TS codegen source for mobile)
├── scripts/    seed.py (sample data), export_openapi.py
└── docker-compose.yml
```

## Architecture

- **Backend**: FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL + Redis, split into modules under
  `backend/app/modules/` — `auth`, `catalog`, `orders`, `shippers`, `matching`, `payments`,
  `tracking`, `ops`, `notifications`. Async jobs run on Celery (`backend/app/workers/`).
- **Matching engine**: Redis GEO (`GEOSEARCH`) for nearest-shipper lookup, a weighted score
  (proximity 35% / acceptance 20% / completion 20% / activity 15% / rating 10% − violations),
  and a Redis `SETNX` lock per shipper so two orders can never both hold an active offer on the
  same shipper. See `backend/app/modules/matching/engine.py`.
- **Order lifecycle**: explicit state machine in `backend/app/modules/orders/state_machine.py`
  (`pending_confirmation → pending → assigned → picked_up → delivering → completed | failed |
  cancelled | rejected`), every transition writes an `order_events` audit row.
- **Escrow**: `backend/app/modules/payments/state_machine.py` — charged at order placement,
  held through delivery, released 48h after completion via a Celery beat job
  (`backend/app/workers/tasks_escrow.py`), refunded on reject/cancel/fail.
- **Realtime tracking**: Socket.IO mounted alongside FastAPI (`backend/app/modules/tracking/`),
  rooms per `customer:{id}` / `merchant:{id}` / `shipper:{id}` / `ops:dashboard` / `order:{id}`,
  with a resync-on-reconnect snapshot and an auto-offline watcher for stale shippers.
- **Mobile**: Expo Router, one app, role-scoped route groups (`(customer)`, `(merchant)`,
  `(shipper)`, `(ops)`) selected after login, Zustand for auth/tracking/cart state, React Query
  for server state, `socket.io-client` for realtime updates.
- **Ratings**: `backend/app/modules/ratings/` — customer rates the shipper once an order is
  `completed` (one rating per order); the shipper's `rating` column is recomputed as the average
  across all their ratings. Mobile UI lives inline on the order detail screen.
- **SLA**: `orders.sla_deadline` is set at order creation (`created_at + sla_minutes`, default
  60 min) so the ops "SLA-breached" complaint detection has something real to compare against.
- **Merchant revenue**: `GET /orders/merchant/revenue` reports total/completed orders, revenue
  from completed orders, and pending vs. released escrow payout, scoped to the calling merchant.
  Surfaced on a dedicated `(merchant)/revenue` tab.
- **Ops heatmap**: `GET /ops/heatmap` (grid-bucketed shipper density from the Redis geo index) is
  now also rendered on mobile at `(ops)/heatmap`.

## Backend setup

Requires Python 3.11+, PostgreSQL 16, Redis.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env   # then point DATABASE_URL/REDIS_URL at your local Postgres/Redis

alembic upgrade head
uvicorn app.main:app --reload
```

Seed sample accounts/products (merchant, customer, shipper, ops — all with password
`password123`):

```bash
python ../scripts/seed.py
```

Run the test suite (spins up against a real Postgres + Redis — set `DATABASE_URL` to a
`..._test` database first, `conftest.py` defaults to `fastship_test`):

```bash
pytest
```

Run Celery (separately, for `offer_timeout`, `batch_update_scores`, `release_due_escrow`,
`auto_reject_timeout`):

```bash
celery -A app.workers.celery_app worker --loglevel=info
celery -A app.workers.celery_app beat --loglevel=info
```

### Docker Compose

```bash
docker compose up --build
```

Brings up Postgres, Redis, the API (migrates on startup), a Celery worker, and Celery beat.

## Mobile setup

Requires Node 20+.

```bash
cd mobile
npm install
npx expo start
```

Set the backend URL the app talks to via `expo.extra.apiBaseUrl` in `mobile/app.json` (defaults
to `http://localhost:8000`; use your machine's LAN IP when testing on a physical device).

Register a user through the app (or log in with a seeded account) — the role picked at
registration determines which navigation stack (`(customer)`, `(merchant)`, `(shipper)`,
`(ops)`) the app routes to.

## Key configuration (`backend/app/config.py`)

| Setting | Default | Meaning |
|---|---|---|
| `escrow_buffer_hours` | 48 | Delay between delivery completion and escrow release |
| `match_radius_km` | 5.0 | Shipper search radius for matching |
| `offer_timeout_seconds` | 20 | How long a shipper has to accept/decline an offer |
| `merchant_response_window_seconds` | 300 | Auto-reject window if merchant doesn't respond |
| `match_lock_ttl_seconds` | 30 | TTL on the per-shipper matching lock |
| `shipper_offline_after_seconds` | 30 | Heartbeat staleness threshold before auto-offline |
| `sla_minutes` | 60 | Delivery SLA window from order creation, feeds ops SLA-breach detection |

## Verified end-to-end

The full order lifecycle — place order (escrow held) → merchant confirm (stock decremented,
matching triggered) → shipper offer → accept → pickup → deliver → complete (escrow release
scheduled) — was exercised against a live server with a real Postgres/Redis, with a complete
`order_events` audit trail at every step. The concurrent-matching race condition (multiple
orders targeting the same shipper) is covered by an automated test using real Redis `SETNX`
under `asyncio.gather`. The mobile app's TypeScript compiles clean and its Metro bundle exports
successfully; native UI has not been visually verified on a simulator/device in this
environment.
