from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Auth ─────────────────────────────────────────────────────────────────────

class OTPRequest(BaseModel):
    phone: str = Field(..., examples=["+254712345678"])

class OTPVerify(BaseModel):
    phone: str
    code: str = Field(..., min_length=6, max_length=6)

class TokenResponse(BaseModel):
    user_id: str
    role: str


# ── Properties ───────────────────────────────────────────────────────────────

class PropertyImageOut(BaseModel):
    cloudinary_url: str
    is_primary: bool
    display_order: int

    class Config:
        from_attributes = True

class PropertyCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    type: str
    price_per_night: int = Field(..., gt=0, description="KES integers only")
    description: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    what3words: Optional[str] = None
    landmark_instructions: Optional[str] = None
    min_nights: int = 1
    cancellation_policy: str = "moderate"

class PropertyOut(BaseModel):
    id: str
    title: str
    type: str
    price_per_night: int
    description: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    what3words: Optional[str]
    landmark_instructions: Optional[str]
    verified_tier: int
    min_nights: int
    response_time_hours: Optional[int]
    active: bool
    images: list[PropertyImageOut] = []

    class Config:
        from_attributes = True

class PropertyListOut(BaseModel):
    id: str
    title: str
    type: str
    price_per_night: int
    verified_tier: int
    primary_image: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

    class Config:
        from_attributes = True


# ── Bookings ─────────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    property_id: str
    check_in: date
    check_out: date
    guests: int = Field(..., ge=1)
    promo_code: Optional[str] = None
    terms_accepted: bool = Field(..., description="Must be True to proceed")

class BookingOut(BaseModel):
    id: str
    property_id: str
    check_in: date
    check_out: date
    total_amount: int
    platform_fee: int
    deposit_amount: int
    status: str
    checkin_code: Optional[str] = None
    mpesa_ref: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
