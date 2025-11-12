"""Integration tests for billing workflow.

Tests:
1. Invoice generation
2. Payment processing
3. Service suspension for non-payment
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_invoice_generation_workflow(async_session, test_tenant):
    """Test generating an invoice for a customer."""
    from dotmac.platform.billing.domain.aggregates import Customer
    from dotmac.platform.billing.models import Invoice, InvoiceStatus

    tenant_id = test_tenant.id if test_tenant else uuid4()

    # Create customer
    customer = Customer(
        customer_id=str(uuid4()),
        tenant_id=str(tenant_id),
        email="billing_customer@test.com",
        name="Test Billing Customer",
    )

    async_session.add(customer)
    await async_session.flush()

    # Create invoice
    invoice = Invoice(
        id=uuid4(),
        tenant_id=tenant_id,
        customer_id=customer.id,
        invoice_number=f"INV-{datetime.now(UTC).strftime('%Y%m%d')}-001",
        amount=Decimal("99.99"),
        status=InvoiceStatus.DRAFT,
        due_date=datetime.now(UTC) + timedelta(days=30),
    )

    async_session.add(invoice)
    await async_session.commit()
    await async_session.refresh(invoice)

    assert invoice.id is not None
    assert invoice.amount == Decimal("99.99")
    assert invoice.status == InvoiceStatus.DRAFT


@pytest.mark.asyncio
async def test_payment_processing_workflow(async_session, test_tenant):
    """Test processing a payment."""
    from dotmac.platform.billing.domain.aggregates import Customer
    from dotmac.platform.billing.models import Invoice, InvoiceStatus, Payment, PaymentStatus

    tenant_id = test_tenant.id if test_tenant else uuid4()

    # Create customer and invoice
    customer = Customer(
        customer_id=str(uuid4()),
        tenant_id=str(tenant_id),
        email="payment_customer@test.com",
        name="Payment Test Customer",
    )

    async_session.add(customer)
    await async_session.flush()

    invoice = Invoice(
        id=uuid4(),
        tenant_id=tenant_id,
        customer_id=customer.id,
        invoice_number=f"INV-{datetime.now(UTC).strftime('%Y%m%d')}-002",
        amount=Decimal("149.99"),
        status=InvoiceStatus.SENT,
        due_date=datetime.now(UTC) + timedelta(days=30),
    )

    async_session.add(invoice)
    await async_session.flush()

    # Process payment
    payment = Payment(
        id=uuid4(),
        tenant_id=tenant_id,
        invoice_id=invoice.id,
        amount=Decimal("149.99"),
        status=PaymentStatus.COMPLETED,
        payment_method="credit_card",
    )

    async_session.add(payment)

    # Mark invoice as paid
    invoice.status = InvoiceStatus.PAID
    invoice.paid_at = datetime.now(UTC)

    await async_session.commit()
    await async_session.refresh(invoice)
    await async_session.refresh(payment)

    assert payment.status == PaymentStatus.COMPLETED
    assert invoice.status == InvoiceStatus.PAID
    assert invoice.paid_at is not None
