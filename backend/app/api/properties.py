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
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(f"search:{request.client.host}", limit=100, window=60)

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

    result = await db.execute(stmt)
    properties = result.scalars().all()

    out = []
    for p in properties:
        primary = next((img.cloudinary_url for img in p.images if img.is_primary), None)
        if not primary and p.images:
            primary = sorted(p.images, key=lambda i: i.display_order)[0].cloudinary_url
        out.append(PropertyListOut(
            id=p.id, title=p.title, type=p.type,
            price_per_night=p.price_per_night, verified_tier=p.verified_tier,
            primary_image=primary, lat=p.lat, lng=p.lng,
        ))
    return out


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
