"""Tests for billing money_models module."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from moneyed import Money

from dotmac.platform.billing.money_models import (
    MoneyField,
    MoneyInvoice,
    MoneyInvoiceLineItem,
)
from dotmac.platform.billing.money_utils import create_money


@pytest.mark.unit
class TestMoneyField:
    """Test MoneyField Pydantic model."""

    def test_money_field_creation(self):
        """Test creating MoneyField directly."""
        field = MoneyField(amount="100.50", currency="USD", minor_units=10050)

        assert field.amount == "100.50"
        assert field.currency == "USD"
        assert field.minor_units == 10050

    def test_money_field_from_money(self):
        """Test creating MoneyField from Money object."""
        money = Money("100.50", "USD")
        field = MoneyField.from_money(money)

        assert field.amount == "100.50"
        assert field.currency == "USD"
        assert field.minor_units == 10050

    def test_money_field_to_money(self):
        """Test converting MoneyField back to Money object."""
        field = MoneyField(amount="100.50", currency="USD", minor_units=10050)

        money = field.to_money()
        assert money.amount == Decimal("100.50")
        assert money.currency.code == "USD"

    def test_money_field_format(self):
        """Test formatting money with locale."""
        field = MoneyField.from_money(Money("1234.56", "USD"))
        formatted = field.format(locale="en_US")

        # Should contain currency symbol and amount
        assert "1234.56" in formatted or "1,234.56" in formatted

    def test_money_field_frozen(self):
        """Test MoneyField is frozen (immutable)."""
        field = MoneyField(amount="100", currency="USD", minor_units=10000)

        with pytest.raises(Exception):  # Pydantic ValidationError  # noqa: B017
            field.amount = "200"

    def test_money_field_different_currencies(self):
        """Test MoneyField with different currencies."""
        currencies = ["USD", "EUR", "GBP", "JPY"]

        for currency in currencies:
            money = Money("100", currency)
            field = MoneyField.from_money(money)
            assert field.currency == currency


@pytest.mark.unit
class TestMoneyInvoiceLineItem:
    """Test MoneyInvoiceLineItem model."""

    def test_line_item_creation_basic(self):
        """Test basic line item creation."""
        unit_price = MoneyField.from_money(Money("10.00", "USD"))
        total_price = MoneyField.from_money(Money("50.00", "USD"))
        tax_amount = MoneyField.from_money(Money("5.00", "USD"))
        discount_amount = MoneyField.from_money(Money("0", "USD"))

        item = MoneyInvoiceLineItem(
            description="Test Item",
            quantity=5,
            unit_price=unit_price,
            total_price=total_price,
            tax_rate=Decimal("0.1"),
            tax_amount=tax_amount,
            discount_percentage=Decimal("0"),
            discount_amount=discount_amount,
        )

        assert item.description == "Test Item"
        assert item.quantity == 5
        assert item.unit_price.amount == "10.00"
        assert item.total_price.amount == "50.00"

    def test_line_item_create_from_values_no_tax_discount(self):
        """Test creating line item with no tax or discount."""
        item = MoneyInvoiceLineItem.create_from_values(
            description="Widget", quantity=2, unit_price_amount="25.00", currency="USD"
        )

        assert item.description == "Widget"
        assert item.quantity == 2
        assert item.unit_price.amount == "25.00"
        assert item.total_price.amount == "50.00"  # 2 * 25
        assert item.tax_amount.amount == "0.00"
        assert item.discount_amount.amount == "0.00"

    def test_line_item_create_from_values_with_tax(self):
        """Test creating line item with tax."""
        item = MoneyInvoiceLineItem.create_from_values(
            description="Taxable Widget",
            quantity=1,
            unit_price_amount="100.00",
            currency="USD",
            tax_rate="0.10",  # 10% tax
        )

        assert item.unit_price.amount == "100.00"
        assert item.tax_rate == Decimal("0.10")
        assert item.tax_amount.amount == "10.00"  # 10% of 100
        assert item.total_price.amount == "110.00"  # 100 + 10 tax

    def test_line_item_create_from_values_with_discount(self):
        """Test creating line item with discount."""
        item = MoneyInvoiceLineItem.create_from_values(
            description="Discounted Widget",
            quantity=1,
            unit_price_amount="100.00",
            currency="USD",
            discount_percentage="0.20",  # 20% discount
        )

        assert item.unit_price.amount == "100.00"
        assert item.discount_percentage == Decimal("0.20")
        assert item.discount_amount.amount == "20.00"  # 20% of 100
        assert item.total_price.amount == "80.00"  # 100 - 20 discount

    def test_line_item_create_from_values_with_tax_and_discount(self):
        """Test creating line item with both tax and discount."""
        # Discount applied first, then tax on discounted amount
        item = MoneyInvoiceLineItem.create_from_values(
            description="Widget",
            quantity=1,
            unit_price_amount="100.00",
            currency="USD",
            tax_rate="0.10",  # 10% tax
            discount_percentage="0.20",  # 20% discount
        )

        assert item.discount_amount.amount == "20.00"  # 20% of 100
        # Tax on 80 (after discount): 80 * 0.10 = 8
        assert item.tax_amount.amount == "8.00"
        # Total: 80 + 8 = 88
        assert item.total_price.amount == "88.00"

    def test_line_item_quantity_validation(self):
        """Test quantity must be >= 1."""
        with pytest.raises(Exception):  # Pydantic ValidationError  # noqa: B017
            MoneyInvoiceLineItem.create_from_values(
                description="Invalid", quantity=0, unit_price_amount="10.00"
            )

    def test_line_item_tax_rate_validation(self):
        """Test tax rate must be between 0 and 1."""
        # Valid tax rates
        item1 = MoneyInvoiceLineItem.create_from_values(
            description="Item", quantity=1, unit_price_amount="100", tax_rate="0"
        )
        assert item1.tax_rate == Decimal("0")

        item2 = MoneyInvoiceLineItem.create_from_values(
            description="Item", quantity=1, unit_price_amount="100", tax_rate="1"
        )
        assert item2.tax_rate == Decimal("1")

        # Invalid tax rates
        with pytest.raises(Exception):  # noqa: B017
            MoneyInvoiceLineItem.create_from_values(
                description="Item", quantity=1, unit_price_amount="100", tax_rate="-0.1"
            )

        with pytest.raises(Exception):  # noqa: B017
            MoneyInvoiceLineItem.create_from_values(
                description="Item", quantity=1, unit_price_amount="100", tax_rate="1.1"
            )

    def test_line_item_with_optional_references(self):
        """Test line item with product and subscription references."""
        item = MoneyInvoiceLineItem.create_from_values(
            description="Subscription Fee",
            quantity=1,
            unit_price_amount="29.99",
            currency="USD",
            product_id="prod_123",
            subscription_id="sub_456",
        )

        assert item.product_id == "prod_123"
        assert item.subscription_id == "sub_456"

    def test_line_item_with_extra_data(self):
        """Test line item with extra metadata."""
        item = MoneyInvoiceLineItem.create_from_values(
            description="Item",
            quantity=1,
            unit_price_amount="10",
            extra_data={"custom_field": "value", "another": 123},
        )

        assert item.extra_data["custom_field"] == "value"
        assert item.extra_data["another"] == 123


@pytest.mark.unit
class TestMoneyInvoice:
    """Test MoneyInvoice model."""

    def test_invoice_creation_minimal(self):
        """Test creating invoice with minimal required fields."""
        zero_money = MoneyField.from_money(create_money(0, "USD"))

        invoice = MoneyInvoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="customer@example.com",
            subtotal=zero_money,
            tax_amount=zero_money,
            discount_amount=zero_money,
            total_amount=zero_money,
            remaining_balance=zero_money,
        )

        assert invoice.tenant_id == "tenant_1"
        assert invoice.customer_id == "cust_123"
        assert invoice.billing_email == "customer@example.com"
        assert invoice.currency == "USD"  # Default
        assert invoice.status == "draft"  # Default

    def test_invoice_currency_validation_valid(self):
        """Test valid currency codes."""
        valid_currencies = ["USD", "EUR", "GBP"]

        for currency in valid_currencies:
            zero_money = MoneyField.from_money(create_money(0, currency))
            invoice = MoneyInvoice(
                tenant_id="tenant_1",
                customer_id="cust_123",
                billing_email="test@example.com",
                currency=currency.lower(),  # Test lowercase conversion
                subtotal=zero_money,
                tax_amount=zero_money,
                discount_amount=zero_money,
                total_amount=zero_money,
                remaining_balance=zero_money,
            )
            assert invoice.currency == currency.upper()

    def test_invoice_currency_validation_invalid(self):
        """Test invalid currency code raises error."""
        with pytest.raises(Exception):  # ValueError  # noqa: B017
            zero_money = MoneyField.from_money(create_money(0, "USD"))
            MoneyInvoice(
                tenant_id="tenant_1",
                customer_id="cust_123",
                billing_email="test@example.com",
                currency="INVALID",
                subtotal=zero_money,
                tax_amount=zero_money,
                discount_amount=zero_money,
                total_amount=zero_money,
                remaining_balance=zero_money,
            )

    def test_invoice_create_invoice_no_line_items(self):
        """Test creating invoice with no line items."""
        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[],
        )

        assert len(invoice.line_items) == 0
        assert invoice.subtotal.amount == "0"
        assert invoice.tax_amount.amount == "0"
        assert invoice.total_amount.amount == "0"

    def test_invoice_create_invoice_with_line_items(self):
        """Test creating invoice with line items."""
        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[
                {
                    "description": "Product A",
                    "quantity": 2,
                    "unit_price": "50.00",
                    "tax_rate": 0.1,
                },
                {
                    "description": "Product B",
                    "quantity": 1,
                    "unit_price": "30.00",
                },
            ],
        )

        assert len(invoice.line_items) == 2
        # Product A: 2 * 50 = 100, tax 10% = 10, total = 110
        # Product B: 1 * 30 = 30, no tax, total = 30
        # Grand total: 140
        assert invoice.total_amount.amount == "140.00"

    def test_invoice_calculate_totals(self):
        """Test calculate_totals method."""
        # Create invoice with line items manually
        item1 = MoneyInvoiceLineItem.create_from_values(
            description="Item 1", quantity=1, unit_price_amount="100", tax_rate="0.10"
        )

        zero_money = MoneyField.from_money(create_money(0, "USD"))
        invoice = MoneyInvoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[item1],
            subtotal=zero_money,
            tax_amount=zero_money,
            discount_amount=zero_money,
            total_amount=zero_money,
            remaining_balance=zero_money,
        )

        # Manually recalculate
        invoice.calculate_totals()

        assert invoice.tax_amount.amount == "10.00"
        assert invoice.total_amount.amount == "110.00"

    def test_invoice_calculate_totals_with_discount_and_tax(self):
        """Discounted invoices should apply tax after discounts."""
        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[
                {
                    "description": "Discounted Item",
                    "quantity": 1,
                    "unit_price": "100.00",
                    "tax_rate": Decimal("0.10"),
                    "discount_percentage": Decimal("0.20"),
                }
            ],
        )

        assert invoice.discount_amount.amount == "20.00"
        assert invoice.tax_amount.amount == "8.00"
        assert invoice.subtotal.amount == "80.00"
        assert invoice.total_amount.amount == "88.00"
        assert invoice.remaining_balance.amount == "88.00"

    def test_invoice_net_amount_due_no_credits(self):
        """Test net_amount_due computed field without credits."""
        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[{"description": "Item", "quantity": 1, "unit_price": "100"}],
        )

        net = invoice.net_amount_due
        assert net.amount == "100.00"

    def test_invoice_net_amount_due_with_credits(self):
        """Test net_amount_due with credits applied."""
        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[{"description": "Item", "quantity": 1, "unit_price": "100"}],
        )

        # Apply $30 credit
        invoice.total_credits_applied = MoneyField.from_money(Money("30", "USD"))

        net = invoice.net_amount_due
        assert net.amount == "70.00"  # 100 - 30

    def test_invoice_net_amount_due_credits_exceed_total(self):
        """Test net_amount_due when credits exceed total (should be 0)."""
        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[{"description": "Item", "quantity": 1, "unit_price": "100"}],
        )

        # Apply $150 credit (more than total)
        invoice.total_credits_applied = MoneyField.from_money(Money("150", "USD"))

        net = invoice.net_amount_due
        assert net.amount == "0"  # Can't be negative

    def test_invoice_remaining_balance_respects_credits(self):
        """Remaining balance should subtract credits when recalculated."""
        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[
                {
                    "description": "Discounted Item",
                    "quantity": 1,
                    "unit_price": "100.00",
                    "tax_rate": Decimal("0.10"),
                    "discount_percentage": Decimal("0.20"),
                }
            ],
        )

        invoice.total_credits_applied = MoneyField.from_money(Money("30.00", "USD"))
        invoice.calculate_totals()

        assert invoice.remaining_balance.amount == "58.00"
        assert invoice.net_amount_due.amount == "58.00"

    def test_invoice_format_total(self):
        """Test format_total method."""
        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[{"description": "Item", "quantity": 1, "unit_price": "1234.56"}],
        )

        formatted = invoice.format_total(locale="en_US")
        assert "1234.56" in formatted or "1,234.56" in formatted

    def test_invoice_format_remaining_balance(self):
        """Test format_remaining_balance method."""
        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[{"description": "Item", "quantity": 1, "unit_price": "500"}],
        )

        formatted = invoice.format_remaining_balance(locale="en_US")
        assert "500" in formatted

    def test_invoice_with_dates(self):
        """Test invoice with issue and due dates."""
        now = datetime.now(UTC)
        due = now + timedelta(days=30)

        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[],
            issue_date=now,
            due_date=due,
        )

        assert invoice.issue_date == now
        assert invoice.due_date == due

    def test_invoice_with_notes(self):
        """Test invoice with notes."""
        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[],
            notes="Customer notes",
            internal_notes="Internal notes",
        )

        assert invoice.notes == "Customer notes"
        assert invoice.internal_notes == "Internal notes"

    def test_invoice_with_subscription_reference(self):
        """Test invoice linked to subscription."""
        invoice = MoneyInvoice.create_invoice(
            tenant_id="tenant_1",
            customer_id="cust_123",
            billing_email="test@example.com",
            line_items=[],
            subscription_id="sub_789",
        )

        assert invoice.subscription_id == "sub_789"

    def test_invoice_extra_forbid(self):
        """Test extra fields are forbidden."""
        with pytest.raises(Exception):  # Pydantic ValidationError  # noqa: B017
            zero_money = MoneyField.from_money(create_money(0, "USD"))
            MoneyInvoice(
                tenant_id="tenant_1",
                customer_id="cust_123",
                billing_email="test@example.com",
                subtotal=zero_money,
                tax_amount=zero_money,
                discount_amount=zero_money,
                total_amount=zero_money,
                remaining_balance=zero_money,
                invalid_field="should_fail",  # Extra field
            )
