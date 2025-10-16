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
from typing import Any, Optional

import strawberry


# ============================================================================
# Enums
# ============================================================================


@strawberry.enum
class AccessPointStatus(Enum):
    """Access Point operational status."""

    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    MAINTENANCE = "maintenance"
    PROVISIONING = "provisioning"
    REBOOTING = "rebooting"


@strawberry.enum
class FrequencyBand(Enum):
    """Wireless frequency bands."""

    BAND_2_4_GHZ = "2.4GHz"
    BAND_5_GHZ = "5GHz"
    BAND_6_GHZ = "6GHz"


@strawberry.enum
class WirelessSecurityType(Enum):
    """Wireless security protocol types."""

    OPEN = "open"
    WEP = "wep"
    WPA = "wpa"
    WPA2 = "wpa2"
    WPA3 = "wpa3"
    WPA2_WPA3 = "wpa2_wpa3"


@strawberry.enum
class ClientConnectionType(Enum):
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
    altitude: Optional[float] = None
    accuracy: Optional[float] = None  # meters


@strawberry.type
class InstallationLocation:
    """Physical installation location details."""

    site_name: str
    building: Optional[str] = None
    floor: Optional[str] = None
    room: Optional[str] = None
    mounting_type: Optional[str] = None  # ceiling, wall, pole
    coordinates: Optional[GeoLocation] = None


# ============================================================================
# RF Metrics Types
# ============================================================================


@strawberry.type
class RFMetrics:
    """Radio Frequency metrics and performance data."""

    signal_strength_dbm: Optional[float] = None
    noise_floor_dbm: Optional[float] = None
    signal_to_noise_ratio: Optional[float] = None
    channel_utilization_percent: Optional[float] = None
    interference_level: Optional[float] = None
    tx_power_dbm: Optional[float] = None
    rx_power_dbm: Optional[float] = None


@strawberry.type
class SignalQuality:
    """Signal quality metrics for wireless connections."""

    rssi_dbm: Optional[float] = None
    snr_db: Optional[float] = None
    noise_floor_dbm: Optional[float] = None
    signal_strength_percent: Optional[float] = None
    link_quality_percent: Optional[float] = None


@strawberry.type
class ChannelInfo:
    """Wireless channel information."""

    channel: int
    frequency_mhz: int
    bandwidth_mhz: int
    is_dfs_channel: bool
    utilization_percent: Optional[float] = None


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
    tx_rate_mbps: Optional[float] = None
    rx_rate_mbps: Optional[float] = None

    # Error metrics
    tx_errors: int
    rx_errors: int
    tx_dropped: int
    rx_dropped: int
    retries: int
    retry_rate_percent: Optional[float] = None

    # Client metrics
    connected_clients: int
    authenticated_clients: int
    authorized_clients: int

    # Capacity metrics
    cpu_usage_percent: Optional[float] = None
    memory_usage_percent: Optional[float] = None
    uptime_seconds: Optional[int] = None


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
    ip_address: Optional[str] = None
    serial_number: Optional[str] = None

    # Status
    status: AccessPointStatus
    is_online: bool
    last_seen_at: Optional[datetime] = None

    # Hardware information
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    firmware_version: Optional[str] = None
    hardware_revision: Optional[str] = None

    # Wireless configuration
    ssid: str
    frequency_band: FrequencyBand
    channel: int
    channel_width: int  # MHz (20, 40, 80, 160)
    transmit_power: int  # dBm
    max_clients: Optional[int] = None
    security_type: WirelessSecurityType

    # Location
    location: Optional[InstallationLocation] = None

    # RF Metrics
    rf_metrics: Optional[RFMetrics] = None

    # Performance
    performance: Optional[APPerformanceMetrics] = None

    # Management
    controller_id: Optional[str] = None
    controller_name: Optional[str] = None
    site_id: Optional[str] = None
    site_name: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: datetime
    last_reboot_at: Optional[datetime] = None

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
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    manufacturer: Optional[str] = None

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
    auth_method: Optional[str] = None

    # Signal metrics
    signal_strength_dbm: Optional[float] = None
    signal_quality: Optional[SignalQuality] = None
    noise_floor_dbm: Optional[float] = None
    snr: Optional[float] = None

    # Performance
    tx_rate_mbps: Optional[float] = None
    rx_rate_mbps: Optional[float] = None
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
    idle_time_seconds: Optional[int] = None

    # Device capabilities
    supports_80211k: bool = False
    supports_80211r: bool = False
    supports_80211v: bool = False
    max_phy_rate_mbps: Optional[float] = None

    # Customer association
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None


# ============================================================================
# Coverage Zone Type
# ============================================================================


@strawberry.type
class CoverageZone:
    """RF coverage zone mapping."""

    # Identity
    id: strawberry.ID
    name: str
    description: Optional[str] = None

    # Geographic area
    site_id: str
    site_name: str
    floor: Optional[str] = None
    area_type: str  # indoor, outdoor, mixed

    # Coverage metrics
    coverage_area_sqm: Optional[float] = None
    signal_strength_min_dbm: Optional[float] = None
    signal_strength_max_dbm: Optional[float] = None
    signal_strength_avg_dbm: Optional[float] = None

    # Access points in zone
    access_point_ids: list[str]
    access_point_count: int

    # RF quality
    interference_level: Optional[float] = None
    channel_utilization_avg: Optional[float] = None
    noise_floor_avg_dbm: Optional[float] = None

    # Client metrics
    connected_clients: int
    max_client_capacity: int
    client_density_per_ap: Optional[float] = None

    # GeoJSON polygon
    coverage_polygon: Optional[str] = None  # GeoJSON polygon string

    # Timestamps
    created_at: datetime
    updated_at: datetime
    last_surveyed_at: Optional[datetime] = None


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
    average_signal_strength_dbm: Optional[float] = None
    average_snr: Optional[float] = None
    total_throughput_mbps: Optional[float] = None

    # Capacity
    total_capacity: int
    capacity_utilization_percent: Optional[float] = None

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
