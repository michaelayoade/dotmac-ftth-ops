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

import strawberry

# ============================================================================
# Enums
# ============================================================================


@strawberry.enum
class FiberCableStatus(str, Enum):
    """Fiber cable operational status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    UNDER_CONSTRUCTION = "under_construction"
    MAINTENANCE = "maintenance"
    DAMAGED = "damaged"
    DECOMMISSIONED = "decommissioned"


@strawberry.enum
class FiberType(str, Enum):
    """Fiber optic cable type."""

    SINGLE_MODE = "single_mode"
    MULTI_MODE = "multi_mode"
    HYBRID = "hybrid"


@strawberry.enum
class CableInstallationType(str, Enum):
    """Installation method for fiber cable."""

    AERIAL = "aerial"
    UNDERGROUND = "underground"
    BURIED = "buried"
    DUCT = "duct"
    BUILDING = "building"
    SUBMARINE = "submarine"


@strawberry.enum
class SpliceType(str, Enum):
    """Type of fiber splice."""

    FUSION = "fusion"
    MECHANICAL = "mechanical"


@strawberry.enum
class SpliceStatus(str, Enum):
    """Splice point operational status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    DEGRADED = "degraded"
    FAILED = "failed"


@strawberry.enum
class DistributionPointType(str, Enum):
    """Type of distribution point equipment."""

    CABINET = "cabinet"
    CLOSURE = "closure"
    POLE = "pole"
    MANHOLE = "manhole"
    HANDHOLE = "handhole"
    BUILDING_ENTRY = "building_entry"
    PEDESTAL = "pedestal"


@strawberry.enum
class ServiceAreaType(str, Enum):
    """Type of service area coverage."""

    RESIDENTIAL = "residential"
    COMMERCIAL = "commercial"
    INDUSTRIAL = "industrial"
    MIXED = "mixed"


@strawberry.enum
class FiberHealthStatus(str, Enum):
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
    altitude: float | None = None


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
    color_code: str | None = None
    is_active: bool
    is_available: bool
    customer_id: str | None = None
    customer_name: str | None = None
    service_id: str | None = None

    # Optical metrics
    attenuation_db: float | None = None
    loss_db: float | None = None

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
    elevation_change_meters: float | None = None
    underground_distance_meters: float | None = None
    aerial_distance_meters: float | None = None


@strawberry.type
class FiberCable:
    """Fiber optic cable entity."""

    # Identity
    id: strawberry.ID
    cable_id: str  # External/label ID
    name: str
    description: str | None = None

    # Status
    status: FiberCableStatus
    is_active: bool

    # Cable specifications
    fiber_type: FiberType
    total_strands: int
    available_strands: int
    used_strands: int
    manufacturer: str | None = None
    model: str | None = None
    installation_type: CableInstallationType

    # Route
    route: CableRoute
    length_meters: float

    # Strands
    strands: list[FiberStrand]

    # Connection points
    start_distribution_point_id: str
    end_distribution_point_id: str
    start_point_name: str | None = None
    end_point_name: str | None = None

    # Capacity metrics
    capacity_utilization_percent: float
    bandwidth_capacity_gbps: float | None = None

    # Splice information
    splice_point_ids: list[str]
    splice_count: int

    # Optical metrics (aggregate)
    total_loss_db: float | None = None
    average_attenuation_db_per_km: float | None = None
    max_attenuation_db_per_km: float | None = None

    # Physical characteristics
    conduit_id: str | None = None
    duct_number: int | None = None
    armored: bool = False
    fire_rated: bool = False

    # Ownership/management
    owner_id: str | None = None
    owner_name: str | None = None
    is_leased: bool = False

    # Timestamps
    installed_at: datetime | None = None
    tested_at: datetime | None = None
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
    loss_db: float | None = None
    reflectance_db: float | None = None

    # Quality metrics
    is_passing: bool
    test_result: str | None = None
    tested_at: datetime | None = None
    tested_by: str | None = None


@strawberry.type
class SplicePoint:
    """Fiber splice point/closure."""

    # Identity
    id: strawberry.ID
    splice_id: str
    name: str
    description: str | None = None

    # Status
    status: SpliceStatus
    is_active: bool

    # Location
    location: GeoCoordinate
    address: Address | None = None
    distribution_point_id: str | None = None

    # Equipment
    closure_type: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    tray_count: int
    tray_capacity: int

    # Connections
    cables_connected: list[str]  # Cable IDs
    cable_count: int
    splice_connections: list[SpliceConnection]
    total_splices: int
    active_splices: int

    # Quality metrics
    average_splice_loss_db: float | None = None
    max_splice_loss_db: float | None = None
    passing_splices: int
    failing_splices: int

    # Accessibility
    access_type: str  # indoor, outdoor, underground
    requires_special_access: bool
    access_notes: str | None = None

    # Timestamps
    installed_at: datetime | None = None
    last_tested_at: datetime | None = None
    last_maintained_at: datetime | None = None
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
    cable_id: str | None = None
    strand_id: int | None = None
    customer_id: str | None = None
    customer_name: str | None = None
    service_id: str | None = None


@strawberry.type
class DistributionPoint:
    """Fiber distribution point (cabinet, closure, pole, etc.)."""

    # Identity
    id: strawberry.ID
    site_id: str
    name: str
    description: str | None = None

    # Type and status
    point_type: DistributionPointType
    status: FiberCableStatus
    is_active: bool

    # Location
    location: GeoCoordinate
    address: Address | None = None
    site_name: str | None = None

    # Equipment specifications
    manufacturer: str | None = None
    model: str | None = None
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
    temperature_celsius: float | None = None
    humidity_percent: float | None = None

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
    security_level: str | None = None
    access_notes: str | None = None

    # Timestamps
    installed_at: datetime | None = None
    last_inspected_at: datetime | None = None
    last_maintained_at: datetime | None = None
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
    description: str | None = None

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
    penetration_rate_percent: float | None = None

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
    average_distance_to_distribution_meters: float | None = None

    # Demographics
    estimated_population: int | None = None
    household_density_per_sqkm: float | None = None

    # Build status
    construction_status: str  # planned, in_progress, completed
    construction_complete_percent: float | None = None
    target_completion_date: datetime | None = None

    # Timestamps
    planned_at: datetime | None = None
    construction_started_at: datetime | None = None
    activated_at: datetime | None = None
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
    margin_db: float | None = None

    # File reference
    trace_file_url: str | None = None


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
    reflectance_db: float | None = None

    # Splice quality
    average_splice_loss_db: float | None = None
    max_splice_loss_db: float | None = None
    failing_splices_count: int

    # Capacity
    total_strands: int
    active_strands: int
    degraded_strands: int
    failed_strands: int

    # Test history
    last_tested_at: datetime | None = None
    test_pass_rate_percent: float | None = None
    days_since_last_test: int | None = None

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
