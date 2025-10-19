"""
Wireless Infrastructure GraphQL Types

Defines GraphQL types for wireless network management including:
- Access Points (APs) with RF metrics and performance data
- Wireless Clients (connected devices)
- Coverage Zones (RF coverage mapping)
- RF Analytics (spectrum analysis)
- Wireless Dashboard (aggregated metrics)

Created: 2025-10-16
"""

from datetime import datetime
from enum import Enum

import strawberry

# ============================================================================
# Enums
# ============================================================================


@strawberry.enum
class AccessPointStatus(str, Enum):
    """Access Point operational status."""

    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    MAINTENANCE = "maintenance"
    PROVISIONING = "provisioning"
    REBOOTING = "rebooting"


@strawberry.enum
class FrequencyBand(str, Enum):
    """Wireless frequency bands."""

    BAND_2_4_GHZ = "2.4GHz"
    BAND_5_GHZ = "5GHz"
    BAND_6_GHZ = "6GHz"


@strawberry.enum
class WirelessSecurityType(str, Enum):
    """Wireless security protocol types."""

    OPEN = "open"
    WEP = "wep"
    WPA = "wpa"
    WPA2 = "wpa2"
    WPA3 = "wpa3"
    WPA2_WPA3 = "wpa2_wpa3"


@strawberry.enum
class ClientConnectionType(str, Enum):
    """Client device connection type."""

    WIFI_2_4 = "2.4GHz"
    WIFI_5 = "5GHz"
    WIFI_6 = "6GHz"
    WIFI_6E = "6E"


# SignalQuality is defined as a type (not enum) below in the RF Metrics section


# ============================================================================
# Location Types
# ============================================================================


@strawberry.type
class GeoLocation:
    """Geographic location coordinates."""

    latitude: float
    longitude: float
    altitude: float | None = None
    accuracy: float | None = None  # meters


@strawberry.type
class InstallationLocation:
    """Physical installation location details."""

    site_name: str
    building: str | None = None
    floor: str | None = None
    room: str | None = None
    mounting_type: str | None = None  # ceiling, wall, pole
    coordinates: GeoLocation | None = None


# ============================================================================
# RF Metrics Types
# ============================================================================


@strawberry.type
class RFMetrics:
    """Radio Frequency metrics and performance data."""

    signal_strength_dbm: float | None = None
    noise_floor_dbm: float | None = None
    signal_to_noise_ratio: float | None = None
    channel_utilization_percent: float | None = None
    interference_level: float | None = None
    tx_power_dbm: float | None = None
    rx_power_dbm: float | None = None


@strawberry.type
class SignalQuality:
    """Signal quality metrics for wireless connections."""

    rssi_dbm: float | None = None
    snr_db: float | None = None
    noise_floor_dbm: float | None = None
    signal_strength_percent: float | None = None
    link_quality_percent: float | None = None


@strawberry.type
class ChannelInfo:
    """Wireless channel information."""

    channel: int
    frequency_mhz: int
    bandwidth_mhz: int
    is_dfs_channel: bool
    utilization_percent: float | None = None


# ============================================================================
# Performance Metrics Types
# ============================================================================


@strawberry.type
class APPerformanceMetrics:
    """Access Point performance metrics."""

    # Traffic metrics
    tx_bytes: int
    rx_bytes: int
    tx_packets: int
    rx_packets: int
    tx_rate_mbps: float | None = None
    rx_rate_mbps: float | None = None

    # Error metrics
    tx_errors: int
    rx_errors: int
    tx_dropped: int
    rx_dropped: int
    retries: int
    retry_rate_percent: float | None = None

    # Client metrics
    connected_clients: int
    authenticated_clients: int
    authorized_clients: int

    # Capacity metrics
    cpu_usage_percent: float | None = None
    memory_usage_percent: float | None = None
    uptime_seconds: int | None = None


# ============================================================================
# Access Point Type
# ============================================================================


@strawberry.type
class AccessPoint:
    """Wireless Access Point entity."""

    # Identity
    id: strawberry.ID
    name: str
    mac_address: str
    ip_address: str | None = None
    serial_number: str | None = None

    # Status
    status: AccessPointStatus
    is_online: bool
    last_seen_at: datetime | None = None

    # Hardware information
    model: str | None = None
    manufacturer: str | None = None
    firmware_version: str | None = None
    hardware_revision: str | None = None

    # Wireless configuration
    ssid: str
    frequency_band: FrequencyBand
    channel: int
    channel_width: int  # MHz (20, 40, 80, 160)
    transmit_power: int  # dBm
    max_clients: int | None = None
    security_type: WirelessSecurityType

    # Location
    location: InstallationLocation | None = None

    # RF Metrics
    rf_metrics: RFMetrics | None = None

    # Performance
    performance: APPerformanceMetrics | None = None

    # Management
    controller_id: str | None = None
    controller_name: str | None = None
    site_id: str | None = None
    site_name: str | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime
    last_reboot_at: datetime | None = None

    # Configuration
    is_mesh_enabled: bool = False
    is_band_steering_enabled: bool = False
    is_load_balancing_enabled: bool = False


# ============================================================================
# Wireless Client Type
# ============================================================================


