"""
GraphQL Types for Field Service Management

Strawberry GraphQL types for technicians, scheduling, time tracking, and resources.
"""

from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum

import strawberry

# ============================================================================
# Enums
# ============================================================================


@strawberry.enum
class TechnicianStatusEnum(Enum):
    AVAILABLE = "available"
    ON_JOB = "on_job"
    OFF_DUTY = "off_duty"
    ON_BREAK = "on_break"
    UNAVAILABLE = "unavailable"


@strawberry.enum
class SkillLevelEnum(Enum):
    TRAINEE = "trainee"
    JUNIOR = "junior"
    INTERMEDIATE = "intermediate"
    SENIOR = "senior"
    EXPERT = "expert"


@strawberry.enum
class ScheduleStatusEnum(Enum):
    AVAILABLE = "available"
    ON_LEAVE = "on_leave"
    SICK = "sick"
    BUSY = "busy"
    OFF_DUTY = "off_duty"


@strawberry.enum
class AssignmentStatusEnum(Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


@strawberry.enum
class TimeEntryTypeEnum(Enum):
    REGULAR = "regular"
    OVERTIME = "overtime"
    BREAK = "break"
    TRAVEL = "travel"
    TRAINING = "training"
    ADMINISTRATIVE = "administrative"


@strawberry.enum
class TimeEntryStatusEnum(Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    INVOICED = "invoiced"


@strawberry.enum
class EquipmentStatusEnum(Enum):
    AVAILABLE = "available"
    IN_USE = "in_use"
    MAINTENANCE = "maintenance"
    REPAIR = "repair"
    RETIRED = "retired"
    LOST = "lost"


@strawberry.enum
class VehicleStatusEnum(Enum):
    AVAILABLE = "available"
    IN_USE = "in_use"
    MAINTENANCE = "maintenance"
    REPAIR = "repair"
    RETIRED = "retired"


# ============================================================================
# Technician Types
# ============================================================================


@strawberry.type
class TechnicianSkillType:
    skill: str
    level: SkillLevelEnum
    years_experience: int | None = None
    certified: bool
    last_assessed: datetime | None = None


@strawberry.type
class TechnicianCertificationType:
    name: str
    issuing_organization: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    certificate_number: str | None = None
    certificate_url: str | None = None
    is_active: bool | None = None


@strawberry.type
class TechnicianType:
    id: strawberry.ID
    tenant_id: str
    user_id: str | None = None

    # Personal info
    employee_id: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    phone: str | None = None
    avatar: str | None = None

    # Employment
    status: TechnicianStatusEnum
    hire_date: date | None = None
    termination_date: date | None = None
    skill_level: SkillLevelEnum
    hourly_rate: Decimal | None = None

    # Skills and certifications
    skills: list[TechnicianSkillType] = strawberry.field(default_factory=list)
    certifications: list[TechnicianCertificationType] = strawberry.field(default_factory=list)
    specializations: list[str] = strawberry.field(default_factory=list)

    # Location
    home_location_lat: float | None = None
    home_location_lng: float | None = None
    home_address: str | None = None
    current_location_lat: float | None = None
    current_location_lng: float | None = None
    last_location_update: datetime | None = None
    service_areas: list[str] = strawberry.field(default_factory=list)

    # Availability
    is_available: bool
    max_concurrent_tasks: int

    # Performance
    completed_tasks: int
    average_rating: float | None = None
    completion_rate: float | None = None
    average_response_time_minutes: int | None = None

    # Audit
    created_at: datetime
    updated_at: datetime | None = None


# ============================================================================
# Scheduling Types
# ============================================================================


@strawberry.type
class TechnicianScheduleType:
    id: strawberry.ID
    tenant_id: str
    technician_id: str

    schedule_date: date
    shift_start: time
    shift_end: time
    break_start: time | None = None
    break_end: time | None = None

    status: ScheduleStatusEnum

    start_location_lat: float | None = None
    start_location_lng: float | None = None
    start_location_name: str | None = None

    max_tasks: int | None = None
    assigned_tasks_count: int

    notes: str | None = None
    created_at: datetime


@strawberry.type
class TaskAssignmentType:
    id: strawberry.ID
    tenant_id: str
    task_id: str
    technician_id: str
    schedule_id: str | None = None

    # Scheduled times
    scheduled_start: datetime
    scheduled_end: datetime
    actual_start: datetime | None = None
    actual_end: datetime | None = None

    # Travel
    travel_time_minutes: int | None = None
    travel_distance_km: float | None = None

    # Status
    status: AssignmentStatusEnum
    customer_confirmation_required: bool
    customer_confirmed_at: datetime | None = None

    # Assignment details
    assignment_method: str | None = None
    assignment_score: float | None = None

    # Location
    task_location_lat: float | None = None
    task_location_lng: float | None = None
    task_location_address: str | None = None

    # Reschedule
    original_scheduled_start: datetime | None = None
    reschedule_count: int
    reschedule_reason: str | None = None

    notes: str | None = None
    created_at: datetime


@strawberry.type
class AssignmentCandidateType:
    technician_id: str
    score: float
    is_available: bool

    # Score breakdown
    skill_match_score: float
    location_score: float
    availability_score: float
    workload_score: float
    certification_score: float

    # Details
    distance_km: float | None = None
    travel_time_minutes: int | None = None
    current_workload: int
    missing_skills: list[str]
    missing_certifications: list[str]
    reasons: list[str]


# ============================================================================
# Time Tracking Types
# ============================================================================


@strawberry.type
class TimeEntryType:
    id: strawberry.ID
    tenant_id: str
    technician_id: str
    task_id: str | None = None
    project_id: str | None = None
    assignment_id: str | None = None

    # Time tracking
    clock_in: datetime
    clock_out: datetime | None = None
    break_duration_minutes: Decimal

    # Entry details
    entry_type: TimeEntryTypeEnum
    status: TimeEntryStatusEnum

    # Location
    clock_in_lat: Decimal | None = None
    clock_in_lng: Decimal | None = None
    clock_out_lat: Decimal | None = None
    clock_out_lng: Decimal | None = None

    # Labor cost
    labor_rate_id: str | None = None
    hourly_rate: Decimal | None = None
    total_hours: Decimal | None = None
    total_cost: Decimal | None = None

    # Approval
    submitted_at: datetime | None = None
    approved_at: datetime | None = None
    approved_by: str | None = None
    rejected_at: datetime | None = None
    rejected_by: str | None = None
    rejection_reason: str | None = None

    description: str | None = None
    notes: str | None = None
    created_at: datetime


@strawberry.type
class LaborRateType:
    id: strawberry.ID
    tenant_id: str

    name: str
    description: str | None = None
    skill_level: SkillLevelEnum | None = None
    role: str | None = None

    # Rates
    regular_rate: Decimal
    overtime_rate: Decimal | None = None
    weekend_rate: Decimal | None = None
    holiday_rate: Decimal | None = None
    night_rate: Decimal | None = None

    # Effective dates
    effective_from: datetime
    effective_to: datetime | None = None
    is_active: bool

    currency: str
    created_at: datetime


# ============================================================================
# Resource Types
# ============================================================================


@strawberry.type
class EquipmentType:
    id: strawberry.ID
    tenant_id: str

    # Identification
    name: str
    category: str
    equipment_type: str
    serial_number: str | None = None
    asset_tag: str | None = None
    barcode: str | None = None

    # Specs
    manufacturer: str | None = None
    model: str | None = None

    # Status
    status: EquipmentStatusEnum
    condition: str | None = None

    # Location
    current_location: str | None = None
    home_location: str | None = None
    assigned_to_technician_id: str | None = None

    # Lifecycle
    purchase_date: date | None = None
    purchase_cost: Decimal | None = None
    next_maintenance_due: date | None = None

    # Calibration
    requires_calibration: bool
    next_calibration_due: date | None = None

    # Rental
    is_rental: bool
    rental_cost_per_day: Decimal | None = None

    is_active: bool
    created_at: datetime


@strawberry.type
class VehicleType:
    id: strawberry.ID
    tenant_id: str

    # Identification
    name: str
    vehicle_type: str
    make: str
    model: str
    year: int | None = None
    license_plate: str

    # Status
    status: VehicleStatusEnum
    odometer_reading: int | None = None

    # Assignment
    assigned_to_technician_id: str | None = None

    # GPS
    current_lat: Decimal | None = None
    current_lng: Decimal | None = None
    last_location_update: datetime | None = None

    # Maintenance
    next_service_due: date | None = None
    next_service_odometer: int | None = None

    is_active: bool
    created_at: datetime


# ============================================================================
# Input Types
# ============================================================================


@strawberry.input
class ClockInInput:
    technician_id: str
    task_id: str | None = None
    project_id: str | None = None
    entry_type: TimeEntryTypeEnum
    latitude: float | None = None
    longitude: float | None = None
    description: str | None = None


@strawberry.input
class ClockOutInput:
    break_duration_minutes: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


@strawberry.input
class CreateAssignmentInput:
    task_id: str
    technician_id: str
    scheduled_start: datetime
    scheduled_end: datetime
    customer_confirmation_required: bool | None = False
    notes: str | None = None


@strawberry.input
class AutoAssignmentInput:
    task_id: str
    scheduled_start: datetime
    scheduled_end: datetime
    required_skills: str | None = None  # JSON string
    required_certifications: list[str] | None = None
    task_location_lat: float | None = None
    task_location_lng: float | None = None
    max_candidates: int | None = 5


@strawberry.input
class AssignResourceInput:
    technician_id: str
    equipment_id: str | None = None
    vehicle_id: str | None = None
    task_id: str | None = None
    expected_return_at: datetime | None = None
    assignment_notes: str | None = None


# ============================================================================
# Pagination Types
# ============================================================================


@strawberry.type
class TechnicianConnection:
    items: list[TechnicianType]
    total: int
    page: int
    page_size: int
    has_more: bool


@strawberry.type
class AssignmentConnection:
    items: list[TaskAssignmentType]
    total: int
    page: int
    page_size: int
    has_more: bool


@strawberry.type
class TimeEntryConnection:
    items: list[TimeEntryType]
    total: int
    page: int
    page_size: int
    has_more: bool


@strawberry.type
class EquipmentConnection:
    items: list[EquipmentType]
    total: int
    page: int
    page_size: int
    has_more: bool


@strawberry.type
class VehicleConnection:
    items: list[VehicleType]
    total: int
    page: int
    page_size: int
    has_more: bool
