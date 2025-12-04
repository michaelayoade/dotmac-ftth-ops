"""
Customer Event Publisher for Real-Time Updates.

Publishes customer-related events to Redis pub/sub for GraphQL subscriptions.
"""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any
from uuid import UUID

import structlog

if TYPE_CHECKING:
    from redis.asyncio import Redis

logger = structlog.get_logger(__name__)


class CustomerEventPublisher:
    """
    Publishes customer-related events to Redis for real-time GraphQL subscriptions.

    Uses Redis pub/sub to broadcast events to all connected WebSocket clients
    subscribed to specific customer channels.
    """

    def __init__(self, redis: Redis):
        """
        Initialize the customer event publisher.

        Args:
            redis: Redis async client for pub/sub
        """
        self.redis = redis

    def _serialize_value(self, value: Any) -> Any:
        """Convert values to JSON-serializable format."""
        if isinstance(value, (datetime,)):
            return value.isoformat()
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, UUID):
            return str(value)
        return value

    def _serialize_dict(self, data: dict[str, Any]) -> dict[str, Any]:
        """Recursively serialize dictionary for JSON."""
        return {k: self._serialize_value(v) for k, v in data.items() if v is not None}

    async def publish_network_status_update(
        self,
        customer_id: str,
        connection_status: str,
        network_data: dict[str, Any],
    ) -> None:
        """
        Publish network status update for a customer.

        Args:
            customer_id: Customer UUID
            connection_status: "online" | "offline" | "degraded"
            network_data: Dictionary with network metrics

        Example:
            await publisher.publish_network_status_update(
                customer_id="cust-123",
                connection_status="online",
                network_data={
                    "ipv4_address": "10.0.0.1",
                    "signal_strength": 85,
                    "bandwidth_usage_mbps": 45.5,
                    "latency_ms": 12,
                    ...
                }
            )
        """
        channel = f"customer:{customer_id}:network_status"

        payload = {
            "customer_id": customer_id,
            "connection_status": connection_status,
            "last_seen_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            **self._serialize_dict(network_data),
        }

        try:
            await self.redis.publish(channel, json.dumps(payload))
            logger.debug(
                "network_status_published",
                customer_id=customer_id,
                status=connection_status,
                channel=channel,
            )
        except Exception as e:
            logger.error(
                "network_status_publish_failed",
                customer_id=customer_id,
                error=str(e),
            )

    async def publish_device_update(
        self,
        customer_id: str,
        device_id: str,
        device_type: str,
        device_name: str,
        status: str,
        health_status: str,
        is_online: bool,
        change_type: str,
        previous_value: str | None = None,
        new_value: str | None = None,
        metrics: dict[str, Any] | None = None,
    ) -> None:
        """
        Publish device status update.

        Args:
            customer_id: Customer UUID
            device_id: Device UUID
            device_type: "ONT" | "Router" | "CPE" | "Modem"
            device_name: Device name
            status: "active" | "inactive" | "faulty"
            health_status: "healthy" | "warning" | "critical"
            is_online: Boolean online status
            change_type: "status" | "health" | "performance" | "firmware"
            previous_value: Previous value of changed field
            new_value: New value of changed field
            metrics: Optional device metrics (signal, temp, cpu, etc.)
        """
        channel = f"customer:{customer_id}:devices"

        payload = {
            "customer_id": customer_id,
            "device_id": device_id,
            "device_type": device_type,
            "device_name": device_name,
            "status": status,
            "health_status": health_status,
            "is_online": is_online,
            "last_seen_at": datetime.utcnow().isoformat() if is_online else None,
            "change_type": change_type,
            "previous_value": previous_value,
            "new_value": new_value,
            "updated_at": datetime.utcnow().isoformat(),
        }

        # Add metrics if provided
        if metrics:
            payload.update(self._serialize_dict(metrics))

        try:
            await self.redis.publish(channel, json.dumps(payload))
            logger.info(
                "device_update_published",
                customer_id=customer_id,
                device_id=device_id,
                change_type=change_type,
            )
        except Exception as e:
            logger.error(
                "device_update_publish_failed",
                customer_id=customer_id,
                device_id=device_id,
                error=str(e),
            )

    async def publish_ticket_update(
        self,
        customer_id: str,
        action: str,
        ticket_data: dict[str, Any],
        changed_by: str | None = None,
        changed_by_name: str | None = None,
        changes: list[str] | None = None,
        comment: str | None = None,
    ) -> None:
        """
        Publish ticket update.

        Args:
            customer_id: Customer UUID
            action: "created" | "updated" | "assigned" | "resolved" | "closed" | "commented"
            ticket_data: Ticket data dictionary
            changed_by: User ID who made the change
            changed_by_name: User name who made the change
            changes: List of changes made (e.g., ["status: open -> resolved"])
            comment: Comment text if action is "commented"
        """
        channel = f"customer:{customer_id}:tickets"

        payload = {
            "customer_id": customer_id,
            "action": action,
            "ticket": self._serialize_dict(ticket_data),
            "changed_by": changed_by,
            "changed_by_name": changed_by_name,
            "changes": changes,
            "comment": comment,
            "updated_at": datetime.utcnow().isoformat(),
        }

        try:
            await self.redis.publish(channel, json.dumps(payload))
            logger.info(
                "ticket_update_published",
                customer_id=customer_id,
                ticket_id=ticket_data.get("id"),
                action=action,
            )
        except Exception as e:
            logger.error(
                "ticket_update_publish_failed",
                customer_id=customer_id,
                error=str(e),
            )

    async def publish_activity(
        self,
        customer_id: str,
        activity_data: dict[str, Any],
    ) -> None:
        """
        Publish new customer activity.

        Args:
            customer_id: Customer UUID
            activity_data: Activity data dictionary with id, type, title, description, etc.
        """
        channel = f"customer:{customer_id}:activities"

        payload = self._serialize_dict(activity_data)
        payload["customer_id"] = customer_id

        try:
            await self.redis.publish(channel, json.dumps(payload))
            logger.debug(
                "activity_published",
                customer_id=customer_id,
                activity_id=activity_data.get("id"),
            )
        except Exception as e:
            logger.error(
                "activity_publish_failed",
                customer_id=customer_id,
                error=str(e),
            )

    async def publish_note_update(
        self,
        customer_id: str,
        action: str,
        note_data: dict[str, Any] | None,
        changed_by: str,
        changed_by_name: str | None = None,
    ) -> None:
        """
        Publish note update.

        Args:
            customer_id: Customer UUID
            action: "created" | "updated" | "deleted"
            note_data: Note data dictionary (None if deleted)
            changed_by: User ID who made the change
            changed_by_name: User name who made the change
        """
        channel = f"customer:{customer_id}:notes"

        payload = {
            "customer_id": customer_id,
            "action": action,
            "note": self._serialize_dict(note_data) if note_data else None,
            "changed_by": changed_by,
            "changed_by_name": changed_by_name,
            "updated_at": datetime.utcnow().isoformat(),
        }

        try:
            await self.redis.publish(channel, json.dumps(payload))
            logger.debug(
                "note_update_published",
                customer_id=customer_id,
                action=action,
            )
        except Exception as e:
            logger.error(
                "note_update_publish_failed",
                customer_id=customer_id,
                error=str(e),
            )

    async def publish_subscription_update(
        self,
        customer_id: str,
        action: str,
        subscription_data: dict[str, Any],
    ) -> None:
        """
        Publish subscription change notification.

        Args:
            customer_id: Customer UUID
            action: "activated" | "upgraded" | "downgraded" | "canceled" | "paused" | "renewed"
            subscription_data: Subscription details
        """
        channel = f"customer:{customer_id}:subscription"

        payload = {
            "customer_id": customer_id,
            "action": action,
            **self._serialize_dict(subscription_data),
            "updated_at": datetime.utcnow().isoformat(),
        }

        try:
            await self.redis.publish(channel, json.dumps(payload))
            logger.info(
                "subscription_update_published",
                customer_id=customer_id,
                action=action,
            )
        except Exception as e:
            logger.error(
                "subscription_update_publish_failed",
                customer_id=customer_id,
                error=str(e),
            )

    async def publish_billing_update(
        self,
        customer_id: str,
        action: str,
        billing_data: dict[str, Any],
    ) -> None:
        """
        Publish billing update notification.

        Args:
            customer_id: Customer UUID
            action: "invoice_created" | "payment_received" | "payment_failed" | "overdue"
            billing_data: Billing event details
        """
        channel = f"customer:{customer_id}:billing"

        payload = {
            "customer_id": customer_id,
            "action": action,
            **self._serialize_dict(billing_data),
            "updated_at": datetime.utcnow().isoformat(),
        }

        try:
            await self.redis.publish(channel, json.dumps(payload))
            logger.info(
                "billing_update_published",
                customer_id=customer_id,
                action=action,
            )
        except Exception as e:
            logger.error(
                "billing_update_publish_failed",
                customer_id=customer_id,
                error=str(e),
            )


