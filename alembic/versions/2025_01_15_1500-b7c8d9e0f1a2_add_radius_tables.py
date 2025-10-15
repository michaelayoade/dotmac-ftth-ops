"""add_radius_tables

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
Create Date: 2025-01-15 15:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "b7c8d9e0f1a2"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create FreeRADIUS database tables.

    These tables are required for RADIUS authentication, authorization, and accounting.
    FreeRADIUS reads from these tables to validate subscribers and track sessions.
    """

    # =========================================================================
    # 1. RadCheck - Authentication Attributes
    # =========================================================================
    op.create_table(
        "radcheck",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "subscriber_id",
            sa.String(255),
            sa.ForeignKey("subscribers.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("username", sa.String(64), nullable=False, index=True),
        sa.Column("attribute", sa.String(64), nullable=False),
        sa.Column("op", sa.String(2), nullable=False, server_default=":="),
        sa.Column("value", sa.String(253), nullable=False),
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
    )

    # Indexes for radcheck
    op.create_index(
        "idx_radcheck_tenant_username",
        "radcheck",
        ["tenant_id", "username"],
    )
    op.create_index(
        "idx_radcheck_subscriber",
        "radcheck",
        ["subscriber_id"],
    )

    # =========================================================================
    # 2. RadReply - Authorization Attributes
    # =========================================================================
    op.create_table(
        "radreply",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "subscriber_id",
            sa.String(255),
            sa.ForeignKey("subscribers.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("username", sa.String(64), nullable=False, index=True),
        sa.Column("attribute", sa.String(64), nullable=False),
        sa.Column("op", sa.String(2), nullable=False, server_default="="),
        sa.Column("value", sa.String(253), nullable=False),
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
    )

    # Indexes for radreply
    op.create_index(
        "idx_radreply_tenant_username",
        "radreply",
        ["tenant_id", "username"],
    )
    op.create_index(
        "idx_radreply_subscriber",
        "radreply",
        ["subscriber_id"],
    )

    # =========================================================================
    # 3. RadAcct - Session Accounting
    # =========================================================================
    op.create_table(
        "radacct",
        sa.Column("radacctid", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "subscriber_id",
            sa.String(255),
            sa.ForeignKey("subscribers.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("acctsessionid", sa.String(64), nullable=False, index=True),
        sa.Column("acctuniqueid", sa.String(32), nullable=False, unique=True),
        sa.Column("username", sa.String(64), nullable=True, index=True),
        sa.Column("groupname", sa.String(64), nullable=True),
        sa.Column("realm", sa.String(64), nullable=True),
        sa.Column("nasipaddress", postgresql.INET, nullable=False, index=True),
        sa.Column("nasportid", sa.String(15), nullable=True),
        sa.Column("nasporttype", sa.String(32), nullable=True),
        sa.Column("acctstarttime", sa.TIMESTAMP(timezone=True), nullable=True, index=True),
        sa.Column("acctupdatetime", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("acctstoptime", sa.TIMESTAMP(timezone=True), nullable=True, index=True),
        sa.Column("acctinterval", sa.Integer, nullable=True),
        sa.Column("acctsessiontime", sa.BigInteger, nullable=True),
        sa.Column("acctauthentic", sa.String(32), nullable=True),
        sa.Column("connectinfo_start", sa.String(50), nullable=True),
        sa.Column("connectinfo_stop", sa.String(50), nullable=True),
        sa.Column("acctinputoctets", sa.BigInteger, nullable=True),
        sa.Column("acctoutputoctets", sa.BigInteger, nullable=True),
        sa.Column("calledstationid", sa.String(50), nullable=True),
        sa.Column("callingstationid", sa.String(50), nullable=True),
        sa.Column("acctterminatecause", sa.String(32), nullable=True),
        sa.Column("servicetype", sa.String(32), nullable=True),
        sa.Column("framedprotocol", sa.String(32), nullable=True),
        sa.Column("framedipaddress", postgresql.INET, nullable=True),
        sa.Column("framedipv6address", postgresql.INET, nullable=True),
        sa.Column("framedipv6prefix", postgresql.INET, nullable=True),
        sa.Column("framedinterfaceid", sa.String(44), nullable=True),
        sa.Column("delegatedipv6prefix", postgresql.INET, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # Indexes for radacct
    op.create_index("idx_radacct_tenant", "radacct", ["tenant_id"])
    op.create_index("idx_radacct_subscriber", "radacct", ["subscriber_id"])
    op.create_index("idx_radacct_username", "radacct", ["username"])
    op.create_index("idx_radacct_sessionid", "radacct", ["acctsessionid"])
    op.create_index("idx_radacct_starttime", "radacct", ["acctstarttime"])
    op.create_index("idx_radacct_stoptime", "radacct", ["acctstoptime"])
    op.create_index("idx_radacct_nasip", "radacct", ["nasipaddress"])

    # Partial index for active sessions (where acctstoptime IS NULL)
    op.execute(
        """
        CREATE INDEX idx_radacct_active_session
        ON radacct (tenant_id, username)
        WHERE acctstoptime IS NULL
    """
    )

    # =========================================================================
    # 4. RadPostAuth - Authentication Logging
    # =========================================================================
    op.create_table(
        "radpostauth",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("username", sa.String(64), nullable=False, index=True),
        sa.Column("password", sa.String(64), nullable=True),
        sa.Column("reply", sa.String(32), nullable=True),
        sa.Column(
            "authdate",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
            index=True,
        ),
        sa.Column("nasipaddress", postgresql.INET, nullable=True),
    )

    # Indexes for radpostauth
    op.create_index("idx_radpostauth_tenant", "radpostauth", ["tenant_id"])
    op.create_index("idx_radpostauth_username", "radpostauth", ["username"])
    op.create_index("idx_radpostauth_date", "radpostauth", ["authdate"])

    # =========================================================================
    # 5. NAS - Network Access Servers
    # =========================================================================
    op.create_table(
        "nas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("nasname", sa.String(128), nullable=False, index=True),
        sa.Column("shortname", sa.String(32), nullable=False),
        sa.Column("type", sa.String(30), nullable=False, server_default="other"),
        sa.Column("ports", sa.Integer, nullable=True),
        sa.Column("secret", sa.String(60), nullable=False),
        sa.Column("server", sa.String(64), nullable=True),
        sa.Column("community", sa.String(50), nullable=True),
        sa.Column("description", sa.String(200), nullable=True),
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
    )

    # Indexes for nas
    op.create_index("idx_nas_tenant", "nas", ["tenant_id"])
    op.create_index("idx_nas_name", "nas", ["nasname"])

    # =========================================================================
    # 6. RadiusBandwidthProfile - QoS Profiles
    # =========================================================================
    op.create_table(
        "radius_bandwidth_profiles",
        sa.Column("id", sa.String(255), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("download_rate_kbps", sa.Integer, nullable=False),
        sa.Column("upload_rate_kbps", sa.Integer, nullable=False),
        sa.Column("download_burst_kbps", sa.Integer, nullable=True),
        sa.Column("upload_burst_kbps", sa.Integer, nullable=True),
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
    )

    # Indexes for radius_bandwidth_profiles
    op.create_index("idx_bandwidth_profile_tenant", "radius_bandwidth_profiles", ["tenant_id"])


def downgrade() -> None:
    """Drop all RADIUS tables."""

    # Drop tables in reverse order to respect foreign keys
    op.drop_table("radius_bandwidth_profiles")
    op.drop_table("nas")
    op.drop_table("radpostauth")
    op.drop_table("radacct")
    op.drop_table("radreply")
    op.drop_table("radcheck")
