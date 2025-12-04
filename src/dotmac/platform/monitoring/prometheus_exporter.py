"""
Prometheus Metrics Exporter for Dual-Stack Infrastructure.

Exports dual-stack metrics in Prometheus format for scraping and visualization.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from prometheus_client import Counter, Gauge, Histogram, Info

if TYPE_CHECKING:
    from dotmac.platform.monitoring.dual_stack_metrics import DualStackMetrics

logger = logging.getLogger(__name__)


# Subscriber metrics
subscriber_total = Gauge(
    "dotmac_subscribers_total",
    "Total number of subscribers",
    ["tenant_id"],
)

subscriber_dual_stack = Gauge(
    "dotmac_subscribers_dual_stack",
    "Number of dual-stack subscribers (IPv4 + IPv6)",
    ["tenant_id"],
)

subscriber_ipv4_only = Gauge(
    "dotmac_subscribers_ipv4_only",
    "Number of IPv4-only subscribers",
    ["tenant_id"],
)

subscriber_ipv6_only = Gauge(
    "dotmac_subscribers_ipv6_only",
    "Number of IPv6-only subscribers",
    ["tenant_id"],
)

dual_stack_percentage = Gauge(
    "dotmac_dual_stack_percentage",
    "Percentage of subscribers with dual-stack configuration",
    ["tenant_id"],
)

# IP allocation metrics
ipv4_allocated = Gauge(
    "dotmac_ipv4_addresses_allocated",
    "Total number of allocated IPv4 addresses",
    ["tenant_id"],
)

ipv6_allocated = Gauge(
    "dotmac_ipv6_addresses_allocated",
    "Total number of allocated IPv6 addresses",
    ["tenant_id"],
)

ipv4_pool_utilization = Gauge(
    "dotmac_ipv4_pool_utilization_percentage",
    "IPv4 address pool utilization percentage",
    ["tenant_id", "pool_name"],
)

ipv6_prefix_utilization = Gauge(
    "dotmac_ipv6_prefix_utilization_percentage",
    "IPv6 prefix pool utilization percentage",
    ["tenant_id", "prefix"],
)

ipv4_available = Gauge(
    "dotmac_ipv4_addresses_available",
    "Number of available IPv4 addresses",
    ["tenant_id"],
)

ipv6_prefixes_available = Gauge(
    "dotmac_ipv6_prefixes_available",
    "Number of available IPv6 prefixes",
    ["tenant_id"],
)

# Traffic metrics
traffic_ipv4_percentage = Gauge(
    "dotmac_traffic_ipv4_percentage",
    "Percentage of traffic over IPv4",
    ["tenant_id"],
)

traffic_ipv6_percentage = Gauge(
    "dotmac_traffic_ipv6_percentage",
    "Percentage of traffic over IPv6",
    ["tenant_id"],
)

bandwidth_ipv4_mbps = Gauge(
    "dotmac_bandwidth_ipv4_mbps",
    "Total IPv4 bandwidth in Mbps",
    ["tenant_id"],
)

bandwidth_ipv6_mbps = Gauge(
    "dotmac_bandwidth_ipv6_mbps",
    "Total IPv6 bandwidth in Mbps",
    ["tenant_id"],
)

# Connectivity metrics
devices_ipv4_reachable = Gauge(
    "dotmac_devices_ipv4_reachable",
    "Number of devices reachable via IPv4",
    ["tenant_id"],
)

devices_ipv6_reachable = Gauge(
    "dotmac_devices_ipv6_reachable",
    "Number of devices reachable via IPv6",
    ["tenant_id"],
)

devices_dual_stack_reachable = Gauge(
    "dotmac_devices_dual_stack_reachable",
    "Number of devices reachable via both IPv4 and IPv6",
    ["tenant_id"],
)

connectivity_ipv4_percentage = Gauge(
    "dotmac_connectivity_ipv4_percentage",
    "Percentage of IPv4 devices that are reachable",
    ["tenant_id"],
)

connectivity_ipv6_percentage = Gauge(
    "dotmac_connectivity_ipv6_percentage",
    "Percentage of IPv6 devices that are reachable",
    ["tenant_id"],
)

# Phase 4: IPv6 Lifecycle Metrics
ipv6_lifecycle_state_total = Gauge(
    "dotmac_ipv6_lifecycle_state_total",
    "Total number of IPv6 prefixes by lifecycle state",
    ["tenant_id", "state"],
)

ipv6_lifecycle_utilization_rate = Gauge(
    "dotmac_ipv6_lifecycle_utilization_rate",
    "Percentage of network profiles with active IPv6 prefixes",
    ["tenant_id"],
)

ipv6_lifecycle_operations_total = Counter(
    "dotmac_ipv6_lifecycle_operations_total",
    "Total number of IPv6 lifecycle operations",
    ["tenant_id", "operation", "status"],
)

ipv6_netbox_integration_rate = Gauge(
    "dotmac_ipv6_netbox_integration_rate",
    "Percentage of IPv6 prefixes tracked in NetBox",
    ["tenant_id"],
)

ipv6_prefix_allocations_active = Gauge(
    "dotmac_ipv6_prefix_allocations_active",
    "Number of active IPv6 prefix allocations",
    ["tenant_id"],
)

ipv6_prefix_allocations_pending = Gauge(
    "dotmac_ipv6_prefix_allocations_pending",
    "Number of pending IPv6 prefix allocations",
    ["tenant_id"],
)

ipv6_prefix_allocations_revoked = Gauge(
    "dotmac_ipv6_prefix_allocations_revoked",
    "Number of revoked IPv6 prefix allocations",
    ["tenant_id"],
)

ipv6_lifecycle_operation_duration = Histogram(
    "dotmac_ipv6_lifecycle_operation_duration_seconds",
    "Duration of IPv6 lifecycle operations in seconds",
    ["tenant_id", "operation"],
)

# Phase 5: IPv4 Lifecycle Metrics
ipv4_lifecycle_operations_total = Counter(
    "dotmac_ipv4_lifecycle_operations_total",
    "Total IPv4 lifecycle operations performed",
    ["tenant_id", "operation", "status"],
)

ipv4_lifecycle_operation_duration = Histogram(
    "dotmac_ipv4_lifecycle_operation_duration_seconds",
    "Duration of IPv4 lifecycle operations in seconds",
    ["tenant_id", "operation"],
)

# Performance metrics
latency_ipv4_ms = Gauge(
    "dotmac_latency_ipv4_milliseconds",
    "Average IPv4 latency in milliseconds",
    ["tenant_id"],
)

latency_ipv6_ms = Gauge(
    "dotmac_latency_ipv6_milliseconds",
    "Average IPv6 latency in milliseconds",
    ["tenant_id"],
)

packet_loss_ipv4_percentage = Gauge(
    "dotmac_packet_loss_ipv4_percentage",
    "Average IPv4 packet loss percentage",
    ["tenant_id"],
)

packet_loss_ipv6_percentage = Gauge(
    "dotmac_packet_loss_ipv6_percentage",
    "Average IPv6 packet loss percentage",
    ["tenant_id"],
)

# WireGuard VPN metrics
wireguard_servers_total = Gauge(
    "dotmac_wireguard_servers_total",
    "Total number of WireGuard servers",
    ["tenant_id"],
)

wireguard_servers_dual_stack = Gauge(
    "dotmac_wireguard_servers_dual_stack",
    "Number of dual-stack WireGuard servers",
    ["tenant_id"],
)

wireguard_peers_total = Gauge(
    "dotmac_wireguard_peers_total",
    "Total number of WireGuard peers",
    ["tenant_id"],
)

wireguard_peers_dual_stack = Gauge(
    "dotmac_wireguard_peers_dual_stack",
    "Number of dual-stack WireGuard peers",
    ["tenant_id"],
)

# Migration metrics
migration_started = Gauge(
    "dotmac_migration_started",
    "Number of subscribers with migration started",
    ["tenant_id"],
)

migration_completed = Gauge(
    "dotmac_migration_completed",
    "Number of subscribers with migration completed",
    ["tenant_id"],
)

migration_failed = Gauge(
    "dotmac_migration_failed",
    "Number of subscribers with migration failed",
    ["tenant_id"],
)

migration_progress_percentage = Gauge(
    "dotmac_migration_progress_percentage",
    "Overall migration progress percentage",
    ["tenant_id"],
)

# Event counters
subscriber_provisioned = Counter(
    "dotmac_subscriber_provisioned_total",
    "Total number of subscriber provisioning operations",
    ["tenant_id", "ip_type"],
)

subscriber_deprovisioned = Counter(
    "dotmac_subscriber_deprovisioned_total",
    "Total number of subscriber deprovisioning operations",
    ["tenant_id", "ip_type"],
)

ip_allocation_success = Counter(
    "dotmac_ip_allocation_success_total",
    "Total number of successful IP allocations",
    ["tenant_id", "ip_version"],
)

ip_allocation_failure = Counter(
    "dotmac_ip_allocation_failure_total",
    "Total number of failed IP allocations",
    ["tenant_id", "ip_version", "reason"],
)

# Latency histogram
latency_histogram = Histogram(
    "dotmac_latency_histogram_milliseconds",
    "Latency distribution in milliseconds",
    ["tenant_id", "ip_version"],
    buckets=(1, 5, 10, 25, 50, 75, 100, 250, 500, 1000, 2500, 5000),
)

# Platform info
platform_info = Info(
    "dotmac_platform",
    "DotMac platform information",
)


class PrometheusExporter:
    """Exports dual-stack metrics to Prometheus."""

    @staticmethod
    def export_metrics(metrics: DualStackMetrics, tenant_id: str = "global") -> None:
        """Export metrics to Prometheus gauges."""
        # Subscriber metrics
        subscriber_total.labels(tenant_id=tenant_id).set(metrics.total_subscribers)
        subscriber_dual_stack.labels(tenant_id=tenant_id).set(metrics.dual_stack_subscribers)
        subscriber_ipv4_only.labels(tenant_id=tenant_id).set(metrics.ipv4_only_subscribers)
        subscriber_ipv6_only.labels(tenant_id=tenant_id).set(metrics.ipv6_only_subscribers)
        dual_stack_percentage.labels(tenant_id=tenant_id).set(metrics.dual_stack_percentage)

        # IP allocation metrics
        ipv4_allocated.labels(tenant_id=tenant_id).set(metrics.total_ipv4_allocated)
        ipv6_allocated.labels(tenant_id=tenant_id).set(metrics.total_ipv6_allocated)
        ipv4_pool_utilization.labels(tenant_id=tenant_id, pool_name="default").set(
            metrics.ipv4_pool_utilization
        )
        ipv6_prefix_utilization.labels(tenant_id=tenant_id, prefix="default").set(
            metrics.ipv6_prefix_utilization
        )
        ipv4_available.labels(tenant_id=tenant_id).set(metrics.available_ipv4_addresses)
        ipv6_prefixes_available.labels(tenant_id=tenant_id).set(metrics.available_ipv6_prefixes)

        # Traffic metrics
        traffic_ipv4_percentage.labels(tenant_id=tenant_id).set(metrics.ipv4_traffic_percentage)
        traffic_ipv6_percentage.labels(tenant_id=tenant_id).set(metrics.ipv6_traffic_percentage)
        bandwidth_ipv4_mbps.labels(tenant_id=tenant_id).set(metrics.ipv4_bandwidth_mbps)
        bandwidth_ipv6_mbps.labels(tenant_id=tenant_id).set(metrics.ipv6_bandwidth_mbps)

        # Connectivity metrics
        devices_ipv4_reachable.labels(tenant_id=tenant_id).set(metrics.ipv4_reachable_devices)
        devices_ipv6_reachable.labels(tenant_id=tenant_id).set(metrics.ipv6_reachable_devices)
        devices_dual_stack_reachable.labels(tenant_id=tenant_id).set(
            metrics.dual_stack_reachable_devices
        )
        connectivity_ipv4_percentage.labels(tenant_id=tenant_id).set(
            metrics.ipv4_connectivity_percentage
        )
        connectivity_ipv6_percentage.labels(tenant_id=tenant_id).set(
            metrics.ipv6_connectivity_percentage
        )

        # Performance metrics
        latency_ipv4_ms.labels(tenant_id=tenant_id).set(metrics.avg_ipv4_latency_ms)
        latency_ipv6_ms.labels(tenant_id=tenant_id).set(metrics.avg_ipv6_latency_ms)
        packet_loss_ipv4_percentage.labels(tenant_id=tenant_id).set(
            metrics.ipv4_packet_loss_percentage
        )
        packet_loss_ipv6_percentage.labels(tenant_id=tenant_id).set(
            metrics.ipv6_packet_loss_percentage
        )

        # WireGuard metrics
        wireguard_servers_total.labels(tenant_id=tenant_id).set(metrics.wireguard_servers)
        wireguard_servers_dual_stack.labels(tenant_id=tenant_id).set(
            metrics.wireguard_dual_stack_servers
        )
        wireguard_peers_total.labels(tenant_id=tenant_id).set(metrics.wireguard_peers)
        wireguard_peers_dual_stack.labels(tenant_id=tenant_id).set(
            metrics.wireguard_dual_stack_peers
        )

        # Migration metrics
        migration_started.labels(tenant_id=tenant_id).set(metrics.migration_started)
        migration_completed.labels(tenant_id=tenant_id).set(metrics.migration_completed)
        migration_failed.labels(tenant_id=tenant_id).set(metrics.migration_failed)
        migration_progress_percentage.labels(tenant_id=tenant_id).set(
            metrics.migration_progress_percentage
        )

        logger.debug(f"Exported metrics for tenant: {tenant_id}")

    @staticmethod
    def record_subscriber_provisioned(tenant_id: str, ip_type: str) -> None:
        """Record a subscriber provisioning event."""
        subscriber_provisioned.labels(tenant_id=tenant_id, ip_type=ip_type).inc()

    @staticmethod
    def record_subscriber_deprovisioned(tenant_id: str, ip_type: str) -> None:
        """Record a subscriber deprovisioning event."""
        subscriber_deprovisioned.labels(tenant_id=tenant_id, ip_type=ip_type).inc()

    @staticmethod
    def record_ip_allocation_success(tenant_id: str, ip_version: str) -> None:
        """Record a successful IP allocation."""
        ip_allocation_success.labels(tenant_id=tenant_id, ip_version=ip_version).inc()

    @staticmethod
    def record_ip_allocation_failure(tenant_id: str, ip_version: str, reason: str) -> None:
        """Record a failed IP allocation."""
        ip_allocation_failure.labels(
            tenant_id=tenant_id, ip_version=ip_version, reason=reason
        ).inc()

    @staticmethod
    def record_latency(tenant_id: str, ip_version: str, latency_ms: float) -> None:
        """Record a latency measurement."""
        latency_histogram.labels(tenant_id=tenant_id, ip_version=ip_version).observe(latency_ms)

    # Phase 4: IPv6 Lifecycle Metrics
    @staticmethod
    def export_ipv6_lifecycle_metrics(lifecycle_summary: dict, tenant_id: str = "global") -> None:
        """
        Export IPv6 lifecycle metrics to Prometheus.

        Args:
            lifecycle_summary: Dictionary from IPv6Metrics.get_ipv6_lifecycle_summary()
            tenant_id: Tenant identifier
        """
        state_counts = lifecycle_summary.get("state_counts", {})
        utilization = lifecycle_summary.get("utilization", {})
        netbox_integration = lifecycle_summary.get("netbox_integration", {})

        # Update state counts for each lifecycle state
        for state, count in state_counts.items():
            ipv6_lifecycle_state_total.labels(tenant_id=tenant_id, state=state).set(count)

        # Update utilization metrics
        ipv6_lifecycle_utilization_rate.labels(tenant_id=tenant_id).set(
            utilization.get("utilization_rate", 0.0)
        )
        ipv6_prefix_allocations_active.labels(tenant_id=tenant_id).set(
            utilization.get("active_prefixes", 0)
        )
        ipv6_prefix_allocations_pending.labels(tenant_id=tenant_id).set(
            state_counts.get("pending", 0)
        )
        ipv6_prefix_allocations_revoked.labels(tenant_id=tenant_id).set(
            utilization.get("revoked_prefixes", 0)
        )

        # Update NetBox integration metrics
        ipv6_netbox_integration_rate.labels(tenant_id=tenant_id).set(
            netbox_integration.get("netbox_integration_rate", 0.0)
        )

        logger.debug(f"Exported IPv6 lifecycle metrics for tenant: {tenant_id}")

    @staticmethod
    def record_ipv6_lifecycle_operation(
        tenant_id: str, operation: str, success: bool, duration_seconds: float | None = None
    ) -> None:
        """
        Record an IPv6 lifecycle operation (allocate, activate, suspend, revoke).

        Args:
            tenant_id: Tenant identifier
            operation: Operation type (allocate, activate, suspend, revoke)
            success: Whether the operation succeeded
            duration_seconds: Optional duration of the operation in seconds
        """
        status = "success" if success else "failed"
        ipv6_lifecycle_operations_total.labels(
            tenant_id=tenant_id, operation=operation, status=status
        ).inc()

        if duration_seconds is not None:
            ipv6_lifecycle_operation_duration.labels(
                tenant_id=tenant_id, operation=operation
            ).observe(duration_seconds)

    @staticmethod
    def record_ipv4_lifecycle_operation(
        tenant_id: str, operation: str, success: bool, duration_seconds: float | None = None
    ) -> None:
        """
        Record an IPv4 lifecycle operation (allocate, activate, suspend, revoke, reactivate).

        Args:
            tenant_id: Tenant identifier
            operation: Operation type (allocate, activate, suspend, reactivate, revoke)
            success: Whether the operation succeeded
            duration_seconds: Optional duration of the operation in seconds
        """
        status = "success" if success else "failed"
        ipv4_lifecycle_operations_total.labels(
            tenant_id=tenant_id, operation=operation, status=status
        ).inc()

        if duration_seconds is not None:
            ipv4_lifecycle_operation_duration.labels(
                tenant_id=tenant_id, operation=operation
            ).observe(duration_seconds)

    @staticmethod
    def set_platform_info(version: str, environment: str) -> None:
        """Set platform information."""
        platform_info.info(
            {
                "version": version,
                "environment": environment,
                "dual_stack_enabled": "true",
            }
        )
