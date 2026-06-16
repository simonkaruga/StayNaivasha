from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import date

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, Booking, Payment, Availability
from app.services.mpesa import stk_push
from app.services.escrow import release_lock
from app.core.audit_log import log_event
from app.api.ws import broadcast_booking

router = APIRouter(tags=["payments"])

SAFARICOM_IPS = {
    "196.201.214.200", "196.201.214.206", "196.201.213.114",
    "196.201.214.207", "196.201.214.208", "196.201.213.44",
    "196.201.212.127", "196.201.212.138", "196.201.212.129",
    "196.201.212.136", "196.201.212.74",
}


class STKRequest(BaseModel):
    booking_id: str


@router.post("/mpesa/stk-push", status_code=status.HTTP_202_ACCEPTED)
async def initiate_stk_push(
    body: STKRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(Booking.id == body.booking_id, Booking.guest_id == user.id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "pending":
        raise HTTPException(status_code=400, detail="Booking already processed")

    from app.core.config import settings
    if not settings.MPESA_CONSUMER_KEY:
        print(f"[DEV] Would send STK Push to {user.phone} for KES {booking.total_amount}")
        return {"message": "dev_mode_stk_skipped", "booking_id": booking.id}

    resp = await stk_push(
        phone=user.phone,
        amount_kes=booking.total_amount,
        booking_id=booking.id,
    )
    return {"checkout_request_id": resp.get("CheckoutRequestID"), "booking_id": booking.id}


@router.get("/mpesa/status/{booking_id}")
async def booking_payment_status(
    booking_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Frontend polls this every 3s while waiting for STK Push confirmation."""
    result = await db.execute(
        select(Booking).where(Booking.id == booking_id, Booking.guest_id == user.id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"booking_id": booking.id, "status": booking.status, "mpesa_ref": booking.mpesa_ref}


@router.post("/mpesa/callback", status_code=status.HTTP_200_OK)
async def mpesa_callback(request: Request, db: AsyncSession = Depends(get_db)):
    forwarded_for = request.headers.get("X-Forwarded-For")
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else request.client.host
    if client_ip not in SAFARICOM_IPS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    payload = await request.json()
    stk_callback = payload.get("Body", {}).get("stkCallback", {})
    result_code = stk_callback.get("ResultCode")
    metadata = stk_callback.get("CallbackMetadata", {}).get("Item", [])

    mpesa_ref = next((i["Value"] for i in metadata if i["Name"] == "MpesaReceiptNumber"), None)
    amount = next((i["Value"] for i in metadata if i["Name"] == "Amount"), None)
    account_ref = next((i["Value"] for i in metadata if i["Name"] == "AccountReference"), None)

    if result_code != 0 or not account_ref:
        # Payment failed or cancelled — release the Redis date lock so guest can retry
        if account_ref:
            booking_prefix = account_ref.replace("SN-", "").lower()
            failed_result = await db.execute(
                select(Booking).where(Booking.id.like(f"{booking_prefix}%"))
            )
            failed_booking = failed_result.scalar_one_or_none()
            if failed_booking:
                await release_lock(
                    failed_booking.property_id,
                    failed_booking.check_in.isoformat(),
                    failed_booking.check_out.isoformat(),
                )
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    booking_prefix = account_ref.replace("SN-", "").lower()
    result = await db.execute(
        select(Booking).where(Booking.id.like(f"{booking_prefix}%"))
    )
    booking = result.scalar_one_or_none()
    if not booking:
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    booking.status = "confirmed"
    booking.mpesa_ref = mpesa_ref

    db.add(Payment(
        booking_id=booking.id,
        amount=int(amount),
        type="charge",
        mpesa_ref=mpesa_ref,
        status="completed",
    ))

    # Block dates in availability table
    current = booking.check_in
    while current < booking.check_out:
        db.add(Availability(
            property_id=booking.property_id,
            date=current,
            is_blocked=True,
            source="booking",
            booking_id=booking.id,
        ))
        current = date.fromordinal(current.toordinal() + 1)

    await db.commit()

    await log_event(db, "payment_received", booking.id, booking.guest_id,
                    {"mpesa_ref": mpesa_ref, "amount": amount})

    # Broadcast live calendar update to all browsers viewing this property
    await broadcast_booking(
        booking.property_id,
        booking.check_in.isoformat(),
        booking.check_out.isoformat(),
    )

    # Fire SMS + email notifications in background
    from app.workers.tasks import send_booking_notifications
    send_booking_notifications.delay(booking.id)

    # Release Redis date lock
    await release_lock(
        booking.property_id,
        booking.check_in.isoformat(),
        booking.check_out.isoformat(),
    )

    return {"ResultCode": 0, "ResultDesc": "Accepted"}


@router.post("/mpesa/b2c", status_code=status.HTTP_204_NO_CONTENT)
async def trigger_payout():
    # Intentional no-op — B2C payouts and refunds are driven exclusively by
    # Celery tasks (release_escrow_payout, process_refund) which call the
    # Daraja B2C API directly. This endpoint exists only for documentation.
    pass
