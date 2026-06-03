import time
from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import AsyncSessionLocal
from app.core.redis import redis

router = APIRouter()


@router.get("/health")
async def health():
    start = time.monotonic()
    checks: dict[str, str] = {}

    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "unavailable"

    try:
        await redis.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "unavailable"

    response_ms = round((time.monotonic() - start) * 1000)
    # Only report degraded if a service that was expected to be up is down
    # In production both will be ok; in dev this still returns 200 for the proxy check
    status = "healthy" if checks["database"] == "ok" else "degraded"

    return {"status": status, "checks": checks, "response_ms": response_ms}
