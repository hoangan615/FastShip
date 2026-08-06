from sqlalchemy import Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class PlatformSettings(TimestampMixin, Base):
    """Singleton row (id is always 1) holding platform-wide, ops-adjustable
    shipping-fee parameters: shipping_fee = shipping_base_fee +
    shipping_per_km_rate * distance_km (see app.core.geo.haversine_km).
    """

    __tablename__ = "platform_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    shipping_base_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=15000)
    shipping_per_km_rate: Mapped[float] = mapped_column(Numeric(12, 2), default=4000)
