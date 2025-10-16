"""
Fiber Infrastructure GraphQL Types

Defines GraphQL types for fiber optic network management including:
- Fiber Cables (routes, strands, capacity)
- Splice Points (fusion/mechanical splices)
- Distribution Points (cabinets, closures, poles)
- Service Areas (coverage mapping)
- Fiber Analytics (loss, attenuation, health)

Created: 2025-10-16
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

import strawberry


# ============================================================================
# Enums
# ============================================================================


@strawberry.enum
class FiberCableStatus(Enum):
    """Fiber cable operational status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    UNDER_CONSTRUCTION = "under_construction"
    MAINTENANCE = "maintenance"
    DAMAGED = "damaged"
    DECOMMISSIONED = "decommissioned"


@strawberry.enum
class FiberType(Enum):
    """Fiber optic cable type."""

    SINGLE_MODE = "single_mode"
    MULTI_MODE = "multi_mode"
    HYBRID = "hybrid"


@strawberry.enum
class CableInstallationType(Enum):
    """Installation method for fiber cable."""

    AERIAL = "aerial"
    UNDERGROUND = "underground"
    BURIED = "buried"
    DUCT = "duct"
    BUILDING = "building"
    SUBMARINE = "submarine"


@strawberry.enum
class SpliceType(Enum):
    """Type of fiber splice."""

    FUSION = "fusion"
    MECHANICAL = "mechanical"


