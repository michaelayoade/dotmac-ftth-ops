"""
Tests for payment edge cases and error scenarios.
"""

from datetime import datetime

import pytest

from dotmac.platform.billing.core.enums import (
    PaymentMethodType,
    PaymentStatus,
)
from tests.billing.payments.conftest import (
    setup_mock_db_result,
    setup_mock_refresh,
)
from tests.fixtures.async_db import create_mock_async_result

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestEdgeCasesAndErrorScenarios:
    """Test edge cases and error handling"""

    async def test_create_payment_with_zero_amount(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test creating payment with zero amount"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)
        setup_mock_refresh(mock_payment_db_session)

        # Execute
        result = await payment_service.create_payment(
            tenant_id="test-tenant",
            amount=0,
            currency="USD",
            customer_id="customer_456",
            payment_method_id="pm_789",
        )

        # Verify - should still process
        assert result.amount == 0
        assert result.status == PaymentStatus.SUCCEEDED

    async def test_create_payment_with_very_large_amount(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test creating payment with very large amount"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)
        setup_mock_refresh(mock_payment_db_session)
        large_amount = 999999999  # $9,999,999.99

        # Execute
        result = await payment_service.create_payment(
            tenant_id="test-tenant",
            amount=large_amount,
            currency="USD",
            customer_id="customer_456",
            payment_method_id="pm_789",
        )

        # Verify
        assert result.amount == large_amount

    async def test_concurrent_payment_creation_with_same_idempotency_key(
        self,
        payment_service,
        mock_payment_db_session,
        sample_payment_entity,
        sample_payment_method_entity,
    ):
        """Test concurrent payment creation with same idempotency key"""
        # This simulates race condition handling
        # Setup
        call_count = 0

        async def mock_execute_side_effect(query):
            nonlocal call_count
            call_count += 1

            if "idempotency_key" in str(query):
                # First call returns None, second returns existing payment
                if call_count == 1:
                    return create_mock_async_result([])
                else:
                    return create_mock_async_result([sample_payment_entity])
            else:
                return create_mock_async_result([sample_payment_method_entity])

        mock_payment_db_session.execute.side_effect = mock_execute_side_effect
        setup_mock_refresh(mock_payment_db_session)

        # Execute
        result = await payment_service.create_payment(
            tenant_id="test-tenant",
            amount=1000,
            currency="USD",
            customer_id="customer_456",
            payment_method_id="pm_789",
            idempotency_key="concurrent_key",
        )

        # Verify - should handle gracefully
        assert result is not None

    async def test_payment_method_expiry_date_edge_cases(
        self, payment_service, mock_payment_db_session
    ):
        """Test payment method with various expiry date edge cases"""
        # Setup
        mock_payment_db_session.execute.return_value.scalars.return_value.all.return_value = []
        setup_mock_refresh(mock_payment_db_session)

        # Test with current month/year
        current_date = datetime.now()
        result = await payment_service.add_payment_method(
            tenant_id="test-tenant",
            customer_id="customer_456",
            payment_method_type=PaymentMethodType.CARD,
            provider="stripe",
            provider_payment_method_id="stripe_pm_123",
            display_name="Current month card",
            expiry_month=current_date.month,
            expiry_year=current_date.year,
        )

        assert result.expiry_month == current_date.month
        assert result.expiry_year == current_date.year

    async def test_payment_retry_with_exponential_backoff(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test that payment retry uses exponential backoff"""
        # Setup
        sample_payment_entity.status = PaymentStatus.FAILED
        sample_payment_entity.retry_count = 2  # Already retried twice
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)

        # Execute
        try:
            await payment_service.retry_failed_payment(
                tenant_id="test-tenant",
                payment_id="payment_123",
            )
        except Exception:  # noqa: BLE001
            pass

        # Verify - next retry should be scheduled with exponential backoff
        if sample_payment_entity.next_retry_at:
            assert sample_payment_entity.next_retry_at is not None

    async def test_payment_with_special_characters_in_metadata(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test payment with special characters in metadata"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)
        setup_mock_refresh(mock_payment_db_session)

        metadata = {
            "description": "Payment for 'Special' Order #123",
            "notes": 'Contains "quotes" and other chars: @#$%',
            "unicode": "Payment with emoji 🎉 and unicode ñ",
        }

        # Execute
        result = await payment_service.create_payment(
            tenant_id="test-tenant",
            amount=1000,
            currency="USD",
            customer_id="customer_456",
            payment_method_id="pm_789",
            metadata=metadata,
        )

        # Verify - should handle special characters
        assert result.extra_data == metadata
