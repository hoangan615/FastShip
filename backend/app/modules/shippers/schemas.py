import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.core.enums import ShipperStatus, VehicleType


class ShipperOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: ShipperStatus
    current_lat: Decimal | None
    current_lng: Decimal | None
    rating: Decimal
    vehicle_type: VehicleType
    active_order_id: uuid.UUID | None


class StatusUpdate(BaseModel):
    status: ShipperStatus


class LocationPing(BaseModel):
    lat: float
    lng: float
