import uuid

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.core.enums import UserRole
from app.db.redis import get_redis
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.auth.service import get_customer_for_user
from app.modules.catalog.service import get_merchant_for_user
from app.core.exceptions import NotFoundError
from app.modules.orders import service
from app.modules.orders.models import Order
from app.modules.orders.schemas import (
    FailRequest,
    MerchantRevenueReport,
    OrderCreate,
    OrderEventOut,
    OrderOut,
    RejectRequest,
)
from app.modules.ratings import service as ratings_service
from app.modules.ratings.schemas import RatingCreate, RatingOut
from app.modules.shippers.service import get_shipper_for_user

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderOut)
async def create_order(
    payload: OrderCreate,
    user: User = Depends(require_role(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
):
    customer = await get_customer_for_user(db, user.id)
    return await service.create_order(db, customer.id, payload)


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await service.get_order(db, order_id)


@router.get("/{order_id}/events", response_model=list[OrderEventOut])
async def get_order_events(order_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await service.list_order_events(db, order_id)


@router.get("/customer/mine", response_model=list[OrderOut])
async def list_my_customer_orders(
    user: User = Depends(require_role(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
):
    customer = await get_customer_for_user(db, user.id)
    result = await db.scalars(
        select(Order).where(Order.customer_id == customer.id).order_by(Order.created_at.desc())
    )
    return list(result.all())


@router.get("/merchant/mine", response_model=list[OrderOut])
async def list_my_merchant_orders(
    user: User = Depends(require_role(UserRole.merchant)),
    db: AsyncSession = Depends(get_db),
):
    merchant = await get_merchant_for_user(db, user.id)
    result = await db.scalars(
        select(Order).where(Order.merchant_id == merchant.id).order_by(Order.created_at.desc())
    )
    return list(result.all())


@router.get("/shipper/mine", response_model=list[OrderOut])
async def list_my_shipper_orders(
    user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    shipper = await get_shipper_for_user(db, user.id)
    result = await db.scalars(
        select(Order).where(Order.shipper_id == shipper.id).order_by(Order.created_at.desc())
    )
    return list(result.all())


@router.get("/merchant/revenue", response_model=MerchantRevenueReport)
async def get_merchant_revenue(
    user: User = Depends(require_role(UserRole.merchant)),
    db: AsyncSession = Depends(get_db),
):
    merchant = await get_merchant_for_user(db, user.id)
    return await service.get_merchant_revenue(db, merchant.id)


@router.post("/{order_id}/confirm", response_model=OrderOut)
async def confirm_order(
    order_id: uuid.UUID,
    user: User = Depends(require_role(UserRole.merchant)),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    merchant = await get_merchant_for_user(db, user.id)
    return await service.confirm_order(db, redis, merchant.id, order_id)


@router.post("/{order_id}/reject", response_model=OrderOut)
async def reject_order(
    order_id: uuid.UUID,
    payload: RejectRequest,
    user: User = Depends(require_role(UserRole.merchant)),
    db: AsyncSession = Depends(get_db),
):
    merchant = await get_merchant_for_user(db, user.id)
    return await service.reject_order(db, merchant.id, order_id, payload.reason)


@router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_order(
    order_id: uuid.UUID,
    user: User = Depends(require_role(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
):
    customer = await get_customer_for_user(db, user.id)
    return await service.cancel_order(db, customer.id, order_id)


@router.post("/{order_id}/pickup", response_model=OrderOut)
async def pickup_order(
    order_id: uuid.UUID,
    user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    shipper = await get_shipper_for_user(db, user.id)
    return await service.mark_picked_up(db, shipper.id, order_id)


@router.post("/{order_id}/start-delivery", response_model=OrderOut)
async def start_delivery(
    order_id: uuid.UUID,
    user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    shipper = await get_shipper_for_user(db, user.id)
    return await service.start_delivery(db, shipper.id, order_id)


@router.post("/{order_id}/complete", response_model=OrderOut)
async def complete_order(
    order_id: uuid.UUID,
    user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    shipper = await get_shipper_for_user(db, user.id)
    return await service.complete_order(db, shipper.id, order_id)


@router.post("/{order_id}/fail", response_model=OrderOut)
async def fail_order(
    order_id: uuid.UUID,
    payload: FailRequest,
    user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    shipper = await get_shipper_for_user(db, user.id)
    return await service.fail_order(db, shipper.id, order_id, payload.reason)


@router.post("/{order_id}/rating", response_model=RatingOut)
async def rate_order(
    order_id: uuid.UUID,
    payload: RatingCreate,
    user: User = Depends(require_role(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
):
    customer = await get_customer_for_user(db, user.id)
    return await ratings_service.create_rating(db, customer.id, order_id, payload)


@router.get("/{order_id}/rating", response_model=RatingOut)
async def get_order_rating(order_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    rating = await ratings_service.get_rating_for_order(db, order_id)
    if rating is None:
        raise NotFoundError("This order has not been rated yet")
    return rating
