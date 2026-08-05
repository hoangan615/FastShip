import asyncio
from collections.abc import Coroutine
from typing import Any


async def _run_and_dispose(coro: Coroutine[Any, Any, None]) -> None:
    from app.db.redis import _pool as redis_pool
    from app.db.session import engine

    try:
        await coro
    finally:
        # Each Celery task invocation gets its own event loop via
        # asyncio.run() below. Both the SQLAlchemy async engine's asyncpg
        # connections and the shared redis.asyncio ConnectionPool's
        # connections are bound to the loop that created them, so a
        # pooled connection from one task's loop can't be reused by the
        # next task's (different) loop — without resetting both pools
        # here, the *next* invocation intermittently fails with
        # "attached to a different loop" or "Event loop is closed".
        # Disposing after every task keeps both pools loop-local at the
        # cost of reconnecting each time, the right trade-off for
        # Celery's one-loop-per-task execution model.
        await engine.dispose()
        await redis_pool.disconnect()


def run_task(coro: Coroutine[Any, Any, None]) -> None:
    """Entry point for every Celery task body: runs `coro` to completion
    in a fresh event loop and disposes the shared async DB engine's
    connection pool afterward so it never leaks a connection into the
    next task's (different) event loop.
    """
    asyncio.run(_run_and_dispose(coro))
