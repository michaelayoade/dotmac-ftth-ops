"""Comprehensive tests for the credit note service."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from dotmac.platform.billing.core.entities import CreditNoteEntity, InvoiceEntity
from dotmac.platform.billing.core.enums import (
    CreditNoteStatus,
    CreditReason,
    InvoiceStatus,
    PaymentStatus,
)
from dotmac.platform.billing.core.exceptions import InsufficientCreditError
from dotmac.platform.billing.credit_notes.service import CreditNoteService

pytestmark = pytest.mark.integration


class _DummyMetrics:
    def __init__(self) -> None:
        self.created: list[dict] = []
        self.issued: list[dict] = []
        self.voided: list[dict] = []

    def record_credit_note_created(self, **kwargs):  # type: ignore[no-untyped-def]
        self.created.append(kwargs)

    def record_credit_note_issued(self, **kwargs):  # type: ignore[no-untyped-def]
        self.issued.append(kwargs)

    def record_credit_note_voided(self, **kwargs):  # type: ignore[no-untyped-def]
        self.voided.append(kwargs)


@pytest.fixture
def credit_note_service(async_db_session, monkeypatch):
    """Instantiate the credit note service with deterministic metrics."""

    dummy_metrics = _DummyMetrics()
    monkeypatch.setattr(
        "dotmac.platform.billing.credit_notes.service.get_billing_metrics",
        lambda: dummy_metrics,
    )

    return CreditNoteService(async_db_session), dummy_metrics


async def _create_invoice(
    async_db_session, tenant_id: str, customer_id: str, total: int = 27500
) -> InvoiceEntity:
    invoice = InvoiceEntity(
        invoice_id=str(uuid4()),
        tenant_id=tenant_id,
        invoice_number=f"INV-{uuid4().hex[:6].upper()}",
        customer_id=customer_id,
        billing_email=f"{customer_id}@example.com",
        billing_address={"street": "123 Test St", "city": "Test City", "country": "US"},
        issue_date=datetime.now(UTC),
        due_date=datetime.now(UTC) + timedelta(days=30),
        currency="USD",
        subtotal=total,
        tax_amount=0,
        discount_amount=0,
        total_amount=total,
        remaining_balance=total,
        total_credits_applied=0,
        credit_applications=[],
        status=InvoiceStatus.OPEN,
        payment_status=PaymentStatus.PENDING,
    )
    async_db_session.add(invoice)
    await async_db_session.commit()
    await async_db_session.refresh(invoice)
    return invoice


@pytest.mark.asyncio
async def test_create_credit_note_without_auto_apply(
    credit_note_service,
    test_tenant_id,
    test_customer_id,
    async_db_session,
):
    """Credit notes should persist and remain draft when auto_apply is False."""

    service, metrics = credit_note_service

    invoice = await _create_invoice(async_db_session, test_tenant_id, test_customer_id, total=27500)

    credit_note = await service.create_credit_note(
        tenant_id=test_tenant_id,
        invoice_id=invoice.invoice_id,
        reason=CreditReason.BILLING_ERROR,
        line_items=[
            {"description": "Overcharge adjustment", "amount": 5000, "unit_price": 5000},
        ],
        notes="Customer reported overcharge",
        auto_apply=False,
        created_by="tester",
    )

    assert credit_note.status == CreditNoteStatus.DRAFT
    assert credit_note.total_amount == 5000
    assert credit_note.remaining_credit_amount == 5000
    assert metrics.created and metrics.created[0]["amount"] == 5000
    assert not metrics.issued

    # Verify persistence
    stmt = select(CreditNoteEntity).where(
        CreditNoteEntity.credit_note_id == credit_note.credit_note_id
    )
    stored = (await async_db_session.execute(stmt)).scalar_one()
    assert stored.status == CreditNoteStatus.DRAFT


@pytest.mark.asyncio
async def test_create_credit_note_with_auto_apply_updates_invoice(
    credit_note_service,
    test_tenant_id,
    test_customer_id,
    async_db_session,
):
    """Auto-apply should issue the credit note, apply it, and update invoice balances."""

    service, metrics = credit_note_service

    invoice = await _create_invoice(async_db_session, test_tenant_id, test_customer_id, total=27500)
    original_total = invoice.total_amount

    credit_note = await service.create_credit_note(
        tenant_id=test_tenant_id,
        invoice_id=invoice.invoice_id,
        reason=CreditReason.GOODWILL,
        line_items=[
            {"description": "Goodwill credit", "amount": 10000, "unit_price": 10000},
        ],
        auto_apply=True,
        created_by="tester",
    )

    assert credit_note.status == CreditNoteStatus.APPLIED
    assert credit_note.remaining_credit_amount == 0
    assert metrics.created and metrics.issued  # both hooks fire

    # Invoice balance should decrease by the credit amount
    invoice_stmt = select(InvoiceEntity).where(InvoiceEntity.invoice_id == invoice.invoice_id)
    invoice_entity = (await async_db_session.execute(invoice_stmt)).scalar_one()
    assert invoice_entity.total_credits_applied == 10000
    assert invoice_entity.remaining_balance == original_total - 10000


@pytest.mark.asyncio
async def test_create_credit_note_amount_exceeds_invoice_raises(
    credit_note_service,
    test_tenant_id,
    test_customer_id,
    async_db_session,
):
    """Creating a credit larger than the invoice amount should fail."""

    service, _ = credit_note_service

    invoice = await _create_invoice(async_db_session, test_tenant_id, test_customer_id, total=27500)

    with pytest.raises(ValueError):
        await service.create_credit_note(
            tenant_id=test_tenant_id,
            invoice_id=invoice.invoice_id,
            reason=CreditReason.BILLING_ERROR,
            line_items=[
                {"description": "Excessive credit", "amount": 999999, "unit_price": 999999}
            ],
        )


@pytest.mark.asyncio
async def test_apply_credit_insufficient_funds_raises(
    credit_note_service,
    test_tenant_id,
    test_customer_id,
    async_db_session,
):
    """Applying more credit than available raises an InsufficientCreditError."""

    service, _ = credit_note_service

    invoice = await _create_invoice(async_db_session, test_tenant_id, test_customer_id, total=27500)

    credit_note = await service.create_credit_note(
        tenant_id=test_tenant_id,
        invoice_id=invoice.invoice_id,
        reason=CreditReason.BILLING_ERROR,
        line_items=[{"description": "Partial credit", "amount": 2000, "unit_price": 2000}],
        auto_apply=False,
    )

    issued = await service.issue_credit_note(test_tenant_id, credit_note.credit_note_id)

    with pytest.raises(InsufficientCreditError):
        await service.apply_credit_to_invoice(
            tenant_id=test_tenant_id,
            credit_note_id=issued.credit_note_id,
            invoice_id=invoice.invoice_id,
            amount=issued.total_amount + 1,
        )
