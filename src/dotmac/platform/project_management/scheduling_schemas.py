"""
Scheduling API Schemas

Pydantic models for scheduling API requests and responses.
"""

from datetime import date, datetime, time
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# Schedule Status Enums
class ScheduleStatusEnum(str):
    AVAILABLE = "available"
    ON_LEAVE = "on_leave"
    SICK = "sick"
    BUSY = "busy"
    OFF_DUTY = "off_duty"


class AssignmentStatusEnum(str):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


# Technician Schedule Schemas
class TechnicianScheduleBase(BaseModel):
    schedule_date: date
    shift_start: time
    shift_end: time
    break_start: time | None = None
    break_end: time | None = None
    status: str = ScheduleStatusEnum.AVAILABLE
    start_location_lat: float | None = None
    start_location_lng: float | None = None
    start_location_name: str | None = None
    max_tasks: int | None = None
    notes: str | None = None


class TechnicianScheduleCreate(TechnicianScheduleBase):
    technician_id: UUID


class TechnicianScheduleUpdate(BaseModel):
    shift_start: time | None = None
    shift_end: time | None = None
    break_start: time | None = None
    break_end: time | None = None
    status: str | None = None
    start_location_lat: float | None = None
    start_location_lng: float | None = None
    start_location_name: str | None = None
    max_tasks: int | None = None
    notes: str | None = None


class TechnicianScheduleResponse(TechnicianScheduleBase):
    id: UUID
    tenant_id: str
    technician_id: UUID
    assigned_tasks_count: int
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class TechnicianScheduleListResponse(BaseModel):
    """Paginated list of technician schedules"""

    schedules: list[TechnicianScheduleResponse]
    total: int
    page: int
    page_size: int


# Task Assignment Schemas
class TaskAssignmentBase(BaseModel):
    scheduled_start: datetime
    scheduled_end: datetime
    travel_time_minutes: int | None = None
    travel_distance_km: float | None = None
    task_location_lat: float | None = None
    task_location_lng: float | None = None
    task_location_address: str | None = None
    customer_confirmation_required: bool = False
    notes: str | None = None
    internal_notes: str | None = None


class TaskAssignmentCreate(TaskAssignmentBase):
    task_id: UUID
    technician_id: UUID
    schedule_id: UUID | None = None


class TaskAssignmentAutoCreate(BaseModel):
    """Request to automatically assign a task to best available technician."""

    task_id: UUID
    scheduled_start: datetime
    scheduled_end: datetime
    required_skills: dict[str, bool] | None = None
    required_certifications: list[str] | None = None
    task_location_lat: float | None = None
    task_location_lng: float | None = None
    max_candidates: int = Field(default=5, ge=1, le=20)
    customer_confirmation_required: bool = False
    notes: str | None = None


class TaskAssignmentUpdate(BaseModel):
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    status: str | None = None
    travel_time_minutes: int | None = None
    travel_distance_km: float | None = None
    notes: str | None = None
    internal_notes: str | None = None


class TaskAssignmentReschedule(BaseModel):
    new_scheduled_start: datetime
    new_scheduled_end: datetime
    reason: str
    notify_customer: bool = True


class TaskAssignmentResponse(TaskAssignmentBase):
    id: UUID
    tenant_id: str
    task_id: UUID
    technician_id: UUID
    schedule_id: UUID | None
    actual_start: datetime | None
    actual_end: datetime | None
    status: str
    customer_confirmed_at: datetime | None
    assignment_method: str | None
    assignment_score: float | None
    original_scheduled_start: datetime | None
    reschedule_count: int
    reschedule_reason: str | None
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class TaskAssignmentListResponse(BaseModel):
    """Paginated list of task assignments"""

    assignments: list[TaskAssignmentResponse]
    total: int
    page: int
    page_size: int


# Assignment Candidate Schema
class AssignmentCandidateResponse(BaseModel):
    """Response with ranked technician candidates for task assignment."""

    technician_id: UUID
    technician_name: str
    total_score: float
    skill_match_score: float
    location_score: float
    availability_score: float
    workload_score: float
    certification_score: float
    distance_km: float | None
    travel_time_minutes: int | None
    current_workload: int
    missing_skills: list[str]
    missing_certifications: list[str]
    is_qualified: bool

    class Config:
        from_attributes = True


# Availability Window Schemas
class AvailabilityWindowBase(BaseModel):
    window_start: datetime
    window_end: datetime
    max_appointments: int = 1
    supported_service_types: dict[str, Any] | None = None
    required_skills: dict[str, bool] | None = None


class AvailabilityWindowCreate(AvailabilityWindowBase):
    technician_id: UUID | None = None
    team_id: UUID | None = None


class AvailabilityWindowResponse(AvailabilityWindowBase):
    id: UUID
    tenant_id: str
    technician_id: UUID | None
    team_id: UUID | None
    booked_appointments: int
    is_active: bool
    is_full: bool
    remaining_capacity: int
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


# Availability Check Schemas
class AvailabilityCheckRequest(BaseModel):
    """Request to check technician availability."""

    technician_ids: list[UUID] | None = None  # If None, check all
    start_datetime: datetime
    end_datetime: datetime
    required_skills: dict[str, bool] | None = None
    task_location: tuple[float, float] | None = None  # (lat, lng)


class AvailabilityCheckResponse(BaseModel):
    """Response with available technicians."""

    technician_id: UUID
    technician_name: str
    is_available: bool
    has_required_skills: bool
    current_assignments: int
    distance_km: float | None
    conflicts: list[str]  # List of conflict reasons

    class Config:
        from_attributes = True


# Schedule Summary Schemas
class ScheduleSummaryResponse(BaseModel):
    """Daily schedule summary for a technician."""

    technician_id: UUID
    technician_name: str
    schedule_date: date
    shift_start: time
    shift_end: time
    status: str
    total_assignments: int
    completed_assignments: int
    pending_assignments: int
    total_work_hours: float
    total_travel_time_minutes: int
    assignments: list[TaskAssignmentResponse]

    class Config:
        from_attributes = True


# Bulk Assignment Schemas
class BulkAssignmentRequest(BaseModel):
    """Request to assign multiple tasks at once."""

    task_assignments: list[
        dict[str, Any]
    ]  # List of {task_id, technician_id, scheduled_start, scheduled_end}
    validate_conflicts: bool = True


class BulkAssignmentResponse(BaseModel):
    """Response for bulk assignment operation."""

    total_requested: int
    successful: int
    failed: int
    assignments: list[TaskAssignmentResponse]
    errors: list[dict[str, str]]  # List of {task_id, error}
