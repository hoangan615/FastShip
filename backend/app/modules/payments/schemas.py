import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.core.enums import PaymentMethod, PaymentStatus


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    method: PaymentMethod
    status: PaymentStatus
    amount: Decimal
    held_at: datetime | None
    release_due_at: datetime | None
    released_at: datetime | None
    refunded_at: datetime | None
    dispute_reason: str | None


class DisputeRequest(BaseModel):
    reason: str


class ResolveDisputeRequest(BaseModel):
    release: bool  # True -> release to merchant, False -> refund customer
