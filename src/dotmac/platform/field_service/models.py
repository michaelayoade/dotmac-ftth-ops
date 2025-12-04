"""
Field Service Models

SQLAlchemy models for technician management and field operations.
"""

import enum
from datetime import date, datetime, time
from typing import Any
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
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from dotmac.platform.db import Base
from dotmac.platform.db.types import ArrayCompat, JSONBCompat


class TechnicianStatus(str, enum.Enum):
    """Technician availability status."""

    AVAILABLE = "available"
    ON_JOB = "on_job"
    OFF_DUTY = "off_duty"
    ON_BREAK = "on_break"
    UNAVAILABLE = "unavailable"


class TechnicianSkillLevel(str, enum.Enum):
    """Technician skill level."""

    TRAINEE = "trainee"
    JUNIOR = "junior"
    INTERMEDIATE = "intermediate"
    SENIOR = "senior"
    EXPERT = "expert"


class Technician(Base):
    """
    Technician/Field Service Staff Model.

    Represents field service technicians who perform installations,
    maintenance, and repairs.
    """

    __tablename__ = "technicians"

    # Primary identification
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Link to users table
    employee_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # Personal information
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Employment details
    status: Mapped[TechnicianStatus] = mapped_column(
        SQLEnum(TechnicianStatus),
        nullable=False,
        default=TechnicianStatus.AVAILABLE,
    )
    skill_level: Mapped[TechnicianSkillLevel] = mapped_column(
        SQLEnum(TechnicianSkillLevel),
        nullable=False,
        default=TechnicianSkillLevel.INTERMEDIATE,
    )
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    team_lead_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("technicians.id", name="fk_technician_team_lead"),
        nullable=True,
    )

    # Location and territory
    home_base_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    home_base_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    home_base_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    current_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_location_update: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    service_areas: Mapped[list[str] | None] = mapped_column(
        ArrayCompat(String(100)),
        nullable=True,
    )  # List of service area IDs

    # Schedule and availability
    working_hours_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    working_hours_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    working_days: Mapped[list[int] | None] = mapped_column(
        ArrayCompat(Integer),
        nullable=True,
    )  # 0=Monday, 6=Sunday
    is_on_call: Mapped[bool] = mapped_column(Boolean, default=False)
    available_for_emergency: Mapped[bool] = mapped_column(Boolean, default=True)

    # Skills and certifications
    skills: Mapped[dict[str, bool] | None] = mapped_column(
        JSONBCompat,
        nullable=True,
    )  # {"fiber_splicing": true, "ont_config": true, "copper": false}
    certifications: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONBCompat,
        nullable=True,
    )  # [{"name": "Fiber Optic Cert", "expires": "2025-12-31"}]
    equipment: Mapped[dict[str, Any] | None] = mapped_column(
        JSONBCompat,
        nullable=True,
    )  # {"otdr": true, "fusion_splicer": true, "tools": [...]}

    # Performance metrics
    jobs_completed: Mapped[int] = mapped_column(Integer, default=0)
    average_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    completion_rate: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    team_lead = relationship("Technician", remote_side=[id], backref="team_members")
    availability_records = relationship(
        "TechnicianAvailability", back_populates="technician", cascade="all, delete-orphan"
    )
    location_history = relationship(
        "TechnicianLocationHistory", back_populates="technician", cascade="all, delete-orphan"
    )
    schedules = relationship(
        "TechnicianSchedule", back_populates="technician", cascade="all, delete-orphan"
    )
    task_assignments = relationship(
        "TaskAssignment", back_populates="technician", cascade="all, delete-orphan"
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", name="uq_technician_tenant_employee"),
        UniqueConstraint("tenant_id", "email", name="uq_technician_tenant_email"),
        Index("ix_technicians_tenant_status", "tenant_id", "status"),
        Index("ix_technicians_tenant_active", "tenant_id", "is_active"),
        Index("ix_technicians_location", "current_lat", "current_lng"),
    )

    @property
    def full_name(self) -> str:
        """Get technician's full name."""
        return f"{self.first_name} {self.last_name}"

    def is_available_now(self) -> bool:
        """Check if technician is available right now."""
        return self.status == TechnicianStatus.AVAILABLE and self.is_active

    def has_skill(self, skill: str) -> bool:
        """Check if technician has a specific skill."""
        if not self.skills:
            return False
        return self.skills.get(skill, False) is True

    def distance_from(self, lat: float, lng: float) -> float | None:
        """
        Calculate distance from given coordinates (Haversine formula).

        Returns distance in kilometers, or None if technician location unknown.
        """
        if self.current_lat is None or self.current_lng is None:
            return None

        from math import atan2, cos, radians, sin, sqrt

        # Earth radius in kilometers
        R = 6371.0

        lat1 = radians(self.current_lat)
        lon1 = radians(self.current_lng)
        lat2 = radians(lat)
        lon2 = radians(lng)

        dlon = lon2 - lon1
        dlat = lat2 - lat1

        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))

        return R * c


class TechnicianAvailability(Base):
    """
    Technician Availability Record.

    Tracks time periods when technician is available or unavailable
    (vacation, sick leave, training, etc.).
    """

    __tablename__ = "technician_availability"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    technician_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="CASCADE"),
        nullable=False,
    )

    start_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_available: Mapped[bool] = mapped_column(
        Boolean, default=True
    )  # True=available, False=unavailable
    reason: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # "vacation", "sick", "training"
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    technician = relationship("Technician", back_populates="availability_records")

    __table_args__ = (
        Index("ix_availability_tenant_tech", "tenant_id", "technician_id"),
        Index("ix_availability_dates", "start_datetime", "end_datetime"),
    )


class TechnicianLocationHistory(Base):
    """
    Technician Location History.

    GPS tracking history for technicians in the field.
    """

    __tablename__ = "technician_location_history"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    technician_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Location data
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy_meters: Mapped[float | None] = mapped_column(Float, nullable=True)
    altitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    heading: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Context
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    job_id: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Associated job
    activity: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "driving", "on_site", "returning"
    location_metadata = Column(
        "metadata", JSONBCompat, nullable=True
    )  # Renamed to avoid SQLAlchemy reserved word

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    technician = relationship("Technician", back_populates="location_history")

    __table_args__ = (
        Index("ix_location_tenant_tech", "tenant_id", "technician_id"),
        Index("ix_location_recorded", "recorded_at"),
        Index("ix_location_job", "job_id"),
    )
