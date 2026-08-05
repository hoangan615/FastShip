import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import socketio
from sqlalchemy import select

from app.config import get_settings
from app.core.enums import ShipperStatus, UserRole
from app.core.security import decode_access_token
from app.modules.tracking.events import WSEvent

settings = get_settings()

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")


@sio.event
async def connect(sid, environ, auth):
    # accept the transport-level connection; role/room join happens on the
    # explicit "auth" event below, once the JWT has been validated
    return True


@sio.event
async def disconnect(sid):
    return None


@sio.on("auth")
async def handle_auth(sid, data):
    token = (data or {}).get("token")
    token_data = decode_access_token(token) if token else None
    if token_data is None:
        await sio.emit("auth_error", {"message": "invalid or missing token"}, to=sid)
        return

    await sio.save_session(sid, {"user_id": str(token_data.user_id), "role": str(token_data.role)})
    room = f"{token_data.role}:{token_data.user_id}"
    await sio.enter_room(sid, room)
    if token_data.role == UserRole.ops:
        await sio.enter_room(sid, "ops:dashboard")
    await sio.emit("auth_ok", {"room": room}, to=sid)


@sio.on("join_order")
async def handle_join_order(sid, data):
    order_id = (data or {}).get("order_id")
    if order_id:
        await sio.enter_room(sid, f"order:{order_id}")


@sio.on("resync")
async def handle_resync(sid, data):
    """Client reconnected after a gap and wants a fresh snapshot rather
    than a full event replay: current order status + last known shipper
    location.
    """
    order_id = (data or {}).get("order_id")
    if not order_id:
        return

    from app.db.session import async_session_factory
    from app.modules.orders.models import Order
    from app.modules.shippers.models import Shipper

    async with async_session_factory() as db:
        order = await db.get(Order, uuid.UUID(order_id))
        if order is None:
            return
        snapshot: dict = {
            "order_id": str(order.id),
            "status": str(order.status),
            "shipper_id": str(order.shipper_id) if order.shipper_id else None,
        }
        if order.shipper_id:
            shipper = await db.get(Shipper, order.shipper_id)
            if shipper is not None and shipper.current_lat is not None:
                snapshot["shipper_location"] = {
                    "lat": float(shipper.current_lat),
                    "lng": float(shipper.current_lng),
                }

    await sio.emit(str(WSEvent.resync), snapshot, to=sid)


@sio.on("location.update")
async def handle_location_update(sid, data):
    session = await sio.get_session(sid)
    if not session or session.get("role") != str(UserRole.shipper):
        return
    lat, lng = (data or {}).get("lat"), (data or {}).get("lng")
    if lat is None or lng is None:
        return

    from app.db.redis import get_redis_client
    from app.db.session import async_session_factory
    from app.modules.shippers.service import get_shipper_for_user, update_location

    user_id = uuid.UUID(session["user_id"])
    async with async_session_factory() as db:
        redis = get_redis_client()
        try:
            shipper = await get_shipper_for_user(db, user_id)
            await update_location(db, redis, shipper, float(lat), float(lng))
        finally:
            await redis.aclose()

    payload = {"shipper_id": str(shipper.id), "lat": lat, "lng": lng}
    if shipper.active_order_id:
        await sio.emit(
            str(WSEvent.shipper_location_update), payload, room=f"order:{shipper.active_order_id}"
        )
    await sio.emit(str(WSEvent.shipper_location_update), payload, room="ops:dashboard")


async def emit_to_room(room: str, event: str, data: dict) -> None:
    await sio.emit(event, data, room=room)


async def broadcast_order_status(db, order) -> None:
    # Rooms are keyed by each client's *User* id (that's what the "auth"
    # socket event joins, from the JWT) — but order.customer_id/merchant_id/
    # shipper_id are Customer/Merchant/Shipper profile-table primary keys,
    # a different id space entirely. Broadcasting to f"customer:{order.customer_id}"
    # etc. directly would silently reach nobody, since no client ever joins
    # a room keyed by a profile id. Resolve each profile id to its owning
    # user_id first.
    from app.modules.auth.models import Customer
    from app.modules.catalog.models import Merchant
    from app.modules.shippers.models import Shipper

    customer = await db.get(Customer, order.customer_id)
    merchant = await db.get(Merchant, order.merchant_id)
    shipper = await db.get(Shipper, order.shipper_id) if order.shipper_id else None

    payload = {"order_id": str(order.id), "status": str(order.status)}
    rooms = ["ops:dashboard", f"order:{order.id}"]
    if customer is not None:
        rooms.append(f"customer:{customer.user_id}")
    if merchant is not None:
        rooms.append(f"merchant:{merchant.user_id}")
    if shipper is not None:
        rooms.append(f"shipper:{shipper.user_id}")
    for room in rooms:
        await sio.emit(str(WSEvent.order_status_changed), payload, room=room)


async def _check_stale_shippers() -> None:
    from app.db.redis import get_redis_client
    from app.db.session import async_session_factory
    from app.modules.matching.redis_keys import SHIPPERS_GEO_KEY, shipper_status_key
    from app.modules.shippers.models import Shipper

    cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.shipper_offline_after_seconds)
    async with async_session_factory() as db:
        stmt = select(Shipper).where(
            Shipper.status != ShipperStatus.offline,
            Shipper.last_heartbeat_at.isnot(None),
            Shipper.last_heartbeat_at < cutoff,
        )
        stale = list((await db.scalars(stmt)).all())
        if not stale:
            return

        redis = get_redis_client()
        try:
            for shipper in stale:
                shipper.status = ShipperStatus.offline
                await redis.set(shipper_status_key(shipper.id), str(ShipperStatus.offline))
                await redis.zrem(SHIPPERS_GEO_KEY, str(shipper.id))
                await sio.emit(
                    str(WSEvent.shipper_went_offline),
                    {"shipper_id": str(shipper.id)},
                    room="ops:dashboard",
                )
            await db.commit()
        finally:
            await redis.aclose()


async def offline_watcher_loop() -> None:
    """Runs for the lifetime of the app; marks shippers offline once their
    last location heartbeat exceeds the configured staleness threshold.
    """
    while True:
        await asyncio.sleep(10)
        try:
            await _check_stale_shippers()
        except Exception:
            # transient DB/Redis errors must not kill the watcher loop
            continue
