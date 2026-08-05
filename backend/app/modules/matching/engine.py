import uuid
from datetime import datetime, timezone

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.enums import MatchOfferResult, OrderEventType, ShipperStatus
from app.core.exceptions import ConflictError
from app.modules.matching.locking import acquire_lock, lock_holder, release_lock
from app.modules.matching.models import MatchOffer
from app.modules.matching.redis_keys import (
    SHIPPERS_GEO_KEY,
    match_excluded_key,
    match_offer_current_shipper_key,
    shipper_score_key,
    shipper_status_key,
)
from app.modules.matching.scoring import compute_final_score
from app.modules.notifications.service import send_notification
from app.modules.orders.models import Order, OrderEvent
from app.modules.orders.state_machine import OrderTransitionEvent, apply_transition
from app.modules.shippers.models import Shipper

settings = get_settings()


async def _candidate_shippers(
    redis: Redis, lat: float, lng: float, radius_km: float
) -> list[tuple[str, float]]:
    results = await redis.geosearch(
        SHIPPERS_GEO_KEY,
        longitude=lng,
        latitude=lat,
        radius=radius_km,
        unit="km",
        sort="ASC",
        withdist=True,
    )
    return [(member, float(dist)) for member, dist in results]


async def _rank_candidates(
    redis: Redis, order_id: uuid.UUID, candidates: list[tuple[str, float]]
) -> list[tuple[str, float]]:
    excluded = await redis.smembers(match_excluded_key(order_id))
    scored: list[tuple[str, float]] = []
    for shipper_id_str, distance_km in candidates:
        if shipper_id_str in excluded:
            continue
        status = await redis.get(shipper_status_key(uuid.UUID(shipper_id_str)))
        if status != str(ShipperStatus.available):
            continue
        cached = await redis.get(shipper_score_key(uuid.UUID(shipper_id_str)))
        composite = float(cached) if cached is not None else 0.0
        final_score = compute_final_score(distance_km, settings.match_radius_km, composite)
        scored.append((shipper_id_str, final_score))
    scored.sort(key=lambda t: t[1], reverse=True)
    return scored


async def find_and_offer(db: AsyncSession, redis: Redis, order_id: uuid.UUID) -> Shipper | None:
    """Rank available shippers by score and offer to the single highest
    scorer, using a Redis SETNX lock per shipper to guarantee only one
    order can hold an active offer for a given shipper at a time. On lock
    contention (another order already offering to this shipper), falls
    through to the next-ranked candidate. Order remains `pending` in the
    DB throughout — only a shipper's *acceptance* advances it to
    `assigned` — so repeated declines/timeouts don't churn the DB.
    """
    order = await db.get(Order, order_id)
    if order is None:
        return None

    lat = order.pickup_addr.get("lat")
    lng = order.pickup_addr.get("lng")
    if lat is None or lng is None:
        return None

    candidates = await _candidate_shippers(redis, float(lat), float(lng), settings.match_radius_km)
    ranked = await _rank_candidates(redis, order_id, candidates)

    for shipper_id_str, score in ranked:
        shipper_id = uuid.UUID(shipper_id_str)
        locked = await acquire_lock(redis, shipper_id, order_id, settings.match_lock_ttl_seconds)
        if not locked:
            continue

        shipper = await db.get(Shipper, shipper_id)
        if shipper is None or shipper.status != ShipperStatus.available:
            await release_lock(redis, shipper_id, order_id)
            continue

        now = datetime.now(timezone.utc)
        await redis.set(match_offer_current_shipper_key(order_id), shipper_id_str)

        db.add(
            MatchOffer(
                order_id=order_id,
                shipper_id=shipper_id,
                offered_at=now,
                result=MatchOfferResult.offered,
                score_snapshot=score,
            )
        )
        db.add(
            OrderEvent(
                order_id=order_id,
                event_type=OrderEventType.match_offered,
                actor_role="system",
                actor_id=None,
                timestamp=now,
                payload={"shipper_id": shipper_id_str, "score": score},
            )
        )
        await db.commit()

        from app.modules.tracking.ws_manager import emit_to_room

        await emit_to_room(
            f"shipper:{shipper_id}",
            "match.offer_received",
            {
                "order_id": str(order_id),
                "expires_in": settings.offer_timeout_seconds,
            },
        )
        send_notification(shipper_id, "New delivery offer", f"Order #{order_id} nearby, respond within {settings.offer_timeout_seconds}s")

        from app.workers.tasks_matching import offer_timeout

        offer_timeout.apply_async(
            args=[str(order_id), str(shipper_id)],
            countdown=settings.offer_timeout_seconds,
        )

        return shipper

    # exhausted every candidate: leave order pending, alert ops for manual intervention
    event = apply_transition(order, OrderTransitionEvent.match_exhausted, "system", None)
    db.add(event)
    await db.commit()

    from app.modules.tracking.ws_manager import emit_to_room

    await emit_to_room("ops:dashboard", "match.exhausted", {"order_id": str(order_id)})
    return None


