"""
Add error_traceback column to jobs table.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "2025_10_22_1530"
down_revision: str = "c1d2e3f4g5h6"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("error_traceback", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "error_traceback")
