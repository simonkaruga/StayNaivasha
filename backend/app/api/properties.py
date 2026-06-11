from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_owner, rate_limit
from app.models.models import User, Property, PropertyImage, Review, Booking, Availability
from app.schemas.schemas import PropertyCreate, PropertyOut, PropertyListOut

router = APIRouter(tags=["properties"])


@router.get("/", response_model=list[PropertyListOut])
async def list_properties(
    request: Request,
    location: Optional[str] = Query(None),
    min_price: Optional[int] = Query(None),
    max_price: Optional[int] = Query(None),
    guests: Optional[int] = Query(None),
    property_type: Optional[str] = Query(None),
    owner: Optional[str] = Query(None),
    check_in: Optional[date] = Query(None),
    check_out: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(lambda: None),
):
    await rate_limit(f"search:{request.client.host}", limit=100, window=60)

    # owner=me — return this authenticated owner's own properties (active or not)
    if owner == "me":
        from fastapi import Cookie
        from app.core.security import decode_token
        from jose import JWTError
        access_token = request.cookies.get("access_token")
        owner_id: Optional[str] = None
        if access_token:
            try:
                payload = decode_token(access_token)
                owner_id = payload["sub"]
            except JWTError:
                pass
        if not owner_id:
            return []
        stmt = (
            select(Property)
            .where(Property.owner_id == owner_id)
            .options(selectinload(Property.images))
            .offset(skip).limit(limit)
        )
        result = await db.execute(stmt)
        properties = result.scalars().all()
        return [_to_list_out(p, None, None) for p in properties]

    stmt = (
        select(Property)
        .where(Property.active == True)
        .options(selectinload(Property.images))
        .offset(skip)
        .limit(limit)
    )
    if min_price:
        stmt = stmt.where(Property.price_per_night >= min_price)
    if max_price:
        stmt = stmt.where(Property.price_per_night <= max_price)
    if property_type:
        stmt = stmt.where(Property.type == property_type)

    if check_in and check_out and check_out > check_in:
        nights = (check_out - check_in).days
        # Exclude properties already blocked on any of the requested dates
        blocked_ids_stmt = (
            select(Availability.property_id)
            .where(
                Availability.is_blocked == True,
                Availability.date >= check_in,
                Availability.date < check_out,
            )
            .distinct()
        )
        stmt = stmt.where(Property.id.not_in(blocked_ids_stmt))
        # Respect minimum stay rules
        stmt = stmt.where(Property.min_nights <= nights)

    result = await db.execute(stmt)
    properties = result.scalars().all()

    # Batch-load avg ratings for all properties
    if properties:
        ids = [p.id for p in properties]
        rating_rows = await db.execute(
            select(
                Booking.property_id,
                func.avg(
                    (Review.accuracy_score + Review.cleanliness_score +
                     Review.location_score + Review.value_score) / 4.0
                ).label("avg"),
                func.count(Review.id).label("cnt"),
            )
            .join(Review, Review.booking_id == Booking.id)
            .where(Booking.property_id.in_(ids))
            .group_by(Booking.property_id)
        )
        rating_map = {row.property_id: (row.avg, row.cnt) for row in rating_rows}
    else:
        rating_map = {}

    out = []
    for p in properties:
        avg, cnt = rating_map.get(p.id, (None, None))
        out.append(_to_list_out(p, avg, cnt))
    return out


def _to_list_out(p: Property, avg_rating, review_count) -> PropertyListOut:
    primary = next((img.cloudinary_url for img in p.images if img.is_primary), None)
    if not primary and p.images:
        primary = sorted(p.images, key=lambda i: i.display_order)[0].cloudinary_url
    return PropertyListOut(
        id=p.id, title=p.title, type=p.type,
        price_per_night=p.price_per_night, verified_tier=p.verified_tier,
        primary_image=primary, lat=p.lat, lng=p.lng,
        avg_rating=round(float(avg_rating), 1) if avg_rating else None,
        review_count=int(review_count) if review_count else None,
    )


