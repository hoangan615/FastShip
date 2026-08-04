from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.core.enums import UserRole
from app.db.redis import get_redis
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.shippers import service
from app.modules.shippers.schemas import LocationPing, ShipperOut, StatusUpdate

router = APIRouter(prefix="/shippers", tags=["shippers"])


@router.get("/me", response_model=ShipperOut)
async def get_me(
    user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_shipper_for_user(db, user.id)


@router.post("/me/status", response_model=ShipperOut)
async def set_status(
    payload: StatusUpdate,
    user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    shipper = await service.get_shipper_for_user(db, user.id)
    return await service.set_status(db, redis, shipper, payload.status)


@router.post("/me/location", response_model=ShipperOut)
async def ping_location(
    payload: LocationPing,
    user: User = Depends(require_role(UserRole.shipper)),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    shipper = await service.get_shipper_for_user(db, user.id)
    return await service.update_location(db, redis, shipper, payload.lat, payload.lng)
