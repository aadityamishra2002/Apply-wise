"""add_job_match_ats_analysis

Revision ID: c32d91f88ad2
Revises: b11a4d83ac91
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c32d91f88ad2"
down_revision: Union[str, None] = "b11a4d83ac91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("job_matches", sa.Column("ats_score", sa.Float(), server_default="0", nullable=False))
    op.add_column("job_matches", sa.Column("ats_breakdown", sa.JSON(), server_default="{}", nullable=False))
    op.add_column("job_matches", sa.Column("ats_recommendations", sa.JSON(), server_default="[]", nullable=False))
    op.add_column("job_matches", sa.Column("approval_status", sa.String(length=32), server_default="review_required", nullable=False))
    op.create_index(op.f("ix_job_matches_approval_status"), "job_matches", ["approval_status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_job_matches_approval_status"), table_name="job_matches")
    op.drop_column("job_matches", "approval_status")
    op.drop_column("job_matches", "ats_recommendations")
    op.drop_column("job_matches", "ats_breakdown")
    op.drop_column("job_matches", "ats_score")
