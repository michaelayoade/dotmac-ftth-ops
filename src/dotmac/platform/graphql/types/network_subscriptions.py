"""
GraphQL subscription types for Network Monitoring real-time updates.

Provides types for device status updates and network alert notifications
via WebSocket subscriptions.
"""

from datetime import datetime

import strawberry

from dotmac.platform.graphql.types.network import (
    DeviceStatusEnum,
    DeviceTypeEnum,
    NetworkAlert,
)


@strawberry.type
class DeviceUpdate:
    """Real-time device status and metrics update."""

    device_id: str
    device_name: str
    device_type: DeviceTypeEnum
    status: DeviceStatusEnum
    ip_address: str | None
    firmware_version: str | None
    model: str | None
    location: str | None
    tenant_id: str

    # Health metrics
    cpu_usage_percent: float | None
    memory_usage_percent: float | None
    temperature_celsius: float | None
    power_status: str | None
    ping_latency_ms: float | None
    packet_loss_percent: float | None
    uptime_seconds: int | None
    uptime_days: int | None
    last_seen: datetime | None
    is_healthy: bool

    # Update metadata
    change_type: str  # e.g., "status_change", "metric_update", "health_alert"
    previous_value: str | None
    new_value: str | None
    updated_at: datetime


@strawberry.type
class NetworkAlertUpdate:
    """Real-time network alert notification."""

    action: str  # "created", "updated", "acknowledged", "resolved", "deleted"
    alert: NetworkAlert
    updated_at: datetime


__all__ = [
    "DeviceUpdate",
    "NetworkAlertUpdate",
]
