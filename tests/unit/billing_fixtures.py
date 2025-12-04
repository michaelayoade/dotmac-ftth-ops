"""
Billing-specific unit test fixtures and stubs.

Provides lightweight fixtures for unit testing billing logic without database dependencies.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

import pytest
from moneyed import Currency, Money

# ============================================================================
# Money and Currency Test Helpers
# ============================================================================


pytestmark = pytest.mark.unit


try:
    from dotmac.platform.billing.invoicing.models import (
        InvoiceStatus as _InvoiceStatus,  # type: ignore
    )
except ImportError:

    class _InvoiceStatus(str, Enum):
        """Fallback InvoiceStatus enum for environments without billing models."""

        DRAFT = "draft"
        SENT = "sent"
        PAID = "paid"
        VOID = "void"


DEFAULT_INVOICE_STATUS = getattr(_InvoiceStatus, "DRAFT", "draft")
InvoiceStatus = _InvoiceStatus


def create_test_money(amount: Decimal | int | float = 100, currency: str = "USD") -> Money:
    """Create test Money instance with defaults."""
    if isinstance(amount, (int, float)):
        amount = Decimal(str(amount))
    return Money(amount=amount, currency=Currency(currency))


def create_test_invoice_item(**overrides):
    """Create test invoice item with sensible defaults."""
    defaults = {
        "id": uuid4(),
        "invoice_id": uuid4(),
        "description": "Test Service",
        "quantity": Decimal("1"),
        "unit_price": Decimal("100.00"),
        "amount": Decimal("100.00"),
        "tax_amount": Decimal("0.00"),
        "discount_amount": Decimal("0.00"),
        "created_at": datetime.now(UTC),
    }
    defaults.update(overrides)
    return type("InvoiceItem", (), defaults)()


def create_test_invoice(**overrides):
    """Create test invoice with sensible defaults."""
    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "customer_id": uuid4(),
        "invoice_number": f"INV-{uuid4().hex[:8].upper()}",
        "status": DEFAULT_INVOICE_STATUS,
        "subtotal": Decimal("100.00"),
        "tax_amount": Decimal("20.00"),
        "total_amount": Decimal("120.00"),
        "currency": "USD",
        "issue_date": datetime.now(UTC).date(),
        "due_date": (datetime.now(UTC) + timedelta(days=30)).date(),
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    defaults.update(overrides)

    # Return a simple object with attributes
    return type("Invoice", (), defaults)()


def create_test_subscription(**overrides):
    """Create test subscription with sensible defaults."""
    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "customer_id": uuid4(),
        "plan_id": uuid4(),
        "status": "active",
        "current_period_start": datetime.now(UTC),
        "current_period_end": datetime.now(UTC) + timedelta(days=30),
        "billing_cycle": "monthly",
        "amount": Decimal("50.00"),
        "currency": "USD",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    defaults.update(overrides)
    return type("Subscription", (), defaults)()


def create_test_payment(**overrides):
    """Create test payment with sensible defaults."""
    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "customer_id": uuid4(),
        "invoice_id": None,
        "amount": Decimal("100.00"),
        "currency": "USD",
        "status": "succeeded",
        "payment_method": "card",
        "provider": "stripe",
        "provider_payment_id": f"pay_{uuid4().hex[:24]}",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    defaults.update(overrides)
    return type("Payment", (), defaults)()


# ============================================================================
# Stub Repositories
# ============================================================================


class StubInvoiceRepository:
    """In-memory invoice repository for unit tests."""

    def __init__(self):
        self._invoices: dict[UUID, Any] = {}
        self._invoice_numbers: dict[str, UUID] = {}

    async def add(self, invoice):
        """Add invoice to store."""
        if not hasattr(invoice, "id") or invoice.id is None:
            invoice.id = uuid4()
        self._invoices[invoice.id] = invoice
        if hasattr(invoice, "invoice_number"):
            self._invoice_numbers[invoice.invoice_number] = invoice.id
        return invoice

    async def get(self, invoice_id: UUID):
        """Get invoice by ID."""
        return self._invoices.get(invoice_id)

    async def get_by_number(self, invoice_number: str, tenant_id: UUID):
        """Get invoice by number."""
        invoice_id = self._invoice_numbers.get(invoice_number)
        if invoice_id:
            invoice = self._invoices.get(invoice_id)
            if invoice and hasattr(invoice, "tenant_id") and invoice.tenant_id == tenant_id:
                return invoice
        return None

    async def list_by_customer(self, customer_id: UUID, tenant_id: UUID) -> list[Any]:
        """List invoices for a customer."""
        return [
            inv
            for inv in self._invoices.values()
            if inv.customer_id == customer_id and inv.tenant_id == tenant_id
        ]

    async def update(self, invoice):
        """Update invoice in store."""
        if invoice.id in self._invoices:
            self._invoices[invoice.id] = invoice
            return invoice
        return None

    def clear(self):
        """Clear all data."""
        self._invoices.clear()
        self._invoice_numbers.clear()


class StubPaymentRepository:
    """In-memory payment repository for unit tests."""

    def __init__(self):
        self._payments: dict[UUID, Any] = {}

    async def add(self, payment):
        """Add payment to store."""
        if not hasattr(payment, "id") or payment.id is None:
            payment.id = uuid4()
        self._payments[payment.id] = payment
        return payment

    async def get(self, payment_id: UUID):
        """Get payment by ID."""
        return self._payments.get(payment_id)

    async def list_by_invoice(self, invoice_id: UUID) -> list[Any]:
        """List payments for an invoice."""
        return [pay for pay in self._payments.values() if pay.invoice_id == invoice_id]

    async def list_by_customer(self, customer_id: UUID, tenant_id: UUID) -> list[Any]:
        """List payments for a customer."""
        return [
            pay
            for pay in self._payments.values()
            if pay.customer_id == customer_id and pay.tenant_id == tenant_id
        ]

    def clear(self):
        """Clear all data."""
        self._payments.clear()


class StubSubscriptionRepository:
    """In-memory subscription repository for unit tests."""

    def __init__(self):
        self._subscriptions: dict[UUID, Any] = {}

    async def add(self, subscription):
        """Add subscription to store."""
        if not hasattr(subscription, "id") or subscription.id is None:
            subscription.id = uuid4()
        self._subscriptions[subscription.id] = subscription
        return subscription

    async def get(self, subscription_id: UUID):
        """Get subscription by ID."""
        return self._subscriptions.get(subscription_id)

    async def get_by_customer(self, customer_id: UUID, tenant_id: UUID):
        """Get active subscription for customer."""
        for sub in self._subscriptions.values():
            if (
                sub.customer_id == customer_id
                and sub.tenant_id == tenant_id
                and sub.status == "active"
            ):
                return sub
        return None

    async def list_active(self, tenant_id: UUID) -> list[Any]:
        """List active subscriptions for tenant."""
        return [
            sub
            for sub in self._subscriptions.values()
            if sub.tenant_id == tenant_id and sub.status == "active"
        ]

    def clear(self):
        """Clear all data."""
        self._subscriptions.clear()


# ============================================================================
# Mock Services
# ============================================================================


class MockPaymentProvider:
    """Mock payment provider for unit tests."""

    def __init__(self):
        self.charges = []
        self.refunds = []
        self.should_succeed = True
        self.failure_reason = None

    async def create_charge(self, amount: Decimal, currency: str, **kwargs):
        """Mock charge creation."""
        charge = {
            "id": f"ch_{uuid4().hex[:24]}",
            "amount": amount,
            "currency": currency,
            "status": "succeeded" if self.should_succeed else "failed",
            "failure_message": self.failure_reason if not self.should_succeed else None,
            **kwargs,
        }
        self.charges.append(charge)
        return charge

    async def create_refund(self, charge_id: str, amount: Decimal, **kwargs):
        """Mock refund creation."""
        refund = {
            "id": f"re_{uuid4().hex[:24]}",
            "charge_id": charge_id,
            "amount": amount,
            "status": "succeeded" if self.should_succeed else "failed",
            **kwargs,
        }
        self.refunds.append(refund)
        return refund

    def simulate_failure(self, reason: str = "card_declined"):
        """Configure provider to simulate failures."""
        self.should_succeed = False
        self.failure_reason = reason

    def simulate_success(self):
        """Configure provider to simulate success."""
        self.should_succeed = True
        self.failure_reason = None


class MockTaxCalculator:
    """Mock tax calculator for unit tests."""

    def __init__(self, default_rate: Decimal = Decimal("0")):
        self.default_rate = default_rate
        self.calculations = []

    def calculate_tax(self, amount: Decimal, jurisdiction: str = None, **kwargs) -> Decimal:
        """Mock tax calculation."""
        tax_amount = amount * (self.default_rate / Decimal("100"))
        self.calculations.append(
            {
                "amount": amount,
                "jurisdiction": jurisdiction,
                "tax_amount": tax_amount,
                "rate": self.default_rate,
            }
        )
        return tax_amount

    def set_rate(self, rate: Decimal):
        """Set the tax rate for subsequent calculations."""
        self.default_rate = rate


# ============================================================================
# Pytest Fixtures
# ============================================================================


@pytest.fixture
def stub_invoice_repository():
    """Provide stub invoice repository."""
    return StubInvoiceRepository()


@pytest.fixture
def stub_payment_repository():
    """Provide stub payment repository."""
    return StubPaymentRepository()


@pytest.fixture
def stub_subscription_repository():
    """Provide stub subscription repository."""
    return StubSubscriptionRepository()


@pytest.fixture
def mock_payment_provider():
    """Provide mock payment provider."""
    return MockPaymentProvider()


@pytest.fixture
def mock_tax_calculator():
    """Provide mock tax calculator with 20% default rate."""
    return MockTaxCalculator(default_rate=Decimal("20"))


@pytest.fixture
def test_invoice():
    """Provide a test invoice instance."""
    return create_test_invoice()


@pytest.fixture
def test_subscription():
    """Provide a test subscription instance."""
    return create_test_subscription()


@pytest.fixture
def test_payment():
    """Provide a test payment instance."""
    return create_test_payment()


# ============================================================================
# Validation Helpers
# ============================================================================


def assert_money_equal(actual: Money, expected: Money, msg: str = ""):
    """Assert two Money instances are equal."""
    assert actual.amount == expected.amount, f"{msg}: amounts differ"
    assert actual.currency == expected.currency, f"{msg}: currencies differ"


def assert_decimal_equal(actual: Decimal, expected: Decimal, places: int = 2, msg: str = ""):
    """Assert two Decimal values are equal within precision."""
    actual_rounded = actual.quantize(Decimal(10) ** -places)
    expected_rounded = expected.quantize(Decimal(10) ** -places)
    assert actual_rounded == expected_rounded, f"{msg}: {actual} != {expected}"
