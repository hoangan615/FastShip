import uuid
from datetime import datetime, timedelta, timezone

from decimal import Decimal

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.enums import OrderEventType, OrderSource, OrderStatus, PaymentStatus, ShipperStatus
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.core.geo import haversine_km
from app.modules.catalog import service as catalog_service
from app.modules.catalog.models import Merchant
from app.modules.matching import engine as matching_engine
from app.modules.notifications.service import send_notification
from app.modules.ops.service import get_platform_settings
from app.modules.orders.models import Order, OrderEvent, OrderItem
from app.modules.orders.schemas import Address, OrderCreate
from app.modules.orders.state_machine import OrderTransitionEvent, apply_transition
from app.modules.payments import service as payments_service
from app.modules.payments.models import Payment
from app.modules.shippers.models import Shipper
from app.modules.tracking.ws_manager import broadcast_order_status

settings = get_settings()


async def compute_shipping_fee(db: AsyncSession, pickup: Address, dropoff: Address) -> tuple[Decimal, float]:
    """Returns (shipping_fee, distance_km) for a pickup/dropoff pair, using the
    ops-configurable base fee + per-km rate (app.modules.ops.models.PlatformSettings).
    """
    platform_settings = await get_platform_settings(db)
    distance_km = haversine_km(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng)
    fee = Decimal(str(platform_settings.shipping_base_fee)) + Decimal(
        str(platform_settings.shipping_per_km_rate)
    ) * Decimal(str(round(distance_km, 3)))
    return fee.quantize(Decimal("1")), distance_km


async def get_order(db: AsyncSession, order_id: uuid.UUID) -> Order:
    order = await db.get(Order, order_id)
    if order is None:
        raise NotFoundError("Order not found")
    return order


async def list_order_events(db: AsyncSession, order_id: uuid.UUID) -> list[OrderEvent]:
    result = await db.scalars(
        select(OrderEvent).where(OrderEvent.order_id == order_id).order_by(OrderEvent.timestamp)
    )
    return list(result.all())


async def create_order(db: AsyncSession, customer_id: uuid.UUID, payload: OrderCreate) -> Order:
    merchant = await db.get(Merchant, payload.merchant_id)
    if merchant is None:
        raise NotFoundError("Merchant not found")

    subtotal = 0
    items: list[OrderItem] = []
    for line in payload.items:
        product = await catalog_service.get_product(db, line.product_id)
        if product.merchant_id != payload.merchant_id:
            raise PermissionDeniedError("Product does not belong to the specified merchant")
        subtotal += float(product.price) * line.qty
        items.append(
            OrderItem(product_id=product.id, qty=line.qty, price_at_order=product.price)
        )

    shipping_fee, _distance_km = await compute_shipping_fee(
        db, payload.pickup_addr, payload.dropoff_addr
    )
    commission_rate = Decimal(str(merchant.commission_rate))
    merchant_payout = Decimal(str(subtotal)) * (Decimal("1") - commission_rate)
    shipper_payout = shipping_fee

    now = datetime.now(timezone.utc)
    order = Order(
        source=OrderSource.customer_placed,
        customer_id=customer_id,
        merchant_id=payload.merchant_id,
        status=OrderStatus.pending_confirmation,
        pickup_addr=payload.pickup_addr.model_dump(),
        dropoff_addr=payload.dropoff_addr.model_dump(),
        subtotal=subtotal,
        shipping_fee=shipping_fee,
        commission_rate=commission_rate,
        merchant_payout=merchant_payout,
        shipper_payout=shipper_payout,
        cod_amount=payload.cod_amount,
        sla_deadline=now + timedelta(minutes=settings.sla_minutes),
    )
    db.add(order)
    await db.flush()

    for item in items:
        item.order_id = order.id
        db.add(item)

    db.add(
        OrderEvent(
            order_id=order.id,
            event_type=OrderEventType.created,
            actor_role="customer",
            actor_id=customer_id,
            timestamp=now,
            payload={"item_count": len(items)},
        )
    )

    total_charge = Decimal(str(subtotal)) + shipping_fee
    await payments_service.create_and_charge(db, order.id, payload.payment_method, total_charge)
    await db.commit()
    await db.refresh(order)

    send_notification(payload.merchant_id, "New order received", f"Order #{order.id} awaits your confirmation")

    from app.workers.tasks_orders import auto_reject_timeout

    auto_reject_timeout.apply_async(
        args=[str(order.id)], countdown=settings.merchant_response_window_seconds
    )

    return order


