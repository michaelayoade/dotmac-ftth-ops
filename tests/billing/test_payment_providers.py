"""
Tests for Payment Providers with focus on StripePaymentProvider
"""

from unittest.mock import MagicMock, patch

import pytest

from dotmac.platform.billing.payments.providers import (
    SetupIntent,
    StripePaymentProvider,
)


@pytest.mark.unit
class TestStripePaymentProvider:
    """Test StripePaymentProvider implementation"""

    @pytest.fixture
    def mock_stripe_module(self):
        """Create mock stripe module"""
        mock_stripe = MagicMock()

        # Mock PaymentIntent
        mock_payment_intent = MagicMock()
        mock_payment_intent.id = "pi_test_123"
        mock_payment_intent.status = "succeeded"
        mock_payment_intent.charges.data = [MagicMock(balance_transaction=MagicMock(fee=29))]

        mock_stripe.PaymentIntent.create = MagicMock(return_value=mock_payment_intent)

        # Mock Refund
        mock_refund = MagicMock()
        mock_refund.id = "re_test_123"
        mock_stripe.Refund.create = MagicMock(return_value=mock_refund)

        # Mock SetupIntent
        mock_setup_intent = MagicMock()
        mock_setup_intent.id = "seti_test_123"
        mock_setup_intent.client_secret = "seti_secret_123"
        mock_setup_intent.status = "requires_payment_method"
        mock_setup_intent.payment_method_types = ["card"]
        mock_stripe.SetupIntent.create = MagicMock(return_value=mock_setup_intent)

        # Mock PaymentMethod
        mock_payment_method = MagicMock()
        mock_payment_method.id = "pm_test_123"
        mock_payment_method.type = "card"
        mock_payment_method.card = MagicMock()
        mock_payment_method.card.to_dict = MagicMock(
            return_value={"brand": "visa", "last4": "4242"}
        )
        mock_payment_method.customer = "cus_test_123"
        mock_stripe.PaymentMethod.create = MagicMock(return_value=mock_payment_method)
        mock_stripe.PaymentMethod.attach = MagicMock(return_value=mock_payment_method)
        mock_stripe.PaymentMethod.detach = MagicMock()

        # Mock Webhook
        mock_event = MagicMock()
        mock_event.type = "payment_intent.succeeded"
        mock_event.data.object = mock_payment_intent
        mock_stripe.Webhook.construct_event = MagicMock(return_value=mock_event)

        # Mock errors
        mock_stripe.error.CardError = type("CardError", (Exception,), {})
        mock_stripe.error.StripeError = type("StripeError", (Exception,), {})
        mock_stripe.error.SignatureVerificationError = type(
            "SignatureVerificationError", (Exception,), {}
        )

        return mock_stripe

    @pytest.mark.asyncio
    async def test_stripe_provider_initialization(self, mock_stripe_module):
        """Test StripePaymentProvider initialization"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            provider = StripePaymentProvider(api_key="sk_test_123", webhook_secret="whsec_test_123")

            assert provider.api_key == "sk_test_123"
            assert provider.webhook_secret == "whsec_test_123"
            assert mock_stripe_module.api_key == "sk_test_123"

    @pytest.mark.asyncio
    async def test_stripe_charge_payment_method_success(self, mock_stripe_module):
        """Test successful charge with Stripe"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.charge_payment_method(
                amount=1000,
                currency="USD",
                payment_method_id="pm_test_123",
                metadata={"order_id": "123"},
            )

            assert result.success is True
            assert result.provider_payment_id == "pi_test_123"
            assert result.provider_fee == 29

            mock_stripe_module.PaymentIntent.create.assert_called_once_with(
                amount=1000,
                currency="usd",
                payment_method="pm_test_123",
                confirm=True,
                metadata={"order_id": "123"},
            )

    @pytest.mark.asyncio
    async def test_stripe_charge_payment_method_failed(self, mock_stripe_module):
        """Test failed charge with Stripe"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            # Setup failed payment intent
            mock_payment_intent = MagicMock()
            mock_payment_intent.id = "pi_failed_123"
            mock_payment_intent.status = "requires_action"
            mock_payment_intent.charges.data = []
            mock_stripe_module.PaymentIntent.create.return_value = mock_payment_intent

            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.charge_payment_method(
                amount=1000, currency="USD", payment_method_id="pm_test_123"
            )

            assert result.success is False
            assert result.provider_payment_id == "pi_failed_123"
            assert "requires_action" in result.error_message

    @pytest.mark.asyncio
    async def test_stripe_charge_card_error(self, mock_stripe_module):
        """Test charge with card error"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            # Create a CardError instance
            card_error = mock_stripe_module.error.CardError()
            card_error.user_message = "Your card was declined"
            card_error.code = "card_declined"

            mock_stripe_module.PaymentIntent.create.side_effect = card_error

            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.charge_payment_method(
                amount=1000, currency="USD", payment_method_id="pm_test_123"
            )

            assert result.success is False
            assert result.error_message == "Your card was declined"
            assert result.error_code == "card_declined"

    @pytest.mark.asyncio
    async def test_stripe_charge_stripe_error(self, mock_stripe_module):
        """Test charge with Stripe API error"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            stripe_error = mock_stripe_module.error.StripeError("API error")
            stripe_error.code = "api_error"

            mock_stripe_module.PaymentIntent.create.side_effect = stripe_error

            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.charge_payment_method(
                amount=1000, currency="USD", payment_method_id="pm_test_123"
            )

            assert result.success is False
            assert "API error" in str(result.error_message)
            assert result.error_code == "api_error"

    @pytest.mark.asyncio
    async def test_stripe_charge_general_exception(self, mock_stripe_module):
        """Test charge with general exception"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            mock_stripe_module.PaymentIntent.create.side_effect = Exception("Network error")

            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.charge_payment_method(
                amount=1000, currency="USD", payment_method_id="pm_test_123"
            )

            assert result.success is False
            assert result.error_message == "Network error"
            assert result.error_code is None

    @pytest.mark.asyncio
    async def test_stripe_refund_payment_success(self, mock_stripe_module):
        """Test successful refund with Stripe"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.refund_payment(
                provider_payment_id="pi_test_123", amount=500, reason="Customer request"
            )

            assert result.success is True
            assert result.provider_refund_id == "re_test_123"

            mock_stripe_module.Refund.create.assert_called_once_with(
                payment_intent="pi_test_123", amount=500, reason="Customer request"
            )

    @pytest.mark.asyncio
    async def test_stripe_refund_payment_error(self, mock_stripe_module):
        """Test refund with Stripe error"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            stripe_error = mock_stripe_module.error.StripeError("Refund failed")
            stripe_error.code = "refund_failed"

            mock_stripe_module.Refund.create.side_effect = stripe_error

            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.refund_payment(provider_payment_id="pi_test_123", amount=500)

            assert result.success is False
            assert "Refund failed" in str(result.error_message)
            assert result.error_code == "refund_failed"

    @pytest.mark.asyncio
    async def test_stripe_refund_general_exception(self, mock_stripe_module):
        """Test refund with general exception"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            mock_stripe_module.Refund.create.side_effect = Exception("Network error")

            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.refund_payment(provider_payment_id="pi_test_123", amount=500)

            assert result.success is False
            assert result.error_message == "Network error"

    @pytest.mark.asyncio
    async def test_stripe_create_setup_intent(self, mock_stripe_module):
        """Test creating setup intent with Stripe"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.create_setup_intent(
                customer_id="cus_test_123", payment_method_types=["card", "sepa_debit"]
            )

            assert isinstance(result, SetupIntent)
            assert result.intent_id == "seti_test_123"
            assert result.client_secret == "seti_secret_123"
            assert result.status == "requires_payment_method"
            assert result.payment_method_types == ["card"]

    @pytest.mark.asyncio
    async def test_stripe_create_payment_method(self, mock_stripe_module):
        """Test creating payment method with Stripe"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.create_payment_method(
                type="card",
                details={"card": {"number": "4242424242424242"}},
                customer_id="cus_test_123",
            )

            assert result["id"] == "pm_test_123"
            assert result["type"] == "card"
            assert result["card"]["brand"] == "visa"
            assert result["card"]["last4"] == "4242"

    @pytest.mark.asyncio
    async def test_stripe_create_payment_method_without_customer(self, mock_stripe_module):
        """Test creating payment method without customer"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            # Mock PaymentMethod without attach
            mock_pm = MagicMock()
            mock_pm.id = "pm_test_456"
            mock_pm.type = "card"
            mock_pm.card = MagicMock()
            mock_pm.card.to_dict = MagicMock(return_value={"brand": "mastercard"})
            mock_stripe_module.PaymentMethod.create.return_value = mock_pm

            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.create_payment_method(
                type="card", details={"card": {"number": "5555555555554444"}}, customer_id=None
            )

            assert result["id"] == "pm_test_456"
            # Verify attach was not called
            mock_stripe_module.PaymentMethod.attach.assert_not_called()

    @pytest.mark.asyncio
    async def test_stripe_attach_payment_method_to_customer(self, mock_stripe_module):
        """Test attaching payment method to customer"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.attach_payment_method_to_customer(
                payment_method_id="pm_test_123", customer_id="cus_test_456"
            )

            assert result["id"] == "pm_test_123"
            assert result["customer"] == "cus_test_123"

            mock_stripe_module.PaymentMethod.attach.assert_called_once_with(
                "pm_test_123", customer="cus_test_456"
            )

    @pytest.mark.asyncio
    async def test_stripe_detach_payment_method_success(self, mock_stripe_module):
        """Test detaching payment method successfully"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.detach_payment_method("pm_test_123")

            assert result is True
            mock_stripe_module.PaymentMethod.detach.assert_called_once_with("pm_test_123")

    @pytest.mark.asyncio
    async def test_stripe_detach_payment_method_failure(self, mock_stripe_module):
        """Test detaching payment method failure"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            mock_stripe_module.PaymentMethod.detach.side_effect = Exception("Not found")

            provider = StripePaymentProvider(api_key="sk_test_123")

            result = await provider.detach_payment_method("pm_test_123")

            assert result is False

    @pytest.mark.asyncio
    async def test_stripe_webhook_payment_succeeded(self, mock_stripe_module):
        """Test handling payment succeeded webhook"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            provider = StripePaymentProvider(api_key="sk_test_123", webhook_secret="whsec_test_123")

            webhook_data = {"type": "payment_intent.succeeded"}
            signature = "test_signature"

            result = await provider.handle_webhook(webhook_data, signature)

            assert result["event_type"] == "payment_succeeded"
            assert result["payment_id"] == "pi_test_123"

            # Stripe API expects JSON string, not dict
            import json

            mock_stripe_module.Webhook.construct_event.assert_called_once_with(
                json.dumps(webhook_data), signature, "whsec_test_123"
            )

    @pytest.mark.asyncio
    async def test_stripe_webhook_payment_failed(self, mock_stripe_module):
        """Test handling payment failed webhook"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            # Setup failed payment event
            mock_event = MagicMock()
            mock_event.type = "payment_intent.payment_failed"
            mock_payment_intent = MagicMock()
            mock_payment_intent.id = "pi_failed_123"
            mock_payment_intent.last_payment_error = {"message": "Card declined"}
            mock_event.data.object = mock_payment_intent
            mock_stripe_module.Webhook.construct_event.return_value = mock_event

            provider = StripePaymentProvider(api_key="sk_test_123", webhook_secret="whsec_test_123")

            result = await provider.handle_webhook({}, "signature")

            assert result["event_type"] == "payment_failed"
            assert result["payment_id"] == "pi_failed_123"
            assert result["error"] == {"message": "Card declined"}

    @pytest.mark.asyncio
    async def test_stripe_webhook_charge_refunded(self, mock_stripe_module):
        """Test handling charge refunded webhook"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            # Setup refunded charge event
            mock_event = MagicMock()
            mock_event.type = "charge.refunded"
            mock_charge = MagicMock()
            mock_charge.id = "ch_test_123"
            mock_charge.amount_refunded = 500
            mock_event.data.object = mock_charge
            mock_stripe_module.Webhook.construct_event.return_value = mock_event

            provider = StripePaymentProvider(api_key="sk_test_123", webhook_secret="whsec_test_123")

            result = await provider.handle_webhook({}, "signature")

            assert result["event_type"] == "refund_completed"
            assert result["charge_id"] == "ch_test_123"
            assert result["refund_amount"] == 500

    @pytest.mark.asyncio
    async def test_stripe_webhook_other_event(self, mock_stripe_module):
        """Test handling other webhook events"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            # Setup other event
            mock_event = MagicMock()
            mock_event.type = "customer.created"
            mock_customer = MagicMock()
            mock_customer.id = "cus_test_123"
            mock_event.data.object = mock_customer
            mock_stripe_module.Webhook.construct_event.return_value = mock_event

            provider = StripePaymentProvider(api_key="sk_test_123", webhook_secret="whsec_test_123")

            result = await provider.handle_webhook({}, "signature")

            assert result["event_type"] == "customer.created"
            assert result["data"] == mock_customer

    @pytest.mark.asyncio
    async def test_stripe_webhook_no_secret(self, mock_stripe_module):
        """Test webhook handling without secret configured"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            provider = StripePaymentProvider(api_key="sk_test_123")

            with pytest.raises(ValueError, match="Webhook secret not configured"):
                await provider.handle_webhook({}, "signature")

    @pytest.mark.asyncio
    async def test_stripe_webhook_invalid_signature(self, mock_stripe_module):
        """Test webhook with invalid signature"""
        with patch.dict("sys.modules", {"stripe": mock_stripe_module}):
            mock_stripe_module.Webhook.construct_event.side_effect = (
                mock_stripe_module.error.SignatureVerificationError()
            )

            provider = StripePaymentProvider(api_key="sk_test_123", webhook_secret="whsec_test_123")

            with pytest.raises(ValueError, match="Invalid webhook signature"):
                await provider.handle_webhook({}, "invalid_signature")

    def test_stripe_initialization_without_stripe_package(self):
        """Test StripePaymentProvider initialization without stripe package"""
        with patch.dict("sys.modules", {"stripe": None}):
            with pytest.raises(ImportError, match="stripe package is required"):
                StripePaymentProvider(api_key="sk_test_123")
