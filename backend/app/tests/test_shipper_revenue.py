from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderSource, OrderStatus, PaymentMethod, PaymentStatus, ShipperStatus
from app.modules.auth.models import Customer, User
from app.modules.catalog.models import Merchant
from app.modules.orders import service as order_service
from app.modules.orders.models import Order
from app.modules.payments.models import Payment
from app.modules.shippers.models import Shipper
from app.tests.conftest import unique_email


async def _seed_shipper_customer_merchant(db: AsyncSession):
    shipper_user = User(email=unique_email("ship"), password_hash="x", role="shipper")
    customer_user = User(email=unique_email("cust"), password_hash="x", role="customer")
    merchant_user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    db.add_all([shipper_user, customer_user, merchant_user])
    await db.flush()

    shipper = Shipper(user_id=shipper_user.id, status=ShipperStatus.available)
    customer = Customer(user_id=customer_user.id, name="Cust")
    merchant = Merchant(user_id=merchant_user.id, name="Merch", address="addr", status="active")
    db.add_all([shipper, customer, merchant])
    await db.commit()
    return shipper, customer, merchant


async def _seed_order(
    db: AsyncSession,
    customer,
    merchant,
    shipper,
    status: OrderStatus,
    shipper_payout: float,
    payment_status: PaymentStatus,
):
    order = Order(
        source=OrderSource.customer_placed,
        customer_id=customer.id,
        merchant_id=merchant.id,
        shipper_id=shipper.id,
        status=status,
        pickup_addr={"lat": 0, "lng": 0, "address": "a"},
        dropoff_addr={"lat": 0, "lng": 0, "address": "b"},
        subtotal=100,
        shipper_payout=shipper_payout,
    )
    db.add(order)
    await db.flush()
    payment = Payment(
        order_id=order.id, method=PaymentMethod.wallet, status=payment_status, amount=100 + shipper_payout
    )
    db.add(payment)
    await db.commit()
    return order


async def test_shipper_revenue_aggregates_completed_deliveries_only(db: AsyncSession):
    shipper, customer, merchant = await _seed_shipper_customer_merchant(db)
    await _seed_order(db, customer, merchant, shipper, OrderStatus.completed, 15000, PaymentStatus.released_to_merchant)
    await _seed_order(db, customer, merchant, shipper, OrderStatus.completed, 20000, PaymentStatus.held)
    await _seed_order(db, customer, merchant, shipper, OrderStatus.cancelled, 15000, PaymentStatus.refunded)

    report = await order_service.get_shipper_revenue(db, shipper.id)

    assert report["total_deliveries"] == 2
    assert float(report["released_payout"]) == 15000
    assert float(report["pending_payout"]) == 20000


async def test_shipper_revenue_empty_for_shipper_with_no_deliveries(db: AsyncSession):
    shipper, _customer, _merchant = await _seed_shipper_customer_merchant(db)
    report = await order_service.get_shipper_revenue(db, shipper.id)
    assert report["total_deliveries"] == 0
    assert float(report["pending_payout"]) == 0
    assert float(report["released_payout"]) == 0


async def test_shipper_revenue_scoped_to_single_shipper(db: AsyncSession):
    shipper_a, customer, merchant = await _seed_shipper_customer_merchant(db)
    shipper_b, _, _ = await _seed_shipper_customer_merchant(db)
    await _seed_order(db, customer, merchant, shipper_a, OrderStatus.completed, 15000, PaymentStatus.released_to_merchant)
    await _seed_order(db, customer, merchant, shipper_b, OrderStatus.completed, 99999, PaymentStatus.released_to_merchant)

    report = await order_service.get_shipper_revenue(db, shipper_a.id)
    assert report["total_deliveries"] == 1
    assert float(report["released_payout"]) == 15000
