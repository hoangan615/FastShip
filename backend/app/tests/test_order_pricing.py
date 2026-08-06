from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import PaymentMethod
from app.core.geo import haversine_km
from app.modules.auth.models import Customer, User
from app.modules.catalog.models import Merchant, Product
from app.modules.ops import service as ops_service
from app.modules.orders import service as order_service
from app.modules.orders.schemas import Address, OrderCreate, OrderItemIn
from app.modules.payments import service as payments_service
from app.tests.conftest import unique_email


async def _seed_customer_and_product(
    db: AsyncSession, price: float = 10000, stock: int = 5, commission_rate: float = 0.10
):
    customer_user = User(email=unique_email("cust"), password_hash="x", role="customer")
    merchant_user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    db.add_all([customer_user, merchant_user])
    await db.flush()

    customer = Customer(user_id=customer_user.id, name="Cust")
    merchant = Merchant(
        user_id=merchant_user.id, name="Merch", address="addr", status="active", commission_rate=commission_rate
    )
    db.add_all([customer, merchant])
    await db.flush()

    product = Product(merchant_id=merchant.id, name="Widget", price=price, stock_qty=stock, status="active")
    db.add(product)
    await db.commit()
    return customer, merchant, product


def test_haversine_zero_distance_for_same_point():
    assert haversine_km(10.0, 106.0, 10.0, 106.0) == 0


def test_haversine_known_distance():
    # Roughly 1 degree of latitude ~= 111km
    distance = haversine_km(10.0, 106.0, 11.0, 106.0)
    assert 110 < distance < 112


async def test_shipping_fee_uses_default_platform_settings(db: AsyncSession):
    settings = await ops_service.get_platform_settings(db)
    assert float(settings.shipping_base_fee) == 15000
    assert float(settings.shipping_per_km_rate) == 4000

    fee, distance_km = await order_service.compute_shipping_fee(
        db,
        Address(address="a", lat=10.0, lng=106.0),
        Address(address="b", lat=10.0, lng=106.0),
    )
    assert distance_km == 0
    assert fee == Decimal("15000")


async def test_shipping_fee_scales_with_distance(db: AsyncSession):
    fee, distance_km = await order_service.compute_shipping_fee(
        db,
        Address(address="a", lat=10.0, lng=106.0),
        Address(address="b", lat=11.0, lng=106.0),
    )
    expected = Decimal("15000") + Decimal("4000") * Decimal(str(round(distance_km, 3)))
    assert fee == expected.quantize(Decimal("1"))


async def test_shipping_fee_respects_updated_platform_settings(db: AsyncSession):
    await ops_service.update_platform_settings(db, Decimal("20000"), Decimal("5000"))
    fee, _distance_km = await order_service.compute_shipping_fee(
        db,
        Address(address="a", lat=10.0, lng=106.0),
        Address(address="b", lat=10.0, lng=106.0),
    )
    assert fee == Decimal("20000")


async def test_create_order_splits_payout_by_merchant_commission(db: AsyncSession):
    customer, merchant, product = await _seed_customer_and_product(
        db, price=10000, commission_rate=0.10
    )

    order = await order_service.create_order(
        db,
        customer.id,
        OrderCreate(
            merchant_id=merchant.id,
            items=[OrderItemIn(product_id=product.id, qty=2)],
            pickup_addr=Address(address="a", lat=10.0, lng=106.0),
            dropoff_addr=Address(address="b", lat=10.0, lng=106.0),
            payment_method=PaymentMethod.wallet,
        ),
    )

    assert float(order.subtotal) == 20000
    assert float(order.shipping_fee) == 15000  # same point -> base fee only
    assert float(order.commission_rate) == 0.10
    assert float(order.merchant_payout) == 18000  # 20000 * (1 - 0.10)
    assert float(order.shipper_payout) == 15000  # 100% of shipping fee

    payment = await payments_service.get_payment_for_order(db, order.id)
    assert float(payment.amount) == 35000  # subtotal + shipping_fee


async def test_create_order_zero_commission_gives_merchant_full_subtotal(db: AsyncSession):
    customer, merchant, product = await _seed_customer_and_product(
        db, price=10000, commission_rate=0
    )

    order = await order_service.create_order(
        db,
        customer.id,
        OrderCreate(
            merchant_id=merchant.id,
            items=[OrderItemIn(product_id=product.id, qty=1)],
            pickup_addr=Address(address="a", lat=10.0, lng=106.0),
            dropoff_addr=Address(address="b", lat=10.0, lng=106.0),
            payment_method=PaymentMethod.wallet,
        ),
    )
    assert float(order.merchant_payout) == float(order.subtotal)


async def test_order_commission_rate_is_snapshotted_at_creation(db: AsyncSession):
    """A later change to the merchant's commission_rate must not retroactively
    change an already-placed order's stored commission_rate/merchant_payout.
    """
    customer, merchant, product = await _seed_customer_and_product(
        db, price=10000, commission_rate=0.10
    )
    order = await order_service.create_order(
        db,
        customer.id,
        OrderCreate(
            merchant_id=merchant.id,
            items=[OrderItemIn(product_id=product.id, qty=1)],
            pickup_addr=Address(address="a", lat=10.0, lng=106.0),
            dropoff_addr=Address(address="b", lat=10.0, lng=106.0),
            payment_method=PaymentMethod.wallet,
        ),
    )
    assert float(order.commission_rate) == 0.10

    merchant.commission_rate = 0.20
    await db.commit()
    await db.refresh(order)

    assert float(order.commission_rate) == 0.10
    assert float(order.merchant_payout) == 9000
