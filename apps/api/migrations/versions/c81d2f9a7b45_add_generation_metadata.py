"""add generation metadata

Revision ID: c81d2f9a7b45
Revises: e2a7c9d4b6f1
Create Date: 2026-06-14 12:00:00.000000
"""

from typing import Sequence

import sqlalchemy as sa

from alembic import op


revision: str = "c81d2f9a7b45"
down_revision: str | None = "e2a7c9d4b6f1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("resume_versions", sa.Column("prompt_version", sa.String(length=64), nullable=False, server_default="applywise-tailoring-v1"))
    op.add_column("resume_versions", sa.Column("model_provider", sa.String(length=64), nullable=False, server_default="deterministic"))
    op.add_column("resume_versions", sa.Column("model_name", sa.String(length=128), nullable=False, server_default="deterministic-v1"))
    op.add_column("resume_versions", sa.Column("generation_status", sa.String(length=64), nullable=False, server_default="fallback_no_provider"))
    op.add_column("resume_versions", sa.Column("quality_warnings", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("cover_letters", sa.Column("ats_score", sa.Float(), nullable=False, server_default="0"))
    op.add_column("cover_letters", sa.Column("prompt_version", sa.String(length=64), nullable=False, server_default="applywise-tailoring-v1"))
    op.add_column("cover_letters", sa.Column("model_provider", sa.String(length=64), nullable=False, server_default="deterministic"))
    op.add_column("cover_letters", sa.Column("model_name", sa.String(length=128), nullable=False, server_default="deterministic-v1"))
    op.add_column("cover_letters", sa.Column("generation_status", sa.String(length=64), nullable=False, server_default="fallback_no_provider"))
    op.add_column("cover_letters", sa.Column("quality_warnings", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("cover_letters", "quality_warnings")
    op.drop_column("cover_letters", "generation_status")
    op.drop_column("cover_letters", "model_name")
    op.drop_column("cover_letters", "model_provider")
    op.drop_column("cover_letters", "prompt_version")
    op.drop_column("cover_letters", "ats_score")
    op.drop_column("resume_versions", "quality_warnings")
    op.drop_column("resume_versions", "generation_status")
    op.drop_column("resume_versions", "model_name")
    op.drop_column("resume_versions", "model_provider")
    op.drop_column("resume_versions", "prompt_version")
