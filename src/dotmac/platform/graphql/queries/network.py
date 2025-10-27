"""
GraphQL queries for Network Monitoring & Bandwidth.

Provides efficient network monitoring queries with conditional loading of traffic
and alerts via DataLoaders to prevent N+1 queries.
"""

import strawberry
import structlog

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.network import (
    AlertConnection,
    AlertSeverityEnum,
    DeviceConnection,
    DeviceHealth,
    DeviceMetrics,
    DeviceStatusEnum,
    DeviceTypeEnum,
    NetworkAlert,
    NetworkOverview,
    TrafficStats,
)
from dotmac.platform.network_monitoring.schemas import (
    DeviceType as DeviceTypePydantic,
)
from dotmac.platform.network_monitoring.service import NetworkMonitoringService

logger = structlog.get_logger(__name__)


@strawberry.type
class NetworkQueries:
    """GraphQL queries for network monitoring and bandwidth management."""

    @strawberry.field(description="Get comprehensive network overview dashboard")  # type: ignore[misc]
    async def network_overview(
        self,
        info: strawberry.Info[Context],
    ) -> NetworkOverview:
        """
        Get network monitoring overview with device counts, alerts, and bandwidth.

        This is the primary dashboard query that aggregates all network metrics
        in a single efficient request.

        Returns:
            NetworkOverview with aggregated metrics
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        tenant_id = info.context.current_user.tenant_id
        if not tenant_id:
            raise Exception("User must belong to a tenant")

        # Get monitoring service
        # Note: In production, service would be injected via dependency injection
        service = NetworkMonitoringService(
            tenant_id=tenant_id,
            session=info.context.db,
        )

        # Fetch overview from service
        overview_model = await service.get_network_overview(tenant_id)

        # Convert to GraphQL type
        return NetworkOverview.from_model(overview_model)

    @strawberry.field(description="List network devices with optional filters")  # type: ignore[misc]
    async def network_devices(
        self,
        info: strawberry.Info[Context],
        page: int = 1,
        page_size: int = 20,
        device_type: DeviceTypeEnum | None = None,
        status: DeviceStatusEnum | None = None,
        search: str | None = None,
        include_traffic: bool = False,
        include_alerts: bool = False,
    ) -> DeviceConnection:
        """
        List network devices with filtering and pagination.

        Args:
            page: Page number (1-indexed)
            page_size: Items per page (default: 20, max: 100)
            device_type: Filter by device type (OLT, ONU, CPE, etc.)
            status: Filter by device status (online, offline, degraded)
            search: Search by device name or IP address
            include_traffic: Batch load traffic data via DataLoader
            include_alerts: Batch load alerts via DataLoader

        Returns:
            DeviceConnection with paginated devices
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        tenant_id = info.context.current_user.tenant_id
        if not tenant_id:
            raise Exception("User must belong to a tenant")

        # Limit page_size
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        # Get monitoring service
        service = NetworkMonitoringService(
            tenant_id=tenant_id,
            session=info.context.db,
        )

        # Convert GraphQL enum to Pydantic enum if provided
        device_type_filter = None
        if device_type:
            device_type_filter = DeviceTypePydantic(device_type.value)

        # Fetch devices from service
        devices_list = await service.get_all_devices(tenant_id, device_type_filter)

        # Apply status filter
        if status:
            devices_list = [d for d in devices_list if d.status.value == status.value]

        # Apply search filter
        if search:
            search_lower = search.lower()
            devices_list = [
                d
                for d in devices_list
                if search_lower in d.device_name.lower()
                or (d.ip_address and search_lower in d.ip_address.lower())
            ]

        # Calculate pagination
        total_count = len(devices_list)
        paginated_devices = devices_list[offset : offset + page_size]

        # Convert to GraphQL types
        devices = [DeviceHealth.from_model(d) for d in paginated_devices]

        # Conditionally batch load traffic data
        if include_traffic and paginated_devices:
            device_ids = [d.device_id for d in paginated_devices]
            traffic_loader = info.context.loaders.get_device_traffic_loader()
            _ = await traffic_loader.load_many(device_ids)

            # Note: Traffic data would be attached to a more comprehensive DeviceMetrics type
            # For now, this demonstrates the batching pattern

        # Conditionally batch load alerts
        if include_alerts and paginated_devices:
            device_ids = [d.device_id for d in paginated_devices]
            alerts_loader = info.context.loaders.get_device_alerts_loader()
            _ = await alerts_loader.load_many(device_ids)

            # Alerts would be attached to device objects in a more comprehensive implementation

        return DeviceConnection(
            devices=devices,
            total_count=total_count,
            has_next_page=(offset + page_size) < total_count,
            has_prev_page=page > 1,
            page=page,
            page_size=page_size,
        )

    @strawberry.field(description="Get device health status by ID")  # type: ignore[misc]
    async def device_health(
        self,
        info: strawberry.Info[Context],
        device_id: str,
        device_type: DeviceTypeEnum,
    ) -> DeviceHealth | None:
        """
        Get health status for a specific device.

        Args:
            device_id: Device identifier
            device_type: Type of device (for routing to correct backend)

        Returns:
            DeviceHealth with current status and metrics
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        tenant_id = info.context.current_user.tenant_id
        if not tenant_id:
            raise Exception("User must belong to a tenant")

        # Get monitoring service
        service = NetworkMonitoringService(
            tenant_id=tenant_id,
            session=info.context.db,
        )

        # Convert GraphQL enum to Pydantic enum
        device_type_pydantic = DeviceTypePydantic(device_type.value)

        # Fetch device health
        health_model = await service.get_device_health(device_id, device_type_pydantic, tenant_id)

        if not health_model:
            return None

        return DeviceHealth.from_model(health_model)

    @strawberry.field(description="Get device traffic and bandwidth statistics")  # type: ignore[misc]
    async def device_traffic(
        self,
        info: strawberry.Info[Context],
        device_id: str,
        device_type: DeviceTypeEnum,
        include_interfaces: bool = False,
    ) -> TrafficStats | None:
        """
        Get traffic and bandwidth statistics for a device.

        Args:
            device_id: Device identifier
            device_type: Type of device
            include_interfaces: Include per-interface statistics

        Returns:
            TrafficStats with bandwidth usage and interface details
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        tenant_id = info.context.current_user.tenant_id
        if not tenant_id:
            raise Exception("User must belong to a tenant")

        # Get monitoring service
        service = NetworkMonitoringService(
            tenant_id=tenant_id,
            session=info.context.db,
        )

        # Convert GraphQL enum to Pydantic enum
        device_type_pydantic = DeviceTypePydantic(device_type.value)

        # Fetch traffic stats
        traffic_model = await service.get_traffic_stats(device_id, device_type_pydantic, tenant_id)

        if not traffic_model:
            return None

        return TrafficStats.from_model(traffic_model, include_interfaces=include_interfaces)

    @strawberry.field(
        description="Get comprehensive device metrics (health + traffic + device-specific)"
    )  # type: ignore[misc]
    async def device_metrics(
        self,
        info: strawberry.Info[Context],
        device_id: str,
        device_type: DeviceTypeEnum,
        include_interfaces: bool = False,
    ) -> DeviceMetrics | None:
        """
        Get comprehensive metrics for a device.

        This combines health, traffic, and device-specific metrics (ONU, CPE, etc.)
        in a single query.

        Args:
            device_id: Device identifier
            device_type: Type of device
            include_interfaces: Include per-interface statistics

        Returns:
            DeviceMetrics with all available data
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        tenant_id = info.context.current_user.tenant_id
        if not tenant_id:
            raise Exception("User must belong to a tenant")

        # Get monitoring service
        service = NetworkMonitoringService(
            tenant_id=tenant_id,
            session=info.context.db,
        )

        # Convert GraphQL enum to Pydantic enum
        device_type_pydantic = DeviceTypePydantic(device_type.value)

        # Fetch comprehensive metrics
        metrics_model = await service.get_device_metrics(device_id, device_type_pydantic, tenant_id)

        if not metrics_model:
            return None

        return DeviceMetrics.from_model(metrics_model)

    @strawberry.field(description="List network alerts with filtering")  # type: ignore[misc]
    async def network_alerts(
        self,
        info: strawberry.Info[Context],
        page: int = 1,
        page_size: int = 50,
        severity: AlertSeverityEnum | None = None,
        active_only: bool = True,
        device_id: str | None = None,
        device_type: DeviceTypeEnum | None = None,
    ) -> AlertConnection:
        """
        List network monitoring alerts with filtering.

        Args:
            page: Page number (1-indexed)
            page_size: Items per page (default: 50, max: 200)
            severity: Filter by severity (critical, warning, info)
            active_only: Show only active/unresolved alerts
            device_id: Filter by specific device
            device_type: Filter by device type

        Returns:
            AlertConnection with paginated alerts
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        tenant_id = info.context.current_user.tenant_id
        if not tenant_id:
            raise Exception("User must belong to a tenant")

        # Limit page_size
        page_size = min(page_size, 200)
        offset = (page - 1) * page_size

        # Get monitoring service
        service = NetworkMonitoringService(
            tenant_id=tenant_id,
            session=info.context.db,
        )

        # Convert GraphQL enums to Pydantic enums if provided
        from dotmac.platform.network_monitoring.schemas import AlertSeverity

        severity_filter = None
        if severity:
            severity_filter = AlertSeverity(severity.value)

        # Fetch alerts from service
        alerts_list = await service.get_alerts(
            tenant_id=tenant_id,
            severity=severity_filter,
            active_only=active_only,
            device_id=device_id,
            limit=1000,  # Fetch more for local filtering
        )

        # Apply device_type filter locally (service doesn't support this filter)
        if device_type:
            alerts_list = [
                a for a in alerts_list if a.device_type and a.device_type.value == device_type.value
            ]

        # Calculate pagination
        total_count = len(alerts_list)
        paginated_alerts = alerts_list[offset : offset + page_size]

        # Convert to GraphQL types
        alerts = [NetworkAlert.from_model(a) for a in paginated_alerts]

        return AlertConnection(
            alerts=alerts,
            total_count=total_count,
            has_next_page=(offset + page_size) < total_count,
            has_prev_page=page > 1,
            page=page,
            page_size=page_size,
        )

    @strawberry.field(description="Get alert by ID")  # type: ignore[misc]
    async def network_alert(
        self,
        info: strawberry.Info[Context],
        alert_id: str,
    ) -> NetworkAlert | None:
        """
        Get a specific alert by ID.

        Args:
            alert_id: Alert identifier

        Returns:
            NetworkAlert or None if not found
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        tenant_id = info.context.current_user.tenant_id
        if not tenant_id:
            raise Exception("User must belong to a tenant")

        # Get monitoring service
        service = NetworkMonitoringService(
            tenant_id=tenant_id,
            session=info.context.db,
        )

        # Fetch all alerts and find the specific one
        # Note: In a real implementation, the service would have a get_alert_by_id method
        alerts_list = await service.get_alerts(
            tenant_id=tenant_id,
            severity=None,
            active_only=False,
            device_id=None,
            limit=1000,
        )

        alert_model = next((a for a in alerts_list if a.alert_id == alert_id), None)

        if not alert_model:
            return None

        return NetworkAlert.from_model(alert_model)


__all__ = ["NetworkQueries"]
