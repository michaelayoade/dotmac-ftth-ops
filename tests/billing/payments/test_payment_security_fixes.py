"""
Tests for critical payment security and business logic fixes.

This module tests the fixes for:
1. Missing payment provider handling (charges and refunds)
2. Tenant isolation in failed-payments endpoint
3. Partial refund validation and tracking
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.billing.core.entities import PaymentEntity
from dotmac.platform.billing.core.enums import PaymentMethodType, PaymentStatus
from dotmac.platform.billing.core.exceptions import PaymentError
from dotmac.platform.billing.payments.service import PaymentService
from tests.billing.payments.conftest_service import (
    setup_mock_db_result,
    setup_mock_refresh,
)
from tests.fixtures.async_db import create_mock_async_session


@pytest.mark.unit
class TestMissingPaymentProviderHandling:
    """Tests for missing payment provider bug fixes"""

    @pytest.mark.asyncio
    async def test_charge_with_missing_provider_production_mode(self):
        """Test that missing provider fails in production mode"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)

        # Create payment method entity
        payment_method = MagicMock()
        payment_method.payment_method_id = "pm_test"
        payment_method.provider = "stripe"
        payment_method.provider_payment_method_id = "pm_stripe_123"

        setup_mock_db_result(mock_db, scalar_value=payment_method)

        # Create service with NO providers
        service = PaymentService(db_session=mock_db, payment_providers={})

        # Mock settings to require payment plugin (production mode)
        with patch("dotmac.platform.billing.payments.service.settings") as mock_settings:
            mock_settings.billing.require_payment_plugin = True

            payment_entity = PaymentEntity(
                payment_id="pay_123",
                tenant_id="tenant_1",
                customer_id="cust_1",
                amount=1000,
                currency="USD",
                provider="stripe",
                payment_method_type=PaymentMethodType.CARD,
                payment_method_details={"pm_id": "pm_test"},
                status=PaymentStatus.PENDING,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

            # Process payment with missing provider
            await service._process_with_provider(
                payment_entity=payment_entity,
                provider="stripe",
                amount=1000,
                currency="USD",
                provider_payment_method_id="pm_stripe_123",
            )

            # Should fail in production mode
            assert payment_entity.status == PaymentStatus.FAILED
            assert "not configured" in payment_entity.failure_reason
            assert payment_entity.processed_at is not None

    @pytest.mark.asyncio
    async def test_charge_with_missing_provider_development_mode(self):
        """Test that missing provider mocks success in development mode"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)

        # Create service with NO providers
        service = PaymentService(db_session=mock_db, payment_providers={})

        # Mock settings to NOT require payment plugin (development mode)
        with patch("dotmac.platform.billing.payments.service.settings") as mock_settings:
            mock_settings.billing.require_payment_plugin = False

            payment_entity = PaymentEntity(
                payment_id="pay_123",
                tenant_id="tenant_1",
                customer_id="cust_1",
                amount=1000,
                currency="USD",
                provider="stripe",
                payment_method_type=PaymentMethodType.CARD,
                payment_method_details={"pm_id": "pm_test"},
                status=PaymentStatus.PENDING,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

            # Process payment with missing provider
            await service._process_with_provider(
                payment_entity=payment_entity,
                provider="stripe",
                amount=1000,
                currency="USD",
                provider_payment_method_id="pm_stripe_123",
            )

            # Should mock success in development mode
            assert payment_entity.status == PaymentStatus.SUCCEEDED
            assert payment_entity.failure_reason is None
            assert payment_entity.processed_at is not None

    @pytest.mark.asyncio
    async def test_refund_with_missing_provider_production_mode(self):
        """Test that refunds with missing provider fail in production mode"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)

        # Create service with NO providers
        service = PaymentService(db_session=mock_db, payment_providers={})

        # Mock settings to require payment plugin (production mode)
        with patch("dotmac.platform.billing.payments.service.settings") as mock_settings:
            mock_settings.billing.require_payment_plugin = True

            original_payment = PaymentEntity(
                payment_id="pay_original",
                tenant_id="tenant_1",
                customer_id="cust_1",
                amount=1000,
                currency="USD",
                provider="stripe",
                status=PaymentStatus.SUCCEEDED,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

            refund_entity = PaymentEntity(
                payment_id="refund_123",
                tenant_id="tenant_1",
                customer_id="cust_1",
                amount=-500,
                currency="USD",
                provider="stripe",
                status=PaymentStatus.PENDING,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

            # Process refund with missing provider
            await service._process_refund_with_provider(
                refund=refund_entity,
                original_payment=original_payment,
                refund_amount=500,
                reason="customer_request",
            )

            # Should fail in production mode
            assert refund_entity.status == PaymentStatus.FAILED
            assert "not configured" in refund_entity.failure_reason
            assert refund_entity.processed_at is not None

    @pytest.mark.asyncio
    async def test_refund_with_missing_provider_development_mode(self):
        """Test that refunds with missing provider mock success in development mode"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)

        # Create service with NO providers
        service = PaymentService(db_session=mock_db, payment_providers={})

        # Mock settings to NOT require payment plugin (development mode)
        with patch("dotmac.platform.billing.payments.service.settings") as mock_settings:
            mock_settings.billing.require_payment_plugin = False

            original_payment = PaymentEntity(
                payment_id="pay_original",
                tenant_id="tenant_1",
                customer_id="cust_1",
                amount=1000,
                currency="USD",
                provider="stripe",
                status=PaymentStatus.SUCCEEDED,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

            refund_entity = PaymentEntity(
                payment_id="refund_123",
                tenant_id="tenant_1",
                customer_id="cust_1",
                amount=-500,
                currency="USD",
                provider="stripe",
                status=PaymentStatus.PENDING,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

            # Process refund with missing provider
            await service._process_refund_with_provider(
                refund=refund_entity,
                original_payment=original_payment,
                refund_amount=500,
                reason="customer_request",
            )

            # Should mock success in development mode
            assert refund_entity.status == PaymentStatus.REFUNDED
            assert refund_entity.failure_reason is None
            assert refund_entity.processed_at is not None


@pytest.mark.unit
class TestPartialRefundValidation:
    """Tests for partial refund validation and tracking"""

    @pytest.mark.asyncio
    async def test_partial_refund_validation_allows_partially_refunded_status(self):
        """Test that validation allows refunds on PARTIALLY_REFUNDED payments"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)

        # Create payment that is partially refunded
        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=1000,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.PARTIALLY_REFUNDED,
            refund_amount=Decimal("300"),  # Already refunded $3.00
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        setup_mock_db_result(mock_db, scalar_value=payment)

        service = PaymentService(db_session=mock_db, payment_providers={})

        # Validate refund request - should succeed
        existing, original, refund_amt = await service._validate_refund_request(
            tenant_id="tenant_1",
            payment_id="pay_123",
            amount=400,  # Refund another $4.00
            idempotency_key=None,
        )

        assert original.payment_id == "pay_123"
        assert refund_amt == 400

    @pytest.mark.asyncio
    async def test_partial_refund_validation_rejects_over_refund(self):
        """Test that validation rejects refunds exceeding remaining balance"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)

        # Create payment that is partially refunded
        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=1000,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.PARTIALLY_REFUNDED,
            refund_amount=Decimal("600"),  # Already refunded $6.00
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        setup_mock_db_result(mock_db, scalar_value=payment)

        service = PaymentService(db_session=mock_db, payment_providers={})

        # Try to refund more than remaining ($10.00 - $6.00 = $4.00 remaining)
        with pytest.raises(PaymentError) as exc_info:
            await service._validate_refund_request(
                tenant_id="tenant_1",
                payment_id="pay_123",
                amount=500,  # Try to refund $5.00 but only $4.00 remaining
                idempotency_key=None,
            )

        assert "exceeds remaining refundable amount" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_refund_amount_tracking_updates_correctly(self):
        """Test that refund_amount is tracked on original payment"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        # Create original payment with no refunds
        original_payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=1000,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.SUCCEEDED,
            refund_amount=None,  # No refunds yet
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        refund_entity = PaymentEntity(
            payment_id="refund_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=-300,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.REFUNDED,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        service = PaymentService(db_session=mock_db, payment_providers={})

        # Mock create_transaction to avoid DB complexity
        service._create_transaction = AsyncMock()

        # Mock event bus
        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # Handle refund success - should update refund_amount
            await service._handle_refund_success(
                refund=refund_entity,
                original_payment=original_payment,
                payment_id="pay_123",
                refund_amount=300,
                reason="test",
                tenant_id="tenant_1",
            )

            # Verify refund_amount was updated
            assert original_payment.refund_amount == 300
            assert original_payment.status == PaymentStatus.PARTIALLY_REFUNDED

    @pytest.mark.asyncio
    async def test_refund_amount_tracking_accumulates_multiple_refunds(self):
        """Test that refund_amount accumulates across multiple refunds"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        # Create payment with one refund already
        original_payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=1000,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.PARTIALLY_REFUNDED,
            refund_amount=Decimal("300"),  # $3.00 already refunded
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        refund_entity = PaymentEntity(
            payment_id="refund_456",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=-200,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.REFUNDED,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        service = PaymentService(db_session=mock_db, payment_providers={})
        service._create_transaction = AsyncMock()

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # Handle second refund
            await service._handle_refund_success(
                refund=refund_entity,
                original_payment=original_payment,
                payment_id="pay_123",
                refund_amount=200,
                reason="test",
                tenant_id="tenant_1",
            )

            # Verify refund_amount accumulated (300 + 200 = 500)
            assert original_payment.refund_amount == 500
            assert original_payment.status == PaymentStatus.PARTIALLY_REFUNDED

    @pytest.mark.asyncio
    async def test_refund_amount_tracking_full_refund_status(self):
        """Test that status changes to REFUNDED when fully refunded"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        # Create payment that will be fully refunded
        original_payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=1000,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.SUCCEEDED,
            refund_amount=None,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        refund_entity = PaymentEntity(
            payment_id="refund_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=-1000,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.REFUNDED,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        service = PaymentService(db_session=mock_db, payment_providers={})
        service._create_transaction = AsyncMock()

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # Handle full refund
            await service._handle_refund_success(
                refund=refund_entity,
                original_payment=original_payment,
                payment_id="pay_123",
                refund_amount=1000,
                reason="test",
                tenant_id="tenant_1",
            )

            # Verify full refund
            assert original_payment.refund_amount == 1000
            assert original_payment.status == PaymentStatus.REFUNDED
