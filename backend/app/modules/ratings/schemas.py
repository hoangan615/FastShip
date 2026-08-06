import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RatingCreate(BaseModel):
    score: int = Field(ge=1, le=5)
    comment: str | None = None
    merchant_score: int | None = Field(default=None, ge=1, le=5)
    merchant_comment: str | None = None


class RatingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    shipper_id: uuid.UUID
    score: int
    comment: str | None
    merchant_id: uuid.UUID
    merchant_score: int | None
    merchant_comment: str | None
    created_at: datetime
