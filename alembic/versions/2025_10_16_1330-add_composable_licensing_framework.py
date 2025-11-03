"""add composable licensing framework

Revision ID: 9c3d4e5f6a7b
Revises: 8a9b0c1d2e3f
Create Date: 2025-10-16 13:30:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9c3d4e5f6a7b'
down_revision: str | None = '8a9b0c1d2e3f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create enums
    module_category_enum = postgresql.ENUM(
        'NETWORK', 'OSS_INTEGRATION', 'BILLING', 'ANALYTICS', 'AUTOMATION',
        'COMMUNICATIONS', 'SECURITY', 'REPORTING', 'API_MANAGEMENT', 'OTHER',
        name='modulecategory',
        create_type=False
    )
    module_category_enum.create(op.get_bind(), checkfirst=True)

    pricing_model_enum = postgresql.ENUM(
        'FLAT_FEE', 'PER_UNIT', 'TIERED', 'USAGE_BASED', 'CUSTOM',
        name='pricingmodel',
        create_type=False
    )
    pricing_model_enum.create(op.get_bind(), checkfirst=True)

    subscription_status_enum = postgresql.ENUM(
        'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'SUSPENDED',
        name='subscriptionstatus',
        create_type=False
    )
    subscription_status_enum.create(op.get_bind(), checkfirst=True)

    # BillingCycle enum already exists in the database, just reference it
    billing_cycle_enum = postgresql.ENUM(
        'MONTHLY', 'ANNUAL',
        name='billingcycle',
        create_type=False
    )
    # Don't create - it already exists
    # billing_cycle_enum.create(op.get_bind(), checkfirst=True)

    event_type_enum = postgresql.ENUM(
        'SUBSCRIPTION_CREATED', 'TRIAL_STARTED', 'TRIAL_ENDED', 'TRIAL_CONVERTED',
        'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_UPGRADED', 'SUBSCRIPTION_DOWNGRADED',
        'SUBSCRIPTION_CANCELED', 'SUBSCRIPTION_EXPIRED', 'SUBSCRIPTION_SUSPENDED',
        'SUBSCRIPTION_REACTIVATED', 'ADDON_ADDED', 'ADDON_REMOVED',
        'QUOTA_EXCEEDED', 'QUOTA_WARNING', 'PRICE_CHANGED',
        name='eventtype',
        create_type=False
    )
    event_type_enum.create(op.get_bind(), checkfirst=True)

    # FeatureModule table
    op.create_table(
        'licensing_feature_modules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('module_code', sa.String(length=100), nullable=False),
        sa.Column('module_name', sa.String(length=200), nullable=False),
        sa.Column('category', module_category_enum, nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('dependencies', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('pricing_model', pricing_model_enum, nullable=False),
        sa.Column('base_price', sa.Float(), nullable=False),
        sa.Column('price_per_unit', sa.Numeric(15, 4), nullable=True),
        sa.Column('config_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('default_config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('extra_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('module_code')
    )
    op.create_index('ix_licensing_feature_modules_category', 'licensing_feature_modules', ['category'])
    op.create_index('ix_licensing_feature_modules_is_active', 'licensing_feature_modules', ['is_active'])

    # ModuleCapability table
    op.create_table(
        'licensing_module_capabilities',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('module_id', sa.UUID(), nullable=False),
        sa.Column('capability_code', sa.String(length=100), nullable=False),
        sa.Column('capability_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('api_endpoints', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('ui_routes', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('permissions', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['module_id'], ['licensing_feature_modules.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('module_id', 'capability_code', name='uq_module_capability')
    )
    op.create_index('ix_licensing_module_capabilities_module_id', 'licensing_module_capabilities', ['module_id'])

    # QuotaDefinition table
    op.create_table(
        'licensing_quota_definitions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('quota_code', sa.String(length=100), nullable=False),
        sa.Column('quota_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('unit_name', sa.String(length=50), nullable=False),
        sa.Column('pricing_model', pricing_model_enum, nullable=False),
        sa.Column('overage_rate', sa.Float(), nullable=False),
        sa.Column('is_metered', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reset_period', sa.String(length=20), nullable=True),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('quota_code')
    )
    op.create_index('ix_licensing_quota_definitions_is_metered', 'licensing_quota_definitions', ['is_metered'])

    # ServicePlan table
    op.create_table(
        'licensing_service_plans',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('plan_name', sa.String(length=200), nullable=False),
        sa.Column('plan_code', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_template', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_custom', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('base_price_monthly', sa.Float(), nullable=False),
        sa.Column('annual_discount_percent', sa.Float(), nullable=False, server_default='0'),
        sa.Column('trial_days', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('trial_modules', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('extra_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan_code', 'version', name='uq_plan_code_version')
    )
    op.create_index('ix_licensing_service_plans_is_public', 'licensing_service_plans', ['is_public'])
    op.create_index('ix_licensing_service_plans_is_template', 'licensing_service_plans', ['is_template'])

    # PlanModule table
    op.create_table(
        'licensing_plan_modules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('plan_id', sa.UUID(), nullable=False),
        sa.Column('module_id', sa.UUID(), nullable=False),
        sa.Column('included_by_default', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_optional_addon', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('override_price', sa.Float(), nullable=True),
        sa.Column('trial_only', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('promotional_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['module_id'], ['licensing_feature_modules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['plan_id'], ['licensing_service_plans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan_id', 'module_id', name='uq_plan_module')
    )
    op.create_index('ix_licensing_plan_modules_plan_id', 'licensing_plan_modules', ['plan_id'])

    # PlanQuotaAllocation table
    op.create_table(
        'licensing_plan_quota_allocations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('plan_id', sa.UUID(), nullable=False),
        sa.Column('quota_id', sa.UUID(), nullable=False),
        sa.Column('included_quantity', sa.Integer(), nullable=False),
        sa.Column('soft_limit', sa.Integer(), nullable=True),
        sa.Column('allow_overage', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('overage_rate_override', sa.Float(), nullable=True),
        sa.Column('pricing_tiers', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['plan_id'], ['licensing_service_plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['quota_id'], ['licensing_quota_definitions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan_id', 'quota_id', name='uq_plan_quota')
    )
    op.create_index('ix_licensing_plan_quota_allocations_plan_id', 'licensing_plan_quota_allocations', ['plan_id'])

    # TenantSubscription table
    op.create_table(
        'licensing_tenant_subscriptions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=255), nullable=False),
        sa.Column('plan_id', sa.UUID(), nullable=False),
        sa.Column('status', subscription_status_enum, nullable=False),
        sa.Column('billing_cycle', billing_cycle_enum, nullable=False),
        sa.Column('monthly_price', sa.Float(), nullable=False),
        sa.Column('annual_price', sa.Float(), nullable=True),
        sa.Column('trial_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('trial_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('current_period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('stripe_customer_id', sa.String(length=100), nullable=True),
        sa.Column('stripe_subscription_id', sa.String(length=100), nullable=True),
        sa.Column('custom_config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['plan_id'], ['licensing_service_plans.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_licensing_tenant_subscriptions_tenant_id', 'licensing_tenant_subscriptions', ['tenant_id'])
    op.create_index('ix_licensing_tenant_subscriptions_status', 'licensing_tenant_subscriptions', ['status'])
    op.create_index('ix_licensing_tenant_subscriptions_stripe_customer_id', 'licensing_tenant_subscriptions', ['stripe_customer_id'])

    # SubscriptionModule table
    op.create_table(
        'licensing_subscription_modules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subscription_id', sa.UUID(), nullable=False),
        sa.Column('module_id', sa.UUID(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('addon_price', sa.Float(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('activated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['module_id'], ['licensing_feature_modules.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subscription_id'], ['licensing_tenant_subscriptions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('subscription_id', 'module_id', name='uq_subscription_module')
    )
    op.create_index('ix_licensing_subscription_modules_subscription_id', 'licensing_subscription_modules', ['subscription_id'])
    op.create_index('ix_licensing_subscription_modules_is_enabled', 'licensing_subscription_modules', ['is_enabled'])

    # SubscriptionQuotaUsage table
    op.create_table(
        'licensing_subscription_quota_usage',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subscription_id', sa.UUID(), nullable=False),
        sa.Column('quota_id', sa.UUID(), nullable=False),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('allocated_quantity', sa.Integer(), nullable=False),
        sa.Column('current_usage', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('overage_quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('overage_charges', sa.Float(), nullable=False, server_default='0'),
        sa.Column('last_updated', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['quota_id'], ['licensing_quota_definitions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subscription_id'], ['licensing_tenant_subscriptions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('subscription_id', 'quota_id', 'period_start', name='uq_subscription_quota_period')
    )
    op.create_index('ix_licensing_subscription_quota_usage_subscription_id', 'licensing_subscription_quota_usage', ['subscription_id'])
    op.create_index('ix_licensing_subscription_quota_usage_current_usage', 'licensing_subscription_quota_usage', ['current_usage'])

    # FeatureUsageLog table
    op.create_table(
        'licensing_feature_usage_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subscription_id', sa.UUID(), nullable=False),
        sa.Column('module_id', sa.UUID(), nullable=True),
        sa.Column('feature_name', sa.String(length=200), nullable=False),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('usage_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('logged_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['module_id'], ['licensing_feature_modules.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['subscription_id'], ['licensing_tenant_subscriptions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_licensing_feature_usage_logs_subscription_id', 'licensing_feature_usage_logs', ['subscription_id'])
    op.create_index('ix_licensing_feature_usage_logs_feature_name', 'licensing_feature_usage_logs', ['feature_name'])
    op.create_index('ix_licensing_feature_usage_logs_logged_at', 'licensing_feature_usage_logs', ['logged_at'])

    # SubscriptionEvent table
    op.create_table(
        'licensing_subscription_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subscription_id', sa.UUID(), nullable=False),
        sa.Column('event_type', event_type_enum, nullable=False),
        sa.Column('event_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['subscription_id'], ['licensing_tenant_subscriptions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_licensing_subscription_events_subscription_id', 'licensing_subscription_events', ['subscription_id'])
    op.create_index('ix_licensing_subscription_events_event_type', 'licensing_subscription_events', ['event_type'])
    op.create_index('ix_licensing_subscription_events_created_at', 'licensing_subscription_events', ['created_at'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index('ix_licensing_subscription_events_created_at', table_name='licensing_subscription_events')
    op.drop_index('ix_licensing_subscription_events_event_type', table_name='licensing_subscription_events')
    op.drop_index('ix_licensing_subscription_events_subscription_id', table_name='licensing_subscription_events')
    op.drop_table('licensing_subscription_events')

    op.drop_index('ix_licensing_feature_usage_logs_logged_at', table_name='licensing_feature_usage_logs')
    op.drop_index('ix_licensing_feature_usage_logs_feature_name', table_name='licensing_feature_usage_logs')
    op.drop_index('ix_licensing_feature_usage_logs_subscription_id', table_name='licensing_feature_usage_logs')
    op.drop_table('licensing_feature_usage_logs')

    op.drop_index('ix_licensing_subscription_quota_usage_current_usage', table_name='licensing_subscription_quota_usage')
    op.drop_index('ix_licensing_subscription_quota_usage_subscription_id', table_name='licensing_subscription_quota_usage')
    op.drop_table('licensing_subscription_quota_usage')

    op.drop_index('ix_licensing_subscription_modules_is_enabled', table_name='licensing_subscription_modules')
    op.drop_index('ix_licensing_subscription_modules_subscription_id', table_name='licensing_subscription_modules')
    op.drop_table('licensing_subscription_modules')

    op.drop_index('ix_licensing_tenant_subscriptions_stripe_customer_id', table_name='licensing_tenant_subscriptions')
    op.drop_index('ix_licensing_tenant_subscriptions_status', table_name='licensing_tenant_subscriptions')
    op.drop_index('ix_licensing_tenant_subscriptions_tenant_id', table_name='licensing_tenant_subscriptions')
    op.drop_table('licensing_tenant_subscriptions')

    op.drop_index('ix_licensing_plan_quota_allocations_plan_id', table_name='licensing_plan_quota_allocations')
    op.drop_table('licensing_plan_quota_allocations')

    op.drop_index('ix_licensing_plan_modules_plan_id', table_name='licensing_plan_modules')
    op.drop_table('licensing_plan_modules')

    op.drop_index('ix_licensing_service_plans_is_template', table_name='licensing_service_plans')
    op.drop_index('ix_licensing_service_plans_is_public', table_name='licensing_service_plans')
    op.drop_table('licensing_service_plans')

    op.drop_index('ix_licensing_quota_definitions_is_metered', table_name='licensing_quota_definitions')
    op.drop_table('licensing_quota_definitions')

    op.drop_index('ix_licensing_module_capabilities_module_id', table_name='licensing_module_capabilities')
    op.drop_table('licensing_module_capabilities')

    op.drop_index('ix_licensing_feature_modules_is_active', table_name='licensing_feature_modules')
    op.drop_index('ix_licensing_feature_modules_category', table_name='licensing_feature_modules')
    op.drop_table('licensing_feature_modules')

    # Drop enums (except billingcycle which is shared with other tables)
    eventtype_enum = postgresql.ENUM(name='eventtype')
    eventtype_enum.drop(op.get_bind(), checkfirst=True)

    # Don't drop billingcycle - it's used by other tables
    # billingcycle_enum = postgresql.ENUM(name='billingcycle')
    # billingcycle_enum.drop(op.get_bind(), checkfirst=True)

    subscriptionstatus_enum = postgresql.ENUM(name='subscriptionstatus')
    subscriptionstatus_enum.drop(op.get_bind(), checkfirst=True)

    pricingmodel_enum = postgresql.ENUM(name='pricingmodel')
    pricingmodel_enum.drop(op.get_bind(), checkfirst=True)

    modulecategory_enum = postgresql.ENUM(name='modulecategory')
    modulecategory_enum.drop(op.get_bind(), checkfirst=True)
