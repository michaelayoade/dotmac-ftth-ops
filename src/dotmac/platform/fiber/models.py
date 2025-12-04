"""
Fiber Infrastructure Database Models.

Provides comprehensive database models for fiber optic network infrastructure management:
- Fiber cables with optical properties and route tracking
- Splice points with quality metrics
- Distribution points with capacity management
- Service areas with coverage and penetration tracking
- Health metrics for network monitoring
- OTDR test results for quality assurance

Created: 2025-10-19
"""

from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import (
    AuditMixin,
    Base,
    SoftDeleteMixin,
    TenantMixin,
    TimestampMixin,
)

if TYPE_CHECKING:
    pass  # For future type hints if needed


# ============================================================================
# Enums
# ============================================================================


class FiberCableStatus(str, Enum):
    """Fiber cable operational status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    UNDER_CONSTRUCTION = "under_construction"
    MAINTENANCE = "maintenance"
    DAMAGED = "damaged"
    RETIRED = "retired"


class FiberType(str, Enum):
    """Type of fiber optic cable."""

    SINGLE_MODE = "single_mode"
    MULTI_MODE = "multi_mode"


class CableInstallationType(str, Enum):
    """Method of cable installation."""

    AERIAL = "aerial"
    UNDERGROUND = "underground"
    DUCT = "duct"
    DIRECT_BURIAL = "direct_burial"


class SpliceStatus(str, Enum):
    """Splice point operational status."""

    ACTIVE = "active"
    DEGRADED = "degraded"
    FAILED = "failed"
    PENDING_TEST = "pending_test"


class DistributionPointType(str, Enum):
    """Type of distribution point."""

    FDH = "fdh"  # Fiber Distribution Hub
    FDT = "fdt"  # Fiber Distribution Terminal
    FAT = "fat"  # Fiber Access Terminal
    SPLITTER = "splitter"  # Optical Splitter
    PATCH_PANEL = "patch_panel"  # Patch Panel


class ServiceAreaType(str, Enum):
    """Type of service area."""

    RESIDENTIAL = "residential"
    COMMERCIAL = "commercial"
    INDUSTRIAL = "industrial"
    MIXED = "mixed"


class FiberHealthStatus(str, Enum):
    """Fiber health assessment status."""

    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    DEGRADED = "degraded"
    CRITICAL = "critical"


# ============================================================================
# Models
# ============================================================================


class FiberCable(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    Fiber optic cable model with comprehensive tracking.

    Tracks fiber cables with route information, optical properties,
    technical specifications, and operational status.
    """

    __tablename__ = "fiber_cables"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Cable identification
    cable_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Unique cable identifier for operations",
    )

    name: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Descriptive name for the cable",
    )

    # Fiber specifications
    fiber_type: Mapped[FiberType] = mapped_column(
        SQLEnum(FiberType),
        nullable=False,
        index=True,
        comment="Single-mode or multi-mode fiber",
    )

    fiber_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Number of fiber strands in the cable",
    )

    # Operational status
    status: Mapped[FiberCableStatus] = mapped_column(
        SQLEnum(FiberCableStatus),
        default=FiberCableStatus.ACTIVE,
        nullable=False,
        index=True,
        comment="Current operational status",
    )

    installation_type: Mapped[CableInstallationType | None] = mapped_column(
        SQLEnum(CableInstallationType),
        nullable=True,
        index=True,
        comment="Method of cable installation",
    )

    # Route information
    start_site_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Starting site/location identifier",
    )

    end_site_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Ending site/location identifier",
    )

    length_km: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Total cable length in kilometers",
    )

    route_geojson: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="GeoJSON LineString representing cable route",
    )

    # Technical specifications
    manufacturer: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Cable manufacturer",
    )

    model: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Cable model number",
    )

    installation_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date cable was installed",
    )

    warranty_expiry_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Warranty expiration date",
    )

    # Optical properties
    attenuation_db_per_km: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Attenuation in dB per kilometer",
    )

    max_capacity: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Maximum number of services supported",
    )

    # Additional information
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Additional notes and comments",
    )

    # Relationships
    splice_points: Mapped[list["SplicePoint"]] = relationship(
        "SplicePoint",
        back_populates="cable",
        cascade="all, delete-orphan",
    )

    health_metrics: Mapped[list["FiberHealthMetric"]] = relationship(
        "FiberHealthMetric",
        back_populates="cable",
        cascade="all, delete-orphan",
    )

    otdr_test_results: Mapped[list["OTDRTestResult"]] = relationship(
        "OTDRTestResult",
        back_populates="cable",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_fiber_cables_tenant_cable_id", "tenant_id", "cable_id", unique=True),
        Index("ix_fiber_cables_tenant_status", "tenant_id", "status"),
        Index("ix_fiber_cables_tenant_fiber_type", "tenant_id", "fiber_type"),
        Index("ix_fiber_cables_route", "start_site_id", "end_site_id"),
        CheckConstraint("fiber_count > 0", name="ck_fiber_cables_fiber_count_positive"),
        CheckConstraint(
            "length_km IS NULL OR length_km > 0", name="ck_fiber_cables_length_positive"
        ),
    )


