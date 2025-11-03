"""Add orchestration workflow tables

Revision ID: 65962d3cc9b6
Revises: 698b94587f46
Create Date: 2025-10-15 22:22:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '65962d3cc9b6'
down_revision: str | None = '698b94587f46'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create orchestration_workflows table
    op.create_table(
        'orchestration_workflows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workflow_id', sa.String(length=64), nullable=False),
        sa.Column('workflow_type', sa.Enum(
            'PROVISION_SUBSCRIBER',
            'DEPROVISION_SUBSCRIBER',
            'ACTIVATE_SERVICE',
            'SUSPEND_SERVICE',
            'TERMINATE_SERVICE',
            'CHANGE_SERVICE_PLAN',
            'UPDATE_NETWORK_CONFIG',
            'MIGRATE_SUBSCRIBER',
            name='workflowtype'
        ), nullable=False),
        sa.Column('status', sa.Enum(
            'PENDING',
            'RUNNING',
            'COMPLETED',
            'FAILED',
            'ROLLING_BACK',
            'ROLLED_BACK',
            'COMPENSATED',
            name='workflowstatus'
        ), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('initiator_id', sa.String(length=64), nullable=True),
        sa.Column('initiator_type', sa.String(length=32), nullable=True),
        sa.Column('input_data', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('output_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('failed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_details', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_retries', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('compensation_started_at', sa.DateTime(), nullable=True),
        sa.Column('compensation_completed_at', sa.DateTime(), nullable=True),
        sa.Column('compensation_error', sa.Text(), nullable=True),
        sa.Column('context', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()'), onupdate=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('workflow_id')
    )

    # Create indexes for workflows
    op.create_index('idx_workflow_tenant_status', 'orchestration_workflows', ['tenant_id', 'status'])
    op.create_index('idx_workflow_type_status', 'orchestration_workflows', ['workflow_type', 'status'])
    op.create_index('ix_orchestration_workflows_workflow_id', 'orchestration_workflows', ['workflow_id'])
    op.create_index('ix_orchestration_workflows_tenant_id', 'orchestration_workflows', ['tenant_id'])
    op.create_index('ix_orchestration_workflows_workflow_type', 'orchestration_workflows', ['workflow_type'])
    op.create_index('ix_orchestration_workflows_status', 'orchestration_workflows', ['status'])

    # Create orchestration_workflow_steps table
    op.create_table(
        'orchestration_workflow_steps',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workflow_id', sa.Integer(), nullable=False),
        sa.Column('step_id', sa.String(length=64), nullable=False),
        sa.Column('step_order', sa.Integer(), nullable=False),
        sa.Column('step_name', sa.String(length=128), nullable=False),
        sa.Column('step_type', sa.String(length=64), nullable=False),
        sa.Column('target_system', sa.String(length=64), nullable=False),
        sa.Column('status', sa.Enum(
            'PENDING',
            'RUNNING',
            'COMPLETED',
            'FAILED',
            'SKIPPED',
            'COMPENSATING',
            'COMPENSATED',
            'COMPENSATION_FAILED',
            name='workflowstepstatus'
        ), nullable=False),
        sa.Column('input_data', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('output_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('compensation_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('compensation_handler', sa.String(length=128), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('failed_at', sa.DateTime(), nullable=True),
        sa.Column('compensation_started_at', sa.DateTime(), nullable=True),
        sa.Column('compensation_completed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_details', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_retries', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('idempotency_key', sa.String(length=128), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()'), onupdate=sa.text('now()')),
        sa.ForeignKeyConstraint(['workflow_id'], ['orchestration_workflows.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('idempotency_key')
    )

    # Create indexes for workflow steps
    op.create_index('idx_workflow_step_workflow_order', 'orchestration_workflow_steps', ['workflow_id', 'step_order'])
    op.create_index('ix_orchestration_workflow_steps_workflow_id', 'orchestration_workflow_steps', ['workflow_id'])
    op.create_index('ix_orchestration_workflow_steps_step_id', 'orchestration_workflow_steps', ['step_id'])
    op.create_index('ix_orchestration_workflow_steps_status', 'orchestration_workflow_steps', ['status'])


def downgrade() -> None:
    # Drop indexes for workflow steps
    op.drop_index('ix_orchestration_workflow_steps_status', table_name='orchestration_workflow_steps')
    op.drop_index('ix_orchestration_workflow_steps_step_id', table_name='orchestration_workflow_steps')
    op.drop_index('ix_orchestration_workflow_steps_workflow_id', table_name='orchestration_workflow_steps')
    op.drop_index('idx_workflow_step_workflow_order', table_name='orchestration_workflow_steps')

    # Drop workflow steps table
    op.drop_table('orchestration_workflow_steps')

    # Drop indexes for workflows
    op.drop_index('ix_orchestration_workflows_status', table_name='orchestration_workflows')
    op.drop_index('ix_orchestration_workflows_workflow_type', table_name='orchestration_workflows')
    op.drop_index('ix_orchestration_workflows_tenant_id', table_name='orchestration_workflows')
    op.drop_index('ix_orchestration_workflows_workflow_id', table_name='orchestration_workflows')
    op.drop_index('idx_workflow_type_status', table_name='orchestration_workflows')
    op.drop_index('idx_workflow_tenant_status', table_name='orchestration_workflows')

    # Drop workflows table
    op.drop_table('orchestration_workflows')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS workflowstepstatus')
    op.execute('DROP TYPE IF EXISTS workflowstatus')
    op.execute('DROP TYPE IF EXISTS workflowtype')
