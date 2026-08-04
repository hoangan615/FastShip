import uuid

from pydantic import BaseModel


class OfferActionRequest(BaseModel):
    order_id: uuid.UUID


class OfferActionResponse(BaseModel):
    order_id: uuid.UUID
    status: str
