"""
Field Service Scheduling Models

Models for managing technician schedules, task assignments, and availability.
"""

import enum
from datetime import date, datetime, time
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from dotmac.platform.db import Base
from dotmac.platform.db.types import JSONBCompat
from dotmac.platform.project_management.constants import FIELD_SERVICE_TEAM_TABLE

if TYPE_CHECKING:
    pass


class ScheduleStatus(str, enum.Enum):
    """Technician schedule status"""

    AVAILABLE = "available"
    ON_LEAVE = "on_leave"
    SICK = "sick"
    BUSY = "busy"
    OFF_DUTY = "off_duty"


class AssignmentStatus(str, enum.Enum):
    """Task assignment status"""

    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


class TechnicianSchedule(Base):
    """
    Daily/weekly schedule for technicians.

    Tracks when technicians are available, their shifts, breaks,
    and current status.
    """

    __tablename__ = "technician_schedules"

    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Technician reference
    technician_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Schedule date
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Shift times
    shift_start: Mapped[time] = mapped_column(Time, nullable=False)
    shift_end: Mapped[time] = mapped_column(Time, nullable=False)

    # Break times (optional)
    break_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_end: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Status
    status: Mapped[ScheduleStatus] = mapped_column(
        SQLEnum(ScheduleStatus),
        nullable=False,
        default=ScheduleStatus.AVAILABLE,
        index=True,
    )

    # Starting location for the day
    start_location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_location_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # e.g., "Office", "Home"

    # Capacity management
    max_tasks: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Max tasks for this day
    assigned_tasks_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    technician = relationship("Technician", back_populates="schedules")
    assignments = relationship(
        "TaskAssignment",
        back_populates="schedule",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_tech_schedule_date", "technician_id", "schedule_date"),
        Index("idx_tech_schedule_status", "tenant_id", "schedule_date", "status"),
    )

    def __repr__(self):
        return f"<TechnicianSchedule {self.technician_id} on {self.schedule_date}: {self.status}>"


class TaskAssignment(Base):
    """
    Assignment of a task to a technician with scheduling details.

    Tracks scheduled vs actual times, travel time, and assignment status.
    """

    __tablename__ = "task_assignments"

    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # References
    task_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    technician_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    schedule_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("technician_schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Scheduled times
    scheduled_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Actual times
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Travel & logistics
    travel_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    travel_distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    previous_task_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True), nullable=True
    )  # For route optimization

    # Status & confirmation
    status: Mapped[AssignmentStatus] = mapped_column(
        SQLEnum(AssignmentStatus),
        nullable=False,
        default=AssignmentStatus.SCHEDULED,
        index=True,
    )
    customer_confirmation_required: Mapped[bool] = mapped_column(Boolean, default=False)
    customer_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Assignment details
    assignment_method: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )  # "manual", "auto", "optimized"
    assignment_score: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )  # Score from assignment algorithm

    # Location at assignment time
    task_location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    task_location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    task_location_address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Reschedule tracking
    original_scheduled_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reschedule_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reschedule_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # Not visible to customer

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    task = relationship("Task", back_populates="assignments")
    technician = relationship("Technician", back_populates="task_assignments")
    schedule = relationship("TechnicianSchedule", back_populates="assignments")

    __table_args__ = (
        Index("idx_assignment_tech_date", "technician_id", "scheduled_start"),
        Index("idx_assignment_task", "task_id", "status"),
        Index("idx_assignment_status", "tenant_id", "status", "scheduled_start"),
    )

    def __repr__(self):
        return f"<TaskAssignment {self.task_id} → {self.technician_id}: {self.status}>"

    @property
    def is_overdue(self) -> bool:
        """Check if assignment is overdue"""
        if self.status in [AssignmentStatus.COMPLETED, AssignmentStatus.CANCELLED]:
            return False
        scheduled_end = self.scheduled_end
        if scheduled_end is None:
            return False
        if scheduled_end.tzinfo:
            now = datetime.now(tz=scheduled_end.tzinfo)
        else:
            now = datetime.utcnow()
        return now > scheduled_end

    @property
    def duration_minutes(self) -> int | None:
        """Get scheduled duration in minutes"""
        if self.scheduled_start and self.scheduled_end:
            delta = self.scheduled_end - self.scheduled_start
            return int(delta.total_seconds() / 60)
        return None

    @property
    def actual_duration_minutes(self) -> int | None:
        """Get actual duration in minutes"""
        if self.actual_start and self.actual_end:
            delta = self.actual_end - self.actual_start
            return int(delta.total_seconds() / 60)
        return None


class AvailabilityWindow(Base):
    """
    Technician availability windows for appointments.

    Used for customer-facing appointment booking.
    """

    __tablename__ = "availability_windows"

    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Technician or team
    technician_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    team_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey(f"{FIELD_SERVICE_TEAM_TABLE}.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Time window
    window_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Capacity
    max_appointments: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    booked_appointments: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Skills/service types this window supports
    supported_service_types = Column(JSONBCompat, nullable=True)
    required_skills = Column(JSONBCompat, nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    __table_args__ = (
        Index("idx_availability_tech_time", "technician_id", "window_start", "is_active"),
        Index("idx_availability_team_time", "team_id", "window_start", "is_active"),
    )

    @property
    def is_full(self) -> bool:
        """Check if window is fully booked"""
        return self.booked_appointments >= self.max_appointments

    @property
    def remaining_capacity(self) -> int:
        """Get remaining appointment capacity"""
        return max(0, self.max_appointments - self.booked_appointments)
