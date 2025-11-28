"""
Dual-Stack IPv4/IPv6 Metrics Collection Service.

Collects, aggregates, and exports metrics for dual-stack infrastructure monitoring.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class IPProtocol(str, Enum):
    """IP protocol version."""

    IPV4 = "ipv4"
    IPV6 = "ipv6"
    DUAL_STACK = "dual_stack"


class MetricPeriod(str, Enum):
    """Time period for metrics aggregation."""

    LAST_HOUR = "1h"
    LAST_DAY = "24h"
    LAST_WEEK = "7d"
    LAST_MONTH = "30d"


class DualStackMetrics:
    """Dual-stack infrastructure metrics data model."""

    def __init__(self) -> None:
        # Subscriber metrics
        self.total_subscribers: int = 0
        self.dual_stack_subscribers: int = 0
        self.ipv4_only_subscribers: int = 0
        self.ipv6_only_subscribers: int = 0
        self.dual_stack_percentage: float = 0.0

        # IP allocation metrics
        self.total_ipv4_allocated: int = 0
        self.total_ipv6_allocated: int = 0
        self.ipv4_pool_utilization: float = 0.0
        self.ipv6_prefix_utilization: float = 0.0
        self.available_ipv4_addresses: int = 0
        self.available_ipv6_prefixes: int = 0

        # Traffic metrics
        self.ipv4_traffic_percentage: float = 0.0
        self.ipv6_traffic_percentage: float = 0.0
        self.ipv4_bandwidth_mbps: float = 0.0
        self.ipv6_bandwidth_mbps: float = 0.0

        # Connectivity metrics
        self.ipv4_reachable_devices: int = 0
        self.ipv6_reachable_devices: int = 0
        self.dual_stack_reachable_devices: int = 0
        self.ipv4_connectivity_percentage: float = 0.0
        self.ipv6_connectivity_percentage: float = 0.0

        # Performance metrics
        self.avg_ipv4_latency_ms: float = 0.0
        self.avg_ipv6_latency_ms: float = 0.0
        self.ipv4_packet_loss_percentage: float = 0.0
        self.ipv6_packet_loss_percentage: float = 0.0

        # WireGuard VPN metrics
        self.wireguard_servers: int = 0
        self.wireguard_dual_stack_servers: int = 0
        self.wireguard_peers: int = 0
        self.wireguard_dual_stack_peers: int = 0

        # Migration progress metrics
        self.migration_started: int = 0
        self.migration_completed: int = 0
        self.migration_failed: int = 0
        self.migration_progress_percentage: float = 0.0

        # Timestamp
        self.collected_at: datetime = datetime.utcnow()

    def to_dict(self) -> dict[str, Any]:
        """Convert metrics to dictionary."""
        return {
            "subscriber_metrics": {
                "total_subscribers": self.total_subscribers,
                "dual_stack_subscribers": self.dual_stack_subscribers,
                "ipv4_only_subscribers": self.ipv4_only_subscribers,
                "ipv6_only_subscribers": self.ipv6_only_subscribers,
                "dual_stack_percentage": round(self.dual_stack_percentage, 2),
            },
            "ip_allocation_metrics": {
                "total_ipv4_allocated": self.total_ipv4_allocated,
                "total_ipv6_allocated": self.total_ipv6_allocated,
                "ipv4_pool_utilization": round(self.ipv4_pool_utilization, 2),
                "ipv6_prefix_utilization": round(self.ipv6_prefix_utilization, 2),
                "available_ipv4_addresses": self.available_ipv4_addresses,
                "available_ipv6_prefixes": self.available_ipv6_prefixes,
            },
            "traffic_metrics": {
                "ipv4_traffic_percentage": round(self.ipv4_traffic_percentage, 2),
                "ipv6_traffic_percentage": round(self.ipv6_traffic_percentage, 2),
                "ipv4_bandwidth_mbps": round(self.ipv4_bandwidth_mbps, 2),
                "ipv6_bandwidth_mbps": round(self.ipv6_bandwidth_mbps, 2),
            },
            "connectivity_metrics": {
                "ipv4_reachable_devices": self.ipv4_reachable_devices,
                "ipv6_reachable_devices": self.ipv6_reachable_devices,
                "dual_stack_reachable_devices": self.dual_stack_reachable_devices,
                "ipv4_connectivity_percentage": round(self.ipv4_connectivity_percentage, 2),
                "ipv6_connectivity_percentage": round(self.ipv6_connectivity_percentage, 2),
            },
            "performance_metrics": {
                "avg_ipv4_latency_ms": round(self.avg_ipv4_latency_ms, 2),
                "avg_ipv6_latency_ms": round(self.avg_ipv6_latency_ms, 2),
                "ipv4_packet_loss_percentage": round(self.ipv4_packet_loss_percentage, 2),
                "ipv6_packet_loss_percentage": round(self.ipv6_packet_loss_percentage, 2),
            },
            "wireguard_metrics": {
                "wireguard_servers": self.wireguard_servers,
                "wireguard_dual_stack_servers": self.wireguard_dual_stack_servers,
                "wireguard_peers": self.wireguard_peers,
                "wireguard_dual_stack_peers": self.wireguard_dual_stack_peers,
            },
            "migration_metrics": {
                "migration_started": self.migration_started,
                "migration_completed": self.migration_completed,
                "migration_failed": self.migration_failed,
                "migration_progress_percentage": round(self.migration_progress_percentage, 2),
            },
            "meta": {
                "collected_at": self.collected_at.isoformat(),
            },
        }


class DualStackMetricsCollector:
    """Collects dual-stack metrics from various sources."""

    def __init__(self, session: AsyncSession, tenant_id: str | None = None) -> None:
        self.session = session
        self.tenant_id = tenant_id

    async def collect_subscriber_metrics(self, metrics: DualStackMetrics) -> None:
        """Collect subscriber allocation metrics."""
        from dotmac.platform.subscribers.models import Subscriber

        # Build base query with tenant filter if provided
        filters = []
        if self.tenant_id:
            filters.append(Subscriber.tenant_id == self.tenant_id)

        # Total subscribers
        result = await self.session.execute(select(func.count(Subscriber.id)).where(*filters))
        metrics.total_subscribers = result.scalar() or 0

        # Dual-stack subscribers (both IPv4 and IPv6)
        dual_stack_filters = filters + [
            Subscriber.static_ipv4.isnot(None),
            Subscriber.ipv6_prefix.isnot(None),
        ]
        result = await self.session.execute(
            select(func.count(Subscriber.id)).where(*dual_stack_filters)
        )
        metrics.dual_stack_subscribers = result.scalar() or 0

        # IPv4-only subscribers
        ipv4_only_filters = filters + [
            Subscriber.static_ipv4.isnot(None),
            Subscriber.ipv6_prefix.is_(None),
        ]
        result = await self.session.execute(
            select(func.count(Subscriber.id)).where(*ipv4_only_filters)
        )
        metrics.ipv4_only_subscribers = result.scalar() or 0

        # IPv6-only subscribers
        ipv6_only_filters = filters + [
            Subscriber.static_ipv4.is_(None),
            Subscriber.ipv6_prefix.isnot(None),
        ]
        result = await self.session.execute(
            select(func.count(Subscriber.id)).where(*ipv6_only_filters)
        )
        metrics.ipv6_only_subscribers = result.scalar() or 0

        # Calculate percentage
        if metrics.total_subscribers > 0:
            metrics.dual_stack_percentage = (
                metrics.dual_stack_subscribers / metrics.total_subscribers * 100
            )

    async def collect_wireguard_metrics(self, metrics: DualStackMetrics) -> None:
        """Collect WireGuard VPN metrics."""
        try:
            from dotmac.platform.network.wireguard.models import WireGuardPeer, WireGuardServer

            # Build tenant filter
            filters = []
            if self.tenant_id:
                filters.append(WireGuardServer.tenant_id == self.tenant_id)

            # Total WireGuard servers
            result = await self.session.execute(
                select(func.count(WireGuardServer.server_id)).where(*filters)
            )
            metrics.wireguard_servers = result.scalar() or 0

            # Dual-stack WireGuard servers
            dual_stack_filters = filters + [
                WireGuardServer.server_ipv4.isnot(None),
                WireGuardServer.server_ipv6.isnot(None),
            ]
            result = await self.session.execute(
                select(func.count(WireGuardServer.server_id)).where(*dual_stack_filters)
            )
            metrics.wireguard_dual_stack_servers = result.scalar() or 0

            # Total WireGuard peers
            peer_filters = []
            if self.tenant_id:
                peer_filters.append(WireGuardPeer.tenant_id == self.tenant_id)

            result = await self.session.execute(
                select(func.count(WireGuardPeer.peer_id)).where(*peer_filters)
            )
            metrics.wireguard_peers = result.scalar() or 0

            # Dual-stack WireGuard peers
            dual_stack_peer_filters = peer_filters + [
                WireGuardPeer.peer_ipv4.isnot(None),
                WireGuardPeer.peer_ipv6.isnot(None),
            ]
            result = await self.session.execute(
                select(func.count(WireGuardPeer.peer_id)).where(*dual_stack_peer_filters)
            )
            metrics.wireguard_dual_stack_peers = result.scalar() or 0

        except ImportError:
            logger.warning("WireGuard models not available, skipping WireGuard metrics")

    async def collect_device_metrics(self, metrics: DualStackMetrics) -> None:
        """Collect device connectivity metrics."""
        try:
            from dotmac.platform.network_monitoring.models import MonitoredDevice

            # Build tenant filter
            filters = []
            if self.tenant_id:
                filters.append(MonitoredDevice.tenant_id == self.tenant_id)

            # IPv4 reachable devices
            ipv4_filters = filters + [
                MonitoredDevice.ipv4_address.isnot(None),
                MonitoredDevice.ipv4_reachable == True,  # noqa: E712
            ]
            result = await self.session.execute(
                select(func.count(MonitoredDevice.device_id)).where(*ipv4_filters)
            )
            metrics.ipv4_reachable_devices = result.scalar() or 0

            # IPv6 reachable devices
            ipv6_filters = filters + [
                MonitoredDevice.ipv6_address.isnot(None),
                MonitoredDevice.ipv6_reachable == True,  # noqa: E712
            ]
            result = await self.session.execute(
                select(func.count(MonitoredDevice.device_id)).where(*ipv6_filters)
            )
            metrics.ipv6_reachable_devices = result.scalar() or 0

            # Dual-stack reachable devices (both IPv4 and IPv6 reachable)
            dual_stack_filters = filters + [
                MonitoredDevice.ipv4_address.isnot(None),
                MonitoredDevice.ipv6_address.isnot(None),
                MonitoredDevice.ipv4_reachable == True,  # noqa: E712
                MonitoredDevice.ipv6_reachable == True,  # noqa: E712
            ]
            result = await self.session.execute(
                select(func.count(MonitoredDevice.device_id)).where(*dual_stack_filters)
            )
            metrics.dual_stack_reachable_devices = result.scalar() or 0

            # Total devices with IPv4
            result = await self.session.execute(
                select(func.count(MonitoredDevice.device_id)).where(
                    *filters, MonitoredDevice.ipv4_address.isnot(None)
                )
            )
            total_ipv4_devices = result.scalar() or 0

            # Total devices with IPv6
            result = await self.session.execute(
                select(func.count(MonitoredDevice.device_id)).where(
                    *filters, MonitoredDevice.ipv6_address.isnot(None)
                )
            )
            total_ipv6_devices = result.scalar() or 0

            # Calculate connectivity percentages
            if total_ipv4_devices > 0:
                metrics.ipv4_connectivity_percentage = (
                    metrics.ipv4_reachable_devices / total_ipv4_devices * 100
                )

            if total_ipv6_devices > 0:
                metrics.ipv6_connectivity_percentage = (
                    metrics.ipv6_reachable_devices / total_ipv6_devices * 100
                )

            # Average latency (IPv4)
            result = await self.session.execute(
                select(func.avg(MonitoredDevice.ipv4_latency_ms)).where(
                    *filters,
                    MonitoredDevice.ipv4_address.isnot(None),
                    MonitoredDevice.ipv4_reachable == True,  # noqa: E712
                )
            )
            avg_ipv4_latency = result.scalar()
            metrics.avg_ipv4_latency_ms = float(avg_ipv4_latency) if avg_ipv4_latency else 0.0

            # Average latency (IPv6)
            result = await self.session.execute(
                select(func.avg(MonitoredDevice.ipv6_latency_ms)).where(
                    *filters,
                    MonitoredDevice.ipv6_address.isnot(None),
                    MonitoredDevice.ipv6_reachable == True,  # noqa: E712
                )
            )
            avg_ipv6_latency = result.scalar()
            metrics.avg_ipv6_latency_ms = float(avg_ipv6_latency) if avg_ipv6_latency else 0.0

            # Packet loss (IPv4)
            result = await self.session.execute(
                select(func.avg(MonitoredDevice.ipv4_packet_loss)).where(
                    *filters, MonitoredDevice.ipv4_address.isnot(None)
                )
            )
            avg_ipv4_loss = result.scalar()
            metrics.ipv4_packet_loss_percentage = float(avg_ipv4_loss) if avg_ipv4_loss else 0.0

            # Packet loss (IPv6)
            result = await self.session.execute(
                select(func.avg(MonitoredDevice.ipv6_packet_loss)).where(
                    *filters, MonitoredDevice.ipv6_address.isnot(None)
                )
            )
            avg_ipv6_loss = result.scalar()
            metrics.ipv6_packet_loss_percentage = float(avg_ipv6_loss) if avg_ipv6_loss else 0.0

        except ImportError:
            logger.warning("MonitoredDevice model not available, skipping device metrics")

    async def collect_all_metrics(self) -> DualStackMetrics:
        """Collect all dual-stack metrics."""
        metrics = DualStackMetrics()

        await self.collect_subscriber_metrics(metrics)
        await self.collect_wireguard_metrics(metrics)
        await self.collect_device_metrics(metrics)

        logger.info(
            f"Collected dual-stack metrics for tenant: {self.tenant_id or 'global'}, "
            f"total_subscribers={metrics.total_subscribers}, "
            f"dual_stack_percentage={metrics.dual_stack_percentage:.2f}%"
        )

        return metrics


class MetricsAggregator:
    """Aggregates metrics over time periods."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_trend_data(
        self, metric_name: str, period: MetricPeriod, tenant_id: str | None = None
    ) -> list[dict[str, Any]]:
        """
        Get trend data for a specific metric over time.

        This would typically query a time-series database like TimescaleDB,
        InfluxDB, or Prometheus. For now, returns placeholder structure.
        """
        # Calculate time range
        now = datetime.utcnow()
        time_delta = {
            MetricPeriod.LAST_HOUR: timedelta(hours=1),
            MetricPeriod.LAST_DAY: timedelta(days=1),
            MetricPeriod.LAST_WEEK: timedelta(weeks=1),
            MetricPeriod.LAST_MONTH: timedelta(days=30),
        }

        start_time = now - time_delta[period]

        # Placeholder for trend data
        # In production, this would query metrics storage
        return [
            {
                "timestamp": start_time.isoformat(),
                "value": 0.0,
                "metric": metric_name,
            }
        ]

    async def get_top_utilization(
        self, resource_type: str, limit: int = 10, tenant_id: str | None = None
    ) -> list[dict[str, Any]]:
        """Get top N resources by utilization."""
        # Placeholder for top utilization queries
        # Would query actual resource data in production
        return []


