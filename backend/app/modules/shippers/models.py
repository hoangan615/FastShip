import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import ShipperStatus, VehicleType
from app.db.base import Base, TimestampMixin, UUIDPKMixin


class Shipper(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "shippers"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True
    )
    status: Mapped[ShipperStatus] = mapped_column(
        SAEnum(ShipperStatus, name="shipper_status"), default=ShipperStatus.offline
    )
    current_lat: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    current_lng: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=5.0)
    vehicle_type: Mapped[VehicleType] = mapped_column(
        SAEnum(VehicleType, name="vehicle_type"), default=VehicleType.motorbike
    )
    active_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", use_alter=True, name="fk_shippers_active_order_id"),
        nullable=True,
    )

    # rolling-window / matching score fields (persisted mirror of Redis cache)
    acceptance_rate: Mapped[float] = mapped_column(Numeric(4, 3), default=0.5)
    completion_rate: Mapped[float] = mapped_column(Numeric(4, 3), default=0.5)
    activity_score: Mapped[float] = mapped_column(Numeric(4, 3), default=0.5)
    violation_penalty: Mapped[float] = mapped_column(Numeric(4, 3), default=0.0)
    last_score_update_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
