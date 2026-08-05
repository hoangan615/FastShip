import asyncio
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI

from app.core.exceptions import register_exception_handlers
from app.modules.auth.router import router as auth_router
from app.modules.catalog.router import router as catalog_router
from app.modules.customers.router import router as customers_router
from app.modules.matching.router import router as matching_router
from app.modules.ops.router import router as ops_router
from app.modules.orders.router import router as orders_router
from app.modules.payments.router import router as payments_router
from app.modules.shippers.router import router as shippers_router
from app.modules.tracking.ws_manager import offline_watcher_loop, sio


@asynccontextmanager
async def lifespan(app: FastAPI):
    watcher_task = asyncio.create_task(offline_watcher_loop())
    yield
    watcher_task.cancel()


def create_app() -> FastAPI:
    app = FastAPI(title="FastShip", lifespan=lifespan)
    register_exception_handlers(app)

    app.include_router(auth_router)
    app.include_router(customers_router)
    app.include_router(catalog_router)
    app.include_router(orders_router)
    app.include_router(shippers_router)
    app.include_router(matching_router)
    app.include_router(payments_router)
    app.include_router(ops_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


fastapi_app = create_app()
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")
