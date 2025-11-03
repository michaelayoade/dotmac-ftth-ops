"""
Tests for critical payment security and business logic fixes (batch 2).

This module tests the fixes for:
1. Missing customer_id validation in create_payment
2. Unit mismatch in refund notification processing
3. Incorrect transaction logging for webhook refunds
4. Fractional currency truncation in offline payments
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.billing.core.entities import PaymentEntity, PaymentMethodEntity
from dotmac.platform.billing.core.enums import (
    PaymentMethodStatus,
    PaymentMethodType,
    PaymentStatus,
)
from dotmac.platform.billing.core.exceptions import PaymentError
from dotmac.platform.billing.payments.service import PaymentService
from tests.billing.payments.conftest_service import (
    setup_mock_db_result,
    setup_mock_refresh,
)
from tests.fixtures.async_db import create_mock_async_session


@pytest.mark.unit
class TestCustomerIdValidation:
    """Tests for customer_id validation in create_payment"""

    @pytest.mark.asyncio
    async def test_create_payment_validates_customer_owns_payment_method(self):
        """Test that create_payment verifies payment method belongs to customer"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)

        # Create payment method that belongs to a different customer
        payment_method = PaymentMethodEntity(
            payment_method_id="pm_123",
            tenant_id="tenant_1",
            customer_id="customer_A",  # Different customer
            provider="stripe",
            provider_payment_method_id="pm_stripe_123",
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.ACTIVE,
            is_active=True,
            brand="Visa",
            last_four="4242",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        setup_mock_db_result(mock_db, scalar_value=payment_method)

        service = PaymentService(db_session=mock_db, payment_providers={})

        # Try to charge payment method as customer_B
        with pytest.raises(PaymentError) as exc_info:
            await service.create_payment(
                tenant_id="tenant_1",
                amount=1000,
                currency="USD",
                customer_id="customer_B",  # Different customer trying to use customer_A's PM
                payment_method_id="pm_123",
                provider="stripe",
            )

        assert "does not belong to customer" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_payment_succeeds_when_customer_owns_payment_method(self):
        """Test that create_payment succeeds when customer owns the payment method"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)

        # Create payment method that belongs to the customer
        payment_method = PaymentMethodEntity(
            payment_method_id="pm_123",
            tenant_id="tenant_1",
            customer_id="customer_A",
            provider="stripe",
            provider_payment_method_id="pm_stripe_123",
            type=PaymentMethodType.CARD,
            status=PaymentMethodStatus.ACTIVE,
            is_active=True,
            brand="Visa",
            last_four="4242",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        setup_mock_db_result(mock_db, scalar_value=payment_method)
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        service = PaymentService(db_session=mock_db, payment_providers={})

        # Mock the event bus
        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # Mock settings to NOT require payment plugin
            with patch("dotmac.platform.billing.payments.service.settings") as mock_settings:
                mock_settings.billing.require_payment_plugin = False

                # Should succeed when customer matches
                payment = await service.create_payment(
                    tenant_id="tenant_1",
                    amount=1000,
                    currency="USD",
                    customer_id="customer_A",  # Same customer as payment method
                    payment_method_id="pm_123",
                    provider="stripe",
                )

                assert payment is not None
                assert payment.customer_id == "customer_A"


@pytest.mark.unit
class TestRefundUnitMismatch:
    """Tests for refund unit mismatch fix"""

    @pytest.mark.asyncio
    async def test_refund_notification_uses_minor_units(self):
        """Test that refund notification compares amounts in same units (minor)"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        # Create payment with amount in minor units (1000 cents = $10.00)
        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=1000,  # $10.00 in cents
            currency="USD",
            provider="stripe",
            status=PaymentStatus.SUCCEEDED,
            refund_amount=None,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={"brand": "Visa", "last_four": "4242"},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        setup_mock_db_result(mock_db, scalar_value=payment)
        mock_db.add = MagicMock()

        service = PaymentService(db_session=mock_db, payment_providers={})

        # Mock event bus
        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # Process refund with amount in minor units (500 cents = $5.00)
            await service.process_refund_notification(
                tenant_id="tenant_1",
                payment_id="pay_123",
                refund_amount=Decimal("500"),  # In minor units (cents)
                provider_refund_id="re_123",
                reason="customer_request",
            )

            # Verify refund was recorded correctly
            assert payment.refund_amount == 500
            assert payment.status == PaymentStatus.PARTIALLY_REFUNDED

    @pytest.mark.asyncio
    async def test_refund_notification_full_refund_in_minor_units(self):
        """Test that full refunds are detected when using minor units"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        # Create payment with amount in minor units
        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=1000,  # $10.00 in cents
            currency="USD",
            provider="stripe",
            status=PaymentStatus.SUCCEEDED,
            refund_amount=None,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={"brand": "Visa", "last_four": "4242"},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        setup_mock_db_result(mock_db, scalar_value=payment)
        mock_db.add = MagicMock()

        service = PaymentService(db_session=mock_db, payment_providers={})

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # Process full refund with amount in minor units
            await service.process_refund_notification(
                tenant_id="tenant_1",
                payment_id="pay_123",
                refund_amount=Decimal("1000"),  # Full amount in minor units
                provider_refund_id="re_123",
            )

            # Verify payment is marked as REFUNDED (not PARTIALLY_REFUNDED)
            assert payment.refund_amount == 1000
            assert payment.status == PaymentStatus.REFUNDED
            assert payment.refunded_at is not None


@pytest.mark.unit
class TestTransactionLoggingForRefunds:
    """Tests for correct transaction logging in webhook refunds"""

    @pytest.mark.asyncio
    async def test_refund_transaction_logs_refund_amount_not_payment_amount(self):
        """Test that refund transaction logs the refund amount, not the original payment amount"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        # Create payment for $100.00
        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=10000,  # $100.00 in cents
            currency="USD",
            provider="stripe",
            status=PaymentStatus.SUCCEEDED,
            refund_amount=None,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={"brand": "Visa", "last_four": "4242"},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        setup_mock_db_result(mock_db, scalar_value=payment)

        # Track what transaction is created
        created_transactions = []

        def mock_add(entity):
            created_transactions.append(entity)

        mock_db.add = MagicMock(side_effect=mock_add)

        service = PaymentService(db_session=mock_db, payment_providers={})

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # Process partial refund of $25.00
            await service.process_refund_notification(
                tenant_id="tenant_1",
                payment_id="pay_123",
                refund_amount=Decimal("2500"),  # $25.00 refund
                provider_refund_id="re_123",
            )

            # Verify transaction was created with refund amount ($25), not payment amount ($100)
            assert len(created_transactions) == 1
            transaction = created_transactions[0]
            assert transaction.amount == 2500  # Should be refund amount
            assert transaction.amount != 10000  # Should NOT be payment amount

    @pytest.mark.asyncio
    async def test_multiple_refunds_log_individual_amounts(self):
        """Test that multiple refunds each log their individual amounts"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        # Create payment for $100.00
        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=10000,  # $100.00 in cents
            currency="USD",
            provider="stripe",
            status=PaymentStatus.SUCCEEDED,
            refund_amount=None,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={"brand": "Visa", "last_four": "4242"},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        created_transactions = []

        def mock_add(entity):
            created_transactions.append(entity)

        setup_mock_db_result(mock_db, scalar_value=payment)
        mock_db.add = MagicMock(side_effect=mock_add)

        service = PaymentService(db_session=mock_db, payment_providers={})

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # First refund: $25.00
            await service.process_refund_notification(
                tenant_id="tenant_1",
                payment_id="pay_123",
                refund_amount=Decimal("2500"),
                provider_refund_id="re_1",
            )

            assert len(created_transactions) == 1
            assert created_transactions[0].amount == 2500

            # Update payment status for second refund
            payment.status = PaymentStatus.PARTIALLY_REFUNDED
            payment.refund_amount = 2500

            # Second refund: $30.00
            await service.process_refund_notification(
                tenant_id="tenant_1",
                payment_id="pay_123",
                refund_amount=Decimal("3000"),
                provider_refund_id="re_2",
            )

            assert len(created_transactions) == 2
            assert created_transactions[1].amount == 3000  # Second refund amount


@pytest.mark.unit
class TestOfflinePaymentFractionalCurrency:
    """Tests for fractional currency handling in offline payments"""

    @pytest.mark.asyncio
    async def test_offline_payment_preserves_cents(self):
        """Test that offline payments preserve fractional currency"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        created_payments = []

        def mock_add(entity):
            created_payments.append(entity)

        mock_db.add = MagicMock(side_effect=mock_add)

        service = PaymentService(db_session=mock_db, payment_providers={})

        # Mock event bus
        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # Record offline payment with fractional amount
            await service.record_offline_payment(
                tenant_id="tenant_1",
                customer_id="cust_1",
                amount=Decimal("123.45"),  # $123.45
                currency="USD",
                payment_method="cash",
                reference_number="REF123",
            )

            # Verify amount is stored as 12345 cents, not 123
            assert len(created_payments) == 1
            assert created_payments[0].amount == 12345  # 123.45 * 100
            assert created_payments[0].amount != 123  # NOT truncated

    @pytest.mark.asyncio
    async def test_offline_payment_handles_various_amounts(self):
        """Test that offline payments handle various decimal amounts correctly"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        service = PaymentService(db_session=mock_db, payment_providers={})

        test_cases = [
            (Decimal("100.00"), 10000),  # Whole dollars
            (Decimal("99.99"), 9999),  # Maximum cents
            (Decimal("0.01"), 1),  # Minimum amount
            (Decimal("1234.56"), 123456),  # Large amount with cents
            (Decimal("10.50"), 1050),  # .50 cents
        ]

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            for amount_decimal, expected_minor in test_cases:
                created_payments = []

                def mock_add(entity, payments=created_payments):
                    payments.append(entity)

                mock_db.add = MagicMock(side_effect=mock_add)

                await service.record_offline_payment(
                    tenant_id="tenant_1",
                    customer_id="cust_1",
                    amount=amount_decimal,
                    currency="USD",
                    payment_method="cash",
                    reference_number="REF123",
                )

                assert len(created_payments) == 1
                assert created_payments[0].amount == expected_minor, (
                    f"For {amount_decimal}, expected {expected_minor}, got {created_payments[0].amount}"
                )

    @pytest.mark.asyncio
    async def test_offline_payment_with_float_input(self):
        """Test that offline payments handle float inputs correctly"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        created_payments = []

        def mock_add(entity):
            created_payments.append(entity)

        mock_db.add = MagicMock(side_effect=mock_add)

        service = PaymentService(db_session=mock_db, payment_providers={})

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # Record offline payment with float amount (not recommended but should work)
            await service.record_offline_payment(
                tenant_id="tenant_1",
                customer_id="cust_1",
                amount=123.45,  # float instead of Decimal
                currency="USD",
                payment_method="cash",
                reference_number="REF123",
            )

            # Verify amount is converted correctly
            assert len(created_payments) == 1
            assert created_payments[0].amount == 12345  # Should convert float properly
