import uuid

from redis.asyncio import Redis

from app.modules.matching.redis_keys import match_lock_key

# Only delete the lock if it still belongs to us (compare-and-delete),
# so a slow caller can never release a lock that a newer order re-acquired
# after this lock's TTL already expired.
_RELEASE_IF_OWNER_SCRIPT = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
"""


async def acquire_lock(
    redis: Redis, shipper_id: uuid.UUID, order_id: uuid.UUID, ttl_seconds: int
) -> bool:
    """Atomic SETNX-with-TTL. Returns True iff this order now holds the
    lock on this shipper. This is the sole mechanism preventing two orders
    from matching the same shipper concurrently.
    """
    key = match_lock_key(shipper_id)
    return bool(await redis.set(key, str(order_id), nx=True, ex=ttl_seconds))


async def release_lock(redis: Redis, shipper_id: uuid.UUID, order_id: uuid.UUID) -> bool:
    key = match_lock_key(shipper_id)
    result = await redis.eval(_RELEASE_IF_OWNER_SCRIPT, 1, key, str(order_id))
    return bool(result)


async def lock_holder(redis: Redis, shipper_id: uuid.UUID) -> str | None:
    return await redis.get(match_lock_key(shipper_id))
