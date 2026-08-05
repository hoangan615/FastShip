"""Verifies notifications actually fire at the key order-lifecycle
checkpoints. `notifications.service.send_notification` is a logging stub
(no real push provider configured), so we assert on call args rather than
external delivery.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import PaymentMethod, ShipperStatus
from app.modules.auth.models import Customer, User
from app.modules.catalog.models import Merchant, Product
from app.modules.matching import engine as matching_engine
from app.modules.matching.redis_keys import SHIPPERS_GEO_KEY, shipper_status_key
from app.modules.orders import service as order_service
from app.modules.orders.schemas import Address, OrderCreate, OrderItemIn
from app.modules.shippers.models import Shipper
from app.tests.conftest import unique_email


@pytest.fixture
def notify_calls(monkeypatch):
    calls = []

    def fake_send_notification(recipient_id, title, body):
        calls.append((recipient_id, title, body))

    monkeypatch.setattr(order_service, "send_notification", fake_send_notification)
    monkeypatch.setattr(matching_engine, "send_notification", fake_send_notification)
    return calls


async def _seed(db: AsyncSession, redis, lat: float = 10.0, lng: float = 106.0):
    customer_user = User(email=unique_email("cust"), password_hash="x", role="customer")
    merchant_user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    shipper_user = User(email=unique_email("ship"), password_hash="x", role="shipper")
    db.add_all([customer_user, merchant_user, shipper_user])
    await db.flush()

    customer = Customer(user_id=customer_user.id, name="Cust")
    merchant = Merchant(user_id=merchant_user.id, name="Merch", address="addr", status="active")
    shipper = Shipper(
        user_id=shipper_user.id, status=ShipperStatus.available, current_lat=lat, current_lng=lng
    )
    db.add_all([customer, merchant, shipper])
    await db.flush()

    product = Product(merchant_id=merchant.id, name="Widget", price=10000, stock_qty=5, status="active")
    db.add(product)
    await db.commit()

    await redis.geoadd(SHIPPERS_GEO_KEY, (lng, lat, str(shipper.id)))
    await redis.set(shipper_status_key(shipper.id), str(ShipperStatus.available))

    return customer, merchant, shipper, product


async def test_create_order_notifies_merchant(db: AsyncSession, redis_client, notify_calls):
    customer, merchant, shipper, product = await _seed(db, redis_client)

    order = await order_service.create_order(
        db,
        customer.id,
        OrderCreate(
            merchant_id=merchant.id,
            items=[OrderItemIn(product_id=product.id, qty=1)],
            pickup_addr=Address(address="a", lat=10.0, lng=106.0),
            dropoff_addr=Address(address="b", lat=10.01, lng=106.0),
            payment_method=PaymentMethod.wallet,
        ),
    )

    assert any(recipient == merchant.id for recipient, _, _ in notify_calls)


async def test_full_lifecycle_notifies_customer_and_merchant_at_each_step(
    db: AsyncSession, redis_client, notify_calls
):
    customer, merchant, shipper, product = await _seed(db, redis_client)

    order = await order_service.create_order(
        db,
        customer.id,
        OrderCreate(
            merchant_id=merchant.id,
            items=[OrderItemIn(product_id=product.id, qty=1)],
            pickup_addr=Address(address="a", lat=10.0, lng=106.0),
            dropoff_addr=Address(address="b", lat=10.01, lng=106.0),
            payment_method=PaymentMethod.wallet,
        ),
    )
    notify_calls.clear()

    await order_service.confirm_order(db, redis_client, merchant.id, order.id)
    titles_after_confirm = {t for _, t, _ in notify_calls}
    assert "Order confirmed" in titles_after_confirm
    assert "New delivery offer" in titles_after_confirm

    notify_calls.clear()
    await matching_engine.accept_offer(db, redis_client, order.id, shipper.id)
    titles_after_accept = {t for _, t, _ in notify_calls}
    assert "Shipper assigned" in titles_after_accept
    assert any(r == customer.id for r, t, _ in notify_calls if t == "Shipper assigned")
    assert any(r == merchant.id for r, t, _ in notify_calls if t == "Shipper assigned")

    notify_calls.clear()
    await order_service.mark_picked_up(db, shipper.id, order.id)
    await order_service.start_delivery(db, shipper.id, order.id)
    await order_service.complete_order(db, shipper.id, order.id)
    titles_after_complete = [t for _, t, _ in notify_calls]
    assert titles_after_complete.count("Order delivered") == 2  # customer + merchant


async def test_reject_order_notifies_customer(db: AsyncSession, redis_client, notify_calls):
    customer, merchant, shipper, product = await _seed(db, redis_client)
    order = await order_service.create_order(
        db,
        customer.id,
        OrderCreate(
            merchant_id=merchant.id,
            items=[OrderItemIn(product_id=product.id, qty=1)],
            pickup_addr=Address(address="a", lat=10.0, lng=106.0),
            dropoff_addr=Address(address="b", lat=10.01, lng=106.0),
            payment_method=PaymentMethod.wallet,
        ),
    )
    notify_calls.clear()

    await order_service.reject_order(db, merchant.id, order.id, "out of stock")

    assert any(
        recipient == customer.id and title == "Order rejected" for recipient, title, _ in notify_calls
    )


async def test_reject_assignment_notifies_customer(db: AsyncSession, redis_client, notify_calls):
    customer, merchant, shipper, product = await _seed(db, redis_client)
    order = await order_service.create_order(
        db,
        customer.id,
        OrderCreate(
            merchant_id=merchant.id,
            items=[OrderItemIn(product_id=product.id, qty=1)],
            pickup_addr=Address(address="a", lat=10.0, lng=106.0),
            dropoff_addr=Address(address="b", lat=10.01, lng=106.0),
            payment_method=PaymentMethod.wallet,
        ),
    )
    await order_service.confirm_order(db, redis_client, merchant.id, order.id)
    await matching_engine.accept_offer(db, redis_client, order.id, shipper.id)
    notify_calls.clear()

    await order_service.reject_assignment(db, redis_client, shipper.id, order.id, "car trouble")

    assert any(
        recipient == customer.id and title == "Finding a new shipper"
        for recipient, title, _ in notify_calls
    )
