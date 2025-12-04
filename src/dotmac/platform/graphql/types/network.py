"""
GraphQL types for Network Monitoring & Bandwidth.

Provides types for device health, traffic statistics, alerts, and network overview
with efficient DataLoader batching to prevent N+1 queries.
"""

from datetime import datetime
from enum import Enum
from typing import Any

import strawberry


@strawberry.enum
class DeviceStatusEnum(str, Enum):
    """Network device status values."""

    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"


@strawberry.enum
class DeviceTypeEnum(str, Enum):
    """Network device types."""

    OLT = "olt"  # Optical Line Terminal
    ONU = "onu"  # Optical Network Unit
    CPE = "cpe"  # Customer Premises Equipment
    ROUTER = "router"
    SWITCH = "switch"
    FIREWALL = "firewall"
    OTHER = "other"


@strawberry.enum
class AlertSeverityEnum(str, Enum):
    """Alert severity levels."""

    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


# ============================================================================
# Interface Statistics
# ============================================================================


@strawberry.type
class InterfaceStats:
    """Network interface statistics."""

    interface_name: str
    status: str
    speed_mbps: int | None

    # Traffic counters
    bytes_in: int
    bytes_out: int
    packets_in: int
    packets_out: int

    # Error counters
    errors_in: int
    errors_out: int
    drops_in: int
    drops_out: int

    # Rates (bits per second)
    rate_in_bps: float | None
    rate_out_bps: float | None

    # Utilization percentage
    utilization_percent: float | None

    @classmethod
    def from_model(cls, interface: Any) -> "InterfaceStats":
        """Convert interface model to GraphQL type."""
        return cls(
            interface_name=interface.interface_name,
            status=interface.status,
            speed_mbps=interface.speed_mbps,
            bytes_in=interface.bytes_in,
            bytes_out=interface.bytes_out,
            packets_in=interface.packets_in,
            packets_out=interface.packets_out,
            errors_in=interface.errors_in,
            errors_out=interface.errors_out,
            drops_in=interface.drops_in,
            drops_out=interface.drops_out,
            rate_in_bps=interface.rate_in_bps,
            rate_out_bps=interface.rate_out_bps,
            utilization_percent=interface.utilization_percent,
        )


# ============================================================================
# Device Health
# ============================================================================


@strawberry.type
class DeviceHealth:
    """Device health status and metrics."""

    device_id: str
    device_name: str
    device_type: DeviceTypeEnum
    status: DeviceStatusEnum
    ip_address: str | None
    last_seen: datetime | None
    uptime_seconds: int | None

    # Health metrics
    cpu_usage_percent: float | None
    memory_usage_percent: float | None
    temperature_celsius: float | None
    power_status: str | None

    # Connectivity
    ping_latency_ms: float | None
    packet_loss_percent: float | None

    # Additional info
    firmware_version: str | None
    model: str | None
    location: str | None
    tenant_id: str

    # Computed properties
    is_healthy: bool
    uptime_days: int | None

    @classmethod
    def from_model(cls, device: Any) -> "DeviceHealth":
        """Convert device health model to GraphQL type."""
        # Compute properties
        is_healthy = device.status in ["online"] and (
            device.cpu_usage_percent is None or device.cpu_usage_percent < 80
        )

        uptime_days = None
        if device.uptime_seconds:
            uptime_days = device.uptime_seconds // 86400

        return cls(
            device_id=device.device_id,
            device_name=device.device_name,
            device_type=DeviceTypeEnum(device.device_type.value),
            status=DeviceStatusEnum(device.status.value),
            ip_address=device.ip_address,
            last_seen=device.last_seen,
            uptime_seconds=device.uptime_seconds,
            cpu_usage_percent=device.cpu_usage_percent,
            memory_usage_percent=device.memory_usage_percent,
            temperature_celsius=device.temperature_celsius,
            power_status=device.power_status,
            ping_latency_ms=device.ping_latency_ms,
            packet_loss_percent=device.packet_loss_percent,
            firmware_version=device.firmware_version,
            model=device.model,
            location=device.location,
            tenant_id=device.tenant_id,
            is_healthy=is_healthy,
            uptime_days=uptime_days,
        )


# ============================================================================
# Traffic Statistics
# ============================================================================


