"""add internet service plans tables

Revision ID: 8a9b0c1d2e3f
Revises: 7f8e9d0a1b2c
Create Date: 2025-10-16 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '8a9b0c1d2e3f'
down_revision: str | None = '7f8e9d0a1b2c'  # Wireless infrastructure migration
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create enums (using DO block to handle existing types)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE speedunit AS ENUM ('kbps', 'mbps', 'gbps');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE dataunit AS ENUM ('MB', 'GB', 'TB', 'unlimited');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE plantype AS ENUM ('residential', 'business', 'enterprise', 'promotional');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE billingcycle AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'annual');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE throttlepolicy AS ENUM ('no_throttle', 'throttle', 'block', 'overage_charge');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE planstatus AS ENUM ('draft', 'active', 'inactive', 'archived');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create internet_service_plans table
    op.create_table(
        'internet_service_plans',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),

        # Plan identification
        sa.Column('plan_code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=1000), nullable=True),
        sa.Column('plan_type', postgresql.ENUM('residential', 'business', 'enterprise', 'promotional', name='plantype', create_type=False), nullable=False),
        sa.Column('status', postgresql.ENUM('draft', 'active', 'inactive', 'archived', name='planstatus', create_type=False), nullable=False, server_default='draft'),

        # Speed configuration
        sa.Column('download_speed', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('upload_speed', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('speed_unit', postgresql.ENUM('kbps', 'mbps', 'gbps', name='speedunit', create_type=False), nullable=False, server_default='mbps'),

        # Burst speeds
        sa.Column('burst_download_speed', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('burst_upload_speed', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('burst_duration_seconds', sa.Integer(), nullable=True),

        # Data cap configuration
        sa.Column('has_data_cap', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('data_cap_amount', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('data_cap_unit', postgresql.ENUM('MB', 'GB', 'TB', 'unlimited', name='dataunit', create_type=False), nullable=True),
        sa.Column('throttle_policy', postgresql.ENUM('no_throttle', 'throttle', 'block', 'overage_charge', name='throttlepolicy', create_type=False), nullable=False, server_default='no_throttle'),

        # Throttled speeds
        sa.Column('throttled_download_speed', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('throttled_upload_speed', sa.Numeric(precision=10, scale=2), nullable=True),

        # Overage charges
        sa.Column('overage_price_per_unit', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('overage_unit', postgresql.ENUM('MB', 'GB', 'TB', 'unlimited', name='dataunit', create_type=False), nullable=True),

        # Fair Usage Policy (FUP)
        sa.Column('has_fup', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('fup_threshold', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('fup_threshold_unit', postgresql.ENUM('MB', 'GB', 'TB', 'unlimited', name='dataunit', create_type=False), nullable=True),
        sa.Column('fup_throttle_speed', sa.Numeric(precision=10, scale=2), nullable=True),

        # Time-based restrictions
        sa.Column('has_time_restrictions', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('unrestricted_start_time', sa.Time(), nullable=True),
        sa.Column('unrestricted_end_time', sa.Time(), nullable=True),
        sa.Column('unrestricted_data_unlimited', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('unrestricted_speed_multiplier', sa.Numeric(precision=4, scale=2), nullable=True),

        # QoS and priority
        sa.Column('qos_priority', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('traffic_shaping_enabled', sa.Boolean(), nullable=False, server_default='false'),

        # Pricing
        sa.Column('monthly_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('setup_fee', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.00'),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='USD'),
        sa.Column('billing_cycle', postgresql.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annual', name='billingcycle', create_type=False), nullable=False, server_default='monthly'),

        # Availability
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_promotional', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('promotion_start_date', sa.DateTime(), nullable=True),
        sa.Column('promotion_end_date', sa.DateTime(), nullable=True),

        # Contract terms
        sa.Column('minimum_contract_months', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('early_termination_fee', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.00'),

        # Technical specifications
        sa.Column('contention_ratio', sa.String(length=20), nullable=True),
        sa.Column('ipv4_included', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('ipv6_included', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('static_ip_included', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('static_ip_count', sa.Integer(), nullable=False, server_default='0'),

        # Additional services
        sa.Column('router_included', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('installation_included', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('technical_support_level', sa.String(length=50), nullable=True),

        # Metadata
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('features', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('restrictions', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),

        # Validation tracking
        sa.Column('last_validated_at', sa.DateTime(), nullable=True),
        sa.Column('validation_status', sa.String(length=20), nullable=True),
        sa.Column('validation_errors', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),

        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan_code', name='uq_plan_code'),
        sa.CheckConstraint('download_speed > 0', name='check_download_speed_positive'),
        sa.CheckConstraint('upload_speed > 0', name='check_upload_speed_positive'),
        sa.CheckConstraint('monthly_price >= 0', name='check_monthly_price_non_negative'),
        sa.CheckConstraint('qos_priority >= 0 AND qos_priority <= 100', name='check_qos_priority_range'),
    )

    # Create indexes for internet_service_plans
    op.create_index('idx_plan_tenant_status', 'internet_service_plans', ['tenant_id', 'status'])
    op.create_index('idx_plan_type_status', 'internet_service_plans', ['plan_type', 'status'])
    op.create_index('idx_plan_code', 'internet_service_plans', ['plan_code'])

    # Create plan_subscriptions table
    op.create_table(
        'plan_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),

        # References
        sa.Column('plan_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subscription_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Subscription details
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),

        # Custom overrides
        sa.Column('custom_download_speed', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('custom_upload_speed', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('custom_data_cap', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('custom_monthly_price', sa.Numeric(precision=10, scale=2), nullable=True),

        # Usage tracking
        sa.Column('current_period_usage_gb', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.Column('last_usage_reset', sa.DateTime(), nullable=True),

        # Status
        sa.Column('is_suspended', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('suspension_reason', sa.String(length=255), nullable=True),

        sa.PrimaryKeyConstraint('id'),
    )

    # Create indexes for plan_subscriptions
    op.create_index('idx_subscription_customer_active', 'plan_subscriptions', ['customer_id', 'is_active'])
    op.create_index('idx_subscription_plan_active', 'plan_subscriptions', ['plan_id', 'is_active'])
    op.create_index('idx_subscription_plan_id', 'plan_subscriptions', ['plan_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_subscription_plan_id', table_name='plan_subscriptions')
    op.drop_index('idx_subscription_plan_active', table_name='plan_subscriptions')
    op.drop_index('idx_subscription_customer_active', table_name='plan_subscriptions')
    op.drop_index('idx_plan_code', table_name='internet_service_plans')
    op.drop_index('idx_plan_type_status', table_name='internet_service_plans')
    op.drop_index('idx_plan_tenant_status', table_name='internet_service_plans')

    # Drop tables
    op.drop_table('plan_subscriptions')
    op.drop_table('internet_service_plans')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS planstatus')
    op.execute('DROP TYPE IF EXISTS throttlepolicy')
    op.execute('DROP TYPE IF EXISTS billingcycle')
    op.execute('DROP TYPE IF EXISTS plantype')
    op.execute('DROP TYPE IF EXISTS dataunit')
    op.execute('DROP TYPE IF EXISTS speedunit')
