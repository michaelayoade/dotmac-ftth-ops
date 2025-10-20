"""
Dynamic Alert Webhook Router.

Routes Prometheus alerts to dynamically configured webhooks (Slack, Discord, Teams, custom).
Allows per-tenant, per-severity, and per-alert-type routing configuration.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from enum import Enum
from typing import Any

import httpx
import structlog
from jinja2 import Template, TemplateSyntaxError
from pydantic import BaseModel, Field

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
        return self.annotations.get("description", self.annotations.get("summary", "No description"))


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
# Slack Formatting
# ==========================================


def format_slack_message(alert: Alert, channel: AlertChannel) -> dict[str, Any]:
    """Format alert for Slack."""
    # Determine color based on severity and status
    if alert.status == "resolved":
        color = "good"  # Green
        emoji = ":white_check_mark:"
    elif alert.severity == "critical":
        color = "danger"  # Red
        emoji = ":rotating_light:"
    elif alert.severity == "warning":
        color = "warning"  # Orange
        emoji = ":warning:"
    else:
        color = "#439FE0"  # Blue
        emoji = ":information_source:"

    # Build fields
    fields = [
        {
            "title": "Alert",
            "value": alert.alertname,
            "short": True,
        },
        {
            "title": "Severity",
            "value": alert.severity.upper(),
            "short": True,
        },
        {
            "title": "Status",
            "value": alert.status.upper(),
            "short": True,
        },
    ]

    # Add tenant if present
    if alert.tenant_id:
        fields.append({
            "title": "Tenant",
            "value": alert.tenant_id,
            "short": True,
        })

    # Add instance if present
    if "instance" in alert.labels:
        fields.append({
            "title": "Instance",
            "value": alert.labels["instance"],
            "short": True,
        })

    # Build attachment
    attachment = {
        "color": color,
        "title": f"{emoji} {alert.alertname}",
        "text": alert.description,
        "fields": fields,
        "footer": "DotMac Monitoring",
        "ts": int(datetime.fromisoformat(alert.startsAt.replace("Z", "+00:00")).timestamp()),
    }

    # Add generator URL if present
    if alert.generatorURL:
        attachment["title_link"] = alert.generatorURL

    # Build message
    message = {
        "username": channel.slack_username,
        "icon_emoji": channel.slack_icon_emoji,
        "attachments": [attachment],
    }

    # Add channel if specified
    if channel.slack_channel:
        message["channel"] = channel.slack_channel

    return message


# ==========================================
# Discord Formatting
# ==========================================


def format_discord_message(alert: Alert, channel: AlertChannel) -> dict[str, Any]:
    """Format alert for Discord."""
    # Determine color based on severity and status
    if alert.status == "resolved":
        color = 0x00FF00  # Green
    elif alert.severity == "critical":
        color = 0xFF0000  # Red
    elif alert.severity == "warning":
        color = 0xFFA500  # Orange
    else:
        color = 0x0099FF  # Blue

    # Build embed fields
    fields = [
        {
            "name": "Alert",
            "value": alert.alertname,
            "inline": True,
        },
        {
            "name": "Severity",
            "value": alert.severity.upper(),
            "inline": True,
        },
        {
            "name": "Status",
            "value": alert.status.upper(),
            "inline": True,
        },
    ]

    # Add tenant if present
    if alert.tenant_id:
        fields.append({
            "name": "Tenant",
            "value": alert.tenant_id,
            "inline": True,
        })

    # Build embed
    embed = {
        "title": alert.alertname,
        "description": alert.description,
        "color": color,
        "fields": fields,
        "footer": {
            "text": "DotMac Monitoring",
        },
        "timestamp": alert.startsAt,
    }

    # Add URL if present
    if alert.generatorURL:
        embed["url"] = alert.generatorURL

    # Build message
    message = {
        "username": channel.discord_username,
        "embeds": [embed],
    }

    # Add avatar if specified
    if channel.discord_avatar_url:
        message["avatar_url"] = channel.discord_avatar_url

    return message


# ==========================================
# Microsoft Teams Formatting
# ==========================================


def format_teams_message(alert: Alert, channel: AlertChannel) -> dict[str, Any]:
    """Format alert for Microsoft Teams."""
    # Determine theme color
    if alert.status == "resolved":
        theme_color = "00FF00"  # Green
    elif alert.severity == "critical":
        theme_color = "FF0000"  # Red
    elif alert.severity == "warning":
        theme_color = "FFA500"  # Orange
    else:
        theme_color = "0099FF"  # Blue

    # Build facts
    facts = [
        {"name": "Alert", "value": alert.alertname},
        {"name": "Severity", "value": alert.severity.upper()},
        {"name": "Status", "value": alert.status.upper()},
    ]

    # Add tenant if present
    if alert.tenant_id:
        facts.append({"name": "Tenant", "value": alert.tenant_id})

    # Build card
    card = {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "themeColor": theme_color,
        "title": f"{channel.teams_title}: {alert.alertname}",
        "text": alert.description,
        "sections": [
            {
                "facts": facts,
            }
        ],
    }

    # Add potential action (view in Prometheus)
    if alert.generatorURL:
        card["potentialAction"] = [
            {
                "@type": "OpenUri",
                "name": "View in Prometheus",
                "targets": [
                    {
                        "os": "default",
                        "uri": alert.generatorURL,
                    }
                ],
            }
        ]

    return card


# ==========================================
# Alert Router
# ==========================================


class AlertWebhookRouter:
    """Routes alerts to configured webhook channels."""

    def __init__(self):
        """Initialize alert router."""
        self.channels: dict[str, AlertChannel] = {}
        self.http_client = httpx.AsyncClient(timeout=10.0)

    def add_channel(self, channel: AlertChannel) -> None:
        """Add or update a notification channel."""
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
            # Format message based on channel type
            if channel.channel_type == ChannelType.SLACK:
                payload = format_slack_message(alert, channel)
            elif channel.channel_type == ChannelType.DISCORD:
                payload = format_discord_message(alert, channel)
            elif channel.channel_type == ChannelType.TEAMS:
                payload = format_teams_message(alert, channel)
            elif channel.channel_type == ChannelType.WEBHOOK:
                # For generic webhooks, send raw alert data or use custom template
                if channel.custom_payload_template:
                    # Render Jinja2 template with alert context
                    try:
                        template = Template(channel.custom_payload_template)
                        alert_data = alert.model_dump()
                        rendered = template.render(alert=alert_data, **alert_data)

                        # Try to parse as JSON if template produces valid JSON
                        try:
                            payload = json.loads(rendered)
                        except json.JSONDecodeError:
                            # If not valid JSON, send as plain text wrapped in a message field
                            payload = {"message": rendered}
                    except TemplateSyntaxError as e:
                        logger.error(
                            "Invalid Jinja2 template in channel",
                            channel_id=channel.id,
                            error=str(e),
                        )
                        # Fallback to raw alert data
                        payload = alert.model_dump()
                    except Exception as e:
                        logger.error(
                            "Error rendering Jinja2 template",
                            channel_id=channel.id,
                            error=str(e),
                        )
                        # Fallback to raw alert data
                        payload = alert.model_dump()
                else:
                    payload = alert.model_dump()
            else:
                logger.warning(
                    "Unsupported channel type",
                    channel_type=channel.channel_type.value,
                    channel_id=channel.id,
                )
                return False

            # Send webhook
            headers = {"Content-Type": "application/json", **channel.custom_headers}

            response = await self.http_client.post(
                channel.webhook_url,
                json=payload,
                headers=headers,
            )

            # Check response
            if response.status_code in (200, 201, 202, 204):
                logger.info(
                    "Alert sent successfully",
                    channel_id=channel.id,
                    channel_name=channel.name,
                    alert_name=alert.alertname,
                    status_code=response.status_code,
                )
                return True
            else:
                logger.error(
                    "Failed to send alert",
                    channel_id=channel.id,
                    channel_name=channel.name,
                    alert_name=alert.alertname,
                    status_code=response.status_code,
                    response_body=response.text[:500],
                )
                return False

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
    return _alert_router


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
