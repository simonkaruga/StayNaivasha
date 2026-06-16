import pytest
import uuid
from datetime import date, timedelta
from sqlalchemy import select

from app.models.models import User, Property, Booking
from tests.conftest import auth_cookies, session_factory


async def _seed_owner_and_property(db) -> tuple[str, str]:
    owner_id = str(uuid.uuid4())
    prop_id  = str(uuid.uuid4())
    db.add(User(id=owner_id, phone=f"+2547{owner_id[:8]}", role="owner"))
    db.add(Property(
        id=prop_id, owner_id=owner_id, title="Test Cottage",
        type="cottage", price_per_night=5000, min_nights=1, active=True,
    ))
    await db.commit()
    return owner_id, prop_id


async def _seed_guest(db) -> str:
    guest_id = str(uuid.uuid4())
    db.add(User(id=guest_id, phone=f"+2541{guest_id[:8]}", role="guest"))
    await db.commit()
    return guest_id


@pytest.mark.asyncio
async def test_create_booking(client, db):
    _, prop_id = await _seed_owner_and_property(db)
    guest_id   = await _seed_guest(db)

    tomorrow  = date.today() + timedelta(days=1)
    day_after = tomorrow + timedelta(days=2)

    r = await client.post(
        "/api/bookings/",
        json={
            "property_id": prop_id,
            "check_in":  tomorrow.isoformat(),
            "check_out": day_after.isoformat(),
            "guests": 2,
            "terms_accepted": True,
        },
        cookies=auth_cookies(guest_id),
    )
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "pending"
    assert r.json()["property_id"] == prop_id


@pytest.mark.asyncio
async def test_double_booking_rejected(client, db):
    _, prop_id = await _seed_owner_and_property(db)
    g1 = await _seed_guest(db)
    g2 = await _seed_guest(db)

    checkin  = date.today() + timedelta(days=20)
    checkout = checkin + timedelta(days=2)
    payload  = {
        "property_id": prop_id,
        "check_in":  checkin.isoformat(),
        "check_out": checkout.isoformat(),
        "guests": 1,
        "terms_accepted": True,
    }

    r1 = await client.post("/api/bookings/", json=payload, cookies=auth_cookies(g1))
    assert r1.status_code == 201, r1.text

    b = (await db.execute(select(Booking).where(Booking.id == r1.json()["id"]))).scalar_one()
    b.status = "confirmed"
    await db.commit()

    r2 = await client.post("/api/bookings/", json=payload, cookies=auth_cookies(g2))
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_cancel_full_refund_when_far_out(client, db):
    _, prop_id = await _seed_owner_and_property(db)
    guest_id   = await _seed_guest(db)

    checkin  = date.today() + timedelta(days=10)
    checkout = checkin + timedelta(days=2)

    r = await client.post(
        "/api/bookings/",
        json={
            "property_id": prop_id,
            "check_in":  checkin.isoformat(),
            "check_out": checkout.isoformat(),
            "guests": 1,
            "terms_accepted": True,
        },
        cookies=auth_cookies(guest_id),
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["id"]

    b = (await db.execute(select(Booking).where(Booking.id == booking_id))).scalar_one()
    b.status = "confirmed"
    await db.commit()

    r2 = await client.post(
        f"/api/bookings/{booking_id}/cancel",
        json={"reason": "Changed plans"},
        cookies=auth_cookies(guest_id),
    )
    assert r2.status_code == 200
    assert r2.json()["refund_pct"] == 100
