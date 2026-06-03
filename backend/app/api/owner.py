from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import date as date_type

from app.core.database import get_db
from app.core.deps import require_owner
from app.models.models import User, Property, PropertyImage, Booking, Availability

router = APIRouter(tags=["owner"])


# ── Dashboard stats ───────────────────────────────────────────────────────────

@router.get("/dashboard")
async def owner_dashboard(owner: User = Depends(require_owner), db: AsyncSession = Depends(get_db)):
    props = (await db.execute(select(Property).where(Property.owner_id == owner.id))).scalars().all()
    property_ids = [p.id for p in props]

    if not property_ids:
        return {"properties": 0, "bookings": 0, "total_earned": 0, "pending_payout": 0, "upcoming": []}

    bookings_result = await db.execute(
        select(Booking).where(
            Booking.property_id.in_(property_ids),
            Booking.status.in_(["confirmed", "checked_in", "completed"]),
        ).order_by(Booking.check_in.asc())
    )
    bookings = bookings_result.scalars().all()

    total_earned = sum(b.total_amount - b.platform_fee for b in bookings if b.status == "completed")
    pending_payout = sum(b.total_amount - b.platform_fee for b in bookings if b.status == "checked_in")

    upcoming = [
        {
            "id": b.id,
            "property_id": b.property_id,
            "check_in": b.check_in.isoformat(),
            "check_out": b.check_out.isoformat(),
            "checkin_code": b.checkin_code,
            "status": b.status,
            "total_amount": b.total_amount,
        }
        for b in bookings if b.status == "confirmed"
    ]

    return {
        "properties": len(props),
        "bookings": len(bookings),
        "total_earned": total_earned,
        "pending_payout": pending_payout,
        "upcoming": upcoming[:10],
    }


# ── Owner bookings list ────────────────────────────────────────────────────────

@router.get("/bookings")
async def owner_bookings(
    property_id: Optional[str] = None,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    props = (await db.execute(select(Property).where(Property.owner_id == owner.id))).scalars().all()
    ids = [p.id for p in props]
    if not ids:
        return []
    q = select(Booking).where(Booking.property_id.in_(ids))
    if property_id:
        q = q.where(Booking.property_id == property_id)
    result = await db.execute(q.order_by(Booking.check_in.desc()))
    return result.scalars().all()


# ── Availability toggle ────────────────────────────────────────────────────────

class AvailabilityToggle(BaseModel):
    property_id: str
    date: date_type
    is_blocked: bool


@router.post("/availability", status_code=200)
async def toggle_availability(
    body: AvailabilityToggle,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    prop = (await db.execute(
        select(Property).where(Property.id == body.property_id, Property.owner_id == owner.id)
    )).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    existing = (await db.execute(
        select(Availability).where(
            Availability.property_id == body.property_id,
            Availability.date == body.date,
        )
    )).scalar_one_or_none()

    if existing:
        existing.is_blocked = body.is_blocked
    else:
        db.add(Availability(
            property_id=body.property_id,
            date=body.date,
            is_blocked=body.is_blocked,
            source="manual",
        ))
    await db.commit()
    return {"date": body.date.isoformat(), "is_blocked": body.is_blocked}


# ── Image upload ──────────────────────────────────────────────────────────────

class ImageRecord(BaseModel):
    property_id: str
    cloudinary_url: str
    is_primary: bool = False
    display_order: int = 0


@router.post("/images", status_code=201)
async def add_image(
    body: ImageRecord,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    prop = (await db.execute(
        select(Property).where(Property.id == body.property_id, Property.owner_id == owner.id)
    )).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Count existing images
    count = (await db.execute(
        select(func.count(PropertyImage.id)).where(PropertyImage.property_id == body.property_id)
    )).scalar()

    img = PropertyImage(
        property_id=body.property_id,
        cloudinary_url=body.cloudinary_url,
        is_primary=body.is_primary or count == 0,
        display_order=body.display_order or count,
    )
    db.add(img)

    # Auto-activate listing once 8+ photos uploaded and still inactive
    if count + 1 >= 8 and not prop.active:
        # Mark ready for admin review (not auto-active — admin still approves)
        pass

    await db.commit()
    return {"id": img.id, "cloudinary_url": img.cloudinary_url}


# ── Claude listing description writer ────────────────────────────────────────

class DescriptionRequest(BaseModel):
    raw_details: str  # Owner types: "3 bed cottage, lake view, sleeps 6, has wifi, bbq"
    property_type: str
    price_per_night: int


@router.post("/ai/description")
async def generate_description(
    body: DescriptionRequest,
    owner: User = Depends(require_owner),
):
    from app.core.config import settings

    if not settings.CLAUDE_API_KEY:
        return {
            "description": f"A beautiful {body.property_type} in Naivasha. {body.raw_details}. "
                           f"Priced at KES {body.price_per_night:,} per night."
        }

    import anthropic
    client = anthropic.Anthropic(api_key=settings.CLAUDE_API_KEY)
    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": (
                f"Write a compelling 2-paragraph vacation rental description for a Naivasha, Kenya property. "
                f"Type: {body.property_type}. Price: KES {body.price_per_night}/night. "
                f"Owner notes: {body.raw_details}. "
                f"Tone: warm, local, inviting. No marketing fluff. Max 150 words."
            ),
        }],
    )
    return {"description": message.content[0].text}


# ── Seasonal pricing ──────────────────────────────────────────────────────────

class PricingRule(BaseModel):
    property_id: str
    price_per_night: int


@router.put("/pricing")
async def update_pricing(
    body: PricingRule,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    prop = (await db.execute(
        select(Property).where(Property.id == body.property_id, Property.owner_id == owner.id)
    )).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    prop.price_per_night = body.price_per_night
    await db.commit()
    return {"price_per_night": prop.price_per_night}