class AlertEvaluator:
    """Evaluates metrics against alert thresholds."""

    # Default alert thresholds
    THRESHOLDS = {
        "ipv4_pool_utilization": {"warning": 70.0, "critical": 85.0},
        "ipv6_prefix_utilization": {"warning": 60.0, "critical": 80.0},
        "dual_stack_percentage": {"warning": 30.0, "critical": 20.0},  # Below threshold
        "ipv4_connectivity_percentage": {"warning": 95.0, "critical": 90.0},  # Below
        "ipv6_connectivity_percentage": {"warning": 95.0, "critical": 90.0},  # Below
        "ipv4_latency_ms": {"warning": 50.0, "critical": 100.0},
        "ipv6_latency_ms": {"warning": 50.0, "critical": 100.0},
        "ipv4_packet_loss_percentage": {"warning": 1.0, "critical": 5.0},
        "ipv6_packet_loss_percentage": {"warning": 1.0, "critical": 5.0},
    }

    def evaluate(self, metrics: DualStackMetrics) -> list[dict[str, Any]]:
        """Evaluate metrics and return list of alerts."""
        alerts = []

        # IPv4 pool utilization
        if metrics.ipv4_pool_utilization >= self.THRESHOLDS["ipv4_pool_utilization"]["critical"]:
            alerts.append(
                {
                    "severity": "critical",
                    "metric": "ipv4_pool_utilization",
                    "value": metrics.ipv4_pool_utilization,
                    "threshold": self.THRESHOLDS["ipv4_pool_utilization"]["critical"],
                    "message": f"IPv4 pool utilization is critically high: {metrics.ipv4_pool_utilization:.2f}%",
                }
            )
        elif metrics.ipv4_pool_utilization >= self.THRESHOLDS["ipv4_pool_utilization"]["warning"]:
            alerts.append(
                {
                    "severity": "warning",
                    "metric": "ipv4_pool_utilization",
                    "value": metrics.ipv4_pool_utilization,
                    "threshold": self.THRESHOLDS["ipv4_pool_utilization"]["warning"],
                    "message": f"IPv4 pool utilization is high: {metrics.ipv4_pool_utilization:.2f}%",
                }
            )

        # Dual-stack adoption (below threshold is bad)
        if (
            metrics.dual_stack_percentage > 0
            and metrics.dual_stack_percentage
            <= self.THRESHOLDS["dual_stack_percentage"]["critical"]
        ):
            alerts.append(
                {
                    "severity": "critical",
                    "metric": "dual_stack_percentage",
                    "value": metrics.dual_stack_percentage,
                    "threshold": self.THRESHOLDS["dual_stack_percentage"]["critical"],
                    "message": f"Dual-stack adoption is critically low: {metrics.dual_stack_percentage:.2f}%",
                }
            )

        # IPv4 connectivity
        if (
            metrics.ipv4_connectivity_percentage > 0
            and metrics.ipv4_connectivity_percentage
            <= self.THRESHOLDS["ipv4_connectivity_percentage"]["critical"]
        ):
            alerts.append(
                {
                    "severity": "critical",
                    "metric": "ipv4_connectivity_percentage",
                    "value": metrics.ipv4_connectivity_percentage,
                    "threshold": self.THRESHOLDS["ipv4_connectivity_percentage"]["critical"],
                    "message": f"IPv4 connectivity is critically low: {metrics.ipv4_connectivity_percentage:.2f}%",
                }
            )

        # IPv6 connectivity
        if (
            metrics.ipv6_connectivity_percentage > 0
            and metrics.ipv6_connectivity_percentage
            <= self.THRESHOLDS["ipv6_connectivity_percentage"]["critical"]
        ):
            alerts.append(
                {
                    "severity": "critical",
                    "metric": "ipv6_connectivity_percentage",
                    "value": metrics.ipv6_connectivity_percentage,
                    "threshold": self.THRESHOLDS["ipv6_connectivity_percentage"]["critical"],
                    "message": f"IPv6 connectivity is critically low: {metrics.ipv6_connectivity_percentage:.2f}%",
                }
            )

        # IPv4 latency
        if metrics.avg_ipv4_latency_ms >= self.THRESHOLDS["ipv4_latency_ms"]["critical"]:
            alerts.append(
                {
                    "severity": "critical",
                    "metric": "ipv4_latency_ms",
                    "value": metrics.avg_ipv4_latency_ms,
                    "threshold": self.THRESHOLDS["ipv4_latency_ms"]["critical"],
                    "message": f"IPv4 latency is critically high: {metrics.avg_ipv4_latency_ms:.2f}ms",
                }
            )

        # IPv6 latency
        if metrics.avg_ipv6_latency_ms >= self.THRESHOLDS["ipv6_latency_ms"]["critical"]:
            alerts.append(
                {
                    "severity": "critical",
                    "metric": "ipv6_latency_ms",
                    "value": metrics.avg_ipv6_latency_ms,
                    "threshold": self.THRESHOLDS["ipv6_latency_ms"]["critical"],
                    "message": f"IPv6 latency is critically high: {metrics.avg_ipv6_latency_ms:.2f}ms",
                }
            )

        # Packet loss
        if (
            metrics.ipv4_packet_loss_percentage
            >= self.THRESHOLDS["ipv4_packet_loss_percentage"]["critical"]
        ):
            alerts.append(
                {
                    "severity": "critical",
                    "metric": "ipv4_packet_loss_percentage",
                    "value": metrics.ipv4_packet_loss_percentage,
                    "threshold": self.THRESHOLDS["ipv4_packet_loss_percentage"]["critical"],
                    "message": f"IPv4 packet loss is critically high: {metrics.ipv4_packet_loss_percentage:.2f}%",
                }
            )

        if (
            metrics.ipv6_packet_loss_percentage
            >= self.THRESHOLDS["ipv6_packet_loss_percentage"]["critical"]
        ):
            alerts.append(
                {
                    "severity": "critical",
                    "metric": "ipv6_packet_loss_percentage",
                    "value": metrics.ipv6_packet_loss_percentage,
                    "threshold": self.THRESHOLDS["ipv6_packet_loss_percentage"]["critical"],
                    "message": f"IPv6 packet loss is critically high: {metrics.ipv6_packet_loss_percentage:.2f}%",
                }
            )

        return alerts
