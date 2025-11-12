"""add time tracking and resource management tables

Revision ID: 2025_11_08_1901
Revises: 2025_11_08_1830
Create Date: 2025-11-08 19:00:00

Creates tables for:
- Time tracking: time_entries, labor_rates, timesheet_periods
- Resource management: equipment, vehicles, resource_assignments, equipment_maintenance, vehicle_maintenance
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2025_11_08_1901'
down_revision = '2025_11_08_1830'
branch_labels = None
depends_on = None


def upgrade():
    # Create enums for time tracking
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE timeentrytype AS ENUM ('regular', 'overtime', 'break', 'travel', 'training', 'administrative');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE timeentrystatus AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'invoiced');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create enums for resource management
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE equipmentstatus AS ENUM ('available', 'in_use', 'maintenance', 'repair', 'retired', 'lost');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE vehiclestatus AS ENUM ('available', 'in_use', 'maintenance', 'repair', 'retired');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE resourceassignmentstatus AS ENUM ('reserved', 'assigned', 'in_use', 'returned', 'damaged', 'lost');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Define enum types for use in create_table
    time_entry_type_enum = postgresql.ENUM(
        'regular', 'overtime', 'break', 'travel', 'training', 'administrative',
        name='timeentrytype',
        create_type=False
    )
    time_entry_status_enum = postgresql.ENUM(
        'draft', 'submitted', 'approved', 'rejected', 'invoiced',
        name='timeentrystatus',
        create_type=False
    )
    equipment_status_enum = postgresql.ENUM(
        'available', 'in_use', 'maintenance', 'repair', 'retired', 'lost',
        name='equipmentstatus',
        create_type=False
    )
    vehicle_status_enum = postgresql.ENUM(
        'available', 'in_use', 'maintenance', 'repair', 'retired',
        name='vehiclestatus',
        create_type=False
    )
    resource_assignment_status_enum = postgresql.ENUM(
        'reserved', 'assigned', 'in_use', 'returned', 'damaged', 'lost',
        name='resourceassignmentstatus',
        create_type=False
    )

    # Create labor_rates table
    op.create_table(
        'labor_rates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('skill_level', sa.String(50), nullable=True, index=True),
        sa.Column('role', sa.String(100), nullable=True, index=True),

        # Rates by time type
        sa.Column('regular_rate', sa.Numeric(10, 2), nullable=False),
        sa.Column('overtime_rate', sa.Numeric(10, 2), nullable=True),
        sa.Column('weekend_rate', sa.Numeric(10, 2), nullable=True),
        sa.Column('holiday_rate', sa.Numeric(10, 2), nullable=True),
        sa.Column('night_rate', sa.Numeric(10, 2), nullable=True),

        # Effective dates
        sa.Column('effective_from', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('effective_to', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true', index=True),

        sa.Column('currency', sa.String(3), nullable=False, server_default='NGN'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('additional_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Audit
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, onupdate=sa.text('now()')),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
    )

    # Create indexes for labor_rates
    op.create_index('idx_labor_rate_tenant_active', 'labor_rates', ['tenant_id', 'is_active', 'effective_from'])
    op.create_index('idx_labor_rate_skill_role', 'labor_rates', ['skill_level', 'role', 'is_active'])

    # Create time_entries table
    op.create_table(
        'time_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),

        # References
        sa.Column('technician_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assignment_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Time tracking
        sa.Column('clock_in', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('clock_out', sa.DateTime(timezone=True), nullable=True),
        sa.Column('break_duration_minutes', sa.Numeric(10, 2), nullable=True, server_default='0'),

        # Entry details
        sa.Column('entry_type', time_entry_type_enum, nullable=False, server_default='regular', index=True),
        sa.Column('status', time_entry_status_enum, nullable=False, server_default='draft', index=True),

        # Location tracking
        sa.Column('clock_in_lat', sa.Numeric(10, 7), nullable=True),
        sa.Column('clock_in_lng', sa.Numeric(10, 7), nullable=True),
        sa.Column('clock_out_lat', sa.Numeric(10, 7), nullable=True),
        sa.Column('clock_out_lng', sa.Numeric(10, 7), nullable=True),

        # Labor cost calculation
        sa.Column('labor_rate_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('hourly_rate', sa.Numeric(10, 2), nullable=True),
        sa.Column('total_hours', sa.Numeric(10, 2), nullable=True),
        sa.Column('total_cost', sa.Numeric(10, 2), nullable=True),

        # Approval workflow
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_by', sa.String(255), nullable=True),
        sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejected_by', sa.String(255), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),

        # Notes
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('additional_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Audit
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, onupdate=sa.text('now()')),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),

        # Foreign keys
        sa.ForeignKeyConstraint(['technician_id'], ['technicians.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assignment_id'], ['task_assignments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['labor_rate_id'], ['labor_rates.id'], ondelete='SET NULL'),

        # Check constraint
        sa.CheckConstraint('clock_out IS NULL OR clock_out >= clock_in', name='check_clock_out_after_clock_in'),
    )

    # Create indexes for time_entries
    op.create_index('idx_time_entry_tech_date', 'time_entries', ['technician_id', 'clock_in'])
    op.create_index('idx_time_entry_task', 'time_entries', ['task_id', 'status'])
    op.create_index('idx_time_entry_status_date', 'time_entries', ['tenant_id', 'status', 'clock_in'])

    # Create timesheet_periods table
    op.create_table(
        'timesheet_periods',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),

        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False, index=True),

        # Status
        sa.Column('status', sa.String(50), nullable=False, server_default='open', index=True),
        sa.Column('locked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('locked_by', sa.String(255), nullable=True),

        # Summary
        sa.Column('total_hours', sa.Numeric(10, 2), nullable=True),
        sa.Column('total_cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('technician_count', sa.Integer(), nullable=True),
        sa.Column('entry_count', sa.Integer(), nullable=True),

        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('additional_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Audit
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, onupdate=sa.text('now()')),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),

        # Check constraint
        sa.CheckConstraint('period_end > period_start', name='check_period_end_after_start'),
    )

    # Create indexes for timesheet_periods
    op.create_index('idx_timesheet_period_dates', 'timesheet_periods', ['tenant_id', 'period_start', 'period_end'])
    op.create_index('idx_timesheet_period_status', 'timesheet_periods', ['tenant_id', 'status'])

    # Create equipment table
    op.create_table(
        'equipment',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),

        # Equipment identification
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('category', sa.String(100), nullable=False, index=True),
        sa.Column('equipment_type', sa.String(100), nullable=False),
        sa.Column('serial_number', sa.String(100), nullable=True, index=True),
        sa.Column('asset_tag', sa.String(100), nullable=True, unique=True, index=True),
        sa.Column('barcode', sa.String(100), nullable=True, index=True),

        # Specifications
        sa.Column('manufacturer', sa.String(255), nullable=True),
        sa.Column('model', sa.String(255), nullable=True),
        sa.Column('specifications', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Status and condition
        sa.Column('status', equipment_status_enum, nullable=False, server_default='available', index=True),
        sa.Column('condition', sa.String(50), nullable=True),
        sa.Column('condition_notes', sa.Text(), nullable=True),

        # Location tracking
        sa.Column('current_location', sa.String(255), nullable=True),
        sa.Column('home_location', sa.String(255), nullable=True),
        sa.Column('assigned_to_technician_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Lifecycle
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('purchase_cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('warranty_expires', sa.Date(), nullable=True),
        sa.Column('last_maintenance_date', sa.Date(), nullable=True),
        sa.Column('next_maintenance_due', sa.Date(), nullable=True, index=True),

        # Calibration
        sa.Column('requires_calibration', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_calibration_date', sa.Date(), nullable=True),
        sa.Column('next_calibration_due', sa.Date(), nullable=True, index=True),
        sa.Column('calibration_certificate', sa.String(500), nullable=True),

        # Rental/Cost tracking
        sa.Column('is_rental', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('rental_cost_per_day', sa.Numeric(10, 2), nullable=True),
        sa.Column('rental_vendor', sa.String(255), nullable=True),

        # Availability
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true', index=True),
        sa.Column('is_shareable', sa.Boolean(), nullable=False, server_default='true'),

        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('additional_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Audit
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, onupdate=sa.text('now()')),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),

        # Foreign keys
        sa.ForeignKeyConstraint(['assigned_to_technician_id'], ['technicians.id'], ondelete='SET NULL'),
    )

    # Create indexes for equipment
    op.create_index('idx_equipment_tenant_status', 'equipment', ['tenant_id', 'status', 'is_active'])
    op.create_index('idx_equipment_category_type', 'equipment', ['category', 'equipment_type', 'is_active'])
    op.create_index('idx_equipment_assigned', 'equipment', ['assigned_to_technician_id', 'status'])

    # Create vehicles table
    op.create_table(
        'vehicles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),

        # Vehicle identification
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('vehicle_type', sa.String(100), nullable=False, index=True),
        sa.Column('make', sa.String(100), nullable=False),
        sa.Column('model', sa.String(100), nullable=False),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('color', sa.String(50), nullable=True),

        # Registration
        sa.Column('license_plate', sa.String(20), nullable=False, unique=True, index=True),
        sa.Column('vin', sa.String(17), nullable=True, unique=True),
        sa.Column('registration_number', sa.String(100), nullable=True),
        sa.Column('registration_expires', sa.Date(), nullable=True, index=True),

        # Status
        sa.Column('status', vehicle_status_enum, nullable=False, server_default='available', index=True),
        sa.Column('condition', sa.String(50), nullable=True),
        sa.Column('odometer_reading', sa.Integer(), nullable=True),

        # Assignment
        sa.Column('assigned_to_technician_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('home_location', sa.String(255), nullable=True),

        # Location tracking (GPS)
        sa.Column('current_lat', sa.Numeric(10, 7), nullable=True),
        sa.Column('current_lng', sa.Numeric(10, 7), nullable=True),
        sa.Column('last_location_update', sa.DateTime(timezone=True), nullable=True),

        # Maintenance
        sa.Column('last_service_date', sa.Date(), nullable=True),
        sa.Column('next_service_due', sa.Date(), nullable=True, index=True),
        sa.Column('last_service_odometer', sa.Integer(), nullable=True),
        sa.Column('next_service_odometer', sa.Integer(), nullable=True),

        # Insurance
        sa.Column('insurance_company', sa.String(255), nullable=True),
        sa.Column('insurance_policy_number', sa.String(100), nullable=True),
        sa.Column('insurance_expires', sa.Date(), nullable=True, index=True),

        # Fuel tracking
        sa.Column('fuel_type', sa.String(50), nullable=True),
        sa.Column('fuel_card_number', sa.String(100), nullable=True),
        sa.Column('average_fuel_consumption', sa.Numeric(10, 2), nullable=True),

        # Capacity
        sa.Column('seating_capacity', sa.Integer(), nullable=True),
        sa.Column('cargo_capacity', sa.String(100), nullable=True),

        # Lifecycle
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('purchase_cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('is_leased', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('lease_expires', sa.Date(), nullable=True),

        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true', index=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('additional_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Audit
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, onupdate=sa.text('now()')),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),

        # Foreign keys
        sa.ForeignKeyConstraint(['assigned_to_technician_id'], ['technicians.id'], ondelete='SET NULL'),
    )

    # Create indexes for vehicles
    op.create_index('idx_vehicle_tenant_status', 'vehicles', ['tenant_id', 'status', 'is_active'])
    op.create_index('idx_vehicle_assigned', 'vehicles', ['assigned_to_technician_id', 'status'])

    # Create resource_assignments table
    op.create_table(
        'resource_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),

        # Assignment target
        sa.Column('technician_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Resource
        sa.Column('equipment_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('vehicle_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Assignment period
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('expected_return_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('returned_at', sa.DateTime(timezone=True), nullable=True),

        # Status
        sa.Column('status', resource_assignment_status_enum, nullable=False, server_default='assigned', index=True),

        # Condition tracking
        sa.Column('condition_at_assignment', sa.String(50), nullable=True),
        sa.Column('condition_at_return', sa.String(50), nullable=True),
        sa.Column('damage_description', sa.Text(), nullable=True),
        sa.Column('damage_cost', sa.Numeric(10, 2), nullable=True),

        sa.Column('assignment_notes', sa.Text(), nullable=True),
        sa.Column('return_notes', sa.Text(), nullable=True),
        sa.Column('additional_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Audit
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, onupdate=sa.text('now()')),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),

        # Foreign keys
        sa.ForeignKeyConstraint(['technician_id'], ['technicians.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['equipment_id'], ['equipment.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ondelete='CASCADE'),
    )

    # Create indexes for resource_assignments
    op.create_index('idx_resource_assignment_tech', 'resource_assignments', ['technician_id', 'status', 'assigned_at'])
    op.create_index('idx_resource_assignment_equipment', 'resource_assignments', ['equipment_id', 'status'])
    op.create_index('idx_resource_assignment_vehicle', 'resource_assignments', ['vehicle_id', 'status'])
    op.create_index('idx_resource_assignment_dates', 'resource_assignments', ['tenant_id', 'assigned_at', 'returned_at'])

    # Create equipment_maintenance table
    op.create_table(
        'equipment_maintenance',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('equipment_id', postgresql.UUID(as_uuid=True), nullable=False),

        # Maintenance details
        sa.Column('maintenance_type', sa.String(100), nullable=False, index=True),
        sa.Column('maintenance_date', sa.Date(), nullable=False, index=True),
        sa.Column('performed_by', sa.String(255), nullable=True),
        sa.Column('cost', sa.Numeric(10, 2), nullable=True),

        # Description
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('parts_replaced', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('work_performed', sa.Text(), nullable=True),

        # Calibration specific
        sa.Column('calibration_certificate_number', sa.String(100), nullable=True),
        sa.Column('calibration_certificate_url', sa.String(500), nullable=True),
        sa.Column('next_calibration_due', sa.Date(), nullable=True),

        # Warranty
        sa.Column('warranty_claim', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('warranty_claim_number', sa.String(100), nullable=True),

        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('additional_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Audit
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_by', sa.String(255), nullable=True),

        # Foreign keys
        sa.ForeignKeyConstraint(['equipment_id'], ['equipment.id'], ondelete='CASCADE'),
    )

    # Create indexes for equipment_maintenance
    op.create_index('idx_equipment_maintenance', 'equipment_maintenance', ['equipment_id', 'maintenance_date'])
    op.create_index('idx_equipment_maintenance_type', 'equipment_maintenance', ['tenant_id', 'maintenance_type', 'maintenance_date'])

    # Create vehicle_maintenance table
    op.create_table(
        'vehicle_maintenance',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False, index=True),
        sa.Column('vehicle_id', postgresql.UUID(as_uuid=True), nullable=False),

        # Maintenance details
        sa.Column('maintenance_type', sa.String(100), nullable=False, index=True),
        sa.Column('maintenance_date', sa.Date(), nullable=False, index=True),
        sa.Column('odometer_reading', sa.Integer(), nullable=True),
        sa.Column('performed_by', sa.String(255), nullable=True),
        sa.Column('cost', sa.Numeric(10, 2), nullable=True),

        # Description
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('parts_replaced', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('work_performed', sa.Text(), nullable=True),

        # Next service
        sa.Column('next_service_due_date', sa.Date(), nullable=True),
        sa.Column('next_service_due_odometer', sa.Integer(), nullable=True),

        # Warranty
        sa.Column('warranty_claim', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('warranty_claim_number', sa.String(100), nullable=True),

        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('additional_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Audit
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_by', sa.String(255), nullable=True),

        # Foreign keys
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ondelete='CASCADE'),
    )

    # Create indexes for vehicle_maintenance
    op.create_index('idx_vehicle_maintenance', 'vehicle_maintenance', ['vehicle_id', 'maintenance_date'])
    op.create_index('idx_vehicle_maintenance_type', 'vehicle_maintenance', ['tenant_id', 'maintenance_type', 'maintenance_date'])


def downgrade():
    # Drop tables
    op.drop_index('idx_vehicle_maintenance_type', 'vehicle_maintenance')
    op.drop_index('idx_vehicle_maintenance', 'vehicle_maintenance')
    op.drop_table('vehicle_maintenance')

    op.drop_index('idx_equipment_maintenance_type', 'equipment_maintenance')
    op.drop_index('idx_equipment_maintenance', 'equipment_maintenance')
    op.drop_table('equipment_maintenance')

    op.drop_index('idx_resource_assignment_dates', 'resource_assignments')
    op.drop_index('idx_resource_assignment_vehicle', 'resource_assignments')
    op.drop_index('idx_resource_assignment_equipment', 'resource_assignments')
    op.drop_index('idx_resource_assignment_tech', 'resource_assignments')
    op.drop_table('resource_assignments')

    op.drop_index('idx_vehicle_assigned', 'vehicles')
    op.drop_index('idx_vehicle_tenant_status', 'vehicles')
    op.drop_table('vehicles')

    op.drop_index('idx_equipment_assigned', 'equipment')
    op.drop_index('idx_equipment_category_type', 'equipment')
    op.drop_index('idx_equipment_tenant_status', 'equipment')
    op.drop_table('equipment')

    op.drop_index('idx_timesheet_period_status', 'timesheet_periods')
    op.drop_index('idx_timesheet_period_dates', 'timesheet_periods')
    op.drop_table('timesheet_periods')

    op.drop_index('idx_time_entry_status_date', 'time_entries')
    op.drop_index('idx_time_entry_task', 'time_entries')
    op.drop_index('idx_time_entry_tech_date', 'time_entries')
    op.drop_table('time_entries')

    op.drop_index('idx_labor_rate_skill_role', 'labor_rates')
    op.drop_index('idx_labor_rate_tenant_active', 'labor_rates')
    op.drop_table('labor_rates')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS resourceassignmentstatus')
    op.execute('DROP TYPE IF EXISTS vehiclestatus')
    op.execute('DROP TYPE IF EXISTS equipmentstatus')
    op.execute('DROP TYPE IF EXISTS timeentrystatus')
    op.execute('DROP TYPE IF EXISTS timeentrytype')
