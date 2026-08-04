"""The concurrency-correctness test: verifies the Redis SETNX lock is the
sole mechanism preventing two orders from matching the same shipper at
once. Uses a REAL Redis instance (not fakeredis) — SETNX atomicity under
genuine concurrency is exactly what's being validated here.
"""

import asyncio
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderSource, OrderStatus, ShipperStatus
from app.modules.auth.models import Customer, User
from app.modules.catalog.models import Merchant
from app.modules.matching import engine as matching_engine
from app.modules.matching.locking import acquire_lock, lock_holder, release_lock
from app.modules.matching.models import MatchOffer
from app.modules.matching.redis_keys import SHIPPERS_GEO_KEY, shipper_status_key
from app.modules.orders.models import Order
from app.modules.shippers.models import Shipper
from app.tests.conftest import TestSessionLocal, unique_email


async def _seed_customer_and_merchant(db: AsyncSession):
    customer_user = User(email=unique_email("cust"), password_hash="x", role="customer")
    merchant_user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    db.add_all([customer_user, merchant_user])
    await db.flush()
    customer = Customer(user_id=customer_user.id, name="Cust")
    merchant = Merchant(user_id=merchant_user.id, name="Merch", address="addr", status="active")
    db.add_all([customer, merchant])
    await db.flush()
    return customer, merchant


async def _seed_order(db: AsyncSession, customer_id, merchant_id, lat: float, lng: float) -> Order:
    order = Order(
        source=OrderSource.customer_placed,
        customer_id=customer_id,
        merchant_id=merchant_id,
        status=OrderStatus.pending,
        pickup_addr={"lat": lat, "lng": lng, "address": "pickup"},
        dropoff_addr={"lat": lat + 0.01, "lng": lng, "address": "dropoff"},
        subtotal=100,
    )
    db.add(order)
    await db.flush()
    return order


async def _seed_shipper(db, redis, lat: float, lng: float) -> Shipper:
    user = User(email=unique_email("ship"), password_hash="x", role="shipper")
    db.add(user)
    await db.flush()
    shipper = Shipper(
        user_id=user.id, status=ShipperStatus.available, current_lat=lat, current_lng=lng
    )
    db.add(shipper)
    await db.flush()
    await redis.geoadd(SHIPPERS_GEO_KEY, (lng, lat, str(shipper.id)))
    await redis.set(shipper_status_key(shipper.id), str(ShipperStatus.available))
    return shipper


# --- locking primitive tests -------------------------------------------------


async def test_acquire_lock_succeeds_when_free(redis_client):
    shipper_id, order_id = uuid.uuid4(), uuid.uuid4()
    acquired = await acquire_lock(redis_client, shipper_id, order_id, ttl_seconds=10)
    assert acquired is True
    assert await lock_holder(redis_client, shipper_id) == str(order_id)


async def test_acquire_lock_fails_when_already_held_by_another_order(redis_client):
    shipper_id = uuid.uuid4()
    order_a, order_b = uuid.uuid4(), uuid.uuid4()
    assert await acquire_lock(redis_client, shipper_id, order_a, ttl_seconds=10) is True
    assert await acquire_lock(redis_client, shipper_id, order_b, ttl_seconds=10) is False
    # order_a still holds it
    assert await lock_holder(redis_client, shipper_id) == str(order_a)


async def test_release_lock_is_a_noop_for_non_owner(redis_client):
    shipper_id = uuid.uuid4()
    order_a, order_b = uuid.uuid4(), uuid.uuid4()
    await acquire_lock(redis_client, shipper_id, order_a, ttl_seconds=10)
    released = await release_lock(redis_client, shipper_id, order_b)
    assert released is False
    assert await lock_holder(redis_client, shipper_id) == str(order_a)


async def test_release_lock_by_owner_frees_it_for_next_acquirer(redis_client):
    shipper_id = uuid.uuid4()
    order_a, order_b = uuid.uuid4(), uuid.uuid4()
    await acquire_lock(redis_client, shipper_id, order_a, ttl_seconds=10)
    assert await release_lock(redis_client, shipper_id, order_a) is True
    assert await acquire_lock(redis_client, shipper_id, order_b, ttl_seconds=10) is True


