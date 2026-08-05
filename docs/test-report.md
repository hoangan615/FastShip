# FastShip — Test Report

**Date:** 2026-08-05
**Scope:** full stack run live together (Postgres, Redis, FastAPI, Celery worker + beat, Expo web build), automated backend test suite, live HTTP smoke tests of every critical flow, and a Playwright walkthrough capturing every mobile screen across all 4 roles.

## Executive summary

The whole stack was started as real, persistent processes — not mocked, not imported-and-checked — and driven end-to-end through actual HTTP requests, a real Redis-backed Celery worker consuming real queued tasks, and a real browser (Chromium via Playwright) clicking through the mobile app's Expo web build. This surfaced **three real, previously-undetected bugs**, all now fixed, tested, and pushed:

| # | Bug | Impact | Status |
|---|-----|--------|--------|
| 1 | Celery worker: SQLAlchemy engine + Redis connection pools leaked across event loops between task invocations | Intermittent worker crashes ("attached to a different loop", "Event loop is closed") after a few tasks ran | Fixed, verified with 8 consecutive tasks + the real `offer_timeout` production path |
| 2 | Celery worker never imported the full model tree, only whatever a given task module imported directly | `NoReferencedTableError` on any task touching a model with unresolved cross-model foreign keys | Fixed, verified via full `Base.metadata` registration check |
| 3 | Shipper going "available" didn't restore Redis geo-index membership, only a fresh GPS ping did | A shipper toggling back online (the exact flow the mobile app uses) was invisible to matching until their next location ping landed — could be several seconds or never, if permission was denied | Fixed, verified live + 3 new regression tests |
| 4 | API had **no CORS middleware** at all | Every browser-based client (Expo web, any future web dashboard) was silently blocked from calling the API entirely; only curl/native mobile (not subject to CORS) worked | Fixed, verified live + 2 new regression tests |
| 5 | **Realtime Socket.IO broadcasts used the wrong id space for room names** — order-status and match-offer pushes to customer/merchant/shipper were built from Customer/Merchant/Shipper *profile* ids, but clients join rooms keyed by their *User* id from the JWT | Every live order-status push and match-offer notification silently reached nobody, for every order, always — shippers never saw new delivery offers appear in real time | Fixed, verified live + 1 new end-to-end regression test that fails against the old code |

Bugs 1–2 were found while running the Celery worker as a real long-lived process (see `docs/deployment-azure.md`-adjacent verification, prior session). Bugs 3–5 were found in this pass, while getting the mobile app's new Expo web build to actually work against the live API for screenshot capture — exactly the kind of gap that unit tests, which each test a component in isolation, cannot catch.

After all fixes: **227 backend tests passing, 21 skipped, 0 failing.** All 26 mobile screens render correctly with real, live data across all 4 roles, including the previously-broken realtime offer push.

---

## 1. Full stack live run

Started and kept running for the duration of this test pass:

- PostgreSQL + Redis
- `alembic upgrade head` against a clean schema
- FastAPI (`uvicorn app.main:app`)
- Celery **worker** (`celery -A app.workers.celery_app worker`) — 4 pool processes
- Celery **beat** (`celery -A app.workers.celery_app beat`) — confirmed actually ticking and dispatching `release-due-escrow` and `batch-update-shipper-scores` on schedule, consumed by the worker through the real Redis broker
- Expo web dev server (`npx expo start --web`) serving the mobile app's web build

All five bugs above were found and fixed with these processes running live, then each fix was verified by restarting the affected process(es) and re-running the exact failing scenario.

## 2. Backend automated test suite

```
227 passed, 21 skipped, 0 failed
```

| Test file | What it covers | Passed | Skipped |
|---|---|--:|--:|
| `test_order_state_machine.py` | Every legal/illegal order status transition | 115 | 12 |
| `test_escrow_state_machine.py` | Payment/escrow hold, release, refund, dispute transitions | 49 | 9 |
| `test_matching_locking.py` | Redis SETNX lock correctness under real concurrency (`asyncio.gather`) | 8 | – |
| `test_matching_scoring.py` | Weighted scoring formula (proximity/acceptance/completion/activity/rating) | 8 | – |
| `test_ratings.py` | Post-delivery rating creation, validation, ownership rules | 8 | – |
| `test_catalog.py` | Merchant/product listing, stock rules | 7 | – |
| `test_reject_assignment.py` | Shipper backing out after accept-but-before-pickup | 6 | – |
| `test_customer_addresses.py` | Saved-address CRUD | 5 | – |
| `test_ws_tracking.py` | Socket.IO room joins, resync, **and the new broadcast-reaches-everyone regression test** | 5 | – |
| `test_order_service.py` | Order creation/lookup service logic | 4 | – |
| `test_notifications.py` | Notification dispatch on lifecycle events | 4 | – |
| `test_merchant_revenue.py` | Revenue report aggregation | 3 | – |
| `test_shipper_status.py` **(new)** | Geo-index membership on status toggle | 3 | – |
| `test_cors.py` **(new)** | CORS preflight + response headers | 2 | – |

