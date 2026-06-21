"""add resume templates

Revision ID: a3f2d9b7c6e1
Revises: c81d2f9a7b45
Create Date: 2026-06-20 18:30:00.000000
"""

from typing import Sequence

import sqlalchemy as sa

from alembic import op


revision: str = "a3f2d9b7c6e1"
down_revision: str | None = "c81d2f9a7b45"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "resume_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("template_bytes", sa.LargeBinary(), nullable=False),
        sa.Column("placeholders", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_resume_templates_user_id"), "resume_templates", ["user_id"])
    op.create_index(op.f("ix_resume_templates_is_active"), "resume_templates", ["is_active"])
    with op.batch_alter_table("resume_versions") as batch_op:
        batch_op.add_column(sa.Column("template_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key("fk_resume_versions_template_id_resume_templates", "resume_templates", ["template_id"], ["id"])


def downgrade() -> None:
    with op.batch_alter_table("resume_versions") as batch_op:
        batch_op.drop_constraint("fk_resume_versions_template_id_resume_templates", type_="foreignkey")
        batch_op.drop_column("template_id")
    op.drop_index(op.f("ix_resume_templates_is_active"), table_name="resume_templates")
    op.drop_index(op.f("ix_resume_templates_user_id"), table_name="resume_templates")
    op.drop_table("resume_templates")
