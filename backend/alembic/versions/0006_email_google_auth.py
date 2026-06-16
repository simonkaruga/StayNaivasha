"""Add email/password and Google OAuth fields to users

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    # Make phone nullable (email/Google users may not have a phone)
    op.alter_column("users", "phone", nullable=True)

    # password_hash for email+password accounts
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))

    # google_id for Google OAuth accounts
    op.add_column("users", sa.Column("google_id", sa.String(100), nullable=True))
    op.create_unique_constraint("uq_users_google_id", "users", ["google_id"])

    # Partial unique index on email — allows multiple NULLs but only one of each email
    op.create_index(
        "uix_users_email",
        "users",
        ["email"],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
    )


def downgrade():
    op.drop_index("uix_users_email", table_name="users")
    op.drop_constraint("uq_users_google_id", "users", type_="unique")
    op.drop_column("users", "google_id")
    op.drop_column("users", "password_hash")
    # Revert phone to NOT NULL (only safe if all rows have a phone)
    op.alter_column("users", "phone", nullable=False)
