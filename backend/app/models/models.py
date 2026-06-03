import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    JSON, BigInteger, Boolean, Date, DateTime, Enum, ForeignKey,
    Integer, SmallInteger, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name: Mapped[Optional[str]] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(Enum("guest", "owner", "admin", name="user_role"), default="guest")
    national_id_url: Mapped[Optional[str]] = mapped_column(String(500))
    passport_number: Mapped[Optional[str]] = mapped_column(String(50))
    fcm_token: Mapped[Optional[str]] = mapped_column(String(500))
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    properties: Mapped[list["Property"]] = relationship(back_populates="owner")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="guest")


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(50))
    price_per_night: Mapped[int] = mapped_column(BigInteger, nullable=False)  # KES integer
    lat: Mapped[Optional[float]]
    lng: Mapped[Optional[float]]
    what3words: Mapped[Optional[str]] = mapped_column(String(100))
    landmark_instructions: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    verified_tier: Mapped[int] = mapped_column(SmallInteger, default=0)
    min_nights: Mapped[int] = mapped_column(SmallInteger, default=1)
    no_checkout_days: Mapped[Optional[str]] = mapped_column(String(20))  # e.g. "0,6" (Sun,Sat)
    response_time_hours: Mapped[Optional[int]] = mapped_column(SmallInteger)
    ical_import_url: Mapped[Optional[str]] = mapped_column(String(500))
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner: Mapped["User"] = relationship(back_populates="properties")
    images: Mapped[list["PropertyImage"]] = relationship(back_populates="property")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="property")


class PropertyImage(Base):
    __tablename__ = "property_images"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    property_id: Mapped[str] = mapped_column(ForeignKey("properties.id"), nullable=False)
    cloudinary_url: Mapped[str] = mapped_column(String(500), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0)

    property: Mapped["Property"] = relationship(back_populates="images")


class Availability(Base):
    __tablename__ = "availability"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    property_id: Mapped[str] = mapped_column(ForeignKey("properties.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str] = mapped_column(Enum("manual", "ical", "booking", name="avail_source"), default="manual")
    booking_id: Mapped[Optional[str]] = mapped_column(ForeignKey("bookings.id"))


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    guest_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    property_id: Mapped[str] = mapped_column(ForeignKey("properties.id"), nullable=False)
    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)   # KES integer
    platform_fee: Mapped[int] = mapped_column(BigInteger, nullable=False)
    deposit_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    promo_code_id: Mapped[Optional[str]] = mapped_column(ForeignKey("promo_codes.id"))
    status: Mapped[str] = mapped_column(
        Enum("pending", "confirmed", "checked_in", "completed", "cancelled", name="booking_status"),
        default="pending",
    )
    checkin_code: Mapped[Optional[str]] = mapped_column(String(4))
    mpesa_ref: Mapped[Optional[str]] = mapped_column(String(50))
    terms_accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    guest: Mapped["User"] = relationship(back_populates="bookings")
    property: Mapped["Property"] = relationship(back_populates="bookings")
    review: Mapped[Optional["Review"]] = relationship(back_populates="booking", uselist=False)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    type: Mapped[str] = mapped_column(Enum("charge", "refund", "payout", name="payment_type"))
    mpesa_ref: Mapped[Optional[str]] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(Enum("pending", "completed", "failed", name="payment_status"), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id"), nullable=False, unique=True)
    accuracy_score: Mapped[int] = mapped_column(SmallInteger)
    cleanliness_score: Mapped[int] = mapped_column(SmallInteger)
    location_score: Mapped[int] = mapped_column(SmallInteger)
    value_score: Mapped[int] = mapped_column(SmallInteger)
    comment: Mapped[Optional[str]] = mapped_column(Text)
    owner_response: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    booking: Mapped["Booking"] = relationship(back_populates="review")


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    discount_kes: Mapped[int] = mapped_column(Integer, nullable=False)
    max_uses: Mapped[int] = mapped_column(Integer, default=1)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False)
    actor_id: Mapped[Optional[str]] = mapped_column(String(100))
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DamageClaim(Base):
    __tablename__ = "damage_claims"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    before_photos: Mapped[Optional[list]] = mapped_column(JSON)
    after_photos: Mapped[Optional[list]] = mapped_column(JSON)
    claimed_amount: Mapped[int] = mapped_column(BigInteger, default=0)
    status: Mapped[str] = mapped_column(
        Enum("pending", "approved", "rejected", name="claim_status"), default="pending"
    )
    ruling: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
