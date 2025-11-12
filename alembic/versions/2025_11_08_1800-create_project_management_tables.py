"""create project management tables

Revision ID: 2025_11_08_1800
Revises: 2025_11_08_1700
Create Date: 2025-11-08 18:00:00

Creates tables for project management:
- projects: Multi-step projects for field service
- tasks: Individual tasks within projects
- teams: Logical teams of technicians
- technician_team_memberships: Many-to-many tech-team relationships
- project_teams: Project-team assignments
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

TEAM_TABLE = "field_service_teams"

# revision identifiers, used by Alembic.
revision = '2025_11_08_1800'
down_revision = '2025_11_08_1700'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Detect database dialect
    bind = op.get_bind()
    dialect = bind.dialect.name
    is_postgresql = dialect == "postgresql"

    # Drop tables if they exist (for idempotency in case of partial migration runs)
    if is_postgresql:
        op.execute("DROP TABLE IF EXISTS project_teams CASCADE")
        op.execute("DROP TABLE IF EXISTS technician_team_memberships CASCADE")
        op.execute("DROP TABLE IF EXISTS tasks CASCADE")
        op.execute("DROP TABLE IF EXISTS projects CASCADE")
        op.execute(f"DROP TABLE IF EXISTS {TEAM_TABLE} CASCADE")

    # Create enums only if they don't exist (PostgreSQL only)
    if is_postgresql:
        op.execute("""
            DO $$ BEGIN
                CREATE TYPE project_type AS ENUM ('installation', 'maintenance', 'upgrade', 'repair', 'site_survey', 'emergency', 'custom');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

        op.execute("""
            DO $$ BEGIN
                CREATE TYPE project_status AS ENUM ('planned', 'scheduled', 'in_progress', 'on_hold', 'blocked', 'completed', 'cancelled', 'failed');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

        op.execute("""
            DO $$ BEGIN
                CREATE TYPE task_type AS ENUM ('site_survey', 'planning', 'fiber_routing', 'trenching', 'conduit_installation', 'cable_pulling', 'splicing', 'termination', 'ont_installation', 'cpe_installation', 'testing', 'documentation', 'customer_training', 'closeout', 'inspection', 'troubleshooting', 'custom');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

        op.execute("""
            DO $$ BEGIN
                CREATE TYPE task_status AS ENUM ('pending', 'ready', 'assigned', 'in_progress', 'blocked', 'paused', 'completed', 'failed', 'cancelled', 'skipped');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

        op.execute("""
            DO $$ BEGIN
                CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'critical', 'emergency');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

        op.execute("""
            DO $$ BEGIN
                CREATE TYPE team_type AS ENUM ('installation', 'maintenance', 'emergency', 'field_service', 'specialized', 'general');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

        op.execute("""
            DO $$ BEGIN
                CREATE TYPE team_role AS ENUM ('member', 'lead', 'supervisor', 'coordinator');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

    # Define enum types for use in columns (create_type=False prevents auto-creation)
    if is_postgresql:
        project_type = postgresql.ENUM(
            'installation', 'maintenance', 'upgrade', 'repair',
            'site_survey', 'emergency', 'custom',
            name='project_type',
            create_type=False
        )

        project_status = postgresql.ENUM(
            'planned', 'scheduled', 'in_progress', 'on_hold', 'blocked',
            'completed', 'cancelled', 'failed',
            name='project_status',
            create_type=False
        )

        task_type = postgresql.ENUM(
            'site_survey', 'planning', 'fiber_routing', 'trenching',
            'conduit_installation', 'cable_pulling', 'splicing', 'termination',
            'ont_installation', 'cpe_installation', 'testing', 'documentation',
            'customer_training', 'closeout', 'inspection', 'troubleshooting', 'custom',
            name='task_type',
            create_type=False
        )

        task_status = postgresql.ENUM(
            'pending', 'ready', 'assigned', 'in_progress', 'blocked',
            'paused', 'completed', 'failed', 'cancelled', 'skipped',
            name='task_status',
            create_type=False
        )

        task_priority = postgresql.ENUM(
            'low', 'normal', 'high', 'critical', 'emergency',
            name='task_priority',
            create_type=False
        )

        team_type = postgresql.ENUM(
            'installation', 'maintenance', 'emergency', 'field_service',
            'specialized', 'general',
            name='team_type',
            create_type=False
        )

        team_role = postgresql.ENUM(
            'member', 'lead', 'supervisor', 'coordinator',
            name='team_role',
            create_type=False
        )
    else:
        # For SQLite and other databases, use String
        project_type = sa.String(50)
        project_status = sa.String(50)
        task_type = sa.String(50)
        task_status = sa.String(50)
        task_priority = sa.String(50)
        team_type = sa.String(50)
        team_role = sa.String(50)

    # Create teams table
    op.create_table(
        TEAM_TABLE,
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('team_code', sa.String(50), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('team_type', team_type, nullable=False, index=True),
        sa.Column('is_active', sa.Boolean, default=True),

        # Capacity and coverage
        sa.Column('max_concurrent_projects', sa.Integer, nullable=True),
        sa.Column('max_concurrent_tasks', sa.Integer, nullable=True),
        sa.Column('service_areas', postgresql.ARRAY(sa.String(100)) if is_postgresql else sa.JSON, nullable=True),
        sa.Column('coverage_radius_km', sa.Float, nullable=True),

        # Location
        sa.Column('home_base_lat', sa.Float, nullable=True),
        sa.Column('home_base_lng', sa.Float, nullable=True),
        sa.Column('home_base_address', sa.String(500), nullable=True),

        # Schedule
        sa.Column('working_hours_start', sa.String(10), nullable=True),
        sa.Column('working_hours_end', sa.String(10), nullable=True),
        sa.Column('working_days', postgresql.ARRAY(sa.Integer) if is_postgresql else sa.JSON, nullable=True),
        sa.Column('timezone', sa.String(50), default='UTC'),

        # Skills and capabilities
        sa.Column('team_skills', postgresql.JSONB, nullable=True),
        sa.Column('team_equipment', postgresql.JSONB, nullable=True),
        sa.Column('specializations', postgresql.ARRAY(sa.String(100)) if is_postgresql else sa.JSON, nullable=True),

        # Leadership
        sa.Column('lead_technician_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('supervisor_user_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Performance metrics
        sa.Column('projects_completed', sa.Integer, default=0),
        sa.Column('tasks_completed', sa.Integer, default=0),
        sa.Column('average_rating', sa.Float, nullable=True),
        sa.Column('completion_rate', sa.Float, nullable=True),
        sa.Column('average_response_time_minutes', sa.Integer, nullable=True),

        # Metadata
        sa.Column('tags', postgresql.ARRAY(sa.String(50)) if is_postgresql else sa.JSON, nullable=True),
        sa.Column('custom_fields', postgresql.JSONB, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),

        # Audit
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),

        # Constraints
        sa.UniqueConstraint('tenant_id', 'team_code', name='uq_team_tenant_code'),
        sa.ForeignKeyConstraint(['lead_technician_id'], ['technicians.id'], name='fk_team_lead_tech', ondelete='SET NULL'),
    )

    # Create indexes for teams
    op.create_index('ix_field_service_teams_tenant_active', TEAM_TABLE, ['tenant_id', 'is_active'])
    op.create_index('ix_field_service_teams_tenant_type', TEAM_TABLE, ['tenant_id', 'team_type'])
    op.create_index('ix_field_service_teams_location', TEAM_TABLE, ['home_base_lat', 'home_base_lng'])

    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('project_number', sa.String(50), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('project_type', project_type, nullable=False, index=True),
        sa.Column('status', project_status, nullable=False, default='planned', index=True),
        sa.Column('priority', task_priority, nullable=False, default='normal'),

        # Linked entities
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column('order_id', sa.String(255), nullable=True, index=True),
        sa.Column('subscriber_id', sa.String(255), nullable=True, index=True),
        sa.Column('quote_id', postgresql.UUID(as_uuid=True), nullable=True, index=True),

        # Location
        sa.Column('location_lat', sa.Float, nullable=True),
        sa.Column('location_lng', sa.Float, nullable=True),
        sa.Column('service_address', sa.String(500), nullable=True),
        sa.Column('service_coordinates', postgresql.JSONB, nullable=True),

        # Timeline
        sa.Column('scheduled_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('scheduled_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('estimated_duration_hours', sa.Float, nullable=True),

        # SLA
        sa.Column('sla_definition_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sla_breached', sa.Boolean, default=False),

        # Progress
        sa.Column('completion_percent', sa.Integer, default=0),
        sa.Column('tasks_total', sa.Integer, default=0),
        sa.Column('tasks_completed', sa.Integer, default=0),

        # Assignment
        sa.Column('assigned_team_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('project_manager_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Cost tracking
        sa.Column('estimated_cost', sa.Float, nullable=True),
        sa.Column('actual_cost', sa.Float, nullable=True),
        sa.Column('budget', sa.Float, nullable=True),

        # Metadata
        sa.Column('tags', postgresql.ARRAY(sa.String(50)) if is_postgresql else sa.JSON, nullable=True),
        sa.Column('custom_fields', postgresql.JSONB, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),

        # Audit
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),

        # Constraints
        sa.UniqueConstraint('tenant_id', 'project_number', name='uq_project_tenant_number'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], name='fk_project_customer', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_team_id'], [f'{TEAM_TABLE}.id'], name='fk_project_team', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sla_definition_id'], ['sla_definitions.id'], name='fk_project_sla', ondelete='SET NULL'),
    )

    # Create indexes for projects
    op.create_index('ix_projects_tenant_status', 'projects', ['tenant_id', 'status'])
    op.create_index('ix_projects_tenant_type', 'projects', ['tenant_id', 'project_type'])
    op.create_index('ix_projects_customer', 'projects', ['customer_id'])
    op.create_index('ix_projects_due_date', 'projects', ['due_date'])
    op.create_index('ix_projects_location', 'projects', ['location_lat', 'location_lng'])

    # Create tasks table
    op.create_table(
        'tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('task_number', sa.String(50), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('task_type', task_type, nullable=False, index=True),
        sa.Column('status', task_status, nullable=False, default='pending', index=True),
        sa.Column('priority', task_priority, nullable=False, default='normal'),

        # Hierarchy and dependencies
        sa.Column('parent_task_id', postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column('sequence_order', sa.Integer, default=0),
        sa.Column('depends_on_tasks', postgresql.ARRAY(postgresql.UUID(as_uuid=False)) if is_postgresql else sa.JSON, nullable=True),

        # Assignment
        sa.Column('assigned_technician_id', postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column('assigned_team_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Location
        sa.Column('location_lat', sa.Float, nullable=True),
        sa.Column('location_lng', sa.Float, nullable=True),
        sa.Column('service_address', sa.String(500), nullable=True),

        # Timeline
        sa.Column('scheduled_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('scheduled_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('estimated_duration_minutes', sa.Integer, nullable=True),
        sa.Column('actual_duration_minutes', sa.Integer, nullable=True),

        # SLA
        sa.Column('sla_target_minutes', sa.Integer, nullable=True),
        sa.Column('sla_breached', sa.Boolean, default=False),
        sa.Column('sla_breach_time', sa.DateTime(timezone=True), nullable=True),

        # Skills and requirements
        sa.Column('required_skills', postgresql.JSONB, nullable=True),
        sa.Column('required_equipment', postgresql.ARRAY(sa.String(100)) if is_postgresql else sa.JSON, nullable=True),
        sa.Column('required_certifications', postgresql.ARRAY(sa.String(100)) if is_postgresql else sa.JSON, nullable=True),

        # Progress
        sa.Column('completion_percent', sa.Integer, default=0),
        sa.Column('blockers', postgresql.JSONB, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),

        # Documentation
        sa.Column('photos', postgresql.JSONB, nullable=True),
        sa.Column('documents', postgresql.JSONB, nullable=True),
        sa.Column('checklist', postgresql.JSONB, nullable=True),

        # Customer interaction
        sa.Column('requires_customer_presence', sa.Boolean, default=False),
        sa.Column('customer_signature', sa.Text, nullable=True),
        sa.Column('customer_feedback', sa.Text, nullable=True),
        sa.Column('customer_rating', sa.Integer, nullable=True),

        # Metadata
        sa.Column('tags', postgresql.ARRAY(sa.String(50)) if is_postgresql else sa.JSON, nullable=True),
        sa.Column('custom_fields', postgresql.JSONB, nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),

        # Audit
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),

        # Constraints
        sa.UniqueConstraint('project_id', 'task_number', name='uq_task_project_number'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='fk_task_project', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_task_id'], ['tasks.id'], name='fk_task_parent', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_technician_id'], ['technicians.id'], name='fk_task_technician', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_team_id'], [f'{TEAM_TABLE}.id'], name='fk_task_team', ondelete='SET NULL'),
    )

    # Create indexes for tasks
    op.create_index('ix_tasks_tenant_status', 'tasks', ['tenant_id', 'status'])
    op.create_index('ix_tasks_tenant_type', 'tasks', ['tenant_id', 'task_type'])
    op.create_index('ix_tasks_assigned_tech', 'tasks', ['assigned_technician_id'])
    op.create_index('ix_tasks_scheduled', 'tasks', ['scheduled_start', 'scheduled_end'])
    op.create_index('ix_tasks_location', 'tasks', ['location_lat', 'location_lng'])

    # Create technician_team_memberships table
    op.create_table(
        'technician_team_memberships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('technician_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('role', team_role, nullable=False, default='member'),
        sa.Column('is_primary_team', sa.Boolean, default=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False, default=sa.text('now()')),
        sa.Column('left_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),

        # Audit
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()')),

        # Constraints
        sa.UniqueConstraint('technician_id', 'team_id', name='uq_tech_team_membership'),
        sa.ForeignKeyConstraint(['technician_id'], ['technicians.id'], name='fk_membership_tech', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_id'], [f'{TEAM_TABLE}.id'], name='fk_membership_team', ondelete='CASCADE'),
    )

    # Create indexes for memberships
    op.create_index('ix_membership_tenant_tech', 'technician_team_memberships', ['tenant_id', 'technician_id'])
    op.create_index('ix_membership_tenant_team', 'technician_team_memberships', ['tenant_id', 'team_id'])
    op.create_index('ix_membership_active', 'technician_team_memberships', ['is_active'])

    # Create project_teams table
    op.create_table(
        'project_teams',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False, default=sa.text('now()')),
        sa.Column('is_primary_team', sa.Boolean, default=True),
        sa.Column('role_description', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),

        # Audit
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),

        # Constraints
        sa.UniqueConstraint('project_id', 'team_id', name='uq_project_team'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='fk_project_team_project', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_id'], [f'{TEAM_TABLE}.id'], name='fk_project_team_team', ondelete='CASCADE'),
    )

    # Create index for project_teams
    op.create_index('ix_project_teams_tenant', 'project_teams', ['tenant_id'])


def downgrade() -> None:
    # Detect database dialect
    bind = op.get_bind()
    dialect = bind.dialect.name
    is_postgresql = dialect == "postgresql"

    # Drop tables
    op.drop_table('project_teams')
    op.drop_table('technician_team_memberships')
    op.drop_table('tasks')
    op.drop_table('projects')
    op.drop_table(TEAM_TABLE)

    # Drop enums (PostgreSQL only)
    if is_postgresql:
        op.execute('DROP TYPE IF EXISTS team_role')
        op.execute('DROP TYPE IF EXISTS team_type')
        op.execute('DROP TYPE IF EXISTS task_priority')
        op.execute('DROP TYPE IF EXISTS task_status')
        op.execute('DROP TYPE IF EXISTS task_type')
        op.execute('DROP TYPE IF EXISTS project_status')
        op.execute('DROP TYPE IF EXISTS project_type')
