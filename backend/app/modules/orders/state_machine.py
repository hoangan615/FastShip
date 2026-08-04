from datetime import datetime, timezone
from enum import StrEnum

from app.core.enums import OrderEventType, OrderStatus
from app.core.exceptions import InvalidTransitionError
from app.modules.orders.models import Order, OrderEvent


class OrderTransitionEvent(StrEnum):
    merchant_accept = "merchant_accept"
    merchant_reject = "merchant_reject"
    merchant_timeout = "merchant_timeout"
    customer_cancel = "customer_cancel"
    match_assigned = "match_assigned"
    match_exhausted = "match_exhausted"
    ops_cancel = "ops_cancel"
    shipper_pickup = "shipper_pickup"
    shipper_reject_after_assign = "shipper_reject_after_assign"
    shipper_start_delivery = "shipper_start_delivery"
    shipper_complete = "shipper_complete"
    shipper_fail = "shipper_fail"


TRANSITIONS: dict[tuple[OrderStatus, OrderTransitionEvent], OrderStatus] = {
    (OrderStatus.pending_confirmation, OrderTransitionEvent.merchant_accept): OrderStatus.pending,
    (
        OrderStatus.pending_confirmation,
        OrderTransitionEvent.merchant_reject,
    ): OrderStatus.rejected,
    (
        OrderStatus.pending_confirmation,
        OrderTransitionEvent.merchant_timeout,
    ): OrderStatus.rejected,
    (
        OrderStatus.pending_confirmation,
        OrderTransitionEvent.customer_cancel,
    ): OrderStatus.cancelled,
    (OrderStatus.pending, OrderTransitionEvent.match_assigned): OrderStatus.assigned,
    (OrderStatus.pending, OrderTransitionEvent.match_exhausted): OrderStatus.pending,
    (OrderStatus.pending, OrderTransitionEvent.ops_cancel): OrderStatus.cancelled,
    (OrderStatus.assigned, OrderTransitionEvent.shipper_pickup): OrderStatus.picked_up,
    (
        OrderStatus.assigned,
        OrderTransitionEvent.shipper_reject_after_assign,
    ): OrderStatus.pending,
    (OrderStatus.picked_up, OrderTransitionEvent.shipper_start_delivery): OrderStatus.delivering,
    (OrderStatus.delivering, OrderTransitionEvent.shipper_complete): OrderStatus.completed,
    (OrderStatus.delivering, OrderTransitionEvent.shipper_fail): OrderStatus.failed,
}

EVENT_TO_AUDIT_TYPE: dict[OrderTransitionEvent, OrderEventType] = {
    OrderTransitionEvent.merchant_accept: OrderEventType.merchant_accepted,
    OrderTransitionEvent.merchant_reject: OrderEventType.merchant_rejected,
    OrderTransitionEvent.merchant_timeout: OrderEventType.merchant_timeout,
    OrderTransitionEvent.customer_cancel: OrderEventType.customer_cancelled,
    OrderTransitionEvent.match_assigned: OrderEventType.match_assigned,
    OrderTransitionEvent.match_exhausted: OrderEventType.match_exhausted,
    OrderTransitionEvent.ops_cancel: OrderEventType.ops_cancelled,
    OrderTransitionEvent.shipper_pickup: OrderEventType.picked_up,
    OrderTransitionEvent.shipper_reject_after_assign: OrderEventType.shipper_declined,
    OrderTransitionEvent.shipper_start_delivery: OrderEventType.delivering,
    OrderTransitionEvent.shipper_complete: OrderEventType.completed,
    OrderTransitionEvent.shipper_fail: OrderEventType.failed,
}

_TIMESTAMP_COLUMN_BY_NEW_STATUS: dict[OrderStatus, str] = {
    OrderStatus.assigned: "assigned_at",
    OrderStatus.picked_up: "picked_up_at",
    OrderStatus.completed: "delivered_at",
    OrderStatus.cancelled: "cancelled_at",
}


def can_transition(status: OrderStatus, event: OrderTransitionEvent) -> bool:
    return (status, event) in TRANSITIONS


def apply_transition(
    order: Order,
    event: OrderTransitionEvent,
    actor_role: str,
    actor_id,
    payload: dict | None = None,
) -> OrderEvent:
    """Validate + apply an order status transition in-place and return the
    audit `OrderEvent` row to be added to the session. Callers are
    responsible for `db.add()`/flush/commit and for any cross-module side
    effects (stock decrement, escrow hold/refund, matching trigger, etc.).
    """
    key = (order.status, event)
    if key not in TRANSITIONS:
        raise InvalidTransitionError(
            f"Cannot apply event '{event}' to order in status '{order.status}'"
        )
    old_status = order.status
    new_status = TRANSITIONS[key]
    now = datetime.now(timezone.utc)

    order.status = new_status
    ts_column = _TIMESTAMP_COLUMN_BY_NEW_STATUS.get(new_status)
    if ts_column == "confirmed_at" or event == OrderTransitionEvent.merchant_accept:
        order.confirmed_at = now
    if ts_column:
        setattr(order, ts_column, now)

    return OrderEvent(
        order_id=order.id,
        event_type=EVENT_TO_AUDIT_TYPE[event],
        actor_role=actor_role,
        actor_id=actor_id,
        timestamp=now,
        payload={"from": str(old_status), "to": str(new_status), **(payload or {})},
    )
