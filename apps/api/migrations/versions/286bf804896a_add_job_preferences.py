"""add_job_preferences

Revision ID: 286bf804896a
Revises: 7b4ca1d873ee
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "286bf804896a"
down_revision: Union[str, None] = "7b4ca1d873ee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "job_preferences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role_keywords", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("remote_only", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_job_preferences_user_id"), "job_preferences", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_job_preferences_user_id"), table_name="job_preferences")
    op.drop_table("job_preferences")
