import uuid

from sqlalchemy import ForeignKey, SmallInteger, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class Rating(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "ratings"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id"), unique=True, index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), index=True
    )
    shipper_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shippers.id"), index=True
    )
    score: Mapped[int] = mapped_column(SmallInteger)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Merchant side of the same one-rating-per-order flow. merchant_score is
    # nullable (not every historical row has one, and the schema keeps it
    # optional) but merchant_id is always set from order.merchant_id so
    # aggregate queries never need to join back through orders.
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("merchants.id"), index=True
    )
    merchant_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    merchant_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
