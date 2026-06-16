import random
import secrets
import string
from datetime import timedelta
from urllib.parse import urlencode

from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from fastapi.responses import RedirectResponse
from passlib.context import CryptContext
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

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

GOOGLE_AUTH_URL    = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL   = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _otp_key(phone: str) -> str:
    return f"otp:{phone}"

def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))

def _pw_reset_key(token: str) -> str:
    return f"pw_reset:{token}"

async def _redis_ok() -> bool:
    try:
        await redis.ping()
        return True
    except Exception:
        return False

def _set_cookies(response: Response, access: str, refresh: str) -> None:
    secure = settings.AT_USERNAME != "sandbox"  # http in dev, https in prod
    response.set_cookie("access_token", access, httponly=True, samesite="lax", secure=secure,
                        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie("refresh_token", refresh, httponly=True, samesite="lax", secure=secure,
                        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, path="/api/auth")

def _token_resp(user: User) -> TokenResponse:
    return TokenResponse(user_id=user.id, role=user.role, phone=user.phone,
                         name=user.name, email=user.email)

async def _issue_tokens(user: User, response: Response) -> TokenResponse:
    access  = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    if await _redis_ok():
        await redis.set(f"refresh:{user.id}", refresh, ex=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)
    _set_cookies(response, access, refresh)
    return _token_resp(user)

async def _send_sms(phone: str, message: str) -> None:
    print(f"[OTP] {phone}: {message}")
    if not settings.AT_API_KEY:
        return
    import httpx
    is_sandbox = settings.AT_USERNAME == "sandbox"
    url = ("https://api.sandbox.africastalking.com/version1/messaging" if is_sandbox
           else "https://api.africastalking.com/version1/messaging")
    async with httpx.AsyncClient() as client:
        r = await client.post(
            url,
            data={"username": settings.AT_USERNAME, "to": phone, "message": message},
            headers={"apiKey": settings.AT_API_KEY, "Accept": "application/json"},
        )
        print(f"[AT SMS] status={r.status_code} body={r.text}")

async def _send_email(to: str, subject: str, body: str) -> None:
    print(f"[EMAIL] to={to}\nSubject: {subject}\n{body}")
    if not settings.SENDGRID_API_KEY:
        return
    import sendgrid
    from sendgrid.helpers.mail import Mail
    sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
    message = Mail(
        from_email="noreply@staynaivasha.co.ke",
        to_emails=to,
        subject=subject,
        plain_text_content=body,
    )
    sg.send(message)

# In-memory fallbacks for dev when Redis is unavailable
_otp_fallback:      dict[str, str] = {}
_pw_reset_fallback: dict[str, str] = {}  # token → user_id


# ── /me ───────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=TokenResponse)
async def get_me(user: User = Depends(get_current_user_optional)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return _token_resp(user)


class ProfileUpdate(BaseModel):
    name:  Optional[str] = None
    email: Optional[str] = None

@router.put("/me", response_model=TokenResponse)
async def update_profile(
    body: ProfileUpdate,
    user: User = Depends(get_current_user_optional),
    db:   AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if body.name is not None:
        user.name = body.name.strip() or None
    if body.email is not None:
        user.email = body.email.strip().lower() or None
    await db.commit()
    await db.refresh(user)
    return _token_resp(user)


# ── Phone OTP ─────────────────────────────────────────────────────────────────

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

    return await _issue_tokens(user, response)


# ── Email / password auth ─────────────────────────────────────────────────────

class EmailLogin(BaseModel):
    email:    str
    password: str

class EmailRegister(BaseModel):
    email:    str
    password: str = Field(..., min_length=8)
    name:     Optional[str] = None


@router.post("/email/register", response_model=TokenResponse)
async def email_register(body: EmailRegister, response: Response, db: AsyncSession = Depends(get_db)):
    await rate_limit(f"email_reg:{body.email}", limit=5, window=3600)

    email = body.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered. Sign in instead.")

    user = User(email=email, password_hash=pwd_ctx.hash(body.password), name=body.name)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await _issue_tokens(user, response)


@router.post("/email/login", response_model=TokenResponse)
async def email_login(body: EmailLogin, response: Response, db: AsyncSession = Depends(get_db)):
    await rate_limit(f"email_login:{body.email}", limit=10, window=900)

    email = body.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not pwd_ctx.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return await _issue_tokens(user, response)


# ── Forgot / reset password ───────────────────────────────────────────────────

class ForgotPasswordBody(BaseModel):
    email: str

class ResetPasswordBody(BaseModel):
    token:        str
    new_password: str = Field(..., min_length=8)


@router.post("/password/forgot", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(body: ForgotPasswordBody, db: AsyncSession = Depends(get_db)):
    await rate_limit(f"pw_forgot:{body.email}", limit=3, window=3600)

    email = body.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return  # always 204 — don't reveal whether email exists

    token = secrets.token_urlsafe(32)
    if await _redis_ok():
        await redis.set(_pw_reset_key(token), user.id, ex=1800)
    else:
        _pw_reset_fallback[token] = user.id

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    print(f"[PASSWORD RESET] {reset_url}")  # always visible in logs for dev

    await _send_email(
        to=email,
        subject="Reset your StayNaivasha password",
        body=(
            f"Hi {user.name or 'there'},\n\n"
            f"Click the link below to reset your password:\n\n"
            f"{reset_url}\n\n"
            f"This link expires in 30 minutes.\n\n"
            f"If you didn't request this, just ignore this email.\n\n"
            f"— The StayNaivasha team"
        ),
    )


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(body: ResetPasswordBody, db: AsyncSession = Depends(get_db)):
    if await _redis_ok():
        user_id = await redis.get(_pw_reset_key(body.token))
        await redis.delete(_pw_reset_key(body.token))
    else:
        user_id = _pw_reset_fallback.pop(body.token, None)

    if not user_id:
        raise HTTPException(status_code=400, detail="Reset link expired or already used")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Account not found")

    user.password_hash = pwd_ctx.hash(body.new_password)
    await db.commit()


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/google")
async def google_auth():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google login not configured yet")

    state = secrets.token_urlsafe(16)
    if await _redis_ok():
        await redis.set(f"google_state:{state}", "1", ex=600)

    params = {
        "client_id":     settings.GOOGLE_CLIENT_ID,
        "redirect_uri":  f"{settings.BACKEND_URL}/api/auth/google/callback",
        "response_type": "code",
        "scope":         "email profile",
        "state":         state,
        "access_type":   "online",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(
    code:     str,
    state:    str,
    response: Response,
    db:       AsyncSession = Depends(get_db),
):
    # Validate state (CSRF protection)
    if await _redis_ok():
        valid = await redis.get(f"google_state:{state}")
        await redis.delete(f"google_state:{state}")
        if not valid:
            return RedirectResponse(f"{settings.FRONTEND_URL}/profile?error=google_expired")

    import httpx
    async with httpx.AsyncClient() as client:
        token_r = await client.post(GOOGLE_TOKEN_URL, data={
            "code":          code,
            "client_id":     settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri":  f"{settings.BACKEND_URL}/api/auth/google/callback",
            "grant_type":    "authorization_code",
        })
        if not token_r.is_success:
            return RedirectResponse(f"{settings.FRONTEND_URL}/profile?error=google_token")

        g_access = token_r.json()["access_token"]

        info_r = await client.get(GOOGLE_USERINFO_URL,
                                  headers={"Authorization": f"Bearer {g_access}"})
        if not info_r.is_success:
            return RedirectResponse(f"{settings.FRONTEND_URL}/profile?error=google_info")

        info = info_r.json()

    google_id = info["id"]
    email     = info.get("email", "").lower()
    name      = info.get("name")

    # Find existing user by google_id, then by matching email
    result = await db.execute(select(User).where(User.google_id == google_id))
    user   = result.scalar_one_or_none()

    if not user and email:
        result = await db.execute(select(User).where(User.email == email))
        user   = result.scalar_one_or_none()
        if user:
            user.google_id = google_id  # link Google to existing account

    if not user:
        user = User(email=email or None, google_id=google_id, name=name)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if name and not user.name:
            user.name = name
        await db.commit()

    redirect = RedirectResponse(f"{settings.FRONTEND_URL}/profile")
    await _issue_tokens(user, redirect)
    return redirect


# ── Token refresh ─────────────────────────────────────────────────────────────

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
    user   = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return await _issue_tokens(user, response)


# ── Push subscriptions ────────────────────────────────────────────────────────

@router.post("/push-subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def push_subscribe(
    request: Request,
    user:    User = Depends(get_current_user_optional),
    db:      AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body     = await request.json()
    endpoint = body.get("endpoint", "")
    if endpoint:
        user.fcm_token = endpoint
        await db.commit()


# ── Logout ────────────────────────────────────────────────────────────────────

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
