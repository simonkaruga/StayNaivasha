"""add external_calendars table for multi-platform iCal sync

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-15 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "external_calendars",
        sa.Column("id",             postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("property_id",    postgresql.UUID(as_uuid=False), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform",       sa.String(50),  nullable=False),
        sa.Column("ical_url",       sa.String(1000), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_external_calendars_property_id", "external_calendars", ["property_id"])


def downgrade() -> None:
    op.drop_index("ix_external_calendars_property_id", table_name="external_calendars")
    op.drop_table("external_calendars")
