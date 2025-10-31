"""
Fiber Infrastructure Schemas

Pydantic schemas for fiber API requests and responses.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from .models import (
    CableInstallationType,
    DistributionPointType,
    FiberCableStatus,
    FiberHealthStatus,
    FiberType,
    ServiceAreaType,
    SpliceStatus,
)

# ============================================================================
# Fiber Cable Schemas
# ============================================================================


def _coerce_enum(value: Any, enum_cls: type[Enum], field_name: str) -> Enum | None:
    """Coerce incoming values (str/Enum) into the expected Enum type."""
    if value is None or isinstance(value, enum_cls):
        return value

    if isinstance(value, str):
        candidate = value.strip()
        try:
            return enum_cls[candidate.upper()]
        except KeyError:
            try:
                return enum_cls(candidate.lower())
            except ValueError as exc:
                raise ValueError(f"Invalid value for {field_name}: {value}") from exc

    raise ValueError(f"Invalid value for {field_name}: {value}")


class FiberCableCreate(BaseModel):
    """Create fiber cable request"""

    cable_id: str = Field(..., min_length=1, max_length=50)
    name: str | None = Field(None, max_length=200)
    fiber_type: FiberType
    fiber_count: int = Field(..., gt=0, description="Number of fiber strands in the cable")

    # Installation details
    installation_type: CableInstallationType | None = None
    start_site_id: str | None = Field(None, max_length=50)
    end_site_id: str | None = Field(None, max_length=50)
    length_km: float | None = Field(None, gt=0, description="Cable length in kilometers")
    route_geojson: dict[str, Any] | None = Field(
        None, description="GeoJSON LineString of cable route"
    )

    # Hardware
    manufacturer: str | None = Field(None, max_length=100)
    model: str | None = Field(None, max_length=100)
    installation_date: datetime | None = None
    warranty_expiry_date: datetime | None = None

    # Technical specs
    attenuation_db_per_km: float | None = Field(None, ge=0, description="Attenuation in dB/km")
    max_capacity: int | None = Field(None, gt=0, description="Maximum services supported")

    # Metadata
    notes: str | None = None

    @field_validator("fiber_type", mode="before")
    @classmethod
    def _normalize_fiber_type(cls, value: Any) -> FiberType:
        return _coerce_enum(value, FiberType, "fiber_type")  # type: ignore[return-value]

    @field_validator("installation_type", mode="before")
    @classmethod
    def _normalize_installation_type(cls, value: Any) -> CableInstallationType | None:
        coerced = _coerce_enum(value, CableInstallationType, "installation_type")
        return coerced  # type: ignore[return-value]


class FiberCableUpdate(BaseModel):
    """Update fiber cable request"""

    name: str | None = None
    status: FiberCableStatus | None = None
    installation_type: CableInstallationType | None = None
    start_site_id: str | None = None
    end_site_id: str | None = None
    length_km: float | None = Field(None, gt=0)
    route_geojson: dict[str, Any] | None = None

    manufacturer: str | None = None
    model: str | None = None
    installation_date: datetime | None = None
    warranty_expiry_date: datetime | None = None

    attenuation_db_per_km: float | None = Field(None, ge=0)
    max_capacity: int | None = Field(None, gt=0)

    notes: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def _normalize_status(cls, value: Any) -> FiberCableStatus | None:
        coerced = _coerce_enum(value, FiberCableStatus, "status")
        return coerced  # type: ignore[return-value]

    @field_validator("installation_type", mode="before")
    @classmethod
    def _normalize_installation_type(cls, value: Any) -> CableInstallationType | None:
        coerced = _coerce_enum(value, CableInstallationType, "installation_type")
        return coerced  # type: ignore[return-value]


class FiberCableResponse(BaseModel):
    """Fiber cable response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cable_id: str
    name: str | None
    fiber_type: FiberType
    fiber_count: int
    status: FiberCableStatus

    installation_type: CableInstallationType | None
    start_site_id: str | None
    end_site_id: str | None
    length_km: float | None
    route_geojson: dict[str, Any] | None

    manufacturer: str | None
    model: str | None
    installation_date: datetime | None
    warranty_expiry_date: datetime | None

    attenuation_db_per_km: float | None
    max_capacity: int | None

    notes: str | None

    # Audit fields
    created_at: datetime
    updated_at: datetime
    created_by: str | None
    updated_by: str | None
    tenant_id: str

    @field_serializer("fiber_type")
    def _serialize_fiber_type(self, value: FiberType) -> str:
        return value.name

    @field_serializer("status")
    def _serialize_status(self, value: FiberCableStatus) -> str:
        return value.name

    @field_serializer("installation_type")
    def _serialize_installation_type(self, value: CableInstallationType | None) -> str | None:
        return value.name if value is not None else None


