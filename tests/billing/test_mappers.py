"""Tests for billing mappers module."""

from datetime import datetime, timedelta

import pytest
from pydantic import ValidationError

from dotmac.platform.billing.mappers import (
    InvoiceImportSchema,
    SubscriptionImportSchema,
)


@pytest.mark.unit
class TestInvoiceImportSchema:
    """Test InvoiceImportSchema validation."""

    def test_valid_invoice_import(self):
        """Test valid invoice import data."""
        data = {"customer_id": "cust_123", "amount": 100.50, "currency": "usd", "status": "PAID"}

        schema = InvoiceImportSchema(**data)
        assert schema.customer_id == "cust_123"
        assert schema.amount == 100.50
        assert schema.currency == "USD"  # Automatically uppercased
        assert schema.status == "paid"  # Automatically lowercased

    def test_invoice_currency_uppercase_conversion(self):
        """Test currency is automatically converted to uppercase."""
        schema = InvoiceImportSchema(customer_id="cust_123", amount=100.0, currency="eur")
        assert schema.currency == "EUR"

    def test_invoice_status_lowercase_conversion(self):
        """Test status is automatically converted to lowercase."""
        schema = InvoiceImportSchema(customer_id="cust_123", amount=100.0, status="DRAFT")
        assert schema.status == "draft"

    def test_invoice_status_validation_success(self):
        """Test valid status values."""
        valid_statuses = ["draft", "sent", "paid", "overdue", "canceled", "refunded"]

        for status in valid_statuses:
            schema = InvoiceImportSchema(customer_id="cust_123", amount=100.0, status=status)
            assert schema.status == status.lower()

    def test_invoice_status_validation_failure(self):
        """Test invalid status value raises error."""
        with pytest.raises(ValidationError) as exc_info:
            InvoiceImportSchema(customer_id="cust_123", amount=100.0, status="invalid_status")

        assert "Invalid status" in str(exc_info.value)

    def test_invoice_with_all_fields(self):
        """Test invoice with all optional fields."""
        now = datetime.now()
        data = {
            "customer_id": "cust_123",
            "invoice_number": "INV-2025-001",
            "amount": 1500.75,
            "currency": "USD",
            "invoice_date": now,
            "due_date": now + timedelta(days=30),
            "payment_date": now + timedelta(days=15),
            "status": "paid",
            "description": "Monthly subscription",
            "payment_method": "credit_card",
            "payment_reference": "ch_1234567890",
            "tax_rate": 8.5,
            "tax_amount": 127.56,
            "discount_rate": 10.0,
            "discount_amount": 150.08,
            "line_items": [
                {"description": "Item 1", "amount": 500.0},
                {"description": "Item 2", "amount": 1000.75},
            ],
            "external_id": "ext_123",
            "source_system": "legacy_billing",
            "import_batch_id": "batch_001",
        }

        schema = InvoiceImportSchema(**data)
        assert schema.invoice_number == "INV-2025-001"
        assert schema.tax_rate == 8.5
        assert schema.discount_amount == 150.08
        assert len(schema.line_items) == 2
        assert schema.external_id == "ext_123"

    def test_invoice_defaults(self):
        """Test invoice import with default values."""
        schema = InvoiceImportSchema(customer_id="cust_123", amount=100.0)

        assert schema.currency == "USD"
        assert schema.status == "draft"
        assert schema.tax_rate == 0
        assert schema.tax_amount == 0
        assert schema.discount_rate == 0
        assert schema.discount_amount == 0
        assert schema.line_items == []

    def test_invoice_amount_validation(self):
        """Test amount must be positive."""
        with pytest.raises(ValidationError):
            InvoiceImportSchema(customer_id="cust_123", amount=-100.0)

        with pytest.raises(ValidationError):
            InvoiceImportSchema(customer_id="cust_123", amount=0)

    def test_invoice_tax_rate_validation(self):
        """Test tax rate must be between 0 and 100."""
        # Valid tax rates
        schema1 = InvoiceImportSchema(customer_id="cust_123", amount=100.0, tax_rate=0)
        assert schema1.tax_rate == 0

        schema2 = InvoiceImportSchema(customer_id="cust_123", amount=100.0, tax_rate=100)
        assert schema2.tax_rate == 100

        # Invalid tax rates
        with pytest.raises(ValidationError):
            InvoiceImportSchema(customer_id="cust_123", amount=100.0, tax_rate=-1)

        with pytest.raises(ValidationError):
            InvoiceImportSchema(customer_id="cust_123", amount=100.0, tax_rate=101)

    def test_invoice_discount_rate_validation(self):
        """Test discount rate must be between 0 and 100."""
        # Valid discount rates
        schema1 = InvoiceImportSchema(customer_id="cust_123", amount=100.0, discount_rate=0)
        assert schema1.discount_rate == 0

        schema2 = InvoiceImportSchema(customer_id="cust_123", amount=100.0, discount_rate=100)
        assert schema2.discount_rate == 100

        # Invalid discount rates
        with pytest.raises(ValidationError):
            InvoiceImportSchema(customer_id="cust_123", amount=100.0, discount_rate=-1)

        with pytest.raises(ValidationError):
            InvoiceImportSchema(customer_id="cust_123", amount=100.0, discount_rate=101)


