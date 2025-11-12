"""create data transfer jobs table

Revision ID: 2025_11_08_1900
Revises: 2025_11_08_1800
Create Date: 2025-11-08 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


# revision identifiers, used by Alembic.
revision: str = '2025_11_08_1900'
down_revision: Union[str, None] = '2025_11_08_1800'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create data_transfer_jobs table for persistent job tracking."""
    op.create_table(
        'data_transfer_jobs',

        # Primary key
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),

        # Job identification
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('job_type', sa.String(50), nullable=False),

        # Job status
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),

        # Progress tracking
        sa.Column('total_records', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('processed_records', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed_records', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('progress_percentage', sa.Float(), nullable=False, server_default='0'),

        # Timing
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),

        # Celery integration
        sa.Column('celery_task_id', sa.String(255), nullable=True),

        # Import-specific fields
        sa.Column('import_source', sa.String(50), nullable=True),
        sa.Column('source_path', sa.String(1024), nullable=True),

        # Export-specific fields
        sa.Column('export_target', sa.String(50), nullable=True),
        sa.Column('target_path', sa.String(1024), nullable=True),

        # Configuration and results
        sa.Column('config', JSON, nullable=False, server_default='{}'),
        sa.Column('summary', JSON, nullable=False, server_default='{}'),

        # Error tracking
        sa.Column('error_message', sa.Text(), nullable=True),

        # Metadata
        sa.Column('metadata', JSON, nullable=False, server_default='{}'),

        # Tenant mixin fields
        sa.Column('tenant_id', sa.String(255), nullable=False),

        # Timestamp mixin fields
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create indexes for common queries
    op.create_index(
        'ix_data_transfer_jobs_id',
        'data_transfer_jobs',
        ['id'],
        unique=False,
    )
    op.create_index(
        'ix_data_transfer_jobs_job_type',
        'data_transfer_jobs',
        ['job_type'],
        unique=False,
    )
    op.create_index(
        'ix_data_transfer_jobs_status',
        'data_transfer_jobs',
        ['status'],
        unique=False,
    )
    op.create_index(
        'ix_data_transfer_jobs_celery_task_id',
        'data_transfer_jobs',
        ['celery_task_id'],
        unique=False,
    )

    # Composite index for tenant + status queries (most common)
    op.create_index(
        'ix_data_transfer_jobs_tenant_status',
        'data_transfer_jobs',
        ['tenant_id', 'status'],
        unique=False,
    )

    # Composite index for tenant + job type queries
    op.create_index(
        'ix_data_transfer_jobs_tenant_job_type',
        'data_transfer_jobs',
        ['tenant_id', 'job_type'],
        unique=False,
    )

    # Index on created_at for sorting recent jobs
    op.create_index(
        'ix_data_transfer_jobs_created_at',
        'data_transfer_jobs',
        ['created_at'],
        unique=False,
    )


def downgrade() -> None:
    """Drop data_transfer_jobs table and all indexes."""
    op.drop_index('ix_data_transfer_jobs_created_at', table_name='data_transfer_jobs')
    op.drop_index('ix_data_transfer_jobs_tenant_job_type', table_name='data_transfer_jobs')
    op.drop_index('ix_data_transfer_jobs_tenant_status', table_name='data_transfer_jobs')
    op.drop_index('ix_data_transfer_jobs_celery_task_id', table_name='data_transfer_jobs')
    op.drop_index('ix_data_transfer_jobs_status', table_name='data_transfer_jobs')
    op.drop_index('ix_data_transfer_jobs_job_type', table_name='data_transfer_jobs')
    op.drop_index('ix_data_transfer_jobs_id', table_name='data_transfer_jobs')
    op.drop_table('data_transfer_jobs')
