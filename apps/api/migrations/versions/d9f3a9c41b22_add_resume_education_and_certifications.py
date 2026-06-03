"""add resume education and certifications

Revision ID: d9f3a9c41b22
Revises: c32d91f88ad2
Create Date: 2026-06-03 17:55:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op


revision: str = "d9f3a9c41b22"
down_revision: str | None = "c32d91f88ad2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "education",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("resume_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("institution", sa.String(length=255), nullable=False),
        sa.Column("degree", sa.String(length=255), nullable=False),
        sa.Column("year", sa.String(length=32), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["resume_id"], ["master_resumes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_education_resume_id"), "education", ["resume_id"], unique=False)
    op.create_index(op.f("ix_education_user_id"), "education", ["user_id"], unique=False)
    op.create_table(
        "certifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("resume_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("issuer", sa.String(length=255), nullable=True),
        sa.Column("year", sa.String(length=32), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["resume_id"], ["master_resumes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_certifications_resume_id"), "certifications", ["resume_id"], unique=False)
    op.create_index(op.f("ix_certifications_user_id"), "certifications", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_certifications_user_id"), table_name="certifications")
    op.drop_index(op.f("ix_certifications_resume_id"), table_name="certifications")
    op.drop_table("certifications")
    op.drop_index(op.f("ix_education_user_id"), table_name="education")
    op.drop_index(op.f("ix_education_resume_id"), table_name="education")
    op.drop_table("education")
