import uuid
from datetime import datetime, timedelta, timezone

from app.workers.celery_app import celery_app
from app.workers.utils import run_task


async def offer_timeout_async(order_id: str, shipper_id: str) -> None:
    from app.core.enums import MatchOfferResult
    from app.db.redis import get_redis_client
    from app.db.session import async_session_factory
    from app.modules.matching.engine import resolve_unaccepted_offer

    redis = get_redis_client()
    try:
        async with async_session_factory() as db:
            await resolve_unaccepted_offer(
                db, redis, uuid.UUID(order_id), uuid.UUID(shipper_id), MatchOfferResult.timed_out
            )
    finally:
        await redis.aclose()


@celery_app.task(name="app.workers.tasks_matching.offer_timeout")
def offer_timeout(order_id: str, shipper_id: str) -> None:
    """Fired `offer_timeout_seconds` after an offer was made. No-ops if the
    offer was already accepted (or otherwise resolved) in the meantime —
    checked atomically against the Redis "current offer" key inside
    `resolve_unaccepted_offer`.
    """
    run_task(offer_timeout_async(order_id, shipper_id))


async def batch_update_scores_async() -> None:
    from sqlalchemy import select

    from app.config import get_settings
    from app.core.enums import MatchOfferResult, OrderStatus
    from app.db.redis import get_redis_client
    from app.db.session import async_session_factory
    from app.modules.matching.models import MatchOffer
    from app.modules.matching.redis_keys import shipper_score_key
    from app.modules.matching.scoring import cold_start_activity_score, compute_composite_score
    from app.modules.orders.models import Order
    from app.modules.shippers.models import Shipper

    settings = get_settings()
    window_start = datetime.now(timezone.utc) - timedelta(days=7)

    redis = get_redis_client()
    try:
        async with async_session_factory() as db:
            shippers = list((await db.scalars(select(Shipper))).all())
            if not shippers:
                return

            activity_values = [
                float(s.activity_score) for s in shippers if s.last_score_update_at is not None
            ]
            population_median = (
                sorted(activity_values)[len(activity_values) // 2] if activity_values else None
            )

            for shipper in shippers:
                offers = (
                    await db.scalars(
                        select(MatchOffer).where(
                            MatchOffer.shipper_id == shipper.id,
                            MatchOffer.offered_at >= window_start,
                        )
                    )
                ).all()
                total_offers = len(offers)
                accepted = sum(1 for o in offers if o.result == MatchOfferResult.accepted)
                acceptance_rate = accepted / total_offers if total_offers else 0.5

                assigned_orders = (
                    await db.scalars(
                        select(Order).where(
                            Order.shipper_id == shipper.id, Order.assigned_at >= window_start
                        )
                    )
                ).all()
                total_assigned = len(assigned_orders)
                completed = sum(1 for o in assigned_orders if o.status == OrderStatus.completed)
                completion_rate = completed / total_assigned if total_assigned else 0.5

                is_cold_start = shipper.last_score_update_at is None
                activity_score = (
                    cold_start_activity_score(population_median)
                    if is_cold_start
                    else float(shipper.activity_score)
                )

                composite = compute_composite_score(
                    acceptance_rate=acceptance_rate,
                    completion_rate=completion_rate,
                    activity_score=activity_score,
                    rating_0_5=float(shipper.rating),
                    violation_penalty=float(shipper.violation_penalty),
                )

                shipper.acceptance_rate = acceptance_rate
                shipper.completion_rate = completion_rate
                shipper.activity_score = activity_score
                shipper.last_score_update_at = datetime.now(timezone.utc)

                await redis.set(
                    shipper_score_key(shipper.id),
                    str(composite),
                    ex=settings.offer_timeout_seconds + 20 * 60,
                )

            await db.commit()
    finally:
        await redis.aclose()


@celery_app.task(name="app.workers.tasks_matching.batch_update_scores")
def batch_update_scores() -> None:
    """Recomputes each shipper's cacheable composite score (acceptance,
    completion, activity, rating minus violation penalty — everything
    except proximity, which is per-order) from a rolling 7-day window and
    refreshes both the Redis cache and the DB mirror columns.
    """
    run_task(batch_update_scores_async())
