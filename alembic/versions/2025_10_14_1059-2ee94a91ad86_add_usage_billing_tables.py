"""add_usage_billing_tables

Revision ID: 2ee94a91ad86
Revises: f786f3e3f9a9
Create Date: 2025-10-14 10:59:33.875990

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "2ee94a91ad86"
down_revision = "f786f3e3f9a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add usage billing tables for metered services."""

    # Create UsageType enum (with checkfirst to avoid duplicate errors)
    usage_type_enum = sa.Enum(
        "data_transfer",
        "voice_minutes",
        "sms_count",
        "bandwidth_gb",
        "overage_gb",
        "static_ip",
        "equipment_rental",
        "installation_fee",
        "custom",
        name="usagetype",
    )
    usage_type_enum.create(op.get_bind(), checkfirst=True)

    # Create BilledStatus enum (with checkfirst to avoid duplicate errors)
    billed_status_enum = sa.Enum(
        "pending",
        "billed",
        "error",
        "excluded",
        name="billedstatus",
    )
    billed_status_enum.create(op.get_bind(), checkfirst=True)

    # Create usage_records table
    op.create_table(
        "usage_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=50), nullable=False),
        sa.Column(
            "subscription_id",
            sa.String(length=50),
            nullable=False,
            comment="Related subscription",
        ),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Customer who incurred usage",
        ),
        # Usage details
        sa.Column(
            "usage_type",
            postgresql.ENUM(name="usagetype", create_type=False),
            nullable=False,
            comment="Type of metered usage",
        ),
        sa.Column(
            "quantity",
            sa.Numeric(20, 6),
            nullable=False,
            comment="Usage quantity (e.g., 15.5 GB, 120 minutes)",
        ),
        sa.Column(
            "unit",
            sa.String(length=20),
            nullable=False,
            comment="Unit of measurement (GB, minutes, count, etc)",
        ),
        # Pricing
        sa.Column(
            "unit_price",
            sa.Numeric(12, 6),
            nullable=False,
            comment="Price per unit in cents (e.g., 10 cents/GB)",
        ),
        sa.Column(
            "total_amount",
            sa.Integer(),
            nullable=False,
            comment="Total charge in cents (quantity * unit_price)",
        ),
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default="USD",
            comment="Currency code (ISO 4217)",
        ),
        # Billing period
        sa.Column(
            "period_start",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="Start of usage period",
        ),
        sa.Column(
            "period_end",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="End of usage period",
        ),
        # Billing status
        sa.Column(
            "billed_status",
            postgresql.ENUM(name="billedstatus", create_type=False),
            nullable=False,
            server_default="pending",
            comment="Billing status",
        ),
        sa.Column(
            "invoice_id",
            sa.String(length=50),
            nullable=True,
            comment="Invoice this usage was billed on",
        ),
        sa.Column(
            "billed_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When usage was billed",
        ),
        # Source tracking
        sa.Column(
            "source_system",
            sa.String(length=50),
            nullable=False,
            comment="Source system (radius, api, import, etc)",
        ),
        sa.Column(
            "source_record_id",
            sa.String(length=100),
            nullable=True,
            comment="External source record identifier",
        ),
        # Additional metadata
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
            comment="Human-readable description",
        ),
        sa.Column(
            "device_id",
            sa.String(length=100),
            nullable=True,
            comment="Device/equipment identifier",
        ),
        sa.Column(
            "service_location",
            sa.String(length=500),
            nullable=True,
            comment="Service address if applicable",
        ),
        # Audit fields
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for usage_records
    op.create_index("ix_usage_records_subscription", "usage_records", ["subscription_id"])
    op.create_index("ix_usage_records_customer", "usage_records", ["customer_id"])
    op.create_index("ix_usage_records_usage_type", "usage_records", ["usage_type"])
    op.create_index("ix_usage_records_period_start", "usage_records", ["period_start"])
    op.create_index("ix_usage_records_period_end", "usage_records", ["period_end"])
    op.create_index("ix_usage_records_billed_status", "usage_records", ["billed_status"])
    op.create_index("ix_usage_records_invoice", "usage_records", ["invoice_id"])
    op.create_index("ix_usage_records_source_system", "usage_records", ["source_system"])
    op.create_index(
        "ix_usage_tenant_subscription", "usage_records", ["tenant_id", "subscription_id"]
    )
    op.create_index("ix_usage_tenant_customer", "usage_records", ["tenant_id", "customer_id"])
    op.create_index(
        "ix_usage_tenant_period", "usage_records", ["tenant_id", "period_start", "period_end"]
    )
    op.create_index(
        "ix_usage_billed_status_period", "usage_records", ["billed_status", "period_end"]
    )
    op.create_index("ix_usage_type_period", "usage_records", ["usage_type", "period_start"])

    # Create usage_aggregates table
    op.create_table(
        "usage_aggregates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=50), nullable=False),
        sa.Column(
            "subscription_id",
            sa.String(length=50),
            nullable=True,
            comment="Subscription-level aggregate (null = tenant-level)",
        ),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Customer-level aggregate",
        ),
        sa.Column(
            "usage_type", postgresql.ENUM(name="usagetype", create_type=False), nullable=False
        ),
        # Time period
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "period_type",
            sa.String(length=20),
            nullable=False,
            comment="Aggregation period: hourly, daily, monthly",
        ),
        # Aggregated metrics
        sa.Column(
            "total_quantity",
            sa.Numeric(20, 6),
            nullable=False,
            comment="Sum of quantity",
        ),
        sa.Column(
            "total_amount",
            sa.Integer(),
            nullable=False,
            comment="Sum of total_amount in cents",
        ),
        sa.Column(
            "record_count",
            sa.Integer(),
            nullable=False,
            comment="Number of records aggregated",
        ),
        sa.Column("min_quantity", sa.Numeric(20, 6), nullable=True),
        sa.Column("max_quantity", sa.Numeric(20, 6), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for usage_aggregates
    op.create_index("ix_usage_aggregates_tenant", "usage_aggregates", ["tenant_id"])
    op.create_index("ix_usage_aggregates_subscription", "usage_aggregates", ["subscription_id"])
    op.create_index("ix_usage_aggregates_customer", "usage_aggregates", ["customer_id"])
    op.create_index("ix_usage_aggregates_usage_type", "usage_aggregates", ["usage_type"])
    op.create_index("ix_usage_aggregates_period_start", "usage_aggregates", ["period_start"])
    op.create_index("ix_usage_aggregates_period_end", "usage_aggregates", ["period_end"])
    op.create_index(
        "ix_usage_agg_unique",
        "usage_aggregates",
        ["tenant_id", "subscription_id", "usage_type", "period_start", "period_type"],
        unique=True,
    )
    op.create_index(
        "ix_usage_agg_tenant_period",
        "usage_aggregates",
        ["tenant_id", "period_start", "period_type"],
    )


def downgrade() -> None:
    """Remove usage billing tables."""
    # Drop usage_aggregates indexes and table
    op.drop_index("ix_usage_agg_tenant_period", table_name="usage_aggregates")
    op.drop_index("ix_usage_agg_unique", table_name="usage_aggregates")
    op.drop_index("ix_usage_aggregates_period_end", table_name="usage_aggregates")
    op.drop_index("ix_usage_aggregates_period_start", table_name="usage_aggregates")
    op.drop_index("ix_usage_aggregates_usage_type", table_name="usage_aggregates")
    op.drop_index("ix_usage_aggregates_customer", table_name="usage_aggregates")
    op.drop_index("ix_usage_aggregates_subscription", table_name="usage_aggregates")
    op.drop_index("ix_usage_aggregates_tenant", table_name="usage_aggregates")
    op.drop_table("usage_aggregates")

    # Drop usage_records indexes and table
    op.drop_index("ix_usage_type_period", table_name="usage_records")
    op.drop_index("ix_usage_billed_status_period", table_name="usage_records")
    op.drop_index("ix_usage_tenant_period", table_name="usage_records")
    op.drop_index("ix_usage_tenant_customer", table_name="usage_records")
    op.drop_index("ix_usage_tenant_subscription", table_name="usage_records")
    op.drop_index("ix_usage_records_source_system", table_name="usage_records")
    op.drop_index("ix_usage_records_invoice", table_name="usage_records")
    op.drop_index("ix_usage_records_billed_status", table_name="usage_records")
    op.drop_index("ix_usage_records_period_end", table_name="usage_records")
    op.drop_index("ix_usage_records_period_start", table_name="usage_records")
    op.drop_index("ix_usage_records_usage_type", table_name="usage_records")
    op.drop_index("ix_usage_records_customer", table_name="usage_records")
    op.drop_index("ix_usage_records_subscription", table_name="usage_records")
    op.drop_table("usage_records")

    # Drop enums
    sa.Enum(name="billedstatus").drop(op.get_bind())
    sa.Enum(name="usagetype").drop(op.get_bind())
