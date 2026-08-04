import asyncio
from datetime import datetime, timezone

from app.workers.celery_app import celery_app


async def release_due_escrow_async() -> None:
    """Releases every `held` payment whose `release_due_at` buffer has
    passed, the order is `completed`, and there is no open dispute. Split
    out from the Celery task below so tests can `await` it directly
    instead of going through `asyncio.run` (which can't be nested inside
    an already-running test event loop).
    """
    from sqlalchemy import select

    from app.core.enums import OrderStatus, PaymentStatus
    from app.db.session import async_session_factory
    from app.modules.orders.models import Order
    from app.modules.payments.models import Payment
    from app.modules.payments.state_machine import PaymentTransitionEvent, apply_transition

    now = datetime.now(timezone.utc)
    async with async_session_factory() as db:
        stmt = (
            select(Payment)
            .join(Order, Order.id == Payment.order_id)
            .where(
                Payment.status == PaymentStatus.held,
                Payment.release_due_at.isnot(None),
                Payment.release_due_at <= now,
                Order.status == OrderStatus.completed,
            )
        )
        due_payments = (await db.scalars(stmt)).all()
        for payment in due_payments:
            apply_transition(payment, PaymentTransitionEvent.release_due)
            payment.released_at = now
        await db.commit()


@celery_app.task(name="app.workers.tasks_escrow.release_due_escrow")
def release_due_escrow() -> None:
    """Runs on a fixed schedule (not per-payment countdown scheduling, per
    spec). See `release_due_escrow_async` for the actual logic.
    """
    asyncio.run(release_due_escrow_async())
