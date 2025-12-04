"""create technician and field service tables

Revision ID: 2025_11_08_1700
Revises:
Create Date: 2025-11-08 17:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2025_11_08_1700'
down_revision = '3b0e56f89d86'  # merge template and data transfer
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Detect database dialect
    bind = op.get_bind()
    dialect = bind.dialect.name
    is_postgresql = dialect == "postgresql"

    # Create enums only for PostgreSQL
    if is_postgresql:
        # Create technician_status enum only if it doesn't exist
        op.execute("""
            DO $$ BEGIN
                CREATE TYPE technician_status AS ENUM ('available', 'on_job', 'off_duty', 'on_break', 'unavailable');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

        # Create technician_skill_level enum only if it doesn't exist
        op.execute("""
            DO $$ BEGIN
                CREATE TYPE technician_skill_level AS ENUM ('trainee', 'junior', 'intermediate', 'senior', 'expert');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

        # Define enum types for use in columns (create_type=False prevents auto-creation)
        technician_status = postgresql.ENUM(
            'available', 'on_job', 'off_duty', 'on_break', 'unavailable',
            name='technician_status',
            create_type=False
        )

        skill_level = postgresql.ENUM(
            'trainee', 'junior', 'intermediate', 'senior', 'expert',
            name='technician_skill_level',
            create_type=False
        )
    else:
        # For SQLite and other databases, use String
        technician_status = sa.String(20)
        skill_level = sa.String(20)

    # Create technicians table
    op.create_table(
        'technicians',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('user_id', sa.Integer, nullable=True),  # Link to users table if exists
        sa.Column('employee_id', sa.String(50), nullable=False),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('mobile', sa.String(20), nullable=True),

        # Employment details
        sa.Column('status', technician_status, nullable=False, server_default='available'),
        sa.Column('skill_level', skill_level, nullable=False, server_default='intermediate'),
        sa.Column('hire_date', sa.Date, nullable=True),
        sa.Column('team_lead_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Location and territory
        sa.Column('home_base_lat', sa.Float, nullable=True),
        sa.Column('home_base_lng', sa.Float, nullable=True),
        sa.Column('home_base_address', sa.String(500), nullable=True),
        sa.Column('current_lat', sa.Float, nullable=True),
        sa.Column('current_lng', sa.Float, nullable=True),
        sa.Column('last_location_update', sa.DateTime(timezone=True), nullable=True),
        sa.Column('service_areas', postgresql.ARRAY(sa.String(100)) if is_postgresql else sa.JSON, nullable=True),

        # Schedule and availability
        sa.Column('working_hours_start', sa.Time, nullable=True),
        sa.Column('working_hours_end', sa.Time, nullable=True),
        sa.Column('working_days', postgresql.ARRAY(sa.Integer) if is_postgresql else sa.JSON, nullable=True),  # 0=Monday, 6=Sunday
        sa.Column('is_on_call', sa.Boolean, default=False),
        sa.Column('available_for_emergency', sa.Boolean, default=True),

        # Skills and certifications
        sa.Column('skills', postgresql.JSONB, nullable=True),  # {"fiber_splicing": true, "ont_config": true}
        sa.Column('certifications', postgresql.JSONB, nullable=True),
        sa.Column('equipment', postgresql.JSONB, nullable=True),  # Tools and van inventory

        # Performance metrics
        sa.Column('jobs_completed', sa.Integer, default=0),
        sa.Column('average_rating', sa.Float, nullable=True),
        sa.Column('completion_rate', sa.Float, nullable=True),

        # Metadata
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()')),

        # Constraints
        sa.UniqueConstraint('tenant_id', 'employee_id', name='uq_technician_tenant_employee'),
        sa.UniqueConstraint('tenant_id', 'email', name='uq_technician_tenant_email'),
        sa.ForeignKeyConstraint(['team_lead_id'], ['technicians.id'], name='fk_technician_team_lead'),
    )

    # Create indexes
    op.create_index('ix_technicians_tenant_status', 'technicians', ['tenant_id', 'status'])
    op.create_index('ix_technicians_tenant_active', 'technicians', ['tenant_id', 'is_active'])
    op.create_index('ix_technicians_location', 'technicians', ['current_lat', 'current_lng'])

    # Create technician_availability table for time-off tracking
    op.create_table(
        'technician_availability',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('technician_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('start_datetime', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_datetime', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_available', sa.Boolean, default=True),  # True=available, False=unavailable
        sa.Column('reason', sa.String(255), nullable=True),  # "vacation", "sick", "training", etc.
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()')),

        sa.ForeignKeyConstraint(['technician_id'], ['technicians.id'], name='fk_availability_technician', ondelete='CASCADE'),
    )

    op.create_index('ix_availability_tenant_tech', 'technician_availability', ['tenant_id', 'technician_id'])
    op.create_index('ix_availability_dates', 'technician_availability', ['start_datetime', 'end_datetime'])

    # Create technician_location_history table for GPS tracking
    op.create_table(
        'technician_location_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('technician_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('latitude', sa.Float, nullable=False),
        sa.Column('longitude', sa.Float, nullable=False),
        sa.Column('accuracy_meters', sa.Float, nullable=True),
        sa.Column('altitude', sa.Float, nullable=True),
        sa.Column('speed_kmh', sa.Float, nullable=True),
        sa.Column('heading', sa.Float, nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('job_id', sa.String(255), nullable=True),  # Associated job if on assignment
        sa.Column('activity', sa.String(50), nullable=True),  # "driving", "on_site", "returning"
        sa.Column('metadata', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),

        sa.ForeignKeyConstraint(['technician_id'], ['technicians.id'], name='fk_location_technician', ondelete='CASCADE'),
    )

    op.create_index('ix_location_tenant_tech', 'technician_location_history', ['tenant_id', 'technician_id'])
    op.create_index('ix_location_recorded', 'technician_location_history', ['recorded_at'])
    op.create_index('ix_location_job', 'technician_location_history', ['job_id'])

    # Update jobs table to add technician assignment
    op.add_column('jobs', sa.Column('assigned_technician_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('jobs', sa.Column('scheduled_start', sa.DateTime(timezone=True), nullable=True))
    op.add_column('jobs', sa.Column('scheduled_end', sa.DateTime(timezone=True), nullable=True))
    op.add_column('jobs', sa.Column('actual_start', sa.DateTime(timezone=True), nullable=True))
    op.add_column('jobs', sa.Column('actual_end', sa.DateTime(timezone=True), nullable=True))
    op.add_column('jobs', sa.Column('location_lat', sa.Float, nullable=True))
    op.add_column('jobs', sa.Column('location_lng', sa.Float, nullable=True))
    op.add_column('jobs', sa.Column('service_address', sa.String(500), nullable=True))
    op.add_column('jobs', sa.Column('customer_signature', sa.Text, nullable=True))  # Base64 encoded
    op.add_column('jobs', sa.Column('completion_notes', sa.Text, nullable=True))
    op.add_column('jobs', sa.Column('photos', postgresql.JSONB, nullable=True))  # Array of photo URLs

    op.create_foreign_key(
        'fk_job_technician',
        'jobs',
        'technicians',
        ['assigned_technician_id'],
        ['id'],
        ondelete='SET NULL'
    )

    op.create_index('ix_jobs_technician', 'jobs', ['assigned_technician_id'])
    op.create_index('ix_jobs_scheduled', 'jobs', ['scheduled_start', 'scheduled_end'])
    op.create_index('ix_jobs_location', 'jobs', ['location_lat', 'location_lng'])


def downgrade() -> None:
    # Detect database dialect
    bind = op.get_bind()
    dialect = bind.dialect.name
    is_postgresql = dialect == "postgresql"

    # Drop job table columns
    op.drop_constraint('fk_job_technician', 'jobs', type_='foreignkey')
    op.drop_index('ix_jobs_technician', 'jobs')
    op.drop_index('ix_jobs_scheduled', 'jobs')
    op.drop_index('ix_jobs_location', 'jobs')

    op.drop_column('jobs', 'assigned_technician_id')
    op.drop_column('jobs', 'scheduled_start')
    op.drop_column('jobs', 'scheduled_end')
    op.drop_column('jobs', 'actual_start')
    op.drop_column('jobs', 'actual_end')
    op.drop_column('jobs', 'location_lat')
    op.drop_column('jobs', 'location_lng')
    op.drop_column('jobs', 'service_address')
    op.drop_column('jobs', 'customer_signature')
    op.drop_column('jobs', 'completion_notes')
    op.drop_column('jobs', 'photos')

    # Drop tables
    op.drop_table('technician_location_history')
    op.drop_table('technician_availability')
    op.drop_table('technicians')

    # Drop enums (PostgreSQL only)
    if is_postgresql:
        op.execute('DROP TYPE IF EXISTS technician_status')
        op.execute('DROP TYPE IF EXISTS technician_skill_level')
