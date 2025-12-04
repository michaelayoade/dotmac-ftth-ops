"""add_ipv4_lifecycle_fields_to_ip_reservations

Adds lifecycle management fields to ip_reservations table for IPv4 lifecycle tracking.

This migration enables IPv4 addresses to follow the same lifecycle state machine as IPv6:
PENDING -> ALLOCATED -> ACTIVE -> SUSPENDED <-> ACTIVE -> REVOKING -> REVOKED

Revision ID: 18d78dc9acd0
Revises: 2025_11_08_2100
Create Date: 2025-11-08 15:53:46.102967

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "18d78dc9acd0"
down_revision = "2025_11_08_2100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add lifecycle management fields to ip_reservations."""

    # Create LifecycleState enum type
    lifecycle_state_enum = postgresql.ENUM(
        "pending",
        "allocated",
        "active",
        "suspended",
        "revoking",
        "revoked",
        "failed",
        name="lifecyclestate",
        create_type=True,
    )
    lifecycle_state_enum.create(op.get_bind(), checkfirst=True)

    # Add lifecycle_state column (defaults to 'pending' for new reservations)
    op.add_column(
        "ip_reservations",
        sa.Column(
            "lifecycle_state",
            sa.Enum(
                "pending",
                "allocated",
                "active",
                "suspended",
                "revoking",
                "revoked",
                "failed",
                name="lifecyclestate",
            ),
            nullable=False,
            server_default="pending",
            comment="Current lifecycle state of the IP reservation",
        ),
    )

    # Add lifecycle timestamp columns
    op.add_column(
        "ip_reservations",
        sa.Column(
            "lifecycle_allocated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the IP was allocated (lifecycle tracking)",
        ),
    )
    op.add_column(
        "ip_reservations",
        sa.Column(
            "lifecycle_activated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the IP was activated (lifecycle tracking)",
        ),
    )
    op.add_column(
        "ip_reservations",
        sa.Column(
            "lifecycle_suspended_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the IP was suspended (lifecycle tracking)",
        ),
    )
    op.add_column(
        "ip_reservations",
        sa.Column(
            "lifecycle_revoked_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the IP was revoked (lifecycle tracking)",
        ),
    )

    # Add lifecycle metadata JSONB column
    op.add_column(
        "ip_reservations",
        sa.Column(
            "lifecycle_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'{}'::jsonb"),
            comment="Additional lifecycle metadata (e.g., NetBox sync status, CoA results)",
        ),
    )

    # Create indexes for efficient lifecycle state queries
    op.create_index(
        "ix_ip_reservations_lifecycle_state",
        "ip_reservations",
        ["lifecycle_state"],
        unique=False,
    )

    # Composite index for tenant-scoped lifecycle queries
    op.create_index(
        "ix_ip_reservations_tenant_lifecycle",
        "ip_reservations",
        ["tenant_id", "lifecycle_state"],
        unique=False,
    )

    # Update existing reservations to set lifecycle_state based on current status
    # RESERVED -> allocated, ASSIGNED -> active, RELEASED -> revoked, EXPIRED -> revoked
    op.execute(
        """
        UPDATE ip_reservations
        SET lifecycle_state = CASE
            WHEN status = 'reserved' THEN 'allocated'::lifecyclestate
            WHEN status = 'assigned' THEN 'active'::lifecyclestate
            WHEN status = 'released' THEN 'revoked'::lifecyclestate
            WHEN status = 'expired' THEN 'revoked'::lifecyclestate
            ELSE 'pending'::lifecyclestate
        END,
        lifecycle_allocated_at = CASE
            WHEN status IN ('reserved', 'assigned') THEN reserved_at
            ELSE NULL
        END,
        lifecycle_activated_at = CASE
            WHEN status = 'assigned' THEN assigned_at
            ELSE NULL
        END,
        lifecycle_revoked_at = CASE
            WHEN status IN ('released', 'expired') THEN released_at
            ELSE NULL
        END
        WHERE lifecycle_state = 'pending'
        """
    )


def downgrade() -> None:
    """Remove lifecycle management fields from ip_reservations."""

    # Drop indexes
    op.drop_index("ix_ip_reservations_tenant_lifecycle", table_name="ip_reservations")
    op.drop_index("ix_ip_reservations_lifecycle_state", table_name="ip_reservations")

    # Drop columns
    op.drop_column("ip_reservations", "lifecycle_metadata")
    op.drop_column("ip_reservations", "lifecycle_revoked_at")
    op.drop_column("ip_reservations", "lifecycle_suspended_at")
    op.drop_column("ip_reservations", "lifecycle_activated_at")
    op.drop_column("ip_reservations", "lifecycle_allocated_at")
    op.drop_column("ip_reservations", "lifecycle_state")

    # Drop enum type
    lifecycle_state_enum = postgresql.ENUM(
        "pending",
        "allocated",
        "active",
        "suspended",
        "revoking",
        "revoked",
        "failed",
        name="lifecyclestate",
    )
    lifecycle_state_enum.drop(op.get_bind(), checkfirst=True)
