"""
Tests for payment creation functionality.
"""

import pytest
from unittest.mock import patch

from tests.billing.payments.conftest import (
    setup_mock_db_result,
    setup_mock_refresh,
)
from tests.fixtures.async_db import create_mock_async_result

from dotmac.platform.billing.core.entities import PaymentInvoiceEntity
from dotmac.platform.billing.core.enums import (
    PaymentMethodStatus,
    PaymentStatus,
)
from dotmac.platform.billing.core.exceptions import (
    PaymentError,
    PaymentMethodNotFoundError,
)
from dotmac.platform.billing.core.models import Payment
from dotmac.platform.billing.payments.providers import PaymentResult

pytestmark = pytest.mark.asyncio


class TestPaymentCreation:
    """Test payment creation functionality"""

    async def test_create_payment_success(
        self,
        payment_service,
        mock_payment_db_session,
        mock_payment_provider,
        sample_payment_method_entity,
    ):
        """Test successful payment creation"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)
        setup_mock_refresh(mock_payment_db_session)

        # Execute
        result = await payment_service.create_payment(
            tenant_id="test-tenant",
            amount=1000,
            currency="USD",
            customer_id="customer_456",
            payment_method_id="pm_789",
            provider="stripe",
            metadata={"order_id": "order_123"},
        )

        # Verify
        assert isinstance(result, Payment)
        assert result.amount == 1000
        assert result.currency == "USD"
        assert result.customer_id == "customer_456"
        assert result.status == PaymentStatus.SUCCEEDED

        # Verify provider was called
        mock_payment_provider.charge_payment_method.assert_called_once()

        # Verify database operations
        mock_payment_db_session.add.assert_called()
        assert mock_payment_db_session.commit.await_count >= 2  # Initial save + update

    async def test_create_payment_with_idempotency(
        self,
        payment_service,
        mock_payment_db_session,
        sample_payment_entity,
        sample_payment_method_entity,
    ):
        """Test payment creation with idempotency key"""
        # Setup - simulate existing payment with same idempotency key
        existing_payment = sample_payment_entity
        existing_payment.idempotency_key = "idempotent_123"

        # Use create_mock_async_result for proper async/sync boundaries
        async def mock_execute_side_effect(query):
            # First call returns existing payment (idempotency check)
            if "idempotency_key" in str(query):
                return create_mock_async_result([existing_payment])
            # Second call returns payment method
            else:
                return create_mock_async_result([sample_payment_method_entity])

        mock_payment_db_session.execute.side_effect = mock_execute_side_effect

        # Execute
        result = await payment_service.create_payment(
            tenant_id="test-tenant",
            amount=1000,
            currency="USD",
            customer_id="customer_456",
            payment_method_id="pm_789",
            idempotency_key="idempotent_123",
        )

        # Verify - should return existing payment without creating new one
        assert result.payment_id == "payment_123"
        assert result.status == PaymentStatus.SUCCEEDED
        mock_payment_db_session.add.assert_not_called()

    async def test_create_payment_method_not_found(self, payment_service, mock_payment_db_session):
        """Test payment creation when payment method not found"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=None)

        # Execute & Verify
        with pytest.raises(PaymentMethodNotFoundError, match="Payment method pm_789 not found"):
            await payment_service.create_payment(
                tenant_id="test-tenant",
                amount=1000,
                currency="USD",
                customer_id="customer_456",
                payment_method_id="pm_789",
            )

    async def test_create_payment_inactive_method(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test payment creation with inactive payment method"""
        # Setup
        sample_payment_method_entity.status = PaymentMethodStatus.INACTIVE
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)

        # Execute & Verify
        with pytest.raises(PaymentError, match="Payment method pm_789 is not active"):
            await payment_service.create_payment(
                tenant_id="test-tenant",
                amount=1000,
                currency="USD",
                customer_id="customer_456",
                payment_method_id="pm_789",
            )

    async def test_create_payment_provider_failure(
        self,
        payment_service,
        mock_payment_db_session,
        mock_payment_provider,
        sample_payment_method_entity,
    ):
        """Test payment creation when provider fails"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)
        setup_mock_refresh(mock_payment_db_session)
        mock_payment_provider.charge_payment_method.return_value = PaymentResult(
            success=False,
            error_message="Card declined",
            error_code="card_declined",
        )

        # Execute
        result = await payment_service.create_payment(
            tenant_id="test-tenant",
            amount=1000,
            currency="USD",
            customer_id="customer_456",
            payment_method_id="pm_789",
            provider="stripe",
        )

        # Verify
        assert result.status == PaymentStatus.FAILED
        assert result.failure_reason == "Card declined"
        mock_payment_db_session.commit.assert_called()

    async def test_create_payment_with_invoice_linking(
        self,
        payment_service,
        mock_payment_db_session,
        mock_payment_provider,
        sample_payment_method_entity,
    ):
        """Test payment creation with invoice linking"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)
        setup_mock_refresh(mock_payment_db_session)
        invoice_ids = ["invoice_001", "invoice_002"]

        # Execute
        result = await payment_service.create_payment(
            tenant_id="test-tenant",
            amount=2000,
            currency="USD",
            customer_id="customer_456",
            payment_method_id="pm_789",
            provider="stripe",
            invoice_ids=invoice_ids,
        )

        # Verify
        assert result.status == PaymentStatus.SUCCEEDED

        # Verify invoice linking was attempted
        # Check that PaymentInvoiceEntity was created for each invoice
        add_calls = mock_payment_db_session.add.call_args_list
        invoice_links = [
            call[0][0] for call in add_calls if isinstance(call[0][0], PaymentInvoiceEntity)
        ]
        assert len(invoice_links) == 2

    async def test_create_payment_no_provider_mock_success(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test payment creation when provider not configured (mock mode)"""
        # Setup
        payment_service.providers = {}  # No providers configured
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)
        setup_mock_refresh(mock_payment_db_session)

        # Execute
        with patch("dotmac.platform.billing.payments.service.logger") as mock_logger:
            result = await payment_service.create_payment(
                tenant_id="test-tenant",
                amount=1000,
                currency="USD",
                customer_id="customer_456",
                payment_method_id="pm_789",
                provider="nonexistent",
            )

        # Verify
        assert result.status == PaymentStatus.SUCCEEDED
        mock_logger.warning.assert_called_once()

    async def test_create_payment_provider_exception(
        self,
        payment_service,
        mock_payment_db_session,
        mock_payment_provider,
        sample_payment_method_entity,
    ):
        """Test payment creation when provider raises exception"""
        # Setup
        setup_mock_db_result(mock_payment_db_session, scalar_value=sample_payment_method_entity)
        setup_mock_refresh(mock_payment_db_session)
        mock_payment_provider.charge_payment_method.side_effect = Exception("Network error")

        # Execute
        with patch("dotmac.platform.billing.payments.service.logger") as mock_logger:
            result = await payment_service.create_payment(
                tenant_id="test-tenant",
                amount=1000,
                currency="USD",
                customer_id="customer_456",
                payment_method_id="pm_789",
                provider="stripe",
            )

        # Verify
        assert result.status == PaymentStatus.FAILED
        assert result.failure_reason == "Network error"
        mock_logger.error.assert_called_once()
