"""
Core Payment Service Tests - Phase 1 Coverage Improvement

Tests critical payment service workflows:
- Payment creation (success/failure paths)
- Payment refunds (full/partial)
- Payment method management
- Payment retry logic
- Idempotency handling
- Webhook event publishing
- Tenant isolation

Target: Increase payment service coverage from 10.64% to 70%+
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import (
    InvoiceEntity,
    PaymentEntity,
    PaymentInvoiceEntity,
    PaymentMethodEntity,
)
from dotmac.platform.billing.core.enums import (
    InvoiceStatus,
    PaymentMethodStatus,
    PaymentMethodType,
    PaymentStatus,
)
from dotmac.platform.billing.core.exceptions import (
    PaymentError,
    PaymentMethodNotFoundError,
    PaymentNotFoundError,
)
from dotmac.platform.billing.payments.providers import (
    PaymentProvider,
    PaymentResult,
    RefundResult,
)
from dotmac.platform.billing.payments.service import PaymentService

pytestmark = pytest.mark.asyncio


@pytest.fixture
def tenant_id() -> str:
    """Test tenant ID."""
    return f"test-tenant-{uuid4()}"


@pytest.fixture
def customer_id() -> str:
    """Test customer ID."""
    return f"cust_{uuid4()}"


@pytest.fixture
def mock_payment_provider():
    """Mock payment provider."""
    provider = AsyncMock(spec=PaymentProvider)

    # Mock successful charge
    provider.charge_payment_method.return_value = PaymentResult(
        success=True,
        provider_payment_id="ch_test123",
        provider_fee=30,  # 30 cents
        error_message=None,
    )

    # Mock successful refund
    provider.refund_payment.return_value = RefundResult(
        success=True,
        provider_refund_id="re_test123",
        error_message=None,
    )

    return provider


@pytest_asyncio.fixture
async def payment_service(async_session: AsyncSession, mock_payment_provider):
    """Payment service with mocked provider."""
    service = PaymentService(
        db_session=async_session,
        payment_providers={"stripe": mock_payment_provider},
    )
    return service


@pytest_asyncio.fixture
async def test_payment_method(async_session: AsyncSession, tenant_id: str, customer_id: str):
    """Create a test payment method."""
    payment_method = PaymentMethodEntity(
        tenant_id=tenant_id,
        customer_id=customer_id,
        type=PaymentMethodType.CARD,
        provider="stripe",
        provider_payment_method_id="pm_test123",
        status=PaymentMethodStatus.ACTIVE,
        display_name="Test Visa Card",
        last_four="4242",
        brand="visa",
        expiry_month=12,
        expiry_year=2025,
        is_default=True,
    )
    async_session.add(payment_method)
    await async_session.flush()
    await async_session.refresh(payment_method)
    return payment_method


@pytest_asyncio.fixture
async def test_invoice(async_session: AsyncSession, tenant_id: str, customer_id: str):
    """Create a test invoice for payment linking."""
    invoice = InvoiceEntity(
        tenant_id=tenant_id,
        customer_id=customer_id,
        billing_email="test@example.com",
        billing_address={"street": "123 Test St", "city": "Test City", "country": "US"},
        issue_date=datetime.now(UTC),
        due_date=datetime.now(UTC) + timedelta(days=30),
        currency="USD",
        subtotal=10000,
        tax_amount=0,
        discount_amount=0,
        total_amount=10000,
        remaining_balance=10000,
        status=InvoiceStatus.OPEN,
        payment_status=PaymentStatus.PENDING,
    )
    async_session.add(invoice)
    await async_session.flush()
    await async_session.refresh(invoice)
    # Store the invoice_id before making transient
    # Expunge to prevent cleanup issues with detached instances
    async_session.expunge(invoice)
    return invoice


@pytest.mark.integration
class TestPaymentCreation:
    """Test payment creation workflows."""

    async def test_create_payment_success(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
        mock_payment_provider: AsyncMock,
    ):
        """Test successful payment creation."""
        payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,  # $100.00
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
            provider="stripe",
            metadata={"order_id": "order_123"},
        )

        assert payment.amount == 10000
        assert payment.currency == "USD"
        assert payment.status == PaymentStatus.SUCCEEDED
        assert payment.provider_payment_id == "ch_test123"
        assert payment.provider_fee == 30
        assert payment.tenant_id == tenant_id
        assert payment.customer_id == customer_id
        assert payment.extra_data["order_id"] == "order_123"

        # Verify provider was called correctly
        mock_payment_provider.charge_payment_method.assert_called_once()
        call_args = mock_payment_provider.charge_payment_method.call_args
        assert call_args.kwargs["amount"] == 10000
        assert call_args.kwargs["currency"] == "USD"

    async def test_create_payment_with_idempotency_key(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
    ):
        """Test idempotency key prevents duplicate payments."""
        idempotency_key = "idem_test123"

        # First payment
        payment1 = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=5000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
            idempotency_key=idempotency_key,
        )

        # Second payment with same key should return existing payment
        payment2 = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=5000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
            idempotency_key=idempotency_key,
        )

        assert payment1.payment_id == payment2.payment_id

    async def test_create_payment_payment_method_not_found(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test payment creation with non-existent payment method."""
        with pytest.raises(PaymentMethodNotFoundError):
            await payment_service.create_payment(
                tenant_id=tenant_id,
                amount=1000,
                currency="USD",
                customer_id=customer_id,
                payment_method_id=str(uuid4()),
            )

    async def test_create_payment_inactive_payment_method(
        self,
        payment_service: PaymentService,
        async_session: AsyncSession,
        tenant_id: str,
        customer_id: str,
    ):
        """Test payment creation with inactive payment method."""
        # Create inactive payment method
        inactive_pm = PaymentMethodEntity(
            tenant_id=tenant_id,
            customer_id=customer_id,
            type=PaymentMethodType.CARD,
            provider="stripe",
            provider_payment_method_id="pm_inactive",
            status=PaymentMethodStatus.INACTIVE,
            display_name="Inactive Card",
            last_four="1234",
            brand="visa",
            expiry_month=12,
            expiry_year=2025,
        )
        async_session.add(inactive_pm)
        await async_session.commit()
        await async_session.refresh(inactive_pm)

        with pytest.raises(PaymentError, match="is not active"):
            await payment_service.create_payment(
                tenant_id=tenant_id,
                amount=1000,
                currency="USD",
                customer_id=customer_id,
                payment_method_id=inactive_pm.payment_method_id,
            )

    async def test_create_payment_provider_failure(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
        mock_payment_provider: AsyncMock,
    ):
        """Test payment creation when provider fails."""
        # Mock provider failure
        mock_payment_provider.charge_payment_method.return_value = PaymentResult(
            success=False,
            provider_payment_id=None,
            provider_fee=0,
            error_message="Insufficient funds",
        )

        payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        assert payment.status == PaymentStatus.FAILED
        assert payment.failure_reason == "Insufficient funds"

    async def test_create_payment_provider_exception(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
        mock_payment_provider: AsyncMock,
    ):
        """Test payment creation when provider raises exception."""
        # Mock provider exception
        mock_payment_provider.charge_payment_method.side_effect = Exception("Network error")

        payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        assert payment.status == PaymentStatus.FAILED
        assert "Network error" in payment.failure_reason

    @patch("dotmac.platform.billing.payments.service.settings")
    async def test_create_payment_without_provider(
        self,
        mock_settings: Mock,
        async_session: AsyncSession,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
    ):
        """Test payment creation with no provider configured (mock mode)."""
        # Mock settings to allow mock mode
        mock_settings.billing.require_payment_plugin = False

        # Create service without providers
        service = PaymentService(db_session=async_session, payment_providers={})

        payment = await service.create_payment(
            tenant_id=tenant_id,
            amount=5000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
            provider="stripe",
        )

        # Should succeed in mock mode
        assert payment.status == PaymentStatus.SUCCEEDED

    @patch("dotmac.platform.billing.payments.service.get_event_bus")
    async def test_create_payment_publishes_success_event(
        self,
        mock_get_event_bus: Mock,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
        test_invoice: InvoiceEntity,
    ):
        """Test successful payment publishes webhook event."""
        mock_event_bus = AsyncMock()
        mock_get_event_bus.return_value = mock_event_bus

        payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
            invoice_ids=[test_invoice.invoice_id],
        )

        # Verify event was published
        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args
        assert call_args.kwargs["event_type"] == "payment.succeeded"
        assert call_args.kwargs["event_data"]["payment_id"] == payment.payment_id
        assert call_args.kwargs["event_data"]["amount"] == 100.0  # Converted from cents
        assert call_args.kwargs["event_data"]["invoice_ids"] == [test_invoice.invoice_id]

    @patch("dotmac.platform.billing.payments.service.get_event_bus")
    async def test_create_payment_publishes_failure_event(
        self,
        mock_get_event_bus: Mock,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
        mock_payment_provider: AsyncMock,
    ):
        """Test failed payment publishes webhook event."""
        mock_event_bus = AsyncMock()
        mock_get_event_bus.return_value = mock_event_bus

        # Mock provider failure
        mock_payment_provider.charge_payment_method.return_value = PaymentResult(
            success=False,
            provider_payment_id=None,
            provider_fee=0,
            error_message="Card declined",
        )

        await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        # Verify event was published
        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args
        assert call_args.kwargs["event_type"] == "payment.failed"
        assert call_args.kwargs["event_data"]["failure_reason"] == "Card declined"


