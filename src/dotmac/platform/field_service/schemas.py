"""
Field Service Pydantic Schemas

Request/Response models for technician and location APIs.
"""

from datetime import datetime, time
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.field_service.models import TechnicianSkillLevel, TechnicianStatus


class TechnicianLocationUpdate(BaseModel):
    """Request model for updating technician location."""

    latitude: float = Field(..., ge=-90, le=90, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude coordinate")
    accuracy_meters: float | None = Field(None, description="GPS accuracy in meters")
    altitude: float | None = Field(None, description="Altitude in meters")
    speed_kmh: float | None = Field(None, description="Speed in km/h")
    heading: float | None = Field(None, ge=0, le=360, description="Heading in degrees")
    timestamp: datetime | None = Field(None, description="Timestamp when location was recorded")
    job_id: str | None = Field(None, description="Associated job ID")
    activity: str | None = Field(None, description="Current activity: driving, on_site, returning")
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")


class TechnicianLocationResponse(BaseModel):
    """Response model for technician location."""

    technician_id: UUID
    technician_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    last_update: datetime | None = None
    status: TechnicianStatus

    model_config = ConfigDict(from_attributes=True)


class TechnicianResponse(BaseModel):
    """Response model for technician details."""

    id: UUID
    tenant_id: str
    employee_id: str
    first_name: str
    last_name: str
    email: str
    phone: str | None = None
    mobile: str | None = None

    status: TechnicianStatus
    skill_level: TechnicianSkillLevel

    # Location
    home_base_lat: float | None = None
    home_base_lng: float | None = None
    home_base_address: str | None = None
    current_lat: float | None = None
    current_lng: float | None = None
    last_location_update: datetime | None = None
    service_areas: list[str] | None = None

    # Schedule
    working_hours_start: time | None = None
    working_hours_end: time | None = None
    working_days: list[int] | None = None
    is_on_call: bool = False
    available_for_emergency: bool = True

    # Skills and equipment
    skills: dict[str, bool] | None = None
    certifications: list[dict[str, Any]] | None = None
    equipment: dict[str, Any] | None = None

    # Performance
    jobs_completed: int = 0
    average_rating: float | None = None
    completion_rate: float | None = None

    # Metadata
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @property
    def full_name(self) -> str:
        """Get technician's full name."""
        return f"{self.first_name} {self.last_name}"


class TechnicianListResponse(BaseModel):
    """Response model for list of technicians."""

    technicians: list[TechnicianResponse]
    total: int
    limit: int
    offset: int
    page: int
    page_size: int
