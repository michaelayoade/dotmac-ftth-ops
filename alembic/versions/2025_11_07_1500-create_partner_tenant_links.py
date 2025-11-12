"""create partner_tenant_links table

Revision ID: p7t8l9i0n1k2
Revises: fa38dcc0e77a
Create Date: 2025-11-07 15:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "p7t8l9i0n1k2"
down_revision: Union[str, None] = "fa38dcc0e77a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create partner_tenant_links table for multi-account management."""

    # Create the partner_tenant_links table
    op.create_table(
        "partner_tenant_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("partner_id", UUID(as_uuid=True), nullable=False),
        sa.Column("managed_tenant_id", sa.String(255), nullable=False),
        sa.Column("partner_tenant_id", sa.String(255), nullable=False),
        sa.Column(
            "access_role",
            sa.String(50),
            nullable=False,
            comment="Access role: msp_full, msp_billing, msp_support, enterprise_hq, auditor, reseller, delegate",
        ),
        sa.Column(
            "custom_permissions",
            sa.JSON,
            nullable=False,
            server_default="{}",
            comment="Custom permission overrides for granular control",
        ),
        sa.Column(
            "relationship_type",
            sa.String(50),
            nullable=False,
            comment="Type: msp_managed, enterprise_subsidiary, reseller_channel, audit_only",
        ),
        sa.Column(
            "start_date",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "end_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="NULL = ongoing relationship",
        ),
        sa.Column(
            "is_active",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "notify_on_sla_breach",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "notify_on_billing_threshold",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "billing_alert_threshold",
            sa.Numeric(15, 2),
            nullable=True,
            comment="Alert when AR exceeds this amount",
        ),
        sa.Column(
            "sla_response_hours",
            sa.Integer,
            nullable=True,
            comment="Partner's committed response time for this tenant",
        ),
        sa.Column(
            "sla_uptime_target",
            sa.Numeric(5, 2),
            nullable=True,
            comment="Partner's uptime commitment (e.g., 99.95)",
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "metadata",
            sa.JSON,
            nullable=False,
            server_default="{}",
        ),
        # Timestamp columns
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
        # Audit columns
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column("updated_by", sa.String(255), nullable=True),
        # Foreign keys
        sa.ForeignKeyConstraint(
            ["partner_id"],
            ["partners.id"],
            name="fk_partner_tenant_links_partner_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["managed_tenant_id"],
            ["tenants.id"],
            name="fk_partner_tenant_links_managed_tenant_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["partner_tenant_id"],
            ["tenants.id"],
            name="fk_partner_tenant_links_partner_tenant_id",
            ondelete="CASCADE",
        ),
        # Unique constraint
        sa.UniqueConstraint(
            "partner_id",
            "managed_tenant_id",
            name="uq_partner_managed_tenant",
        ),
    )

    # Create indexes
    op.create_index(
        "ix_partner_tenant_links_partner_id",
        "partner_tenant_links",
        ["partner_id"],
    )
    op.create_index(
        "ix_partner_tenant_links_managed_tenant_id",
        "partner_tenant_links",
        ["managed_tenant_id"],
    )
    op.create_index(
        "ix_partner_tenant_links_partner_tenant_id",
        "partner_tenant_links",
        ["partner_tenant_id"],
    )
    op.create_index(
        "ix_partner_tenant_links_access_role",
        "partner_tenant_links",
        ["access_role"],
    )
    op.create_index(
        "ix_partner_tenant_links_is_active",
        "partner_tenant_links",
        ["is_active"],
    )
    op.create_index(
        "ix_partner_tenant_active",
        "partner_tenant_links",
        ["partner_id", "is_active"],
    )
    op.create_index(
        "ix_managed_tenant_active",
        "partner_tenant_links",
        ["managed_tenant_id", "is_active"],
    )
    op.create_index(
        "ix_partner_tenant_role",
        "partner_tenant_links",
        ["partner_id", "access_role"],
    )
    op.create_index(
        "ix_partner_tenant_dates",
        "partner_tenant_links",
        ["start_date", "end_date"],
    )


def downgrade() -> None:
    """Drop partner_tenant_links table."""

    # Drop indexes first
    op.drop_index("ix_partner_tenant_dates", table_name="partner_tenant_links")
    op.drop_index("ix_partner_tenant_role", table_name="partner_tenant_links")
    op.drop_index("ix_managed_tenant_active", table_name="partner_tenant_links")
    op.drop_index("ix_partner_tenant_active", table_name="partner_tenant_links")
    op.drop_index("ix_partner_tenant_links_is_active", table_name="partner_tenant_links")
    op.drop_index("ix_partner_tenant_links_access_role", table_name="partner_tenant_links")
    op.drop_index("ix_partner_tenant_links_partner_tenant_id", table_name="partner_tenant_links")
    op.drop_index("ix_partner_tenant_links_managed_tenant_id", table_name="partner_tenant_links")
    op.drop_index("ix_partner_tenant_links_partner_id", table_name="partner_tenant_links")

    # Drop table
    op.drop_table("partner_tenant_links")
