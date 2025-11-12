"""add scheduling models

Revision ID: 2025_11_08_1830
Revises: 2025_11_08_1800
Create Date: 2025-11-08 18:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2025_11_08_1830'
down_revision = '2025_11_08_1800'
branch_labels = None
depends_on = None


def upgrade():
    # Create ScheduleStatus enum if not exists
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE schedulestatus AS ENUM ('available', 'on_leave', 'sick', 'busy', 'off_duty');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create AssignmentStatus enum if not exists
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE assignmentstatus AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Define enum types for use in create_table
    schedule_status_enum = postgresql.ENUM(
        'available', 'on_leave', 'sick', 'busy', 'off_duty',
        name='schedulestatus',
        create_type=False
    )
    assignment_status_enum = postgresql.ENUM(
        'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled',
        name='assignmentstatus',
        create_type=False
    )

    # Create technician_schedules table
    op.create_table(
        'technician_schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('technician_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('schedule_date', sa.Date(), nullable=False, index=True),
        sa.Column('shift_start', sa.Time(), nullable=False),
        sa.Column('shift_end', sa.Time(), nullable=False),
        sa.Column('break_start', sa.Time(), nullable=True),
        sa.Column('break_end', sa.Time(), nullable=True),
        sa.Column('status', schedule_status_enum, nullable=False, server_default='available', index=True),
        sa.Column('start_location_lat', sa.Float(), nullable=True),
        sa.Column('start_location_lng', sa.Float(), nullable=True),
        sa.Column('start_location_name', sa.String(255), nullable=True),
        sa.Column('max_tasks', sa.Integer(), nullable=True),
        sa.Column('assigned_tasks_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, onupdate=sa.text('now()')),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(['technician_id'], ['technicians.id'], ondelete='CASCADE'),
    )

    # Create indexes for technician_schedules
    op.create_index('idx_tech_schedule_date', 'technician_schedules', ['technician_id', 'schedule_date'])
    op.create_index('idx_tech_schedule_status', 'technician_schedules', ['tenant_id', 'schedule_date', 'status'])

    # Create task_assignments table
    op.create_table(
        'task_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('technician_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('schedule_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('scheduled_start', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('scheduled_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('actual_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('travel_time_minutes', sa.Integer(), nullable=True),
        sa.Column('travel_distance_km', sa.Float(), nullable=True),
        sa.Column('previous_task_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', assignment_status_enum, nullable=False, server_default='scheduled', index=True),
        sa.Column('customer_confirmation_required', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('customer_confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('assignment_method', sa.String(50), nullable=True),
        sa.Column('assignment_score', sa.Float(), nullable=True),
        sa.Column('task_location_lat', sa.Float(), nullable=True),
        sa.Column('task_location_lng', sa.Float(), nullable=True),
        sa.Column('task_location_address', sa.String(500), nullable=True),
        sa.Column('original_scheduled_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reschedule_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('reschedule_reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, onupdate=sa.text('now()')),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['technician_id'], ['technicians.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['schedule_id'], ['technician_schedules.id'], ondelete='SET NULL'),
    )

    # Create indexes for task_assignments
    op.create_index('idx_assignment_tech_date', 'task_assignments', ['technician_id', 'scheduled_start'])
    op.create_index('idx_assignment_task', 'task_assignments', ['task_id', 'status'])
    op.create_index('idx_assignment_status', 'task_assignments', ['tenant_id', 'status', 'scheduled_start'])

    # Create availability_windows table
    op.create_table(
        'availability_windows',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('technician_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('window_start', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('window_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('max_appointments', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('booked_appointments', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('supported_service_types', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('required_skills', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, onupdate=sa.text('now()')),
        sa.ForeignKeyConstraint(['technician_id'], ['technicians.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
    )

    # Create indexes for availability_windows
    op.create_index('idx_availability_tech_time', 'availability_windows', ['technician_id', 'window_start', 'is_active'])
    op.create_index('idx_availability_team_time', 'availability_windows', ['team_id', 'window_start', 'is_active'])


def downgrade():
    # Drop tables
    op.drop_index('idx_availability_team_time', 'availability_windows')
    op.drop_index('idx_availability_tech_time', 'availability_windows')
    op.drop_table('availability_windows')

    op.drop_index('idx_assignment_status', 'task_assignments')
    op.drop_index('idx_assignment_task', 'task_assignments')
    op.drop_index('idx_assignment_tech_date', 'task_assignments')
    op.drop_table('task_assignments')

    op.drop_index('idx_tech_schedule_status', 'technician_schedules')
    op.drop_index('idx_tech_schedule_date', 'technician_schedules')
    op.drop_table('technician_schedules')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS assignmentstatus')
    op.execute('DROP TYPE IF EXISTS schedulestatus')
