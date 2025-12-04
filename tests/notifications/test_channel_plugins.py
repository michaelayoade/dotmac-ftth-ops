"""Tests for notification channel plugin registry."""

from __future__ import annotations

from typing import Any

import pytest

from dotmac.platform.notifications.channels.base import (
    NotificationChannelProvider,
    NotificationContext,
)
from dotmac.platform.notifications.channels.factory import ChannelProviderFactory
from dotmac.platform.notifications.models import (
    NotificationChannel,
    NotificationPriority,
    NotificationType,
)
from dotmac.platform.notifications.plugins import get_plugin, register_plugin

pytestmark = pytest.mark.unit


class _DummyProvider(NotificationChannelProvider):
    channel_name = "dummy"

    async def send(self, context: NotificationContext) -> bool:
        return True


class _DummyPlugin:
    plugin_id = "test.notifications.dummy"
    channel = NotificationChannel.EMAIL

    def build_config(self) -> dict[str, Any]:
        return {"enabled": True}

    def create_provider(self, config: dict[str, Any]) -> NotificationChannelProvider:
        return _DummyProvider(config=config)


@pytest.mark.asyncio
async def test_custom_plugin_can_override_channel():
    original_plugin = get_plugin(NotificationChannel.EMAIL)
    assert original_plugin is not None

    ChannelProviderFactory.clear_cache()

    # Register dummy plugin to override email channel
    register_plugin(_DummyPlugin())

    provider = ChannelProviderFactory.get_provider(NotificationChannel.EMAIL)
    assert isinstance(provider, _DummyProvider)

    # Ensure provider is functional
    from uuid import uuid4

    context = NotificationContext(
        notification_id=uuid4(),
        tenant_id="tenant-alpha",
        user_id=uuid4(),
        notification_type=NotificationType.SYSTEM_ALERT,
        priority=NotificationPriority.MEDIUM,
        title="Test",
        message="Test message",
    )
    assert await provider.send(context)

    # Restore original plugin to avoid cross-test contamination
    if original_plugin:
        register_plugin(original_plugin)
    ChannelProviderFactory.clear_cache()