@strawberry.type
class TrafficStats:
    """Device traffic and bandwidth statistics."""

    device_id: str
    device_name: str
    timestamp: datetime

    # Aggregate stats
    total_bytes_in: int
    total_bytes_out: int
    total_packets_in: int
    total_packets_out: int

    # Current rates (bits per second)
    current_rate_in_bps: float
    current_rate_out_bps: float

    # Peak usage (last 24h)
    peak_rate_in_bps: float | None
    peak_rate_out_bps: float | None
    peak_timestamp: datetime | None

    # Interface details (conditionally loaded)
    interfaces: list[InterfaceStats] = strawberry.field(default_factory=list)

    # Computed properties
    current_rate_in_mbps: float
    current_rate_out_mbps: float
    total_bandwidth_gbps: float

    @classmethod
    def from_model(cls, traffic: Any, include_interfaces: bool = False) -> "TrafficStats":
        """Convert traffic stats model to GraphQL type."""
        # Compute properties
        current_rate_in_mbps = traffic.current_rate_in_bps / 1_000_000
        current_rate_out_mbps = traffic.current_rate_out_bps / 1_000_000
        total_bandwidth_gbps = (
            traffic.current_rate_in_bps + traffic.current_rate_out_bps
        ) / 1_000_000_000

        interfaces = []
        if include_interfaces and hasattr(traffic, "interfaces") and traffic.interfaces:
            interfaces = [InterfaceStats.from_model(i) for i in traffic.interfaces]

        return cls(
            device_id=traffic.device_id,
            device_name=traffic.device_name,
            timestamp=traffic.timestamp,
            total_bytes_in=traffic.total_bytes_in,
            total_bytes_out=traffic.total_bytes_out,
            total_packets_in=traffic.total_packets_in,
            total_packets_out=traffic.total_packets_out,
            current_rate_in_bps=traffic.current_rate_in_bps,
            current_rate_out_bps=traffic.current_rate_out_bps,
            peak_rate_in_bps=traffic.peak_rate_in_bps,
            peak_rate_out_bps=traffic.peak_rate_out_bps,
            peak_timestamp=traffic.peak_timestamp,
            interfaces=interfaces,
            current_rate_in_mbps=round(current_rate_in_mbps, 2),
            current_rate_out_mbps=round(current_rate_out_mbps, 2),
            total_bandwidth_gbps=round(total_bandwidth_gbps, 4),
        )


# ============================================================================
# ONU & CPE Specific Metrics
# ============================================================================


@strawberry.type
class ONUMetrics:
    """ONU-specific optical metrics."""

    serial_number: str
    optical_power_rx_dbm: float | None
    optical_power_tx_dbm: float | None
    olt_rx_power_dbm: float | None
    distance_meters: int | None
    state: str | None

    @classmethod
    def from_model(cls, onu: Any) -> "ONUMetrics":
        """Convert ONU metrics model to GraphQL type."""
        return cls(
            serial_number=onu.serial_number,
            optical_power_rx_dbm=onu.optical_power_rx_dbm,
            optical_power_tx_dbm=onu.optical_power_tx_dbm,
            olt_rx_power_dbm=onu.olt_rx_power_dbm,
            distance_meters=onu.distance_meters,
            state=onu.state,
        )


@strawberry.type
class CPEMetrics:
    """CPE-specific metrics."""

    mac_address: str
    wifi_enabled: bool | None
    connected_clients: int | None
    wifi_2ghz_clients: int | None
    wifi_5ghz_clients: int | None
    wan_ip: str | None
    last_inform: datetime | None

    @classmethod
    def from_model(cls, cpe: Any) -> "CPEMetrics":
        """Convert CPE metrics model to GraphQL type."""
        return cls(
            mac_address=cpe.mac_address,
            wifi_enabled=cpe.wifi_enabled,
            connected_clients=cpe.connected_clients,
            wifi_2ghz_clients=cpe.wifi_2ghz_clients,
            wifi_5ghz_clients=cpe.wifi_5ghz_clients,
            wan_ip=cpe.wan_ip,
            last_inform=cpe.last_inform,
        )


# ============================================================================
# Comprehensive Device Metrics
# ============================================================================