@strawberry.type
class WirelessClient:
    """Connected wireless client device."""

    # Identity
    id: strawberry.ID
    mac_address: str
    hostname: str | None = None
    ip_address: str | None = None
    manufacturer: str | None = None

    # Connection details
    access_point_id: str
    access_point_name: str
    ssid: str
    connection_type: ClientConnectionType
    frequency_band: FrequencyBand
    channel: int

    # Authentication
    is_authenticated: bool
    is_authorized: bool
    auth_method: str | None = None

    # Signal metrics
    signal_strength_dbm: float | None = None
    signal_quality: SignalQuality | None = None
    noise_floor_dbm: float | None = None
    snr: float | None = None

    # Performance
    tx_rate_mbps: float | None = None
    rx_rate_mbps: float | None = None
    tx_bytes: int = 0
    rx_bytes: int = 0
    tx_packets: int = 0
    rx_packets: int = 0
    tx_retries: int = 0
    rx_retries: int = 0

    # Connection info
    connected_at: datetime
    last_seen_at: datetime
    uptime_seconds: int
    idle_time_seconds: int | None = None

    # Device capabilities
    supports_80211k: bool = False
    supports_80211r: bool = False
    supports_80211v: bool = False
    max_phy_rate_mbps: float | None = None

    # Customer association
    customer_id: str | None = None
    customer_name: str | None = None


# ============================================================================
# Coverage Zone Type
# ============================================================================


@strawberry.type
class CoverageZone:
    """RF coverage zone mapping."""

    # Identity
    id: strawberry.ID
    name: str
    description: str | None = None

    # Geographic area
    site_id: str
    site_name: str
    floor: str | None = None
    area_type: str  # indoor, outdoor, mixed

    # Coverage metrics
    coverage_area_sqm: float | None = None
    signal_strength_min_dbm: float | None = None
    signal_strength_max_dbm: float | None = None
    signal_strength_avg_dbm: float | None = None

    # Access points in zone
    access_point_ids: list[str]
    access_point_count: int

    # RF quality
    interference_level: float | None = None
    channel_utilization_avg: float | None = None
    noise_floor_avg_dbm: float | None = None

    # Client metrics
    connected_clients: int
    max_client_capacity: int
    client_density_per_ap: float | None = None

    # GeoJSON polygon
    coverage_polygon: str | None = None  # GeoJSON polygon string

    # Timestamps
    created_at: datetime
    updated_at: datetime
    last_surveyed_at: datetime | None = None


# ============================================================================
# RF Analytics Type
# ============================================================================


@strawberry.type
class ChannelUtilization:
    """Channel utilization data."""

    channel: int
    frequency_mhz: int
    band: FrequencyBand
    utilization_percent: float
    interference_level: float
    access_points_count: int


@strawberry.type
class InterferenceSource:
    """RF interference source."""

    source_type: str  # bluetooth, microwave, radar, other_wifi
    frequency_mhz: int
    strength_dbm: float
    affected_channels: list[int]


@strawberry.type
class RFAnalytics:
    """Wireless RF spectrum analytics."""

    # Site context
    site_id: str
    site_name: str
    analysis_timestamp: datetime

    # Channel analysis
    channel_utilization_2_4ghz: list[ChannelUtilization]
    channel_utilization_5ghz: list[ChannelUtilization]
    channel_utilization_6ghz: list[ChannelUtilization]

    # Recommended channels
    recommended_channels_2_4ghz: list[int]
    recommended_channels_5ghz: list[int]
    recommended_channels_6ghz: list[int]

    # Interference
    interference_sources: list[InterferenceSource]
    total_interference_score: float  # 0-100, higher is worse

    # Coverage quality
    average_signal_strength_dbm: float
    average_snr: float
    coverage_quality_score: float  # 0-100, higher is better

    # Client distribution
    clients_per_band_2_4ghz: int
    clients_per_band_5ghz: int
    clients_per_band_6ghz: int
    band_utilization_balance_score: float  # 0-100, higher is better


# ============================================================================
# Dashboard/Aggregated Types
# ============================================================================


@strawberry.type
class WirelessSiteMetrics:
    """Aggregated wireless metrics for a site."""

    site_id: str
    site_name: str

    # Access Points
    total_aps: int
    online_aps: int
    offline_aps: int
    degraded_aps: int

    # Clients
    total_clients: int
    clients_2_4ghz: int
    clients_5ghz: int
    clients_6ghz: int

    # Performance
    average_signal_strength_dbm: float | None = None
    average_snr: float | None = None
    total_throughput_mbps: float | None = None

    # Capacity
    total_capacity: int
    capacity_utilization_percent: float | None = None

    # Health scores
    overall_health_score: float  # 0-100
    rf_health_score: float  # 0-100
    client_experience_score: float  # 0-100


@strawberry.type
class WirelessDashboard:
    """Complete wireless network dashboard data."""

    # Overview
    total_sites: int
    total_access_points: int
    total_clients: int
    total_coverage_zones: int

    # Status distribution
    online_aps: int
    offline_aps: int
    degraded_aps: int

    # Client distribution
    clients_by_band_2_4ghz: int
    clients_by_band_5ghz: int
    clients_by_band_6ghz: int

    # Top performers
    top_aps_by_clients: list[AccessPoint]
    top_aps_by_throughput: list[AccessPoint]
    sites_with_issues: list[WirelessSiteMetrics]

    # Aggregate metrics
    total_throughput_mbps: float
    average_signal_strength_dbm: float
    average_client_experience_score: float

    # Trends (last 24 hours)
    client_count_trend: list[int]  # hourly
    throughput_trend_mbps: list[float]  # hourly
    offline_events_count: int

    # Timestamps
    generated_at: datetime


# ============================================================================
# Pagination Types
# ============================================================================


@strawberry.type
class AccessPointConnection:
    """Paginated access points result."""

    access_points: list[AccessPoint]
    total_count: int
    has_next_page: bool


@strawberry.type
class WirelessClientConnection:
    """Paginated wireless clients result."""

    clients: list[WirelessClient]
    total_count: int
    has_next_page: bool


@strawberry.type
class CoverageZoneConnection:
    """Paginated coverage zones result."""

    zones: list[CoverageZone]
    total_count: int
    has_next_page: bool
