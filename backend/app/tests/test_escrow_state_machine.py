import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderSource, OrderStatus, PaymentMethod, PaymentStatus
from app.core.exceptions import InvalidTransitionError
from app.modules.auth.models import Customer, User
from app.modules.catalog.models import Merchant
from app.modules.orders.models import Order
from app.modules.payments.models import Payment
from app.modules.payments.state_machine import (
    TRANSITIONS,
    PaymentTransitionEvent,
    apply_transition,
)
from app.tests.conftest import unique_email
from app.workers.tasks_escrow import release_due_escrow_async


def _make_payment(status: PaymentStatus, **kwargs) -> Payment:
    return Payment(
        id=uuid.uuid4(), order_id=uuid.uuid4(), method=PaymentMethod.wallet, status=status, amount=100, **kwargs
    )


@pytest.mark.parametrize(
    "from_status,event,to_status",
    [
        (PaymentStatus.pending, PaymentTransitionEvent.charge_success, PaymentStatus.held),
        (PaymentStatus.pending, PaymentTransitionEvent.charge_failed, PaymentStatus.refunded),
        (PaymentStatus.held, PaymentTransitionEvent.order_completed, PaymentStatus.held),
        (PaymentStatus.held, PaymentTransitionEvent.order_terminated, PaymentStatus.refunded),
        (PaymentStatus.held, PaymentTransitionEvent.dispute_raised, PaymentStatus.disputed),
        (PaymentStatus.held, PaymentTransitionEvent.release_due, PaymentStatus.released_to_merchant),
        (PaymentStatus.held, PaymentTransitionEvent.cod_reconcile, PaymentStatus.released_to_merchant),
        (
            PaymentStatus.disputed,
            PaymentTransitionEvent.ops_resolve_release,
            PaymentStatus.released_to_merchant,
        ),
        (PaymentStatus.disputed, PaymentTransitionEvent.ops_resolve_refund, PaymentStatus.refunded),
    ],
)
def test_every_legal_payment_transition(from_status, event, to_status):
    payment = _make_payment(from_status)
    old = apply_transition(payment, event)
    assert old == from_status
    assert payment.status == to_status


@pytest.mark.parametrize("status", list(PaymentStatus))
@pytest.mark.parametrize("event", list(PaymentTransitionEvent))
def test_every_undefined_payment_combination_raises(status, event):
    if (status, event) in TRANSITIONS:
        pytest.skip("legal combination, covered above")
    payment = _make_payment(status)
    with pytest.raises(InvalidTransitionError):
        apply_transition(payment, event)


def test_terminal_payment_states_accept_no_events():
    for terminal in (PaymentStatus.released_to_merchant, PaymentStatus.refunded):
        for event in PaymentTransitionEvent:
            assert (terminal, event) not in TRANSITIONS


async def _seed_order(db: AsyncSession, status: OrderStatus) -> Order:
    customer_user = User(email=unique_email("cust"), password_hash="x", role="customer")
    merchant_user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    db.add_all([customer_user, merchant_user])
    await db.flush()

    customer = Customer(user_id=customer_user.id, name="Cust")
    merchant = Merchant(user_id=merchant_user.id, name="Merch", address="addr", status="active")
    db.add_all([customer, merchant])
    await db.flush()

    order = Order(
        source=OrderSource.customer_placed,
        customer_id=customer.id,
        merchant_id=merchant.id,
        status=status,
        pickup_addr={"lat": 0, "lng": 0, "address": "a"},
        dropoff_addr={"lat": 0, "lng": 0, "address": "b"},
        subtotal=100,
    )
    db.add(order)
    await db.flush()
    return order


async def test_release_due_escrow_releases_past_due_completed_orders(db: AsyncSession):
    order = await _seed_order(db, OrderStatus.completed)
    payment = Payment(
        order_id=order.id,
        method=PaymentMethod.wallet,
        status=PaymentStatus.held,
        amount=100,
        release_due_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(payment)
    await db.commit()

    await release_due_escrow_async()

    await db.refresh(payment)
    assert payment.status == PaymentStatus.released_to_merchant
    assert payment.released_at is not None


async def test_release_due_escrow_ignores_not_yet_due_payments(db: AsyncSession):
    order = await _seed_order(db, OrderStatus.completed)
    payment = Payment(
        order_id=order.id,
        method=PaymentMethod.wallet,
        status=PaymentStatus.held,
        amount=100,
        release_due_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(payment)
    await db.commit()

    await release_due_escrow_async()

    await db.refresh(payment)
    assert payment.status == PaymentStatus.held


async def test_release_due_escrow_ignores_disputed_payments(db: AsyncSession):
    order = await _seed_order(db, OrderStatus.completed)
    payment = Payment(
        order_id=order.id,
        method=PaymentMethod.wallet,
        status=PaymentStatus.disputed,
        amount=100,
        release_due_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(payment)
    await db.commit()

    await release_due_escrow_async()

    await db.refresh(payment)
    assert payment.status == PaymentStatus.disputed
