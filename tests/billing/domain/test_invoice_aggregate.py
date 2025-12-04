"""Tests for Invoice domain aggregate."""

from datetime import UTC, datetime, timedelta

import pytest

from dotmac.platform.billing.domain.aggregates import Invoice, InvoiceLineItem
from dotmac.platform.core import (
    InvoiceCreatedEvent,
    InvoiceOverdueEvent,
    InvoicePaymentReceivedEvent,
    InvoiceVoidedEvent,
    Money,
)
from dotmac.platform.core.exceptions import BusinessRuleError


@pytest.mark.unit
class TestInvoiceCreation:
    """Test invoice creation."""

    def test_create_invoice_with_single_line_item(self):
        """Test creating invoice with single line item."""
        line_items = [
            InvoiceLineItem(
                description="Premium Plan",
                quantity=1,
                unit_price=Money(amount=99.99, currency="USD"),
                total_price=Money(amount=99.99, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )

        assert invoice.invoice_number.startswith("INV-")
        assert invoice.customer_id == "cust-123"
        assert invoice.billing_email == "customer@example.com"
        assert invoice.subtotal.amount == 99.99
        assert invoice.total_amount.amount == 99.99
        assert invoice.status == "draft"
        assert len(invoice.get_domain_events()) == 1

    def test_create_invoice_with_multiple_line_items(self):
        """Test creating invoice with multiple line items."""
        line_items = [
            InvoiceLineItem(
                description="Product A",
                quantity=2,
                unit_price=Money(amount=50.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            ),
            InvoiceLineItem(
                description="Product B",
                quantity=1,
                unit_price=Money(amount=75.50, currency="USD"),
                total_price=Money(amount=75.50, currency="USD"),
            ),
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )

        assert invoice.subtotal.amount == 175.50
        assert invoice.total_amount.amount == 175.50
        assert len(invoice.line_items_data) == 2

    def test_create_invoice_raises_invoice_created_event(self):
        """Test that creating invoice raises InvoiceCreatedEvent."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )

        events = invoice.get_domain_events()
        assert len(events) == 1
        assert isinstance(events[0], InvoiceCreatedEvent)
        assert events[0].invoice_number == invoice.invoice_number
        assert events[0].customer_id == "cust-123"
        assert events[0].amount == 100.00

    def test_create_invoice_requires_line_items(self):
        """Test that invoice creation fails without line items."""
        with pytest.raises(BusinessRuleError, match="must have at least one line item"):
            Invoice.create(
                tenant_id="tenant-1",
                customer_id="cust-123",
                billing_email="customer@example.com",
                line_items=[],
            )

    def test_create_invoice_requires_same_currency(self):
        """Test that all line items must use same currency."""
        line_items = [
            InvoiceLineItem(
                description="Product A",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            ),
            InvoiceLineItem(
                description="Product B",
                quantity=1,
                unit_price=Money(amount=100.00, currency="EUR"),
                total_price=Money(amount=100.00, currency="EUR"),
            ),
        ]

        with pytest.raises(BusinessRuleError, match="must use same currency"):
            Invoice.create(
                tenant_id="tenant-1",
                customer_id="cust-123",
                billing_email="customer@example.com",
                line_items=line_items,
            )

    def test_create_invoice_with_custom_due_days(self):
        """Test creating invoice with custom due days."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
            due_days=15,
        )

        expected_due_date = datetime.now(UTC) + timedelta(days=15)
        assert invoice.due_date.date() == expected_due_date.date()


@pytest.mark.unit
class TestInvoicePayment:
    """Test invoice payment functionality."""

    def test_apply_payment_to_invoice(self):
        """Test applying payment to invoice."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.finalize()
        invoice.clear_domain_events()

        invoice.apply_payment(
            payment_id="pay-456",
            amount=Money(amount=100.00, currency="USD"),
        )

        assert invoice.status == "paid"
        assert invoice.payment_status == "paid"
        assert invoice.paid_at is not None

    def test_apply_payment_raises_event(self):
        """Test that applying payment raises domain event."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.clear_domain_events()

        invoice.apply_payment(
            payment_id="pay-456",
            amount=Money(amount=100.00, currency="USD"),
        )

        events = invoice.get_domain_events()
        assert len(events) == 1
        assert isinstance(events[0], InvoicePaymentReceivedEvent)
        assert events[0].payment_id == "pay-456"
        assert events[0].amount == 100.00

    def test_cannot_pay_voided_invoice(self):
        """Test that voided invoices cannot be paid."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.void(reason="Customer cancelled")

        with pytest.raises(BusinessRuleError, match="Cannot apply payment to voided invoice"):
            invoice.apply_payment(
                payment_id="pay-456",
                amount=Money(amount=100.00, currency="USD"),
            )

    def test_cannot_pay_already_paid_invoice(self):
        """Test that paid invoices cannot be paid again."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.apply_payment(
            payment_id="pay-1",
            amount=Money(amount=100.00, currency="USD"),
        )

        with pytest.raises(BusinessRuleError, match="already fully paid"):
            invoice.apply_payment(
                payment_id="pay-2",
                amount=Money(amount=100.00, currency="USD"),
            )

    def test_payment_currency_must_match(self):
        """Test that payment currency must match invoice currency."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )

        with pytest.raises(BusinessRuleError, match="currency.*does not match"):
            invoice.apply_payment(
                payment_id="pay-456",
                amount=Money(amount=100.00, currency="EUR"),
            )

    def test_payment_amount_cannot_exceed_total(self):
        """Test that payment cannot exceed invoice total."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )

        with pytest.raises(BusinessRuleError, match="exceeds remaining balance"):
            invoice.apply_payment(
                payment_id="pay-456",
                amount=Money(amount=150.00, currency="USD"),
            )


@pytest.mark.unit
class TestInvoiceVoiding:
    """Test invoice voiding functionality."""

    def test_void_invoice(self):
        """Test voiding an invoice."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.clear_domain_events()

        invoice.void(reason="Customer cancelled order")

        assert invoice.status == "void"
        assert invoice.voided_at is not None

    def test_void_raises_event(self):
        """Test that voiding raises domain event."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.clear_domain_events()

        invoice.void(reason="Test reason")

        events = invoice.get_domain_events()
        assert len(events) == 1
        assert isinstance(events[0], InvoiceVoidedEvent)
        assert events[0].reason == "Test reason"

    def test_cannot_void_paid_invoice(self):
        """Test that paid invoices cannot be voided."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.apply_payment(
            payment_id="pay-1",
            amount=Money(amount=100.00, currency="USD"),
        )

        with pytest.raises(BusinessRuleError, match="Cannot void paid invoice"):
            invoice.void()

    def test_cannot_void_already_voided_invoice(self):
        """Test that already voided invoices cannot be voided again."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.void()

        with pytest.raises(BusinessRuleError, match="already voided"):
            invoice.void()


@pytest.mark.unit
class TestInvoiceOverdue:
    """Test invoice overdue functionality."""

    def test_mark_invoice_overdue(self):
        """Test marking invoice as overdue."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
            due_days=0,  # Due immediately
        )
        # Manually set due_date to past
        invoice.due_date = datetime.now(UTC) - timedelta(days=5)
        invoice.clear_domain_events()

        invoice.mark_overdue()

        assert invoice.status == "overdue"
        assert invoice.payment_status == "overdue"

    def test_mark_overdue_raises_event(self):
        """Test that marking overdue raises domain event."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.due_date = datetime.now(UTC) - timedelta(days=10)
        invoice.clear_domain_events()

        invoice.mark_overdue()

        events = invoice.get_domain_events()
        assert len(events) == 1
        assert isinstance(events[0], InvoiceOverdueEvent)
        assert events[0].days_overdue == 10

    def test_cannot_mark_paid_invoice_overdue(self):
        """Test that paid invoices cannot be marked overdue."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.apply_payment(
            payment_id="pay-1",
            amount=Money(amount=100.00, currency="USD"),
        )

        with pytest.raises(BusinessRuleError, match="Cannot mark.*overdue"):
            invoice.mark_overdue()

    def test_cannot_mark_future_invoice_overdue(self):
        """Test that future invoices cannot be marked overdue."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
            due_days=30,
        )

        with pytest.raises(BusinessRuleError, match="not yet due"):
            invoice.mark_overdue()


