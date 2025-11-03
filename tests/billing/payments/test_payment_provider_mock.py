"""
Tests for MockPaymentProvider functionality.
"""

import pytest

from dotmac.platform.billing.payments.providers import MockPaymentProvider

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestMockPaymentProvider:
    """Test MockPaymentProvider functionality"""

    async def test_mock_provider_charge_success(self):
        """Test mock provider successful charge"""
        # Setup
        provider = MockPaymentProvider(always_succeed=True)

        # Execute
        result = await provider.charge_payment_method(
            amount=1000,
            currency="USD",
            payment_method_id="pm_123",
        )

        # Verify
        assert result.success is True
        assert result.provider_payment_id == "mock_payment_1"
        assert result.provider_fee == 29  # 2.9% of 1000

    async def test_mock_provider_charge_failure(self):
        """Test mock provider failed charge"""
        # Setup
        provider = MockPaymentProvider(always_succeed=False)

        # Execute
        result = await provider.charge_payment_method(
            amount=1000,
            currency="USD",
            payment_method_id="pm_123",
        )

        # Verify
        assert result.success is False
        assert result.error_message == "Mock payment failed"
        assert result.error_code == "mock_error"

    async def test_mock_provider_refund_success(self):
        """Test mock provider successful refund"""
        # Setup
        provider = MockPaymentProvider(always_succeed=True)

        # Execute
        result = await provider.refund_payment(
            provider_payment_id="payment_123",
            amount=500,
        )

        # Verify
        assert result.success is True
        assert result.provider_refund_id == "mock_refund_1"

    async def test_mock_provider_create_setup_intent(self):
        """Test mock provider setup intent creation"""
        # Setup
        provider = MockPaymentProvider()

        # Execute
        result = await provider.create_setup_intent(
            customer_id="customer_123",
            payment_method_types=["card", "bank"],
        )

        # Verify
        assert result.intent_id == "mock_setup_intent_customer_123"
        assert result.client_secret == "mock_secret_customer_123"
        assert result.status == "requires_payment_method"
        assert result.payment_method_types == ["card", "bank"]

    async def test_mock_provider_create_payment_method(self):
        """Test mock provider payment method creation"""
        # Setup
        provider = MockPaymentProvider()

        # Execute
        result = await provider.create_payment_method(
            type="card",
            details={"number": "4242424242424242"},
            customer_id="customer_123",
        )

        # Verify
        assert result["id"] == "mock_pm_customer_123"
        assert result["type"] == "card"
        assert result["customer"] == "customer_123"

    async def test_mock_provider_attach_payment_method(self):
        """Test mock provider payment method attachment"""
        # Setup
        provider = MockPaymentProvider()

        # Execute
        result = await provider.attach_payment_method_to_customer(
            payment_method_id="pm_123",
            customer_id="customer_456",
        )

        # Verify
        assert result["id"] == "pm_123"
        assert result["customer"] == "customer_456"

    async def test_mock_provider_detach_payment_method(self):
        """Test mock provider payment method detachment"""
        # Setup
        provider = MockPaymentProvider()

        # Execute
        result = await provider.detach_payment_method("pm_123")

        # Verify
        assert result is True

    async def test_mock_provider_handle_webhook(self):
        """Test mock provider webhook handling"""
        # Setup
        provider = MockPaymentProvider()
        webhook_data = {"event": "payment.succeeded", "amount": 1000}

        # Execute
        result = await provider.handle_webhook(webhook_data)

        # Verify
        assert result["event_type"] == "mock_webhook"
        assert result["data"] == webhook_data
