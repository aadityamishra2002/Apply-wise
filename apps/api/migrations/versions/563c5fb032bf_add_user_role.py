"""add_user_role

Revision ID: 563c5fb032bf
Revises: 277dc6610fbc
Create Date: 2026-06-01 17:35:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "563c5fb032bf"
down_revision: Union[str, None] = "277dc6610fbc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=32), server_default="member", nullable=False))
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)
    if op.get_bind().dialect.name != "sqlite":
        op.alter_column("users", "role", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_column("users", "role")
