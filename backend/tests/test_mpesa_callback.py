import pytest
import uuid
from datetime import date, timedelta
from unittest.mock import patch
from sqlalchemy import select

from app.models.models import User, Property, Booking
from tests.conftest import auth_cookies, session_factory

SAFARICOM_IP = "196.201.214.200"


async def _seed_pending_booking(db) -> str:
    owner_id   = str(uuid.uuid4())
    guest_id   = str(uuid.uuid4())
    prop_id    = str(uuid.uuid4())
    booking_id = str(uuid.uuid4())

    checkin  = date.today() + timedelta(days=3)
    checkout = checkin + timedelta(days=2)

    db.add(User(id=owner_id, phone=f"+25470{owner_id[:8]}", role="owner"))
    db.add(User(id=guest_id, phone=f"+25471{guest_id[:8]}", role="guest"))
    db.add(Property(
        id=prop_id, owner_id=owner_id, title="Callback Test Villa",
        type="villa", price_per_night=8000, min_nights=1, active=True,
    ))
    db.add(Booking(
        id=booking_id, guest_id=guest_id, property_id=prop_id,
        check_in=checkin, check_out=checkout,
        total_amount=16600, platform_fee=600,
        status="pending", checkin_code="9999",
    ))
    await db.commit()
    return booking_id


def _payload(booking_id: str, result_code: int = 0):
    short_ref = f"SN-{booking_id.replace('-', '').upper()[:10]}"
    items = [{"Name": "AccountReference", "Value": short_ref}]
    if result_code == 0:
        items += [
            {"Name": "MpesaReceiptNumber", "Value": "QKJ38ABCDE"},
            {"Name": "Amount",             "Value": 16600},
        ]
    return {"Body": {"stkCallback": {"ResultCode": result_code, "CallbackMetadata": {"Item": items}}}}


@pytest.mark.asyncio
async def test_successful_callback_confirms_booking(client, db):
    booking_id = await _seed_pending_booking(db)

    with patch("app.workers.tasks.send_booking_notifications.delay"):
        r = await client.post(
            "/api/payments/mpesa/callback",
            json=_payload(booking_id, 0),
            headers={"X-Forwarded-For": SAFARICOM_IP},
        )
    assert r.status_code == 200

    async with session_factory() as s:
        b = (await s.execute(select(Booking).where(Booking.id == booking_id))).scalar_one()
        assert b.status == "confirmed"
        assert b.mpesa_ref == "QKJ38ABCDE"


@pytest.mark.asyncio
async def test_failed_callback_leaves_booking_pending(client, db):
    booking_id = await _seed_pending_booking(db)

    with patch("app.workers.tasks.send_booking_notifications.delay"):
        r = await client.post(
            "/api/payments/mpesa/callback",
            json=_payload(booking_id, 1),
            headers={"X-Forwarded-For": SAFARICOM_IP},
        )
    assert r.status_code == 200

    async with session_factory() as s:
        b = (await s.execute(select(Booking).where(Booking.id == booking_id))).scalar_one()
        assert b.status == "pending"


@pytest.mark.asyncio
async def test_unknown_ip_rejected(client):
    r = await client.post(
        "/api/payments/mpesa/callback",
        json={"Body": {"stkCallback": {"ResultCode": 0, "CallbackMetadata": {"Item": []}}}},
        headers={"X-Forwarded-For": "1.2.3.4"},
    )
    assert r.status_code == 403
