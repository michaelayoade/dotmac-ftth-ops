"""
Tests for payment retry functionality.
"""

from unittest.mock import patch

import pytest

from dotmac.platform.billing.core.enums import PaymentStatus
from dotmac.platform.billing.core.exceptions import (
    PaymentError,
    PaymentNotFoundError,
)
from dotmac.platform.billing.payments.providers import PaymentResult
from tests.billing.payments.conftest import setup_mock_db_result
from tests.fixtures.async_db import create_mock_async_result

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestRetryFailedPayments:
    """Test retry failed payment functionality"""

    async def test_retry_failed_payment_success(
        self,
        payment_service,
        mock_payment_db_session,
        mock_payment_provider,
        sample_payment_entity,
        sample_payment_method_entity,
    ):
        """Test successfully retrying a failed payment"""
        # Setup
        sample_payment_entity.status = PaymentStatus.FAILED
        sample_payment_entity.retry_count = 0

        async def mock_execute_side_effect(query):
            if "payment_method_id" in str(query):
                return create_mock_async_result([sample_payment_method_entity])
            else:
                return create_mock_async_result([sample_payment_entity])

        mock_payment_db_session.execute.side_effect = mock_execute_side_effect

        # Execute
        result = await payment_service.retry_failed_payment(
            tenant_id="test-tenant",
            payment_id="payment_123",
        )

        # Verify
        assert result.status == PaymentStatus.SUCCEEDED
        assert sample_payment_entity.retry_count == 1
        mock_payment_provider.charge_payment_method.assert_called_once()

    async def test_retry_failed_payment_not_found(self, payment_service, mock_payment_db_session):
        """Test retrying non-existent payment"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=None)

        # Execute & Verify
        with pytest.raises(PaymentNotFoundError, match="Payment payment_123 not found"):
            await payment_service.retry_failed_payment(
                tenant_id="test-tenant",
                payment_id="payment_123",
            )

    async def test_retry_non_failed_payment(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test retrying a non-failed payment"""
        # Setup
        sample_payment_entity.status = PaymentStatus.SUCCEEDED
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)

        # Execute & Verify
        with pytest.raises(PaymentError, match="Can only retry failed payments"):
            await payment_service.retry_failed_payment(
                tenant_id="test-tenant",
                payment_id="payment_123",
            )

    async def test_retry_payment_max_attempts_reached(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test retrying payment when max attempts reached"""
        # Setup
        sample_payment_entity.status = PaymentStatus.FAILED
        sample_payment_entity.retry_count = 3  # Max retries
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)

        # Execute & Verify
        with pytest.raises(PaymentError, match="Maximum retry attempts reached"):
            await payment_service.retry_failed_payment(
                tenant_id="test-tenant",
                payment_id="payment_123",
            )

    async def test_retry_payment_provider_failure(
        self,
        payment_service,
        mock_payment_db_session,
        mock_payment_provider,
        sample_payment_entity,
        sample_payment_method_entity,
    ):
        """Test retrying payment when provider fails again"""
        # Setup
        sample_payment_entity.status = PaymentStatus.FAILED
        sample_payment_entity.retry_count = 1

        async def mock_execute_side_effect(query):
            if "payment_method_id" in str(query):
                return create_mock_async_result([sample_payment_method_entity])
            else:
                return create_mock_async_result([sample_payment_entity])

        mock_payment_db_session.execute.side_effect = mock_execute_side_effect
        mock_payment_provider.charge_payment_method.return_value = PaymentResult(
            success=False,
            error_message="Card declined again",
        )

        # Execute
        result = await payment_service.retry_failed_payment(
            tenant_id="test-tenant",
            payment_id="payment_123",
        )

        # Verify
        assert result.status == PaymentStatus.FAILED
        assert result.failure_reason == "Card declined again"
        assert sample_payment_entity.retry_count == 2

    async def test_retry_payment_no_provider_mock_success(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test retrying payment when provider not configured (mock mode)"""
        # Setup
        payment_service.providers = {}
        sample_payment_entity.status = PaymentStatus.FAILED
        sample_payment_entity.retry_count = 0
        sample_payment_entity.provider = "nonexistent"  # Provider that doesn't exist
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)

        # Execute
        with patch("dotmac.platform.billing.payments.service.settings") as mock_settings:
            mock_settings.billing.require_payment_plugin = False
            mock_settings.billing.payment_retry_attempts = 3
            mock_settings.billing.payment_retry_exponential_base_hours = 2
            result = await payment_service.retry_failed_payment(
                tenant_id="test-tenant",
                payment_id="payment_123",
            )

        # Verify
        assert result.status == PaymentStatus.SUCCEEDED
        assert sample_payment_entity.retry_count == 1
