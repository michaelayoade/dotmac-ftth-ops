"""
Test webhook handlers for payment providers
"""

import hashlib
import hmac
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.config import BillingConfig, StripeConfig
from dotmac.platform.billing.core.enums import PaymentStatus
from dotmac.platform.billing.webhooks.handlers import (
    PayPalWebhookHandler,
    StripeWebhookHandler,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_db():
    """Mock database session"""
    db = MagicMock(spec=AsyncSession)
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


@pytest.fixture
def stripe_config():
    """Stripe configuration"""
    return BillingConfig(
        stripe=StripeConfig(
            api_key="sk_test_123",
            webhook_secret="whsec_test123",
            publishable_key="pk_test_123",
        ),
        enable_webhooks=True,
    )


@pytest.fixture
def stripe_handler(mock_db, stripe_config):
    """Stripe webhook handler"""
    with patch(
        "dotmac.platform.billing.webhooks.handlers.get_billing_config", return_value=stripe_config
    ):
        handler = StripeWebhookHandler(mock_db, stripe_config)
        handler.payment_service = AsyncMock()
        handler.invoice_service = AsyncMock()
        return handler


@pytest.fixture
def paypal_handler(mock_db):
    """PayPal webhook handler"""
    handler = PayPalWebhookHandler(mock_db)
    handler.payment_service = AsyncMock()
    handler.invoice_service = AsyncMock()
    return handler


@pytest.mark.integration
class TestStripeWebhookHandler:
    """Test Stripe webhook handler"""

    def generate_stripe_signature(self, payload: str, secret: str, timestamp: int) -> str:
        """Generate Stripe webhook signature"""
        signed_payload = f"{timestamp}.{payload}"
        signature = hmac.new(
            secret.encode("utf-8"),
            signed_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return f"t={timestamp},v1={signature}"

    @pytest.mark.asyncio
    async def test_verify_signature_valid(self, stripe_handler, stripe_config):
        """Test valid signature verification"""
        payload = '{"type": "payment_intent.succeeded"}'
        timestamp = 1234567890
        signature = self.generate_stripe_signature(
            payload,
            stripe_config.stripe.webhook_secret,
            timestamp,
        )

        result = await stripe_handler.verify_signature(
            payload.encode("utf-8"),
            signature,
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_verify_signature_invalid(self, stripe_handler):
        """Test invalid signature verification"""
        payload = '{"type": "payment_intent.succeeded"}'
        signature = "t=1234567890,v1=invalid_signature"

        result = await stripe_handler.verify_signature(
            payload.encode("utf-8"),
            signature,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_process_payment_succeeded(self, stripe_handler):
        """Test processing payment succeeded event"""
        event_data = {
            "id": "pi_123",
            "amount": 1000,
            "currency": "usd",
            "metadata": {
                "tenant_id": "tenant1",
                "payment_id": "pay_123",
                "invoice_id": "inv_123",
            },
        }

        result = await stripe_handler.process_event(
            "payment_intent.succeeded",
            event_data,
        )

        assert result["status"] == "processed"
        assert result["payment_intent_id"] == "pi_123"

        # Verify service calls
        stripe_handler.payment_service.update_payment_status.assert_called_once_with(
            tenant_id="tenant1",
            payment_id="pay_123",
            new_status=PaymentStatus.SUCCEEDED,
            provider_data={
                "stripe_payment_intent_id": "pi_123",
                "stripe_amount": 1000,
                "stripe_currency": "usd",
            },
        )
        stripe_handler.invoice_service.mark_invoice_paid.assert_called_once_with(
            "tenant1", "inv_123", payment_id="pay_123"
        )

    @pytest.mark.asyncio
    async def test_process_payment_failed(self, stripe_handler):
        """Test processing payment failed event"""
        event_data = {
            "id": "pi_123",
            "last_payment_error": {"message": "Card declined"},
            "metadata": {
                "tenant_id": "tenant1",
                "payment_id": "pay_123",
            },
        }

        result = await stripe_handler.process_event(
            "payment_intent.payment_failed",
            event_data,
        )

        assert result["status"] == "processed"
        assert result["error"] == "Card declined"

        # Verify service call
        stripe_handler.payment_service.update_payment_status.assert_called_once_with(
            tenant_id="tenant1",
            payment_id="pay_123",
            new_status=PaymentStatus.FAILED,
            provider_data={
                "stripe_payment_intent_id": "pi_123",
                "stripe_error": "Card declined",
            },
            error_message="Card declined",
        )

    @pytest.mark.asyncio
    async def test_process_charge_refunded(self, stripe_handler):
        """Test processing charge refunded event"""
        event_data = {
            "id": "ch_123",
            "amount_refunded": 500,
            "metadata": {
                "tenant_id": "tenant1",
                "payment_id": "pay_123",
            },
        }

        result = await stripe_handler.process_event(
            "charge.refunded",
            event_data,
        )

        assert result["status"] == "processed"
        assert result["amount_refunded"] == 500

        # Verify service call (handler keeps Stripe minor units to match stored payment amounts)
        from decimal import Decimal

        stripe_handler.payment_service.process_refund_notification.assert_called_once()
        call_args = stripe_handler.payment_service.process_refund_notification.call_args[1]
        assert call_args["tenant_id"] == "tenant1"
        assert call_args["payment_id"] == "pay_123"
        assert call_args["refund_amount"] == Decimal("500")
        assert "reason" in call_args

    @pytest.mark.asyncio
    async def test_process_invoice_paid(self, stripe_handler):
        """Test processing invoice paid event"""
        event_data = {
            "id": "in_123",
            "metadata": {
                "tenant_id": "tenant1",
                "invoice_id": "inv_123",
            },
        }

        result = await stripe_handler.process_event(
            "invoice.payment_succeeded",
            event_data,
        )

        assert result["status"] == "processed"
        assert result["invoice_id"] == "inv_123"

        # Verify service call
        stripe_handler.invoice_service.mark_invoice_paid.assert_called_once_with(
            "tenant1", "inv_123"
        )

    @pytest.mark.asyncio
    async def test_process_unhandled_event(self, stripe_handler):
        """Test processing unhandled event type"""
        event_data = {"id": "evt_123"}

        result = await stripe_handler.process_event(
            "unknown.event.type",
            event_data,
        )

        assert result["status"] == "ignored"
        assert result["event_type"] == "unknown.event.type"


@pytest.mark.integration
class TestPayPalWebhookHandler:
    """Test PayPal webhook handler"""

    @pytest.mark.asyncio
    async def test_process_payment_completed(self, paypal_handler):
        """Test processing payment completed event"""
        event_data = {
            "id": "cap_123",
            "amount": {"value": "10.00", "currency_code": "USD"},
            "custom_id": "tenant1:pay_123:inv_123",
        }

        result = await paypal_handler.process_event(
            "PAYMENT.CAPTURE.COMPLETED",
            event_data,
        )

        assert result["status"] == "processed"
        assert result["capture_id"] == "cap_123"

        # Verify service call
        paypal_handler.payment_service.update_payment_status.assert_called_once()
        call_args = paypal_handler.payment_service.update_payment_status.call_args[1]
        assert call_args["tenant_id"] == "tenant1"
        assert call_args["payment_id"] == "pay_123"
        assert call_args["new_status"] == PaymentStatus.SUCCEEDED

    @pytest.mark.asyncio
    async def test_process_payment_denied(self, paypal_handler):
        """Test processing payment denied event"""
        event_data = {
            "id": "cap_123",
            "custom_id": "tenant1:pay_123",
        }

        result = await paypal_handler.process_event(
            "PAYMENT.CAPTURE.DENIED",
            event_data,
        )

        assert result["status"] == "processed"
        assert result["capture_id"] == "cap_123"

        # Verify service call
        paypal_handler.payment_service.update_payment_status.assert_called_once()
        call_args = paypal_handler.payment_service.update_payment_status.call_args[1]
        assert call_args["tenant_id"] == "tenant1"
        assert call_args["payment_id"] == "pay_123"
        assert call_args["new_status"] == PaymentStatus.FAILED

    @pytest.mark.asyncio
    async def test_process_payment_refunded(self, paypal_handler):
        """Test processing payment refunded event"""
        event_data = {
            "id": "ref_123",
            "amount": {"value": "5.00"},
            "custom_id": "tenant1:pay_123",
        }

        result = await paypal_handler.process_event(
            "PAYMENT.CAPTURE.REFUNDED",
            event_data,
        )

        assert result["status"] == "processed"
        assert result["refund_id"] == "ref_123"

        # Verify service call (handler uses process_refund_notification, not process_refund)
        from decimal import Decimal

        paypal_handler.payment_service.process_refund_notification.assert_called_once()
        call_args = paypal_handler.payment_service.process_refund_notification.call_args[1]
        assert call_args["tenant_id"] == "tenant1"
        assert call_args["payment_id"] == "pay_123"
        assert call_args["refund_amount"] == Decimal("5.00")
        assert call_args["reason"] == "Refunded via PayPal"

    @pytest.mark.asyncio
    async def test_process_unhandled_event(self, paypal_handler):
        """Test processing unhandled event type"""
        event_data = {"id": "evt_123"}

        result = await paypal_handler.process_event(
            "UNKNOWN.EVENT",
            event_data,
        )

        assert result["status"] == "ignored"
        assert result["event_type"] == "UNKNOWN.EVENT"
