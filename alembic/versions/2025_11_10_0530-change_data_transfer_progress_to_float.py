"""Change data transfer job progress to float.

Revision ID: 2025_11_10_0530
Revises: 2025_11_10_0500
Create Date: 2025-11-10 05:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2025_11_10_0530"
down_revision = "2025_11_10_0500"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Allow fractional progress tracking for data transfer jobs."""
    op.alter_column(
        "data_transfer_jobs",
        "progress_percentage",
        existing_type=sa.Integer(),
        type_=sa.Float(),
        existing_nullable=False,
        existing_server_default=None,
    )


def downgrade() -> None:
    """Revert progress column back to integer percentage."""
    op.alter_column(
        "data_transfer_jobs",
        "progress_percentage",
        existing_type=sa.Float(),
        type_=sa.Integer(),
        existing_nullable=False,
        existing_server_default=None,
    )
