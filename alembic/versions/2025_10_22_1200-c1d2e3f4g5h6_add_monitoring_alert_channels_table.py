"""add monitoring alert channels table

Revision ID: c1d2e3f4g5h6
Revises: h1i2j3k4l5m6
Create Date: 2025-10-22 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4g5h6"
down_revision: str | None = "h1i2j3k4l5m6"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "monitoring_alert_channels",
        sa.Column("id", sa.String(length=120), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("channel_type", sa.String(length=32), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("tenant_id", sa.String(length=255), nullable=True),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
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
    op.create_index(
        "ix_monitoring_alert_channels_tenant_id",
        "monitoring_alert_channels",
        ["tenant_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_monitoring_alert_channels_tenant_id", table_name="monitoring_alert_channels")
    op.drop_table("monitoring_alert_channels")