async def confirm_order(db: AsyncSession, redis: Redis, merchant_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = await get_order(db, order_id)
    if order.merchant_id != merchant_id:
        raise PermissionDeniedError("Not your order")

    event = apply_transition(order, OrderTransitionEvent.merchant_accept, "merchant", merchant_id)
    db.add(event)

    for item in await db.scalars(select(OrderItem).where(OrderItem.order_id == order.id)):
        await catalog_service.decrement_stock(db, item.product_id, item.qty)

    await db.commit()
    await broadcast_order_status(db, order)
    send_notification(order.customer_id, "Order confirmed", f"Order #{order.id} was accepted by the merchant")

    await matching_engine.find_and_offer(db, redis, order.id)
    return order


async def reject_order(
    db: AsyncSession, merchant_id: uuid.UUID, order_id: uuid.UUID, reason: str | None
) -> Order:
    order = await get_order(db, order_id)
    if order.merchant_id != merchant_id:
        raise PermissionDeniedError("Not your order")

    event = apply_transition(
        order, OrderTransitionEvent.merchant_reject, "merchant", merchant_id, {"reason": reason}
    )
    db.add(event)
    await payments_service.refund(db, order.id)
    await db.commit()
    await broadcast_order_status(db, order)
    send_notification(order.customer_id, "Order rejected", f"Order #{order.id} was rejected; your payment was refunded")
    return order


async def auto_reject_timeout(db: AsyncSession, order_id: uuid.UUID) -> None:
    """Idempotent Celery-task target: no-op if the merchant already
    responded (order is no longer `pending_confirmation`).
    """
    order = await db.get(Order, order_id)
    if order is None or order.status != OrderStatus.pending_confirmation:
        return
    event = apply_transition(order, OrderTransitionEvent.merchant_timeout, "system", None)
    db.add(event)
    await payments_service.refund(db, order.id)
    await db.commit()
    await broadcast_order_status(db, order)
    send_notification(order.customer_id, "Order timed out", f"Order #{order.id} timed out and was refunded")


async def cancel_order(db: AsyncSession, customer_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = await get_order(db, order_id)
    if order.customer_id != customer_id:
        raise PermissionDeniedError("Not your order")

    event = apply_transition(order, OrderTransitionEvent.customer_cancel, "customer", customer_id)
    db.add(event)
    await payments_service.refund(db, order.id)
    await db.commit()
    await broadcast_order_status(db, order)
    send_notification(order.merchant_id, "Order cancelled", f"Order #{order.id} was cancelled by the customer")
    return order


async def ops_cancel_order(db: AsyncSession, ops_user_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = await get_order(db, order_id)
    event = apply_transition(order, OrderTransitionEvent.ops_cancel, "ops", ops_user_id)
    db.add(event)
    await payments_service.refund(db, order.id)
    await db.commit()
    await broadcast_order_status(db, order)
    return order


async def _get_shipper_owned_order(db: AsyncSession, shipper_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = await get_order(db, order_id)
    if order.shipper_id != shipper_id:
        raise PermissionDeniedError("Not your assigned order")
    return order


async def mark_picked_up(db: AsyncSession, shipper_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = await _get_shipper_owned_order(db, shipper_id, order_id)
    event = apply_transition(order, OrderTransitionEvent.shipper_pickup, "shipper", shipper_id)
    db.add(event)
    await db.commit()
    await broadcast_order_status(db, order)
    return order


async def reject_assignment(
    db: AsyncSession,
    redis: Redis,
    shipper_id: uuid.UUID,
    order_id: uuid.UUID,
    reason: str | None,
) -> Order:
    """A shipper backs out after having already accepted an offer (but
    before pickup). Frees the shipper, excludes them from re-matching for
    this order, and immediately re-triggers the matching engine for the
    next-best candidate.
    """
    order = await _get_shipper_owned_order(db, shipper_id, order_id)
    event = apply_transition(
        order,
        OrderTransitionEvent.shipper_reject_after_assign,
        "shipper",
        shipper_id,
        {"reason": reason},
    )
    db.add(event)
    order.shipper_id = None
    await _free_up_shipper(db, shipper_id)
    await db.commit()
    await broadcast_order_status(db, order)
    send_notification(
        order.customer_id, "Finding a new shipper", f"Order #{order.id}'s shipper backed out; rematching"
    )

    from app.modules.matching.redis_keys import match_excluded_key

    await redis.sadd(match_excluded_key(order.id), str(shipper_id))
    await matching_engine.find_and_offer(db, redis, order.id)
    return order


async def start_delivery(db: AsyncSession, shipper_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = await _get_shipper_owned_order(db, shipper_id, order_id)
    event = apply_transition(
        order, OrderTransitionEvent.shipper_start_delivery, "shipper", shipper_id
    )
    db.add(event)
    await db.commit()
    await broadcast_order_status(db, order)
    return order


async def _free_up_shipper(db: AsyncSession, shipper_id: uuid.UUID) -> None:
    shipper = await db.get(Shipper, shipper_id)
    if shipper is not None:
        shipper.active_order_id = None
        shipper.status = ShipperStatus.available


async def complete_order(db: AsyncSession, shipper_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = await _get_shipper_owned_order(db, shipper_id, order_id)
    event = apply_transition(order, OrderTransitionEvent.shipper_complete, "shipper", shipper_id)
    db.add(event)
    await payments_service.schedule_release_on_completion(db, order.id)
    await _free_up_shipper(db, shipper_id)
    await db.commit()
    await broadcast_order_status(db, order)
    send_notification(order.customer_id, "Order delivered", f"Order #{order.id} was delivered successfully")
    send_notification(order.merchant_id, "Order delivered", f"Order #{order.id} was delivered successfully")
    return order


async def get_merchant_revenue(db: AsyncSession, merchant_id: uuid.UUID) -> dict:
    total_orders = (
        await db.scalar(
            select(func.count()).select_from(Order).where(Order.merchant_id == merchant_id)
        )
        or 0
    )
    completed_orders = (
        await db.scalar(
            select(func.count())
            .select_from(Order)
            .where(Order.merchant_id == merchant_id, Order.status == OrderStatus.completed)
        )
        or 0
    )
    total_revenue = (
        await db.scalar(
            select(func.coalesce(func.sum(Order.subtotal), 0)).where(
                Order.merchant_id == merchant_id, Order.status == OrderStatus.completed
            )
        )
        or Decimal(0)
    )
    # merchant_payout is the merchant's own net share (subtotal minus platform
    # commission, snapshotted per order) — NOT the full escrowed Payment.amount,
    # which also includes the shipper's cut of the shipping fee.
    pending_payout = (
        await db.scalar(
            select(func.coalesce(func.sum(Order.merchant_payout), 0))
            .join(Payment, Order.id == Payment.order_id)
            .where(Order.merchant_id == merchant_id, Payment.status == PaymentStatus.held)
        )
        or Decimal(0)
    )
    released_payout = (
        await db.scalar(
            select(func.coalesce(func.sum(Order.merchant_payout), 0))
            .join(Payment, Order.id == Payment.order_id)
            .where(
                Order.merchant_id == merchant_id,
                Payment.status == PaymentStatus.released_to_merchant,
            )
        )
        or Decimal(0)
    )
    merchant = await db.get(Merchant, merchant_id)
    commission_rate = Decimal(str(merchant.commission_rate)) if merchant else Decimal(0)
    return {
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "total_revenue": total_revenue,
        "commission_rate": commission_rate,
        "pending_payout": pending_payout,
        "released_payout": released_payout,
    }


async def get_shipper_revenue(db: AsyncSession, shipper_id: uuid.UUID) -> dict:
    total_deliveries = (
        await db.scalar(
            select(func.count())
            .select_from(Order)
            .where(Order.shipper_id == shipper_id, Order.status == OrderStatus.completed)
        )
        or 0
    )
    pending_payout = (
        await db.scalar(
            select(func.coalesce(func.sum(Order.shipper_payout), 0))
            .join(Payment, Order.id == Payment.order_id)
            .where(Order.shipper_id == shipper_id, Payment.status == PaymentStatus.held)
        )
        or Decimal(0)
    )
    released_payout = (
        await db.scalar(
            select(func.coalesce(func.sum(Order.shipper_payout), 0))
            .join(Payment, Order.id == Payment.order_id)
            .where(
                Order.shipper_id == shipper_id,
                Payment.status == PaymentStatus.released_to_merchant,
            )
        )
        or Decimal(0)
    )
    return {
        "total_deliveries": total_deliveries,
        "pending_payout": pending_payout,
        "released_payout": released_payout,
    }


async def fail_order(
    db: AsyncSession, shipper_id: uuid.UUID, order_id: uuid.UUID, reason: str | None
) -> Order:
    order = await _get_shipper_owned_order(db, shipper_id, order_id)
    event = apply_transition(
        order, OrderTransitionEvent.shipper_fail, "shipper", shipper_id, {"reason": reason}
    )
    db.add(event)
    await payments_service.refund(db, order.id)

    shipper = await db.get(Shipper, shipper_id)
    if shipper is not None:
        shipper.violation_penalty = min(float(shipper.violation_penalty) + 0.05, 1.0)

    await _free_up_shipper(db, shipper_id)
    await db.commit()
    await broadcast_order_status(db, order)
    send_notification(order.customer_id, "Delivery failed", f"Order #{order.id} could not be delivered; you have been refunded")
    send_notification(order.merchant_id, "Delivery failed", f"Order #{order.id} could not be delivered")
    return order
