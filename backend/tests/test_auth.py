import pytest


@pytest.mark.asyncio
async def test_register_and_login(client):
    r = await client.post("/api/auth/email/register", json={
        "phone": "+254700000001",
        "email": "test@example.com",
        "password": "securepass123",
    })
    assert r.status_code == 200, r.text
    assert r.json()["role"] in ("guest", "owner")

    r2 = await client.post("/api/auth/email/login", json={
        "email": "test@example.com",
        "password": "securepass123",
    })
    assert r2.status_code == 200, r2.text

    r3 = await client.post("/api/auth/email/login", json={
        "email": "test@example.com",
        "password": "wrongpassword",
    })
    assert r3.status_code == 401


@pytest.mark.asyncio
async def test_duplicate_email_rejected(client):
    payload = {"phone": "+254700000002", "email": "dup@example.com", "password": "pass1234"}
    r1 = await client.post("/api/auth/email/register", json=payload)
    assert r1.status_code == 200
    r2 = await client.post("/api/auth/email/register", json={**payload, "phone": "+254700000003"})
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_forgot_password_always_204(client):
    r = await client.post("/api/auth/password/forgot", json={"email": "nobody@example.com"})
    assert r.status_code == 204
