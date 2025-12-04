"""
Tests for payment refund functionality.
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.billing.core.entities import PaymentEntity
from dotmac.platform.billing.core.enums import (
    PaymentMethodType,
    PaymentStatus,
)
from dotmac.platform.billing.core.exceptions import (
    PaymentError,
    PaymentNotFoundError,
)
from dotmac.platform.billing.core.models import Payment
from dotmac.platform.billing.payments.providers import RefundResult
from tests.billing.payments.conftest import (
    setup_mock_db_result,
    setup_mock_refresh,
)
from tests.fixtures.async_db import create_mock_async_result

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestPaymentRefunds:
    """Test payment refund functionality"""

    async def test_refund_payment_success(
        self, payment_service, mock_payment_db_session, mock_payment_provider, sample_payment_entity
    ):
        """Test successful payment refund"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)
        setup_mock_refresh(mock_payment_db_session)

        # Execute
        result = await payment_service.refund_payment(
            tenant_id="test-tenant",
            payment_id="payment_123",
            reason="Customer request",
        )

        # Verify
        assert isinstance(result, Payment)
        assert result.amount == -1000  # Negative amount for refund
        assert result.status == PaymentStatus.REFUNDED

        # Verify provider was called
        mock_payment_provider.refund_payment.assert_called_once_with(
            "provider_payment_123",
            1000,
            "Customer request",
        )

    async def test_partial_refund_payment(
        self, payment_service, mock_payment_db_session, mock_payment_provider, sample_payment_entity
    ):
        """Test partial payment refund"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)
        setup_mock_refresh(mock_payment_db_session)

        # Execute
        result = await payment_service.refund_payment(
            tenant_id="test-tenant",
            payment_id="payment_123",
            amount=500,  # Partial refund
            reason="Partial refund",
        )

        # Verify
        assert result.amount == -500
        assert result.status == PaymentStatus.REFUNDED

        # Verify original payment status updated
        assert sample_payment_entity.status == PaymentStatus.PARTIALLY_REFUNDED

    async def test_refund_payment_not_found(self, payment_service, mock_payment_db_session):
        """Test refunding non-existent payment"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=None)

        # Execute & Verify
        with pytest.raises(PaymentNotFoundError, match="Payment payment_123 not found"):
            await payment_service.refund_payment(
                tenant_id="test-tenant",
                payment_id="payment_123",
            )

    async def test_refund_failed_payment(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test refunding a failed payment"""
        # Setup
        sample_payment_entity.status = PaymentStatus.FAILED
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)

        # Execute & Verify
        with pytest.raises(
            PaymentError, match="Can only refund successful or partially refunded payments"
        ):
            await payment_service.refund_payment(
                tenant_id="test-tenant",
                payment_id="payment_123",
            )

    async def test_refund_amount_exceeds_original(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test refund amount exceeding original payment"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)

        # Execute & Verify
        with pytest.raises(
            PaymentError, match="Refund amount .* exceeds remaining refundable amount"
        ):
            await payment_service.refund_payment(
                tenant_id="test-tenant",
                payment_id="payment_123",
                amount=2000,  # Exceeds original 1000
            )

    async def test_refund_with_idempotency(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test refund with idempotency key"""
        # Setup
        now = datetime.now(UTC)
        existing_refund = MagicMock(spec=PaymentEntity)
        existing_refund.tenant_id = "test-tenant"
        existing_refund.payment_id = "refund_456"
        existing_refund.amount = -1000
        existing_refund.currency = "USD"
        existing_refund.customer_id = "customer_456"
        existing_refund.status = PaymentStatus.REFUNDED
        existing_refund.provider = "stripe"
        existing_refund.idempotency_key = "refund_idempotent_123"
        existing_refund.retry_count = 0
        existing_refund.created_at = now
        existing_refund.updated_at = now
        existing_refund.processed_at = now
        existing_refund.payment_method_type = PaymentMethodType.CARD
        existing_refund.payment_method_details = {}
        existing_refund.provider_payment_id = None
        existing_refund.provider_fee = None
        existing_refund.failure_reason = None
        existing_refund.next_retry_at = None
        existing_refund.extra_data = {}
        existing_refund.provider_payment_data = {}
        existing_refund.refund_amount = Decimal("0")
        existing_refund.refunded_at = now

        # Need to return results in order: payment entity first, then idempotency check
        mock_result_payment = create_mock_async_result([sample_payment_entity])
        mock_result_refund = create_mock_async_result([existing_refund])

        mock_payment_db_session.execute = AsyncMock(
            side_effect=[mock_result_payment, mock_result_refund]
        )

        # Execute
        result = await payment_service.refund_payment(
            tenant_id="test-tenant",
            payment_id="payment_123",
            idempotency_key="refund_idempotent_123",
        )

        # Verify - should return existing refund
        assert result.payment_id == "refund_456"
        assert result.status == PaymentStatus.REFUNDED

    async def test_refund_provider_failure(
        self, payment_service, mock_payment_db_session, mock_payment_provider, sample_payment_entity
    ):
        """Test refund when provider fails"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)
        setup_mock_refresh(mock_payment_db_session)
        mock_payment_provider.refund_payment.return_value = RefundResult(
            success=False,
            error_message="Refund failed",
            error_code="refund_error",
        )

        # Execute
        result = await payment_service.refund_payment(
            tenant_id="test-tenant",
            payment_id="payment_123",
        )

        # Verify
        assert result.status == PaymentStatus.FAILED
        assert result.failure_reason == "Refund failed"

    async def test_refund_no_provider_mock_success(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test refund when provider not configured (mock mode)"""
        # Setup
        payment_service.providers = {}
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_entity)
        setup_mock_refresh(mock_payment_db_session)

        # Execute
        with patch("dotmac.platform.billing.payments.service.logger") as mock_logger:
            with patch("dotmac.platform.billing.payments.service.settings") as mock_settings:
                mock_settings.billing.require_payment_plugin = False
                result = await payment_service.refund_payment(
                    tenant_id="test-tenant",
                    payment_id="payment_123",
                )

        # Verify
        assert result.status == PaymentStatus.REFUNDED
        # Should have at least one warning about provider not configured
        assert mock_logger.warning.call_count >= 1
        # Check that at least one call was about the provider
        warning_messages = [str(call) for call in mock_logger.warning.call_args_list]
        assert any("not configured" in msg for msg in warning_messages)