class SplicePoint(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    Fiber splice point model with quality tracking.

    Tracks splice points along fiber cables with location information,
    quality metrics, and test results.
    """

    __tablename__ = "fiber_splice_points"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Splice identification
    splice_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Unique splice point identifier",
    )

    # Foreign keys
    cable_id: Mapped[UUID] = mapped_column(
        ForeignKey("fiber_cables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Reference to fiber cable",
    )

    distribution_point_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("fiber_distribution_points.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Reference to distribution point (if applicable)",
    )

    # Status
    status: Mapped[SpliceStatus] = mapped_column(
        SQLEnum(SpliceStatus),
        default=SpliceStatus.PENDING_TEST,
        nullable=False,
        index=True,
        comment="Splice quality status",
    )

    splice_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Type of splice (fusion, mechanical, etc.)",
    )

    # Location
    location_geojson: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="GeoJSON Point representing splice location",
    )

    enclosure_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Type of splice enclosure",
    )

    # Quality metrics
    insertion_loss_db: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Splice insertion loss in dB",
    )

    return_loss_db: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Splice return loss in dB",
    )

    last_test_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date of last quality test",
    )

    # Additional information
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Additional notes and comments",
    )

    # Relationships
    cable: Mapped["FiberCable"] = relationship(
        "FiberCable",
        back_populates="splice_points",
    )

    distribution_point: Mapped["DistributionPoint | None"] = relationship(
        "DistributionPoint",
        back_populates="splice_points",
    )

    __table_args__ = (
        Index("ix_fiber_splice_points_tenant_splice_id", "tenant_id", "splice_id", unique=True),
        Index("ix_fiber_splice_points_tenant_status", "tenant_id", "status"),
        Index("ix_fiber_splice_points_cable_status", "cable_id", "status"),
    )


class DistributionPoint(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    Fiber distribution point model with capacity tracking.

    Tracks distribution points (FDH, FDT, FAT, etc.) with location,
    capacity utilization, and connection management.
    """

    __tablename__ = "fiber_distribution_points"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Distribution point identification
    point_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Unique distribution point identifier",
    )

    point_type: Mapped[DistributionPointType] = mapped_column(
        SQLEnum(DistributionPointType),
        nullable=False,
        index=True,
        comment="Type of distribution point",
    )

    name: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Descriptive name for the distribution point",
    )

    # Status
    status: Mapped[FiberCableStatus] = mapped_column(
        SQLEnum(FiberCableStatus),
        default=FiberCableStatus.ACTIVE,
        nullable=False,
        index=True,
        comment="Operational status",
    )

    # Location
    site_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Site identifier where point is located",
    )

    location_geojson: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="GeoJSON Point representing distribution point location",
    )

    address: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Physical address",
    )

    # Capacity management
    total_ports: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Total number of ports/connections available",
    )

    used_ports: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of ports currently in use",
    )

    # Technical details
    manufacturer: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Equipment manufacturer",
    )

    model: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Equipment model number",
    )

    installation_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date equipment was installed",
    )

    # Additional information
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Additional notes and comments",
    )

    # Relationships
    splice_points: Mapped[list["SplicePoint"]] = relationship(
        "SplicePoint",
        back_populates="distribution_point",
    )

    __table_args__ = (
        Index("ix_fiber_distribution_points_tenant_point_id", "tenant_id", "point_id", unique=True),
        Index("ix_fiber_distribution_points_tenant_type", "tenant_id", "point_type"),
        Index("ix_fiber_distribution_points_tenant_status", "tenant_id", "status"),
        Index("ix_fiber_distribution_points_site", "site_id"),
        CheckConstraint(
            "total_ports IS NULL OR total_ports > 0",
            name="ck_distribution_points_total_ports_positive",
        ),
        CheckConstraint("used_ports >= 0", name="ck_distribution_points_used_ports_non_negative"),
        CheckConstraint(
            "total_ports IS NULL OR used_ports <= total_ports",
            name="ck_distribution_points_used_not_exceeds_total",
        ),
    )


