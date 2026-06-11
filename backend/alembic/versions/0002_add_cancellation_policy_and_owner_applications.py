"""add cancellation_policy and owner_applications

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-11 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("cancellation_policy", sa.String(30), nullable=False, server_default="moderate"),
    )

    op.create_table(
        "owner_applications",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("national_id", sa.String(50), nullable=False),
        sa.Column("property_type", sa.String(50), nullable=False),
        sa.Column("property_location", sa.String(200), nullable=False),
        sa.Column("property_description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="application_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_owner_applications_phone", "owner_applications", ["phone"])
    op.create_index("ix_owner_applications_status", "owner_applications", ["status"])


def downgrade() -> None:
    op.drop_index("ix_owner_applications_status", table_name="owner_applications")
    op.drop_index("ix_owner_applications_phone", table_name="owner_applications")
    op.drop_table("owner_applications")
    op.drop_column("properties", "cancellation_policy")
    op.execute("DROP TYPE IF EXISTS application_status")
