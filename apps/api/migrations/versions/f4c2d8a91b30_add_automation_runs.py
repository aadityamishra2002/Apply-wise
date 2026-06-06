"""add automation runs

Revision ID: f4c2d8a91b30
Revises: ed129e7c4f91
Create Date: 2026-06-06 11:30:00.000000
"""

from typing import Sequence

import sqlalchemy as sa

from alembic import op


revision: str = "f4c2d8a91b30"
down_revision: str | None = "ed129e7c4f91"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "automation_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("site_key", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("current_step", sa.String(length=120), nullable=True),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("manual_final_submission_required", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_automation_runs_application_id"), "automation_runs", ["application_id"])
    op.create_index(op.f("ix_automation_runs_site_key"), "automation_runs", ["site_key"])
    op.create_index(op.f("ix_automation_runs_status"), "automation_runs", ["status"])
    op.create_index(op.f("ix_automation_runs_user_id"), "automation_runs", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_automation_runs_user_id"), table_name="automation_runs")
    op.drop_index(op.f("ix_automation_runs_status"), table_name="automation_runs")
    op.drop_index(op.f("ix_automation_runs_site_key"), table_name="automation_runs")
    op.drop_index(op.f("ix_automation_runs_application_id"), table_name="automation_runs")
    op.drop_table("automation_runs")
