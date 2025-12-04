"""
Test to verify factory regression fixes work correctly.

This test verifies:
1. invoice_factory correctly maps all status values
2. payment_factory creates invoice linkage via PaymentInvoiceEntity
"""

from decimal import Decimal

import pytest
from sqlalchemy import select

from dotmac.platform.billing.core.entities import PaymentInvoiceEntity

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
async def test_invoice_factory_status_draft(async_db_session, invoice_factory):
    """Verify invoice_factory handles 'draft' status."""
    from dotmac.platform.billing.core.enums import InvoiceStatus

    invoice = await invoice_factory(status="draft")
    assert invoice.status == InvoiceStatus.DRAFT


@pytest.mark.asyncio
async def test_invoice_factory_status_open(async_db_session, invoice_factory):
    """Verify invoice_factory handles 'open' status."""
    from dotmac.platform.billing.core.enums import InvoiceStatus

    invoice = await invoice_factory(status="open")
    assert invoice.status == InvoiceStatus.OPEN


@pytest.mark.asyncio
async def test_invoice_factory_status_paid(async_db_session, invoice_factory):
    """Verify invoice_factory handles 'paid' status."""
    from dotmac.platform.billing.core.enums import InvoiceStatus

    invoice = await invoice_factory(status="paid")
    assert invoice.status == InvoiceStatus.PAID


@pytest.mark.asyncio
async def test_invoice_factory_status_void(async_db_session, invoice_factory):
    """Verify invoice_factory handles 'void' status."""
    from dotmac.platform.billing.core.enums import InvoiceStatus

    invoice = await invoice_factory(status="void")
    assert invoice.status == InvoiceStatus.VOID


@pytest.mark.asyncio
async def test_invoice_factory_status_overdue(async_db_session, invoice_factory):
    """Verify invoice_factory handles 'overdue' status."""
    from dotmac.platform.billing.core.enums import InvoiceStatus

    invoice = await invoice_factory(status="overdue")
    assert invoice.status == InvoiceStatus.OVERDUE


@pytest.mark.asyncio
async def test_invoice_factory_status_partially_paid(async_db_session, invoice_factory):
    """Verify invoice_factory handles 'partially_paid' status."""
    from dotmac.platform.billing.core.enums import InvoiceStatus

    invoice = await invoice_factory(status="partially_paid")
    assert invoice.status == InvoiceStatus.PARTIALLY_PAID


@pytest.mark.asyncio
async def test_invoice_factory_status_enum(async_db_session, invoice_factory):
    """Verify invoice_factory accepts enum directly."""
    from dotmac.platform.billing.core.enums import InvoiceStatus

    invoice = await invoice_factory(status=InvoiceStatus.VOID)
    assert invoice.status == InvoiceStatus.VOID


@pytest.mark.asyncio
async def test_payment_factory_creates_invoice_if_not_provided(async_db_session, payment_factory):
    """Verify payment_factory creates invoice if not provided."""

    # Create payment without providing invoice_id
    payment = await payment_factory(amount=Decimal("100.00"))

    # Verify payment was created
    assert payment.payment_id is not None
    assert payment.amount == 10000  # In cents

    # Verify invoice was created (check via PaymentInvoiceEntity)
    from dotmac.platform.billing.core.entities import PaymentInvoiceEntity

    result = await async_db_session.execute(
        select(PaymentInvoiceEntity).where(PaymentInvoiceEntity.payment_id == payment.payment_id)
    )
    payment_invoice = result.scalar_one()

    # Verify linkage exists
    assert payment_invoice is not None
    assert payment_invoice.invoice_id is not None
    assert payment_invoice.amount_applied == 10000


@pytest.mark.asyncio
async def test_payment_factory_uses_provided_invoice(
    async_db_session, payment_factory, invoice_factory
):
    """Verify payment_factory uses provided invoice_id."""
    from dotmac.platform.billing.core.entities import PaymentInvoiceEntity

    # Create invoice first
    invoice = await invoice_factory(amount=Decimal("50.00"))

    # Create payment with specific invoice_id
    payment = await payment_factory(invoice_id=invoice.invoice_id, amount=Decimal("50.00"))

    # Verify payment was created
    assert payment.payment_id is not None

    # Verify linkage to specific invoice
    result = await async_db_session.execute(
        select(PaymentInvoiceEntity).where(PaymentInvoiceEntity.payment_id == payment.payment_id)
    )
    payment_invoice = result.scalar_one()

    assert payment_invoice.invoice_id == invoice.invoice_id
    assert payment_invoice.amount_applied == 5000  # 50 dollars in cents


@pytest.mark.asyncio
async def test_payment_factory_creates_invoice_with_same_customer(
    async_db_session, payment_factory, customer_factory
):
    """Verify payment_factory creates invoice with same customer."""
    from dotmac.platform.billing.core.entities import InvoiceEntity, PaymentInvoiceEntity

    # Create customer
    customer = await customer_factory()

    # Create payment with specific customer
    payment = await payment_factory(customer_id=str(customer.id), amount=Decimal("75.00"))

    # Get linked invoice
    result = await async_db_session.execute(
        select(PaymentInvoiceEntity).where(PaymentInvoiceEntity.payment_id == payment.payment_id)
    )
    payment_invoice = result.scalar_one()

    # Get invoice
    invoice_result = await async_db_session.execute(
        select(InvoiceEntity).where(InvoiceEntity.invoice_id == payment_invoice.invoice_id)
    )
    invoice = invoice_result.scalar_one()

    # Verify invoice has same customer
    assert invoice.customer_id == str(customer.id)
    assert payment.customer_id == str(customer.id)


@pytest.mark.asyncio
async def test_payment_can_access_invoices_via_relationship(async_db_session, payment_factory):
    """Verify payment can access linked invoices via ORM relationship."""
    # Create payment (which creates invoice)
    payment = await payment_factory(amount=Decimal("100.00"))

    # Refresh to load relationships
    await async_db_session.refresh(payment)

    # Use direct SELECT instead of lazy load to avoid extra round-trip
    result = await async_db_session.execute(
        select(PaymentInvoiceEntity).where(PaymentInvoiceEntity.payment_id == payment.payment_id)
    )
    invoices = result.scalars().all()

    # Relationship remains available once eagerly refreshed
    await async_db_session.refresh(payment, attribute_names=["invoices"])
    assert hasattr(payment, "invoices")
    assert len(payment.invoices) == len(invoices) == 1
    assert payment.invoices[0].invoice_id is not None
