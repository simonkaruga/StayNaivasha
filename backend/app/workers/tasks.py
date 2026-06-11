import asyncio
from app.workers.celery_app import celery


# ── Booking notifications ─────────────────────────────────────────────────────

@celery.task(bind=True, max_retries=3)
def send_booking_notifications(self, booking_id: str) -> None:
    """Fire SMS to guest + owner after payment confirmed. Retries 3× on failure."""
    try:
        asyncio.run(_send_booking_notifications_async(booking_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


async def _send_booking_notifications_async(booking_id: str) -> None:
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.models import Booking, Property, User

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Booking).where(Booking.id == booking_id)
        )
        booking = result.scalar_one_or_none()
        if not booking:
            return

        prop_result = await db.execute(select(Property).where(Property.id == booking.property_id))
        prop = prop_result.scalar_one_or_none()

        guest_result = await db.execute(select(User).where(User.id == booking.guest_id))
        guest = guest_result.scalar_one_or_none()

        owner = (await db.execute(select(User).where(User.id == prop.owner_id))).scalar_one_or_none() if prop else None

        if guest and prop:
            await _send_sms(
                guest.phone,
                f"Booking confirmed! {prop.title}. "
                f"Check-in: {booking.check_in}. Code: {booking.checkin_code}. "
                f"Ref: {booking.mpesa_ref}"
            )

        if owner and prop:
            nights = (booking.check_out - booking.check_in).days
            payout = booking.total_amount - booking.platform_fee
            await _send_sms(
                owner.phone,
                f"New booking! {prop.title}. "
                f"{booking.check_in} to {booking.check_out} ({nights} nights). "
                f"KES {payout:,} payout after check-in."
            )


# ── M-Pesa B2C payout ────────────────────────────────────────────────────────

@celery.task(bind=True, max_retries=3)
def release_escrow_payout(self, booking_id: str) -> None:
    """Send M-Pesa B2C payout to owner after check-in confirmed."""
    try:
        asyncio.run(_release_payout_async(booking_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


async def _release_payout_async(booking_id: str) -> None:
    import httpx
    import base64
    from datetime import datetime, timezone
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.core.config import settings
    from app.core.audit_log import log_event
    from app.models.models import Booking, Property, User, Payment

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Booking).where(Booking.id == booking_id))
        booking = result.scalar_one_or_none()
        if not booking:
            return

        prop = (await db.execute(select(Property).where(Property.id == booking.property_id))).scalar_one_or_none()
        owner = (await db.execute(select(User).where(User.id == prop.owner_id))).scalar_one_or_none() if prop else None

        if not owner or not settings.MPESA_CONSUMER_KEY:
            print(f"[DEV] Would pay out KES {booking.total_amount - booking.platform_fee} to owner {owner.phone if owner else '?'}")
            return

        payout_amount = booking.total_amount - booking.platform_fee

        # Get Daraja access token
        credentials = base64.b64encode(
            f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}".encode()
        ).decode()
        async with httpx.AsyncClient() as client:
            token_resp = await client.get(
                "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
                headers={"Authorization": f"Basic {credentials}"},
            )
            token = token_resp.json()["access_token"]

            b2c_resp = await client.post(
                "https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest",
                json={
                    "InitiatorName": settings.MPESA_SHORTCODE,
                    "SecurityCredential": settings.MPESA_SECURITY_CREDENTIAL,
                    "CommandID": "BusinessPayment",
                    "Amount": payout_amount,
                    "PartyA": settings.MPESA_SHORTCODE,
                    "PartyB": owner.phone,
                    "Remarks": f"Payout for booking {booking_id[:8]}",
                    "QueueTimeOutURL": f"{settings.MPESA_CALLBACK_URL}/b2c/timeout",
                    "ResultURL": f"{settings.MPESA_CALLBACK_URL}/b2c/result",
                    "Occasion": "",
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            b2c_data = b2c_resp.json()

        # Record payout payment row
        payout = Payment(
            booking_id=booking_id,
            amount=payout_amount,
            type="payout",
            mpesa_ref=b2c_data.get("ConversationID"),
            status="pending",
        )
        db.add(payout)
        await db.commit()

        await log_event(db, "escrow_released", booking_id, None,
                        {"owner_phone": owner.phone, "amount": payout_amount})


# ── Push notifications ────────────────────────────────────────────────────────

@celery.task
def send_push_notification(user_id: str, title: str, body: str) -> None:
    """FCM push — max 3/user/day, quiet hours 22:00–07:00 EAT."""
    import pytz
    from datetime import datetime

    eat = pytz.timezone("Africa/Nairobi")
    now_eat = datetime.now(eat)
    if now_eat.hour >= 22 or now_eat.hour < 7:
        return  # Respect quiet hours

    asyncio.run(_check_and_send_push(user_id, title, body))


async def _check_and_send_push(user_id: str, title: str, body: str) -> None:
    from app.core.redis import redis
    from datetime import date

    key = f"push_daily:{user_id}:{date.today().isoformat()}"
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 86400)
        if count > 3:
            return  # Cap: max 3 push notifications per user per day
    except Exception:
        pass  # Redis unavailable — allow through

    await _send_push_async(user_id, title, body)


async def _send_push_async(user_id: str, title: str, body: str) -> None:
    import httpx
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.core.config import settings
    from app.models.models import User

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.fcm_token or not settings.FCM_SERVER_KEY:
            return

        async with httpx.AsyncClient() as client:
            await client.post(
                "https://fcm.googleapis.com/fcm/send",
                json={"to": user.fcm_token, "notification": {"title": title, "body": body}},
                headers={"Authorization": f"key={settings.FCM_SERVER_KEY}"},
                timeout=10,
            )


# ── iCal sync ────────────────────────────────────────────────────────────────

@celery.task
def sync_all_icals() -> None:
    """Poll all owner iCal import URLs every 2 hours."""
    asyncio.run(_sync_icals_async())


async def _sync_icals_async() -> None:
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.models import Property, Availability
    from app.services.ical import parse_remote_ical
    from datetime import date

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Property).where(Property.ical_import_url.isnot(None), Property.active == True)
        )
        properties = result.scalars().all()

        for prop in properties:
            try:
                blocked_ranges = await parse_remote_ical(prop.ical_import_url)
                for start, end in blocked_ranges:
                    current = start
                    while current < end:
                        # Upsert — skip if already blocked
                        existing = await db.execute(
                            select(Availability).where(
                                Availability.property_id == prop.id,
                                Availability.date == current,
                            )
                        )
                        if not existing.scalar_one_or_none():
                            db.add(Availability(
                                property_id=prop.id,
                                date=current,
                                is_blocked=True,
                                source="ical",
                            ))
                        current = date.fromordinal(current.toordinal() + 1)
                await db.commit()
            except Exception as e:
                print(f"[iCal sync] Failed for property {prop.id}: {e}")


