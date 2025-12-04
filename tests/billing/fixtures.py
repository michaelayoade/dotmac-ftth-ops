"""
Shared fixtures for billing tests.

This module provides:
- Mock payment providers (Stripe, PayPal)
- Seeded invoice and payment data
- Common test entities (customers, payment methods)
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import (
    InvoiceEntity,
    PaymentEntity,
    PaymentMethodEntity,
)
from dotmac.platform.billing.core.enums import (
    InvoiceStatus,
    PaymentMethodStatus,
    PaymentMethodType,
    PaymentStatus,
)
from dotmac.platform.billing.models import Invoice, Payment, PaymentMethod

# =============================================================================
# Payment Provider Mocks
# =============================================================================


pytestmark = pytest.mark.integration


@pytest.fixture
def mock_stripe_provider():
    """Mock Stripe payment provider that returns success."""
    provider = AsyncMock()

    # Default success response
    provider.charge_payment_method = AsyncMock(
        return_value=MagicMock(
            success=True,
            provider_payment_id="pi_test_123",
            provider_fee=30,  # $0.30 fee
            error_message=None,
        )
    )

    provider.create_payment_method = AsyncMock(
        return_value=MagicMock(
            success=True,
            provider_payment_method_id="pm_test_123",
            last_four="4242",
            brand="visa",
            expiry_month=12,
            expiry_year=2025,
        )
    )

    provider.process_refund = AsyncMock(
        return_value=MagicMock(
            success=True,
            provider_refund_id="re_test_123",
            amount_refunded=1000,
        )
    )

    return provider


@pytest.fixture
def mock_stripe_provider_failure():
    """Mock Stripe payment provider that returns failure."""
    provider = AsyncMock()

    provider.charge_payment_method = AsyncMock(
        return_value=MagicMock(
            success=False,
            provider_payment_id=None,
            provider_fee=0,
            error_message="Your card was declined.",
        )
    )

    return provider


@pytest.fixture
def mock_paypal_provider():
    """Mock PayPal payment provider that returns success."""
    provider = AsyncMock()

    provider.charge_payment_method = AsyncMock(
        return_value=MagicMock(
            success=True,
            provider_payment_id="PAYID-TEST123",
            provider_fee=50,  # $0.50 fee
            error_message=None,
        )
    )

    provider.create_payment_method = AsyncMock(
        return_value=MagicMock(
            success=True,
            provider_payment_method_id="BA-TEST123",
            email="test@example.com",
        )
    )

    provider.process_refund = AsyncMock(
        return_value=MagicMock(
            success=True,
            provider_refund_id="REF-TEST123",
            amount_refunded=1000,
        )
    )

    return provider


@pytest.fixture
def mock_payment_providers(mock_stripe_provider, mock_paypal_provider):
    """Dict of all mock payment providers."""
    return {
        "stripe": mock_stripe_provider,
        "paypal": mock_paypal_provider,
    }


# =============================================================================
# Test Tenant and Customer
# =============================================================================


@pytest.fixture
def test_tenant_id():
    """Test tenant ID."""
    return str(uuid4())


@pytest.fixture
def test_customer_id():
    """Test customer ID."""
    return str(uuid4())


# =============================================================================
# Payment Method Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def active_card_payment_method(
    async_db_session: AsyncSession, test_tenant_id, test_customer_id
):
    """Create an active card payment method in the database."""
    payment_method = PaymentMethod(
        payment_method_id=str(uuid4()),
        tenant_id=test_tenant_id,
        customer_id=test_customer_id,
        type=PaymentMethodType.CARD,
        status=PaymentMethodStatus.ACTIVE,
        provider="stripe",
        provider_payment_method_id=f"pm_test_{uuid4().hex[:8]}",
        last_four="4242",
        brand="visa",
        expiry_month=12,
        expiry_year=2025,
        is_default=True,
    )
    async_db_session.add(payment_method)
    await async_db_session.commit()
    await async_db_session.refresh(payment_method)
    return payment_method


@pytest.fixture
def payment_method_entity(test_tenant_id, test_customer_id):
    """Payment method entity for testing (not in database)."""
    return PaymentMethodEntity(
        payment_method_id=str(uuid4()),
        tenant_id=test_tenant_id,
        customer_id=test_customer_id,
        type=PaymentMethodType.CARD,
        status=PaymentMethodStatus.ACTIVE,
        provider="stripe",
        display_name="Visa •••• 4242",
        provider_payment_method_id=f"pm_test_{uuid4().hex[:8]}",
        last_four="4242",
        brand="visa",
        expiry_month=12,
        expiry_year=2025,
    )


# =============================================================================
# Invoice Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def sample_draft_invoice(async_db_session: AsyncSession, test_tenant_id, test_customer_id):
    """Create a draft invoice in the database."""
    invoice = Invoice(
        invoice_id=str(uuid4()),
        tenant_id=test_tenant_id,
        invoice_number=f"INV-TEST-{uuid4().hex[:6].upper()}",
        customer_id=test_customer_id,
        billing_email=f"{test_customer_id}@example.com",
        billing_address={"street": "123 Test St", "city": "Test City", "country": "US"},
        issue_date=datetime.now(UTC),
        due_date=datetime.now(UTC) + timedelta(days=30),
        currency="USD",
        subtotal=10000,  # $100.00 in cents
        tax_amount=1000,  # $10.00
        discount_amount=0,
        total_amount=11000,  # $110.00
        remaining_balance=11000,
        total_credits_applied=0,
        credit_applications=[],
        status=InvoiceStatus.DRAFT,
        payment_status=PaymentStatus.PENDING,
        created_by="test-system",
    )
    async_db_session.add(invoice)
    await async_db_session.commit()
    await async_db_session.refresh(invoice)
    return invoice


@pytest_asyncio.fixture
async def sample_open_invoice(async_db_session: AsyncSession, test_tenant_id, test_customer_id):
    """Create an open (finalized) invoice in the database."""
    invoice = Invoice(
        invoice_id=str(uuid4()),
        tenant_id=test_tenant_id,
        invoice_number=f"INV-TEST-{uuid4().hex[:6].upper()}",
        customer_id=test_customer_id,
        billing_email=f"{test_customer_id}@example.com",
        billing_address={"street": "123 Test St", "city": "Test City", "country": "US"},
        issue_date=datetime.now(UTC),
        due_date=datetime.now(UTC) + timedelta(days=30),
        currency="USD",
        subtotal=25000,  # $250.00
        tax_amount=2500,  # $25.00
        discount_amount=0,
        total_amount=27500,  # $275.00
        remaining_balance=27500,
        total_credits_applied=0,
        credit_applications=[],
        status=InvoiceStatus.OPEN,
        payment_status=PaymentStatus.PENDING,
        created_by="test-system",
    )
    async_db_session.add(invoice)
    await async_db_session.commit()
    await async_db_session.refresh(invoice)
    return invoice


@pytest_asyncio.fixture
async def sample_paid_invoice(async_db_session: AsyncSession, test_tenant_id, test_customer_id):
    """Create a paid invoice in the database."""
    invoice = Invoice(
        invoice_id=str(uuid4()),
        tenant_id=test_tenant_id,
        invoice_number=f"INV-TEST-{uuid4().hex[:6].upper()}",
        customer_id=test_customer_id,
        billing_email=f"{test_customer_id}@example.com",
        billing_address={"street": "123 Test St", "city": "Test City", "country": "US"},
        issue_date=datetime.now(UTC) - timedelta(days=5),
        due_date=datetime.now(UTC) + timedelta(days=25),
        currency="USD",
        subtotal=50000,  # $500.00
        tax_amount=5000,  # $50.00
        discount_amount=0,
        total_amount=55000,  # $550.00
        remaining_balance=0,  # Fully paid
        total_credits_applied=0,
        credit_applications=[],
        status=InvoiceStatus.PAID,
        payment_status=PaymentStatus.SUCCEEDED,
        paid_at=datetime.now(UTC) - timedelta(days=3),
        created_by="test-system",
    )
    async_db_session.add(invoice)
    await async_db_session.commit()
    await async_db_session.refresh(invoice)
    return invoice


@pytest.fixture
def invoice_entity(test_tenant_id, test_customer_id):
    """Invoice entity for testing (not in database)."""
    return InvoiceEntity(
        invoice_id=str(uuid4()),
        tenant_id=test_tenant_id,
        invoice_number=f"INV-TEST-{uuid4().hex[:6].upper()}",
        customer_id=test_customer_id,
        billing_email=f"{test_customer_id}@example.com",
        billing_address={"street": "123 Test St"},
        issue_date=datetime.now(UTC),
        due_date=datetime.now(UTC) + timedelta(days=30),
        currency="USD",
        subtotal=10000,
        tax_amount=1000,
        discount_amount=0,
        total_amount=11000,
        remaining_balance=11000,
        total_credits_applied=0,
        credit_applications=[],
        status=InvoiceStatus.DRAFT,
        payment_status=PaymentStatus.PENDING,
    )


# =============================================================================
# Payment Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def sample_successful_payment(
    async_db_session: AsyncSession,
    test_tenant_id,
    test_customer_id,
    active_card_payment_method,
):
    """Create a successful payment in the database."""
    payment = Payment(
        payment_id=str(uuid4()),
        tenant_id=test_tenant_id,
        customer_id=test_customer_id,
        amount=10000,  # $100.00
        currency="USD",
        status=PaymentStatus.SUCCEEDED,
        payment_method_type=PaymentMethodType.CARD,
        payment_method_id=active_card_payment_method.payment_method_id,
        payment_method_details={
            "last_four": "4242",
            "brand": "visa",
        },
        provider="stripe",
        provider_payment_id="pi_test_123",
        provider_fee=30,
        retry_count=0,
        created_at=datetime.now(UTC),
    )
    async_db_session.add(payment)
    await async_db_session.commit()
    await async_db_session.refresh(payment)
    return payment


@pytest_asyncio.fixture
async def sample_failed_payment(
    async_db_session: AsyncSession,
    test_tenant_id,
    test_customer_id,
    active_card_payment_method,
):
    """Create a failed payment in the database."""
    payment = Payment(
        payment_id=str(uuid4()),
        tenant_id=test_tenant_id,
        customer_id=test_customer_id,
        amount=5000,  # $50.00
        currency="USD",
        status=PaymentStatus.FAILED,
        payment_method_type=PaymentMethodType.CARD,
        payment_method_id=active_card_payment_method.payment_method_id,
        payment_method_details={
            "last_four": "4242",
            "brand": "visa",
        },
        provider="stripe",
        provider_payment_id=None,
        provider_fee=0,
        failure_reason="Your card was declined.",
        retry_count=1,
        created_at=datetime.now(UTC),
    )
    async_db_session.add(payment)
    await async_db_session.commit()
    await async_db_session.refresh(payment)
    return payment


@pytest.fixture
def payment_entity(test_tenant_id, test_customer_id):
    """Payment entity for testing (not in database)."""
    return PaymentEntity(
        payment_id=str(uuid4()),
        tenant_id=test_tenant_id,
        customer_id=test_customer_id,
        amount=10000,
        currency="USD",
        status=PaymentStatus.SUCCEEDED,
        payment_method_type=PaymentMethodType.CARD,
        payment_method_details={"last_four": "4242", "brand": "visa"},
        provider="stripe",
        provider_payment_id="pi_test_123",
        retry_count=0,
        created_at=datetime.now(UTC),
        extra_data={},
    )


# =============================================================================
# Multi-entity Fixtures (Complete Test Scenarios)
# =============================================================================


@pytest_asyncio.fixture
async def complete_billing_scenario(
    async_db_session: AsyncSession,
    test_tenant_id,
    test_customer_id,
    active_card_payment_method,
    sample_open_invoice,
    sample_successful_payment,
):
    """
    Complete billing scenario with:
    - Active payment method
    - Open invoice
    - Successful payment
    """
    return {
        "tenant_id": test_tenant_id,
        "customer_id": test_customer_id,
        "payment_method": active_card_payment_method,
        "invoice": sample_open_invoice,
        "payment": sample_successful_payment,
    }


# =============================================================================
# Service Mocks
# =============================================================================


@pytest.fixture
def mock_event_bus():
    """Mock event bus for publishing events."""
    bus = AsyncMock()
    bus.publish = AsyncMock()
    return bus


@pytest.fixture
def mock_invoice_service():
    """Mock invoice service."""
    service = AsyncMock()
    service.create_invoice = AsyncMock()
    service.get_invoice = AsyncMock()
    service.mark_invoice_paid = AsyncMock()
    service.void_invoice = AsyncMock()
    return service


@pytest.fixture
def mock_payment_service():
    """Mock payment service."""
    service = AsyncMock()
    service.create_payment = AsyncMock()
    service.get_payment = AsyncMock()
    service.update_payment_status = AsyncMock()
    service.process_refund = AsyncMock()
    service.process_refund_notification = AsyncMock()
    return service
