"""add_wireguard_vpn_tables

Revision ID: 698b94587f46
Revises: d4b9530912b8
Create Date: 2025-10-15 04:20:02.439369

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "698b94587f46"
down_revision = "d4b9530912b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types
    op.execute(
        "CREATE TYPE wireguardserverstatus AS ENUM ('active', 'inactive', 'degraded', 'maintenance')"
    )
    op.execute(
        "CREATE TYPE wireguardpeerstatus AS ENUM ('active', 'inactive', 'disabled', 'expired')"
    )

    # Create wireguard_servers table
    op.create_table(
        "wireguard_servers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "name", sa.String(length=255), nullable=False, comment="Human-readable server name"
        ),
        sa.Column("description", sa.Text(), nullable=True, comment="Server description"),
        sa.Column(
            "public_endpoint",
            sa.String(length=255),
            nullable=False,
            comment="Public endpoint (hostname or IP:port)",
        ),
        sa.Column(
            "listen_port",
            sa.Integer(),
            nullable=False,
            server_default="51820",
            comment="UDP listen port",
        ),
        sa.Column(
            "server_ipv4",
            postgresql.INET(),
            nullable=False,
            comment="Server VPN IPv4 address (e.g., 10.8.0.1/24)",
        ),
        sa.Column(
            "server_ipv6",
            postgresql.INET(),
            nullable=True,
            comment="Server VPN IPv6 address (optional)",
        ),
        sa.Column(
            "public_key",
            sa.String(length=44),
            nullable=False,
            comment="Server public key (base64, 44 chars)",
        ),
        sa.Column(
            "private_key_encrypted",
            sa.Text(),
            nullable=False,
            comment="Encrypted server private key",
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "inactive",
                "degraded",
                "maintenance",
                name="wireguardserverstatus",
                create_type=False,
            ),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "max_peers",
            sa.Integer(),
            nullable=False,
            server_default="1000",
            comment="Maximum number of peers",
        ),
        sa.Column(
            "current_peers",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Current number of active peers",
        ),
        sa.Column(
            "next_peer_ip_offset",
            sa.Integer(),
            nullable=False,
            server_default="2",
            comment="Next IP offset for peer allocation (server uses .1)",
        ),
        sa.Column(
            "dns_servers",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
            comment="DNS servers for peers (e.g., ['1.1.1.1', '8.8.8.8'])",
        ),
        sa.Column(
            "allowed_ips",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default='["0.0.0.0/0", "::/0"]',
            comment="Default allowed IPs for peers",
        ),
        sa.Column(
            "persistent_keepalive",
            sa.Integer(),
            nullable=True,
            server_default="25",
            comment="Persistent keepalive in seconds",
        ),
        sa.Column(
            "location",
            sa.String(length=255),
            nullable=True,
            comment="Server location (e.g., 'US-East-1', 'EU-West-2')",
        ),
        sa.Column(
            "metadata",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
            comment="Additional server metadata",
        ),
        sa.Column(
            "total_rx_bytes",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Total received bytes",
        ),
        sa.Column(
            "total_tx_bytes",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Total transmitted bytes",
        ),
        sa.Column(
            "last_stats_update",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Last statistics update timestamp",
        ),
        # TimestampMixin columns
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        # TenantMixin columns
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        # SoftDeleteMixin columns
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        # AuditMixin columns
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_key"),
    )

    # Create indexes for wireguard_servers
    op.create_index(
        "ix_wireguard_server_tenant_status", "wireguard_servers", ["tenant_id", "status"]
    )
    op.create_index("ix_wireguard_server_public_key", "wireguard_servers", ["public_key"])
    op.create_index(op.f("ix_wireguard_servers_status"), "wireguard_servers", ["status"])

    # Create wireguard_peers table
    op.create_table(
        "wireguard_peers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("server_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Link to billing customer",
        ),
        sa.Column(
            "subscriber_id",
            sa.String(length=255),
            nullable=True,
            comment="Link to network subscriber",
        ),
        sa.Column(
            "name", sa.String(length=255), nullable=False, comment="Human-readable peer name"
        ),
        sa.Column("description", sa.Text(), nullable=True, comment="Peer description"),
        sa.Column(
            "public_key",
            sa.String(length=44),
            nullable=False,
            comment="Peer public key (base64, 44 chars)",
        ),
        sa.Column(
            "preshared_key_encrypted",
            sa.Text(),
            nullable=True,
            comment="Encrypted preshared key (optional, for extra security)",
        ),
        sa.Column(
            "peer_ipv4",
            postgresql.INET(),
            nullable=False,
            comment="Peer VPN IPv4 address (e.g., 10.8.0.2/32)",
        ),
        sa.Column(
            "peer_ipv6",
            postgresql.INET(),
            nullable=True,
            comment="Peer VPN IPv6 address (optional)",
        ),
        sa.Column(
            "allowed_ips",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
            comment="Allowed IPs for this peer (overrides server default)",
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "inactive",
                "disabled",
                "expired",
                name="wireguardpeerstatus",
                create_type=False,
            ),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "enabled",
            sa.Boolean(),
            nullable=False,
            server_default="true",
            comment="Whether peer is enabled",
        ),
        sa.Column(
            "last_handshake",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Last successful handshake timestamp",
        ),
        sa.Column(
            "endpoint",
            sa.String(length=255),
            nullable=True,
            comment="Peer's current public endpoint (IP:port)",
        ),
        sa.Column(
            "rx_bytes",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Total received bytes from peer",
        ),
        sa.Column(
            "tx_bytes",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Total transmitted bytes to peer",
        ),
        sa.Column(
            "last_stats_update",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Last statistics update timestamp",
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Peer configuration expiration (for temporary access)",
        ),
        sa.Column(
            "metadata",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
            comment="Additional peer metadata",
        ),
        sa.Column("notes", sa.Text(), nullable=True, comment="Internal notes"),
        sa.Column(
            "config_file",
            sa.Text(),
            nullable=True,
            comment="Generated WireGuard config file for peer",
        ),
        # TimestampMixin columns
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        # TenantMixin columns
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        # SoftDeleteMixin columns
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        # AuditMixin columns
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["server_id"], ["wireguard_servers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["subscriber_id"], ["subscribers.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("public_key"),
    )

    # Create indexes for wireguard_peers
    op.create_index("ix_wireguard_peer_server", "wireguard_peers", ["server_id"])
    op.create_index("ix_wireguard_peer_customer", "wireguard_peers", ["customer_id"])
    op.create_index("ix_wireguard_peer_subscriber", "wireguard_peers", ["subscriber_id"])
    op.create_index("ix_wireguard_peer_tenant_status", "wireguard_peers", ["tenant_id", "status"])
    op.create_index("ix_wireguard_peer_public_key", "wireguard_peers", ["public_key"])
    op.create_index(op.f("ix_wireguard_peers_status"), "wireguard_peers", ["status"])


def downgrade() -> None:
    # Drop tables
    op.drop_table("wireguard_peers")
    op.drop_table("wireguard_servers")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS wireguardpeerstatus")
    op.execute("DROP TYPE IF EXISTS wireguardserverstatus")
