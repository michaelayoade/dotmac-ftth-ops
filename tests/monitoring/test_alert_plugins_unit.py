"""Unit-style tests for alert channel plugins."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

pytestmark = pytest.mark.unit

from dotmac.platform.monitoring.alert_webhook_router import (
    Alert,
    AlertChannel,
    ChannelType,
)
from dotmac.platform.monitoring.plugins.builtin import (
    DiscordChannelPlugin,
    SlackChannelPlugin,
    TeamsChannelPlugin,
    WebhookChannelPlugin,
)


def _sample_alert(**overrides):
    """Create a minimal alert model for plugin tests."""
    base = {
        "status": "firing",
        "labels": {"alertname": "TestAlert", "severity": "critical"},
        "annotations": {"summary": "Something happened", "description": "Detailed message"},
        "startsAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "generatorURL": "https://prometheus.example.com/graph",
    }
    base.update(overrides)
    return Alert(**base)


def _channel(channel_type: ChannelType, **overrides) -> AlertChannel:
    """Create a channel configuration."""
    kwargs = {
        "id": "chan-test",
        "name": "Test Channel",
        "channel_type": channel_type,
        "webhook_url": "https://example.com/hook",
    }
    kwargs.update(overrides)
    return AlertChannel(**kwargs)


class _FakeAsyncClient:
    """Minimal async client stub that captures requests."""

    def __init__(self, status_code: int = 200):
        self.status_code = status_code
        self.calls: list[tuple[str, dict, dict]] = []

    async def post(self, url: str, json: dict | None = None, headers: dict | None = None):
        self.calls.append((url, json or {}, headers or {}))
        return SimpleNamespace(status_code=self.status_code)


@pytest.mark.asyncio
async def test_webhook_plugin_renders_json_template():
    alert = _sample_alert()
    channel = _channel(
        ChannelType.WEBHOOK,
        custom_headers={"X-Env": "test"},
        custom_payload_template='{"message": "{{ alert.alertname }}"}',
    )
    client = _FakeAsyncClient(status_code=202)

    plugin = WebhookChannelPlugin()
    success = await plugin.send(alert, channel, client)

    assert success is True
    assert client.calls[0][0] == channel.webhook_url
    assert client.calls[0][1] == {"message": "TestAlert"}
    assert client.calls[0][2]["X-Env"] == "test"


@pytest.mark.asyncio
async def test_webhook_plugin_recovers_from_invalid_json():
    alert = _sample_alert()
    channel = _channel(
        ChannelType.WEBHOOK,
        custom_payload_template="{{ alert.alertname }} just text",
    )
    client = _FakeAsyncClient()

    plugin = WebhookChannelPlugin()
    success = await plugin.send(alert, channel, client)

    assert success is True
    assert client.calls[0][1] == {"message": "TestAlert just text"}


@pytest.mark.asyncio
async def test_webhook_plugin_template_error_raises():
    alert = _sample_alert()
    channel = _channel(
        ChannelType.WEBHOOK,
        custom_payload_template="{% this is invalid %}",
    )
    client = _FakeAsyncClient()

    plugin = WebhookChannelPlugin()
    with pytest.raises(ValueError):
        await plugin.send(alert, channel, client)


@pytest.mark.asyncio
async def test_slack_plugin_returns_false_on_failure_status():
    alert = _sample_alert()
    channel = _channel(ChannelType.SLACK, slack_channel="#alerts")
    client = _FakeAsyncClient(status_code=500)

    plugin = SlackChannelPlugin()
    success = await plugin.send(alert, channel, client)

    assert success is False
    assert client.calls[0][0] == channel.webhook_url
    # Channel override should be propagated in payload
    assert client.calls[0][1]["channel"] == "#alerts"


@pytest.mark.asyncio
async def test_discord_plugin_success_payload_shape():
    alert = _sample_alert()
    channel = _channel(ChannelType.DISCORD, discord_username="DotMac Bot")
    client = _FakeAsyncClient(status_code=204)

    plugin = DiscordChannelPlugin()
    success = await plugin.send(alert, channel, client)

    assert success is True
    payload = client.calls[0][1]
    assert payload["username"] == "DotMac Bot"
    assert payload["embeds"][0]["title"].startswith("TestAlert")


@pytest.mark.asyncio
async def test_teams_plugin_builds_card_payload():
    alert = _sample_alert()
    channel = _channel(ChannelType.TEAMS, teams_title="Ops")
    client = _FakeAsyncClient(status_code=200)

    plugin = TeamsChannelPlugin()
    success = await plugin.send(alert, channel, client)

    assert success is True
    payload = client.calls[0][1]
    assert payload["title"].startswith("Ops")
    assert payload["sections"][0]["facts"][0]["name"] == "Severity"


def test_webhook_plugin_validate_requires_url():
    plugin = WebhookChannelPlugin()
    channel = _channel(ChannelType.WEBHOOK).model_copy(update={"webhook_url": ""})
    with pytest.raises(ValueError):
        plugin.validate(channel)  # type: ignore[arg-type]


def test_slack_plugin_validate_requires_url():
    plugin = SlackChannelPlugin()
    channel = _channel(ChannelType.SLACK).model_copy(update={"webhook_url": ""})
    with pytest.raises(ValueError):
        plugin.validate(channel)  # type: ignore[arg-type]


def test_discord_plugin_validate_requires_url():
    plugin = DiscordChannelPlugin()
    channel = _channel(ChannelType.DISCORD).model_copy(update={"webhook_url": ""})
    with pytest.raises(ValueError):
        plugin.validate(channel)  # type: ignore[arg-type]


def test_teams_plugin_validate_requires_url():
    plugin = TeamsChannelPlugin()
    channel = _channel(ChannelType.TEAMS).model_copy(update={"webhook_url": ""})
    with pytest.raises(ValueError):
        plugin.validate(channel)  # type: ignore[arg-type]
