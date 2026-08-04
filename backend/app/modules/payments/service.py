import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.enums import PaymentMethod
from app.core.exceptions import NotFoundError
from app.modules.payments.models import Payment
from app.modules.payments.state_machine import PaymentTransitionEvent, apply_transition

settings = get_settings()


async def get_payment_for_order(db: AsyncSession, order_id: uuid.UUID) -> Payment:
    payment = await db.scalar(select(Payment).where(Payment.order_id == order_id))
    if payment is None:
        raise NotFoundError("Payment not found for order")
    return payment


async def create_and_charge(
    db: AsyncSession, order_id: uuid.UUID, method: PaymentMethod, amount: Decimal
) -> Payment:
    """Create the escrow payment row for a new order. Online methods are
    "charged" immediately (mock gateway, always succeeds) and move straight
    to `held`. COD has no upfront charge — cash is collected at delivery.
    """
    payment = Payment(order_id=order_id, method=method, status="pending", amount=amount)
    db.add(payment)
    await db.flush()

    if method != PaymentMethod.cod:
        apply_transition(payment, PaymentTransitionEvent.charge_success)
        payment.held_at = datetime.now(timezone.utc)

    await db.flush()
    return payment


async def refund(db: AsyncSession, order_id: uuid.UUID) -> Payment:
    payment = await get_payment_for_order(db, order_id)
    if payment.status == "held":
        apply_transition(payment, PaymentTransitionEvent.order_terminated)
        payment.refunded_at = datetime.now(timezone.utc)
    elif payment.status == "pending":
        apply_transition(payment, PaymentTransitionEvent.charge_failed)
        payment.refunded_at = datetime.now(timezone.utc)
    await db.flush()
    return payment


async def schedule_release_on_completion(db: AsyncSession, order_id: uuid.UUID) -> Payment:
    payment = await get_payment_for_order(db, order_id)
    if payment.method == PaymentMethod.cod and payment.status == "pending":
        # cash collected by shipper on delivery -> counts as charged/held now
        apply_transition(payment, PaymentTransitionEvent.charge_success)
        payment.held_at = datetime.now(timezone.utc)
    apply_transition(payment, PaymentTransitionEvent.order_completed)
    payment.release_due_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.escrow_buffer_hours
    )
    await db.flush()
    return payment


async def raise_dispute(db: AsyncSession, order_id: uuid.UUID, reason: str) -> Payment:
    payment = await get_payment_for_order(db, order_id)
    apply_transition(payment, PaymentTransitionEvent.dispute_raised)
    payment.dispute_reason = reason
    await db.commit()
    return payment


async def resolve_dispute(db: AsyncSession, payment_id: uuid.UUID, release: bool) -> Payment:
    payment = await db.get(Payment, payment_id)
    if payment is None:
        raise NotFoundError("Payment not found")
    event = (
        PaymentTransitionEvent.ops_resolve_release
        if release
        else PaymentTransitionEvent.ops_resolve_refund
    )
    apply_transition(payment, event)
    now = datetime.now(timezone.utc)
    if release:
        payment.released_at = now
    else:
        payment.refunded_at = now
    await db.commit()
    return payment


async def cod_reconcile(db: AsyncSession, payment_id: uuid.UUID) -> Payment:
    payment = await db.get(Payment, payment_id)
    if payment is None:
        raise NotFoundError("Payment not found")
    apply_transition(payment, PaymentTransitionEvent.cod_reconcile)
    payment.released_at = datetime.now(timezone.utc)
    await db.commit()
    return payment