@strawberry.enum
class SpliceStatus(Enum):
    """Splice point operational status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    DEGRADED = "degraded"
    FAILED = "failed"


@strawberry.enum
class DistributionPointType(Enum):
    """Type of distribution point equipment."""

    CABINET = "cabinet"
    CLOSURE = "closure"
    POLE = "pole"
    MANHOLE = "manhole"
    HANDHOLE = "handhole"
    BUILDING_ENTRY = "building_entry"
    PEDESTAL = "pedestal"


@strawberry.enum
class ServiceAreaType(Enum):
    """Type of service area coverage."""

    RESIDENTIAL = "residential"
    COMMERCIAL = "commercial"
    INDUSTRIAL = "industrial"
    MIXED = "mixed"


@strawberry.enum
class FiberHealthStatus(Enum):
    """Overall fiber health status."""

    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    CRITICAL = "critical"


# ============================================================================
# Location Types (Shared with Wireless)
# ============================================================================


@strawberry.type
class GeoCoordinate:
    """Geographic coordinate point."""

    latitude: float
    longitude: float
    altitude: Optional[float] = None


@strawberry.type
class Address:
    """Physical address."""

    street_address: str
    city: str
    state_province: str
    postal_code: str
    country: str


# ============================================================================
# Fiber Cable Types
# ============================================================================


@strawberry.type
class FiberStrand:
    """Individual fiber strand within a cable."""

    strand_id: int
    color_code: Optional[str] = None
    is_active: bool
    is_available: bool
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    service_id: Optional[str] = None

    # Optical metrics
    attenuation_db: Optional[float] = None
    loss_db: Optional[float] = None

    # Splice points on this strand
    splice_count: int


@strawberry.type
class CableRoute:
    """Geographic route of fiber cable."""

    # Route geometry
    path_geojson: str  # GeoJSON LineString
    total_distance_meters: float

    # Waypoints
    start_point: GeoCoordinate
    end_point: GeoCoordinate
    intermediate_points: list[GeoCoordinate]

    # Route characteristics
    elevation_change_meters: Optional[float] = None
    underground_distance_meters: Optional[float] = None
    aerial_distance_meters: Optional[float] = None


@strawberry.type
class FiberCable:
    """Fiber optic cable entity."""

    # Identity
    id: strawberry.ID
    cable_id: str  # External/label ID
    name: str
    description: Optional[str] = None

    # Status
    status: FiberCableStatus
    is_active: bool

    # Cable specifications
    fiber_type: FiberType
    total_strands: int
    available_strands: int
    used_strands: int
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    installation_type: CableInstallationType

    # Route
    route: CableRoute
    length_meters: float

    # Strands
    strands: list[FiberStrand]

    # Connection points
    start_distribution_point_id: str
    end_distribution_point_id: str
    start_point_name: Optional[str] = None
    end_point_name: Optional[str] = None

    # Capacity metrics
    capacity_utilization_percent: float
    bandwidth_capacity_gbps: Optional[float] = None

    # Splice information
    splice_point_ids: list[str]
    splice_count: int

    # Optical metrics (aggregate)
    total_loss_db: Optional[float] = None
    average_attenuation_db_per_km: Optional[float] = None
    max_attenuation_db_per_km: Optional[float] = None

    # Physical characteristics
    conduit_id: Optional[str] = None
    duct_number: Optional[int] = None
    armored: bool = False
    fire_rated: bool = False

    # Ownership/management
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None
    is_leased: bool = False

    # Timestamps
    installed_at: Optional[datetime] = None
    tested_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Splice Point Types
# ============================================================================


@strawberry.type
class SpliceConnection:
    """Individual splice connection between fibers."""

    # Connected strands
    cable_a_id: str
    cable_a_strand: int
    cable_b_id: str
    cable_b_strand: int

    # Splice details
    splice_type: SpliceType
    loss_db: Optional[float] = None
    reflectance_db: Optional[float] = None

    # Quality metrics
    is_passing: bool
    test_result: Optional[str] = None
    tested_at: Optional[datetime] = None
    tested_by: Optional[str] = None


@strawberry.type
class SplicePoint:
    """Fiber splice point/closure."""

    # Identity
    id: strawberry.ID
    splice_id: str
    name: str
    description: Optional[str] = None

    # Status
    status: SpliceStatus
    is_active: bool

    # Location
    location: GeoCoordinate
    address: Optional[Address] = None
    distribution_point_id: Optional[str] = None

    # Equipment
    closure_type: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    tray_count: int
    tray_capacity: int

    # Connections
    cables_connected: list[str]  # Cable IDs
    cable_count: int
    splice_connections: list[SpliceConnection]
    total_splices: int
    active_splices: int

    # Quality metrics
    average_splice_loss_db: Optional[float] = None
    max_splice_loss_db: Optional[float] = None
    passing_splices: int
    failing_splices: int

    # Accessibility
    access_type: str  # indoor, outdoor, underground
    requires_special_access: bool
    access_notes: Optional[str] = None

    # Timestamps
    installed_at: Optional[datetime] = None
    last_tested_at: Optional[datetime] = None
    last_maintained_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Distribution Point Types
# ============================================================================


@strawberry.type
class PortAllocation:
    """Port allocation in distribution equipment."""

    port_number: int
    is_allocated: bool
    is_active: bool
    cable_id: Optional[str] = None
    strand_id: Optional[int] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    service_id: Optional[str] = None


@strawberry.type
class DistributionPoint:
    """Fiber distribution point (cabinet, closure, pole, etc.)."""

    # Identity
    id: strawberry.ID
    site_id: str
    name: str
    description: Optional[str] = None

    # Type and status
    point_type: DistributionPointType
    status: FiberCableStatus
    is_active: bool

    # Location
    location: GeoCoordinate
    address: Optional[Address] = None
    site_name: Optional[str] = None

    # Equipment specifications
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    total_capacity: int
    available_capacity: int
    used_capacity: int

    # Ports
    ports: list[PortAllocation]
    port_count: int

    # Connected infrastructure
    incoming_cables: list[str]  # Cable IDs
    outgoing_cables: list[str]  # Cable IDs
    total_cables_connected: int

    # Splice points at this location
    splice_points: list[str]  # Splice point IDs
    splice_point_count: int

    # Power and environmental
    has_power: bool
    battery_backup: bool
    environmental_monitoring: bool
    temperature_celsius: Optional[float] = None
    humidity_percent: Optional[float] = None

    # Capacity metrics
    capacity_utilization_percent: float
    fiber_strand_count: int
    available_strand_count: int

    # Service area
    service_area_ids: list[str]
    serves_customer_count: int

    # Accessibility
    access_type: str  # 24/7, business_hours, restricted
    requires_key: bool
    security_level: Optional[str] = None
    access_notes: Optional[str] = None

    # Timestamps
    installed_at: Optional[datetime] = None
    last_inspected_at: Optional[datetime] = None
    last_maintained_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Service Area Types
# ============================================================================


@strawberry.type
class ServiceArea:
    """Fiber service coverage area."""

    # Identity
    id: strawberry.ID
    area_id: str
    name: str
    description: Optional[str] = None

    # Area type and status
    area_type: ServiceAreaType
    is_active: bool
    is_serviceable: bool

    # Geographic coverage
    boundary_geojson: str  # GeoJSON Polygon
    area_sqkm: float

    # Address coverage
    city: str
    state_province: str
    postal_codes: list[str]
    street_count: int

    # Coverage metrics
    homes_passed: int
    homes_connected: int
    businesses_passed: int
    businesses_connected: int
    penetration_rate_percent: Optional[float] = None

    # Infrastructure
    distribution_point_ids: list[str]
    distribution_point_count: int
    total_fiber_km: float

    # Capacity
    total_capacity: int
    used_capacity: int
    available_capacity: int
    capacity_utilization_percent: float

    # Service details
    max_bandwidth_gbps: float
    average_distance_to_distribution_meters: Optional[float] = None

    # Demographics
    estimated_population: Optional[int] = None
    household_density_per_sqkm: Optional[float] = None

    # Build status
    construction_status: str  # planned, in_progress, completed
    construction_complete_percent: Optional[float] = None
    target_completion_date: Optional[datetime] = None

    # Timestamps
    planned_at: Optional[datetime] = None
    construction_started_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Fiber Analytics Types
# ============================================================================


@strawberry.type
class OTDRTestResult:
    """OTDR (Optical Time Domain Reflectometer) test result."""

    test_id: str
    cable_id: str
    strand_id: int

    # Test parameters
    tested_at: datetime
    tested_by: str
    wavelength_nm: int  # 1310, 1550, etc.
    pulse_width_ns: int

    # Results
    total_loss_db: float
    total_length_meters: float
    average_attenuation_db_per_km: float

    # Events detected
    splice_count: int
    connector_count: int
    bend_count: int
    break_count: int

    # Quality assessment
    is_passing: bool
    pass_threshold_db: float
    margin_db: Optional[float] = None

    # File reference
    trace_file_url: Optional[str] = None


@strawberry.type
class FiberHealthMetrics:
    """Fiber optic health metrics."""

    cable_id: str
    cable_name: str

    # Health status
    health_status: FiberHealthStatus
    health_score: float  # 0-100

    # Optical metrics
    total_loss_db: float
    average_loss_per_km_db: float
    max_loss_per_km_db: float
    reflectance_db: Optional[float] = None

    # Splice quality
    average_splice_loss_db: Optional[float] = None
    max_splice_loss_db: Optional[float] = None
    failing_splices_count: int

    # Capacity
    total_strands: int
    active_strands: int
    degraded_strands: int
    failed_strands: int

    # Test history
    last_tested_at: Optional[datetime] = None
    test_pass_rate_percent: Optional[float] = None
    days_since_last_test: Optional[int] = None

    # Issues
    active_alarms: int
    warning_count: int
    requires_maintenance: bool


@strawberry.type
class FiberNetworkAnalytics:
    """Aggregated fiber network analytics."""

    # Network overview
    total_fiber_km: float
    total_cables: int
    total_strands: int
    total_distribution_points: int
    total_splice_points: int

    # Capacity metrics
    total_capacity: int
    used_capacity: int
    available_capacity: int
    capacity_utilization_percent: float

    # Health metrics
    healthy_cables: int
    degraded_cables: int
    failed_cables: int
    network_health_score: float  # 0-100

    # Coverage
    total_service_areas: int
    active_service_areas: int
    homes_passed: int
    homes_connected: int
    penetration_rate_percent: float

    # Quality metrics
    average_cable_loss_db_per_km: float
    average_splice_loss_db: float
    cables_due_for_testing: int

    # Status distribution
    cables_active: int
    cables_inactive: int
    cables_under_construction: int
    cables_maintenance: int

    # Top issues
    cables_with_high_loss: list[str]
    distribution_points_near_capacity: list[str]
    service_areas_needs_expansion: list[str]

    # Timestamp
    generated_at: datetime


@strawberry.type
class FiberDashboard:
    """Complete fiber network dashboard data."""

    # Overview metrics
    analytics: FiberNetworkAnalytics

    # Top performing infrastructure
    top_cables_by_utilization: list[FiberCable]
    top_distribution_points_by_capacity: list[DistributionPoint]
    top_service_areas_by_penetration: list[ServiceArea]

    # Health monitoring
    cables_requiring_attention: list[FiberHealthMetrics]
    recent_test_results: list[OTDRTestResult]

    # Capacity planning
    distribution_points_near_capacity: list[DistributionPoint]
    service_areas_expansion_candidates: list[ServiceArea]

    # Trends (last 30 days)
    new_connections_trend: list[int]  # daily
    capacity_utilization_trend: list[float]  # daily
    network_health_trend: list[float]  # daily

    # Timestamps
    generated_at: datetime


# ============================================================================
# Pagination Types
# ============================================================================


@strawberry.type
class FiberCableConnection:
    """Paginated fiber cables result."""

    cables: list[FiberCable]
    total_count: int
    has_next_page: bool


@strawberry.type
class SplicePointConnection:
    """Paginated splice points result."""

    splice_points: list[SplicePoint]
    total_count: int
    has_next_page: bool


@strawberry.type
class DistributionPointConnection:
    """Paginated distribution points result."""

    distribution_points: list[DistributionPoint]
    total_count: int
    has_next_page: bool


@strawberry.type
class ServiceAreaConnection:
    """Paginated service areas result."""

    service_areas: list[ServiceArea]
    total_count: int
    has_next_page: bool
