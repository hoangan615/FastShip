from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderSource, OrderStatus, PaymentMethod, PaymentStatus
from app.modules.auth.models import Customer, User
from app.modules.catalog.models import Merchant
from app.modules.orders import service as order_service
from app.modules.orders.models import Order
from app.modules.payments.models import Payment
from app.tests.conftest import unique_email


async def _seed_merchant_customer(db: AsyncSession):
    customer_user = User(email=unique_email("cust"), password_hash="x", role="customer")
    merchant_user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    db.add_all([customer_user, merchant_user])
    await db.flush()
    customer = Customer(user_id=customer_user.id, name="Cust")
    merchant = Merchant(user_id=merchant_user.id, name="Merch", address="addr", status="active")
    db.add_all([customer, merchant])
    await db.commit()
    return customer, merchant


async def _seed_order(
    db: AsyncSession, customer, merchant, status: OrderStatus, subtotal: float, payment_status: PaymentStatus
):
    # commission_rate=0 here so merchant_payout == subtotal, keeping these
    # tests' pre-existing 1:1 assertions valid — commission math has its own
    # dedicated coverage in test_order_pricing.py.
    order = Order(
        source=OrderSource.customer_placed,
        customer_id=customer.id,
        merchant_id=merchant.id,
        status=status,
        pickup_addr={"lat": 0, "lng": 0, "address": "a"},
        dropoff_addr={"lat": 0, "lng": 0, "address": "b"},
        subtotal=subtotal,
        commission_rate=0,
        merchant_payout=subtotal,
    )
    db.add(order)
    await db.flush()
    payment = Payment(order_id=order.id, method=PaymentMethod.wallet, status=payment_status, amount=subtotal)
    db.add(payment)
    await db.commit()
    return order


async def test_revenue_report_aggregates_completed_orders_only(db: AsyncSession):
    customer, merchant = await _seed_merchant_customer(db)
    await _seed_order(db, customer, merchant, OrderStatus.completed, 100, PaymentStatus.released_to_merchant)
    await _seed_order(db, customer, merchant, OrderStatus.completed, 50, PaymentStatus.held)
    await _seed_order(db, customer, merchant, OrderStatus.cancelled, 30, PaymentStatus.refunded)
    await _seed_order(db, customer, merchant, OrderStatus.pending, 20, PaymentStatus.held)

    report = await order_service.get_merchant_revenue(db, merchant.id)

    assert report["total_orders"] == 4
    assert report["completed_orders"] == 2
    assert float(report["total_revenue"]) == 150  # only the 2 completed orders
    assert float(report["released_payout"]) == 100
    assert float(report["pending_payout"]) == 70  # 50 (completed, held) + 20 (pending, held)


async def test_revenue_report_empty_for_merchant_with_no_orders(db: AsyncSession):
    _, merchant = await _seed_merchant_customer(db)
    report = await order_service.get_merchant_revenue(db, merchant.id)
    assert report["total_orders"] == 0
    assert report["completed_orders"] == 0
    assert float(report["total_revenue"]) == 0
    assert float(report["pending_payout"]) == 0
    assert float(report["released_payout"]) == 0


async def test_revenue_report_scoped_to_single_merchant(db: AsyncSession):
    customer, merchant_a = await _seed_merchant_customer(db)
    _, merchant_b = await _seed_merchant_customer(db)
    await _seed_order(db, customer, merchant_a, OrderStatus.completed, 100, PaymentStatus.released_to_merchant)
    await _seed_order(db, customer, merchant_b, OrderStatus.completed, 999, PaymentStatus.released_to_merchant)

    report = await order_service.get_merchant_revenue(db, merchant_a.id)
    assert report["total_orders"] == 1
    assert float(report["total_revenue"]) == 100
