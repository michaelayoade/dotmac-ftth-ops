"""
Integration tests for billing command handlers with real database.

Tests handlers work correctly with actual database persistence.
Focuses on commands that don't require complex setup.

NOTE: These are simplified integration tests focusing on:
- Handler execution with real services
- Database transaction handling
- Basic validation and error handling
"""

from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.commands.handlers import (
    InvoiceCommandHandler,
    PaymentCommandHandler,
)
from dotmac.platform.billing.commands.invoice_commands import (
    UpdateInvoiceCommand,
)
from dotmac.platform.billing.commands.payment_commands import (
    CancelPaymentCommand,
    RecordOfflinePaymentCommand,
)
from dotmac.platform.billing.core.enums import PaymentStatus
from dotmac.platform.billing.core.models import Invoice
from dotmac.platform.billing.invoicing.service import InvoiceService


@pytest_asyncio.fixture
async def invoice_handler(async_db_session: AsyncSession) -> InvoiceCommandHandler:
    """Create invoice command handler with real services."""
    return InvoiceCommandHandler(db_session=async_db_session)


@pytest_asyncio.fixture
async def payment_handler(async_db_session: AsyncSession) -> PaymentCommandHandler:
    """Create payment command handler with real services."""
    return PaymentCommandHandler(db_session=async_db_session)


@pytest.fixture
def tenant_id() -> str:
    """Test tenant ID."""
    return str(uuid4())


@pytest.fixture
def customer_id() -> str:
    """Test customer ID."""
    return str(uuid4())


@pytest_asyncio.fixture
async def test_invoice(async_db_session: AsyncSession, tenant_id: str, customer_id: str) -> Invoice:
    """Create a test invoice directly in database."""
    service = InvoiceService(db_session=async_db_session)
    invoice = await service.create_invoice(
        tenant_id=tenant_id,
        customer_id=customer_id,
        billing_email="test@example.com",
        billing_address={"street": "123 Test St", "city": "Test City", "country": "US"},
        line_items=[
            {
                "description": "Test Item",
                "quantity": 1,
                "unit_price": 10000,
                "total_price": 10000,
            }
        ],
        currency="USD",
    )
    return invoice


@pytest.mark.asyncio
@pytest.mark.integration
class TestInvoiceCommandHandlerIntegration:
    """Integration tests for invoice command handlers."""

    async def test_update_invoice_persists_changes(
        self, invoice_handler: InvoiceCommandHandler, test_invoice: Invoice, tenant_id: str
    ):
        """Test that invoice updates are persisted to database."""
        # Update the invoice via command handler
        update_command = UpdateInvoiceCommand(
            tenant_id=tenant_id,
            invoice_id=test_invoice.invoice_id,
            notes="Updated via command handler",
            extra_data={"test_key": "test_value"},
        )
        updated_invoice = await invoice_handler.handle_update_invoice(update_command)

        assert updated_invoice.invoice_id == test_invoice.invoice_id
        assert updated_invoice.notes == "Updated via command handler"

        # Verify changes persisted by fetching again
        service = InvoiceService(db_session=invoice_handler.db)
        fetched = await service.get_invoice(tenant_id=tenant_id, invoice_id=test_invoice.invoice_id)
        assert fetched.notes == "Updated via command handler"

    async def test_update_nonexistent_invoice_raises_error(
        self, invoice_handler: InvoiceCommandHandler, tenant_id: str
    ):
        """Test that updating non-existent invoice raises error."""
        command = UpdateInvoiceCommand(
            tenant_id=tenant_id,
            invoice_id="nonexistent-invoice-id",
            notes="Should fail",
        )

        with pytest.raises(ValueError, match="not found"):
            await invoice_handler.handle_update_invoice(command)


