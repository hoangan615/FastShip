import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderSource, OrderStatus, ShipperStatus
from app.core.exceptions import PermissionDeniedError
from app.modules.auth.models import Customer, User
from app.modules.catalog.models import Merchant
from app.modules.matching.redis_keys import SHIPPERS_GEO_KEY, match_excluded_key, shipper_status_key
from app.modules.orders import service as order_service
from app.modules.orders.models import Order
from app.modules.shippers.models import Shipper
from app.tests.conftest import unique_email


async def _seed_assigned_order(db: AsyncSession, redis, lat: float = 10.0, lng: float = 106.0):
    customer_user = User(email=unique_email("cust"), password_hash="x", role="customer")
    merchant_user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    shipper_user = User(email=unique_email("ship"), password_hash="x", role="shipper")
    db.add_all([customer_user, merchant_user, shipper_user])
    await db.flush()

    customer = Customer(user_id=customer_user.id, name="Cust")
    merchant = Merchant(user_id=merchant_user.id, name="Merch", address="addr", status="active")
    shipper = Shipper(
        user_id=shipper_user.id, status=ShipperStatus.busy, current_lat=lat, current_lng=lng
    )
    db.add_all([customer, merchant, shipper])
    await db.flush()

    order = Order(
        source=OrderSource.customer_placed,
        customer_id=customer.id,
        merchant_id=merchant.id,
        shipper_id=shipper.id,
        status=OrderStatus.assigned,
        pickup_addr={"lat": lat, "lng": lng, "address": "a"},
        dropoff_addr={"lat": lat + 0.01, "lng": lng, "address": "b"},
        subtotal=100,
    )
    shipper.active_order_id = order.id
    db.add(order)
    await db.commit()

    await redis.geoadd(SHIPPERS_GEO_KEY, (lng, lat, str(shipper.id)))
    await redis.set(shipper_status_key(shipper.id), str(ShipperStatus.busy))

    return customer, merchant, shipper, order


async def test_reject_assignment_reverts_order_to_pending(db: AsyncSession, redis_client):
    _, _, shipper, order = await _seed_assigned_order(db, redis_client)

    result = await order_service.reject_assignment(
        db, redis_client, shipper.id, order.id, "car broke down"
    )

    assert result.status == OrderStatus.pending
    assert result.shipper_id is None


async def test_reject_assignment_frees_the_shipper(db: AsyncSession, redis_client):
    _, _, shipper, order = await _seed_assigned_order(db, redis_client)

    await order_service.reject_assignment(db, redis_client, shipper.id, order.id, None)

    await db.refresh(shipper)
    assert shipper.active_order_id is None
    assert shipper.status == ShipperStatus.available


async def test_reject_assignment_excludes_shipper_from_immediate_rematch(
    db: AsyncSession, redis_client
):
    _, _, shipper, order = await _seed_assigned_order(db, redis_client)

    await order_service.reject_assignment(db, redis_client, shipper.id, order.id, None)

    excluded = await redis_client.smembers(match_excluded_key(order.id))
    assert str(shipper.id) in excluded


async def test_reject_assignment_writes_audit_event(db: AsyncSession, redis_client):
    from app.core.enums import OrderEventType
    from app.modules.orders.models import OrderEvent
    from sqlalchemy import select

    _, _, shipper, order = await _seed_assigned_order(db, redis_client)
    await order_service.reject_assignment(db, redis_client, shipper.id, order.id, "reason x")

    events = (
        await db.scalars(select(OrderEvent).where(OrderEvent.order_id == order.id))
    ).all()
    assert any(e.event_type == OrderEventType.shipper_declined for e in events)


async def test_reject_assignment_denies_non_owning_shipper(db: AsyncSession, redis_client):
    _, _, shipper, order = await _seed_assigned_order(db, redis_client)
    with pytest.raises(PermissionDeniedError):
        await order_service.reject_assignment(db, redis_client, uuid.uuid4(), order.id, None)


async def test_reject_assignment_cannot_be_used_after_pickup(db: AsyncSession, redis_client):
    _, _, shipper, order = await _seed_assigned_order(db, redis_client)
    await order_service.mark_picked_up(db, shipper.id, order.id)

    from app.core.exceptions import InvalidTransitionError

    with pytest.raises(InvalidTransitionError):
        await order_service.reject_assignment(db, redis_client, shipper.id, order.id, None)
