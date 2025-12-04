"""add_billing_addons_tables

Revision ID: a1b2c3d4e5f6
Revises: 4f09f72a05c3
Create Date: 2025-10-20 14:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f0a1b2c3d4e5'
down_revision: str | None = '4f09f72a05c3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create billing add-ons tables."""

    # ============================================================================
    # billing_addons - Add-on catalog
    # ============================================================================
    op.create_table(
        'billing_addons',
        sa.Column('addon_id', sa.String(50), primary_key=True),
        sa.Column('tenant_id', sa.String(50), nullable=False),

        # Basic information
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('addon_type', sa.String(20), nullable=False),  # feature, resource, service, user_seats, integration
        sa.Column('billing_type', sa.String(20), nullable=False),  # one_time, recurring, metered

        # Pricing
        sa.Column('price', sa.Numeric(15, 2), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('setup_fee', sa.Numeric(15, 2), nullable=True),

        # Quantity configuration
        sa.Column('is_quantity_based', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('min_quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('max_quantity', sa.Integer(), nullable=True),

        # Metered billing configuration
        sa.Column('metered_unit', sa.String(50), nullable=True),
        sa.Column('included_quantity', sa.Integer(), nullable=True),

        # Availability
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_featured', sa.Boolean(), nullable=False, server_default='false'),

        # Plan compatibility
        sa.Column('compatible_with_all_plans', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('compatible_plan_ids', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),

        # Metadata
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('icon', sa.String(255), nullable=True),
        sa.Column('features', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Indexes for billing_addons
    op.create_index('ix_billing_addons_tenant_active', 'billing_addons', ['tenant_id', 'is_active'])
    op.create_index('ix_billing_addons_tenant_type', 'billing_addons', ['tenant_id', 'addon_type'])
    op.create_index('ix_billing_addons_tenant_billing_type', 'billing_addons', ['tenant_id', 'billing_type'])
    op.create_index('ix_billing_addons_tenant_featured', 'billing_addons', ['tenant_id', 'is_featured'])

    # ============================================================================
    # billing_tenant_addons - Tenant's purchased add-ons
    # ============================================================================
    op.create_table(
        'billing_tenant_addons',
        sa.Column('tenant_addon_id', sa.String(50), primary_key=True),
        sa.Column('tenant_id', sa.String(50), nullable=False),
        sa.Column('addon_id', sa.String(50), nullable=False),

        # Subscription association
        sa.Column('subscription_id', sa.String(50), nullable=True),

        # Current state
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),  # active, canceled, ended, suspended
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),

        # Billing dates
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('current_period_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('canceled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),

        # Usage tracking (for metered add-ons)
        sa.Column('current_usage', sa.Integer(), nullable=False, server_default='0'),

        # Metadata
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Indexes for billing_tenant_addons
    op.create_index('ix_billing_tenant_addons_tenant', 'billing_tenant_addons', ['tenant_id'])
    op.create_index('ix_billing_tenant_addons_tenant_status', 'billing_tenant_addons', ['tenant_id', 'status'])
    op.create_index('ix_billing_tenant_addons_addon', 'billing_tenant_addons', ['addon_id'])
    op.create_index('ix_billing_tenant_addons_subscription', 'billing_tenant_addons', ['subscription_id'])
    op.create_index('ix_billing_tenant_addons_period_end', 'billing_tenant_addons', ['current_period_end'])

    # Foreign key constraints
    op.create_foreign_key(
        'fk_billing_tenant_addons_addon',
        'billing_tenant_addons', 'billing_addons',
        ['addon_id'], ['addon_id'],
        ondelete='RESTRICT'
    )
    op.create_foreign_key(
        'fk_billing_tenant_addons_subscription',
        'billing_tenant_addons', 'billing_subscriptions',
        ['subscription_id'], ['subscription_id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Drop billing add-ons tables."""

    # Drop foreign keys first
    op.drop_constraint('fk_billing_tenant_addons_subscription', 'billing_tenant_addons', type_='foreignkey')
    op.drop_constraint('fk_billing_tenant_addons_addon', 'billing_tenant_addons', type_='foreignkey')

    # Drop indexes
    op.drop_index('ix_billing_tenant_addons_period_end', 'billing_tenant_addons')
    op.drop_index('ix_billing_tenant_addons_subscription', 'billing_tenant_addons')
    op.drop_index('ix_billing_tenant_addons_addon', 'billing_tenant_addons')
    op.drop_index('ix_billing_tenant_addons_tenant_status', 'billing_tenant_addons')
    op.drop_index('ix_billing_tenant_addons_tenant', 'billing_tenant_addons')

    op.drop_index('ix_billing_addons_tenant_featured', 'billing_addons')
    op.drop_index('ix_billing_addons_tenant_billing_type', 'billing_addons')
    op.drop_index('ix_billing_addons_tenant_type', 'billing_addons')
    op.drop_index('ix_billing_addons_tenant_active', 'billing_addons')

    # Drop tables
    op.drop_table('billing_tenant_addons')
    op.drop_table('billing_addons')
