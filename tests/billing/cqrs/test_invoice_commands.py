"""Tests for Invoice Commands (CQRS Pattern)"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from dotmac.platform.billing.commands.handlers import InvoiceCommandHandler
from dotmac.platform.billing.commands.invoice_commands import (
    ApplyPaymentToInvoiceCommand,
    CreateInvoiceCommand,
    FinalizeInvoiceCommand,
    MarkInvoiceAsPaidCommand,
    VoidInvoiceCommand,
)


@pytest.mark.unit
class TestCreateInvoiceCommand:
    """Test CreateInvoiceCommand"""

    def test_create_invoice_command_initialization(self):
        """Test command creates with required fields"""
        command = CreateInvoiceCommand(
            tenant_id="tenant-1",
            user_id="user-123",
            customer_id="cust-456",
            billing_email="customer@example.com",
            billing_address={"street": "123 Main St", "city": "Boston"},
            line_items=[
                {
                    "description": "Product A",
                    "quantity": 2,
                    "unit_price": 5000,
                    "total_price": 10000,
                }
            ],
        )

        assert command.tenant_id == "tenant-1"
        assert command.customer_id == "cust-456"
        assert len(command.line_items) == 1
        assert command.currency == "USD"
        assert command.auto_finalize is False

    def test_create_invoice_command_immutable(self):
        """Test command is immutable (frozen)"""
        command = CreateInvoiceCommand(
            tenant_id="tenant-1",
            customer_id="cust-456",
            billing_email="customer@example.com",
            billing_address={},
            line_items=[
                {"description": "Test", "quantity": 1, "unit_price": 1000, "total_price": 1000}
            ],
        )

        with pytest.raises(Exception):  # Pydantic ValidationError for frozen model  # noqa: B017
            command.tenant_id = "different-tenant"

    def test_create_invoice_command_with_optional_fields(self):
        """Test command with all optional fields"""
        due_date = datetime.now(UTC) + timedelta(days=30)

        command = CreateInvoiceCommand(
            tenant_id="tenant-1",
            customer_id="cust-456",
            billing_email="customer@example.com",
            billing_address={},
            line_items=[
                {"description": "Test Item", "quantity": 1, "unit_price": 1000, "total_price": 1000}
            ],
            currency="EUR",
            due_days=15,
            due_date=due_date,
            notes="Test notes",
            internal_notes="Internal only",
            subscription_id="sub-123",
            extra_data={"custom_field": "value"},
            auto_finalize=True,
            idempotency_key="unique-key-123",
        )

        assert command.currency == "EUR"
        assert command.due_days == 15
        assert command.auto_finalize is True
        assert command.idempotency_key == "unique-key-123"
        assert command.subscription_id == "sub-123"

    def test_create_invoice_command_validation_fails_empty_line_items(self):
        """Test validation fails with empty line items"""
        with pytest.raises(Exception):  # Pydantic ValidationError  # noqa: B017
            CreateInvoiceCommand(
                tenant_id="tenant-1",
                customer_id="cust-456",
                billing_email="customer@example.com",
                billing_address={},
                line_items=[],  # Empty - should fail min_length=1
            )


@pytest.mark.unit
class TestInvoiceCommandHandler:
    """Test InvoiceCommandHandler"""

    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session"""
        return AsyncMock()

    @pytest.fixture
    def command_handler(self, mock_db_session):
        """Create command handler with mocked dependencies"""
        return InvoiceCommandHandler(mock_db_session)

    @pytest.mark.asyncio
    async def test_handle_create_invoice_publishes_event(self, command_handler):
        """Test create invoice handler publishes domain event"""
        command = CreateInvoiceCommand(
            tenant_id="tenant-1",
            user_id="user-123",
            customer_id="cust-456",
            billing_email="customer@example.com",
            billing_address={"name": "John Doe"},
            line_items=[
                {
                    "description": "Product A",
                    "quantity": 1,
                    "unit_price": 10000,
                    "total_price": 10000,
                }
            ],
        )

        # Mock the invoice service
        with patch.object(command_handler.invoice_service, "create_invoice") as mock_create:
            from dotmac.platform.billing.core.models import Invoice

            mock_invoice = Invoice(
                tenant_id="tenant-1",
                invoice_id="inv-123",
                invoice_number="INV-001",
                customer_id="cust-456",
                billing_email="customer@example.com",
                billing_address={"name": "John Doe"},
                currency="USD",
                subtotal=10000,
                tax_amount=0,
                discount_amount=0,
                total_amount=10000,
                remaining_balance=10000,
                status="draft",
                issue_date=datetime.now(UTC),
                due_date=datetime.now(UTC) + timedelta(days=30),
            )
            mock_create.return_value = mock_invoice

            # Mock event bus
            with patch.object(command_handler.event_bus, "publish") as mock_publish:
                invoice = await command_handler.handle_create_invoice(command)

                # Verify service was called
                mock_create.assert_called_once()

                # Verify event was published
                mock_publish.assert_called_once()
                call_args = mock_publish.call_args
                assert call_args.kwargs["event_type"] == "billing.invoice.created"
                assert call_args.kwargs["payload"]["invoice_id"] == "inv-123"
                assert call_args.kwargs["metadata"]["tenant_id"] == "tenant-1"

                # Verify invoice returned
                assert invoice.invoice_id == "inv-123"


