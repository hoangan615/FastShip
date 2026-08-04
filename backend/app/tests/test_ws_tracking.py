"""Socket.IO room-join and reconnect/resync behavior, exercised against a
real running ASGI server (python-socketio needs an actual HTTP/WS
transport — it isn't ASGI-test-client friendly like plain FastAPI routes).
"""

import asyncio
import uuid

import pytest
import pytest_asyncio
import socketio
import uvicorn
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import OrderSource, OrderStatus, ShipperStatus, UserRole
from app.core.security import create_access_token
from app.modules.auth.models import Customer, User
from app.modules.catalog.models import Merchant
from app.modules.orders.models import Order
from app.modules.shippers.models import Shipper
from app.tests.conftest import unique_email

TEST_PORT = 8991


@pytest_asyncio.fixture
async def live_server():
    from app.main import app

    config = uvicorn.Config(app, host="127.0.0.1", port=TEST_PORT, log_level="warning")
    server = uvicorn.Server(config)
    task = asyncio.create_task(server.serve())
    for _ in range(100):
        if server.started:
            break
        await asyncio.sleep(0.05)
    else:
        raise RuntimeError("test server did not start in time")

    yield f"http://127.0.0.1:{TEST_PORT}"

    server.should_exit = True
    await task


async def test_auth_joins_role_room_and_receives_targeted_broadcast(live_server, db: AsyncSession):
    user = User(email=unique_email("shipper"), password_hash="x", role="shipper")
    db.add(user)
    await db.commit()
    token = create_access_token(user.id, UserRole.shipper)

    client = socketio.AsyncClient()
    received: list[tuple[str, dict]] = []

    @client.event
    async def auth_ok(data):
        received.append(("auth_ok", data))

    @client.on("test.ping")
    async def on_ping(data):
        received.append(("ping", data))

    await client.connect(live_server, socketio_path="socket.io")
    await client.emit("auth", {"token": token})
    await asyncio.sleep(0.3)

    from app.modules.tracking.ws_manager import emit_to_room

    await emit_to_room(f"shipper:{user.id}", "test.ping", {"hello": "world"})
    await asyncio.sleep(0.3)

    await client.disconnect()

    assert ("auth_ok", {"room": f"shipper:{user.id}"}) in received
    assert ("ping", {"hello": "world"}) in received


async def test_ops_role_also_joins_ops_dashboard_room(live_server, db: AsyncSession):
    user = User(email=unique_email("ops"), password_hash="x", role="ops")
    db.add(user)
    await db.commit()
    token = create_access_token(user.id, UserRole.ops)

    client = socketio.AsyncClient()
    received: list[dict] = []

    @client.on("test.ping")
    async def on_ping(data):
        received.append(data)

    await client.connect(live_server, socketio_path="socket.io")
    await client.emit("auth", {"token": token})
    await asyncio.sleep(0.3)

    from app.modules.tracking.ws_manager import emit_to_room

    await emit_to_room("ops:dashboard", "test.ping", {"source": "ops-room-check"})
    await asyncio.sleep(0.3)

    await client.disconnect()

    assert {"source": "ops-room-check"} in received


async def test_auth_with_invalid_token_is_rejected(live_server):
    client = socketio.AsyncClient()
    received: list[dict] = []

    @client.on("auth_error")
    async def on_error(data):
        received.append(data)

    await client.connect(live_server, socketio_path="socket.io")
    await client.emit("auth", {"token": "not-a-real-token"})
    await asyncio.sleep(0.3)
    await client.disconnect()

    assert len(received) == 1


async def test_resync_returns_order_status_and_shipper_location(
    live_server, db: AsyncSession
):
    customer_user = User(email=unique_email("cust"), password_hash="x", role="customer")
    merchant_user = User(email=unique_email("merch"), password_hash="x", role="merchant")
    shipper_user = User(email=unique_email("ship"), password_hash="x", role="shipper")
    db.add_all([customer_user, merchant_user, shipper_user])
    await db.flush()

    customer = Customer(user_id=customer_user.id, name="Cust")
    merchant = Merchant(user_id=merchant_user.id, name="Merch", address="addr", status="active")
    db.add_all([customer, merchant])
    await db.flush()

    shipper = Shipper(
        user_id=shipper_user.id, status=ShipperStatus.busy, current_lat=10.5, current_lng=106.5
    )
    db.add(shipper)
    await db.flush()

    order = Order(
        source=OrderSource.customer_placed,
        customer_id=customer.id,
        merchant_id=merchant.id,
        shipper_id=shipper.id,
        status=OrderStatus.assigned,
        pickup_addr={"lat": 10.5, "lng": 106.5, "address": "a"},
        dropoff_addr={"lat": 10.6, "lng": 106.5, "address": "b"},
        subtotal=100,
    )
    db.add(order)
    await db.commit()

    client = socketio.AsyncClient()
    snapshot: dict = {}

    @client.on("resync")
    async def on_resync(data):
        snapshot.update(data)

    await client.connect(live_server, socketio_path="socket.io")
    await client.emit("resync", {"order_id": str(order.id)})
    await asyncio.sleep(0.3)
    await client.disconnect()

    assert snapshot["order_id"] == str(order.id)
    assert snapshot["status"] == str(OrderStatus.assigned)
    assert snapshot["shipper_id"] == str(shipper.id)
    assert snapshot["shipper_location"]["lat"] == pytest.approx(10.5)
    assert snapshot["shipper_location"]["lng"] == pytest.approx(106.5)
