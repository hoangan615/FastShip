import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.core.enums import OrderStatus, PaymentStatus


class LiveOrderOut(BaseModel):
    id: uuid.UUID
    status: OrderStatus
    merchant_id: uuid.UUID
    customer_id: uuid.UUID
    shipper_id: uuid.UUID | None
    created_at: datetime
    sla_deadline: datetime | None


class HeatmapCell(BaseModel):
    lat_bucket: float
    lng_bucket: float
    shipper_count: int


class ComplaintOut(BaseModel):
    order_id: uuid.UUID
    payment_id: uuid.UUID | None
    reason: str
    status: str


class ResolvePaymentRequest(BaseModel):
    release: bool


class SummaryReport(BaseModel):
    total_orders: int
    completed_orders: int
    failed_orders: int
    active_orders: int
    total_revenue: Decimal
    disputed_payments: int


class PlatformSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shipping_base_fee: Decimal
    shipping_per_km_rate: Decimal


class PlatformSettingsUpdate(BaseModel):
    shipping_base_fee: Decimal | None = None
    shipping_per_km_rate: Decimal | None = None


class MerchantAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    status: str
    commission_rate: Decimal


class CommissionUpdate(BaseModel):
    commission_rate: Decimal