@strawberry.type
class DeviceMetrics:
    """Comprehensive device metrics (health + traffic + device-specific)."""

    device_id: str
    device_name: str
    device_type: DeviceTypeEnum
    timestamp: datetime

    # Core metrics (always loaded)
    health: DeviceHealth

    # Conditionally loaded via DataLoaders
    traffic: TrafficStats | None = None
    onu_metrics: ONUMetrics | None = None
    cpe_metrics: CPEMetrics | None = None

    @classmethod
    def from_model(cls, metrics: Any) -> "DeviceMetrics":
        """Convert device metrics model to GraphQL type."""
        return cls(
            device_id=metrics.device_id,
            device_name=metrics.device_name,
            device_type=DeviceTypeEnum(metrics.device_type.value),
            timestamp=metrics.timestamp,
            health=DeviceHealth.from_model(metrics.health),
            traffic=(
                TrafficStats.from_model(metrics.traffic)
                if hasattr(metrics, "traffic") and metrics.traffic
                else None
            ),
            onu_metrics=(
                ONUMetrics.from_model(metrics.onu_metrics)
                if hasattr(metrics, "onu_metrics") and metrics.onu_metrics
                else None
            ),
            cpe_metrics=(
                CPEMetrics.from_model(metrics.cpe_metrics)
                if hasattr(metrics, "cpe_metrics") and metrics.cpe_metrics
                else None
            ),
        )


# ============================================================================
# Network Alerts
# ============================================================================


@strawberry.type
class NetworkAlert:
    """Network monitoring alert."""

    alert_id: str
    severity: AlertSeverityEnum
    title: str
    description: str
    device_id: str | None
    device_name: str | None
    device_type: DeviceTypeEnum | None

    # Timing
    triggered_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None

    # Status
    is_active: bool
    is_acknowledged: bool

    # Context
    metric_name: str | None
    threshold_value: float | None
    current_value: float | None
    alert_rule_id: str | None

    # Tenant isolation
    tenant_id: str

    @classmethod
    def from_model(cls, alert: Any) -> "NetworkAlert":
        """Convert alert model to GraphQL type."""
        device_type = None
        if alert.device_type:
            device_type = DeviceTypeEnum(alert.device_type.value)

        return cls(
            alert_id=alert.alert_id,
            severity=AlertSeverityEnum(alert.severity.value),
            title=alert.title,
            description=alert.description,
            device_id=alert.device_id,
            device_name=alert.device_name,
            device_type=device_type,
            triggered_at=alert.triggered_at,
            acknowledged_at=alert.acknowledged_at,
            resolved_at=alert.resolved_at,
            is_active=alert.is_active,
            is_acknowledged=alert.is_acknowledged,
            metric_name=alert.metric_name,
            threshold_value=alert.threshold_value,
            current_value=alert.current_value,
            alert_rule_id=alert.alert_rule_id,
            tenant_id=alert.tenant_id,
        )


# ============================================================================
# Network Overview
# ============================================================================


@strawberry.type
class DeviceTypeSummary:
    """Summary statistics for a device type."""

    device_type: DeviceTypeEnum
    total_count: int
    online_count: int
    offline_count: int
    degraded_count: int
    avg_cpu_usage: float | None
    avg_memory_usage: float | None

    @classmethod
    def from_dict(cls, data: dict) -> "DeviceTypeSummary":
        """Convert dictionary to GraphQL type."""
        return cls(
            device_type=DeviceTypeEnum(data["device_type"]),
            total_count=data.get("total_count", 0),
            online_count=data.get("online_count", 0),
            offline_count=data.get("offline_count", 0),
            degraded_count=data.get("degraded_count", 0),
            avg_cpu_usage=data.get("avg_cpu_usage"),
            avg_memory_usage=data.get("avg_memory_usage"),
        )


@strawberry.type
class DataSourceStatus:
    """Status of upstream monitoring data sources."""

    name: str
    status: str

    @classmethod
    def from_dict(cls, entry: tuple[str, str]) -> "DataSourceStatus":
        name, status = entry
        return cls(name=name, status=status)


