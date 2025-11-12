"""create project template tables

Revision ID: 2025_11_08_1905
Revises: 2025_11_08_1800
Create Date: 2025-11-08 19:05:00

Creates tables for project template builder:
- project_templates: Reusable project templates
- task_templates: Tasks within project templates
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2025_11_08_1905'
down_revision = '2025_11_08_1800'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create project_templates table
    op.create_table(
        'project_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('template_code', sa.String(50), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('version', sa.Integer, nullable=False, server_default='1'),

        # Template settings
        sa.Column('project_type', sa.String(50), nullable=False),
        sa.Column('estimated_duration_hours', sa.Float, nullable=True),
        sa.Column('default_priority', sa.String(20), server_default='normal'),

        # Auto-assignment settings
        sa.Column('required_team_type', sa.String(50), nullable=True),
        sa.Column('required_team_skills', postgresql.JSONB, nullable=True),

        # Template activation
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('is_default', sa.Boolean, nullable=False, server_default='false'),

        # Name/description patterns
        sa.Column('project_name_pattern', sa.String(500), nullable=True),
        sa.Column('project_description_pattern', sa.Text, nullable=True),

        # Mapping to order types
        sa.Column('applies_to_order_types', postgresql.ARRAY(sa.String(50)), nullable=True),
        sa.Column('applies_to_service_types', postgresql.ARRAY(sa.String(50)), nullable=True),

        # Metadata
        sa.Column('tags', postgresql.ARRAY(sa.String(50)), nullable=True),
        sa.Column('custom_fields', postgresql.JSONB, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),

        # Audit fields
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),

        # Constraints
        sa.UniqueConstraint('tenant_id', 'template_code', 'version', name='uq_template_tenant_code_version'),
        comment='Project templates for auto-generating projects from orders',
    )

    # Create indexes
    op.create_index('ix_project_templates_tenant_active', 'project_templates', ['tenant_id', 'is_active'])
    op.create_index('ix_project_templates_project_type', 'project_templates', ['project_type'])

    # Create task_templates table
    op.create_table(
        'task_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('template_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),

        # Task definition
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('task_type', sa.String(50), nullable=False),

        # Sequencing and dependencies
        sa.Column('sequence_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('depends_on_sequence_orders', postgresql.ARRAY(sa.Integer), nullable=True),

        # Task settings
        sa.Column('priority', sa.String(20), server_default='normal'),
        sa.Column('estimated_duration_minutes', sa.Integer, nullable=True),
        sa.Column('sla_target_minutes', sa.Integer, nullable=True),

        # Requirements
        sa.Column('required_skills', postgresql.JSONB, nullable=True),
        sa.Column('required_equipment', postgresql.ARRAY(sa.String(100)), nullable=True),
        sa.Column('required_certifications', postgresql.ARRAY(sa.String(100)), nullable=True),
        sa.Column('requires_customer_presence', sa.Boolean, server_default='false'),

        # Auto-assignment
        sa.Column('auto_assign_to_role', sa.String(50), nullable=True),
        sa.Column('auto_assign_to_skill', sa.String(100), nullable=True),

        # Metadata
        sa.Column('tags', postgresql.ARRAY(sa.String(50)), nullable=True),
        sa.Column('custom_fields', postgresql.JSONB, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),

        # Audit fields
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),

        # Foreign keys
        sa.ForeignKeyConstraint(['template_id'], ['project_templates.id'], ondelete='CASCADE', name='fk_task_template_project'),

        # Constraints
        sa.UniqueConstraint('template_id', 'sequence_order', name='uq_task_template_sequence'),
        comment='Task templates within project templates',
    )

    # Create indexes
    op.create_index('ix_task_templates_template_sequence', 'task_templates', ['template_id', 'sequence_order'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('task_templates')
    op.drop_table('project_templates')
