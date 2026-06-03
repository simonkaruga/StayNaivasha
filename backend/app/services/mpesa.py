import base64
import hashlib
import hmac
from datetime import datetime, timezone

import httpx

from app.core.config import settings

DARAJA_BASE = "https://api.safaricom.co.ke"


async def get_access_token() -> str:
    credentials = base64.b64encode(
        f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}".encode()
    ).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials",
            headers={"Authorization": f"Basic {credentials}"},
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


def _stk_password() -> tuple[str, str]:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    raw = f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}"
    password = base64.b64encode(raw.encode()).decode()
    return password, timestamp


async def stk_push(phone: str, amount_kes: int, booking_id: str) -> dict:
    token = await get_access_token()
    password, timestamp = _stk_password()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{DARAJA_BASE}/mpesa/stkpush/v1/processrequest",
            json={
                "BusinessShortCode": settings.MPESA_SHORTCODE,
                "Password": password,
                "Timestamp": timestamp,
                "TransactionType": "CustomerPayBillOnline",
                "Amount": amount_kes,
                "PartyA": phone,
                "PartyB": settings.MPESA_SHORTCODE,
                "PhoneNumber": phone,
                "CallBackURL": settings.MPESA_CALLBACK_URL,
                "AccountReference": f"SN-{booking_id[:8].upper()}",
                "TransactionDesc": "StayNaivasha booking",
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()


def verify_callback_signature(payload: bytes, signature: str) -> bool:
    """Verify Safaricom webhook authenticity."""
    expected = hmac.new(settings.MPESA_CONSUMER_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