async def _find_and_offer_isolated(redis, order_id):
    """AsyncSession is not safe for concurrent use from multiple
    coroutines — each concurrent `find_and_offer` call needs its own
    session/connection, exactly like separate concurrent HTTP requests
    would each get their own session from the pool in production.
    """
    async with TestSessionLocal() as session:
        return await matching_engine.find_and_offer(session, redis, order_id)


# --- end-to-end concurrency test against the matching engine -----------------


async def test_concurrent_find_and_offer_never_double_assigns_a_shipper(db: AsyncSession, redis_client):
    """N orders, all ranking the SAME single nearby shipper, fire
    `find_and_offer` concurrently. Exactly one order may win the lock; the
    others must not observe themselves as holding it.
    """
    customer, merchant = await _seed_customer_and_merchant(db)
    shipper = await _seed_shipper(db, redis_client, lat=10.0, lng=106.0)

    order_count = 8
    orders = [
        await _seed_order(db, customer.id, merchant.id, lat=10.0001 * i, lng=106.0)
        for i in range(order_count)
    ]
    await db.commit()

    results = await asyncio.gather(
        *(_find_and_offer_isolated(redis_client, order.id) for order in orders)
    )

    winners = [r for r in results if r is not None]
    assert len(winners) == 1, "exactly one order should have won the only available shipper"
    assert winners[0].id == shipper.id

    # the lock is held by exactly the order that won
    holder = await lock_holder(redis_client, shipper.id)
    assert holder is not None

    offers = (
        await db.execute(MatchOffer.__table__.select().where(MatchOffer.shipper_id == shipper.id))
    ).all()
    assert len(offers) == 1, "only one MatchOffer row should exist for the contended shipper"


async def test_concurrent_find_and_offer_distributes_across_multiple_shippers(
    db: AsyncSession, redis_client
):
    """With enough shippers for every order, everyone should get matched,
    and no two orders should ever be offered the same shipper.
    """
    customer, merchant = await _seed_customer_and_merchant(db)

    shipper_count = 5
    shippers = [
        await _seed_shipper(db, redis_client, lat=10.0 + 0.001 * i, lng=106.0)
        for i in range(shipper_count)
    ]
    orders = [
        await _seed_order(db, customer.id, merchant.id, lat=10.0, lng=106.0)
        for _ in range(shipper_count)
    ]
    await db.commit()

    results = await asyncio.gather(
        *(_find_and_offer_isolated(redis_client, order.id) for order in orders)
    )

    winners = [r for r in results if r is not None]
    assert len(winners) == shipper_count, "every order should have matched a distinct shipper"
    winner_ids = {w.id for w in winners}
    assert len(winner_ids) == shipper_count, "no shipper should have been offered to two orders"
    assert winner_ids == {s.id for s in shippers}


async def test_find_and_offer_skips_locked_shipper_and_tries_next_candidate(
    db: AsyncSession, redis_client
):
    customer, merchant = await _seed_customer_and_merchant(db)
    near = await _seed_shipper(db, redis_client, lat=10.0, lng=106.0)
    far = await _seed_shipper(db, redis_client, lat=10.03, lng=106.0)  # ~3.3km, still within default 5km radius

    blocking_order_id = uuid.uuid4()
    locked = await acquire_lock(redis_client, near.id, blocking_order_id, ttl_seconds=30)
    assert locked is True

    order = await _seed_order(db, customer.id, merchant.id, lat=10.0, lng=106.0)
    await db.commit()

    result = await matching_engine.find_and_offer(db, redis_client, order.id)
    assert result is not None
    assert result.id == far.id, "should fall through to the next candidate since 'near' is locked"


async def test_find_and_offer_exhausted_leaves_order_pending_with_audit_event(
    db: AsyncSession, redis_client
):
    from app.modules.orders.models import OrderEvent
    from app.core.enums import OrderEventType

    customer, merchant = await _seed_customer_and_merchant(db)
    order = await _seed_order(db, customer.id, merchant.id, lat=10.0, lng=106.0)
    await db.commit()

    result = await matching_engine.find_and_offer(db, redis_client, order.id)
    assert result is None

    await db.refresh(order)
    assert order.status == OrderStatus.pending

    events = (
        await db.execute(
            OrderEvent.__table__.select().where(OrderEvent.order_id == order.id)
        )
    ).all()
    assert any(e.event_type == OrderEventType.match_exhausted for e in events)
