"""
On-Call Schedule Schemas

Pydantic models for on-call schedule API request/response validation.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.fault_management.models import OnCallScheduleType


# ============================================================================
# On-Call Schedule Schemas
# ============================================================================


class OnCallScheduleCreate(BaseModel):
    """Request schema for creating an on-call schedule."""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    schedule_type: OnCallScheduleType = OnCallScheduleType.WEEKLY
    rotation_start: datetime
    rotation_duration_hours: int = Field(168, gt=0, le=720)  # 1 hour to 30 days
    alarm_severities: list[str] = Field(default_factory=list)
    team_name: str | None = Field(None, max_length=255)
    timezone: str = Field("UTC", max_length=100)
    metadata: dict[str, Any] = Field(default_factory=dict)


class OnCallScheduleUpdate(BaseModel):
    """Request schema for updating an on-call schedule."""

    model_config = ConfigDict()

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    schedule_type: OnCallScheduleType | None = None
    rotation_start: datetime | None = None
    rotation_duration_hours: int | None = Field(None, gt=0, le=720)
    alarm_severities: list[str] | None = None
    team_name: str | None = None
    timezone: str | None = None
    is_active: bool | None = None
    metadata: dict[str, Any] | None = None


class OnCallScheduleResponse(BaseModel):
    """Response schema for on-call schedule."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    name: str
    description: str | None
    schedule_type: OnCallScheduleType
    rotation_start: datetime
    rotation_duration_hours: int
    alarm_severities: list[str]
    team_name: str | None
    is_active: bool
    timezone: str
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime


# ============================================================================
# On-Call Rotation Schemas
# ============================================================================


class OnCallRotationCreate(BaseModel):
    """Request schema for creating an on-call rotation."""

    model_config = ConfigDict()

    schedule_id: UUID
    user_id: UUID
    start_time: datetime
    end_time: datetime
    is_override: bool = False
    override_reason: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class OnCallRotationUpdate(BaseModel):
    """Request schema for updating an on-call rotation."""

    model_config = ConfigDict()

    start_time: datetime | None = None
    end_time: datetime | None = None
    is_override: bool | None = None
    override_reason: str | None = None
    is_active: bool | None = None
    acknowledged: bool | None = None
    metadata: dict[str, Any] | None = None


class OnCallRotationResponse(BaseModel):
    """Response schema for on-call rotation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    schedule_id: UUID
    user_id: UUID
    start_time: datetime
    end_time: datetime
    is_override: bool
    override_reason: str | None
    is_active: bool
    acknowledged: bool
    metadata: dict[str, Any]
    created_at: datetime


# ============================================================================
# Query Schemas
# ============================================================================


class CurrentOnCallResponse(BaseModel):
    """Response schema for current on-call users."""

    model_config = ConfigDict()

    user_id: UUID
    user_email: str
    user_name: str
    schedule_id: UUID
    schedule_name: str
    rotation_id: UUID
    start_time: datetime
    end_time: datetime
    is_override: bool