@pytest.mark.integration
class TestPaymentRefunds:
    """Test payment refund workflows."""

    async def test_refund_payment_full(
        self,
        payment_service: PaymentService,
        async_session: AsyncSession,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
    ):
        """Test full payment refund."""
        # Create successful payment first
        original_payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        # Refund the payment
        refund = await payment_service.refund_payment(
            tenant_id=tenant_id,
            payment_id=original_payment.payment_id,
            reason="Customer request",
        )

        assert refund.amount == -10000  # Negative for refund
        assert refund.status == PaymentStatus.REFUNDED
        assert refund.extra_data["refund_reason"] == "Customer request"
        assert refund.extra_data["original_payment_id"] == original_payment.payment_id

        # Verify original payment status updated
        await async_session.refresh(
            await async_session.get(PaymentEntity, original_payment.payment_id)
        )
        updated_payment = await async_session.get(PaymentEntity, original_payment.payment_id)
        assert updated_payment.status == PaymentStatus.REFUNDED

    async def test_refund_payment_partial(
        self,
        payment_service: PaymentService,
        async_session: AsyncSession,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
    ):
        """Test partial payment refund."""
        # Create successful payment
        original_payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        # Refund half the amount
        refund = await payment_service.refund_payment(
            tenant_id=tenant_id,
            payment_id=original_payment.payment_id,
            amount=5000,
            reason="Partial refund",
        )

        assert refund.amount == -5000
        assert refund.status == PaymentStatus.REFUNDED

        # Verify original payment status
        updated_payment = await async_session.get(PaymentEntity, original_payment.payment_id)
        assert updated_payment.status == PaymentStatus.PARTIALLY_REFUNDED

    async def test_refund_payment_with_idempotency(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
    ):
        """Test refund with idempotency key creates unique refund."""
        # Create payment
        payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        idempotency_key = "refund_idem_123"

        # Refund with idempotency key
        refund = await payment_service.refund_payment(
            tenant_id=tenant_id,
            payment_id=payment.payment_id,
            amount=5000,  # Partial refund
            idempotency_key=idempotency_key,
        )

        assert refund.amount == -5000  # Partial refund
        assert refund.extra_data.get("original_payment_id") == payment.payment_id
        assert refund.idempotency_key == idempotency_key

    async def test_refund_payment_not_found(
        self,
        payment_service: PaymentService,
        tenant_id: str,
    ):
        """Test refund with non-existent payment."""
        with pytest.raises(PaymentNotFoundError):
            await payment_service.refund_payment(
                tenant_id=tenant_id,
                payment_id=str(uuid4()),
            )

    async def test_refund_payment_not_successful(
        self,
        payment_service: PaymentService,
        async_session: AsyncSession,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
        mock_payment_provider: AsyncMock,
    ):
        """Test cannot refund failed payment."""
        # Create failed payment
        mock_payment_provider.charge_payment_method.return_value = PaymentResult(
            success=False,
            provider_payment_id=None,
            provider_fee=0,
            error_message="Card declined",
        )

        payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        # Try to refund failed payment
        with pytest.raises(
            PaymentError, match="Can only refund successful or partially refunded payments"
        ):
            await payment_service.refund_payment(
                tenant_id=tenant_id,
                payment_id=payment.payment_id,
            )

    async def test_refund_payment_exceeds_amount(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
    ):
        """Test refund amount cannot exceed original payment."""
        payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        with pytest.raises(
            PaymentError, match="Refund amount .* exceeds remaining refundable amount"
        ):
            await payment_service.refund_payment(
                tenant_id=tenant_id,
                payment_id=payment.payment_id,
                amount=15000,  # More than original
            )

    @patch("dotmac.platform.billing.payments.service.get_event_bus")
    async def test_refund_payment_publishes_event(
        self,
        mock_get_event_bus: Mock,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
    ):
        """Test successful refund publishes webhook event."""
        mock_event_bus = AsyncMock()
        mock_get_event_bus.return_value = mock_event_bus

        # Create payment
        payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        # Reset mock to clear payment creation event
        mock_event_bus.reset_mock()

        # Refund payment
        refund = await payment_service.refund_payment(
            tenant_id=tenant_id,
            payment_id=payment.payment_id,
            amount=5000,
            reason="Customer request",
        )

        # Verify event was published
        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args
        assert call_args.kwargs["event_type"] == "payment.refunded"
        assert call_args.kwargs["event_data"]["refund_id"] == refund.payment_id
        assert call_args.kwargs["event_data"]["amount"] == 50.0  # Converted from cents
        assert call_args.kwargs["event_data"]["refund_type"] == "partial"


