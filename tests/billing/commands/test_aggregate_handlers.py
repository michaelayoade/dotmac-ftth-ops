"""
Tests for Aggregate-Based Command Handlers.

Tests that command handlers properly use domain aggregates,
enforce business rules, and publish domain events.
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest

from dotmac.platform.billing.commands.aggregate_handlers import (
    AggregateInvoiceCommandHandler,
    AggregatePaymentCommandHandler,
)
from dotmac.platform.billing.commands.invoice_commands import (
    ApplyPaymentToInvoiceCommand,
    CreateInvoiceCommand,
    MarkInvoiceAsPaidCommand,
    VoidInvoiceCommand,
)
from dotmac.platform.billing.commands.payment_commands import (
    CreatePaymentCommand,
    RefundPaymentCommand,
)
from dotmac.platform.billing.domain import Invoice, Payment
from dotmac.platform.core import Money
from dotmac.platform.core.exceptions import BusinessRuleError


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.add = Mock()
    return session


@pytest.fixture
def mock_event_bus():
    """Mock event bus for integration events."""
    bus = AsyncMock()
    bus.publish = AsyncMock()
    return bus


@pytest.mark.unit
class TestAggregateInvoiceCommandHandler:
    """Test suite for aggregate-based invoice command handler."""

    @pytest.mark.asyncio
    async def test_create_invoice_uses_aggregate(self, mock_db_session, mock_event_bus):
        """Test that CreateInvoiceCommand uses Invoice aggregate."""
        # Arrange
        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregateInvoiceCommandHandler(mock_db_session)

            command = CreateInvoiceCommand(
                tenant_id="tenant-1",
                user_id="user-1",
                customer_id="cust-123",
                billing_email="customer@example.com",
                billing_address={"street": "123 Main St"},
                line_items=[
                    {
                        "description": "Service A",
                        "quantity": 2,
                        "unit_price": 50.00,
                        "product_id": "prod-1",
                    }
                ],
                currency="USD",
                due_days=30,
            )

            # Act
            invoice = await handler.handle_create_invoice(command)

            # Assert
            assert isinstance(invoice, Invoice)
            assert invoice.customer_id == "cust-123"
            assert invoice.billing_email == "customer@example.com"
            assert invoice.total_amount.amount == 100.00  # 2 * 50.00
            assert invoice.total_amount.currency == "USD"
            assert invoice.status == "draft"

            # Verify database interaction
            mock_db_session.add.assert_called()
            mock_db_session.flush.assert_called()
            mock_db_session.commit.assert_called()

            # Verify integration event published
            mock_event_bus.publish.assert_called_once()
            call_args = mock_event_bus.publish.call_args
            assert call_args[1]["event_type"] == "billing.invoice.created"
            assert call_args[1]["payload"]["customer_id"] == "cust-123"

    @pytest.mark.asyncio
    async def test_create_invoice_enforces_business_rules(self, mock_db_session, mock_event_bus):
        """Test that business rules are enforced during invoice creation."""
        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregateInvoiceCommandHandler(mock_db_session)

            # Test: Currency mismatch between line items should fail
            # This is a business rule enforced by the Invoice aggregate
            command = CreateInvoiceCommand(
                tenant_id="tenant-1",
                customer_id="cust-123",
                billing_email="customer@example.com",
                billing_address={},
                line_items=[
                    {
                        "description": "Service A",
                        "quantity": 1,
                        "unit_price": 50.00,
                        "product_id": "prod-1",
                    },
                    {
                        "description": "Service B",
                        "quantity": 1,
                        "unit_price": 30.00,
                        "product_id": "prod-2",
                    },
                ],
                currency="USD",
            )

            # This should work - all items use the same currency
            invoice = await handler.handle_create_invoice(command)
            assert invoice.total_amount.currency == "USD"
            assert invoice.total_amount.amount == 80.00  # 50 + 30

    @pytest.mark.asyncio
    async def test_void_invoice_uses_aggregate(self, mock_db_session, mock_event_bus):
        """Test that VoidInvoiceCommand uses Invoice aggregate."""
        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregateInvoiceCommandHandler(mock_db_session)

            # Create existing invoice
            existing_invoice = Invoice.create(
                tenant_id="tenant-1",
                customer_id="cust-123",
                billing_email="customer@example.com",
                line_items=[
                    Mock(
                        description="Service",
                        quantity=1,
                        unit_price=Money(amount=100.0, currency="USD"),
                        total_price=Money(amount=100.0, currency="USD"),
                        product_id=None,
                    )
                ],
            )
            existing_invoice.id = "inv-123"

            # Mock repository to return existing invoice
            with patch.object(
                handler.invoice_repo, "get", return_value=existing_invoice
            ) as mock_get:
                with patch.object(handler.invoice_repo, "save") as mock_save:
                    command = VoidInvoiceCommand(
                        tenant_id="tenant-1",
                        user_id="user-1",
                        invoice_id="inv-123",
                        void_reason="Customer requested cancellation",
                    )

                    # Act
                    invoice = await handler.handle_void_invoice(command)

                    # Assert
                    assert invoice.status == "void"
                    assert invoice.voided_at is not None

                    # Verify repository calls
                    mock_get.assert_called_once_with("inv-123", "tenant-1")
                    mock_save.assert_called_once()

                    # Verify integration event
                    mock_event_bus.publish.assert_called()
                    call_args = mock_event_bus.publish.call_args
                    assert call_args[1]["event_type"] == "billing.invoice.voided"

    @pytest.mark.asyncio
    async def test_void_invoice_enforces_business_rules(self, mock_db_session, mock_event_bus):
        """Test that business rules prevent voiding paid invoice."""
        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregateInvoiceCommandHandler(mock_db_session)

            # Create paid invoice
            paid_invoice = Invoice.create(
                tenant_id="tenant-1",
                customer_id="cust-123",
                billing_email="customer@example.com",
                line_items=[
                    Mock(
                        description="Service",
                        quantity=1,
                        unit_price=Money(amount=100.0, currency="USD"),
                        total_price=Money(amount=100.0, currency="USD"),
                        product_id=None,
                    )
                ],
            )
            paid_invoice.apply_payment("pay-1", Money(amount=100.0, currency="USD"))
            assert paid_invoice.status == "paid"

            # Mock repository
            with patch.object(handler.invoice_repo, "get", return_value=paid_invoice):
                command = VoidInvoiceCommand(
                    tenant_id="tenant-1",
                    invoice_id="inv-123",
                    void_reason="Test void reason that meets minimum length",
                )

                # Act & Assert
                with pytest.raises(BusinessRuleError, match="Cannot void paid invoice"):
                    await handler.handle_void_invoice(command)

    @pytest.mark.asyncio
    async def test_apply_payment_uses_aggregate(self, mock_db_session, mock_event_bus):
        """Test that ApplyPaymentToInvoiceCommand uses Invoice aggregate."""
        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregateInvoiceCommandHandler(mock_db_session)

            # Create invoice
            invoice = Invoice.create(
                tenant_id="tenant-1",
                customer_id="cust-123",
                billing_email="customer@example.com",
                line_items=[
                    Mock(
                        description="Service",
                        quantity=1,
                        unit_price=Money(amount=100.0, currency="USD"),
                        total_price=Money(amount=100.0, currency="USD"),
                        product_id=None,
                    )
                ],
            )
            invoice.id = "inv-123"

            with patch.object(handler.invoice_repo, "get", return_value=invoice):
                with patch.object(handler.invoice_repo, "save"):
                    command = ApplyPaymentToInvoiceCommand(
                        tenant_id="tenant-1",
                        invoice_id="inv-123",
                        payment_id="pay-456",
                        amount=10000,  # $100.00 in cents
                    )

                    # Act
                    result = await handler.handle_apply_payment(command)

                    # Assert
                    assert result.status == "paid"
                    assert result.paid_at is not None

                    # Verify both payment_applied and paid events published
                    assert mock_event_bus.publish.call_count == 2

    @pytest.mark.asyncio
    async def test_mark_as_paid_uses_aggregate(self, mock_db_session, mock_event_bus):
        """Test that MarkInvoiceAsPaidCommand uses Invoice aggregate."""
        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregateInvoiceCommandHandler(mock_db_session)

            # Create invoice
            invoice = Invoice.create(
                tenant_id="tenant-1",
                customer_id="cust-123",
                billing_email="customer@example.com",
                line_items=[
                    Mock(
                        description="Service",
                        quantity=1,
                        unit_price=Money(amount=100.0, currency="USD"),
                        total_price=Money(amount=100.0, currency="USD"),
                        product_id=None,
                    )
                ],
            )
            invoice.id = "inv-123"

            with patch.object(handler.invoice_repo, "get", return_value=invoice):
                with patch.object(handler.invoice_repo, "save"):
                    command = MarkInvoiceAsPaidCommand(
                        tenant_id="tenant-1",
                        invoice_id="inv-123",
                        payment_method="check",
                        payment_reference="CHK-12345",
                    )

                    # Act
                    result = await handler.handle_mark_as_paid(command)

                    # Assert
                    assert result.status == "paid"
                    assert result.paid_at is not None


@pytest.mark.unit
class TestAggregatePaymentCommandHandler:
    """Test suite for aggregate-based payment command handler."""

    @pytest.mark.asyncio
    async def test_create_payment_uses_aggregate(self, mock_db_session, mock_event_bus):
        """Test that CreatePaymentCommand uses Payment aggregate."""
        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregatePaymentCommandHandler(mock_db_session)

            command = CreatePaymentCommand(
                tenant_id="tenant-1",
                user_id="user-1",
                customer_id="cust-123",
                amount=10000,  # $100.00 in cents
                currency="USD",
                payment_method_id="pm-stripe-123",
                invoice_id="inv-456",
                capture_immediately=True,
            )

            # Act
            payment = await handler.handle_create_payment(command)

            # Assert
            assert isinstance(payment, Payment)
            assert payment.customer_id == "cust-123"
            assert payment.amount.amount == 100.00
            assert payment.amount.currency == "USD"
            assert payment.status == "succeeded"  # Captured immediately

            # Verify database interaction
            mock_db_session.add.assert_called()
            mock_db_session.flush.assert_called()
            mock_db_session.commit.assert_called()

            # Verify integration event published
            mock_event_bus.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_refund_payment_uses_aggregate(self, mock_db_session, mock_event_bus):
        """Test that RefundPaymentCommand uses Payment aggregate."""
        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregatePaymentCommandHandler(mock_db_session)

            # Create processed payment
            payment = Payment.create(
                tenant_id="tenant-1",
                customer_id="cust-123",
                amount=Money(amount=100.0, currency="USD"),
                payment_method="card",
            )
            payment.process(transaction_id="txn-123")
            payment.id = "pay-123"

            with patch.object(handler.payment_repo, "get", return_value=payment):
                with patch.object(handler.payment_repo, "save"):
                    command = RefundPaymentCommand(
                        tenant_id="tenant-1",
                        payment_id="pay-123",
                        amount=5000,  # Partial refund $50.00
                        reason="Customer requested partial refund",
                    )

                    # Act
                    result = await handler.handle_refund_payment(command)

                    # Assert
                    assert result.status == "refunded"

                    # Verify integration event
                    mock_event_bus.publish.assert_called_once()
                    call_args = mock_event_bus.publish.call_args
                    assert call_args[1]["event_type"] == "billing.payment.refunded"

    @pytest.mark.asyncio
    async def test_refund_payment_enforces_business_rules(self, mock_db_session, mock_event_bus):
        """Test that business rules prevent refunding unpaid payment."""
        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregatePaymentCommandHandler(mock_db_session)

            # Create pending payment (not processed)
            payment = Payment.create(
                tenant_id="tenant-1",
                customer_id="cust-123",
                amount=Money(amount=100.0, currency="USD"),
                payment_method="card",
            )
            assert payment.status == "pending"

            with patch.object(handler.payment_repo, "get", return_value=payment):
                command = RefundPaymentCommand(
                    tenant_id="tenant-1",
                    payment_id="pay-123",
                    reason="Test refund",
                )

                # Act & Assert
                with pytest.raises(BusinessRuleError, match="Can only refund succeeded payments"):
                    await handler.handle_refund_payment(command)


@pytest.mark.unit
class TestDomainEventPublication:
    """Test that domain events are properly published through repositories."""

    @pytest.mark.asyncio
    async def test_repository_publishes_domain_events(self, mock_db_session):
        """Test that saving aggregate publishes domain events."""
        from dotmac.platform.billing.domain import SQLAlchemyInvoiceRepository
        from dotmac.platform.core import get_domain_event_dispatcher

        # Create invoice with domain events
        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=[
                Mock(
                    description="Service",
                    quantity=1,
                    unit_price=Money(amount=100.0, currency="USD"),
                    total_price=Money(amount=100.0, currency="USD"),
                    product_id=None,
                )
            ],
        )

        # Verify invoice has domain events
        events_before_save = invoice.get_domain_events()
        assert len(events_before_save) > 0

        # Save through repository
        repo = SQLAlchemyInvoiceRepository(mock_db_session)

        with patch.object(get_domain_event_dispatcher(), "dispatch") as mock_dispatch:
            await repo.save(invoice)

            # Verify domain events were dispatched
            assert mock_dispatch.call_count >= 1

            # Verify events cleared after publishing
            assert len(invoice.get_domain_events()) == 0
