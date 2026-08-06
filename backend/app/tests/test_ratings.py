import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderSource, OrderStatus
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.modules.auth.models import Customer, User
from app.modules.catalog.models import Merchant
from app.modules.orders.models import Order
from app.modules.ratings import service as ratings_service
from app.modules.ratings.schemas import RatingCreate
from app.modules.shippers.models import Shipper
from app.tests.conftest import unique_email


async def _seed(db: AsyncSession, order_status: OrderStatus, with_shipper: bool = True):
    customer_user = User(email=unique_email("cust"), password_hash="x", role="customer")
    merchant_user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    shipper_user = User(email=unique_email("ship"), password_hash="x", role="shipper")
    db.add_all([customer_user, merchant_user, shipper_user])
    await db.flush()

    customer = Customer(user_id=customer_user.id, name="Cust")
    merchant = Merchant(user_id=merchant_user.id, name="Merch", address="addr", status="active")
    shipper = Shipper(user_id=shipper_user.id, rating=5.0)
    db.add_all([customer, merchant, shipper])
    await db.flush()

    order = Order(
        source=OrderSource.customer_placed,
        customer_id=customer.id,
        merchant_id=merchant.id,
        shipper_id=shipper.id if with_shipper else None,
        status=order_status,
        pickup_addr={"lat": 0, "lng": 0, "address": "a"},
        dropoff_addr={"lat": 0, "lng": 0, "address": "b"},
        subtotal=100,
    )
    db.add(order)
    await db.commit()
    return customer, shipper, order


async def test_create_rating_succeeds_for_completed_order(db: AsyncSession):
    customer, shipper, order = await _seed(db, OrderStatus.completed)

    rating = await ratings_service.create_rating(
        db, customer.id, order.id, RatingCreate(score=4, comment="Good")
    )

    assert rating.score == 4
    assert rating.shipper_id == shipper.id
    await db.refresh(shipper)
    assert float(shipper.rating) == 4.0


async def test_shipper_rating_is_the_average_across_orders(db: AsyncSession):
    customer, shipper, order1 = await _seed(db, OrderStatus.completed)
    await ratings_service.create_rating(db, customer.id, order1.id, RatingCreate(score=5))

    # second completed order, same shipper
    order2 = Order(
        source=OrderSource.customer_placed,
        customer_id=customer.id,
        merchant_id=order1.merchant_id,
        shipper_id=shipper.id,
        status=OrderStatus.completed,
        pickup_addr={"lat": 0, "lng": 0, "address": "a"},
        dropoff_addr={"lat": 0, "lng": 0, "address": "b"},
        subtotal=50,
    )
    db.add(order2)
    await db.commit()

    await ratings_service.create_rating(db, customer.id, order2.id, RatingCreate(score=3))

    await db.refresh(shipper)
    assert float(shipper.rating) == 4.0  # avg(5, 3)


async def test_cannot_rate_order_not_yet_completed(db: AsyncSession):
    customer, shipper, order = await _seed(db, OrderStatus.delivering)
    with pytest.raises(ConflictError):
        await ratings_service.create_rating(db, customer.id, order.id, RatingCreate(score=5))


async def test_cannot_rate_twice(db: AsyncSession):
    customer, shipper, order = await _seed(db, OrderStatus.completed)
    await ratings_service.create_rating(db, customer.id, order.id, RatingCreate(score=5))
    with pytest.raises(ConflictError):
        await ratings_service.create_rating(db, customer.id, order.id, RatingCreate(score=1))


async def test_cannot_rate_someone_elses_order(db: AsyncSession):
    customer, shipper, order = await _seed(db, OrderStatus.completed)
    with pytest.raises(PermissionDeniedError):
        await ratings_service.create_rating(db, uuid.uuid4(), order.id, RatingCreate(score=5))


async def test_cannot_rate_order_without_shipper(db: AsyncSession):
    customer, shipper, order = await _seed(db, OrderStatus.completed, with_shipper=False)
    with pytest.raises(ConflictError):
        await ratings_service.create_rating(db, customer.id, order.id, RatingCreate(score=5))


async def test_rate_nonexistent_order_raises_not_found(db: AsyncSession):
    customer, shipper, order = await _seed(db, OrderStatus.completed)
    with pytest.raises(NotFoundError):
        await ratings_service.create_rating(db, customer.id, uuid.uuid4(), RatingCreate(score=5))


async def test_score_out_of_range_rejected_by_schema():
    with pytest.raises(Exception):
        RatingCreate(score=6)
    with pytest.raises(Exception):
        RatingCreate(score=0)


async def test_rating_without_merchant_score_leaves_merchant_rating_untouched(db: AsyncSession):
    customer, shipper, order = await _seed(db, OrderStatus.completed)
    merchant = await db.get(Merchant, order.merchant_id)
    default_rating = float(merchant.rating)

    rating = await ratings_service.create_rating(
        db, customer.id, order.id, RatingCreate(score=5)
    )

    assert rating.merchant_id == order.merchant_id
    assert rating.merchant_score is None
    await db.refresh(merchant)
    assert float(merchant.rating) == default_rating


async def test_merchant_rating_is_set_from_first_merchant_score(db: AsyncSession):
    customer, shipper, order = await _seed(db, OrderStatus.completed)

    rating = await ratings_service.create_rating(
        db, customer.id, order.id, RatingCreate(score=5, merchant_score=4, merchant_comment="Ngon")
    )

    assert rating.merchant_score == 4
    assert rating.merchant_comment == "Ngon"
    merchant = await db.get(Merchant, order.merchant_id)
    assert float(merchant.rating) == 4.0


async def test_merchant_rating_is_the_average_across_orders(db: AsyncSession):
    customer, shipper, order1 = await _seed(db, OrderStatus.completed)
    await ratings_service.create_rating(
        db, customer.id, order1.id, RatingCreate(score=5, merchant_score=5)
    )

    order2 = Order(
        source=OrderSource.customer_placed,
        customer_id=customer.id,
        merchant_id=order1.merchant_id,
        shipper_id=shipper.id,
        status=OrderStatus.completed,
        pickup_addr={"lat": 0, "lng": 0, "address": "a"},
        dropoff_addr={"lat": 0, "lng": 0, "address": "b"},
        subtotal=50,
    )
    db.add(order2)
    await db.commit()

    await ratings_service.create_rating(
        db, customer.id, order2.id, RatingCreate(score=3, merchant_score=3)
    )

    merchant = await db.get(Merchant, order1.merchant_id)
    assert float(merchant.rating) == 4.0  # avg(5, 3)
