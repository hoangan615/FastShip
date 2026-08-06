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

---

## 6. UI/UX redesign verification pass (2026-08-06)

**Scope:** verify the full UI/UX redesign (design system, dark mode, icons, confirm
dialogs — see the branch's redesign commit) against a real live stack, and refresh all
26 screenshots above plus a supplementary dark-mode set. No backend code changed in
this pass.

### Environment

No Docker daemon available in this sandbox, so the stack was run natively instead:
PostgreSQL 16 and Redis 7 installed system packages, started directly
(`pg_ctlcluster 16 main start`, `redis-server --daemonize yes`), a `fastship`/`fastship`
role+database created to match `backend/app/config.py`'s localhost defaults (no `.env`
file used — `.env.example`'s Docker hostnames would otherwise shadow those defaults), a
fresh `backend/.venv` with `pip install -e ".[dev]"`, `alembic upgrade head`, and
`python scripts/seed.py` for demo data. FastAPI (`uvicorn`), Celery worker, and Celery
beat were run as real background processes, plus `expo start --web` for the mobile
build — the same shape of live stack as section 1 above.

### Results

- **Backend test suite:** `227 passed, 21 skipped, 0 failed` — identical to the count
  in section 2, confirming no regressions from the UI-only redesign.
- **TypeScript:** `npx tsc --noEmit` in `mobile/` — clean, no errors.
- **Playwright walkthrough:** a new script, `mobile/e2e/capture-screenshots.js`
  (committed to the repo this pass — none existed before), drives four concurrent
  logged-in personas (customer/merchant/shipper/ops) through the same 26 flows listed
  in section 4's table, now exercising the redesigned UI: the new design-token theme,
  `Ionicons` throughout (tab bar, status badges, star ratings, chevrons replacing the
  old `"->"`/`"<"` text arrows), the tinted `StatusBadge`, real `Pressable`-backed
  Accept/Decline buttons on the shipper offer card (previously bare `<Text>`), the
  checkout screen's safe-area sticky button, and `Alert.alert` confirmations before
  cancel/reject/fail/refund/release/delete actions. Zero `pageerror`/console errors
  across the full walkthrough. All 26 screenshots were re-captured with real, live,
  freshly-seeded data (not static/faked auth) — see the updated table below.
- **Dark mode:** `mobile/app.json`'s `userInterfaceStyle` is now `"automatic"`, so a
  small supplementary set of dark-mode screenshots was captured at
  `docs/screenshots/dark/` (login, customer catalog, customer order detail, shipper
  home online, ops dashboard) — light/dark toggling verified with no layout breakage.

### Bug found and fixed **in the test script**, not the app

The shipper's periodic GPS ping (`expo-location`, called every ~7s from a
`setInterval`) is throttled by Chromium on a backgrounded (non-focused) browser tab.
Since the walkthrough juggles four personas' pages, leaving the shipper "online" while
driving the customer/merchant flows let its heartbeat go stale past
`SHIPPER_OFFLINE_AFTER_SECONDS` (30s), and the backend's real stale-shipper watcher
(working as designed) correctly flipped them back offline before the live offer could
be captured. Fixed by having the script call `page.bringToFront()` and send a direct
location ping via `fetch` (bypassing the throttled in-app timer) right before the
shipper needs to be online, and by toggling the shipper online just before the
merchant confirms rather than at the very start of the walkthrough. This is a test
artifact of running multiple browser tabs concurrently in one process, not a bug in
the app itself — confirmed by the fact that `docs/screenshots/17-shipper-offer-received.png`
now shows a real, live socket-delivered offer.

### Known minor cosmetic issues observed (not fixed in this pass — out of scope)

- **Stat card label wrapping**: on `(ops)/dashboard.tsx` and similar 4-across stat
  rows, the "Completed" label can wrap onto two lines ("Complet"/"ed") on a 390px-wide
  viewport because the card is too narrow for the label at the current font size.
  Visible in `docs/screenshots/24-ops-dashboard.png`. Cosmetic only.
- **Product status label**: `(merchant)/product/[id].tsx`'s visibility chips use
  `s.replace("_", " ")` (pre-existing, unchanged by the redesign), which only replaces
  the *first* underscore — `"out_of_stock"` renders as "Out Of_stock" instead of "Out
  Of Stock". Visible in `docs/screenshots/13-merchant-product-edit.png`. One-line fix
  (`replace(/_/g, " ")`) recommended for a future pass.

### Files in this section

- `mobile/e2e/capture-screenshots.js` — the walkthrough script (new, committed)
- `docs/screenshots/*.png` — refreshed (26 files, same names as section 4's table)
- `docs/screenshots/dark/*.png` — new supplementary dark-mode set (5 files)
