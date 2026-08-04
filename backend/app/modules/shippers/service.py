import uuid
from datetime import datetime, timezone

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ShipperStatus
from app.core.exceptions import NotFoundError
from app.modules.matching.redis_keys import SHIPPERS_GEO_KEY, shipper_status_key
from app.modules.shippers.models import Shipper


async def get_shipper_for_user(db: AsyncSession, user_id: uuid.UUID) -> Shipper:
    shipper = await db.scalar(select(Shipper).where(Shipper.user_id == user_id))
    if shipper is None:
        raise NotFoundError("Shipper profile not found for this user")
    return shipper


async def set_status(
    db: AsyncSession, redis: Redis, shipper: Shipper, status: ShipperStatus
) -> Shipper:
    shipper.status = status
    await db.commit()
    if status == ShipperStatus.available:
        await redis.set(shipper_status_key(shipper.id), str(status))
    else:
        await redis.set(shipper_status_key(shipper.id), str(status))
        if status != ShipperStatus.available:
            await redis.zrem(SHIPPERS_GEO_KEY, str(shipper.id))
    return shipper


async def update_location(
    db: AsyncSession, redis: Redis, shipper: Shipper, lat: float, lng: float
) -> Shipper:
    shipper.current_lat = lat
    shipper.current_lng = lng
    shipper.last_heartbeat_at = datetime.now(timezone.utc)
    await db.commit()

    await redis.geoadd(SHIPPERS_GEO_KEY, (lng, lat, str(shipper.id)))
    if shipper.status == ShipperStatus.available:
        await redis.set(shipper_status_key(shipper.id), str(ShipperStatus.available))
    return shipper


async def mark_offline(db: AsyncSession, redis: Redis, shipper: Shipper) -> Shipper:
    shipper.status = ShipperStatus.offline
    await db.commit()
    await redis.set(shipper_status_key(shipper.id), str(ShipperStatus.offline))
    await redis.zrem(SHIPPERS_GEO_KEY, str(shipper.id))
    return shipper
