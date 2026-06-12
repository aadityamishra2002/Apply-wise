"""add activity logs

Revision ID: 9c8d7e6f5a4b
Revises: a7e5c40f9a12
Create Date: 2026-06-12 12:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa

from alembic import op


revision: str = "9c8d7e6f5a4b"
down_revision: str | None = "a7e5c40f9a12"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_activity_logs_created_at"), "activity_logs", ["created_at"])
    op.create_index(op.f("ix_activity_logs_event_type"), "activity_logs", ["event_type"])
    op.create_index(op.f("ix_activity_logs_user_id"), "activity_logs", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_activity_logs_user_id"), table_name="activity_logs")
    op.drop_index(op.f("ix_activity_logs_event_type"), table_name="activity_logs")
    op.drop_index(op.f("ix_activity_logs_created_at"), table_name="activity_logs")
    op.drop_table("activity_logs")