class ServiceArea(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    Service area coverage model with penetration tracking.

    Tracks service areas with coverage boundaries, serviceability status,
    and homes/businesses passed and connected metrics.
    """

    __tablename__ = "fiber_service_areas"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Service area identification
    area_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Unique service area identifier",
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Service area name",
    )

    area_type: Mapped[ServiceAreaType] = mapped_column(
        SQLEnum(ServiceAreaType),
        nullable=False,
        index=True,
        comment="Type of area (residential, commercial, etc.)",
    )

    # Coverage
    coverage_geojson: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="GeoJSON Polygon representing coverage boundary",
    )

    postal_codes: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
        comment="List of postal codes covered",
    )

    # Status
    is_serviceable: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
        comment="Whether area is currently serviceable",
    )

    construction_status: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Construction phase (planned, under_construction, completed)",
    )

    go_live_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date area went live for service",
    )

    # Penetration metrics - Residential
    homes_passed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of homes passed by fiber",
    )

    homes_connected: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of homes with active connections",
    )

    # Penetration metrics - Commercial
    businesses_passed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of businesses passed by fiber",
    )

    businesses_connected: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of businesses with active connections",
    )

    # Additional information
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Additional notes and comments",
    )

    __table_args__ = (
        Index("ix_fiber_service_areas_tenant_area_id", "tenant_id", "area_id", unique=True),
        Index("ix_fiber_service_areas_tenant_type", "tenant_id", "area_type"),
        Index("ix_fiber_service_areas_serviceable", "is_serviceable"),
        Index("ix_fiber_service_areas_construction", "construction_status"),
        CheckConstraint("homes_passed >= 0", name="ck_service_areas_homes_passed_non_negative"),
        CheckConstraint(
            "homes_connected >= 0", name="ck_service_areas_homes_connected_non_negative"
        ),
        CheckConstraint(
            "homes_connected <= homes_passed",
            name="ck_service_areas_homes_connected_not_exceeds_passed",
        ),
        CheckConstraint(
            "businesses_passed >= 0", name="ck_service_areas_businesses_passed_non_negative"
        ),
        CheckConstraint(
            "businesses_connected >= 0", name="ck_service_areas_businesses_connected_non_negative"
        ),
        CheckConstraint(
            "businesses_connected <= businesses_passed",
            name="ck_service_areas_businesses_connected_not_exceeds_passed",
        ),
    )


class FiberHealthMetric(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    Fiber health monitoring metrics model.

    Stores periodic health assessments for fiber cables including
    optical performance, detected issues, and recommendations.
    """

    __tablename__ = "fiber_health_metrics"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Foreign key
    cable_id: Mapped[UUID] = mapped_column(
        ForeignKey("fiber_cables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Reference to fiber cable",
    )

    # Measurement timestamp
    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
        comment="When metrics were measured",
    )

    # Health assessment
    health_status: Mapped[FiberHealthStatus] = mapped_column(
        SQLEnum(FiberHealthStatus),
        nullable=False,
        index=True,
        comment="Overall health status",
    )

    health_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Numerical health score (0-100)",
    )

    # Optical metrics
    total_loss_db: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Total optical loss in dB",
    )

    splice_loss_db: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Total splice loss in dB",
    )

    connector_loss_db: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Total connector loss in dB",
    )

    # Issues and recommendations
    detected_issues: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
        comment="List of detected issues",
    )

    recommendations: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
        comment="List of recommendations",
    )

    # Relationship
    cable: Mapped["FiberCable"] = relationship(
        "FiberCable",
        back_populates="health_metrics",
    )

    __table_args__ = (
        Index("ix_fiber_health_metrics_cable_measured", "cable_id", "measured_at"),
        Index("ix_fiber_health_metrics_tenant_status", "tenant_id", "health_status"),
        CheckConstraint(
            "health_score IS NULL OR (health_score >= 0 AND health_score <= 100)",
            name="ck_health_metrics_score_range",
        ),
    )


class OTDRTestResult(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    OTDR (Optical Time Domain Reflectometer) test results model.

    Stores OTDR test data for fiber strands including test parameters,
    measurements, detected events, and pass/fail status.
    """

    __tablename__ = "fiber_otdr_test_results"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Foreign key
    cable_id: Mapped[UUID] = mapped_column(
        ForeignKey("fiber_cables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Reference to fiber cable",
    )

    # Test identification
    strand_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Strand number being tested",
    )

    test_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
        comment="When test was performed",
    )

    # Test parameters
    wavelength_nm: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Test wavelength in nanometers (e.g., 1310, 1550)",
    )

    pulse_width_ns: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Pulse width in nanoseconds",
    )

    # Test results
    total_loss_db: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Total measured loss in dB",
    )

    length_km: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        comment="Measured fiber length in kilometers",
    )

    events_detected: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of events detected",
    )

    # Event details
    events: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
        comment="List of splice/connector events with details",
    )

    # Test quality
    pass_fail: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
        comment="Whether test passed quality criteria",
    )

    tester_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Identifier of person who performed test",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Additional test notes",
    )

    # Relationship
    cable: Mapped["FiberCable"] = relationship(
        "FiberCable",
        back_populates="otdr_test_results",
    )

    __table_args__ = (
        Index("ix_fiber_otdr_test_results_cable_strand", "cable_id", "strand_id"),
        Index("ix_fiber_otdr_test_results_cable_test_date", "cable_id", "test_date"),
        Index("ix_fiber_otdr_test_results_tenant_pass_fail", "tenant_id", "pass_fail"),
        CheckConstraint("strand_id > 0", name="ck_otdr_test_results_strand_positive"),
        CheckConstraint("events_detected >= 0", name="ck_otdr_test_results_events_non_negative"),
    )
