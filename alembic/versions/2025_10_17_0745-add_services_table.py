"""Add services table for billing service lifecycle tracking

Revision ID: c4d8e9f0a1b2
Revises: b9981f13539b
Create Date: 2025-10-17 07:45:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c4d8e9f0a1b2'
down_revision: str | None = 'b9981f13539b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create services table
    op.create_table(
        'services',
        sa.Column('service_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('tenant_id', sa.String(length=255), nullable=False),
        sa.Column('customer_id', sa.String(length=255), nullable=False),
        sa.Column('subscriber_id', sa.String(length=255), nullable=True),
        sa.Column('subscription_id', sa.String(length=255), nullable=True),
        sa.Column('plan_id', sa.String(length=255), nullable=True),

        # Service details
        sa.Column('service_type', sa.String(length=50), nullable=False),
        sa.Column('service_name', sa.String(length=255), nullable=False),
        sa.Column('service_description', sa.Text(), nullable=True),

        # Status
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),

        # Lifecycle timestamps
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('suspended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('terminated_at', sa.DateTime(timezone=True), nullable=True),

        # Suspension details
        sa.Column('suspension_reason', sa.Text(), nullable=True),
        sa.Column('suspend_until', sa.DateTime(timezone=True), nullable=True),

        # Termination details
        sa.Column('termination_reason', sa.Text(), nullable=True),

        # Service configuration
        sa.Column('bandwidth_mbps', sa.Integer(), nullable=True),
        sa.Column('service_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),

        # Pricing
        sa.Column('monthly_price', sa.Integer(), nullable=True),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='USD'),

        # Notes
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),

        # Audit columns
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_by', sa.String(length=255), nullable=True),
        sa.Column('updated_by', sa.String(length=255), nullable=True),

        # Soft delete
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),

        sa.PrimaryKeyConstraint('service_id'),
    )

    # Create indexes
    op.create_index('idx_service_tenant_customer', 'services', ['tenant_id', 'customer_id'])
    op.create_index('idx_service_tenant_subscriber', 'services', ['tenant_id', 'subscriber_id'])
    op.create_index('idx_service_tenant_status', 'services', ['tenant_id', 'status'])
    op.create_index('idx_service_tenant_type', 'services', ['tenant_id', 'service_type'])
    op.create_index('idx_service_customer', 'services', ['customer_id'])
    op.create_index('idx_service_subscriber', 'services', ['subscriber_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_service_subscriber', table_name='services')
    op.drop_index('idx_service_customer', table_name='services')
    op.drop_index('idx_service_tenant_type', table_name='services')
    op.drop_index('idx_service_tenant_status', table_name='services')
    op.drop_index('idx_service_tenant_subscriber', table_name='services')
    op.drop_index('idx_service_tenant_customer', table_name='services')

    # Drop table
    op.drop_table('services')
