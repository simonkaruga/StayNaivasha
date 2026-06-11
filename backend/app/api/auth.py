import random
import string
from datetime import timedelta

from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.redis import redis
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.core.config import settings
from app.core.deps import rate_limit, get_current_user, get_current_user_optional
from app.models.models import User
from app.schemas.schemas import OTPRequest, OTPVerify, TokenResponse

router = APIRouter(tags=["auth"])

OTP_TTL = 300  # 5 minutes


@router.get("/me", response_model=TokenResponse)
async def get_me(user: User = Depends(get_current_user_optional)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return TokenResponse(user_id=user.id, role=user.role, phone=user.phone, name=user.name)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

@router.put("/me", response_model=TokenResponse)
async def update_profile(
    body: ProfileUpdate,
    user: User = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if body.name is not None:
        user.name = body.name.strip() or None
    if body.email is not None:
        user.email = body.email.strip() or None
    await db.commit()
    await db.refresh(user)
    return TokenResponse(user_id=user.id, role=user.role, phone=user.phone, name=user.name)


def _otp_key(phone: str) -> str:
    return f"otp:{phone}"


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


async def _send_sms(phone: str, message: str) -> None:
    """Send SMS via Africa's Talking. Always prints OTP to console for dev visibility."""
    print(f"[OTP] {phone}: {message}")
    if not settings.AT_API_KEY:
        return
    import httpx
    is_sandbox = settings.AT_USERNAME == "sandbox"
    url = "https://api.sandbox.africastalking.com/version1/messaging" if is_sandbox else "https://api.africastalking.com/version1/messaging"
    async with httpx.AsyncClient() as client:
        r = await client.post(
            url,
            data={"username": settings.AT_USERNAME, "to": phone, "message": message},
            headers={"apiKey": settings.AT_API_KEY, "Accept": "application/json"},
        )
        print(f"[AT SMS] status={r.status_code} body={r.text}")


# In-memory OTP fallback for dev when Redis is unavailable
_otp_fallback: dict[str, str] = {}


async def _redis_ok() -> bool:
    try:
        await redis.ping()
        return True
    except Exception:
        return False


@router.post("/otp/request", status_code=status.HTTP_204_NO_CONTENT)
async def request_otp(body: OTPRequest, request: Request):
    await rate_limit(f"otp_req:{body.phone}", limit=3, window=1800)

    otp = _generate_otp()
    if await _redis_ok():
        await redis.set(_otp_key(body.phone), otp, ex=OTP_TTL)
    else:
        _otp_fallback[body.phone] = otp
    await _send_sms(body.phone, f"Your StayNaivasha code is {otp}. Valid 5 minutes.")


@router.post("/otp/verify", response_model=TokenResponse)
async def verify_otp(body: OTPVerify, response: Response, db: AsyncSession = Depends(get_db)):
    if await _redis_ok():
        stored = await redis.get(_otp_key(body.phone))
        await redis.delete(_otp_key(body.phone))
    else:
        stored = _otp_fallback.pop(body.phone, None)

    if not stored or stored != body.code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")

    result = await db.execute(select(User).where(User.phone == body.phone))
    user = result.scalar_one_or_none()
    if not user:
        user = User(phone=body.phone)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    if await _redis_ok():
        await redis.set(f"refresh:{user.id}", refresh_token, ex=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)

    _set_cookies(response, access_token, refresh_token)
    return TokenResponse(user_id=user.id, role=user.role, phone=user.phone, name=user.name)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    try:
        payload = decode_token(token)
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if await _redis_ok():
        stored = await redis.get(f"refresh:{user_id}")
        if stored != token:
            await redis.delete(f"refresh:{user_id}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token reuse detected")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_access = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)
    if await _redis_ok():
        await redis.set(f"refresh:{user_id}", new_refresh, ex=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)

    _set_cookies(response, new_access, new_refresh)
    return TokenResponse(user_id=user.id, role=user.role, phone=user.phone, name=user.name)


@router.post("/push-subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def push_subscribe(
    request: Request,
    user: User = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Store Web Push subscription endpoint as the user's FCM token slot."""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    # Store the push endpoint string in fcm_token for the push task to use
    endpoint = body.get("endpoint", "")
    if endpoint:
        user.fcm_token = endpoint
        await db.commit()


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if token:
        try:
            payload = decode_token(token)
            if await _redis_ok():
                await redis.delete(f"refresh:{payload['sub']}")
        except Exception:
            pass
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")


def _set_cookies(response: Response, access: str, refresh: str) -> None:
    secure = not settings.AT_USERNAME == "sandbox"  # http in dev, https in prod
    response.set_cookie("access_token", access, httponly=True, samesite="lax", secure=secure,
                        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie("refresh_token", refresh, httponly=True, samesite="lax", secure=secure,
                        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, path="/api/auth")
