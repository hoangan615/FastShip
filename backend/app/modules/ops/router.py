import uuid

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.core.enums import UserRole
from app.db.redis import get_redis
from app.db.session import get_db
from app.modules.ops import service
from app.modules.ops.schemas import (
    ComplaintOut,
    HeatmapCell,
    LiveOrderOut,
    ResolvePaymentRequest,
    SummaryReport,
)
from app.modules.payments.schemas import PaymentOut

router = APIRouter(prefix="/ops", tags=["ops"], dependencies=[Depends(require_role(UserRole.ops))])


@router.get("/orders/live", response_model=list[LiveOrderOut])
async def orders_live(db: AsyncSession = Depends(get_db)):
    return await service.list_live_orders(db)


@router.get("/heatmap", response_model=list[HeatmapCell])
async def heatmap(redis: Redis = Depends(get_redis)):
    return await service.heatmap(redis)


@router.get("/complaints", response_model=list[ComplaintOut])
async def complaints(db: AsyncSession = Depends(get_db)):
    return await service.list_complaints(db)


@router.post("/orders/{order_id}/reassign")
async def reassign(order_id: uuid.UUID, db: AsyncSession = Depends(get_db), redis: Redis = Depends(get_redis)):
    shipper = await service.manual_reassign(db, redis, order_id)
    return {"order_id": str(order_id), "offered_to_shipper_id": str(shipper.id) if shipper else None}


@router.post("/payments/{payment_id}/resolve", response_model=PaymentOut)
async def resolve_payment(
    payment_id: uuid.UUID, payload: ResolvePaymentRequest, db: AsyncSession = Depends(get_db)
):
    return await service.resolve_payment(db, payment_id, payload.release)


@router.get("/reports/summary", response_model=SummaryReport)
async def reports_summary(db: AsyncSession = Depends(get_db)):
    return await service.summary_report(db)
