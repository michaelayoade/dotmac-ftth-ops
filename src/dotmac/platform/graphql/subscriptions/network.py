"""
GraphQL subscriptions for Network Monitoring real-time updates.

Uses Redis pub/sub for broadcasting device status updates and network alerts
to WebSocket connections.
"""

import json
from collections.abc import AsyncGenerator
from typing import cast

import strawberry
import structlog
from redis.asyncio import Redis

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.network import (
    AlertSeverityEnum,
    DeviceStatusEnum,
    DeviceTypeEnum,
)
from dotmac.platform.graphql.types.network_subscriptions import (
    DeviceUpdate,
    NetworkAlertUpdate,
)

logger = structlog.get_logger(__name__)


@strawberry.type
class NetworkSubscriptions:
    """GraphQL subscriptions for real-time network monitoring updates."""

    @strawberry.subscription(description="Subscribe to device status and metrics updates")  # type: ignore[misc]
    async def device_updated(
        self,
        info: strawberry.Info[Context],
        device_type: DeviceTypeEnum | None = None,
        status: DeviceStatusEnum | None = None,
    ) -> AsyncGenerator[DeviceUpdate]:
        """
        Subscribe to real-time device updates.

        Updates are pushed when:
        - Device status changes (online/offline/degraded)
        - Health metrics update (CPU, memory, temperature)
        - Firmware version changes
        - Connectivity metrics change (latency, packet loss)
        - Device comes online or goes offline

        Args:
            device_type: Optional filter by device type (OLT, ONU, CPE, etc.)
            status: Optional filter by device status (online, offline, degraded)

        Yields:
            DeviceUpdate: Real-time device status and metrics updates
        """
        redis_client = getattr(info.context, "redis", None)
        if redis_client is None:
            raise RuntimeError("Redis client not configured for subscriptions")
        redis: Redis = cast(Redis, redis_client)
        tenant_id = info.context.get_active_tenant_id()

        # Build channel pattern for filtering
        if device_type and status:
            channel_pattern = f"network:devices:{tenant_id}:{device_type.value}:{status.value}"
        elif device_type:
            channel_pattern = f"network:devices:{tenant_id}:{device_type.value}:*"
        elif status:
            channel_pattern = f"network:devices:{tenant_id}:*:{status.value}"
        else:
            channel_pattern = f"network:devices:{tenant_id}:*"

        logger.info(
            "device_subscription_started",
            tenant_id=tenant_id,
            device_type=device_type.value if device_type else None,
            status=status.value if status else None,
            channel_pattern=channel_pattern,
        )

        pubsub = redis.pubsub()

        # Subscribe to the device updates channel
        if "*" in channel_pattern:
            # Use pattern matching for wildcard subscriptions
            await pubsub.psubscribe(channel_pattern)
        else:
            await pubsub.subscribe(channel_pattern)

        try:
            async for message in pubsub.listen():
                if message["type"] in ("message", "pmessage"):
                    try:
                        # Parse JSON data from Redis
                        data = json.loads(message["data"])

                        # Apply filters if specified
                        if device_type and data.get("device_type") != device_type.value:
                            continue
                        if status and data.get("status") != status.value:
                            continue

                        # Convert to GraphQL type
                        update = DeviceUpdate(
                            device_id=data["device_id"],
                            device_name=data["device_name"],
                            device_type=DeviceTypeEnum(data["device_type"]),
                            status=DeviceStatusEnum(data["status"]),
                            ip_address=data.get("ip_address"),
                            firmware_version=data.get("firmware_version"),
                            model=data.get("model"),
                            location=data.get("location"),
                            tenant_id=data["tenant_id"],
                            cpu_usage_percent=data.get("cpu_usage_percent"),
                            memory_usage_percent=data.get("memory_usage_percent"),
                            temperature_celsius=data.get("temperature_celsius"),
                            power_status=data.get("power_status"),
                            ping_latency_ms=data.get("ping_latency_ms"),
                            packet_loss_percent=data.get("packet_loss_percent"),
                            uptime_seconds=data.get("uptime_seconds"),
                            uptime_days=data.get("uptime_days"),
                            last_seen=data.get("last_seen"),
                            is_healthy=data.get("is_healthy", False),
                            change_type=data.get("change_type", "metric_update"),
                            previous_value=data.get("previous_value"),
                            new_value=data.get("new_value"),
                            updated_at=data["updated_at"],
                        )

                        logger.debug(
                            "device_update_sent",
                            tenant_id=tenant_id,
                            device_id=data["device_id"],
                            device_type=data["device_type"],
                            status=data["status"],
                            change_type=data.get("change_type"),
                        )

                        yield update

                    except (json.JSONDecodeError, KeyError, ValueError) as e:
                        logger.error(
                            "device_update_parse_error",
                            tenant_id=tenant_id,
                            error=str(e),
                            data=message.get("data"),
                        )
        finally:
            if "*" in channel_pattern:
                await pubsub.punsubscribe(channel_pattern)
            else:
                await pubsub.unsubscribe(channel_pattern)
            logger.info(
                "device_subscription_ended",
                tenant_id=tenant_id,
            )

    @strawberry.subscription(description="Subscribe to network alert updates")  # type: ignore[misc]
    async def network_alert_updated(
        self,
        info: strawberry.Info[Context],
        severity: AlertSeverityEnum | None = None,
        device_id: str | None = None,
    ) -> AsyncGenerator[NetworkAlertUpdate]:
        """
        Subscribe to real-time network alert notifications.

        Updates are pushed when:
        - New alert is triggered
        - Alert severity changes
        - Alert is acknowledged by operator
        - Alert is resolved
        - Alert is deleted

        Args:
            severity: Optional filter by alert severity (critical, warning, info)
            device_id: Optional filter by specific device

        Yields:
            NetworkAlertUpdate: Real-time alert notifications with action type
        """
        redis_client = getattr(info.context, "redis", None)
        if redis_client is None:
            raise RuntimeError("Redis client not configured for subscriptions")
        redis: Redis = cast(Redis, redis_client)
        tenant_id = info.context.get_active_tenant_id()

        # Build channel name for filtering
        if device_id:
            channel_name = f"network:alerts:{tenant_id}:device:{device_id}"
        else:
            channel_name = f"network:alerts:{tenant_id}:*"

        logger.info(
            "alert_subscription_started",
            tenant_id=tenant_id,
            severity=severity.value if severity else None,
            device_id=device_id,
            channel=channel_name,
        )

        pubsub = redis.pubsub()

        # Subscribe to the alerts channel
        if "*" in channel_name:
            await pubsub.psubscribe(channel_name)
        else:
            await pubsub.subscribe(channel_name)

        try:
            async for message in pubsub.listen():
                if message["type"] in ("message", "pmessage"):
                    try:
                        # Parse JSON data from Redis
                        data = json.loads(message["data"])
                        alert_data = data["alert"]

                        # Apply severity filter if specified
                        if severity and alert_data.get("severity") != severity.value:
                            continue

                        # Import NetworkAlert here to avoid circular imports
                        from dotmac.platform.graphql.types.network import NetworkAlert

                        # Convert alert data to GraphQL type
                        alert = NetworkAlert(
                            alert_id=alert_data["alert_id"],
                            severity=AlertSeverityEnum(alert_data["severity"]),
                            title=alert_data["title"],
                            description=alert_data["description"],
                            device_id=alert_data.get("device_id"),
                            device_name=alert_data.get("device_name"),
                            device_type=(
                                DeviceTypeEnum(alert_data["device_type"])
                                if alert_data.get("device_type")
                                else None
                            ),
                            triggered_at=alert_data["triggered_at"],
                            acknowledged_at=alert_data.get("acknowledged_at"),
                            resolved_at=alert_data.get("resolved_at"),
                            is_active=alert_data.get("is_active", True),
                            is_acknowledged=alert_data.get("is_acknowledged", False),
                            metric_name=alert_data.get("metric_name"),
                            threshold_value=alert_data.get("threshold_value"),
                            current_value=alert_data.get("current_value"),
                            alert_rule_id=alert_data.get("alert_rule_id"),
                            tenant_id=alert_data["tenant_id"],
                        )

                        update = NetworkAlertUpdate(
                            action=data["action"],
                            alert=alert,
                            updated_at=data["updated_at"],
                        )

                        logger.info(
                            "alert_update_sent",
                            tenant_id=tenant_id,
                            alert_id=alert_data["alert_id"],
                            action=data["action"],
                            severity=alert_data["severity"],
                        )

                        yield update

                    except (json.JSONDecodeError, KeyError, ValueError) as e:
                        logger.error(
                            "alert_update_parse_error",
                            tenant_id=tenant_id,
                            error=str(e),
                            data=message.get("data"),
                        )
        finally:
            if "*" in channel_name:
                await pubsub.punsubscribe(channel_name)
            else:
                await pubsub.unsubscribe(channel_name)
            logger.info(
                "alert_subscription_ended",
                tenant_id=tenant_id,
            )
