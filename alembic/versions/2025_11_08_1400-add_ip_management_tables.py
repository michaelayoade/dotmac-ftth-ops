"""add_ip_management_tables

Revision ID: a8f9c3d2e1b6
Revises: 5b5a2281d1e4
Create Date: 2025-11-08 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a8f9c3d2e1b6'
down_revision: Union[str, None] = '5b5a2281d1e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Create IP pool type enum (only if it doesn't exist)
    result = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ippooltype')"))
    if not result.scalar():
        op.execute("""
            CREATE TYPE ippooltype AS ENUM (
                'ipv4_public',
                'ipv4_private',
                'ipv6_global',
                'ipv6_ula',
                'ipv6_pd'
            )
        """)

    # Create IP pool status enum (only if it doesn't exist)
    result = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ippoolstatus')"))
    if not result.scalar():
        op.execute("""
            CREATE TYPE ippoolstatus AS ENUM (
                'active',
                'reserved',
                'depleted',
                'maintenance'
            )
        """)

    # Create IP reservation status enum (only if it doesn't exist)
    result = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ipreservationstatus')"))
    if not result.scalar():
        op.execute("""
            CREATE TYPE ipreservationstatus AS ENUM (
                'reserved',
                'assigned',
                'released',
                'expired'
            )
        """)

    # Reference existing enum types (don't create them again)
    pool_type_enum = postgresql.ENUM('ipv4_public', 'ipv4_private', 'ipv6_global', 'ipv6_ula', 'ipv6_pd', name='ippooltype', create_type=False)
    pool_status_enum = postgresql.ENUM('active', 'reserved', 'depleted', 'maintenance', name='ippoolstatus', create_type=False)
    reservation_status_enum = postgresql.ENUM('reserved', 'assigned', 'released', 'expired', name='ipreservationstatus', create_type=False)

    # Create ip_pools table
    op.create_table(
        'ip_pools',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False),
        sa.Column('pool_name', sa.String(100), nullable=False),
        sa.Column('pool_type', pool_type_enum, nullable=False),
        sa.Column('network_cidr', sa.String(64), nullable=False),
        sa.Column('gateway', postgresql.INET(), nullable=True),
        sa.Column('dns_servers', sa.Text(), nullable=True),
        sa.Column('vlan_id', sa.Integer(), nullable=True),
        sa.Column('status', pool_status_enum, nullable=False, server_default='active'),
        sa.Column('total_addresses', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('reserved_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('assigned_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('netbox_prefix_id', sa.Integer(), nullable=True),
        sa.Column('netbox_synced_at', sa.DateTime(), nullable=True),
        sa.Column('auto_assign_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('allow_manual_reservation', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), onupdate=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.Column('deleted_by', sa.String(255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('tenant_id', 'pool_name', name='uq_ip_pool_tenant_name'),
        comment='IP address pools for static allocation'
    )

    op.create_index('ix_ip_pools_tenant_id', 'ip_pools', ['tenant_id'])
    op.create_index('ix_ip_pools_pool_name', 'ip_pools', ['pool_name'])
    op.create_index('ix_ip_pools_status', 'ip_pools', ['status'])

    # Create ip_reservations table
    op.create_table(
        'ip_reservations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', sa.String(255), nullable=False),
        sa.Column('pool_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subscriber_id', sa.String(255), nullable=False),
        sa.Column('ip_address', postgresql.INET(), nullable=False),
        sa.Column('ip_type', sa.String(20), nullable=False),
        sa.Column('prefix_length', sa.Integer(), nullable=True),
        sa.Column('status', reservation_status_enum, nullable=False, server_default='reserved'),
        sa.Column('reserved_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('assigned_at', sa.DateTime(), nullable=True),
        sa.Column('released_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('netbox_ip_id', sa.Integer(), nullable=True),
        sa.Column('netbox_synced', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('assigned_by', sa.String(255), nullable=True),
        sa.Column('assignment_reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), onupdate=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.Column('deleted_by', sa.String(255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['pool_id'], ['ip_pools.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['subscriber_id'], ['subscribers.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('tenant_id', 'ip_address', name='uq_ip_reservation_tenant_ip'),
        sa.UniqueConstraint('tenant_id', 'subscriber_id', 'ip_type', name='uq_ip_reservation_subscriber_type'),
        comment='IP address reservations for subscribers'
    )

    op.create_index('ix_ip_reservations_tenant_id', 'ip_reservations', ['tenant_id'])
    op.create_index('ix_ip_reservations_pool_id', 'ip_reservations', ['pool_id'])
    op.create_index('ix_ip_reservations_subscriber_id', 'ip_reservations', ['subscriber_id'])
    op.create_index('ix_ip_reservations_ip_address', 'ip_reservations', ['ip_address'])
    op.create_index('ix_ip_reservations_status', 'ip_reservations', ['status'])


def downgrade() -> None:
    op.drop_index('ix_ip_reservations_status', 'ip_reservations')
    op.drop_index('ix_ip_reservations_ip_address', 'ip_reservations')
    op.drop_index('ix_ip_reservations_subscriber_id', 'ip_reservations')
    op.drop_index('ix_ip_reservations_pool_id', 'ip_reservations')
    op.drop_index('ix_ip_reservations_tenant_id', 'ip_reservations')
    op.drop_table('ip_reservations')

    op.drop_index('ix_ip_pools_status', 'ip_pools')
    op.drop_index('ix_ip_pools_pool_name', 'ip_pools')
    op.drop_index('ix_ip_pools_tenant_id', 'ip_pools')
    op.drop_table('ip_pools')

    op.execute('DROP TYPE ipreservationstatus')
    op.execute('DROP TYPE ippoolstatus')
    op.execute('DROP TYPE ippooltype')
