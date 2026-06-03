import random
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user, rate_limit
from app.models.models import User, Property, Booking, Availability, PromoCode
from app.schemas.schemas import BookingCreate, BookingOut
from app.services.escrow import acquire_lock, release_lock
from app.services.mpesa import stk_push

router = APIRouter(tags=["bookings"])

PLATFORM_FEE_KES = 300
TOURISM_LEVY_PCT = 0.02


def _checkin_code() -> str:
    return "".join(random.choices(string.digits, k=4))


def _deposit_amount(price: int) -> int:
    if price < 5000:
        return 2000
    if price < 20000:
        return 5000
    return 15000


@router.post("/", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
async def create_booking(
    body: BookingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await rate_limit(f"booking:{user.id}", limit=10, window=3600)

    if not body.terms_accepted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Terms must be accepted")

    if body.check_out <= body.check_in:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Check-out must be after check-in")

    # Load property
    result = await db.execute(select(Property).where(Property.id == body.property_id, Property.active == True))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    # Minimum stay rule
    nights = (body.check_out - body.check_in).days
    if nights < prop.min_nights:
        raise HTTPException(status_code=400, detail=f"Minimum stay is {prop.min_nights} nights")

    check_in_str = body.check_in.isoformat()
    check_out_str = body.check_out.isoformat()

    # Check availability in DB
    blocked = await db.execute(
        select(Availability).where(
            Availability.property_id == body.property_id,
            Availability.date >= body.check_in,
            Availability.date < body.check_out,
            Availability.is_blocked == True,
        )
    )
    if blocked.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Dates not available")

    # Acquire Redis soft lock
    locked = await acquire_lock(body.property_id, check_in_str, check_out_str)
    if not locked:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Dates just booked — please try different dates")

    # Promo code
    discount = 0
    promo_id = None
    if body.promo_code:
        promo_result = await db.execute(
            select(PromoCode).where(
                PromoCode.code == body.promo_code,
                PromoCode.used_count < PromoCode.max_uses,
            )
        )
        promo = promo_result.scalar_one_or_none()
        if promo:
            discount = promo.discount_kes
            promo_id = promo.id
            promo.used_count += 1

    # Calculate totals — all KES integers
    base = prop.price_per_night * nights
    levy = int(base * TOURISM_LEVY_PCT)
    total = base + levy + PLATFORM_FEE_KES - discount
    deposit = _deposit_amount(prop.price_per_night)

    booking = Booking(
        guest_id=user.id,
        property_id=prop.id,
        check_in=body.check_in,
        check_out=body.check_out,
        total_amount=total,
        platform_fee=PLATFORM_FEE_KES,
        deposit_amount=deposit,
        promo_code_id=promo_id,
        status="pending",
        checkin_code=_checkin_code(),
        terms_accepted_at=datetime.now(timezone.utc),
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking


@router.get("/mine", response_model=list[BookingOut])
async def my_bookings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking)
        .where(Booking.guest_id == user.id)
        .order_by(Booking.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(
    booking_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    # Guest sees own bookings; owner/admin see all
    if user.role == "guest" and booking.guest_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return booking


@router.post("/{booking_id}/checkin", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_checkin(
    booking_id: str,
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.checkin_code != code:
        raise HTTPException(status_code=400, detail="Invalid check-in code")
    if booking.status != "confirmed":
        raise HTTPException(status_code=400, detail="Booking not in confirmed state")

    booking.status = "checked_in"
    await db.commit()

    # Trigger payout via Celery (non-blocking)
    from app.workers.tasks import release_escrow_payout
    release_escrow_payout.delay(booking_id)


class CancelBooking(BaseModel):
    reason: str = "Guest cancellation"


CANCEL_REFUND_RULES = {
    # days_before_checkin: refund_pct
    7: 100,
    3: 50,
    0: 0,
}


@router.post("/{booking_id}/cancel", status_code=status.HTTP_200_OK)
async def cancel_booking(
    booking_id: str,
    body: CancelBooking,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as date_type
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only guest (own booking) or admin can cancel
    if user.role == "guest" and booking.guest_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if booking.status not in ("pending", "confirmed"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {booking.status} booking")

    days_until = (booking.check_in - date_type.today()).days
    refund_pct = 0
    for threshold, pct in sorted(CANCEL_REFUND_RULES.items(), reverse=True):
        if days_until >= threshold:
            refund_pct = pct
            break

    refund_amount = int(booking.total_amount * refund_pct / 100)
    booking.status = "cancelled"
    await db.commit()

    # Queue refund task if applicable
    if refund_amount > 0 and booking.mpesa_ref:
        from app.workers.tasks import process_refund
        process_refund.delay(booking_id, refund_amount)

    return {"status": "cancelled", "refund_pct": refund_pct, "refund_amount": refund_amount}