@strawberry.type
class NetworkOverview:
    """Network monitoring overview/dashboard."""

    tenant_id: str
    timestamp: datetime

    # Device counts
    total_devices: int
    online_devices: int
    offline_devices: int
    degraded_devices: int

    # Alerts
    active_alerts: int
    critical_alerts: int
    warning_alerts: int

    # Traffic summary (bits per second)
    total_bandwidth_in_bps: float
    total_bandwidth_out_bps: float
    peak_bandwidth_in_bps: float | None
    peak_bandwidth_out_bps: float | None

    # By device type
    device_type_summary: list[DeviceTypeSummary]

    # Recent events
    recent_offline_devices: list[str]
    recent_alerts: list[NetworkAlert] = strawberry.field(default_factory=list)
    data_source_status: list[DataSourceStatus] = strawberry.field(default_factory=list)

    # Computed properties
    uptime_percentage: float
    total_bandwidth_gbps: float

    @classmethod
    def from_model(cls, overview: Any) -> "NetworkOverview":
        """Convert network overview model to GraphQL type."""
        # Compute properties
        total_devices = overview.total_devices or 1  # Avoid division by zero
        uptime_percentage = (
            (overview.online_devices / total_devices) * 100 if total_devices > 0 else 0
        )
        total_bandwidth_gbps = (
            overview.total_bandwidth_in_bps + overview.total_bandwidth_out_bps
        ) / 1_000_000_000

        device_type_summary = []
        if hasattr(overview, "device_type_summary") and overview.device_type_summary:
            device_type_summary = [
                DeviceTypeSummary.from_dict(d) for d in overview.device_type_summary
            ]

        recent_alerts = []
        if hasattr(overview, "recent_alerts") and overview.recent_alerts:
            recent_alerts = [NetworkAlert.from_model(a) for a in overview.recent_alerts]

        data_source_status: list[DataSourceStatus] = []
        if hasattr(overview, "data_source_status") and overview.data_source_status:
            raw_status = overview.data_source_status
            entries: list[tuple[str, str]] = []
            if isinstance(raw_status, dict):
                entries = [(str(name), str(status)) for name, status in raw_status.items()]
            elif isinstance(raw_status, (list, tuple)):
                for item in raw_status:
                    if isinstance(item, (tuple, list)) and len(item) == 2:
                        entries.append((str(item[0]), str(item[1])))
            data_source_status = [DataSourceStatus.from_dict(entry) for entry in entries]

        return cls(
            tenant_id=overview.tenant_id,
            timestamp=overview.timestamp,
            total_devices=overview.total_devices,
            online_devices=overview.online_devices,
            offline_devices=overview.offline_devices,
            degraded_devices=overview.degraded_devices,
            active_alerts=overview.active_alerts,
            critical_alerts=overview.critical_alerts,
            warning_alerts=overview.warning_alerts,
            total_bandwidth_in_bps=overview.total_bandwidth_in_bps,
            total_bandwidth_out_bps=overview.total_bandwidth_out_bps,
            peak_bandwidth_in_bps=overview.peak_bandwidth_in_bps,
            peak_bandwidth_out_bps=overview.peak_bandwidth_out_bps,
            device_type_summary=device_type_summary,
            recent_offline_devices=overview.recent_offline_devices or [],
            recent_alerts=recent_alerts,
            data_source_status=data_source_status,
            uptime_percentage=round(uptime_percentage, 2),
            total_bandwidth_gbps=round(total_bandwidth_gbps, 4),
        )


# ============================================================================
# Pagination Types
# ============================================================================


@strawberry.type
class DeviceConnection:
    """Paginated device results."""

    devices: list[DeviceHealth]
    total_count: int
    has_next_page: bool
    has_prev_page: bool
    page: int
    page_size: int


@strawberry.type
class AlertConnection:
    """Paginated alert results."""

    alerts: list[NetworkAlert]
    total_count: int
    has_next_page: bool
    has_prev_page: bool
    page: int
    page_size: int


__all__ = [
    "DeviceStatusEnum",
    "DeviceTypeEnum",
    "AlertSeverityEnum",
    "InterfaceStats",
    "DeviceHealth",
    "TrafficStats",
    "ONUMetrics",
    "CPEMetrics",
    "DeviceMetrics",
    "NetworkAlert",
    "DeviceTypeSummary",
    "NetworkOverview",
    "DeviceConnection",
    "AlertConnection",
]
