"""Add scheduled plan change columns to subscriptions

Revision ID: f7g8h9i0j1k2
Revises: 2025_10_25_1400
Create Date: 2025-10-25 17:00:00.000000

This migration adds support for scheduled (future-dated) plan changes by adding:
- scheduled_plan_id: The plan ID to switch to at the scheduled date
- scheduled_plan_change_date: When to apply the plan change

This allows operators to schedule plan changes (upgrades/downgrades) to take effect
at a future date, rather than applying immediately.
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "f7g8h9i0j1k2"
down_revision = "2025_10_25_1400"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add scheduled plan change columns to billing_subscriptions table."""

    # Add scheduled_plan_id column
    op.add_column(
        "billing_subscriptions",
        sa.Column(
            "scheduled_plan_id",
            sa.String(length=255),
            nullable=True,
            comment="Plan ID to change to at scheduled_plan_change_date"
        )
    )

    # Add scheduled_plan_change_date column
    op.add_column(
        "billing_subscriptions",
        sa.Column(
            "scheduled_plan_change_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Date/time when scheduled plan change should be applied"
        )
    )

    # Add index for efficient lookup of pending scheduled changes
    op.create_index(
        "ix_billing_subscriptions_scheduled_change",
        "billing_subscriptions",
        ["scheduled_plan_change_date"],
        unique=False,
        postgresql_where=sa.text("scheduled_plan_id IS NOT NULL")
    )

    # NOTE: Cannot add foreign key to billing_subscription_plans because plan_id
    # is part of a composite primary key (plan_id, id). Application code validates
    # that scheduled_plan_id exists before saving.


def downgrade() -> None:
    """Remove scheduled plan change columns from billing_subscriptions table."""

    # Drop index
    op.drop_index(
        "ix_billing_subscriptions_scheduled_change",
        table_name="billing_subscriptions"
    )

    # Drop columns
    op.drop_column("billing_subscriptions", "scheduled_plan_change_date")
    op.drop_column("billing_subscriptions", "scheduled_plan_id")