@pytest.mark.integration
class TestPaymentMethodManagement:
    """Test payment method management."""

    async def test_add_payment_method(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test adding a payment method."""
        pm = await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_new123",
            payment_method_type=PaymentMethodType.CARD,
            display_name="New Visa Card",
            last_four="4242",
            brand="visa",
            expiry_month=12,
            expiry_year=2026,
            set_as_default=True,
        )

        assert pm.customer_id == customer_id
        assert pm.provider_payment_method_id == "pm_new123"
        assert pm.last_four == "4242"
        assert pm.is_default is True
        assert pm.status == PaymentMethodStatus.ACTIVE

    async def test_add_payment_method_sets_as_default(
        self,
        payment_service: PaymentService,
        async_session: AsyncSession,
        tenant_id: str,
        customer_id: str,
    ):
        """Test adding payment method as default clears other defaults."""
        # Add first payment method as default
        pm1 = await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_1",
            payment_method_type=PaymentMethodType.CARD,
            display_name="Test Card 1111",
            last_four="1111",
            set_as_default=True,
        )

        # Add second payment method as default
        pm2 = await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_2",
            payment_method_type=PaymentMethodType.CARD,
            display_name="Test Card 2222",
            last_four="2222",
            set_as_default=True,
        )

        # Verify first is no longer default
        await async_session.refresh(
            await async_session.get(PaymentMethodEntity, pm1.payment_method_id)
        )
        pm1_refreshed = await async_session.get(PaymentMethodEntity, pm1.payment_method_id)
        assert pm1_refreshed.is_default is False
        assert pm2.is_default is True

    async def test_get_payment_method(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        test_payment_method: PaymentMethodEntity,
    ):
        """Test getting a payment method."""
        pm = await payment_service.get_payment_method(
            tenant_id=tenant_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        assert pm.payment_method_id == test_payment_method.payment_method_id
        assert pm.last_four == test_payment_method.last_four

    async def test_get_payment_method_not_found(
        self,
        payment_service: PaymentService,
        tenant_id: str,
    ):
        """Test getting non-existent payment method."""
        pm = await payment_service.get_payment_method(
            tenant_id=tenant_id,
            payment_method_id=str(uuid4()),
        )
        assert pm is None

    async def test_list_payment_methods(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test listing payment methods for a customer."""
        # Add multiple payment methods
        await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_1",
            payment_method_type=PaymentMethodType.CARD,
            display_name="Test Card 1111",
            last_four="1111",
        )
        await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_2",
            payment_method_type=PaymentMethodType.CARD,
            display_name="Test Card 2222",
            last_four="2222",
        )

        methods = await payment_service.list_payment_methods(
            tenant_id=tenant_id,
            customer_id=customer_id,
        )

        assert len(methods) == 2
        assert all(m.customer_id == customer_id for m in methods)

    async def test_list_payment_methods_all_types(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test listing payment methods of different types."""
        # Add card
        await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_card",
            payment_method_type=PaymentMethodType.CARD,
            display_name="Test Card 1111",
            last_four="1111",
        )
        # Add bank account
        await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_bank",
            payment_method_type=PaymentMethodType.BANK_ACCOUNT,
            display_name="Test Bank Account",
            last_four="9999",
        )

        # List all payment methods
        all_methods = await payment_service.list_payment_methods(
            tenant_id=tenant_id,
            customer_id=customer_id,
        )

        assert len(all_methods) == 2
        types = {m.type for m in all_methods}
        assert PaymentMethodType.CARD in types
        assert PaymentMethodType.BANK_ACCOUNT in types

    async def test_set_default_payment_method(
        self,
        payment_service: PaymentService,
        async_session: AsyncSession,
        tenant_id: str,
        customer_id: str,
    ):
        """Test setting a payment method as default."""
        # Add two payment methods
        pm1 = await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_1",
            payment_method_type=PaymentMethodType.CARD,
            display_name="Test Card 1111",
            last_four="1111",
            set_as_default=True,
        )
        pm2 = await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_2",
            payment_method_type=PaymentMethodType.CARD,
            display_name="Test Card 2222",
            last_four="2222",
            set_as_default=False,
        )

        # Set pm2 as default
        updated_pm2 = await payment_service.set_default_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            payment_method_id=pm2.payment_method_id,
        )

        assert updated_pm2.is_default is True

        # Verify pm1 is no longer default
        pm1_refreshed = await async_session.get(PaymentMethodEntity, pm1.payment_method_id)
        assert pm1_refreshed.is_default is False

    async def test_delete_payment_method(
        self,
        payment_service: PaymentService,
        async_session: AsyncSession,
        tenant_id: str,
        customer_id: str,
    ):
        """Test deleting a payment method."""
        pm = await payment_service.add_payment_method(
            tenant_id=tenant_id,
            customer_id=customer_id,
            provider="stripe",
            provider_payment_method_id="pm_delete",
            payment_method_type=PaymentMethodType.CARD,
            display_name="Test Card 1111",
            last_four="1111",
        )

        success = await payment_service.delete_payment_method(
            tenant_id=tenant_id,
            payment_method_id=pm.payment_method_id,
        )

        assert success is True

        # Verify soft delete
        deleted_pm = await async_session.get(PaymentMethodEntity, pm.payment_method_id)
        assert deleted_pm.status == PaymentMethodStatus.INACTIVE


@pytest.mark.integration
class TestPaymentRetry:
    """Test payment retry logic."""

    async def test_retry_failed_payment_success(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
        mock_payment_provider: AsyncMock,
    ):
        """Test successfully retrying a failed payment."""
        # Create failed payment
        mock_payment_provider.charge_payment_method.return_value = PaymentResult(
            success=False,
            provider_payment_id=None,
            provider_fee=0,
            error_message="Card declined",
        )

        failed_payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        # Mock provider success for retry
        mock_payment_provider.charge_payment_method.return_value = PaymentResult(
            success=True,
            provider_payment_id="ch_retry123",
            provider_fee=30,
            error_message=None,
        )

        # Retry the payment
        retried_payment = await payment_service.retry_failed_payment(
            tenant_id=tenant_id,
            payment_id=failed_payment.payment_id,
        )

        assert retried_payment.status == PaymentStatus.SUCCEEDED
        assert retried_payment.provider_payment_id == "ch_retry123"

    async def test_retry_payment_not_found(
        self,
        payment_service: PaymentService,
        tenant_id: str,
    ):
        """Test retry with non-existent payment."""
        with pytest.raises(PaymentNotFoundError):
            await payment_service.retry_failed_payment(
                tenant_id=tenant_id,
                payment_id=str(uuid4()),
            )

    async def test_retry_successful_payment(
        self,
        payment_service: PaymentService,
        tenant_id: str,
        customer_id: str,
        test_payment_method: PaymentMethodEntity,
    ):
        """Test cannot retry successful payment."""
        # Create successful payment
        payment = await payment_service.create_payment(
            tenant_id=tenant_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            payment_method_id=test_payment_method.payment_method_id,
        )

        # Try to retry successful payment
        with pytest.raises(PaymentError, match="Can only retry failed payments"):
            await payment_service.retry_failed_payment(
                tenant_id=tenant_id,
                payment_id=payment.payment_id,
            )


@pytest.mark.integration
class TestTenantIsolation:
    """Test tenant isolation in payment service."""

    async def test_payment_method_tenant_isolation(
        self,
        payment_service: PaymentService,
        async_session: AsyncSession,
        customer_id: str,
    ):
        """Test payment methods are isolated by tenant."""
        tenant1_id = "tenant-1"
        tenant2_id = "tenant-2"

        # Add payment method for tenant 1
        pm1 = PaymentMethodEntity(
            tenant_id=tenant1_id,
            customer_id=customer_id,
            type=PaymentMethodType.CARD,
            provider="stripe",
            provider_payment_method_id="pm_t1",
            status=PaymentMethodStatus.ACTIVE,
            display_name="Tenant 1 Card",
            last_four="1111",
        )
        async_session.add(pm1)
        await async_session.commit()
        await async_session.refresh(pm1)

        # Try to get tenant 1's payment method using tenant 2 context
        pm = await payment_service.get_payment_method(
            tenant_id=tenant2_id,
            payment_method_id=pm1.payment_method_id,
        )

        # Should not find it (tenant isolation)
        assert pm is None

    async def test_payment_tenant_isolation(
        self,
        payment_service: PaymentService,
        async_session: AsyncSession,
        customer_id: str,
    ):
        """Test payments are isolated by tenant."""
        tenant1_id = "tenant-1"
        tenant2_id = "tenant-2"

        # Create payment for tenant 1
        payment1 = PaymentEntity(
            tenant_id=tenant1_id,
            amount=10000,
            currency="USD",
            customer_id=customer_id,
            status=PaymentStatus.SUCCEEDED,
            provider="stripe",
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={"last_four": "1111"},
        )
        async_session.add(payment1)
        await async_session.commit()
        await async_session.refresh(payment1)

        # Try to refund using tenant 2 context
        with pytest.raises(PaymentNotFoundError):
            await payment_service.refund_payment(
                tenant_id=tenant2_id,
                payment_id=payment1.payment_id,
            )


@pytest.mark.integration
class TestInvoiceLinking:
    """Tests for payment-to-invoice allocation."""

    async def test_link_payment_to_invoices_distributes_remainder(
        self,
        payment_service: PaymentService,
        async_session: AsyncSession,
        tenant_id: str,
        customer_id: str,
    ):
        """Ensure invoice linking allocates any leftover minor units."""
        # Create 3 test invoices
        invoices = []
        for _ in range(3):
            invoice = InvoiceEntity(
                tenant_id=tenant_id,
                customer_id=customer_id,
                billing_email="test@example.com",
                billing_address={"street": "123 Test St", "city": "Test City", "country": "US"},
                issue_date=datetime.now(UTC),
                due_date=datetime.now(UTC) + timedelta(days=30),
                currency="USD",
                subtotal=5000,
                tax_amount=0,
                discount_amount=0,
                total_amount=5000,
                remaining_balance=5000,
                status=InvoiceStatus.OPEN,
                payment_status=PaymentStatus.PENDING,
            )
            async_session.add(invoice)
            invoices.append(invoice)
        await async_session.flush()
        for invoice in invoices:
            await async_session.refresh(invoice)

        payment = PaymentEntity(
            tenant_id=tenant_id,
            amount=100,  # Not divisible by 3
            currency="USD",
            customer_id=customer_id,
            status=PaymentStatus.SUCCEEDED,
            provider="stripe",
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={"payment_method_id": "pm_test"},
            provider_payment_data={},
        )
        async_session.add(payment)
        await async_session.flush()
        await async_session.refresh(payment)

        invoice_ids = [invoice.invoice_id for invoice in invoices]
        await payment_service._link_payment_to_invoices(payment, invoice_ids)

        result = await async_session.execute(
            select(PaymentInvoiceEntity).where(
                PaymentInvoiceEntity.payment_id == payment.payment_id
            )
        )
        links = result.scalars().all()
        applied_amounts = [link.amount_applied for link in links]

        assert len(applied_amounts) == len(invoice_ids)
        assert sum(applied_amounts) == payment.amount
        assert sorted(applied_amounts) == [33, 33, 34]