# ============================================================================
# Distribution Point Schemas
# ============================================================================


class DistributionPointCreate(BaseModel):
    """Create distribution point request"""

    point_id: str = Field(..., min_length=1, max_length=50)
    point_type: DistributionPointType
    name: str | None = Field(None, max_length=200)

    # Location
    site_id: str | None = Field(None, max_length=50)
    location_geojson: dict[str, Any] | None = Field(None, description="GeoJSON Point of location")
    address: str | None = Field(None, max_length=500)

    # Capacity
    total_ports: int | None = Field(None, gt=0, description="Total available ports")
    used_ports: int = Field(0, ge=0, description="Number of ports in use")

    # Hardware
    manufacturer: str | None = Field(None, max_length=100)
    model: str | None = Field(None, max_length=100)
    installation_date: datetime | None = None

    # Metadata
    notes: str | None = None

    @field_validator("point_type", mode="before")
    @classmethod
    def _normalize_point_type(cls, value: Any) -> DistributionPointType:
        return _coerce_enum(value, DistributionPointType, "point_type")  # type: ignore[return-value]


class DistributionPointUpdate(BaseModel):
    """Update distribution point request"""

    name: str | None = None
    status: FiberCableStatus | None = None

    site_id: str | None = None
    location_geojson: dict[str, Any] | None = None
    address: str | None = None

    total_ports: int | None = Field(None, gt=0)
    used_ports: int | None = Field(None, ge=0)

    manufacturer: str | None = None
    model: str | None = None
    installation_date: datetime | None = None

    notes: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def _normalize_status(cls, value: Any) -> FiberCableStatus | None:
        coerced = _coerce_enum(value, FiberCableStatus, "status")
        return coerced  # type: ignore[return-value]