Skips are all `pytest.mark.skip`-guarded edge cases documented in-line in those files (not failures).

## 3. Live HTTP smoke tests (fresh pass, this session)

Run directly against the live API with curl, using the seeded demo accounts. Full transcript captured for every request/response.

- **Auth**: login as all 4 roles ✓
- **Catalog**: list merchants, list a merchant's products ✓
- **Customer addresses**: create, list ✓
- **Order lifecycle**: create → merchant confirm (triggers matching) → shipper accept offer → pickup → start-delivery → complete ✓
- **Escrow**: payment held on order creation, correct `release_due_at` (48h buffer) ✓
- **Rating**: customer rates shipper 5★ post-delivery ✓
- **Merchant revenue report**: totals correctly reflect completed vs. pending-payout orders ✓
- **Reject-assignment**: shipper backs out after accepting; order reverts to pending, shipper freed ✓
- **Ops dashboard**: live orders list, manual reassign (correctly returns null when no shipper available, confirmed against real availability state) ✓
- **Ops heatmap / complaints / summary report** ✓
- **Celery `offer_timeout`**: let a real 20s countdown expire naturally through the live worker (order `d2b60b83…`) — confirmed `timed_out` result with zero event-loop errors, proving the production code path (not just synthetic test tasks) is solid

## 4. Mobile: Expo web + Playwright walkthrough

No native Android/iOS simulator exists in this sandbox, so `react-dom` + `react-native-web` were added (a legitimate, permanent Expo platform — not a test-only shim) and the app was driven with headless Chromium via Playwright against the live API. All 26 screens below show **real rendered UI with live seeded data**, and where practical the walkthrough clicked through actual state-changing actions rather than just loading a static screen, so screenshots double as functional evidence.

| # | Screenshot | What it shows |
|---|---|---|
| 1 | `01-login.png` | Login screen |
| 2 | `02-register.png` | Registration screen with role picker |
| 3 | `03-customer-catalog-merchants.png` | Customer catalog — merchant list |
| 4 | `04-customer-catalog-products.png` | Product list for a merchant |
| 5 | `05-customer-cart-added.png` | Cart quantity controls after adding items |
| 6 | `06-customer-checkout.png` | Checkout — saved addresses, payment method |
| 7 | `07-customer-order-detail-new.png` | Order placed, pending confirmation |
| 8 | `08-customer-orders-list.png` | Customer's order history |
| 9 | `09-customer-addresses.png` | Saved addresses, after adding one live |
| 10 | `10-merchant-incoming-orders.png` | Merchant incoming orders queue |
| 11 | `11-merchant-order-accepted.png` | After clicking Accept — status updates live |
| 12 | `12-merchant-products.png` | Merchant product list |
| 13 | `13-merchant-product-edit.png` | Product edit screen (price/stock/visibility) |
| 14 | `14-merchant-revenue.png` | Revenue report — totals, pending vs. released payout |
| 15 | `15-shipper-home.png` | Shipper home, offline |
| 16 | `16-shipper-home-online.png` | After toggling online — **exercises the geo-index fix** |
| 17 | `17-shipper-offer-received.png` | Live delivery offer arriving via socket — **exercises the room-mismatch fix** |
| 18 | `18-shipper-active-order.png` | Redirected into the active order after accepting |
| 19 | `19-shipper-picked-up.png` | After "Mark picked up" |
| 20 | `20-shipper-delivering.png` | After "Start delivery" |
| 21 | `21-shipper-completed.png` | After "Mark delivered" — order completed, live shipper location shown |
| 22 | `22-customer-rating-selected.png` | Customer selecting a 5★ rating |
| 23 | `23-customer-rating-submitted.png` | Rating submitted and persisted |
| 24 | `24-ops-dashboard.png` | Ops dashboard — live order counts, per-order reassign |
| 25 | `25-ops-heatmap.png` | Shipper density heatmap |
| 26 | `26-ops-complaints.png` | Open complaints (SLA breach) with reassign action |

Screenshot 17 in particular is the key piece of evidence: before the room-mismatch fix, this exact scenario (shipper online, merchant confirms an order) left the shipper's screen blank and the offer silently timed out 20 seconds later with no visible sign of a problem anywhere in the UI. After the fix, the offer card appears within ~1 second.

### Known limitation

`expo-location` (used for the shipper's periodic GPS ping) is a native-only module with only partial browser Geolocation support. The walkthrough granted Playwright's fake browser geolocation permission (fixed coordinates) to exercise the flow structurally — the toggle, the geo-index fix, and the resulting live match all work correctly — but this isn't proof of real device GPS behavior, which was already unverifiable in this sandbox for native builds too (no simulator).

## 5. Files in this report

- `docs/test-report.md` — this file
- `docs/screenshots/*.png` — the 26 screenshots above