async def _latest_offer(db: AsyncSession, order_id: uuid.UUID, shipper_id: uuid.UUID) -> MatchOffer | None:
    return await db.scalar(
        select(MatchOffer)
        .where(MatchOffer.order_id == order_id, MatchOffer.shipper_id == shipper_id)
        .order_by(MatchOffer.offered_at.desc())
        .limit(1)
    )


async def accept_offer(db: AsyncSession, redis: Redis, order_id: uuid.UUID, shipper_id: uuid.UUID) -> Order:
    current = await redis.get(match_offer_current_shipper_key(order_id))
    holder = await lock_holder(redis, shipper_id)
    if current != str(shipper_id) or holder != str(order_id):
        raise ConflictError("This offer is no longer valid (expired, declined, or already resolved)")

    order = await db.get(Order, order_id)
    shipper = await db.get(Shipper, shipper_id)
    if order is None or shipper is None:
        raise ConflictError("Order or shipper not found")

    event = apply_transition(order, OrderTransitionEvent.match_assigned, "shipper", shipper_id)
    db.add(event)
    order.shipper_id = shipper_id
    shipper.status = ShipperStatus.busy
    shipper.active_order_id = order_id

    offer = await _latest_offer(db, order_id, shipper_id)
    if offer is not None:
        offer.result = MatchOfferResult.accepted
        offer.responded_at = datetime.now(timezone.utc)

    await db.commit()

    await release_lock(redis, shipper_id, order_id)
    await redis.delete(match_offer_current_shipper_key(order_id))
    await redis.set(shipper_status_key(shipper_id), str(ShipperStatus.busy))

    from app.modules.tracking.ws_manager import broadcast_order_status

    await broadcast_order_status(order)
    send_notification(order.customer_id, "Shipper assigned", f"A shipper has been assigned to order #{order_id}")
    send_notification(order.merchant_id, "Shipper assigned", f"A shipper has been assigned to order #{order_id}")

    return order


async def decline_offer(
    db: AsyncSession, redis: Redis, order_id: uuid.UUID, shipper_id: uuid.UUID
) -> None:
    await resolve_unaccepted_offer(db, redis, order_id, shipper_id, MatchOfferResult.declined)


async def resolve_unaccepted_offer(
    db: AsyncSession,
    redis: Redis,
    order_id: uuid.UUID,
    shipper_id: uuid.UUID,
    result: MatchOfferResult,
) -> None:
    """Shared logic for shipper decline and offer-timeout: if this offer
    is still the live one (i.e. not already accepted/superseded), release
    the shipper lock, exclude the shipper from future ranking for this
    order, and re-run matching for the next candidate. A no-op if the
    offer was already resolved by a concurrent accept.
    """
    current = await redis.get(match_offer_current_shipper_key(order_id))
    if current != str(shipper_id):
        return

    offer = await _latest_offer(db, order_id, shipper_id)
    if offer is not None and offer.result == MatchOfferResult.offered:
        offer.result = result
        offer.responded_at = datetime.now(timezone.utc)
        await db.commit()

    await release_lock(redis, shipper_id, order_id)
    await redis.sadd(match_excluded_key(order_id), str(shipper_id))
    await redis.delete(match_offer_current_shipper_key(order_id))

    await find_and_offer(db, redis, order_id)
