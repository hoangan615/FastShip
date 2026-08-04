import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderSource, OrderStatus
from app.core.exceptions import InvalidTransitionError
from app.modules.orders.models import Order
from app.modules.orders.state_machine import (
    TRANSITIONS,
    OrderTransitionEvent,
    apply_transition,
    can_transition,
)


def _make_order(status: OrderStatus) -> Order:
    return Order(
        id=uuid.uuid4(),
        source=OrderSource.customer_placed,
        customer_id=uuid.uuid4(),
        merchant_id=uuid.uuid4(),
        status=status,
        pickup_addr={"lat": 0, "lng": 0, "address": "a"},
        dropoff_addr={"lat": 0, "lng": 0, "address": "b"},
        subtotal=100,
    )


@pytest.mark.parametrize(
    "from_status,event,to_status",
    [
        (OrderStatus.pending_confirmation, OrderTransitionEvent.merchant_accept, OrderStatus.pending),
        (OrderStatus.pending_confirmation, OrderTransitionEvent.merchant_reject, OrderStatus.rejected),
        (OrderStatus.pending_confirmation, OrderTransitionEvent.merchant_timeout, OrderStatus.rejected),
        (OrderStatus.pending_confirmation, OrderTransitionEvent.customer_cancel, OrderStatus.cancelled),
        (OrderStatus.pending, OrderTransitionEvent.match_assigned, OrderStatus.assigned),
        (OrderStatus.pending, OrderTransitionEvent.match_exhausted, OrderStatus.pending),
        (OrderStatus.pending, OrderTransitionEvent.ops_cancel, OrderStatus.cancelled),
        (OrderStatus.assigned, OrderTransitionEvent.shipper_pickup, OrderStatus.picked_up),
        (
            OrderStatus.assigned,
            OrderTransitionEvent.shipper_reject_after_assign,
            OrderStatus.pending,
        ),
        (OrderStatus.picked_up, OrderTransitionEvent.shipper_start_delivery, OrderStatus.delivering),
        (OrderStatus.delivering, OrderTransitionEvent.shipper_complete, OrderStatus.completed),
        (OrderStatus.delivering, OrderTransitionEvent.shipper_fail, OrderStatus.failed),
    ],
)
def test_every_legal_transition_succeeds_and_updates_status(from_status, event, to_status):
    order = _make_order(from_status)
    audit_event = apply_transition(order, event, "system", None)
    assert order.status == to_status
    assert audit_event.payload["from"] == str(from_status)
    assert audit_event.payload["to"] == str(to_status)
    assert audit_event.order_id == order.id


@pytest.mark.parametrize("status", list(OrderStatus))
@pytest.mark.parametrize("event", list(OrderTransitionEvent))
def test_every_undefined_combination_raises(status, event):
    if (status, event) in TRANSITIONS:
        pytest.skip("legal combination, covered by the success test above")
    order = _make_order(status)
    with pytest.raises(InvalidTransitionError):
        apply_transition(order, event, "system", None)


def test_terminal_states_accept_no_further_events():
    for terminal in (
        OrderStatus.completed,
        OrderStatus.failed,
        OrderStatus.cancelled,
        OrderStatus.rejected,
    ):
        for event in OrderTransitionEvent:
            assert not can_transition(terminal, event)


def test_assigned_at_timestamp_set_on_match_assigned():
    order = _make_order(OrderStatus.pending)
    assert order.assigned_at is None
    apply_transition(order, OrderTransitionEvent.match_assigned, "system", None)
    assert order.assigned_at is not None


def test_picked_up_at_timestamp_set_on_pickup():
    order = _make_order(OrderStatus.assigned)
    apply_transition(order, OrderTransitionEvent.shipper_pickup, "shipper", uuid.uuid4())
    assert order.picked_up_at is not None


def test_delivered_at_timestamp_set_on_completion():
    order = _make_order(OrderStatus.delivering)
    apply_transition(order, OrderTransitionEvent.shipper_complete, "shipper", uuid.uuid4())
    assert order.delivered_at is not None


def test_cancelled_at_timestamp_set_on_customer_cancel():
    order = _make_order(OrderStatus.pending_confirmation)
    apply_transition(order, OrderTransitionEvent.customer_cancel, "customer", uuid.uuid4())
    assert order.cancelled_at is not None


def test_reject_after_confirmation_is_illegal():
    order = _make_order(OrderStatus.pending)
    with pytest.raises(InvalidTransitionError):
        apply_transition(order, OrderTransitionEvent.merchant_reject, "merchant", uuid.uuid4())


def test_payload_extra_fields_merged_into_audit_event():
    order = _make_order(OrderStatus.pending_confirmation)
    event = apply_transition(
        order, OrderTransitionEvent.merchant_reject, "merchant", uuid.uuid4(), {"reason": "no stock"}
    )
    assert event.payload["reason"] == "no stock"
