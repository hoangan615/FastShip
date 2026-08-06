import uuid

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import ProductStatus
from app.db.base import Base, TimestampMixin, UUIDPKMixin


class Merchant(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "merchants"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True
    )
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(32), default="active")
    # Platform commission on this merchant's product revenue (0.10 = 10%), ops-adjustable.
    commission_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.10)
    # Average of Rating.merchant_score across all orders that rated this merchant.
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=5.0)


class Product(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "products"

    merchant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("merchants.id"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    price: Mapped[float] = mapped_column(Numeric(12, 2))
    stock_qty: Mapped[int] = mapped_column(default=0)
    status: Mapped[ProductStatus] = mapped_column(
        SAEnum(ProductStatus, name="product_status"), default=ProductStatus.active
    )
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
