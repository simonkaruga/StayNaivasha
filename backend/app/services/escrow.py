from app.core.redis import redis

LOCK_TTL = 600  # 10 minutes


async def _redis_ok() -> bool:
    try:
        await redis.ping()
        return True
    except Exception:
        return False


async def acquire_lock(property_id: str, check_in: str, check_out: str) -> bool:
    """Soft lock dates for 10 minutes on Book Now click. Returns True if lock acquired."""
    if not await _redis_ok():
        return True  # Dev without Redis — allow booking to proceed
    key = f"lock:{property_id}:{check_in}:{check_out}"
    return bool(await redis.set(key, 1, ex=LOCK_TTL, nx=True))


async def release_lock(property_id: str, check_in: str, check_out: str) -> None:
    """Release lock on STK Push timeout — never double-charge."""
    if not await _redis_ok():
        return
    key = f"lock:{property_id}:{check_in}:{check_out}"
    await redis.delete(key)


async def is_locked(property_id: str, check_in: str, check_out: str) -> bool:
    if not await _redis_ok():
        return False
    key = f"lock:{property_id}:{check_in}:{check_out}"
    return bool(await redis.exists(key))
