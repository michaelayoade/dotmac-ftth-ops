"""Tests for SendGridIntegration."""

from unittest.mock import MagicMock, patch

import pytest

from dotmac.platform.integrations import (
    IntegrationConfig,
    IntegrationStatus,
    IntegrationType,
    SendGridIntegration,
)


@pytest.mark.integration
class TestSendGridIntegration:
    """Test SendGridIntegration."""

    @pytest.mark.asyncio
    async def test_sendgrid_initialization_success(self, email_config, mock_vault_secret):
        """Test SendGrid integration initialization."""
        config = IntegrationConfig(
            name="email",
            type=IntegrationType.EMAIL,
            provider="sendgrid",
            enabled=True,
            settings={"from_email": "test@example.com"},
            secrets_path="email/sendgrid",
        )

        integration = SendGridIntegration(config)

        with patch("dotmac.platform.integrations.get_vault_secret_async") as mock_get_secret:

            async def get_secret_mock(path):
                if "api_key" in path:
                    return "SG.test-api-key"
                from dotmac.platform.secrets import VaultError

                raise VaultError("Not found")

            mock_get_secret.side_effect = get_secret_mock

            # Mock sendgrid module
            mock_sendgrid = MagicMock()
            mock_mail_class = MagicMock()
            mock_client = MagicMock()
            mock_sendgrid.SendGridAPIClient = MagicMock(return_value=mock_client)

            with patch.dict(
                "sys.modules",
                {
                    "sendgrid": mock_sendgrid,
                    "sendgrid.helpers": MagicMock(),
                    "sendgrid.helpers.mail": MagicMock(Mail=mock_mail_class),
                },
            ):
                await integration.initialize()

                assert integration._status == IntegrationStatus.READY
                assert integration._client == mock_client

    @pytest.mark.asyncio
    async def test_sendgrid_initialization_no_api_key(self):
        """Test SendGrid initialization fails without API key."""
        config = IntegrationConfig(
            name="email",
            type=IntegrationType.EMAIL,
            provider="sendgrid",
            enabled=True,
            settings={},
            secrets_path="email/sendgrid",
        )

        integration = SendGridIntegration(config)

        with patch("dotmac.platform.integrations.get_vault_secret_async") as mock_get_secret:
            from dotmac.platform.secrets import VaultError

            mock_get_secret.side_effect = VaultError("Not found")

            # Mock sendgrid module
            mock_sendgrid = MagicMock()
            with patch.dict(
                "sys.modules",
                {
                    "sendgrid": mock_sendgrid,
                    "sendgrid.helpers": MagicMock(),
                    "sendgrid.helpers.mail": MagicMock(),
                },
            ):
                with pytest.raises(ValueError, match="API key not found"):
                    await integration.initialize()

                assert integration._status == IntegrationStatus.ERROR

    @pytest.mark.asyncio
    async def test_sendgrid_initialization_package_missing(self):
        """Test SendGrid initialization fails when package not installed."""
        config = IntegrationConfig(
            name="email",
            type=IntegrationType.EMAIL,
            provider="sendgrid",
            enabled=True,
            settings={},
        )

        integration = SendGridIntegration(config)

        with patch.dict("sys.modules", {"sendgrid": None}):
            with pytest.raises(RuntimeError, match="SendGrid package not installed"):
                await integration.initialize()

    @pytest.mark.asyncio
    async def test_sendgrid_send_email_success(self, mock_sendgrid_client):
        """Test sending email via SendGrid."""
        config = IntegrationConfig(
            name="email",
            type=IntegrationType.EMAIL,
            provider="sendgrid",
            enabled=True,
            settings={"from_email": "sender@example.com"},
        )

        integration = SendGridIntegration(config)
        integration._status = IntegrationStatus.READY
        integration._client = mock_sendgrid_client
        integration._mail_class = MagicMock()

        result = await integration.send_email(
            to="recipient@example.com", subject="Test Subject", content="Test content"
        )

        assert result["status"] == "sent"
        assert result["message_id"] == "test-message-id"
        assert result["status_code"] == 202

    @pytest.mark.asyncio
    async def test_sendgrid_send_email_multiple_recipients(self):
        """Test sending email to multiple recipients."""
        config = IntegrationConfig(
            name="email",
            type=IntegrationType.EMAIL,
            provider="sendgrid",
            enabled=True,
            settings={"from_email": "sender@example.com"},
        )

        integration = SendGridIntegration(config)
        integration._status = IntegrationStatus.READY

        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_response.headers = {}

        mock_client = MagicMock()
        mock_client.send = MagicMock(return_value=mock_response)
        integration._client = mock_client
        integration._mail_class = MagicMock()

        result = await integration.send_email(
            to=["user1@example.com", "user2@example.com"],
            subject="Test",
            content="Content",
        )

        assert result["status"] == "sent"

    @pytest.mark.asyncio
    async def test_sendgrid_send_email_not_ready(self):
        """Test sending email fails when integration not ready."""
        config = IntegrationConfig(
            name="email", type=IntegrationType.EMAIL, provider="sendgrid", enabled=True, settings={}
        )

        integration = SendGridIntegration(config)
        integration._status = IntegrationStatus.CONFIGURING

        with pytest.raises(RuntimeError, match="not ready"):
            await integration.send_email(to="test@example.com", subject="Test", content="Content")

    @pytest.mark.asyncio
    async def test_sendgrid_send_email_error(self):
        """Test sending email handles errors."""
        config = IntegrationConfig(
            name="email",
            type=IntegrationType.EMAIL,
            provider="sendgrid",
            enabled=True,
            settings={"from_email": "sender@example.com"},
        )

        integration = SendGridIntegration(config)
        integration._status = IntegrationStatus.READY

        mock_client = MagicMock()
        mock_client.send = MagicMock(side_effect=Exception("Network error"))
        integration._client = mock_client
        integration._mail_class = MagicMock()

        result = await integration.send_email(
            to="test@example.com", subject="Test", content="Content"
        )

        assert result["status"] == "failed"
        assert "Network error" in result["error"]

    @pytest.mark.asyncio
    async def test_sendgrid_health_check_client_not_initialized(self):
        """Test health check when client not initialized."""
        config = IntegrationConfig(
            name="email", type=IntegrationType.EMAIL, provider="sendgrid", enabled=True, settings={}
        )

        integration = SendGridIntegration(config)
        health = await integration.health_check()

        assert health.status == IntegrationStatus.ERROR
        assert "not initialized" in health.message

    @pytest.mark.asyncio
    async def test_sendgrid_health_check_success(self):
        """Test successful health check."""
        config = IntegrationConfig(
            name="email", type=IntegrationType.EMAIL, provider="sendgrid", enabled=True, settings={}
        )

        integration = SendGridIntegration(config)
        integration._client = MagicMock()
        integration._status = IntegrationStatus.READY

        health = await integration.health_check()

        assert health.status == IntegrationStatus.READY
        assert health.metadata["provider"] == "sendgrid"

    @pytest.mark.asyncio
    async def test_sendgrid_health_check_error(self):
        """Test health check handles errors."""
        config = IntegrationConfig(
            name="email", type=IntegrationType.EMAIL, provider="sendgrid", enabled=True, settings={}
        )

        integration = SendGridIntegration(config)
        # Force an error path
        integration._client = None

        health = await integration.health_check()

        assert health.status == IntegrationStatus.ERROR
        assert "not initialized" in health.message
