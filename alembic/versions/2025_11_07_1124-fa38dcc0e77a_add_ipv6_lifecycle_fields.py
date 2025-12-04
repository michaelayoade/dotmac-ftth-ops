"""add_ipv6_lifecycle_fields

Phase 4: IPv6 Lifecycle Management - Add lifecycle tracking fields

Revision ID: fa38dcc0e77a
Revises: b7e8d4f3g2h7
Create Date: 2025-11-07 11:24:38.292034

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.exc import ProgrammingError


# revision identifiers, used by Alembic.
revision = "fa38dcc0e77a"
down_revision = "b7e8d4f3g2h7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Create IPv6LifecycleState enum if it doesn't exist
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ipv6lifecyclestate')")
    )
    if not result.scalar():
        op.execute("""
            CREATE TYPE ipv6lifecyclestate AS ENUM (
                'pending',
                'allocated',
                'active',
                'suspended',
                'revoking',
                'revoked',
                'failed'
            )
        """)

    # Add IPv6 lifecycle fields to subscriber_network_profiles
    op.add_column(
        "subscriber_network_profiles",
        sa.Column(
            "ipv6_state",
            sa.Enum(
                "pending",
                "allocated",
                "active",
                "suspended",
                "revoking",
                "revoked",
                "failed",
                name="ipv6lifecyclestate",
            ),
            nullable=False,
            server_default="pending",
            comment="Current lifecycle state of IPv6 prefix allocation",
        ),
    )

    op.add_column(
        "subscriber_network_profiles",
        sa.Column(
            "ipv6_allocated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when IPv6 prefix was allocated from NetBox",
        ),
    )

    op.add_column(
        "subscriber_network_profiles",
        sa.Column(
            "ipv6_activated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when IPv6 prefix was provisioned via RADIUS",
        ),
    )

    op.add_column(
        "subscriber_network_profiles",
        sa.Column(
            "ipv6_revoked_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when IPv6 prefix was revoked and returned to pool",
        ),
    )

    op.add_column(
        "subscriber_network_profiles",
        sa.Column(
            "ipv6_netbox_prefix_id",
            sa.Integer(),
            nullable=True,
            comment="NetBox prefix ID for tracking lifecycle in IPAM",
        ),
    )

    # Create index on ipv6_netbox_prefix_id for lookups
    op.create_index(
        "ix_subscriber_network_profiles_ipv6_netbox_prefix_id",
        "subscriber_network_profiles",
        ["ipv6_netbox_prefix_id"],
    )


def downgrade() -> None:
    # Drop index
    op.drop_index(
        "ix_subscriber_network_profiles_ipv6_netbox_prefix_id",
        table_name="subscriber_network_profiles",
    )

    # Drop columns
    op.drop_column("subscriber_network_profiles", "ipv6_netbox_prefix_id")
    op.drop_column("subscriber_network_profiles", "ipv6_revoked_at")
    op.drop_column("subscriber_network_profiles", "ipv6_activated_at")
    op.drop_column("subscriber_network_profiles", "ipv6_allocated_at")
    op.drop_column("subscriber_network_profiles", "ipv6_state")

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS ipv6lifecyclestate")