# ============================================================================
# Usage Examples
# ============================================================================


async def example_publish_network_status() -> None:
    """Example: Publish network status update."""
    from dotmac.platform.redis_client import redis_manager

    redis = redis_manager.get_client()
    publisher = CustomerEventPublisher(redis)

    await publisher.publish_network_status_update(
        customer_id="cust-123",
        connection_status="online",
        network_data={
            "ipv4_address": "10.0.0.1",
            "signal_strength": 85,
            "signal_quality": 92,
            "bandwidth_usage_mbps": 45.5,
            "download_speed_mbps": 95.2,
            "upload_speed_mbps": 48.1,
            "latency_ms": 12,
            "packet_loss": 0.01,
        },
    )


async def example_publish_device_status() -> None:
    """Example: Publish device status change."""
    from dotmac.platform.redis_client import redis_manager

    redis = redis_manager.get_client()
    publisher = CustomerEventPublisher(redis)

    await publisher.publish_device_update(
        customer_id="cust-123",
        device_id="dev-456",
        device_type="ONT",
        device_name="ONT-Main",
        status="active",
        health_status="warning",
        is_online=True,
        change_type="health",
        previous_value="healthy",
        new_value="warning",
        metrics={
            "signal_strength": 65,  # Below threshold
            "temperature": 75,  # High temperature
            "cpu_usage": 45,
            "memory_usage": 60,
        },
    )


async def example_publish_ticket_created() -> None:
    """Example: Publish ticket creation."""
    from dotmac.platform.redis_client import redis_manager

    redis = redis_manager.get_client()
    publisher = CustomerEventPublisher(redis)

    await publisher.publish_ticket_update(
        customer_id="cust-123",
        action="created",
        ticket_data={
            "id": "ticket-789",
            "ticket_number": "TKT-00123",
            "title": "Slow internet connection",
            "description": "Customer reports slow speeds",
            "status": "open",
            "priority": "high",
            "category": "network",
            "customer_id": "cust-123",
            "customer_name": "John Doe",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        },
        changed_by="user-001",
        changed_by_name="Support Agent",
    )
