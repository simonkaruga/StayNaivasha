"""add agent portal tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-15 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agents",
        sa.Column("id",             postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id",        postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("agency_name",    sa.String(200),  nullable=True),
        sa.Column("commission_pct", sa.SmallInteger(), nullable=False, server_default="5"),
        sa.Column("status",         sa.Enum("pending", "active", "suspended", name="agent_status"), nullable=False, server_default="pending"),
        sa.Column("total_earned",   sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("created_at",     sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agents_status", "agents", ["status"])

    op.create_table(
        "agent_referrals",
        sa.Column("id",             postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("agent_id",       postgresql.UUID(as_uuid=False), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("booking_id",     postgresql.UUID(as_uuid=False), sa.ForeignKey("bookings.id"), nullable=False, unique=True),
        sa.Column("commission_kes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status",         sa.Enum("pending", "paid", "cancelled", name="referral_status"), nullable=False, server_default="pending"),
        sa.Column("paid_at",        sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agent_referrals_agent_id", "agent_referrals", ["agent_id"])


def downgrade() -> None:
    op.drop_index("ix_agent_referrals_agent_id", table_name="agent_referrals")
    op.drop_table("agent_referrals")
    op.drop_index("ix_agents_status", table_name="agents")
    op.drop_table("agents")
    op.execute("DROP TYPE IF EXISTS referral_status")
    op.execute("DROP TYPE IF EXISTS agent_status")
