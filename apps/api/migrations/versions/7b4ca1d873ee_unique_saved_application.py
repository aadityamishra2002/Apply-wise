"""unique_saved_application

Revision ID: 7b4ca1d873ee
Revises: 563c5fb032bf
"""
from typing import Sequence, Union

from alembic import op


revision: str = "7b4ca1d873ee"
down_revision: Union[str, None] = "563c5fb032bf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint("uq_applications_user_job", "applications", ["user_id", "job_id"])


def downgrade() -> None:
    op.drop_constraint("uq_applications_user_job", "applications", type_="unique")
