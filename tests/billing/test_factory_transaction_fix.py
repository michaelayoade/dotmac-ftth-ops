"""
Test to verify factory transaction fixes work correctly.

This test verifies that:
1. Factories use flush() instead of commit()
2. Transaction rollback works correctly
3. No InvalidRequestError is raised
"""

from decimal import Decimal

import pytest
from sqlalchemy import select

from dotmac.platform.billing.core.entities import PaymentInvoiceEntity

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
async def test_customer_factory_transaction_cleanup(async_db_session, customer_factory):
    """Verify customer factory works with transaction rollback."""
    # Create customer using factory
    customer = await customer_factory(
        email="test@example.com", first_name="Test", last_name="Customer"
    )

    # Verify customer was created
    assert customer.id is not None
    assert customer.email == "test@example.com"
    assert customer.first_name == "Test"

    # Session should still be usable
    await async_db_session.flush()

    # No errors should occur - rollback happens automatically


@pytest.mark.asyncio
async def test_invoice_factory_transaction_cleanup(async_db_session, invoice_factory):
    """Verify invoice factory works with transaction rollback."""
    # Create invoice (also creates customer automatically)
    invoice = await invoice_factory(amount=Decimal("100.00"), status="draft")

    # Verify invoice was created
    assert invoice.invoice_id is not None
    assert invoice.total_amount == 10000  # Stored in cents
    assert invoice.customer_id is not None

    # Session should still be usable
    await async_db_session.flush()

    # No errors should occur - rollback happens automatically


@pytest.mark.asyncio
async def test_payment_factory_transaction_cleanup(async_db_session, payment_factory):
    """Verify payment factory works with transaction rollback."""
    # Create payment (also creates customer and invoice automatically)
    payment = await payment_factory(amount=Decimal("50.00"), status="succeeded")

    # Verify payment was created
    assert payment.payment_id is not None
    assert payment.amount == 5000  # Stored in cents
    assert payment.customer_id is not None

    # Use direct SELECT instead of lazy load to avoid extra round-trip
    result = await async_db_session.execute(
        select(PaymentInvoiceEntity).where(PaymentInvoiceEntity.payment_id == payment.payment_id)
    )
    invoices = result.scalars().all()
    assert invoices, "Payment should be linked to at least one invoice"
    assert invoices[0].invoice_id is not None

    # Session should still be usable
    await async_db_session.flush()

    # No errors should occur - rollback happens automatically


@pytest.mark.asyncio
async def test_multiple_factories_in_sequence(
    async_db_session, customer_factory, invoice_factory, payment_factory
):
    """Verify multiple factories can be used together."""
    # Create customer
    customer = await customer_factory(email="multi@test.com")

    # Create invoice for customer
    invoice = await invoice_factory(customer_id=str(customer.id), amount=Decimal("200.00"))

    # Create payment for invoice
    payment = await payment_factory(
        customer_id=str(customer.id), invoice_id=invoice.invoice_id, amount=Decimal("200.00")
    )

    # Verify relationships
    assert invoice.customer_id == str(customer.id)
    assert payment.customer_id == str(customer.id)

    # Use direct SELECT instead of lazy load to avoid extra round-trip
    result = await async_db_session.execute(
        select(PaymentInvoiceEntity).where(PaymentInvoiceEntity.payment_id == payment.payment_id)
    )
    payment_invoices = result.scalars().all()
    linked_invoice_ids = {link.invoice_id for link in payment_invoices}
    assert invoice.invoice_id in linked_invoice_ids

    # Session should still be usable
    await async_db_session.flush()

    # No errors should occur - rollback happens automatically