# ── Refund processing ────────────────────────────────────────────────────────

@celery.task(bind=True, max_retries=3)
def process_refund(self, booking_id: str, refund_amount: int) -> None:
    """Initiate M-Pesa refund to guest after cancellation."""
    try:
        asyncio.run(_process_refund_async(booking_id, refund_amount))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


async def _process_refund_async(booking_id: str, refund_amount: int) -> None:
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.core.config import settings
    from app.core.audit_log import log_event
    from app.models.models import Booking, User, Payment

    async with AsyncSessionLocal() as db:
        booking = (await db.execute(select(Booking).where(Booking.id == booking_id))).scalar_one_or_none()
        if not booking:
            return
        guest = (await db.execute(select(User).where(User.id == booking.guest_id))).scalar_one_or_none()
        if not guest:
            return

        # Log refund payment row
        payment = Payment(
            booking_id=booking_id,
            amount=refund_amount,
            type="refund",
            status="pending",
        )
        db.add(payment)
        await db.commit()
        await log_event(db, "refund_initiated", booking_id, None,
                        {"guest_phone": guest.phone, "amount": refund_amount})

        if not settings.MPESA_CONSUMER_KEY:
            print(f"[DEV] Would refund KES {refund_amount} to {guest.phone}")
            await _send_sms(guest.phone, f"Your cancellation refund of KES {refund_amount:,} is being processed. 3–5 business days.")
            return

        # M-Pesa B2C to guest (same flow as owner payout)
        import httpx, base64
        credentials = base64.b64encode(
            f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}".encode()
        ).decode()
        async with httpx.AsyncClient() as client:
            token = (await client.get(
                "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
                headers={"Authorization": f"Basic {credentials}"},
            )).json()["access_token"]
            await client.post(
                "https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest",
                json={
                    "InitiatorName": settings.MPESA_SHORTCODE,
                    "SecurityCredential": settings.MPESA_SECURITY_CREDENTIAL,
                    "CommandID": "BusinessPayment",
                    "Amount": refund_amount,
                    "PartyA": settings.MPESA_SHORTCODE,
                    "PartyB": guest.phone,
                    "Remarks": f"Refund booking {booking_id[:8]}",
                    "QueueTimeOutURL": f"{settings.MPESA_CALLBACK_URL}/b2c/timeout",
                    "ResultURL": f"{settings.MPESA_CALLBACK_URL}/b2c/result",
                    "Occasion": "",
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )


# ── Check-in reminders ────────────────────────────────────────────────────────

@celery.task
def send_checkin_reminders() -> None:
    """Send 24-hour check-in reminder to guests checking in tomorrow."""
    asyncio.run(_send_reminders_async())


async def _send_reminders_async() -> None:
    from datetime import date, timedelta
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.models import Booking, Property, User

    tomorrow = date.today() + timedelta(days=1)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Booking).where(
                Booking.check_in == tomorrow,
                Booking.status == "confirmed",
            )
        )
        bookings = result.scalars().all()

        for booking in bookings:
            prop = (await db.execute(select(Property).where(Property.id == booking.property_id))).scalar_one_or_none()
            guest = (await db.execute(select(User).where(User.id == booking.guest_id))).scalar_one_or_none()
            if guest and prop:
                await _send_sms(
                    guest.phone,
                    f"Reminder: Check-in tomorrow at {prop.title}. "
                    f"Code: {booking.checkin_code}. "
                    f"{prop.landmark_instructions or 'See booking confirmation for directions.'}"
                )


# ── Shared SMS helper ─────────────────────────────────────────────────────────

async def _send_sms(phone: str, message: str) -> None:
    import httpx
    from app.core.config import settings

    if not settings.AT_API_KEY:
        print(f"[DEV SMS] {phone}: {message}")
        return

    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.africastalking.com/version1/messaging",
            data={"username": settings.AT_USERNAME, "to": phone, "message": message},
            headers={"apiKey": settings.AT_API_KEY, "Accept": "application/json"},
            timeout=10,
        )
