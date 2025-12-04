"""
IPv6 Lifecycle Metrics (Phase 4).

Provides Prometheus metrics for IPv6 prefix lifecycle tracking:
- IPv6 prefix utilization by state
- IPv6 lifecycle transition counters
- IPv6 allocation/revocation rates
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

import structlog
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.network.models import IPv6LifecycleState, SubscriberNetworkProfile

logger = structlog.get_logger(__name__)


class IPv6Metrics:
    """
    IPv6 lifecycle metrics service.

    Tracks IPv6 prefix allocation, utilization, and lifecycle transitions
    for Prometheus monitoring and alerting.
    """

    def __init__(self, session: AsyncSession, tenant_id: str | None = None):
        self.session = session
        self.tenant_id = tenant_id

    async def get_ipv6_state_counts(self) -> dict[str, int]:
        """
        Get count of IPv6 prefixes by lifecycle state.

        Returns:
            Dict mapping state names to counts (e.g., {"active": 150, "allocated": 25})
        """
        stmt = select(
            SubscriberNetworkProfile.ipv6_state,
            func.count(SubscriberNetworkProfile.id).label("count"),
        ).group_by(SubscriberNetworkProfile.ipv6_state)

        if self.tenant_id:
            stmt = stmt.where(SubscriberNetworkProfile.tenant_id == self.tenant_id)

        result = await self.session.execute(stmt)
        rows = result.all()

        # Convert to dict with state name as key
        state_counts: dict[str, int] = defaultdict(int)
        for state, count in rows:
            if state:
                state_counts[state.value] = count

        # Ensure all states are present (even with 0 count)
        for state in IPv6LifecycleState:
            if state.value not in state_counts:
                state_counts[state.value] = 0

        return dict(state_counts)

    async def get_ipv6_utilization_stats(self) -> dict[str, Any]:
        """
        Get comprehensive IPv6 prefix utilization statistics.

        Returns:
            Dict with utilization metrics including:
            - total_profiles: Total network profiles
            - total_with_ipv6: Profiles with IPv6 enabled
            - active_prefixes: Prefixes in ACTIVE state
            - allocated_not_active: Prefixes allocated but not yet active
            - revoked_prefixes: Prefixes that have been revoked
            - utilization_rate: Percentage of profiles with active IPv6
        """
        stmt = select(
            func.count(SubscriberNetworkProfile.id).label("total"),
            func.count(SubscriberNetworkProfile.delegated_ipv6_prefix).label("with_prefix"),
            func.sum(
                case(
                    (SubscriberNetworkProfile.ipv6_state == IPv6LifecycleState.ACTIVE, 1),
                    else_=0,
                )
            ).label("active"),
            func.sum(
                case(
                    (SubscriberNetworkProfile.ipv6_state == IPv6LifecycleState.ALLOCATED, 1),
                    else_=0,
                )
            ).label("allocated"),
            func.sum(
                case(
                    (SubscriberNetworkProfile.ipv6_state == IPv6LifecycleState.REVOKED, 1),
                    else_=0,
                )
            ).label("revoked"),
        )

        if self.tenant_id:
            stmt = stmt.where(SubscriberNetworkProfile.tenant_id == self.tenant_id)

        result = await self.session.execute(stmt)
        row = result.one()

        total = row.total or 0
        with_prefix = row.with_prefix or 0
        active = row.active or 0
        allocated = row.allocated or 0
        revoked = row.revoked or 0

        utilization_rate = (active / total * 100) if total > 0 else 0.0

        return {
            "total_profiles": total,
            "total_with_ipv6": with_prefix,
            "active_prefixes": active,
            "allocated_not_active": allocated,
            "revoked_prefixes": revoked,
            "utilization_rate": round(utilization_rate, 2),
        }

    async def get_ipv6_netbox_integration_stats(self) -> dict[str, Any]:
        """
        Get statistics on NetBox integration for IPv6 prefixes.

        Returns:
            Dict with NetBox integration metrics:
            - prefixes_with_netbox_id: Count of prefixes tracked in NetBox
            - prefixes_without_netbox_id: Count of prefixes not in NetBox
            - netbox_integration_rate: Percentage of prefixes tracked in NetBox
        """
        stmt = select(
            func.count(SubscriberNetworkProfile.id).label("total"),
            func.count(SubscriberNetworkProfile.ipv6_netbox_prefix_id).label("with_netbox"),
        ).where(SubscriberNetworkProfile.delegated_ipv6_prefix.isnot(None))

        if self.tenant_id:
            stmt = stmt.where(SubscriberNetworkProfile.tenant_id == self.tenant_id)

        result = await self.session.execute(stmt)
        row = result.one()

        total = row.total or 0
        with_netbox = row.with_netbox or 0
        without_netbox = total - with_netbox

        integration_rate = (with_netbox / total * 100) if total > 0 else 0.0

        return {
            "prefixes_with_netbox_id": with_netbox,
            "prefixes_without_netbox_id": without_netbox,
            "netbox_integration_rate": round(integration_rate, 2),
        }

    async def get_ipv6_lifecycle_summary(self) -> dict[str, Any]:
        """
        Get comprehensive IPv6 lifecycle summary for monitoring dashboards.

        Returns:
            Dict with all IPv6 lifecycle metrics combined
        """
        state_counts = await self.get_ipv6_state_counts()
        utilization = await self.get_ipv6_utilization_stats()
        netbox_stats = await self.get_ipv6_netbox_integration_stats()

        return {
            "state_counts": state_counts,
            "utilization": utilization,
            "netbox_integration": netbox_stats,
        }


# Prometheus metric labels for IPv6 lifecycle events
IPV6_METRIC_LABELS = {
    "allocation_success": {
        "operation": "allocate",
        "status": "success",
    },
    "allocation_failed": {
        "operation": "allocate",
        "status": "failed",
    },
    "activation_success": {
        "operation": "activate",
        "status": "success",
    },
    "activation_failed": {
        "operation": "activate",
        "status": "failed",
    },
    "suspension_success": {
        "operation": "suspend",
        "status": "success",
    },
    "suspension_failed": {
        "operation": "suspend",
        "status": "failed",
    },
    "revocation_success": {
        "operation": "revoke",
        "status": "success",
    },
    "revocation_failed": {
        "operation": "revoke",
        "status": "failed",
    },
}


def get_ipv6_metric_labels(
    operation: str, success: bool, tenant_id: str | None = None
) -> dict[str, str]:
    """
    Get Prometheus metric labels for IPv6 lifecycle operations.

    Args:
        operation: Operation type (allocate, activate, suspend, revoke)
        success: Whether the operation succeeded
        tenant_id: Optional tenant identifier

    Returns:
        Dict of metric labels
    """
    labels = {
        "operation": operation,
        "status": "success" if success else "failed",
    }

    if tenant_id:
        labels["tenant"] = tenant_id

    return labels
