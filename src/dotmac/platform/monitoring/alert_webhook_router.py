"""
Dynamic Alert Webhook Router.

Routes Prometheus alerts to dynamically configured webhooks (Slack, Discord, Teams, custom).
Allows per-tenant, per-severity, and per-alert-type routing configuration.
"""

from __future__ import annotations

import asyncio
from enum import Enum
from typing import Any

import httpx
import structlog
from pydantic import BaseModel, Field

from dotmac.platform.core.caching import cache_get, cache_set
from dotmac.platform.monitoring.plugins import get_plugin

ALERT_CHANNEL_CACHE_KEY = "monitoring:alert_channels"

logger = structlog.get_logger(__name__)


# ==========================================
# Models
# ==========================================


class AlertSeverity(str, Enum):
    """Alert severity levels."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class ChannelType(str, Enum):
    """Supported channel types."""

    SLACK = "slack"
    DISCORD = "discord"
    TEAMS = "teams"
    WEBHOOK = "webhook"  # Generic webhook
    EMAIL = "email"
    SMS = "sms"


class Alert(BaseModel):
    """Prometheus alert model."""

    status: str  # firing, resolved
    labels: dict[str, str]
    annotations: dict[str, str]
    startsAt: str
    endsAt: str | None = None
    generatorURL: str | None = None
    fingerprint: str | None = None

    @property
    def severity(self) -> str:
        """Get alert severity from labels."""
        return self.labels.get("severity", "warning")

    @property
    def alertname(self) -> str:
        """Get alert name from labels."""
        return self.labels.get("alertname", "Unknown")

    @property
    def tenant_id(self) -> str | None:
        """Get tenant ID from labels if present."""
        return self.labels.get("tenant_id")

    @property
    def description(self) -> str:
        """Get alert description."""
        return self.annotations.get(
            "description", self.annotations.get("summary", "No description")
        )


class AlertmanagerWebhook(BaseModel):
    """Alertmanager webhook payload."""

    version: str = "4"
    groupKey: str
    truncatedAlerts: int = 0
    status: str  # firing, resolved
    receiver: str
    groupLabels: dict[str, str]
    commonLabels: dict[str, str]
    commonAnnotations: dict[str, str]
    externalURL: str
    alerts: list[Alert]


class AlertChannel(BaseModel):
    """Alert notification channel configuration."""

    id: str
    name: str
    channel_type: ChannelType
    webhook_url: str
    enabled: bool = True

    # Routing configuration
    tenant_id: str | None = None  # Route to specific tenant's channel
    severities: list[AlertSeverity] | None = None  # Only route these severities
    alert_names: list[str] | None = None  # Only route these alert names
    alert_categories: list[str] | None = None  # e.g., "errors", "database", "security"

    # Channel-specific settings
    slack_channel: str | None = None
    slack_username: str = "Prometheus Alerts"
    slack_icon_emoji: str = ":bell:"

    discord_username: str = "Prometheus Alerts"
    discord_avatar_url: str | None = None

    teams_title: str = "Prometheus Alert"

    # Generic webhook settings
    custom_headers: dict[str, str] = Field(default_factory=dict)
    custom_payload_template: str | None = None  # Jinja2 template for custom payload

    def should_route_alert(self, alert: Alert) -> bool:
        """Check if alert should be routed to this channel."""
        # Check if channel is enabled
        if not self.enabled:
            return False

        # Check tenant filter
        if self.tenant_id and alert.tenant_id != self.tenant_id:
            return False

        # Check severity filter
        if self.severities and alert.severity not in [s.value for s in self.severities]:
            return False

        # Check alert name filter
        if self.alert_names and alert.alertname not in self.alert_names:
            return False

        # Check category filter
        if self.alert_categories:
            category = alert.labels.get("category")
            if not category or category not in self.alert_categories:
                return False

        return True


# ==========================================
# Alert Router
# ==========================================


class AlertWebhookRouter:
    """Routes alerts to configured webhook channels."""

    def __init__(self):
        """Initialize alert router."""
        self.channels: dict[str, AlertChannel] = {}
        self.http_client = httpx.AsyncClient(timeout=10.0)
        self.load_cached_channels()

    def add_channel(self, channel: AlertChannel) -> None:
        """Add or update a notification channel."""
        plugin = get_plugin(channel.channel_type.value)
        if not plugin:
            raise ValueError(
                f"No registered alert plugin for channel type '{channel.channel_type.value}'"
            )
        plugin.validate(channel)
        self.channels[channel.id] = channel
        logger.info(
            "Alert channel added",
            channel_id=channel.id,
            channel_name=channel.name,
            channel_type=channel.channel_type.value,
        )

    def remove_channel(self, channel_id: str) -> None:
        """Remove a notification channel."""
        if channel_id in self.channels:
            del self.channels[channel_id]
            logger.info("Alert channel removed", channel_id=channel_id)

    def get_channels_for_alert(self, alert: Alert) -> list[AlertChannel]:
        """Get all channels that should receive this alert."""
        matching_channels = []

        for channel in self.channels.values():
            if channel.should_route_alert(alert):
                matching_channels.append(channel)

        return matching_channels

    async def send_to_channel(self, alert: Alert, channel: AlertChannel) -> bool:
        """Send alert to a specific channel."""
        try:
            plugin = get_plugin(channel.channel_type.value)
            if not plugin:
                logger.warning(
                    "Unsupported channel type",
                    channel_type=channel.channel_type.value,
                    channel_id=channel.id,
                )
                return False

            plugin.validate(channel)
            result = await plugin.send(alert, channel, self.http_client)

            if result:
                logger.info(
                    "Alert sent successfully",
                    channel_id=channel.id,
                    channel_name=channel.name,
                    alert_name=alert.alertname,
                )
            else:
                logger.error(
                    "Alert delivery failed",
                    channel_id=channel.id,
                    channel_name=channel.name,
                    alert_name=alert.alertname,
                )

            return result

        except Exception as e:
            logger.error(
                "Exception sending alert",
                channel_id=channel.id,
                channel_name=channel.name,
                alert_name=alert.alertname,
                error=str(e),
                exc_info=True,
            )
            return False

    async def route_alert(self, alert: Alert) -> dict[str, bool]:
        """Route an alert to all matching channels."""
        channels = self.get_channels_for_alert(alert)

        if not channels:
            logger.warning(
                "No channels matched alert",
                alert_name=alert.alertname,
                severity=alert.severity,
                tenant_id=alert.tenant_id,
            )
            return {}

        logger.info(
            "Routing alert to channels",
            alert_name=alert.alertname,
            num_channels=len(channels),
            channel_names=[c.name for c in channels],
        )

        # Send to all channels concurrently
        tasks = [self.send_to_channel(alert, channel) for channel in channels]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Build results dict
        return {
            channel.id: result if isinstance(result, bool) else False
            for channel, result in zip(channels, results, strict=False)
        }

    async def process_alertmanager_webhook(self, payload: AlertmanagerWebhook) -> dict[str, Any]:
        """Process webhook from Alertmanager."""
        logger.info(
            "Processing Alertmanager webhook",
            num_alerts=len(payload.alerts),
            status=payload.status,
            receiver=payload.receiver,
        )

        # Route each alert
        all_results = {}
        for alert in payload.alerts:
            results = await self.route_alert(alert)
            all_results[alert.fingerprint or alert.alertname] = results

        return all_results

    async def close(self) -> None:
        """Close HTTP client."""
        await self.http_client.aclose()

    def replace_channels(self, channels: list[AlertChannel]) -> None:
        """Replace the in-memory channel cache with the provided list."""
        refreshed: dict[str, AlertChannel] = {}
        for channel in channels:
            plugin = get_plugin(channel.channel_type.value)
            if not plugin:
                logger.warning(
                    "Skipping channel with unsupported type during refresh",
                    channel_id=channel.id,
                    channel_type=channel.channel_type.value,
                )
                continue
            try:
                plugin.validate(channel)
            except Exception as exc:
                logger.warning(
                    "Skipping channel with invalid configuration",
                    channel_id=channel.id,
                    error=str(exc),
                )
                continue
            refreshed[channel.id] = channel

        self.channels = refreshed
        logger.info(
            "Alert channel cache refreshed",
            channel_ids=list(self.channels.keys()),
        )

    def load_cached_channels(self) -> None:
        """Load channel definitions from Redis-backed cache if available."""
        cached = cache_get(ALERT_CHANNEL_CACHE_KEY)
        if not cached:
            return

        loaded: dict[str, AlertChannel] = {}
        for item in cached:
            try:
                channel = AlertChannel(**item)
                plugin = get_plugin(channel.channel_type.value)
                if not plugin:
                    logger.warning(
                        "Skipping cached channel with unsupported type",
                        channel_id=channel.id,
                        channel_type=channel.channel_type.value,
                    )
                    continue
                plugin.validate(channel)
                loaded[channel.id] = channel
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("Failed to deserialize cached alert channel", error=str(exc))

        if loaded:
            self.channels = loaded


# ==========================================
# Global router instance
# ==========================================

# Singleton instance
_alert_router: AlertWebhookRouter | None = None


def get_alert_router() -> AlertWebhookRouter:
    """Get or create the global alert router instance."""
    global _alert_router
    if _alert_router is None:
        _alert_router = AlertWebhookRouter()
    elif not _alert_router.channels:
        # Ensure warm cache if instance was created before cache primed.
        _alert_router.load_cached_channels()
    return _alert_router


def serialize_channel(channel: AlertChannel) -> dict[str, Any]:
    """Serialize channel to JSON-safe dict."""
    return channel.model_dump(mode="json")


def cache_channels(channels: list[AlertChannel]) -> None:
    """Persist channel definitions in Redis (and process-local cache)."""
    serialized = [serialize_channel(channel) for channel in channels]
    # Use ttl=None so the mapping persists across process restarts.
    cache_set(ALERT_CHANNEL_CACHE_KEY, serialized, ttl=None)


# ==========================================
# Exports
# ==========================================

__all__ = [
    "Alert",
    "AlertChannel",
    "AlertSeverity",
    "ChannelType",
    "AlertmanagerWebhook",
    "AlertWebhookRouter",
    "get_alert_router",
]