class DistributionPointResponse(BaseModel):
    """Distribution point response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    point_id: str
    point_type: DistributionPointType
    name: str | None
    status: FiberCableStatus

    site_id: str | None
    location_geojson: dict[str, Any] | None
    address: str | None

    total_ports: int | None
    used_ports: int

    manufacturer: str | None
    model: str | None
    installation_date: datetime | None

    notes: str | None

    created_at: datetime
    updated_at: datetime
    created_by: str | None
    updated_by: str | None
    tenant_id: str

    @field_serializer("point_type")
    def _serialize_point_type(self, value: DistributionPointType) -> str:
        return value.name

    @field_serializer("status")
    def _serialize_dp_status(self, value: FiberCableStatus) -> str:
        return value.name


class PortUtilizationResponse(BaseModel):
    """Port utilization statistics response"""

    point_id: str
    total_ports: int
    used_ports: int
    available_ports: int
    utilization_percentage: float
    is_full: bool
    is_near_capacity: bool


# ============================================================================
# Service Area Schemas
# ============================================================================


class ServiceAreaCreate(BaseModel):
    """Create service area request"""

    area_id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    area_type: ServiceAreaType

    # Coverage
    is_serviceable: bool = False
    coverage_geojson: dict[str, Any] | None = Field(
        None, description="GeoJSON Polygon of coverage area"
    )
    postal_codes: list[str] | None = None

    # Construction
    construction_status: str | None = Field(None, max_length=50)
    go_live_date: datetime | None = None

    # Statistics
    homes_passed: int = Field(0, ge=0)
    homes_connected: int = Field(0, ge=0)
    businesses_passed: int = Field(0, ge=0)
    businesses_connected: int = Field(0, ge=0)

    # Metadata
    notes: str | None = None

    @field_validator("area_type", mode="before")
    @classmethod
    def _normalize_area_type(cls, value: Any) -> ServiceAreaType:
        return _coerce_enum(value, ServiceAreaType, "area_type")  # type: ignore[return-value]


class ServiceAreaUpdate(BaseModel):
    """Update service area request"""

    name: str | None = None
    area_type: ServiceAreaType | None = None

    is_serviceable: bool | None = None
    coverage_geojson: dict[str, Any] | None = None
    postal_codes: list[str] | None = None

    construction_status: str | None = None
    go_live_date: datetime | None = None

    homes_passed: int | None = Field(None, ge=0)
    homes_connected: int | None = Field(None, ge=0)
    businesses_passed: int | None = Field(None, ge=0)
    businesses_connected: int | None = Field(None, ge=0)

    notes: str | None = None

    @field_validator("area_type", mode="before")
    @classmethod
    def _normalize_area_type(cls, value: Any) -> ServiceAreaType | None:
        coerced = _coerce_enum(value, ServiceAreaType, "area_type")
        return coerced  # type: ignore[return-value]


class ServiceAreaResponse(BaseModel):
    """Service area response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    area_id: str
    name: str
    area_type: ServiceAreaType

    is_serviceable: bool
    coverage_geojson: dict[str, Any] | None
    postal_codes: list[str] | None

    construction_status: str | None
    go_live_date: datetime | None

    homes_passed: int
    homes_connected: int
    businesses_passed: int
    businesses_connected: int

    notes: str | None

    created_at: datetime
    updated_at: datetime
    created_by: str | None
    updated_by: str | None
    tenant_id: str

    @field_serializer("area_type")
    def _serialize_area_type(self, value: ServiceAreaType) -> str:
        return value.name


class CoverageStatisticsResponse(BaseModel):
    """Coverage statistics response"""

    area_id: str
    area_name: str
    area_type: str
    is_serviceable: bool
    residential: dict[str, Any]
    commercial: dict[str, Any]
    total: dict[str, Any]


# ============================================================================
# Splice Point Schemas
# ============================================================================


class SplicePointCreate(BaseModel):
    """Create splice point request"""

    splice_id: str = Field(..., min_length=1, max_length=50)
    cable_id: UUID
    distribution_point_id: UUID | None = None

    # Type and location
    splice_type: str | None = Field(None, max_length=50)
    location_geojson: dict[str, Any] | None = Field(
        None, description="GeoJSON Point of splice location"
    )
    enclosure_type: str | None = Field(None, max_length=50)

    # Quality metrics
    insertion_loss_db: float | None = Field(None, ge=0)
    return_loss_db: float | None = Field(None, ge=0)
    last_test_date: datetime | None = None

    # Metadata
    notes: str | None = None


class SplicePointUpdate(BaseModel):
    """Update splice point request"""

    status: SpliceStatus | None = None
    distribution_point_id: UUID | None = None

    splice_type: str | None = None
    location_geojson: dict[str, Any] | None = None
    enclosure_type: str | None = None

    insertion_loss_db: float | None = Field(None, ge=0)
    return_loss_db: float | None = Field(None, ge=0)
    last_test_date: datetime | None = None

    notes: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def _normalize_status(cls, value: Any) -> SpliceStatus | None:
        coerced = _coerce_enum(value, SpliceStatus, "status")
        return coerced  # type: ignore[return-value]


