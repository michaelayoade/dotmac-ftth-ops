"""
GraphQL subscriptions for Customer 360° real-time updates.

Uses Redis pub/sub for broadcasting updates to WebSocket connections.
"""

import json
from collections.abc import AsyncGenerator
from typing import cast

import strawberry
import structlog
from redis.asyncio import Redis

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.customer_subscriptions import (
    CustomerActivityUpdate,
    CustomerDeviceUpdate,
    CustomerNetworkStatusUpdate,
    CustomerNoteUpdate,
    CustomerTicketUpdate,
)

logger = structlog.get_logger(__name__)


def _require_redis(context: Context) -> Redis:
    redis_client = getattr(context, "redis", None)
    if redis_client is None:
        raise RuntimeError("Redis client not configured for subscriptions")
    return cast(Redis, redis_client)


@strawberry.type
class CustomerSubscriptions:
    """GraphQL subscriptions for real-time customer data updates."""

    @strawberry.subscription(description="Subscribe to customer network status updates")  # type: ignore[misc]
    async def customer_network_status_updated(
        self,
        info: strawberry.Info[Context],
        customer_id: strawberry.ID,
    ) -> AsyncGenerator[CustomerNetworkStatusUpdate]:
        """
        Subscribe to real-time network status updates for a customer.

        Updates are pushed when:
        - Connection status changes (online/offline/degraded)
        - Signal quality changes significantly
        - Bandwidth usage changes
        - Network metrics update (latency, packet loss, etc.)
        - OLT/PON metrics update

        Args:
            customer_id: Customer UUID to monitor

        Yields:
            CustomerNetworkStatusUpdate: Real-time network status updates
        """
        redis = _require_redis(info.context)
        channel_name = f"customer:{customer_id}:network_status"

        logger.info(
            "customer_network_subscription_started",
            customer_id=customer_id,
            channel=channel_name,
        )

        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_name)

        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        # Parse JSON data from Redis
                        data = json.loads(message["data"])

                        # Convert to GraphQL type
                        update = CustomerNetworkStatusUpdate(
                            customer_id=data["customer_id"],
                            connection_status=data["connection_status"],
                            last_seen_at=data["last_seen_at"],
                            ipv4_address=data.get("ipv4_address"),
                            ipv6_address=data.get("ipv6_address"),
                            mac_address=data.get("mac_address"),
                            vlan_id=data.get("vlan_id"),
                            signal_strength=data.get("signal_strength"),
                            signal_quality=data.get("signal_quality"),
                            uptime_seconds=data.get("uptime_seconds"),
                            uptime_percentage=data.get("uptime_percentage"),
                            bandwidth_usage_mbps=data.get("bandwidth_usage_mbps"),
                            download_speed_mbps=data.get("download_speed_mbps"),
                            upload_speed_mbps=data.get("upload_speed_mbps"),
                            packet_loss=data.get("packet_loss"),
                            latency_ms=data.get("latency_ms"),
                            jitter=data.get("jitter"),
                            ont_rx_power=data.get("ont_rx_power"),
                            ont_tx_power=data.get("ont_tx_power"),
                            olt_rx_power=data.get("olt_rx_power"),
                            service_status=data.get("service_status"),
                            updated_at=data["updated_at"],
                        )

                        logger.debug(
                            "network_status_update_sent",
                            customer_id=customer_id,
                            status=data["connection_status"],
                        )

                        yield update

                    except (json.JSONDecodeError, KeyError) as e:
                        logger.error(
                            "network_status_parse_error",
                            customer_id=customer_id,
                            error=str(e),
                            data=message.get("data"),
                        )
        finally:
            await pubsub.unsubscribe(channel_name)
            logger.info(
                "customer_network_subscription_ended",
                customer_id=customer_id,
            )

    @strawberry.subscription(description="Subscribe to customer device updates")  # type: ignore[misc]
    async def customer_devices_updated(
        self,
        info: strawberry.Info[Context],
        customer_id: strawberry.ID,
    ) -> AsyncGenerator[CustomerDeviceUpdate]:
        """
        Subscribe to real-time device status updates.

        Updates are pushed when:
        - Device comes online/offline
        - Health status changes (healthy/warning/critical)
        - Firmware updated
        - Temperature or performance alerts
        - Signal strength changes significantly

        Args:
            customer_id: Customer UUID to monitor

        Yields:
            CustomerDeviceUpdate: Real-time device status updates
        """
        redis = _require_redis(info.context)
        channel_name = f"customer:{customer_id}:devices"

        logger.info(
            "customer_devices_subscription_started",
            customer_id=customer_id,
            channel=channel_name,
        )

        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_name)

        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])

                        update = CustomerDeviceUpdate(
                            customer_id=data["customer_id"],
                            device_id=data["device_id"],
                            device_type=data["device_type"],
                            device_name=data["device_name"],
                            status=data["status"],
                            health_status=data["health_status"],
                            is_online=data["is_online"],
                            last_seen_at=data.get("last_seen_at"),
                            signal_strength=data.get("signal_strength"),
                            temperature=data.get("temperature"),
                            cpu_usage=data.get("cpu_usage"),
                            memory_usage=data.get("memory_usage"),
                            uptime_seconds=data.get("uptime_seconds"),
                            firmware_version=data.get("firmware_version"),
                            needs_firmware_update=data.get("needs_firmware_update", False),
                            change_type=data["change_type"],
                            previous_value=data.get("previous_value"),
                            new_value=data.get("new_value"),
                            updated_at=data["updated_at"],
                        )

                        logger.debug(
                            "device_update_sent",
                            customer_id=customer_id,
                            device_id=data["device_id"],
                            change_type=data["change_type"],
                        )

                        yield update

                    except (json.JSONDecodeError, KeyError) as e:
                        logger.error(
                            "device_update_parse_error",
                            customer_id=customer_id,
                            error=str(e),
                        )
        finally:
            await pubsub.unsubscribe(channel_name)
            logger.info(
                "customer_devices_subscription_ended",
                customer_id=customer_id,
            )

    @strawberry.subscription(description="Subscribe to customer ticket updates")  # type: ignore[misc]
    async def customer_ticket_updated(
        self,
        info: strawberry.Info[Context],
        customer_id: strawberry.ID,
    ) -> AsyncGenerator[CustomerTicketUpdate]:
        """
        Subscribe to real-time ticket updates.

        Updates are pushed when:
        - New ticket created
        - Ticket status changed
        - Ticket assigned to agent
        - Ticket resolved or closed
        - Comment added to ticket

        Args:
            customer_id: Customer UUID to monitor

        Yields:
            CustomerTicketUpdate: Real-time ticket updates with action type
        """
        redis = _require_redis(info.context)
        channel_name = f"customer:{customer_id}:tickets"

        logger.info(
            "customer_tickets_subscription_started",
            customer_id=customer_id,
            channel=channel_name,
        )

        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_name)

        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        ticket_data = data["ticket"]

                        from dotmac.platform.graphql.types.customer_subscriptions import (
                            CustomerTicketUpdateData,
                        )

                        update = CustomerTicketUpdate(
                            customer_id=data["customer_id"],
                            action=data["action"],
                            ticket=CustomerTicketUpdateData(
                                id=ticket_data["id"],
                                ticket_number=ticket_data["ticket_number"],
                                title=ticket_data["title"],
                                description=ticket_data.get("description"),
                                status=ticket_data["status"],
                                priority=ticket_data["priority"],
                                category=ticket_data.get("category"),
                                sub_category=ticket_data.get("sub_category"),
                                assigned_to=ticket_data.get("assigned_to"),
                                assigned_to_name=ticket_data.get("assigned_to_name"),
                                assigned_team=ticket_data.get("assigned_team"),
                                created_at=ticket_data["created_at"],
                                updated_at=ticket_data["updated_at"],
                                resolved_at=ticket_data.get("resolved_at"),
                                closed_at=ticket_data.get("closed_at"),
                                customer_id=ticket_data["customer_id"],
                                customer_name=ticket_data.get("customer_name"),
                            ),
                            changed_by=data.get("changed_by"),
                            changed_by_name=data.get("changed_by_name"),
                            changes=data.get("changes"),
                            comment=data.get("comment"),
                            updated_at=data["updated_at"],
                        )

                        logger.info(
                            "ticket_update_sent",
                            customer_id=customer_id,
                            ticket_id=ticket_data["id"],
                            action=data["action"],
                        )

                        yield update

                    except (json.JSONDecodeError, KeyError) as e:
                        logger.error(
                            "ticket_update_parse_error",
                            customer_id=customer_id,
                            error=str(e),
                        )
        finally:
            await pubsub.unsubscribe(channel_name)
            logger.info(
                "customer_tickets_subscription_ended",
                customer_id=customer_id,
            )

    @strawberry.subscription(description="Subscribe to customer activity updates")  # type: ignore[misc]
    async def customer_activity_added(
        self,
        info: strawberry.Info[Context],
        customer_id: strawberry.ID,
    ) -> AsyncGenerator[CustomerActivityUpdate]:
        """
        Subscribe to new customer activities.

        Updates are pushed when:
        - New activity added to customer timeline
        - User creates a note or interaction

        Args:
            customer_id: Customer UUID to monitor

        Yields:
            CustomerActivityUpdate: New activity notifications
        """
        redis = _require_redis(info.context)
        channel_name = f"customer:{customer_id}:activities"

        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_name)

        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])

                        update = CustomerActivityUpdate(
                            id=data["id"],
                            customer_id=data["customer_id"],
                            activity_type=data["activity_type"],
                            title=data["title"],
                            description=data.get("description"),
                            performed_by=data.get("performed_by"),
                            performed_by_name=data.get("performed_by_name"),
                            created_at=data["created_at"],
                        )

                        yield update

                    except (json.JSONDecodeError, KeyError) as e:
                        logger.error(
                            "activity_update_parse_error",
                            customer_id=customer_id,
                            error=str(e),
                        )
        finally:
            await pubsub.unsubscribe(channel_name)

    @strawberry.subscription(description="Subscribe to customer note updates")  # type: ignore[misc]
    async def customer_note_updated(
        self,
        info: strawberry.Info[Context],
        customer_id: strawberry.ID,
    ) -> AsyncGenerator[CustomerNoteUpdate]:
        """
        Subscribe to customer note updates.

        Updates are pushed when:
        - New note created
        - Note updated
        - Note deleted

        Args:
            customer_id: Customer UUID to monitor

        Yields:
            CustomerNoteUpdate: Note update notifications
        """
        redis = _require_redis(info.context)
        channel_name = f"customer:{customer_id}:notes"

        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_name)

        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])

                        from dotmac.platform.graphql.types.customer_subscriptions import (
                            CustomerNoteData,
                        )

                        note_data = data.get("note")
                        note = None
                        if note_data:
                            note = CustomerNoteData(
                                id=note_data["id"],
                                customer_id=note_data["customer_id"],
                                subject=note_data["subject"],
                                content=note_data["content"],
                                is_internal=note_data["is_internal"],
                                created_by_id=note_data["created_by_id"],
                                created_by_name=note_data.get("created_by_name"),
                                created_at=note_data["created_at"],
                                updated_at=note_data["updated_at"],
                            )

                        update = CustomerNoteUpdate(
                            customer_id=data["customer_id"],
                            action=data["action"],
                            note=note,
                            changed_by=data["changed_by"],
                            changed_by_name=data.get("changed_by_name"),
                            updated_at=data["updated_at"],
                        )

                        yield update

                    except (json.JSONDecodeError, KeyError) as e:
                        logger.error(
                            "note_update_parse_error",
                            customer_id=customer_id,
                            error=str(e),
                        )
        finally:
            await pubsub.unsubscribe(channel_name)