@pytest.mark.unit
class TestSubscriptionImportSchema:
    """Test SubscriptionImportSchema validation."""

    def test_valid_subscription_import(self):
        """Test valid subscription import data."""
        data = {
            "customer_id": "cust_123",
            "plan_id": "plan_pro",
            "price": 29.99,
            "currency": "USD",
            "status": "active",
        }

        schema = SubscriptionImportSchema(**data)
        assert schema.customer_id == "cust_123"
        assert schema.plan_id == "plan_pro"
        assert schema.price == 29.99
        assert schema.currency == "USD"
        assert schema.status == "active"

    def test_subscription_currency(self):
        """Test currency field."""
        schema = SubscriptionImportSchema(
            customer_id="cust_123", plan_id="plan_pro", price=29.99, currency="EUR"
        )
        assert schema.currency == "EUR"

    def test_subscription_status_validation_success(self):
        """Test valid subscription statuses."""
        valid_statuses = ["trial", "active", "past_due", "canceled", "ended"]

        for status in valid_statuses:
            schema = SubscriptionImportSchema(
                customer_id="cust_123", plan_id="plan_pro", price=29.99, status=status
            )
            assert schema.status == status.lower()

    def test_subscription_status_accepts_any_string(self):
        """Test subscription status accepts any string (no validation)."""
        # Note: SubscriptionImportSchema doesn't validate status values
        schema = SubscriptionImportSchema(
            customer_id="cust_123", plan_id="plan_pro", price=29.99, status="custom_status"
        )
        assert schema.status == "custom_status"

    def test_subscription_billing_cycle_validation(self):
        """Test valid billing cycles."""
        valid_cycles = ["monthly", "quarterly", "annual"]

        for cycle in valid_cycles:
            schema = SubscriptionImportSchema(
                customer_id="cust_123", plan_id="plan_pro", price=29.99, billing_cycle=cycle
            )
            assert schema.billing_cycle == cycle

    def test_subscription_with_dates(self):
        """Test subscription with date fields."""
        now = datetime.now()
        schema = SubscriptionImportSchema(
            customer_id="cust_123",
            plan_id="plan_pro",
            price=29.99,
            start_date=now,
            trial_end_date=now + timedelta(days=14),
            next_billing_date=now + timedelta(days=30),
            canceled_at=None,
        )

        assert schema.start_date == now
        assert schema.trial_end_date == now + timedelta(days=14)
        assert schema.canceled_at is None

    def test_subscription_cancel_at_period_end(self):
        """Test cancel_at_period_end flag."""
        schema1 = SubscriptionImportSchema(
            customer_id="cust_123", plan_id="plan_pro", price=29.99, cancel_at_period_end=True
        )
        assert schema1.cancel_at_period_end is True

        schema2 = SubscriptionImportSchema(
            customer_id="cust_123", plan_id="plan_pro", price=29.99, cancel_at_period_end=False
        )
        assert schema2.cancel_at_period_end is False

    def test_subscription_defaults(self):
        """Test subscription defaults."""
        schema = SubscriptionImportSchema(customer_id="cust_123", plan_id="plan_pro", price=29.99)

        assert schema.currency == "USD"
        assert schema.status == "active"
        assert schema.billing_cycle == "monthly"
        assert schema.cancel_at_period_end is False
        assert schema.custom_price is None
        assert schema.external_id is None

    def test_subscription_price_validation(self):
        """Test price must be positive."""
        with pytest.raises(ValidationError):
            SubscriptionImportSchema(customer_id="cust_123", plan_id="plan_pro", price=-29.99)

        with pytest.raises(ValidationError):
            SubscriptionImportSchema(customer_id="cust_123", plan_id="plan_pro", price=0)

    def test_subscription_custom_price_validation(self):
        """Test custom_price can be zero or positive."""
        # Zero custom price is allowed
        schema1 = SubscriptionImportSchema(
            customer_id="cust_123", plan_id="plan_pro", price=29.99, custom_price=0
        )
        assert schema1.custom_price == 0

        # Positive custom price
        schema2 = SubscriptionImportSchema(
            customer_id="cust_123", plan_id="plan_pro", price=29.99, custom_price=19.99
        )
        assert schema2.custom_price == 19.99

        # Negative custom price not allowed
        with pytest.raises(ValidationError):
            SubscriptionImportSchema(
                customer_id="cust_123", plan_id="plan_pro", price=29.99, custom_price=-10
            )

    def test_subscription_with_external_references(self):
        """Test subscription with external references."""
        schema = SubscriptionImportSchema(
            customer_id="cust_123",
            plan_id="plan_pro",
            price=29.99,
            external_id="ext_sub_789",
            payment_method_id="pm_card_123",
        )

        assert schema.external_id == "ext_sub_789"
        assert schema.payment_method_id == "pm_card_123"
