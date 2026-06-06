"""add background jobs

Revision ID: a7e5c40f9a12
Revises: f4c2d8a91b30
Create Date: 2026-06-06 12:10:00.000000
"""

from typing import Sequence

import sqlalchemy as sa

from alembic import op


revision: str = "a7e5c40f9a12"
down_revision: str | None = "f4c2d8a91b30"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "background_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=True),
        sa.Column("job_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_background_jobs_application_id"), "background_jobs", ["application_id"])
    op.create_index(op.f("ix_background_jobs_job_type"), "background_jobs", ["job_type"])
    op.create_index(op.f("ix_background_jobs_status"), "background_jobs", ["status"])
    op.create_index(op.f("ix_background_jobs_user_id"), "background_jobs", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_background_jobs_user_id"), table_name="background_jobs")
    op.drop_index(op.f("ix_background_jobs_status"), table_name="background_jobs")
    op.drop_index(op.f("ix_background_jobs_job_type"), table_name="background_jobs")
    op.drop_index(op.f("ix_background_jobs_application_id"), table_name="background_jobs")
    op.drop_table("background_jobs")
