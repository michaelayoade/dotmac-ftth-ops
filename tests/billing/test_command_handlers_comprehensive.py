"""
Tests for billing command handlers that were recently implemented.

NOTE: These unit tests complement integration tests in test_command_handlers_integration.py.

Unit tests focus on:
- Handler logic in isolation
- Mock-based validation
- Fast execution

Integration tests cover:
- Database persistence
- Service layer interactions
- Event publishing
- Tenant isolation

Verifies that:
1. handle_update_invoice calls InvoiceService.update_invoice
2. handle_send_invoice calls InvoiceService.send_invoice_email
3. handle_apply_payment_to_invoice calls InvoiceService.apply_payment_to_invoice
4. handle_cancel_payment calls PaymentService.cancel_payment
5. handle_record_offline_payment calls PaymentService.record_offline_payment
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from dotmac.platform.billing.commands.handlers import (
    InvoiceCommandHandler,
    PaymentCommandHandler,
)
from dotmac.platform.billing.commands.invoice_commands import (
    ApplyPaymentToInvoiceCommand,
    SendInvoiceCommand,
    UpdateInvoiceCommand,
)
from dotmac.platform.billing.commands.payment_commands import (
    CancelPaymentCommand,
    RecordOfflinePaymentCommand,
)
from dotmac.platform.billing.core.enums import PaymentStatus

pytestmark = pytest.mark.unit


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    return AsyncMock()


@pytest.mark.asyncio
class TestUpdateInvoiceHandler:
    """Test handle_update_invoice method."""

    async def test_update_invoice_calls_service(self, mock_db_session):
        """Test that handler delegates to InvoiceService.update_invoice."""
        handler = InvoiceCommandHandler(db_session=mock_db_session)

        # Mock get_invoice (called first to validate invoice exists)
        mock_invoice = MagicMock()
        mock_invoice.extra_data = None
        handler.invoice_service.get_invoice = AsyncMock(return_value=mock_invoice)

        # Mock update_invoice return value
        mock_result = MagicMock()
        handler.invoice_service.update_invoice = AsyncMock(return_value=mock_result)

        # Create and execute command
        due_date = datetime.now(UTC)
        command = UpdateInvoiceCommand(
            tenant_id="tenant-123",
            invoice_id="inv-123",
            due_date=due_date,
            notes="Updated notes",
            extra_data={"key": "value"},
        )

        await handler.handle_update_invoice(command)

        # Verify get_invoice was called first
        handler.invoice_service.get_invoice.assert_called_once_with(
            tenant_id="tenant-123",
            invoice_id="inv-123",
        )

        # Verify update_invoice was called correctly
        handler.invoice_service.update_invoice.assert_called_once_with(
            tenant_id="tenant-123",
            invoice_id="inv-123",
            due_date=due_date,
            notes="Updated notes",
            metadata={"key": "value"},
        )


@pytest.mark.asyncio
class TestSendInvoiceHandler:
    """Test handle_send_invoice method."""

    async def test_send_invoice_email_success(self, mock_db_session):
        """Test successful invoice email sending."""
        handler = InvoiceCommandHandler(db_session=mock_db_session)

        # Mock get_invoice (called first to validate invoice exists)
        mock_invoice = MagicMock()
        mock_invoice.extra_data = None
        mock_invoice.invoice_id = "inv-789"
        mock_invoice.billing_email = "customer@example.com"
        handler.invoice_service.get_invoice = AsyncMock(return_value=mock_invoice)

        # Mock send_invoice_email
        handler.invoice_service.send_invoice_email = AsyncMock(return_value=True)

        command = SendInvoiceCommand(
            tenant_id="tenant-123",
            invoice_id="inv-789",
            recipient_email="customer@example.com",
        )

        # handle_send_invoice returns the invoice object, not a dict
        result = await handler.handle_send_invoice(command)

        handler.invoice_service.send_invoice_email.assert_called_once_with(
            tenant_id="tenant-123",
            invoice_id="inv-789",
            recipient_email="customer@example.com",
        )

        # Result is the invoice object
        assert result.invoice_id == "inv-789"

    async def test_send_invoice_email_failure(self, mock_db_session):
        """Test invoice email sending failure."""
        handler = InvoiceCommandHandler(db_session=mock_db_session)

        # Mock get_invoice
        mock_invoice = MagicMock()
        mock_invoice.extra_data = None
        mock_invoice.invoice_id = "inv-789"
        mock_invoice.billing_email = "customer@example.com"
        handler.invoice_service.get_invoice = AsyncMock(return_value=mock_invoice)

        # Mock send_invoice_email to return False (failure)
        handler.invoice_service.send_invoice_email = AsyncMock(return_value=False)

        command = SendInvoiceCommand(
            tenant_id="tenant-123",
            invoice_id="inv-789",
        )

        # handle_send_invoice still returns invoice even on email failure
        result = await handler.handle_send_invoice(command)

        # Result is the invoice object
        assert result.invoice_id == "inv-789"


@pytest.mark.asyncio
class TestApplyPaymentToInvoiceHandler:
    """Test handle_apply_payment_to_invoice method."""

    async def test_apply_payment_to_invoice(self, mock_db_session):
        """Test applying payment to invoice."""
        handler = InvoiceCommandHandler(db_session=mock_db_session)

        # Mock get_invoice (called first to validate invoice exists)
        mock_invoice = MagicMock()
        mock_invoice.extra_data = None
        mock_invoice.invoice_id = "inv-123"
        handler.invoice_service.get_invoice = AsyncMock(return_value=mock_invoice)

        # Mock apply_payment_to_invoice
        mock_result = MagicMock()
        mock_result.status = "paid"
        mock_result.remaining_balance = 0
        handler.invoice_service.apply_payment_to_invoice = AsyncMock(return_value=mock_result)

        command = ApplyPaymentToInvoiceCommand(
            tenant_id="tenant-123",
            invoice_id="inv-123",
            payment_id="pay-456",
            amount=Decimal("500.00"),
        )

        # Method is called handle_apply_payment, not handle_apply_payment_to_invoice
        result = await handler.handle_apply_payment(command)

        handler.invoice_service.apply_payment_to_invoice.assert_called_once_with(
            tenant_id="tenant-123",
            invoice_id="inv-123",
            payment_id="pay-456",
            amount=Decimal("500.00"),
        )

        assert result.status == "paid"


@pytest.mark.asyncio
class TestCancelPaymentHandler:
    """Test handle_cancel_payment method."""

    async def test_cancel_payment(self, mock_db_session):
        """Test cancelling a payment."""
        handler = PaymentCommandHandler(db_session=mock_db_session)

        mock_result = MagicMock()
        mock_result.status = PaymentStatus.CANCELLED
        handler.payment_service.cancel_payment = AsyncMock(return_value=mock_result)

        command = CancelPaymentCommand(
            tenant_id="tenant-123",
            payment_id="pay-123",
            cancellation_reason="Customer requested cancellation",
        )

        result = await handler.handle_cancel_payment(command)

        handler.payment_service.cancel_payment.assert_called_once_with(
            tenant_id="tenant-123",
            payment_id="pay-123",
            cancellation_reason="Customer requested cancellation",
        )

        assert result.status == PaymentStatus.CANCELLED

    async def test_cancel_payment_without_reason(self, mock_db_session):
        """Test cancelling payment with minimal reason (cancellation_reason is required)."""
        handler = PaymentCommandHandler(db_session=mock_db_session)

        mock_result = MagicMock()
        handler.payment_service.cancel_payment = AsyncMock(return_value=mock_result)

        # cancellation_reason is required and must be 10-500 chars
        command = CancelPaymentCommand(
            tenant_id="tenant-123",
            payment_id="pay-456",
            cancellation_reason="Payment cancelled by system",
        )

        await handler.handle_cancel_payment(command)

        handler.payment_service.cancel_payment.assert_called_once_with(
            tenant_id="tenant-123",
            payment_id="pay-456",
            cancellation_reason="Payment cancelled by system",
        )


@pytest.mark.asyncio
class TestRecordOfflinePaymentHandler:
    """Test handle_record_offline_payment method."""

    async def test_record_offline_payment_check(self, mock_db_session):
        """Test recording offline payment via check."""
        handler = PaymentCommandHandler(db_session=mock_db_session)

        mock_result = MagicMock()
        mock_result.status = PaymentStatus.SUCCEEDED
        mock_result.provider = "offline"
        handler.payment_service.record_offline_payment = AsyncMock(return_value=mock_result)

        # amount must be int in minor units (e.g., cents), not Decimal
        command = RecordOfflinePaymentCommand(
            tenant_id="tenant-123",
            customer_id="cust-456",
            amount=150000,  # $1500.00 in cents
            currency="USD",
            payment_method="check",
            invoice_id="inv-789",
            reference_number="CHK-2025-001",
            notes="Payment received via mail",
        )

        result = await handler.handle_record_offline_payment(command)

        # Handler converts int to Decimal for service call
        handler.payment_service.record_offline_payment.assert_called_once_with(
            tenant_id="tenant-123",
            customer_id="cust-456",
            amount=150000,  # Service receives int amount
            currency="USD",
            payment_method="check",
            invoice_id="inv-789",
            reference_number="CHK-2025-001",
            notes="Payment received via mail",
        )

        assert result.status == PaymentStatus.SUCCEEDED
        assert result.provider == "offline"

    async def test_record_offline_payment_bank_transfer(self, mock_db_session):
        """Test recording offline payment via bank transfer."""
        handler = PaymentCommandHandler(db_session=mock_db_session)

        mock_result = MagicMock()
        handler.payment_service.record_offline_payment = AsyncMock(return_value=mock_result)

        payment_date = datetime.now(UTC)
        # amount must be int in minor units, invoice_id is required
        command = RecordOfflinePaymentCommand(
            tenant_id="tenant-123",
            customer_id="cust-789",
            amount=500000,  # €5000.00 in cents
            currency="EUR",
            payment_method="bank_transfer",
            invoice_id="inv-999",  # Required field
            reference_number="WIRE-2025-42",
            payment_date=payment_date,
        )

        await handler.handle_record_offline_payment(command)

        handler.payment_service.record_offline_payment.assert_called_once_with(
            tenant_id="tenant-123",
            customer_id="cust-789",
            amount=500000,  # int amount
            currency="EUR",
            payment_method="bank_transfer",
            invoice_id="inv-999",
            reference_number="WIRE-2025-42",
            notes=None,
        )


@pytest.mark.asyncio
class TestCommandHandlerErrorScenarios:
    """Test error handling in command handlers."""

    async def test_update_invoice_service_error(self, mock_db_session):
        """Test handle_update_invoice when service raises error."""
        handler = InvoiceCommandHandler(db_session=mock_db_session)

        # Mock get_invoice to return None (invoice not found)
        handler.invoice_service.get_invoice = AsyncMock(return_value=None)

        command = UpdateInvoiceCommand(
            tenant_id="tenant-123",
            invoice_id="nonexistent",
            notes="Update",
        )

        # Handler raises ValueError when invoice not found
        with pytest.raises(ValueError, match="Invoice nonexistent not found"):
            await handler.handle_update_invoice(command)

    async def test_cancel_payment_invalid_status(self, mock_db_session):
        """Test cancelling payment that's not in cancellable status."""
        from dotmac.platform.billing.core.exceptions import PaymentError

        handler = PaymentCommandHandler(db_session=mock_db_session)
        handler.payment_service.cancel_payment = AsyncMock(
            side_effect=PaymentError("Cannot cancel succeeded payment")
        )

        # cancellation_reason is required and must be 10-500 chars
        command = CancelPaymentCommand(
            tenant_id="tenant-123",
            payment_id="pay-succeeded",
            cancellation_reason="Attempting to cancel completed payment",
        )

        with pytest.raises(PaymentError, match="Cannot cancel succeeded payment"):
            await handler.handle_cancel_payment(command)
