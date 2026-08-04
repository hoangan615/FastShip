from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.enums import PaymentMethod, PaymentStatus
from app.modules.auth.models import Customer, User
from app.modules.catalog.models import Merchant, Product
from app.modules.orders import service as order_service
from app.modules.orders.schemas import Address, OrderCreate, OrderItemIn
from app.modules.payments import service as payments_service
from app.tests.conftest import unique_email

settings = get_settings()


async def _seed_customer_and_product(db: AsyncSession, price: float = 10000, stock: int = 5):
    customer_user = User(email=unique_email("cust"), password_hash="x", role="customer")
    merchant_user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    db.add_all([customer_user, merchant_user])
    await db.flush()

    customer = Customer(user_id=customer_user.id, name="Cust")
    merchant = Merchant(user_id=merchant_user.id, name="Merch", address="addr", status="active")
    db.add_all([customer, merchant])
    await db.flush()

    product = Product(merchant_id=merchant.id, name="Widget", price=price, stock_qty=stock, status="active")
    db.add(product)
    await db.commit()
    return customer, merchant, product


async def test_create_order_sets_sla_deadline(db: AsyncSession):
    customer, merchant, product = await _seed_customer_and_product(db)

    before = datetime.now(timezone.utc)
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

    assert order.sla_deadline is not None
    expected = before + timedelta(minutes=settings.sla_minutes)
    # allow a couple seconds of test-execution slack
    assert abs((order.sla_deadline - expected).total_seconds()) < 5


async def test_create_order_snapshots_price_independent_of_later_changes(db: AsyncSession):
    customer, merchant, product = await _seed_customer_and_product(db, price=10000)

    order = await order_service.create_order(
        db,
        customer.id,
        OrderCreate(
            merchant_id=merchant.id,
            items=[OrderItemIn(product_id=product.id, qty=2)],
            pickup_addr=Address(address="a", lat=10.0, lng=106.0),
            dropoff_addr=Address(address="b", lat=10.01, lng=106.0),
            payment_method=PaymentMethod.wallet,
        ),
    )
    assert float(order.subtotal) == 20000

    # merchant changes the price after the order was placed
    product.price = 99999
    await db.commit()

    payment = await payments_service.get_payment_for_order(db, order.id)
    assert float(payment.amount) == 20000
    assert payment.status == PaymentStatus.held


async def test_create_order_charges_escrow_immediately_for_wallet(db: AsyncSession):
    customer, merchant, product = await _seed_customer_and_product(db)

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

    payment = await payments_service.get_payment_for_order(db, order.id)
    assert payment.status == PaymentStatus.held
    assert payment.held_at is not None


async def test_create_order_cod_does_not_charge_immediately(db: AsyncSession):
    customer, merchant, product = await _seed_customer_and_product(db)

    order = await order_service.create_order(
        db,
        customer.id,
        OrderCreate(
            merchant_id=merchant.id,
            items=[OrderItemIn(product_id=product.id, qty=1)],
            pickup_addr=Address(address="a", lat=10.0, lng=106.0),
            dropoff_addr=Address(address="b", lat=10.01, lng=106.0),
            payment_method=PaymentMethod.cod,
            cod_amount=10000,
        ),
    )

    payment = await payments_service.get_payment_for_order(db, order.id)
    assert payment.status == PaymentStatus.pending
    assert payment.held_at is None
