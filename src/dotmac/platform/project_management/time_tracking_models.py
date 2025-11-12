"""
Time Tracking Models

Models for tracking technician work hours, clock in/out, and labor costs.
"""

import enum
from datetime import datetime
from decimal import Decimal
from typing import cast
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from dotmac.platform.db import Base
from dotmac.platform.db.types import JSONBCompat


class TimeEntryType(str, enum.Enum):
    """Type of time entry."""

    REGULAR = "regular"
    OVERTIME = "overtime"
    BREAK = "break"
    TRAVEL = "travel"
    TRAINING = "training"
    ADMINISTRATIVE = "administrative"


class TimeEntryStatus(str, enum.Enum):
    """Status of time entry."""

    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    INVOICED = "invoiced"


class TimeEntry(Base):
    """
    Time Entry Model.

    Tracks actual work hours for technicians with clock in/out,
    breaks, and labor cost calculation.
    """

    __tablename__ = "time_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(String(255), nullable=False, index=True)

    # References
    technician_id = Column(
        UUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assignment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("task_assignments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Time tracking
    clock_in = Column(DateTime(timezone=True), nullable=False, index=True)
    clock_out = Column(DateTime(timezone=True), nullable=True)
    break_duration_minutes = Column(Numeric(10, 2), nullable=True, default=0)

    # Entry details
    entry_type: Mapped[TimeEntryType] = mapped_column(
        SQLEnum(TimeEntryType),
        nullable=False,
        default=TimeEntryType.REGULAR,
        index=True,
    )
    status: Mapped[TimeEntryStatus] = mapped_column(
        SQLEnum(TimeEntryStatus),
        nullable=False,
        default=TimeEntryStatus.DRAFT,
        index=True,
    )

    # Location tracking
    clock_in_lat = Column(Numeric(10, 7), nullable=True)
    clock_in_lng = Column(Numeric(10, 7), nullable=True)
    clock_out_lat = Column(Numeric(10, 7), nullable=True)
    clock_out_lng = Column(Numeric(10, 7), nullable=True)

    # Labor cost calculation
    labor_rate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("labor_rates.id", ondelete="SET NULL"),
        nullable=True,
    )
    hourly_rate = Column(Numeric(10, 2), nullable=True)  # Rate at time of entry
    total_hours = Column(Numeric(10, 2), nullable=True)  # Calculated field
    total_cost = Column(Numeric(10, 2), nullable=True)  # Calculated field

    # Approval workflow
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(String(255), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    rejected_by = Column(String(255), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Notes
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)

    # Relationships
    technician = relationship("Technician", backref="time_entries")
    task = relationship("Task", backref="time_entries")
    project = relationship("Project", backref="time_entries")
    assignment = relationship("TaskAssignment", backref="time_entries")
    labor_rate = relationship("LaborRate", backref="time_entries")

    __table_args__ = (
        Index("idx_time_entry_tech_date", "technician_id", "clock_in"),
        Index("idx_time_entry_task", "task_id", "status"),
        Index("idx_time_entry_status_date", "tenant_id", "status", "clock_in"),
        CheckConstraint(
            "clock_out IS NULL OR clock_out >= clock_in", name="check_clock_out_after_clock_in"
        ),
    )

    def __repr__(self):
        return f"<TimeEntry {self.technician_id} @ {self.clock_in}>"

    def calculate_hours(self) -> Decimal | None:
        """Calculate total hours worked (excluding breaks)."""
        if not self.clock_out:
            return None

        total_seconds = (self.clock_out - self.clock_in).total_seconds()
        break_seconds = float(self.break_duration_minutes or 0) * 60
        work_seconds = max(0, total_seconds - break_seconds)

        return Decimal(str(work_seconds / 3600)).quantize(Decimal("0.01"))

    def calculate_cost(self) -> Decimal | None:
        """Calculate total labor cost."""
        hours = self.calculate_hours()
        if not hours or not self.hourly_rate:
            return None

        return (hours * self.hourly_rate).quantize(Decimal("0.01"))

    def is_active(self) -> bool:
        """Check if time entry is currently active (clocked in but not out)."""
        return self.clock_out is None

    @property
    def duration_minutes(self) -> int | None:
        """Get duration in minutes (excluding breaks)."""
        hours = self.calculate_hours()
        if hours:
            return int(hours * 60)
        return None


class LaborRate(Base):
    """
    Labor Rate Model.

    Defines hourly rates for different technician roles, skill levels,
    and time periods (regular, overtime, holiday).
    """

    __tablename__ = "labor_rates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Rate identification
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Rate details
    skill_level = Column(
        String(50), nullable=True, index=True
    )  # trainee, junior, intermediate, senior, expert
    role = Column(String(100), nullable=True, index=True)  # fiber_tech, installer, supervisor

    # Rates by time type
    regular_rate = Column(Numeric(10, 2), nullable=False)  # Regular hours
    overtime_rate = Column(Numeric(10, 2), nullable=True)  # OT multiplier (e.g., 1.5x)
    weekend_rate = Column(Numeric(10, 2), nullable=True)  # Weekend multiplier
    holiday_rate = Column(Numeric(10, 2), nullable=True)  # Holiday multiplier
    night_rate = Column(Numeric(10, 2), nullable=True)  # Night shift multiplier

    # Effective dates
    effective_from = Column(DateTime(timezone=True), nullable=False, index=True)
    effective_to = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Currency
    currency = Column(String(3), nullable=False, default="NGN")  # ISO 4217 code

    # Notes
    notes = Column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)

    __table_args__ = (
        Index("idx_labor_rate_tenant_active", "tenant_id", "is_active", "effective_from"),
        Index("idx_labor_rate_skill_role", "skill_level", "role", "is_active"),
    )

    def __repr__(self):
        return f"<LaborRate {self.name} @ {self.regular_rate}>"

    def get_rate_for_datetime(self, dt: datetime) -> Decimal:
        """
        Get appropriate rate for given datetime.

        Considers day of week, time of day, and holidays.
        """
        # Weekend check
        weekend_rate = cast(Decimal | None, self.weekend_rate)
        if dt.weekday() >= 5 and weekend_rate:  # Saturday=5, Sunday=6
            return weekend_rate

        # Night shift check (example: 10 PM - 6 AM)
        night_rate = cast(Decimal | None, self.night_rate)
        if night_rate:
            hour = dt.hour
            if hour >= 22 or hour < 6:
                return night_rate

        # TODO: Add holiday check with calendar integration

        return cast(Decimal, self.regular_rate)

    def is_valid_for_date(self, dt: datetime) -> bool:
        """Check if rate is valid for given date."""
        if not self.is_active:
            return False

        if dt < self.effective_from:
            return False

        if self.effective_to and dt > self.effective_to:
            return False

        return True


class TimesheetPeriod(Base):
    """
    Timesheet Period Model.

    Represents a pay period or billing cycle for grouping time entries.
    """

    __tablename__ = "timesheet_periods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Period details
    name = Column(String(255), nullable=False)
    period_start = Column(DateTime(timezone=True), nullable=False, index=True)
    period_end = Column(DateTime(timezone=True), nullable=False, index=True)

    # Status
    status = Column(
        String(50), nullable=False, default="open", index=True
    )  # open, locked, approved, paid
    locked_at = Column(DateTime(timezone=True), nullable=True)
    locked_by = Column(String(255), nullable=True)

    # Summary
    total_hours = Column(Numeric(10, 2), nullable=True)
    total_cost = Column(Numeric(10, 2), nullable=True)
    technician_count = Column(Integer, nullable=True)
    entry_count = Column(Integer, nullable=True)

    # Notes
    notes = Column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)

    __table_args__ = (
        Index("idx_timesheet_period_dates", "tenant_id", "period_start", "period_end"),
        Index("idx_timesheet_period_status", "tenant_id", "status"),
        CheckConstraint("period_end > period_start", name="check_period_end_after_start"),
    )

    def __repr__(self):
        return f"<TimesheetPeriod {self.name}>"
