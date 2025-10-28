"""Tests for TwilioIntegration."""

import sys
from unittest.mock import MagicMock, patch

import pytest

from dotmac.platform.integrations import (
    IntegrationConfig,
    IntegrationStatus,
    IntegrationType,
    TwilioIntegration,
)


@pytest.mark.integration
class TestTwilioIntegration:
    """Test TwilioIntegration."""

    @pytest.mark.asyncio
    async def test_twilio_initialization_success(self):
        """Test Twilio integration initialization."""
        config = IntegrationConfig(
            name="sms",
            type=IntegrationType.SMS,
            provider="twilio",
            enabled=True,
            settings={"from_number": "+1234567890"},
            secrets_path="sms/twilio",
        )

        integration = TwilioIntegration(config)

        with patch("dotmac.platform.integrations.get_vault_secret_async") as mock_get_secret:

            async def get_secret_mock(path):
                if "username" in path:
                    return "AC-account-sid"
                elif "password" in path:
                    return "auth-token"
                from dotmac.platform.secrets import VaultError

                raise VaultError("Not found")

            mock_get_secret.side_effect = get_secret_mock

            # Mock twilio module more thoroughly
            mock_twilio_client = MagicMock()
            mock_twilio_rest = MagicMock()
            mock_twilio_rest.Client = MagicMock(return_value=mock_twilio_client)

            # Create full mock hierarchy
            mock_twilio = MagicMock()
            mock_twilio.rest = mock_twilio_rest

            with patch.dict(sys.modules, {"twilio": mock_twilio, "twilio.rest": mock_twilio_rest}):
                await integration.initialize()

                assert integration._status == IntegrationStatus.READY
                assert integration._client == mock_twilio_client

    @pytest.mark.asyncio
    async def test_twilio_initialization_no_credentials(self):
        """Test Twilio initialization fails without credentials."""
        config = IntegrationConfig(
            name="sms",
            type=IntegrationType.SMS,
            provider="twilio",
            enabled=True,
            settings={},
            secrets_path="sms/twilio",
        )

        integration = TwilioIntegration(config)

        with patch("dotmac.platform.integrations.get_vault_secret_async") as mock_get_secret:
            from dotmac.platform.secrets import VaultError

            mock_get_secret.side_effect = VaultError("Not found")

            # Mock twilio module
            mock_twilio = MagicMock()
            mock_twilio.rest = MagicMock()
            with patch.dict(sys.modules, {"twilio": mock_twilio, "twilio.rest": mock_twilio.rest}):
                with pytest.raises(ValueError, match="credentials not found"):
                    await integration.initialize()

                assert integration._status == IntegrationStatus.ERROR

    @pytest.mark.asyncio
    async def test_twilio_initialization_package_missing(self):
        """Test Twilio initialization fails when package not installed."""
        config = IntegrationConfig(
            name="sms", type=IntegrationType.SMS, provider="twilio", enabled=True, settings={}
        )

        integration = TwilioIntegration(config)

        with patch.dict("sys.modules", {"twilio.rest": None}):
            with pytest.raises(RuntimeError, match="Twilio package not installed"):
                await integration.initialize()

    @pytest.mark.asyncio
    async def test_twilio_send_sms_success(self, mock_twilio_client):
        """Test sending SMS via Twilio."""
        config = IntegrationConfig(
            name="sms",
            type=IntegrationType.SMS,
            provider="twilio",
            enabled=True,
            settings={"from_number": "+1234567890"},
        )

        integration = TwilioIntegration(config)
        integration._status = IntegrationStatus.READY
        integration._client = mock_twilio_client

        result = await integration.send_sms(to="+19876543210", message="Test message")

        assert result["status"] == "sent"
        assert result["message_id"] == "SM-test-message-id"
        assert result["to"] == "+19876543210"

    @pytest.mark.asyncio
    async def test_twilio_send_sms_no_from_number(self):
        """Test sending SMS fails without from_number."""
        config = IntegrationConfig(
            name="sms", type=IntegrationType.SMS, provider="twilio", enabled=True, settings={}
        )

        integration = TwilioIntegration(config)
        integration._status = IntegrationStatus.READY
        integration._client = MagicMock()

        result = await integration.send_sms(to="+19876543210", message="Test")
        # Without from_number, it should return failed status
        assert result["status"] == "failed"
        assert "number not configured" in result["error"]

    @pytest.mark.asyncio
    async def test_twilio_send_sms_not_ready(self):
        """Test sending SMS fails when integration not ready."""
        config = IntegrationConfig(
            name="sms", type=IntegrationType.SMS, provider="twilio", enabled=True, settings={}
        )

        integration = TwilioIntegration(config)
        integration._status = IntegrationStatus.CONFIGURING

        with pytest.raises(RuntimeError, match="not ready"):
            await integration.send_sms(to="+19876543210", message="Test")

    @pytest.mark.asyncio
    async def test_twilio_send_sms_error(self):
        """Test sending SMS handles errors."""
        config = IntegrationConfig(
            name="sms",
            type=IntegrationType.SMS,
            provider="twilio",
            enabled=True,
            settings={"from_number": "+1234567890"},
        )

        integration = TwilioIntegration(config)
        integration._status = IntegrationStatus.READY

        mock_messages = MagicMock()
        mock_messages.create = MagicMock(side_effect=Exception("Network error"))

        mock_client = MagicMock()
        mock_client.messages = mock_messages
        integration._client = mock_client

        result = await integration.send_sms(to="+19876543210", message="Test")

        assert result["status"] == "failed"
        assert "Network error" in result["error"]

    @pytest.mark.asyncio
    async def test_twilio_health_check_client_not_initialized(self):
        """Test health check when client not initialized."""
        config = IntegrationConfig(
            name="sms", type=IntegrationType.SMS, provider="twilio", enabled=True, settings={}
        )

        integration = TwilioIntegration(config)
        health = await integration.health_check()

        assert health.status == IntegrationStatus.ERROR
        assert "not initialized" in health.message

    @pytest.mark.asyncio
    async def test_twilio_health_check_success(self):
        """Test successful health check."""
        config = IntegrationConfig(
            name="sms", type=IntegrationType.SMS, provider="twilio", enabled=True, settings={}
        )

        integration = TwilioIntegration(config)
        integration._status = IntegrationStatus.READY

        mock_account = MagicMock()
        mock_account.status = "active"

        mock_api_accounts = MagicMock()
        mock_api_accounts.return_value.fetch = MagicMock(return_value=mock_account)

        mock_api = MagicMock()
        mock_api.accounts = mock_api_accounts

        mock_client = MagicMock()
        mock_client.api = mock_api
        mock_client.username = "AC-test"
        integration._client = mock_client

        health = await integration.health_check()

        assert health.status == IntegrationStatus.READY
        assert health.metadata["provider"] == "twilio"
        assert health.metadata["account_status"] == "active"

    @pytest.mark.asyncio
    async def test_twilio_health_check_error(self):
        """Test health check handles errors."""
        config = IntegrationConfig(
            name="sms", type=IntegrationType.SMS, provider="twilio", enabled=True, settings={}
        )

        integration = TwilioIntegration(config)
        mock_client = MagicMock()
        mock_client.api.accounts = MagicMock(side_effect=Exception("API error"))
        integration._client = mock_client

        health = await integration.health_check()

        assert health.status == IntegrationStatus.ERROR
        assert "Health check failed" in health.message
