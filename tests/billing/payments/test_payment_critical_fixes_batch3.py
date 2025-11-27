"""
Tests for critical payment security and business logic fixes (batch 3).

This module tests the fixes for:
1. retry_failed_payment missing success/failure handler calls
2. refund_payment default amount using original instead of remaining
3. retry path silently succeeding with missing provider
4. bank_accounts router using sync Session instead of async
5. bank_accounts router having duplicate /billing prefix
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.billing.core.entities import PaymentEntity, PaymentMethodEntity
from dotmac.platform.billing.core.enums import (
    PaymentMethodStatus,
    PaymentMethodType,
    PaymentStatus,
)
from dotmac.platform.billing.payments.service import PaymentService
from tests.billing.payments.conftest_service import (
    setup_mock_db_result,
    setup_mock_refresh,
)
from tests.fixtures.async_db import create_mock_async_session


@pytest.mark.unit
class TestRetryFailedPaymentHandlers:
    """Tests for retry_failed_payment calling success/failure handlers"""

    @pytest.mark.asyncio
    async def test_retry_success_calls_handle_payment_success(self):
        """Test that successful retry calls _handle_payment_success"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        # Create payment with retry data
        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=1000,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.FAILED,
            retry_count=0,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={
                "payment_method_id": "pm_123",
                "brand": "Visa",
                "last_four": "4242",
            },
            extra_data={"invoice_ids": ["inv_1"]},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        # Payment method for retry
        payment_method = PaymentMethodEntity(
            payment_method_id="pm_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
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

        # Setup mocks
        setup_mock_db_result(mock_db, scalar_value=payment)

        # Mock payment method lookup
        async def mock_get_payment_method(tenant_id, pm_id):
            return payment_method

        # Mock provider
        mock_provider = MagicMock()
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.provider_payment_id = "pi_retry_123"
        mock_result.provider_fee = 30
        mock_result.error_message = None
        mock_provider.charge_payment_method = AsyncMock(return_value=mock_result)

        service = PaymentService(db_session=mock_db, payment_providers={"stripe": mock_provider})
        service._get_payment_method = mock_get_payment_method

        # Mock the handlers
        service._handle_payment_success = AsyncMock()
        service._handle_payment_failure = AsyncMock()

        # Retry the payment
        await service.retry_failed_payment(tenant_id="tenant_1", payment_id="pay_123")

        # Verify _handle_payment_success was called
        assert service._handle_payment_success.called
        assert service._handle_payment_failure.call_count == 0

        # Verify the payment entity was passed to the handler
        call_args = service._handle_payment_success.call_args
        # The handler is called with the payment entity as the first argument
        assert call_args[0][0].payment_id == "pay_123"

    @pytest.mark.asyncio
    async def test_retry_failure_calls_handle_payment_failure(self):
        """Test that failed retry calls _handle_payment_failure"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        # Create payment
        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=1000,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.FAILED,
            retry_count=0,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={
                "payment_method_id": "pm_123",
                "brand": "Visa",
                "last_four": "4242",
            },
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        payment_method = PaymentMethodEntity(
            payment_method_id="pm_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
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

        setup_mock_db_result(mock_db, scalar_value=payment)

        async def mock_get_payment_method(tenant_id, pm_id):
            return payment_method

        # Mock provider with failure
        mock_provider = MagicMock()
        mock_result = MagicMock()
        mock_result.success = False
        mock_result.error_message = "Card declined"
        mock_result.error_code = "card_declined"
        mock_provider.charge_payment_method = AsyncMock(return_value=mock_result)

        service = PaymentService(db_session=mock_db, payment_providers={"stripe": mock_provider})
        service._get_payment_method = mock_get_payment_method
        service._handle_payment_success = AsyncMock()
        service._handle_payment_failure = AsyncMock()

        # Retry the payment
        await service.retry_failed_payment(tenant_id="tenant_1", payment_id="pay_123")

        # Verify _handle_payment_failure was called
        assert service._handle_payment_failure.called
        assert service._handle_payment_success.call_count == 0


@pytest.mark.unit
class TestRetryMissingProviderHandling:
    """Tests for retry path respecting require_payment_plugin setting"""

    @pytest.mark.asyncio
    async def test_retry_with_missing_provider_fails_in_production(self):
        """Test that retry with missing provider fails when require_payment_plugin=True"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=1000,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.FAILED,
            retry_count=0,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={"payment_method_id": "pm_123"},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        setup_mock_db_result(mock_db, scalar_value=payment)

        # NO providers configured
        service = PaymentService(db_session=mock_db, payment_providers={})
        service._handle_payment_failure = AsyncMock()

        # Mock settings to require payment plugin (production mode)
        with patch("dotmac.platform.billing.payments.service.settings") as mock_settings:
            mock_settings.billing.require_payment_plugin = True
            mock_settings.billing.payment_retry_attempts = 3
            mock_settings.billing.payment_retry_exponential_base_hours = 1

            await service.retry_failed_payment(tenant_id="tenant_1", payment_id="pay_123")

            # Should FAIL in production mode
            assert payment.status == PaymentStatus.FAILED
            assert "not configured" in payment.failure_reason
            assert service._handle_payment_failure.called

    @pytest.mark.asyncio
    async def test_retry_with_missing_provider_succeeds_in_development(self):
        """Test that retry with missing provider mocks success when require_payment_plugin=False"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=1000,
            currency="USD",
            provider="stripe",
            status=PaymentStatus.FAILED,
            retry_count=0,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={"payment_method_id": "pm_123"},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        setup_mock_db_result(mock_db, scalar_value=payment)

        # NO providers configured
        service = PaymentService(db_session=mock_db, payment_providers={})
        service._handle_payment_success = AsyncMock()

        # Mock settings to NOT require payment plugin (development mode)
        with patch("dotmac.platform.billing.payments.service.settings") as mock_settings:
            mock_settings.billing.require_payment_plugin = False
            mock_settings.billing.payment_retry_attempts = 3
            mock_settings.billing.payment_retry_exponential_base_hours = 1

            await service.retry_failed_payment(tenant_id="tenant_1", payment_id="pay_123")

            # Should mock success in development mode
            assert payment.status == PaymentStatus.SUCCEEDED
            assert service._handle_payment_success.called


@pytest.mark.unit
class TestRefundDefaultAmount:
    """Tests for refund_payment default amount using remaining balance"""

    @pytest.mark.asyncio
    async def test_refund_without_amount_uses_remaining_balance(self):
        """Test that omitting amount refunds the remaining balance, not original amount"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        # Payment with partial refund already applied
        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=10000,  # $100.00
            currency="USD",
            provider="stripe",
            status=PaymentStatus.PARTIALLY_REFUNDED,
            refund_amount=3000,  # $30.00 already refunded
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={"brand": "Visa"},
            provider_payment_id="pi_123",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        setup_mock_db_result(mock_db, scalar_value=payment)
        mock_db.add = MagicMock()

        # Mock provider
        mock_provider = MagicMock()
        mock_refund_result = MagicMock()
        mock_refund_result.success = True
        mock_refund_result.provider_refund_id = "re_123"
        mock_provider.refund_payment = AsyncMock(return_value=mock_refund_result)

        service = PaymentService(db_session=mock_db, payment_providers={"stripe": mock_provider})

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # Refund WITHOUT specifying amount - should default to remaining $70.00
            await service.refund_payment(
                tenant_id="tenant_1",
                payment_id="pay_123",
                # amount not specified
            )

            # Verify provider was called with remaining balance (7000 cents = $70.00)
            provider_call = mock_provider.refund_payment.call_args
            # Check positional arg at index 1 (provider_payment_id, amount, reason)
            assert provider_call[0][1] == 7000  # Should be remaining $70, not original $100

    @pytest.mark.asyncio
    async def test_refund_without_amount_on_unrefunded_payment(self):
        """Test that omitting amount on unrefunded payment refunds the full amount"""
        mock_db = create_mock_async_session()
        setup_mock_refresh(mock_db)
        mock_db.commit = AsyncMock()

        # Payment with NO refunds
        payment = PaymentEntity(
            payment_id="pay_123",
            tenant_id="tenant_1",
            customer_id="cust_1",
            amount=5000,  # $50.00
            currency="USD",
            provider="stripe",
            status=PaymentStatus.SUCCEEDED,
            refund_amount=None,  # No refunds yet
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={"brand": "Visa"},
            provider_payment_id="pi_123",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        setup_mock_db_result(mock_db, scalar_value=payment)
        mock_db.add = MagicMock()

        mock_provider = MagicMock()
        mock_refund_result = MagicMock()
        mock_refund_result.success = True
        mock_refund_result.provider_refund_id = "re_123"
        mock_provider.refund_payment = AsyncMock(return_value=mock_refund_result)

        service = PaymentService(db_session=mock_db, payment_providers={"stripe": mock_provider})

        with patch("dotmac.platform.billing.payments.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock()

            # Refund WITHOUT specifying amount - should default to full $50.00
            await service.refund_payment(
                tenant_id="tenant_1",
                payment_id="pay_123",
            )

            # Verify provider was called with full amount (5000 cents = $50.00)
            provider_call = mock_provider.refund_payment.call_args
            # Check positional arg at index 1 (provider_payment_id, amount, reason)
            assert provider_call[0][1] == 5000


@pytest.mark.unit
class TestBankAccountsRouter:
    """Tests for bank_accounts router fixes"""

    def test_bank_accounts_router_has_correct_prefix(self):
        """Test that bank_accounts router has empty prefix - parent billing router adds path"""
        from dotmac.platform.billing.bank_accounts.router import router

        # Router has empty prefix - the parent billing router includes it at the correct path
        # This avoids duplicate /billing/bank-accounts when included under /billing
        assert router.prefix == ""
        assert router.prefix != "/billing/bank-accounts"

    def test_bank_accounts_router_uses_async_session_dependency(self):
        """Test that bank_accounts router imports get_session_dependency, not get_db"""
        from dotmac.platform.billing.bank_accounts import router as router_module

        # Verify it imports get_session_dependency (async) not get_db (sync)
        assert hasattr(router_module, "get_session_dependency")
        assert not hasattr(router_module, "get_db")

    @pytest.mark.asyncio
    async def test_bank_accounts_endpoint_can_accept_async_session(self):
        """Test that bank account endpoints can work with AsyncSession"""
        import inspect

        from sqlalchemy.ext.asyncio import AsyncSession

        from dotmac.platform.billing.bank_accounts.router import create_bank_account

        # Verify the endpoint signature accepts AsyncSession
        sig = inspect.signature(create_bank_account)
        db_param = sig.parameters["db"]

        # The annotation should be AsyncSession
        assert db_param.annotation == AsyncSession

        # Verify it's an async function
        assert inspect.iscoroutinefunction(create_bank_account)