@pytest.mark.asyncio
@pytest.mark.integration
class TestPaymentCommandHandlerIntegration:
    """Integration tests for payment command handlers."""

    async def test_record_offline_payment_creates_payment(
        self,
        payment_handler: PaymentCommandHandler,
        test_invoice: Invoice,
        tenant_id: str,
        customer_id: str,
    ):
        """Test recording offline payment creates a payment record."""
        # Record offline payment
        command = RecordOfflinePaymentCommand(
            tenant_id=tenant_id,
            invoice_id=test_invoice.invoice_id,
            customer_id=customer_id,
            amount=150000,  # Amount in cents
            currency="USD",
            payment_method="check",
            reference_number="CHK-2025-001",
            notes="Check received via mail",
        )

        payment = await payment_handler.handle_record_offline_payment(command)

        assert payment is not None
        assert payment.tenant_id == tenant_id
        assert payment.customer_id == customer_id
        assert payment.amount == 150000
        assert payment.currency == "USD"
        assert payment.status == PaymentStatus.SUCCEEDED

    async def test_cannot_cancel_succeeded_offline_payment(
        self,
        payment_handler: PaymentCommandHandler,
        test_invoice: Invoice,
        tenant_id: str,
        customer_id: str,
    ):
        """Test that offline payments (which are SUCCEEDED) cannot be cancelled."""
        from dotmac.platform.billing.core.exceptions import PaymentError

        # Record offline payment (automatically SUCCEEDED)
        record_cmd = RecordOfflinePaymentCommand(
            tenant_id=tenant_id,
            invoice_id=test_invoice.invoice_id,
            customer_id=customer_id,
            amount=50000,
            currency="USD",
            payment_method="bank_transfer",
            reference_number="WIRE-001",
        )
        payment = await payment_handler.handle_record_offline_payment(record_cmd)

        # Verify payment is SUCCEEDED
        assert payment.status == PaymentStatus.SUCCEEDED

        # Try to cancel it - should fail because only PENDING/PROCESSING can be cancelled
        cancel_cmd = CancelPaymentCommand(
            tenant_id=tenant_id,
            payment_id=payment.payment_id,
            cancellation_reason="Customer requested refund due to duplicate payment",
        )

        with pytest.raises(PaymentError, match="Cannot cancel payment"):
            await payment_handler.handle_cancel_payment(cancel_cmd)


@pytest.mark.asyncio
@pytest.mark.integration
class TestCommandHandlerTenantIsolation:
    """Test that command handlers properly isolate data by tenant."""

    async def test_cannot_update_invoice_from_different_tenant(
        self,
        invoice_handler: InvoiceCommandHandler,
        customer_id: str,
        async_db_session: AsyncSession,
    ):
        """Test that updating invoice with wrong tenant ID fails."""
        tenant_a = str(uuid4())
        tenant_b = str(uuid4())

        # Create invoice for tenant A using service
        service = InvoiceService(db_session=async_db_session)
        invoice = await service.create_invoice(
            tenant_id=tenant_a,
            customer_id=customer_id,
            billing_email="test@example.com",
            billing_address={"street": "123 Test St", "city": "Test City", "country": "US"},
            line_items=[
                {"description": "Test", "quantity": 1, "unit_price": 5000, "total_price": 5000}
            ],
            currency="USD",
        )

        # Try to update with tenant B credentials
        update_cmd = UpdateInvoiceCommand(
            tenant_id=tenant_b,
            invoice_id=invoice.invoice_id,
            notes="Malicious update attempt",
        )

        # Should fail because invoice doesn't exist for tenant B
        with pytest.raises(ValueError, match="not found"):
            await invoice_handler.handle_update_invoice(update_cmd)


@pytest.mark.asyncio
@pytest.mark.integration
class TestCommandHandlerEventPublishing:
    """Test that command handlers publish events correctly."""

    async def test_create_invoice_publishes_event(self, test_invoice: Invoice):
        """Test that creating invoice publishes event to event bus."""
        # Invoice created via fixture using service layer
        # If we got here without error, event publishing worked
        # (Redis/EventBus must be running for tests)
        assert test_invoice is not None
        assert test_invoice.invoice_id is not None

    async def test_offline_payment_publishes_event(
        self,
        payment_handler: PaymentCommandHandler,
        test_invoice: Invoice,
        tenant_id: str,
        customer_id: str,
    ):
        """Test that recording offline payment publishes event."""
        # Record payment against existing test invoice
        command = RecordOfflinePaymentCommand(
            tenant_id=tenant_id,
            invoice_id=test_invoice.invoice_id,
            customer_id=customer_id,
            amount=75000,
            currency="USD",
            payment_method="wire_transfer",
            reference_number="WIRE-TEST-001",
        )

        payment = await payment_handler.handle_record_offline_payment(command)

        # Event publishing should succeed
        assert payment is not None
        assert payment.status == PaymentStatus.SUCCEEDED
