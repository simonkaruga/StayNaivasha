from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import require_owner
from app.models.models import User, Property, Booking
from app.services.ical import generate_ical, parse_remote_ical

router = APIRouter(tags=["ical"])


@router.get("/{property_uuid}")
async def export_ical(property_uuid: str, db: AsyncSession = Depends(get_db)):
    """Public iCal feed — owner pastes this URL into Airbnb/Booking.com."""
    prop = (await db.execute(select(Property).where(Property.id == property_uuid))).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    result = await db.execute(
        select(Booking).where(
            Booking.property_id == property_uuid,
            Booking.status.in_(["confirmed", "checked_in", "completed"]),
        )
    )
    bookings = result.scalars().all()

    booking_dicts = [
        {"id": b.id, "check_in": b.check_in, "check_out": b.check_out}
        for b in bookings
    ]
    cal_bytes = generate_ical(property_uuid, booking_dicts)
    return Response(
        content=cal_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="staynaivasha-{property_uuid[:8]}.ics"'},
    )


class ICalImport(BaseModel):
    property_id: str
    ical_url: str


@router.post("/import", status_code=204)
async def import_ical(
    body: ICalImport,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Owner pastes Airbnb/Booking.com iCal URL — immediate sync + stored for 2-hour polling."""
    prop = (await db.execute(
        select(Property).where(Property.id == body.property_id, Property.owner_id == owner.id)
    )).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Validate URL works before saving
    try:
        await parse_remote_ical(body.ical_url)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not fetch that iCal URL — check it is public")

    prop.ical_import_url = body.ical_url
    await db.commit()

    # Trigger immediate sync via Celery
    from app.workers.tasks import sync_all_icals
    sync_all_icals.delay()
