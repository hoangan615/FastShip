import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.core.enums import OrderSource, OrderStatus, PaymentMethod


class Address(BaseModel):
    address: str
    lat: float
    lng: float


class OrderItemIn(BaseModel):
    product_id: uuid.UUID
    qty: int


class OrderCreate(BaseModel):
    merchant_id: uuid.UUID
    items: list[OrderItemIn]
    pickup_addr: Address
    dropoff_addr: Address
    payment_method: PaymentMethod = PaymentMethod.wallet
    cod_amount: Decimal | None = None


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    qty: int
    price_at_order: Decimal


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source: OrderSource
    customer_id: uuid.UUID
    merchant_id: uuid.UUID
    shipper_id: uuid.UUID | None
    status: OrderStatus
    pickup_addr: dict
    dropoff_addr: dict
    subtotal: Decimal
    shipping_fee: Decimal
    commission_rate: Decimal
    merchant_payout: Decimal
    shipper_payout: Decimal
    cod_amount: Decimal | None
    sla_deadline: datetime | None
    created_at: datetime
    assigned_at: datetime | None
    confirmed_at: datetime | None
    picked_up_at: datetime | None
    delivered_at: datetime | None
    cancelled_at: datetime | None


class OrderEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    actor_role: str
    actor_id: uuid.UUID | None
    timestamp: datetime
    payload: dict


class RejectRequest(BaseModel):
    reason: str | None = None


class FailRequest(BaseModel):
    reason: str | None = None


class MerchantRevenueReport(BaseModel):
    total_orders: int
    completed_orders: int
    total_revenue: Decimal
    commission_rate: Decimal
    pending_payout: Decimal
    released_payout: Decimal


class OrderQuoteRequest(BaseModel):
    pickup_addr: Address
    dropoff_addr: Address


class OrderQuoteOut(BaseModel):
    shipping_fee: Decimal
    distance_km: float
