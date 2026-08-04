import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderStatus
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.modules.orders.models import Order
from app.modules.ratings.models import Rating
from app.modules.ratings.schemas import RatingCreate
from app.modules.shippers.models import Shipper


async def get_rating_for_order(db: AsyncSession, order_id: uuid.UUID) -> Rating | None:
    return await db.scalar(select(Rating).where(Rating.order_id == order_id))


async def create_rating(
    db: AsyncSession, customer_id: uuid.UUID, order_id: uuid.UUID, payload: RatingCreate
) -> Rating:
    order = await db.get(Order, order_id)
    if order is None:
        raise NotFoundError("Order not found")
    if order.customer_id != customer_id:
        raise PermissionDeniedError("Not your order")
    if order.status != OrderStatus.completed:
        raise ConflictError("Can only rate an order after it has been completed")
    if order.shipper_id is None:
        raise ConflictError("Order has no assigned shipper to rate")
    if await get_rating_for_order(db, order_id) is not None:
        raise ConflictError("This order has already been rated")

    rating = Rating(
        order_id=order_id,
        customer_id=customer_id,
        shipper_id=order.shipper_id,
        score=payload.score,
        comment=payload.comment,
    )
    db.add(rating)
    await db.flush()

    avg_score = await db.scalar(
        select(func.avg(Rating.score)).where(Rating.shipper_id == order.shipper_id)
    )
    shipper = await db.get(Shipper, order.shipper_id)
    if shipper is not None and avg_score is not None:
        shipper.rating = round(float(avg_score), 2)

    await db.commit()
    await db.refresh(rating)
    return rating
