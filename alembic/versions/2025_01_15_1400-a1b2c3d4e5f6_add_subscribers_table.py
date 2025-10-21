"""add_subscribers_table

Revision ID: a1b2c3d4e5f6
Revises: d3f4e8a1b2c5
Create Date: 2025-01-15 14:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "d3f4e8a1b2c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create subscribers table for ISP network service management."""

    # Create SubscriberStatus enum (with IF NOT EXISTS to avoid duplicate errors)
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE subscriberstatus AS ENUM (
                'pending',
                'active',
                'suspended',
                'disconnected',
                'terminated',
                'quarantined'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """
    )

    # Create ServiceType enum (with checkfirst to avoid duplicate errors)
    # This enum may also be created by the service lifecycle migration (dc34675b64e9)
    # Using checkfirst=True ensures no error if it already exists
    service_type_enum = sa.Enum(
        "fiber_internet",
        "dsl_internet",
        "cable_internet",
        "wireless_internet",
        "satellite_internet",
        "voip",
        "pstn",
        "mobile",
        "iptv",
        "cable_tv",
        "static_ip",
        "email_hosting",
        "cloud_storage",
        "managed_wifi",
        "network_security",
        "triple_play",
        "double_play",
        "custom_bundle",
        name="servicetype",
    )
    service_type_enum.create(op.get_bind(), checkfirst=True)

    # Create subscribers table
    op.create_table(
        "subscribers",
        # Primary key
        sa.Column("id", sa.String(255), primary_key=True, nullable=False),
        # Tenant isolation
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # Links to Customer and User
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # Subscriber identification
        sa.Column("username", sa.String(64), nullable=False, index=True),
        sa.Column("password", sa.String(255), nullable=False),
        sa.Column("subscriber_number", sa.String(50), nullable=True, index=True),
        # Service status
        sa.Column(
            "status",
            postgresql.ENUM(name="subscriberstatus", create_type=False),
            nullable=False,
            server_default="pending",
            index=True,
        ),
        sa.Column(
            "service_type",
            postgresql.ENUM(name="servicetype", create_type=False),
            nullable=False,
            server_default="fiber_internet",
            index=True,
        ),
        # Service details
        # Note: bandwidth_profile_id is a string reference to RADIUS bandwidth profile
        # Foreign key constraint will be added by the add_radius_tables migration
        sa.Column(
            "bandwidth_profile_id",
            sa.String(255),
            nullable=True,
        ),
        sa.Column("download_speed_kbps", sa.Integer, nullable=True),
        sa.Column("upload_speed_kbps", sa.Integer, nullable=True),
        # Network assignments
        sa.Column("static_ipv4", postgresql.INET, nullable=True),
        sa.Column("ipv6_prefix", sa.String(50), nullable=True),
        sa.Column("vlan_id", sa.Integer, nullable=True),
        sa.Column("nas_identifier", sa.String(128), nullable=True, index=True),
        # Device assignments
        sa.Column("onu_serial", sa.String(50), nullable=True, index=True),
        sa.Column("cpe_mac_address", sa.String(17), nullable=True, index=True),
        sa.Column("device_metadata", postgresql.JSON, nullable=False, server_default="{}"),
        # Service location
        sa.Column("service_address", sa.String(500), nullable=True),
        sa.Column("service_coordinates", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column("site_id", sa.String(100), nullable=True, index=True),
        # Service dates
        sa.Column("activation_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("suspension_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("termination_date", sa.TIMESTAMP(timezone=True), nullable=True),
        # Session limits
        sa.Column("session_timeout", sa.Integer, nullable=True),
        sa.Column("idle_timeout", sa.Integer, nullable=True),
        sa.Column("simultaneous_use", sa.Integer, nullable=False, server_default="1"),
        # Usage tracking
        sa.Column("last_online", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("total_sessions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_upload_bytes", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("total_download_bytes", sa.BigInteger, nullable=False, server_default="0"),
        # External system references
        sa.Column("netbox_ip_id", sa.Integer, nullable=True),
        sa.Column("voltha_onu_id", sa.String(100), nullable=True),
        sa.Column("genieacs_device_id", sa.String(100), nullable=True),
        # Custom fields
        sa.Column("metadata", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column("notes", sa.Text, nullable=True),
        # Timestamps
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        # Soft delete
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        # Audit fields
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Create indexes
    op.create_index(
        "ix_subscriber_status",
        "subscribers",
        ["tenant_id", "status"],
    )
    op.create_index(
        "ix_subscriber_service_type",
        "subscribers",
        ["tenant_id", "service_type"],
    )
    op.create_index(
        "ix_subscriber_customer",
        "subscribers",
        ["customer_id"],
    )
    op.create_index(
        "ix_subscriber_nas",
        "subscribers",
        ["nas_identifier"],
    )
    op.create_index(
        "ix_subscriber_onu",
        "subscribers",
        ["onu_serial"],
    )
    op.create_index(
        "ix_subscriber_cpe",
        "subscribers",
        ["cpe_mac_address"],
    )
    op.create_index(
        "ix_subscriber_site",
        "subscribers",
        ["site_id"],
    )

    # Create unique constraints
    op.create_unique_constraint(
        "uq_subscriber_tenant_username",
        "subscribers",
        ["tenant_id", "username"],
    )
    op.create_unique_constraint(
        "uq_subscriber_tenant_number",
        "subscribers",
        ["tenant_id", "subscriber_number"],
    )


def downgrade() -> None:
    """Drop subscribers table and enums."""

    # Drop table (cascades to relationships)
    op.drop_table("subscribers")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS subscriberstatus")
    op.execute("DROP TYPE IF EXISTS servicetype")
