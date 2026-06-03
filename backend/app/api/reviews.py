from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.deps import get_current_user, require_owner
from app.models.models import User, Booking, Review

router = APIRouter(tags=["reviews"])


class ReviewCreate(BaseModel):
    booking_id: str
    accuracy_score: int = Field(..., ge=1, le=5)
    cleanliness_score: int = Field(..., ge=1, le=5)
    location_score: int = Field(..., ge=1, le=5)
    value_score: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)


class ReviewOut(BaseModel):
    id: str
    booking_id: str
    accuracy_score: int
    cleanliness_score: int
    location_score: int
    value_score: int
    comment: Optional[str]
    owner_response: Optional[str]
    avg_score: float
    created_at: datetime

    class Config:
        from_attributes = True


class OwnerResponse(BaseModel):
    response: str = Field(..., max_length=500)


@router.post("/", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def create_review(
    body: ReviewCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Only confirmed guests who stayed can review
    booking = (await db.execute(
        select(Booking).where(
            Booking.id == body.booking_id,
            Booking.guest_id == user.id,
            Booking.status.in_(["checked_in", "completed"]),
        )
    )).scalar_one_or_none()

    if not booking:
        raise HTTPException(status_code=403, detail="Only confirmed guests can leave a review")

    existing = (await db.execute(
        select(Review).where(Review.booking_id == body.booking_id)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Review already submitted for this booking")

    review = Review(
        booking_id=body.booking_id,
        accuracy_score=body.accuracy_score,
        cleanliness_score=body.cleanliness_score,
        location_score=body.location_score,
        value_score=body.value_score,
        comment=body.comment,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return _with_avg(review)


@router.get("/property/{property_id}", response_model=list[ReviewOut])
async def list_property_reviews(property_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Review)
        .join(Booking, Review.booking_id == Booking.id)
        .where(Booking.property_id == property_id)
        .order_by(Review.created_at.desc())
    )
    return [_with_avg(r) for r in result.scalars().all()]


@router.post("/{review_id}/respond", response_model=ReviewOut)
async def owner_respond(
    review_id: str,
    body: OwnerResponse,
    owner: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    review = (await db.execute(select(Review).where(Review.id == review_id))).scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    review.owner_response = body.response
    await db.commit()
    await db.refresh(review)
    return _with_avg(review)


def _with_avg(r: Review) -> dict:
    avg = (r.accuracy_score + r.cleanliness_score + r.location_score + r.value_score) / 4
    data = ReviewOut.model_validate(r).model_dump()
    data["avg_score"] = round(avg, 1)
    return data
