"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(120), nullable=True),
        sa.Column("phone", sa.String(20), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("role", sa.Enum("guest", "owner", "admin", "banned", name="user_role"), nullable=False, server_default="guest"),
        sa.Column("national_id_url", sa.String(500), nullable=True),
        sa.Column("passport_number", sa.String(50), nullable=True),
        sa.Column("fcm_token", sa.String(500), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "properties",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("type", sa.String(50), nullable=True),
        sa.Column("price_per_night", sa.BigInteger(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("what3words", sa.String(100), nullable=True),
        sa.Column("landmark_instructions", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("verified_tier", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("min_nights", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("no_checkout_days", sa.String(20), nullable=True),
        sa.Column("response_time_hours", sa.SmallInteger(), nullable=True),
        sa.Column("ical_import_url", sa.String(500), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_properties_owner_id", "properties", ["owner_id"])
    op.create_index("ix_properties_active", "properties", ["active"])

    op.create_table(
        "property_images",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("properties.id"), nullable=False),
        sa.Column("cloudinary_url", sa.String(500), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("display_order", sa.SmallInteger(), nullable=False, server_default="0"),
    )

    op.create_table(
        "promo_codes",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("code", sa.String(30), nullable=False, unique=True),
        sa.Column("discount_kes", sa.Integer(), nullable=False),
        sa.Column("max_uses", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "bookings",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("guest_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("property_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("properties.id"), nullable=False),
        sa.Column("check_in", sa.Date(), nullable=False),
        sa.Column("check_out", sa.Date(), nullable=False),
        sa.Column("total_amount", sa.BigInteger(), nullable=False),
        sa.Column("platform_fee", sa.BigInteger(), nullable=False),
        sa.Column("deposit_amount", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("promo_code_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("promo_codes.id"), nullable=True),
        sa.Column("status", sa.Enum("pending", "confirmed", "checked_in", "completed", "cancelled", name="booking_status"), nullable=False, server_default="pending"),
        sa.Column("checkin_code", sa.String(4), nullable=True),
        sa.Column("mpesa_ref", sa.String(50), nullable=True),
        sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_bookings_guest_id", "bookings", ["guest_id"])
    op.create_index("ix_bookings_property_id", "bookings", ["property_id"])
    op.create_index("ix_bookings_status", "bookings", ["status"])

    op.create_table(
        "availability",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("properties.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("source", sa.Enum("manual", "ical", "booking", name="avail_source"), nullable=False, server_default="manual"),
        sa.Column("booking_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("bookings.id"), nullable=True),
    )
    op.create_index("ix_availability_property_date", "availability", ["property_id", "date"], unique=True)

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("type", sa.Enum("charge", "refund", "payout", name="payment_type"), nullable=False),
        sa.Column("mpesa_ref", sa.String(50), nullable=True),
        sa.Column("status", sa.Enum("pending", "completed", "failed", name="payment_status"), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("bookings.id"), nullable=False, unique=True),
        sa.Column("accuracy_score", sa.SmallInteger(), nullable=False),
        sa.Column("cleanliness_score", sa.SmallInteger(), nullable=False),
        sa.Column("location_score", sa.SmallInteger(), nullable=False),
        sa.Column("value_score", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("owner_response", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "damage_claims",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("before_photos", sa.JSON(), nullable=True),
        sa.Column("after_photos", sa.JSON(), nullable=True),
        sa.Column("claimed_amount", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status", sa.Enum("pending", "approved", "rejected", name="claim_status"), nullable=False, server_default="pending"),
        sa.Column("ruling", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.String(100), nullable=False),
        sa.Column("actor_id", sa.String(100), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_log_event_type", "audit_log", ["event_type"])
    op.create_index("ix_audit_log_entity_id", "audit_log", ["entity_id"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("damage_claims")
    op.drop_table("reviews")
    op.drop_table("payments")
    op.drop_table("availability")
    op.drop_table("bookings")
    op.drop_table("promo_codes")
    op.drop_table("property_images")
    op.drop_table("properties")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS user_role")
    op.execute("DROP TYPE IF EXISTS booking_status")
    op.execute("DROP TYPE IF EXISTS avail_source")
    op.execute("DROP TYPE IF EXISTS payment_type")
    op.execute("DROP TYPE IF EXISTS payment_status")
    op.execute("DROP TYPE IF EXISTS claim_status")
