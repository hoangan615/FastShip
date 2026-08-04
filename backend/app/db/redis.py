from collections.abc import AsyncGenerator

import redis.asyncio as redis

from app.config import get_settings

settings = get_settings()

_pool = redis.ConnectionPool.from_url(settings.redis_url, decode_responses=True)


def get_redis_client() -> redis.Redis:
    return redis.Redis(connection_pool=_pool)


async def get_redis() -> AsyncGenerator[redis.Redis, None]:
    client = get_redis_client()
    try:
        yield client
    finally:
        await client.aclose()
