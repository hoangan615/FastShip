import uuid
from datetime import datetime, timezone
from decimal import Decimal

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderStatus, PaymentStatus
from app.modules.matching.engine import find_and_offer
from app.modules.matching.redis_keys import SHIPPERS_GEO_KEY, match_excluded_key
from app.modules.orders.models import Order
from app.modules.payments import service as payments_service
from app.modules.payments.models import Payment
from app.modules.shippers.models import Shipper

TERMINAL_STATUSES = (
    OrderStatus.completed,
    OrderStatus.failed,
    OrderStatus.cancelled,
    OrderStatus.rejected,
)


async def list_live_orders(db: AsyncSession) -> list[Order]:
    result = await db.scalars(
        select(Order).where(Order.status.notin_(TERMINAL_STATUSES)).order_by(Order.created_at.desc())
    )
    return list(result.all())


async def heatmap(redis: Redis) -> list[dict]:
    """Simple grid-bucketed shipper density: round each shipper's geo
    position to ~1km buckets and count. Good enough for a dashboard
    heatmap without needing a GIS layer.
    """
    member_ids = await redis.zrange(SHIPPERS_GEO_KEY, 0, -1)
    if not member_ids:
        return []
    positions = await redis.geopos(SHIPPERS_GEO_KEY, *member_ids)

    buckets: dict[tuple[float, float], int] = {}
    for coords in positions:
        if coords is None:
            continue
        lng, lat = coords
        key = (round(float(lat), 2), round(float(lng), 2))
        buckets[key] = buckets.get(key, 0) + 1
    return [
        {"lat_bucket": lat, "lng_bucket": lng, "shipper_count": count}
        for (lat, lng), count in buckets.items()
    ]


async def list_complaints(db: AsyncSession) -> list[dict]:
    disputed = await db.scalars(select(Payment).where(Payment.status == PaymentStatus.disputed))
    complaints = [
        {
            "order_id": p.order_id,
            "payment_id": p.id,
            "reason": p.dispute_reason or "payment disputed",
            "status": "payment_disputed",
        }
        for p in disputed
    ]

    now = datetime.now(timezone.utc)
    sla_breached = await db.scalars(
        select(Order).where(
            Order.status.notin_(TERMINAL_STATUSES),
            Order.sla_deadline.isnot(None),
            Order.sla_deadline < now,
        )
    )
    for order in sla_breached:
        complaints.append(
            {
                "order_id": order.id,
                "payment_id": None,
                "reason": "SLA deadline breached",
                "status": "sla_breach",
            }
        )
    return complaints


async def manual_reassign(
    db: AsyncSession, redis: Redis, order_id: uuid.UUID, reset_excluded: bool = True
) -> Shipper | None:
    if reset_excluded:
        await redis.delete(match_excluded_key(order_id))
    return await find_and_offer(db, redis, order_id)


async def resolve_payment(db: AsyncSession, payment_id: uuid.UUID, release: bool) -> Payment:
    return await payments_service.resolve_dispute(db, payment_id, release)


async def summary_report(db: AsyncSession) -> dict:
    total_orders = await db.scalar(select(func.count()).select_from(Order)) or 0
    completed_orders = (
        await db.scalar(
            select(func.count()).select_from(Order).where(Order.status == OrderStatus.completed)
        )
        or 0
    )
    failed_orders = (
        await db.scalar(
            select(func.count()).select_from(Order).where(Order.status == OrderStatus.failed)
        )
        or 0
    )
    active_orders = (
        await db.scalar(
            select(func.count()).select_from(Order).where(Order.status.notin_(TERMINAL_STATUSES))
        )
        or 0
    )
    total_revenue = (
        await db.scalar(
            select(func.coalesce(func.sum(Order.subtotal), 0)).where(
                Order.status == OrderStatus.completed
            )
        )
        or Decimal(0)
    )
    disputed_payments = (
        await db.scalar(
            select(func.count()).select_from(Payment).where(Payment.status == PaymentStatus.disputed)
        )
        or 0
    )
    return {
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "failed_orders": failed_orders,
        "active_orders": active_orders,
        "total_revenue": total_revenue,
        "disputed_payments": disputed_payments,
    }