@pytest.mark.unit
class TestVoidInvoiceCommand:
    """Test VoidInvoiceCommand"""

    def test_void_invoice_command_requires_reason(self):
        """Test void command requires reason with min length"""
        with pytest.raises(Exception):  # Pydantic ValidationError  # noqa: B017
            VoidInvoiceCommand(
                tenant_id="tenant-1",
                invoice_id="inv-123",
                void_reason="Short",  # Less than 10 characters
            )

    def test_void_invoice_command_valid(self):
        """Test valid void command"""
        command = VoidInvoiceCommand(
            tenant_id="tenant-1",
            user_id="user-123",
            invoice_id="inv-123",
            void_reason="Customer requested cancellation due to order error",
        )

        assert command.invoice_id == "inv-123"
        assert len(command.void_reason) >= 10


@pytest.mark.unit
class TestFinalizeInvoiceCommand:
    """Test FinalizeInvoiceCommand"""

    def test_finalize_invoice_command_defaults(self):
        """Test finalize command with defaults"""
        command = FinalizeInvoiceCommand(
            tenant_id="tenant-1",
            invoice_id="inv-123",
        )

        assert command.send_email is True  # Default

    def test_finalize_invoice_command_no_email(self):
        """Test finalize without sending email"""
        command = FinalizeInvoiceCommand(
            tenant_id="tenant-1",
            invoice_id="inv-123",
            send_email=False,
        )

        assert command.send_email is False


@pytest.mark.unit
class TestApplyPaymentToInvoiceCommand:
    """Test ApplyPaymentToInvoiceCommand"""

    def test_apply_payment_command_requires_positive_amount(self):
        """Test command requires positive payment amount"""
        with pytest.raises(Exception):  # Pydantic ValidationError  # noqa: B017
            ApplyPaymentToInvoiceCommand(
                tenant_id="tenant-1",
                invoice_id="inv-123",
                payment_id="pay-456",
                amount=0,  # Must be > 0
            )

    def test_apply_payment_command_valid(self):
        """Test valid apply payment command"""
        command = ApplyPaymentToInvoiceCommand(
            tenant_id="tenant-1",
            invoice_id="inv-123",
            payment_id="pay-456",
            amount=5000,
        )

        assert command.amount == 5000
        assert command.payment_id == "pay-456"


@pytest.mark.unit
class TestMarkInvoiceAsPaidCommand:
    """Test MarkInvoiceAsPaidCommand"""

    def test_mark_as_paid_command_initialization(self):
        """Test mark as paid command"""
        command = MarkInvoiceAsPaidCommand(
            tenant_id="tenant-1",
            user_id="user-123",
            invoice_id="inv-123",
            payment_method="check",
            payment_reference="CHK-789",
            notes="Received check #789",
        )

        assert command.invoice_id == "inv-123"
        assert command.payment_method == "check"
        assert command.payment_reference == "CHK-789"
        assert isinstance(command.paid_date, datetime)
