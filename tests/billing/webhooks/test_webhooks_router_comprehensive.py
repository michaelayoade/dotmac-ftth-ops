"""
Comprehensive tests for billing webhooks router.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# ============================================================================
# Fixtures
# ============================================================================


pytestmark = pytest.mark.integration

pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_db_session():
    """Create mock AsyncSession."""
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def mock_request():
    """Create mock FastAPI Request."""
    request = MagicMock()
    request.body = AsyncMock(return_value=b'{"type": "test.event"}')
    request.headers = {
        "Stripe-Signature": "test_signature",
        "Paypal-Transmission-Id": "test_id",
        "Paypal-Transmission-Sig": "test_sig",
    }
    return request


@pytest.fixture
def mock_stripe_handler():
    """Create mock StripeWebhookHandler."""
    handler = MagicMock()
    handler.handle_webhook = AsyncMock(return_value={"status": "processed", "event_type": "test"})
    return handler


@pytest.fixture
def mock_paypal_handler():
    """Create mock PayPalWebhookHandler."""
    handler = MagicMock()
    handler.handle_webhook = AsyncMock(return_value={"status": "processed", "event_type": "test"})
    return handler


# ============================================================================
# Stripe Webhook Tests
# ============================================================================


class TestHandleStripeWebhook:
    """Test POST /webhooks/stripe endpoint."""

    @pytest.mark.asyncio
    async def test_stripe_webhook_success(self, mock_db_session, mock_request, mock_stripe_handler):
        """Test successful Stripe webhook processing."""
        from dotmac.platform.billing.webhooks.router import handle_stripe_webhook

        with patch(
            "dotmac.platform.billing.webhooks.router.StripeWebhookHandler",
            return_value=mock_stripe_handler,
        ):
            result = await handle_stripe_webhook(
                request=mock_request,
                stripe_signature="test_signature",
                db=mock_db_session,
            )

        assert result["status"] == "processed"
        mock_stripe_handler.handle_webhook.assert_called_once()
        call_kwargs = mock_stripe_handler.handle_webhook.call_args[1]
        assert call_kwargs["signature"] == "test_signature"
        assert call_kwargs["payload"] == b'{"type": "test.event"}'

    @pytest.mark.asyncio
    async def test_stripe_webhook_missing_signature(self, mock_db_session, mock_request):
        """Test Stripe webhook with missing signature header."""
        from dotmac.platform.billing.webhooks.router import handle_stripe_webhook

        with pytest.raises(HTTPException) as exc_info:
            await handle_stripe_webhook(
                request=mock_request,
                stripe_signature=None,
                db=mock_db_session,
            )

        assert exc_info.value.status_code == 400
        assert "Missing Stripe-Signature header" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_stripe_webhook_invalid_request_body(self, mock_db_session):
        """Test Stripe webhook with invalid request body."""
        from dotmac.platform.billing.webhooks.router import handle_stripe_webhook

        mock_request = MagicMock()
        mock_request.body = AsyncMock(side_effect=Exception("Read error"))

        with pytest.raises(HTTPException) as exc_info:
            await handle_stripe_webhook(
                request=mock_request,
                stripe_signature="test_signature",
                db=mock_db_session,
            )

        assert exc_info.value.status_code == 400
        assert "Invalid request body" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_stripe_webhook_validation_failure(
        self, mock_db_session, mock_request, mock_stripe_handler
    ):
        """Test Stripe webhook signature validation failure."""
        from dotmac.platform.billing.webhooks.router import handle_stripe_webhook

        mock_stripe_handler.handle_webhook = AsyncMock(side_effect=ValueError("Invalid signature"))

        with patch(
            "dotmac.platform.billing.webhooks.router.StripeWebhookHandler",
            return_value=mock_stripe_handler,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await handle_stripe_webhook(
                    request=mock_request,
                    stripe_signature="invalid_signature",
                    db=mock_db_session,
                )

        assert exc_info.value.status_code == 400
        assert "Invalid signature" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_stripe_webhook_processing_failure(
        self, mock_db_session, mock_request, mock_stripe_handler
    ):
        """Test Stripe webhook processing failure."""
        from dotmac.platform.billing.webhooks.router import handle_stripe_webhook

        mock_stripe_handler.handle_webhook = AsyncMock(side_effect=Exception("Processing error"))

        with patch(
            "dotmac.platform.billing.webhooks.router.StripeWebhookHandler",
            return_value=mock_stripe_handler,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await handle_stripe_webhook(
                    request=mock_request,
                    stripe_signature="test_signature",
                    db=mock_db_session,
                )

        assert exc_info.value.status_code == 500
        assert "Failed to process webhook" in exc_info.value.detail


# ============================================================================
# PayPal Webhook Tests
# ============================================================================


class TestHandlePayPalWebhook:
    """Test POST /webhooks/paypal endpoint."""

    @pytest.mark.asyncio
    async def test_paypal_webhook_success(self, mock_db_session, mock_request, mock_paypal_handler):
        """Test successful PayPal webhook processing."""
        from dotmac.platform.billing.webhooks.router import handle_paypal_webhook

        with patch(
            "dotmac.platform.billing.webhooks.router.PayPalWebhookHandler",
            return_value=mock_paypal_handler,
        ):
            result = await handle_paypal_webhook(
                request=mock_request,
                paypal_transmission_id="test_id",
                paypal_transmission_sig="test_sig",
                db=mock_db_session,
            )

        assert result["status"] == "processed"
        mock_paypal_handler.handle_webhook.assert_called_once()
        call_kwargs = mock_paypal_handler.handle_webhook.call_args[1]
        assert call_kwargs["signature"] == "test_sig"
        assert call_kwargs["payload"] == b'{"type": "test.event"}'

    @pytest.mark.asyncio
    async def test_paypal_webhook_missing_signature(self, mock_db_session, mock_request):
        """Test PayPal webhook with missing signature header."""
        from dotmac.platform.billing.webhooks.router import handle_paypal_webhook

        with pytest.raises(HTTPException) as exc_info:
            await handle_paypal_webhook(
                request=mock_request,
                paypal_transmission_id="test_id",
                paypal_transmission_sig=None,
                db=mock_db_session,
            )

        assert exc_info.value.status_code == 400
        assert "Missing PayPal signature headers" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_paypal_webhook_invalid_request_body(self, mock_db_session):
        """Test PayPal webhook with invalid request body."""
        from dotmac.platform.billing.webhooks.router import handle_paypal_webhook

        mock_request = MagicMock()
        mock_request.body = AsyncMock(side_effect=Exception("Read error"))

        with pytest.raises(HTTPException) as exc_info:
            await handle_paypal_webhook(
                request=mock_request,
                paypal_transmission_id="test_id",
                paypal_transmission_sig="test_sig",
                db=mock_db_session,
            )

        assert exc_info.value.status_code == 400
        assert "Invalid request body" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_paypal_webhook_validation_failure(
        self, mock_db_session, mock_request, mock_paypal_handler
    ):
        """Test PayPal webhook signature validation failure."""
        from dotmac.platform.billing.webhooks.router import handle_paypal_webhook

        mock_paypal_handler.handle_webhook = AsyncMock(side_effect=ValueError("Invalid signature"))

        with patch(
            "dotmac.platform.billing.webhooks.router.PayPalWebhookHandler",
            return_value=mock_paypal_handler,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await handle_paypal_webhook(
                    request=mock_request,
                    paypal_transmission_id="test_id",
                    paypal_transmission_sig="invalid_signature",
                    db=mock_db_session,
                )

        assert exc_info.value.status_code == 400
        assert "Invalid signature" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_paypal_webhook_processing_failure(
        self, mock_db_session, mock_request, mock_paypal_handler
    ):
        """Test PayPal webhook processing failure."""
        from dotmac.platform.billing.webhooks.router import handle_paypal_webhook

        mock_paypal_handler.handle_webhook = AsyncMock(side_effect=Exception("Processing error"))

        with patch(
            "dotmac.platform.billing.webhooks.router.PayPalWebhookHandler",
            return_value=mock_paypal_handler,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await handle_paypal_webhook(
                    request=mock_request,
                    paypal_transmission_id="test_id",
                    paypal_transmission_sig="test_sig",
                    db=mock_db_session,
                )

        assert exc_info.value.status_code == 500
        assert "Failed to process webhook" in exc_info.value.detail


# ============================================================================
# Webhook Config Tests
# ============================================================================


class TestGetWebhookConfig:
    """Test GET /webhooks/config endpoint."""

    @pytest.mark.asyncio
    async def test_get_webhook_config_all_enabled(self):
        """Test getting webhook config with all providers enabled."""
        from dotmac.platform.billing.config import (
            BillingConfig,
            PayPalConfig,
            StripeConfig,
            WebhookConfig,
        )
        from dotmac.platform.billing.webhooks.router import get_webhook_config

        mock_config = BillingConfig(
            enable_webhooks=True,
            stripe=StripeConfig(
                api_key="sk_test_123",
                webhook_secret="whsec_test",
                publishable_key="pk_test_123",
            ),
            paypal=PayPalConfig(
                client_id="client_123",
                client_secret="secret_123",
                webhook_id="webhook_123",
                environment="sandbox",
            ),
            webhook=WebhookConfig(
                endpoint_base_url="https://example.com/webhooks",
                signing_secret="test_secret",
            ),
        )

        with patch(
            "dotmac.platform.billing.webhooks.router.get_billing_config",
            return_value=mock_config,
        ):
            result = await get_webhook_config()

        assert result["webhooks_enabled"] is True
        assert result["stripe_configured"] is True
        assert result["paypal_configured"] is True
        assert result["webhook_endpoint"] == "https://example.com/webhooks"

    @pytest.mark.asyncio
    async def test_get_webhook_config_disabled(self):
        """Test getting webhook config with webhooks disabled."""
        from dotmac.platform.billing.config import BillingConfig
        from dotmac.platform.billing.webhooks.router import get_webhook_config

        mock_config = BillingConfig(
            enable_webhooks=False,
            stripe=None,
            paypal=None,
            webhook=None,
        )

        with patch(
            "dotmac.platform.billing.webhooks.router.get_billing_config",
            return_value=mock_config,
        ):
            result = await get_webhook_config()

        assert result["webhooks_enabled"] is False
        assert result["stripe_configured"] is False
        assert result["paypal_configured"] is False
        assert result["webhook_endpoint"] is None

    @pytest.mark.asyncio
    async def test_get_webhook_config_partial(self):
        """Test getting webhook config with only Stripe configured."""
        from dotmac.platform.billing.config import BillingConfig, StripeConfig
        from dotmac.platform.billing.webhooks.router import get_webhook_config

        mock_config = BillingConfig(
            enable_webhooks=True,
            stripe=StripeConfig(
                api_key="sk_test_123",
                webhook_secret="whsec_test",
                publishable_key="pk_test_123",
            ),
            paypal=None,
            webhook=None,
        )

        with patch(
            "dotmac.platform.billing.webhooks.router.get_billing_config",
            return_value=mock_config,
        ):
            result = await get_webhook_config()

        assert result["webhooks_enabled"] is True
        assert result["stripe_configured"] is True
        assert result["paypal_configured"] is False
        assert result["webhook_endpoint"] is None

    @pytest.mark.asyncio
    async def test_get_webhook_config_stripe_no_secret(self):
        """Test webhook config with Stripe but no webhook secret."""
        from dotmac.platform.billing.config import BillingConfig, StripeConfig
        from dotmac.platform.billing.webhooks.router import get_webhook_config

        mock_config = BillingConfig(
            enable_webhooks=True,
            stripe=StripeConfig(
                api_key="sk_test_123",
                webhook_secret=None,
                publishable_key="pk_test_123",
            ),
            paypal=None,
            webhook=None,
        )

        with patch(
            "dotmac.platform.billing.webhooks.router.get_billing_config",
            return_value=mock_config,
        ):
            result = await get_webhook_config()

        assert result["webhooks_enabled"] is True
        assert result["stripe_configured"] is False
        assert result["paypal_configured"] is False

    @pytest.mark.asyncio
    async def test_get_webhook_config_paypal_no_id(self):
        """Test webhook config with PayPal but no webhook ID."""
        from dotmac.platform.billing.config import BillingConfig, PayPalConfig
        from dotmac.platform.billing.webhooks.router import get_webhook_config

        mock_config = BillingConfig(
            enable_webhooks=True,
            stripe=None,
            paypal=PayPalConfig(
                client_id="client_123",
                client_secret="secret_123",
                webhook_id=None,
                environment="sandbox",
            ),
            webhook=None,
        )

        with patch(
            "dotmac.platform.billing.webhooks.router.get_billing_config",
            return_value=mock_config,
        ):
            result = await get_webhook_config()

        assert result["webhooks_enabled"] is True
        assert result["stripe_configured"] is False
        assert result["paypal_configured"] is False
