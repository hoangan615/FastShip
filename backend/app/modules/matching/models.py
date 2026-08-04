import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import MatchOfferResult
from app.db.base import Base, UUIDPKMixin


class MatchOffer(UUIDPKMixin, Base):
    __tablename__ = "match_offers"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id"), index=True
    )
    shipper_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shippers.id"), index=True
    )
    offered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result: Mapped[MatchOfferResult] = mapped_column(
        SAEnum(MatchOfferResult, name="match_offer_result"), default=MatchOfferResult.offered
    )
    score_snapshot: Mapped[float] = mapped_column(Numeric(6, 4))
