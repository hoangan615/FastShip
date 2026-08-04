import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.core.enums import UserRole
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.payments import service
from app.modules.payments.schemas import DisputeRequest, PaymentOut

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/order/{order_id}", response_model=PaymentOut)
async def get_payment_for_order(order_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await service.get_payment_for_order(db, order_id)


@router.post("/order/{order_id}/dispute", response_model=PaymentOut)
async def raise_dispute(
    order_id: uuid.UUID,
    payload: DisputeRequest,
    user: User = Depends(require_role(UserRole.customer, UserRole.ops)),
    db: AsyncSession = Depends(get_db),
):
    return await service.raise_dispute(db, order_id, payload.reason)


@router.post("/{payment_id}/cod-reconcile", response_model=PaymentOut)
async def cod_reconcile(
    payment_id: uuid.UUID,
    user: User = Depends(require_role(UserRole.ops)),
    db: AsyncSession = Depends(get_db),
):
    return await service.cod_reconcile(db, payment_id)
