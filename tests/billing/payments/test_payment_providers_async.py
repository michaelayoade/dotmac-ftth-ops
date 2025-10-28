"""
Tests for async payment provider fixes.

This module tests that blocking Stripe SDK calls are properly wrapped
in anyio.to_thread.run_sync to avoid blocking the event loop.
"""

from unittest.mock import MagicMock, patch

import pytest

from dotmac.platform.billing.payments.providers import StripePaymentProvider


@pytest.mark.unit
class TestStripeProviderAsyncBehavior:
    """Tests for async behavior of Stripe provider"""

    @pytest.mark.asyncio
    async def test_charge_payment_method_uses_async_thread(self):
        """Test that charge_payment_method runs Stripe calls in a thread"""
        # Mock Stripe SDK
        mock_intent = MagicMock()
        mock_intent.id = "pi_123"
        mock_intent.status = "succeeded"
        mock_intent.charges.data = []

        mock_stripe = MagicMock()
        mock_stripe.api_key = None
        mock_stripe.PaymentIntent.create = MagicMock(return_value=mock_intent)
        mock_stripe.error = MagicMock()

        # Patch stripe import before creating provider
        with patch.dict("sys.modules", {"stripe": mock_stripe}):
            # Create provider
            provider = StripePaymentProvider(api_key="sk_test_123")

            # Mock anyio.to_thread.run_sync to verify it's called
            with patch(
                "dotmac.platform.billing.payments.providers.anyio.to_thread.run_sync"
            ) as mock_run_sync:
                # Setup mock to return the intent
                mock_run_sync.return_value = mock_intent

                # Call the method
                result = await provider.charge_payment_method(
                    amount=1000,
                    currency="USD",
                    payment_method_id="pm_123",
                    metadata={"test": "data"},
                )

                # Verify anyio.to_thread.run_sync was called
                assert mock_run_sync.called
                assert result.success is True
                assert result.provider_payment_id == "pi_123"

    @pytest.mark.asyncio
    async def test_refund_payment_uses_async_thread(self):
        """Test that refund_payment runs Stripe calls in a thread"""
        # Mock Stripe SDK
        mock_refund = MagicMock()
        mock_refund.id = "re_123"

        mock_stripe = MagicMock()
        mock_stripe.api_key = None
        mock_stripe.Refund.create = MagicMock(return_value=mock_refund)
        mock_stripe.error = MagicMock()

        # Patch stripe import before creating provider
        with patch.dict("sys.modules", {"stripe": mock_stripe}):
            # Create provider
            provider = StripePaymentProvider(api_key="sk_test_123")

            # Mock anyio.to_thread.run_sync
            with patch(
                "dotmac.platform.billing.payments.providers.anyio.to_thread.run_sync"
            ) as mock_run_sync:
                mock_run_sync.return_value = mock_refund

                # Call the method
                result = await provider.refund_payment(
                    provider_payment_id="pi_123",
                    amount=500,
                    reason="customer_request",
                )

                # Verify anyio.to_thread.run_sync was called
                assert mock_run_sync.called
                assert result.success is True
                assert result.provider_refund_id == "re_123"

    @pytest.mark.asyncio
    async def test_create_setup_intent_uses_async_thread(self):
        """Test that create_setup_intent runs Stripe calls in a thread"""
        # Mock Stripe SDK
        mock_intent = MagicMock()
        mock_intent.id = "seti_123"
        mock_intent.client_secret = "secret_123"
        mock_intent.status = "requires_payment_method"
        mock_intent.payment_method_types = ["card"]

        mock_stripe = MagicMock()
        mock_stripe.api_key = None
        mock_stripe.SetupIntent.create = MagicMock(return_value=mock_intent)

        # Patch stripe import before creating provider
        with patch.dict("sys.modules", {"stripe": mock_stripe}):
            # Create provider
            provider = StripePaymentProvider(api_key="sk_test_123")

            # Mock anyio.to_thread.run_sync
            with patch(
                "dotmac.platform.billing.payments.providers.anyio.to_thread.run_sync"
            ) as mock_run_sync:
                mock_run_sync.return_value = mock_intent

                # Call the method
                result = await provider.create_setup_intent(
                    customer_id="cus_123",
                    payment_method_types=["card"],
                )

                # Verify anyio.to_thread.run_sync was called
                assert mock_run_sync.called
                assert result.intent_id == "seti_123"
                assert result.client_secret == "secret_123"

    @pytest.mark.asyncio
    async def test_create_payment_method_uses_async_thread(self):
        """Test that create_payment_method runs Stripe calls in a thread"""
        # Mock Stripe SDK
        mock_pm = MagicMock()
        mock_pm.id = "pm_123"
        mock_pm.type = "card"
        mock_pm.card = MagicMock()
        mock_pm.card.to_dict = MagicMock(return_value={"brand": "visa", "last4": "4242"})

        mock_stripe = MagicMock()
        mock_stripe.api_key = None
        mock_stripe.PaymentMethod.create = MagicMock(return_value=mock_pm)

        # Patch stripe import before creating provider
        with patch.dict("sys.modules", {"stripe": mock_stripe}):
            # Create provider
            provider = StripePaymentProvider(api_key="sk_test_123")

            # Mock anyio.to_thread.run_sync
            with patch(
                "dotmac.platform.billing.payments.providers.anyio.to_thread.run_sync"
            ) as mock_run_sync:
                mock_run_sync.return_value = mock_pm

                # Call the method
                result = await provider.create_payment_method(
                    type="card",
                    details={"card": {"number": "4242424242424242"}},
                    customer_id=None,
                )

                # Verify anyio.to_thread.run_sync was called
                assert mock_run_sync.called
                assert result["id"] == "pm_123"
                assert result["type"] == "card"

    @pytest.mark.asyncio
    async def test_attach_payment_method_uses_async_thread(self):
        """Test that attach_payment_method_to_customer runs Stripe calls in a thread"""
        # Mock Stripe SDK
        mock_pm = MagicMock()
        mock_pm.id = "pm_123"
        mock_pm.customer = "cus_123"

        mock_stripe = MagicMock()
        mock_stripe.api_key = None
        mock_stripe.PaymentMethod.attach = MagicMock(return_value=mock_pm)

        # Patch stripe import before creating provider
        with patch.dict("sys.modules", {"stripe": mock_stripe}):
            # Create provider
            provider = StripePaymentProvider(api_key="sk_test_123")

            # Mock anyio.to_thread.run_sync
            with patch(
                "dotmac.platform.billing.payments.providers.anyio.to_thread.run_sync"
            ) as mock_run_sync:
                mock_run_sync.return_value = mock_pm

                # Call the method
                result = await provider.attach_payment_method_to_customer(
                    payment_method_id="pm_123",
                    customer_id="cus_123",
                )

                # Verify anyio.to_thread.run_sync was called
                assert mock_run_sync.called
                assert result["id"] == "pm_123"
                assert result["customer"] == "cus_123"

    @pytest.mark.asyncio
    async def test_detach_payment_method_uses_async_thread(self):
        """Test that detach_payment_method runs Stripe calls in a thread"""
        # Mock Stripe SDK
        mock_stripe = MagicMock()
        mock_stripe.api_key = None
        mock_stripe.PaymentMethod.detach = MagicMock(return_value=MagicMock())

        # Patch stripe import before creating provider
        with patch.dict("sys.modules", {"stripe": mock_stripe}):
            # Create provider
            provider = StripePaymentProvider(api_key="sk_test_123")

            # Mock anyio.to_thread.run_sync
            with patch(
                "dotmac.platform.billing.payments.providers.anyio.to_thread.run_sync"
            ) as mock_run_sync:
                mock_run_sync.return_value = None

                # Call the method
                result = await provider.detach_payment_method(
                    payment_method_id="pm_123",
                )

                # Verify anyio.to_thread.run_sync was called
                assert mock_run_sync.called
                assert result is True

    @pytest.mark.asyncio
    async def test_handle_webhook_uses_async_thread(self):
        """Test that handle_webhook runs Stripe calls in a thread"""
        # Mock Stripe SDK
        mock_event = MagicMock()
        mock_event.type = "payment_intent.succeeded"
        mock_event.data.object = MagicMock()
        mock_event.data.object.id = "pi_123"
        mock_event.data.object.amount = 1000
        mock_event.data.object.currency = "usd"

        mock_stripe = MagicMock()
        mock_stripe.api_key = None
        mock_stripe.Webhook.construct_event = MagicMock(return_value=mock_event)
        mock_stripe.error = MagicMock()

        # Patch stripe import before creating provider
        with patch.dict("sys.modules", {"stripe": mock_stripe}):
            # Create provider with webhook secret
            provider = StripePaymentProvider(
                api_key="sk_test_123",
                webhook_secret="whsec_test_123",
            )

            # Mock anyio.to_thread.run_sync
            with patch(
                "dotmac.platform.billing.payments.providers.anyio.to_thread.run_sync"
            ) as mock_run_sync:
                mock_run_sync.return_value = mock_event

                # Call the method
                result = await provider.handle_webhook(
                    webhook_data={"test": "data"},
                    signature="test_signature",
                )

                # Verify anyio.to_thread.run_sync was called
                assert mock_run_sync.called
                assert result["event_type"] == "payment_succeeded"
                assert result["payment_id"] == "pi_123"

    @pytest.mark.asyncio
    async def test_all_stripe_calls_are_async(self):
        """Integration test to verify no blocking Stripe calls remain"""
        # Setup mocks for all Stripe SDK objects
        mock_intent = MagicMock()
        mock_intent.id = "pi_123"
        mock_intent.status = "succeeded"
        mock_intent.charges.data = []

        mock_refund = MagicMock()
        mock_refund.id = "re_123"

        mock_setup = MagicMock()
        mock_setup.id = "seti_123"
        mock_setup.client_secret = "secret"
        mock_setup.status = "requires_payment_method"
        mock_setup.payment_method_types = ["card"]

        mock_pm = MagicMock()
        mock_pm.id = "pm_123"
        mock_pm.type = "card"
        mock_pm.customer = "cus_123"
        mock_pm.card = None

        mock_stripe = MagicMock()
        mock_stripe.api_key = None
        # Configure all Stripe SDK calls
        mock_stripe.PaymentIntent.create = MagicMock(return_value=mock_intent)
        mock_stripe.Refund.create = MagicMock(return_value=mock_refund)
        mock_stripe.SetupIntent.create = MagicMock(return_value=mock_setup)
        mock_stripe.PaymentMethod.create = MagicMock(return_value=mock_pm)
        mock_stripe.PaymentMethod.attach = MagicMock(return_value=mock_pm)
        mock_stripe.PaymentMethod.detach = MagicMock()
        mock_stripe.error = MagicMock()

        # Patch stripe import before creating provider
        with patch.dict("sys.modules", {"stripe": mock_stripe}):
            provider = StripePaymentProvider(api_key="sk_test_123")

            # Patch anyio.to_thread.run_sync to count calls
            call_count = 0

            async def mock_run_sync(func):
                nonlocal call_count
                call_count += 1
                return func()

            with patch(
                "dotmac.platform.billing.payments.providers.anyio.to_thread.run_sync",
                side_effect=mock_run_sync,
            ):
                # Test all async methods
                await provider.charge_payment_method(1000, "USD", "pm_123")
                await provider.refund_payment("pi_123", 500)
                await provider.create_setup_intent("cus_123")
                await provider.create_payment_method("card", {})
                await provider.attach_payment_method_to_customer("pm_123", "cus_123")
                await provider.detach_payment_method("pm_123")

                # Verify all calls went through anyio.to_thread.run_sync
                # Should be 7 calls (charge, refund, setup, create PM, attach, detach, and attach in create_payment_method)
                assert call_count >= 6, f"Expected at least 6 async calls, got {call_count}"
