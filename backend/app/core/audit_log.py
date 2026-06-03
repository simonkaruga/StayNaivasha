from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog


async def log_event(
    db: AsyncSession,
    event_type: str,
    entity_id: str,
    actor_id: str | None,
    metadata: dict,
) -> None:
    entry = AuditLog(event_type=event_type, entity_id=entity_id, actor_id=actor_id, metadata_json=metadata)
    db.add(entry)
    await db.commit()
