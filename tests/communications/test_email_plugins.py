"""Tests for communications email transport plugin system."""

from __future__ import annotations

import pytest

from dotmac.platform.communications.email_service import EmailMessage, EmailService
from dotmac.platform.communications.plugins import register_plugin

pytestmark = pytest.mark.unit


class _DummyTransport:
    def __init__(self) -> None:
        self.sent = False

    async def send(self, service, message, message_id):
        self.sent = True


class _DummyPlugin:
    plugin_id = "test.email.dummy"

    def create_transport(self, service):
        transport = _DummyTransport()
        service._dummy_transport = transport  # type: ignore[attr-defined]
        return transport


@pytest.mark.asyncio
async def test_custom_email_plugin_is_used():
    register_plugin(_DummyPlugin())

    service = EmailService(transport_plugin_id="test.email.dummy")

    message = EmailMessage(
        to=["recipient@example.com"],
        subject="Plugin Test",
        text_body="Hello",
    )

    response = await service.send_email(message)

    assert response.status == "sent"
    assert service._dummy_transport.sent is True
