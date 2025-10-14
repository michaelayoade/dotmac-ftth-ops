"""add_isp_specific_customer_fields

Revision ID: d3f4e8a1b2c5
Revises: a72ec3c5e945
Create Date: 2025-10-14 12:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "d3f4e8a1b2c5"
down_revision = "a72ec3c5e945"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add ISP-specific fields to customers table."""

    # Service Address fields
    op.add_column(
        "customers",
        sa.Column(
            "service_address_line1",
            sa.String(200),
            nullable=True,
            comment="Installation/service address",
        ),
    )
    op.add_column(
        "customers",
        sa.Column("service_address_line2", sa.String(200), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column("service_city", sa.String(100), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column("service_state_province", sa.String(100), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column("service_postal_code", sa.String(20), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column("service_country", sa.String(2), nullable=True, comment="ISO 3166-1 alpha-2"),
    )
    op.add_column(
        "customers",
        sa.Column(
            "service_coordinates",
            postgresql.JSON,
            nullable=False,
            server_default="{}",
            comment="GPS coordinates: {lat: float, lon: float}",
        ),
    )

    # Installation Tracking fields
    op.add_column(
        "customers",
        sa.Column(
            "installation_status",
            sa.String(20),
            nullable=True,
            comment="pending, scheduled, in_progress, completed, failed, canceled",
        ),
    )
    op.add_column(
        "customers",
        sa.Column(
            "installation_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Actual installation date",
        ),
    )
    op.add_column(
        "customers",
        sa.Column(
            "scheduled_installation_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Scheduled installation date",
        ),
    )
    op.add_column(
        "customers",
        sa.Column(
            "installation_technician_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Assigned field technician",
        ),
    )
    op.add_column(
        "customers",
        sa.Column("installation_notes", sa.Text, nullable=True),
    )

    # Service Details fields
    op.add_column(
        "customers",
        sa.Column(
            "connection_type",
            sa.String(20),
            nullable=True,
            comment="ftth, wireless, dsl, cable, fiber, hybrid",
        ),
    )
    op.add_column(
        "customers",
        sa.Column(
            "last_mile_technology",
            sa.String(50),
            nullable=True,
            comment="gpon, xgs-pon, docsis3.1, lte, 5g, etc",
        ),
    )
    op.add_column(
        "customers",
        sa.Column(
            "service_plan_speed", sa.String(50), nullable=True, comment="e.g., 100/100 Mbps, 1 Gbps"
        ),
    )

    # Network Device Links
    op.add_column(
        "customers",
        sa.Column(
            "assigned_devices",
            postgresql.JSON,
            nullable=False,
            server_default="{}",
            comment="Device assignments: {onu_serial, cpe_mac, router_id, etc}",
        ),
    )

    # Bandwidth Management
    op.add_column(
        "customers",
        sa.Column(
            "current_bandwidth_profile",
            sa.String(50),
            nullable=True,
            comment="Current speed/QoS profile",
        ),
    )
    op.add_column(
        "customers",
        sa.Column(
            "static_ip_assigned",
            sa.String(45),
            nullable=True,
            comment="Static IPv4 address if assigned",
        ),
    )
    op.add_column(
        "customers",
        sa.Column("ipv6_prefix", sa.String(50), nullable=True, comment="IPv6 prefix if assigned"),
    )

    # Service Quality Metrics
    op.add_column(
        "customers",
        sa.Column(
            "avg_uptime_percent",
            sa.Numeric(5, 2),
            nullable=True,
            comment="Average uptime percentage",
        ),
    )
    op.add_column(
        "customers",
        sa.Column(
            "last_outage_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Last service outage",
        ),
    )
    op.add_column(
        "customers",
        sa.Column(
            "total_outages",
            sa.Integer,
            nullable=False,
            server_default="0",
            comment="Total number of outages",
        ),
    )
    op.add_column(
        "customers",
        sa.Column(
            "total_downtime_minutes",
            sa.Integer,
            nullable=False,
            server_default="0",
            comment="Total downtime in minutes",
        ),
    )

    # Add foreign key for installation_technician_id
    op.create_foreign_key(
        "fk_customers_installation_technician",
        "customers",
        "users",
        ["installation_technician_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Create indexes for ISP-specific fields
    op.create_index(
        "ix_customer_service_location",
        "customers",
        ["service_country", "service_state_province", "service_city"],
    )
    op.create_index(
        "ix_customer_installation_status",
        "customers",
        ["tenant_id", "installation_status"],
    )
    op.create_index(
        "ix_customer_connection_type",
        "customers",
        ["tenant_id", "connection_type"],
    )


def downgrade() -> None:
    """Remove ISP-specific fields from customers table."""

    # Drop indexes
    op.drop_index("ix_customer_connection_type", table_name="customers")
    op.drop_index("ix_customer_installation_status", table_name="customers")
    op.drop_index("ix_customer_service_location", table_name="customers")

    # Drop foreign key
    op.drop_constraint("fk_customers_installation_technician", "customers", type_="foreignkey")

    # Drop all ISP-specific columns
    op.drop_column("customers", "total_downtime_minutes")
    op.drop_column("customers", "total_outages")
    op.drop_column("customers", "last_outage_date")
    op.drop_column("customers", "avg_uptime_percent")
    op.drop_column("customers", "ipv6_prefix")
    op.drop_column("customers", "static_ip_assigned")
    op.drop_column("customers", "current_bandwidth_profile")
    op.drop_column("customers", "assigned_devices")
    op.drop_column("customers", "service_plan_speed")
    op.drop_column("customers", "last_mile_technology")
    op.drop_column("customers", "connection_type")
    op.drop_column("customers", "installation_notes")
    op.drop_column("customers", "installation_technician_id")
    op.drop_column("customers", "scheduled_installation_date")
    op.drop_column("customers", "installation_date")
    op.drop_column("customers", "installation_status")
    op.drop_column("customers", "service_coordinates")
    op.drop_column("customers", "service_country")
    op.drop_column("customers", "service_postal_code")
    op.drop_column("customers", "service_state_province")
    op.drop_column("customers", "service_city")
    op.drop_column("customers", "service_address_line2")
    op.drop_column("customers", "service_address_line1")
