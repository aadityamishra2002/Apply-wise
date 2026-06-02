"""add_extension_pairing_codes

Revision ID: b11a4d83ac91
Revises: 8a971d4e5c10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b11a4d83ac91"
down_revision: Union[str, None] = "8a971d4e5c10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "extension_pairing_codes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_extension_pairing_codes_code_hash"), "extension_pairing_codes", ["code_hash"], unique=True)
    op.create_index(op.f("ix_extension_pairing_codes_expires_at"), "extension_pairing_codes", ["expires_at"], unique=False)
    op.create_index(op.f("ix_extension_pairing_codes_used_at"), "extension_pairing_codes", ["used_at"], unique=False)
    op.create_index(op.f("ix_extension_pairing_codes_user_id"), "extension_pairing_codes", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_extension_pairing_codes_user_id"), table_name="extension_pairing_codes")
    op.drop_index(op.f("ix_extension_pairing_codes_used_at"), table_name="extension_pairing_codes")
    op.drop_index(op.f("ix_extension_pairing_codes_expires_at"), table_name="extension_pairing_codes")
    op.drop_index(op.f("ix_extension_pairing_codes_code_hash"), table_name="extension_pairing_codes")
    op.drop_table("extension_pairing_codes")
