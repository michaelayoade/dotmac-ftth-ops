"""add_user_devices_table

Revision ID: g6h7i8j9k0l1
Revises: f0a1b2c3d4e5
Create Date: 2025-10-20 16:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'g6h7i8j9k0l1'
down_revision: str | None = 'f0a1b2c3d4e5'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create user_devices table for push notification device registration."""

    # ============================================================================
    # user_devices - Device registration for push notifications
    # ============================================================================
    op.create_table(
        'user_devices',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),

        # Tenant reference
        sa.Column('tenant_id', sa.String(50), nullable=False, index=True),

        # User reference
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),

        # Device information
        sa.Column('device_token', sa.String(512), nullable=False, index=True),
        sa.Column('device_type', sa.String(20), nullable=False),  # ios, android, web
        sa.Column('device_name', sa.String(255), nullable=True),
        sa.Column('device_model', sa.String(255), nullable=True),
        sa.Column('os_version', sa.String(50), nullable=True),
        sa.Column('app_version', sa.String(50), nullable=True),

        # Push notification provider
        sa.Column('push_provider', sa.String(50), nullable=False),  # fcm, apns, onesignal, etc.

        # Status
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),

        # Tracking
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('registered_ip', sa.String(45), nullable=True),

        # Metadata
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),

        # Foreign keys
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_user_devices_user_id', ondelete='CASCADE'),

        # Constraints
        sa.UniqueConstraint('user_id', 'device_token', name='uq_user_devices_user_token'),
    )

    # Create indexes for efficient queries
    op.create_index('ix_user_devices_tenant_id', 'user_devices', ['tenant_id'])
    op.create_index('ix_user_devices_user_id_active', 'user_devices', ['user_id', 'is_active'])
    op.create_index('ix_user_devices_device_type', 'user_devices', ['device_type'])


def downgrade() -> None:
    """Drop user_devices table."""

    # Drop indexes
    op.drop_index('ix_user_devices_device_type', table_name='user_devices')
    op.drop_index('ix_user_devices_user_id_active', table_name='user_devices')
    op.drop_index('ix_user_devices_tenant_id', table_name='user_devices')

    # Drop table
    op.drop_table('user_devices')
