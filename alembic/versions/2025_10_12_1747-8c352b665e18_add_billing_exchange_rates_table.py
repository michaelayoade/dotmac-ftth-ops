"""add_billing_exchange_rates_table

Revision ID: 8c352b665e18
Revises: e74095bd366f
Create Date: 2025-10-12 17:47:59.362114

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "8c352b665e18"
down_revision = "e74095bd366f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create billing_exchange_rates table for currency conversion."""
    op.create_table(
        "billing_exchange_rates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("base_currency", sa.String(3), nullable=False, index=True),
        sa.Column("target_currency", sa.String(3), nullable=False, index=True),
        sa.Column("provider", sa.String(100), nullable=False, index=True),
        sa.Column("rate", sa.Numeric(18, 9), nullable=False),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "effective_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", sa.JSON, nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # Create composite unique constraint
    op.create_unique_constraint(
        "uq_exchange_rate_effective",
        "billing_exchange_rates",
        ["base_currency", "target_currency", "provider", "effective_at"],
    )

    # Create index for common query pattern (base + target currency)
    op.create_index(
        "ix_billing_exchange_rates_base_target",
        "billing_exchange_rates",
        ["base_currency", "target_currency"],
    )

    # Create index for effective_at to optimize latest rate queries
    op.create_index(
        "ix_billing_exchange_rates_effective_at",
        "billing_exchange_rates",
        ["effective_at"],
    )


def downgrade() -> None:
    """Drop billing_exchange_rates table."""
    op.drop_index("ix_billing_exchange_rates_effective_at", "billing_exchange_rates")
    op.drop_index("ix_billing_exchange_rates_base_target", "billing_exchange_rates")
    op.drop_constraint("uq_exchange_rate_effective", "billing_exchange_rates", type_="unique")
    op.drop_table("billing_exchange_rates")