@pytest.mark.unit
class TestInvoiceStatusTransitions:
    """Test invoice status transitions."""

    def test_finalize_draft_invoice(self):
        """Test finalizing draft invoice."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )

        invoice.finalize()

        assert invoice.status == "finalized"

    def test_send_finalized_invoice(self):
        """Test sending finalized invoice."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.finalize()

        invoice.send()

        assert invoice.status == "sent"

    def test_cannot_finalize_non_draft_invoice(self):
        """Test that only draft invoices can be finalized."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )
        invoice.finalize()

        with pytest.raises(BusinessRuleError, match="Cannot finalize"):
            invoice.finalize()

    def test_cannot_send_draft_invoice(self):
        """Test that draft invoices cannot be sent."""
        line_items = [
            InvoiceLineItem(
                description="Test",
                quantity=1,
                unit_price=Money(amount=100.00, currency="USD"),
                total_price=Money(amount=100.00, currency="USD"),
            )
        ]

        invoice = Invoice.create(
            tenant_id="tenant-1",
            customer_id="cust-123",
            billing_email="customer@example.com",
            line_items=line_items,
        )

        with pytest.raises(BusinessRuleError, match="Must be finalized"):
            invoice.send()


@pytest.mark.unit
class TestInvoiceLineItem:
    """Test InvoiceLineItem value object."""

    def test_create_line_item(self):
        """Test creating line item."""
        item = InvoiceLineItem(
            description="Test Product",
            quantity=2,
            unit_price=Money(amount=50.00, currency="USD"),
            total_price=Money(amount=100.00, currency="USD"),
        )

        assert item.description == "Test Product"
        assert item.quantity == 2
        assert item.unit_price.amount == 50.00
        assert item.total_price.amount == 100.00

    def test_line_item_validates_total(self):
        """Test that line item validates total price."""
        with pytest.raises(BusinessRuleError, match="does not match calculated total"):
            InvoiceLineItem(
                description="Test",
                quantity=2,
                unit_price=Money(amount=50.00, currency="USD"),
                total_price=Money(amount=90.00, currency="USD"),  # Should be 100.00
            )
