"""Add NAS vendor fields for multi-vendor RADIUS support

Revision ID: add_nas_vendor_fields
Revises: 2025_10_25_1400-replace_customer_email_uniqueness_constraint
Create Date: 2025-10-25 16:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'add_nas_vendor_fields'
down_revision: str | None = '2025_10_25_1400'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Add vendor-specific metadata fields to NAS table.

    Fields added:
    - vendor: NAS vendor type (mikrotik, cisco, huawei, juniper, generic)
    - model: Hardware model/type
    - firmware_version: Firmware version for compatibility checks

    Note: If 'nas' table doesn't exist, this migration is skipped.
    """
    # Check if 'nas' table exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'nas' not in inspector.get_table_names():
        print("WARNING: 'nas' table does not exist, skipping add_nas_vendor_fields migration")
        return

    # Add vendor column with default 'mikrotik' for backward compatibility
    op.add_column(
        'nas',
        sa.Column(
            'vendor',
            sa.String(length=30),
            nullable=False,
            server_default='mikrotik',
            comment='NAS vendor: mikrotik, cisco, huawei, juniper, generic'
        )
    )

    # Add model column (nullable)
    op.add_column(
        'nas',
        sa.Column(
            'model',
            sa.String(length=64),
            nullable=True,
            comment='NAS model/hardware type for vendor-specific features'
        )
    )

    # Add firmware_version column (nullable)
    op.add_column(
        'nas',
        sa.Column(
            'firmware_version',
            sa.String(length=32),
            nullable=True,
            comment='Firmware version for compatibility checks'
        )
    )

    # Add index for vendor lookups
    op.create_index('idx_nas_vendor', 'nas', ['vendor'])

    # Migrate existing 'type' values to 'vendor' where possible
    # This provides a smooth migration for existing deployments
    op.execute("""
        UPDATE nas
        SET vendor = CASE
            WHEN type ILIKE '%mikrotik%' THEN 'mikrotik'
            WHEN type ILIKE '%cisco%' THEN 'cisco'
            WHEN type ILIKE '%huawei%' THEN 'huawei'
            WHEN type ILIKE '%juniper%' THEN 'juniper'
            ELSE 'mikrotik'  -- Default fallback
        END
        WHERE vendor = 'mikrotik';  -- Only update rows with default value
    """)


def downgrade() -> None:
    """Remove vendor-specific metadata fields from NAS table."""
    # Check if 'nas' table exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'nas' not in inspector.get_table_names():
        print("WARNING: 'nas' table does not exist, skipping downgrade")
        return

    op.drop_index('idx_nas_vendor', table_name='nas')
    op.drop_column('nas', 'firmware_version')
    op.drop_column('nas', 'model')
    op.drop_column('nas', 'vendor')