class SplicePointResponse(BaseModel):
    """Splice point response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    splice_id: str
    cable_id: UUID
    distribution_point_id: UUID | None
    status: SpliceStatus

    splice_type: str | None
    location_geojson: dict[str, Any] | None
    enclosure_type: str | None

    insertion_loss_db: float | None
    return_loss_db: float | None
    last_test_date: datetime | None

    notes: str | None

    created_at: datetime
    updated_at: datetime
    created_by: str | None
    updated_by: str | None
    tenant_id: str

    @field_serializer("status")
    def _serialize_splice_status(self, value: SpliceStatus) -> str:
        return value.name


# ============================================================================
# Health Metric Schemas
# ============================================================================


class HealthMetricCreate(BaseModel):
    """Record health metric request"""

    cable_id: UUID
    health_status: FiberHealthStatus
    measured_at: datetime | None = None

    # Metrics
    health_score: float | None = Field(None, ge=0, le=100)
    total_loss_db: float | None = Field(None, ge=0)
    splice_loss_db: float | None = Field(None, ge=0)
    connector_loss_db: float | None = Field(None, ge=0)

    # Analysis
    detected_issues: list[dict[str, Any]] | None = None
    recommendations: list[str] | None = None

    @field_validator("health_status", mode="before")
    @classmethod
    def _normalize_health_status(cls, value: Any) -> FiberHealthStatus:
        return _coerce_enum(value, FiberHealthStatus, "health_status")  # type: ignore[return-value]


class HealthMetricResponse(BaseModel):
    """Health metric response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cable_id: UUID
    measured_at: datetime
    health_status: FiberHealthStatus

    health_score: float | None
    total_loss_db: float | None
    splice_loss_db: float | None
    connector_loss_db: float | None

    detected_issues: list[dict[str, Any]] | None
    recommendations: list[str] | None

    created_at: datetime
    created_by: str | None
    tenant_id: str

    @field_serializer("health_status")
    def _serialize_health_status(self, value: FiberHealthStatus) -> str:
        return value.name


# ============================================================================
# OTDR Test Result Schemas
# ============================================================================


class OTDRTestCreate(BaseModel):
    """Record OTDR test request"""

    cable_id: UUID
    strand_id: int = Field(..., gt=0, description="Strand number being tested")
    test_date: datetime | None = None

    # Test parameters
    wavelength_nm: int | None = Field(None, description="Test wavelength (e.g., 1310, 1550)")
    pulse_width_ns: int | None = Field(None, description="Pulse width in nanoseconds")

    # Test results
    total_loss_db: float | None = Field(None, ge=0)
    length_km: float | None = Field(None, ge=0)
    events_detected: int = Field(0, ge=0)
    events: list[dict[str, Any]] | None = Field(
        None, description="Detected splice/connector events"
    )

    # Test quality
    pass_fail: bool | None = None
    tester_id: str | None = Field(None, max_length=50)
    notes: str | None = None


class OTDRTestResponse(BaseModel):
    """OTDR test result response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cable_id: UUID
    strand_id: int
    test_date: datetime

    wavelength_nm: int | None
    pulse_width_ns: int | None

    total_loss_db: float | None
    length_km: float | None
    events_detected: int
    events: list[dict[str, Any]] | None

    pass_fail: bool | None
    tester_id: str | None
    notes: str | None

    created_at: datetime
    created_by: str | None
    tenant_id: str


# ============================================================================
# Analytics & Reporting Schemas
# ============================================================================


class NetworkHealthSummaryResponse(BaseModel):
    """Network health summary response"""

    total_cables: int
    cables_by_status: dict[str, int]
    health_by_status: dict[str, int]


class CapacityPlanningResponse(BaseModel):
    """Capacity planning data response"""

    total_distribution_points: int
    total_ports: int
    used_ports: int
    available_ports: int
    utilization_percentage: float
    points_near_capacity: int
    near_capacity_points: list[dict[str, Any]]


class CoverageSummaryResponse(BaseModel):
    """Coverage summary response"""

    total_service_areas: int
    serviceable_areas: int
    residential: dict[str, Any]
    commercial: dict[str, Any]
