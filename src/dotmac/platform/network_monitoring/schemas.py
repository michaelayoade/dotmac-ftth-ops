"""
Network Monitoring Schemas

Pydantic models for network monitoring data structures.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# Enums
# ============================================================================


class DeviceStatus(str, Enum):
    """Network device status"""

    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"


class AlertSeverity(str, Enum):
    """Alert severity levels"""

    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class DeviceType(str, Enum):
    """Network device types"""

    OLT = "olt"  # Optical Line Terminal
    ONU = "onu"  # Optical Network Unit
    CPE = "cpe"  # Customer Premises Equipment
    ROUTER = "router"
    SWITCH = "switch"
    FIREWALL = "firewall"
    OTHER = "other"


# ============================================================================
# Device Health Schemas
# ============================================================================


class DeviceHealthResponse(BaseModel):
    """Device health status"""

    device_id: str
    device_name: str
    device_type: DeviceType
    status: DeviceStatus
    ip_address: str | None = None
    last_seen: datetime | None = None
    uptime_seconds: int | None = None

    # Health metrics
    cpu_usage_percent: float | None = None
    memory_usage_percent: float | None = None
    temperature_celsius: float | None = None
    power_status: str | None = None

    # Connectivity
    ping_latency_ms: float | None = None
    packet_loss_percent: float | None = None

    # Additional info
    firmware_version: str | None = None
    model: str | None = None
    location: str | None = None
    tenant_id: str | None = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Traffic/Bandwidth Schemas
# ============================================================================


class InterfaceStats(BaseModel):
    """Network interface statistics"""

    interface_name: str
    status: str  # up, down, admin_down
    speed_mbps: int | None = None

    # Traffic counters (bytes)
    bytes_in: int = 0
    bytes_out: int = 0
    packets_in: int = 0
    packets_out: int = 0

    # Error counters
    errors_in: int = 0
    errors_out: int = 0
    drops_in: int = 0
    drops_out: int = 0

    # Rates (bits per second)
    rate_in_bps: float | None = None
    rate_out_bps: float | None = None

    # Utilization
    utilization_percent: float | None = None


class TrafficStatsResponse(BaseModel):
    """Device traffic statistics"""

    device_id: str
    device_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Aggregate stats
    total_bytes_in: int = 0
    total_bytes_out: int = 0
    total_packets_in: int = 0
    total_packets_out: int = 0

    # Current rates
    current_rate_in_bps: float = 0.0
    current_rate_out_bps: float = 0.0

    # Interface details
    interfaces: list[InterfaceStats] = Field(default_factory=list)

    # Peak usage (last 24h)
    peak_rate_in_bps: float | None = None
    peak_rate_out_bps: float | None = None
    peak_timestamp: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Device Metrics Schemas
# ============================================================================


class ONUMetrics(BaseModel):
    """ONU-specific metrics"""

    serial_number: str
    optical_power_rx_dbm: float | None = None
    optical_power_tx_dbm: float | None = None
    olt_rx_power_dbm: float | None = None
    distance_meters: int | None = None
    state: str | None = None  # active, disabled, etc.


class CPEMetrics(BaseModel):
    """CPE-specific metrics"""

    mac_address: str
    wifi_enabled: bool | None = None
    connected_clients: int | None = None
    wifi_2ghz_clients: int | None = None
    wifi_5ghz_clients: int | None = None
    wan_ip: str | None = None
    last_inform: datetime | None = None


class DeviceMetricsResponse(BaseModel):
    """Comprehensive device metrics"""

    device_id: str
    device_name: str
    device_type: DeviceType
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Common metrics
    health: DeviceHealthResponse
    traffic: TrafficStatsResponse | None = None

    # Device-specific metrics
    onu_metrics: ONUMetrics | None = None
    cpe_metrics: CPEMetrics | None = None

    # Custom metrics
    custom_metrics: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Alert Schemas
# ============================================================================


class NetworkAlertResponse(BaseModel):
    """Network monitoring alert"""

    alert_id: str
    severity: AlertSeverity
    title: str
    description: str
    device_id: str | None = None
    device_name: str | None = None
    device_type: DeviceType | None = None

    # Timing
    triggered_at: datetime = Field(default_factory=datetime.utcnow)
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None

    # Status
    is_active: bool = True
    is_acknowledged: bool = False

    # Context
    metric_name: str | None = None
    threshold_value: float | None = None
    current_value: float | None = None
    alert_rule_id: str | None = None

    # Tenant isolation
    tenant_id: str

    model_config = ConfigDict(from_attributes=True)


class AcknowledgeAlertRequest(BaseModel):
    """Request to acknowledge an alert"""

    note: str | None = Field(None, max_length=500)


class CreateAlertRuleRequest(BaseModel):
    """Create a new alert rule"""

    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    device_type: DeviceType | None = None
    metric_name: str = Field(..., description="Metric to monitor (e.g., cpu_usage_percent)")
    condition: str = Field(..., description="Condition operator (gt, lt, gte, lte, eq)")
    threshold: float = Field(..., description="Threshold value")
    severity: AlertSeverity = AlertSeverity.WARNING
    enabled: bool = True


# ============================================================================
# Overview/Dashboard Schemas
# ============================================================================


class DeviceTypeSummary(BaseModel):
    """Summary for a device type"""

    device_type: DeviceType
    total_count: int = 0
    online_count: int = 0
    offline_count: int = 0
    degraded_count: int = 0
    avg_cpu_usage: float | None = None
    avg_memory_usage: float | None = None


class NetworkOverviewResponse(BaseModel):
    """Network monitoring overview/dashboard"""

    tenant_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Device counts
    total_devices: int = 0
    online_devices: int = 0
    offline_devices: int = 0
    degraded_devices: int = 0

    # Alerts
    active_alerts: int = 0
    critical_alerts: int = 0
    warning_alerts: int = 0

    # Traffic summary (bits per second)
    total_bandwidth_in_bps: float = 0.0
    total_bandwidth_out_bps: float = 0.0
    peak_bandwidth_in_bps: float | None = None
    peak_bandwidth_out_bps: float | None = None

    # By device type
    device_type_summary: list[DeviceTypeSummary] = Field(default_factory=list)

    # Recent events
    recent_offline_devices: list[str] = Field(default_factory=list)
    recent_alerts: list[NetworkAlertResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Historical Data Schemas
# ============================================================================


class TimeSeriesDataPoint(BaseModel):
    """Single time series data point"""

    timestamp: datetime
    value: float


class DeviceMetricsHistory(BaseModel):
    """Historical metrics for a device"""

    device_id: str
    device_name: str
    metric_name: str
    unit: str | None = None
    data_points: list[TimeSeriesDataPoint] = Field(default_factory=list)
    start_time: datetime
    end_time: datetime


class BandwidthHistoryRequest(BaseModel):
    """Request bandwidth history"""

    device_id: str | None = None
    start_time: datetime
    end_time: datetime
    interval_seconds: int = Field(300, ge=60, le=3600, description="Aggregation interval")
