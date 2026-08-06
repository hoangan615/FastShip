import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderSource, OrderStatus
from app.modules.auth.models import Customer, User
from app.modules.catalog import service as catalog_service
from app.modules.catalog.models import Merchant
from app.modules.catalog.schemas import ProductCreate
from app.modules.orders.models import Order, OrderItem
from app.modules.ratings.models import Rating
from app.modules.shippers.models import Shipper
from app.tests.conftest import unique_email


async def _make_customer(db: AsyncSession) -> Customer:
    user = User(email=unique_email("cust"), password_hash="x", role="customer")
    db.add(user)
    await db.flush()
    customer = Customer(user_id=user.id, name="Cust")
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


async def _make_merchant(db: AsyncSession, rating: float = 5.0) -> Merchant:
    user = User(email=unique_email("merchant"), password_hash="x", role="merchant")
    db.add(user)
    await db.flush()
    merchant = Merchant(
        user_id=user.id, name="Merch", address="Somewhere", status="active", rating=rating
    )
    db.add(merchant)
    await db.commit()
    await db.refresh(merchant)
    return merchant


async def _make_shipper(db: AsyncSession) -> Shipper:
    user = User(email=unique_email("ship"), password_hash="x", role="shipper")
    db.add(user)
    await db.flush()
    shipper = Shipper(user_id=user.id, rating=5.0)
    db.add(shipper)
    await db.commit()
    await db.refresh(shipper)
    return shipper


async def _place_order(
    db: AsyncSession, customer: Customer, merchant: Merchant, product_id: uuid.UUID
) -> Order:
    order = Order(
        source=OrderSource.customer_placed,
        customer_id=customer.id,
        merchant_id=merchant.id,
        status=OrderStatus.completed,
        pickup_addr={"lat": 0, "lng": 0, "address": "a"},
        dropoff_addr={"lat": 0, "lng": 0, "address": "b"},
        subtotal=100,
    )
    db.add(order)
    await db.flush()
    db.add(OrderItem(order_id=order.id, product_id=product_id, qty=1, price_at_order=100))
    await db.commit()
    return order


async def test_order_again_includes_products_from_liked_merchants(db: AsyncSession):
    customer = await _make_customer(db)
    merchant = await _make_merchant(db)
    product = await catalog_service.create_product(
        db, merchant.id, ProductCreate(name="Pho", price=50, stock_qty=10)
    )
    order = await _place_order(db, customer, merchant, product.id)
    shipper = await _make_shipper(db)
    db.add(
        Rating(
            order_id=order.id,
            customer_id=customer.id,
            shipper_id=shipper.id,
            score=5,
            merchant_id=merchant.id,
            merchant_score=5,
        )
    )
    await db.commit()

    result = await catalog_service.get_recommendations(db, customer.id)

    assert product.id in [p.id for p in result["order_again"]]


async def test_order_again_excludes_merchants_rated_below_threshold(db: AsyncSession):
    customer = await _make_customer(db)
    merchant = await _make_merchant(db)
    product = await catalog_service.create_product(
        db, merchant.id, ProductCreate(name="Pho", price=50, stock_qty=10)
    )
    order = await _place_order(db, customer, merchant, product.id)
    shipper = await _make_shipper(db)
    db.add(
        Rating(
            order_id=order.id,
            customer_id=customer.id,
            shipper_id=shipper.id,
            score=5,
            merchant_id=merchant.id,
            merchant_score=3,
        )
    )
    await db.commit()

    result = await catalog_service.get_recommendations(db, customer.id)

    assert result["order_again"] == []


async def test_recommended_excludes_already_tried_merchants(db: AsyncSession):
    customer = await _make_customer(db)
    tried_merchant = await _make_merchant(db, rating=5.0)
    tried_product = await catalog_service.create_product(
        db, tried_merchant.id, ProductCreate(name="Tried dish", price=50, stock_qty=10)
    )
    await _place_order(db, customer, tried_merchant, tried_product.id)

    untried_merchant = await _make_merchant(db, rating=4.5)
    untried_product = await catalog_service.create_product(
        db, untried_merchant.id, ProductCreate(name="New dish", price=50, stock_qty=10)
    )

    result = await catalog_service.get_recommendations(db, customer.id)
    recommended_ids = [p.id for p in result["recommended"]]

    assert untried_product.id in recommended_ids
    assert tried_product.id not in recommended_ids


async def test_recommended_falls_back_to_top_rated_when_all_merchants_tried(db: AsyncSession):
    customer = await _make_customer(db)
    merchant = await _make_merchant(db, rating=4.2)
    product = await catalog_service.create_product(
        db, merchant.id, ProductCreate(name="Only dish", price=50, stock_qty=10)
    )
    await _place_order(db, customer, merchant, product.id)

    result = await catalog_service.get_recommendations(db, customer.id)
    recommended_ids = [p.id for p in result["recommended"]]

    assert product.id in recommended_ids
