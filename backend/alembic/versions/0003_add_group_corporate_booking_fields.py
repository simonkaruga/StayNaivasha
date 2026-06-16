"""add group and corporate booking fields

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-15 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("guests",       sa.SmallInteger(), nullable=False, server_default="1"))
    op.add_column("bookings", sa.Column("group_name",   sa.String(150),    nullable=True))
    op.add_column("bookings", sa.Column("is_corporate", sa.Boolean(),      nullable=False, server_default="false"))
    op.add_column("bookings", sa.Column("company_name", sa.String(200),    nullable=True))
    op.add_column("bookings", sa.Column("kra_pin",      sa.String(20),     nullable=True))


def downgrade() -> None:
    op.drop_column("bookings", "kra_pin")
    op.drop_column("bookings", "company_name")
    op.drop_column("bookings", "is_corporate")
    op.drop_column("bookings", "group_name")
    op.drop_column("bookings", "guests")
