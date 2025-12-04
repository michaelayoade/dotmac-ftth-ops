"""Shared fixtures for integration tests."""

from unittest.mock import MagicMock

import pytest

from dotmac.platform.integrations import (
    IntegrationConfig,
    IntegrationType,
)


@pytest.fixture
def basic_config():
    """Create basic integration config."""
    return IntegrationConfig(
        name="test",
        type=IntegrationType.EMAIL,
        provider="test",
        enabled=True,
        settings={},
    )


@pytest.fixture
def email_config():
    """Create email integration config."""
    return IntegrationConfig(
        name="email",
        type=IntegrationType.EMAIL,
        provider="sendgrid",
        enabled=True,
        settings={"from_email": "test@example.com"},
    )


@pytest.fixture
def sms_config():
    """Create SMS integration config."""
    return IntegrationConfig(
        name="sms",
        type=IntegrationType.SMS,
        provider="twilio",
        enabled=True,
        settings={"from_number": "+1234567890"},
    )


@pytest.fixture
def mock_vault_secret():
    """Create mock for vault secret retrieval."""

    async def get_secret_mock(path):
        if "api_key" in path:
            return "test-api-key"
        elif "username" in path:
            return "test-username"
        elif "password" in path:
            return "test-password"
        elif "token" in path:
            return {"value": "test-token-value"}
        from dotmac.platform.secrets import VaultError

        raise VaultError("Not found")

    return get_secret_mock


@pytest.fixture
def mock_sendgrid_client():
    """Create mock SendGrid client."""
    mock_response = MagicMock()
    mock_response.status_code = 202
    mock_response.headers = {"X-Message-Id": "test-message-id"}

    mock_client = MagicMock()
    mock_client.send = MagicMock(return_value=mock_response)

    return mock_client


@pytest.fixture
def mock_twilio_client():
    """Create mock Twilio client."""
    mock_message = MagicMock()
    mock_message.sid = "SM-test-message-id"

    mock_messages = MagicMock()
    mock_messages.create = MagicMock(return_value=mock_message)

    mock_client = MagicMock()
    mock_client.messages = mock_messages
    mock_client.username = "AC-test"

    return mock_client
