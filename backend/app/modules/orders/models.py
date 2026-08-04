import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import OrderEventType, OrderSource, OrderStatus
from app.db.base import Base, TimestampMixin, UUIDPKMixin


class Order(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "orders"

    source: Mapped[OrderSource] = mapped_column(SAEnum(OrderSource, name="order_source"))
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), index=True
    )
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("merchants.id"), index=True
    )
    shipper_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shippers.id"), nullable=True, index=True
    )
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, name="order_status"),
        default=OrderStatus.pending_confirmation,
        index=True,
    )
    pickup_addr: Mapped[dict] = mapped_column(JSONB)
    dropoff_addr: Mapped[dict] = mapped_column(JSONB)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2))
    cod_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    sla_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    picked_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OrderItem(UUIDPKMixin, Base):
    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id"), index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"))
    qty: Mapped[int] = mapped_column()
    price_at_order: Mapped[float] = mapped_column(Numeric(12, 2))


class OrderEvent(UUIDPKMixin, Base):
    __tablename__ = "order_events"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id"), index=True
    )
    event_type: Mapped[OrderEventType] = mapped_column(
        SAEnum(OrderEventType, name="order_event_type")
    )
    actor_role: Mapped[str] = mapped_column(String(32))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
