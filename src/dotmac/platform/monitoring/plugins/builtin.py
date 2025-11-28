"""
Built-in alert channel plugins (Slack, Discord, Teams, generic webhooks).
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import TYPE_CHECKING, Any

import httpx
from jinja2 import Template, TemplateSyntaxError

from . import AlertChannelPlugin, register_plugin

if TYPE_CHECKING:  # pragma: no cover - typing only
    from dotmac.platform.monitoring.alert_webhook_router import Alert as AlertType
    from dotmac.platform.monitoring.alert_webhook_router import AlertChannel as AlertChannelType
else:  # pragma: no cover - runtime fallback for type checking only
    AlertType = Any
    AlertChannelType = Any


def _default_headers(channel: AlertChannelType) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    headers.update(channel.custom_headers)
    return headers


def _format_slack_message(alert: AlertType, channel: AlertChannelType) -> dict[str, Any]:
    if alert.status == "resolved":
        color = "good"
        emoji = ":white_check_mark:"
    elif alert.severity == "critical":
        color = "danger"
        emoji = ":rotating_light:"
    elif alert.severity == "warning":
        color = "warning"
        emoji = ":warning:"
    else:
        color = "#439FE0"
        emoji = ":information_source:"

    fields = [
        {"title": "Alert", "value": alert.alertname, "short": True},
        {"title": "Severity", "value": alert.severity.upper(), "short": True},
        {"title": "Status", "value": alert.status.upper(), "short": True},
    ]

    if alert.tenant_id:
        fields.append({"title": "Tenant", "value": alert.tenant_id, "short": True})
    if instance := alert.labels.get("instance"):
        fields.append({"title": "Instance", "value": instance, "short": True})

    try:
        timestamp = (
            datetime.fromisoformat(alert.startsAt.replace("Z", "+00:00")).timestamp()
            if getattr(alert, "startsAt", None)
            else datetime.utcnow().timestamp()
        )
    except Exception:
        timestamp = datetime.utcnow().timestamp()

    attachments = [
        {
            "color": color,
            "title": f"{emoji} {alert.alertname}",
            "text": alert.description,
            "fields": fields,
            "ts": int(timestamp),
        }
    ]

    if alert.generatorURL:
        attachments[0]["actions"] = [
            {
                "type": "button",
                "text": "View in Prometheus",
                "url": alert.generatorURL,
            }
        ]

    payload = {
        "username": channel.slack_username,
        "icon_emoji": channel.slack_icon_emoji,
        "attachments": attachments,
    }

    if channel.slack_channel:
        payload["channel"] = channel.slack_channel

    return payload


def _format_discord_message(alert: AlertType, channel: AlertChannelType) -> dict[str, Any]:
    if alert.status == "resolved":
        color = 0x32CD32
    elif alert.severity == "critical":
        color = 0xFF0000
    elif alert.severity == "warning":
        color = 0xFFA500
    else:
        color = 0x3498DB

    fields: list[dict[str, Any]] = [
        {"name": "Severity", "value": alert.severity.upper(), "inline": True},
        {"name": "Status", "value": alert.status.upper(), "inline": True},
    ]

    embed = {
        "title": f"{alert.alertname} ({alert.status.upper()})",
        "description": alert.description,
        "color": color,
        "fields": fields,
        "timestamp": alert.startsAt,
    }

    if alert.generatorURL:
        embed["url"] = alert.generatorURL

    if alert.tenant_id:
        fields.append({"name": "Tenant", "value": alert.tenant_id, "inline": True})
    if instance := alert.labels.get("instance"):
        fields.append({"name": "Instance", "value": instance, "inline": True})

    return {
        "username": channel.discord_username,
        "avatar_url": channel.discord_avatar_url,
        "embeds": [embed],
    }


def _format_teams_message(alert: AlertType, channel: AlertChannelType) -> dict[str, Any]:
    if alert.status == "resolved":
        theme_color = "2E8B57"
    elif alert.severity == "critical":
        theme_color = "B22222"
    elif alert.severity == "warning":
        theme_color = "FF8C00"
    else:
        theme_color = "1E90FF"

    facts = [
        {"name": "Severity", "value": alert.severity.upper()},
        {"name": "Status", "value": alert.status.upper()},
        {"name": "Started", "value": alert.startsAt},
    ]
    if alert.tenant_id:
        facts.append({"name": "Tenant", "value": alert.tenant_id})
    if instance := alert.labels.get("instance"):
        facts.append({"name": "Instance", "value": instance})

    card = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "summary": f"{alert.alertname} ({alert.status.upper()})",
        "themeColor": theme_color,
        "title": f"{channel.teams_title}: {alert.alertname}",
        "sections": [
            {
                "facts": facts,
            }
        ],
    }

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


class WebhookChannelPlugin(AlertChannelPlugin):
    plugin_id = "webhook"

    def validate(self, channel: AlertChannelType) -> None:
        if not channel.webhook_url:
            raise ValueError("webhook_url is required for webhook channels")

    async def send(
        self,
        alert: AlertType,
        channel: AlertChannelType,
        client: httpx.AsyncClient,
    ) -> bool:
        if channel.custom_payload_template:
            try:
                template = Template(channel.custom_payload_template)
                alert_data = alert.model_dump()
                # Include computed properties in the template context
                alert_data["alertname"] = alert.alertname
                alert_data["severity"] = alert.severity
                alert_data["description"] = alert.description
                alert_data["tenant_id"] = alert.tenant_id
                rendered = template.render(alert=alert_data, **alert_data)
                try:
                    payload = json.loads(rendered)
                except json.JSONDecodeError:
                    payload = {"message": rendered}
            except TemplateSyntaxError as exc:
                raise ValueError(f"Invalid custom payload template: {exc}") from exc
        else:
            payload = alert.model_dump()

        response = await client.post(
            channel.webhook_url,
            json=payload,
            headers=_default_headers(channel),
        )
        return response.status_code in (200, 201, 202, 204)


class SlackChannelPlugin(AlertChannelPlugin):
    plugin_id = "slack"

    def validate(self, channel: AlertChannelType) -> None:
        if not channel.webhook_url:
            raise ValueError("webhook_url is required for Slack channels")

    async def send(
        self,
        alert: AlertType,
        channel: AlertChannelType,
        client: httpx.AsyncClient,
    ) -> bool:
        payload = _format_slack_message(alert, channel)
        response = await client.post(
            channel.webhook_url,
            json=payload,
            headers=_default_headers(channel),
        )
        return response.status_code in (200, 201, 202, 204)


class DiscordChannelPlugin(AlertChannelPlugin):
    plugin_id = "discord"

    def validate(self, channel: AlertChannelType) -> None:
        if not channel.webhook_url:
            raise ValueError("webhook_url is required for Discord channels")

    async def send(
        self,
        alert: AlertType,
        channel: AlertChannelType,
        client: httpx.AsyncClient,
    ) -> bool:
        payload = _format_discord_message(alert, channel)
        response = await client.post(
            channel.webhook_url,
            json=payload,
            headers=_default_headers(channel),
        )
        return response.status_code in (200, 201, 202, 204)


class TeamsChannelPlugin(AlertChannelPlugin):
    plugin_id = "teams"

    def validate(self, channel: AlertChannelType) -> None:
        if not channel.webhook_url:
            raise ValueError("webhook_url is required for Microsoft Teams channels")

    async def send(
        self,
        alert: AlertType,
        channel: AlertChannelType,
        client: httpx.AsyncClient,
    ) -> bool:
        payload = _format_teams_message(alert, channel)
        response = await client.post(
            channel.webhook_url,
            json=payload,
            headers=_default_headers(channel),
        )
        return response.status_code in (200, 201, 202, 204)


# Register builtins immediately upon import
register_plugin(WebhookChannelPlugin())
register_plugin(SlackChannelPlugin())
register_plugin(DiscordChannelPlugin())
register_plugin(TeamsChannelPlugin())


__all__ = [
    "WebhookChannelPlugin",
    "SlackChannelPlugin",
    "DiscordChannelPlugin",
    "TeamsChannelPlugin",
]
