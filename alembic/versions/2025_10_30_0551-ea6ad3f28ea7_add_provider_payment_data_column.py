"""add_missing_payment_columns

Revision ID: ea6ad3f28ea7
Revises: 897bb45d5bcd
Create Date: 2025-10-30 05:51:55.229245

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "ea6ad3f28ea7"
down_revision = "897bb45d5bcd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing columns to payments table
    op.add_column(
        "payments",
        sa.Column("provider_payment_data", postgresql.JSON, nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("refund_amount", sa.Numeric(18, 2), nullable=True),
    )


def downgrade() -> None:
    # Remove added columns from payments table (with conditional logic)
    from sqlalchemy import inspect

    conn = op.get_bind()
    inspector = inspect(conn)
    existing_columns = {col['name'] for col in inspector.get_columns('payments')}

    if 'refund_amount' in existing_columns:
        op.drop_column("payments", "refund_amount")

    if 'processed_at' in existing_columns:
        op.drop_column("payments", "processed_at")

    if 'refunded_at' in existing_columns:
        op.drop_column("payments", "refunded_at")

    if 'provider_payment_data' in existing_columns:
        op.drop_column("payments", "provider_payment_data")
