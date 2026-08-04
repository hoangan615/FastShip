from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.core.enums import UserRole
from app.db.redis import get_redis
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.matching import engine
from app.modules.matching.schemas import OfferActionRequest, OfferActionResponse
from app.modules.shippers.service import get_shipper_for_user

router = APIRouter(prefix="/matching", tags=["matching"])


@router.post("/offers/accept", response_model=OfferActionResponse)
async def accept_offer(
    payload: OfferActionRequest,
    user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    shipper = await get_shipper_for_user(db, user.id)
    order = await engine.accept_offer(db, redis, payload.order_id, shipper.id)
    return OfferActionResponse(order_id=order.id, status=str(order.status))


@router.post("/offers/decline", response_model=OfferActionResponse)
async def decline_offer(
    payload: OfferActionRequest,
    user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    shipper = await get_shipper_for_user(db, user.id)
    await engine.decline_offer(db, redis, payload.order_id, shipper.id)
    return OfferActionResponse(order_id=payload.order_id, status="declined")
