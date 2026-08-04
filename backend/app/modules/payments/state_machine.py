from enum import StrEnum

from app.core.enums import PaymentStatus
from app.core.exceptions import InvalidTransitionError
from app.modules.payments.models import Payment


class PaymentTransitionEvent(StrEnum):
    charge_success = "charge_success"
    charge_failed = "charge_failed"
    order_completed = "order_completed"  # schedules release, no status change yet
    order_terminated = "order_terminated"  # failed/cancelled/rejected -> refunded
    dispute_raised = "dispute_raised"
    ops_resolve_release = "ops_resolve_release"
    ops_resolve_refund = "ops_resolve_refund"
    release_due = "release_due"  # fired by the Celery release job
    cod_reconcile = "cod_reconcile"  # ops confirms cash collected, releases immediately


TRANSITIONS: dict[tuple[PaymentStatus, PaymentTransitionEvent], PaymentStatus] = {
    (PaymentStatus.pending, PaymentTransitionEvent.charge_success): PaymentStatus.held,
    (PaymentStatus.pending, PaymentTransitionEvent.charge_failed): PaymentStatus.refunded,
    (PaymentStatus.held, PaymentTransitionEvent.order_completed): PaymentStatus.held,
    (PaymentStatus.held, PaymentTransitionEvent.order_terminated): PaymentStatus.refunded,
    (PaymentStatus.held, PaymentTransitionEvent.dispute_raised): PaymentStatus.disputed,
    (
        PaymentStatus.held,
        PaymentTransitionEvent.release_due,
    ): PaymentStatus.released_to_merchant,
    (
        PaymentStatus.held,
        PaymentTransitionEvent.cod_reconcile,
    ): PaymentStatus.released_to_merchant,
    (
        PaymentStatus.disputed,
        PaymentTransitionEvent.ops_resolve_release,
    ): PaymentStatus.released_to_merchant,
    (PaymentStatus.disputed, PaymentTransitionEvent.ops_resolve_refund): PaymentStatus.refunded,
}


def apply_transition(payment: Payment, event: PaymentTransitionEvent) -> PaymentStatus:
    key = (payment.status, event)
    if key not in TRANSITIONS:
        raise InvalidTransitionError(
            f"Cannot apply payment event '{event}' to payment in status '{payment.status}'"
        )
    old_status = payment.status
    new_status = TRANSITIONS[key]
    payment.status = new_status
    return old_status