@router.get("/stats")
async def property_stats(db: AsyncSession = Depends(get_db)):
    prop_count = (await db.execute(select(func.count()).where(Property.active == True))).scalar_one()
    booking_count = (await db.execute(select(func.count()).select_from(Booking))).scalar_one()
    avg_rating_row = await db.execute(
        select(func.avg((Review.accuracy_score + Review.cleanliness_score + Review.location_score + Review.value_score) / 4.0))
    )
    avg_rating = avg_rating_row.scalar_one() or 0
    return {"property_count": prop_count, "booking_count": booking_count, "avg_rating": round(float(avg_rating), 1)}


@router.get("/{property_id}", response_model=PropertyOut)
async def get_property(property_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Property)
        .where(Property.id == property_id)
        .options(selectinload(Property.images))
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return prop


@router.post("/", response_model=PropertyOut, status_code=status.HTTP_201_CREATED)
async def create_property(
    body: PropertyCreate,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    # Rate limit: 5 new listings per owner per day
    await rate_limit(f"create_prop:{owner.id}", limit=5, window=86400)

    prop = Property(
        owner_id=owner.id,
        title=body.title,
        type=body.type,
        price_per_night=body.price_per_night,
        description=body.description,
        lat=body.lat,
        lng=body.lng,
        what3words=body.what3words,
        landmark_instructions=body.landmark_instructions,
        min_nights=body.min_nights,
        no_checkout_days=body.no_checkout_days,
        response_time_hours=body.response_time_hours,
        cancellation_policy=body.cancellation_policy,
        active=False,  # Goes live only after admin approves + 8 photos verified
    )
    db.add(prop)
    await db.commit()
    await db.refresh(prop)
    return prop


@router.get("/{property_id}/availability")
async def property_availability(
    property_id: str,
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Availability).where(
            Availability.property_id == property_id,
            extract("year", Availability.date) == year,
            extract("month", Availability.date) == month,
        )
    )
    rows = result.scalars().all()
    return [{"date": r.date.isoformat(), "is_blocked": r.is_blocked, "source": r.source} for r in rows]


@router.post("/{property_id}/chat")
async def property_chat(
    property_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Guest AI chatbot — answers questions about this specific property."""
    body = await request.json()
    message: str = body.get("message", "")[:500]
    history: list = body.get("history", [])[-6:]  # last 3 turns

    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    prop = (await db.execute(
        select(Property).where(Property.id == property_id)
    )).scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    from app.core.config import settings

    # Fallback if no Claude key
    if not settings.CLAUDE_API_KEY:
        return {"reply": f"I'm the assistant for {prop.title}. For questions call or WhatsApp us — we respond within {prop.response_time_hours or 2} hours."}

    import anthropic
    client = anthropic.Anthropic(api_key=settings.CLAUDE_API_KEY)

    system_prompt = f"""You are the helpful assistant for a vacation rental property listed on StayNaivasha.
Property: {prop.title}
Type: {prop.type}
Price: KES {prop.price_per_night:,}/night
Min stay: {prop.min_nights} nights
Location: Naivasha, Kenya. {prop.landmark_instructions or ""}
What3words: {prop.what3words or "not set"}
Description: {prop.description or "A lovely property in Naivasha."}

Answer questions about this property concisely. For booking, direct guests to the Reserve button on this page.
Payments are via M-Pesa. Guests pay a KES 300 convenience fee + 2% tourism levy.
If you don't know something specific, say you'll check with the owner.
Keep replies under 80 words. Be warm and local."""

    messages = [{"role": m["role"], "content": m["content"]} for m in history if m.get("role") in ("user","assistant")]
    messages.append({"role": "user", "content": message})

    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        system=system_prompt,
        messages=messages,
    )
    return {"reply": resp.content[0].text}


@router.put("/{property_id}", response_model=PropertyOut)
async def update_property(
    property_id: str,
    body: PropertyCreate,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Property).where(Property.id == property_id, Property.owner_id == owner.id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(prop, field, value)
    await db.commit()
    await db.refresh(prop)
    return prop
