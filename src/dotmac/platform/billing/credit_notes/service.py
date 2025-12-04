"""
Credit note service for managing refunds and credits
"""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.billing.core.entities import (
    CreditApplicationEntity,
    CreditNoteEntity,
    CreditNoteLineItemEntity,
    InvoiceEntity,
    TransactionEntity,
)
from dotmac.platform.billing.core.enums import (
    CreditApplicationType,
    CreditNoteStatus,
    CreditReason,
    CreditType,
    InvoiceStatus,
    PaymentStatus,
    TransactionType,
)
from dotmac.platform.billing.core.exceptions import (
    CreditNoteNotFoundError,
    InsufficientCreditError,
    InvalidCreditNoteStatusError,
)
from dotmac.platform.billing.core.models import CreditNote
from dotmac.platform.billing.metrics import get_billing_metrics
from dotmac.platform.webhooks.events import get_event_bus
from dotmac.platform.webhooks.models import WebhookEvent

logger = logging.getLogger(__name__)


class CreditNoteService:
    """Service for managing credit notes and refunds"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.metrics = get_billing_metrics()

    async def create_credit_note(
        self,
        tenant_id: str,
        invoice_id: str,
        reason: CreditReason,
        line_items: list[dict[str, Any]],
        notes: str | None = None,
        internal_notes: str | None = None,
        created_by: str = "system",
        auto_apply: bool = True,
    ) -> CreditNote:
        """Create a new credit note for an invoice"""

        # Get the original invoice
        invoice = await self._get_invoice(tenant_id, invoice_id)
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found")

        # Calculate total credit amount
        total_amount = sum(item.get("amount", 0) for item in line_items)

        # Validate credit amount doesn't exceed invoice amount
        if total_amount > invoice.total_amount:
            raise ValueError(
                f"Credit amount {total_amount} exceeds invoice amount {invoice.total_amount}"
            )

        # Generate credit note number
        credit_note_number = await self._generate_credit_note_number(tenant_id)

        # Create credit note entity
        credit_note_entity = CreditNoteEntity(
            credit_note_id=str(uuid4()),
            tenant_id=tenant_id,
            credit_note_number=credit_note_number,
            invoice_id=invoice_id,
            customer_id=invoice.customer_id,
            issue_date=datetime.now(UTC),
            credit_type=CreditType.REFUND,  # Default to refund type
            reason=reason,
            status=CreditNoteStatus.DRAFT,
            currency=invoice.currency,
            subtotal=total_amount,
            tax_amount=0,  # Calculate based on line items if needed
            total_amount=total_amount,
            remaining_credit_amount=total_amount,
            auto_apply_to_invoice=auto_apply,
            notes=notes,
            internal_notes=internal_notes,
            extra_data={},
            created_by=created_by,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        # Add line items
        for item_data in line_items:
            line_item = CreditNoteLineItemEntity(
                line_item_id=str(uuid4()),
                description=item_data["description"],
                quantity=item_data.get("quantity", 1),
                unit_price=item_data.get("unit_price", 0),
                total_price=item_data["amount"],
                original_invoice_line_item_id=item_data.get("original_invoice_line_item_id"),
                tax_rate=item_data.get("tax_rate", 0.0),
                tax_amount=item_data.get("tax_amount", 0),
                extra_data=item_data.get("extra_data", {}),
            )
            credit_note_entity.line_items.append(line_item)

        # Save to database
        self.db.add(credit_note_entity)
        await self.db.commit()
        await self.db.refresh(credit_note_entity, attribute_names=["line_items"])

        # Create transaction record
        await self._create_credit_note_transaction(credit_note_entity)

        # Record metrics
        self.metrics.record_credit_note_created(
            tenant_id=tenant_id,
            amount=total_amount,
            currency=invoice.currency,
            reason=reason.value,
        )

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.CREDIT_NOTE_CREATED.value,
                event_data={
                    "credit_note_id": credit_note_entity.credit_note_id,
                    "credit_note_number": credit_note_entity.credit_note_number,
                    "invoice_id": invoice_id,
                    "customer_id": credit_note_entity.customer_id,
                    "amount": total_amount,
                    "currency": credit_note_entity.currency,
                    "status": credit_note_entity.status.value,
                    "reason": reason.value,
                    "credit_type": credit_note_entity.credit_type.value,
                    "auto_apply": auto_apply,
                    "created_at": credit_note_entity.created_at.isoformat(),
                },
                tenant_id=tenant_id,
                db=self.db,
            )
        except Exception as e:
            logger.warning("Failed to publish credit_note.created event", error=str(e))

        credit_note_model = CreditNote.model_validate(credit_note_entity)

        if auto_apply:
            # Issue the credit note before applying it
            issued_note = await self.issue_credit_note(tenant_id, credit_note_entity.credit_note_id)

            credit_note_model = await self.apply_credit_to_invoice(
                tenant_id,
                issued_note.credit_note_id,
                invoice_id,
                issued_note.remaining_credit_amount or issued_note.total_amount,
            )

        return credit_note_model

    async def get_credit_note(self, tenant_id: str, credit_note_id: str) -> CreditNote | None:
        """Get credit note by ID with tenant isolation"""

        stmt = (
            select(CreditNoteEntity)
            .where(
                and_(
                    CreditNoteEntity.tenant_id == tenant_id,
                    CreditNoteEntity.credit_note_id == credit_note_id,
                )
            )
            .options(selectinload(CreditNoteEntity.line_items))
        )

        result = await self.db.execute(stmt)
        credit_note = result.scalar_one_or_none()

        if credit_note:
            return CreditNote.model_validate(credit_note)
        return None

    async def list_credit_notes(
        self,
        tenant_id: str,
        customer_id: str | None = None,
        invoice_id: str | None = None,
        status: CreditNoteStatus | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CreditNote]:
        """List credit notes with filtering"""

        stmt = select(CreditNoteEntity).where(CreditNoteEntity.tenant_id == tenant_id)

        if customer_id:
            stmt = stmt.where(CreditNoteEntity.customer_id == customer_id)
        if invoice_id:
            stmt = stmt.where(CreditNoteEntity.invoice_id == invoice_id)
        if status:
            stmt = stmt.where(CreditNoteEntity.status == status)

        stmt = (
            stmt.options(selectinload(CreditNoteEntity.line_items))
            .order_by(CreditNoteEntity.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.db.execute(stmt)
        credit_notes = result.scalars().all()

        return [CreditNote.model_validate(cn) for cn in credit_notes]

    async def issue_credit_note(self, tenant_id: str, credit_note_id: str) -> CreditNote:
        """Issue a draft credit note"""

        credit_note = await self._get_credit_note_entity(tenant_id, credit_note_id)
        if not credit_note:
            raise CreditNoteNotFoundError(f"Credit note {credit_note_id} not found")

        if credit_note.status != CreditNoteStatus.DRAFT:
            raise InvalidCreditNoteStatusError(
                f"Cannot issue credit note in {credit_note.status.value} status"
            )

        # Update status
        credit_note.status = CreditNoteStatus.ISSUED
        credit_note.updated_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(credit_note, attribute_names=["line_items"])

        # Record metrics
        self.metrics.record_credit_note_issued(
            tenant_id=tenant_id,
            credit_note_id=credit_note_id,
        )

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.CREDIT_NOTE_ISSUED.value,
                event_data={
                    "credit_note_id": credit_note.credit_note_id,
                    "credit_note_number": credit_note.credit_note_number,
                    "invoice_id": credit_note.invoice_id,
                    "customer_id": credit_note.customer_id,
                    "amount": credit_note.total_amount,
                    "currency": credit_note.currency,
                    "status": credit_note.status.value,
                    "remaining_credit_amount": credit_note.remaining_credit_amount,
                    "issued_at": credit_note.updated_at.isoformat(),
                },
                tenant_id=tenant_id,
                db=self.db,
            )
        except Exception as e:
            logger.warning("Failed to publish credit_note.issued event", error=str(e))

        return CreditNote.model_validate(credit_note)

    async def void_credit_note(
        self,
        tenant_id: str,
        credit_note_id: str,
        reason: str,
        voided_by: str = "system",
    ) -> CreditNote:
        """Void a credit note"""

        credit_note = await self._get_credit_note_entity(tenant_id, credit_note_id)
        if not credit_note:
            raise CreditNoteNotFoundError(f"Credit note {credit_note_id} not found")

        if credit_note.status == CreditNoteStatus.VOIDED:
            raise InvalidCreditNoteStatusError("Credit note is already voided")

        if credit_note.status == CreditNoteStatus.APPLIED:
            raise InvalidCreditNoteStatusError("Cannot void fully applied credit note")

        # Update status
        credit_note.status = CreditNoteStatus.VOIDED
        credit_note.voided_at = datetime.now(UTC)
        credit_note.updated_at = datetime.now(UTC)

        if not credit_note.extra_data:
            credit_note.extra_data = {}
        credit_note.extra_data["voided_by"] = voided_by
        credit_note.extra_data["void_reason"] = reason

        # Add void reason to internal notes
        if credit_note.internal_notes:
            credit_note.internal_notes += f"\nVoided: {reason}"
        else:
            credit_note.internal_notes = f"Voided: {reason}"

        await self.db.commit()
        await self.db.refresh(credit_note, attribute_names=["line_items"])

        # Create void transaction
        await self._create_void_transaction(credit_note)

        # Record metrics
        self.metrics.record_credit_note_voided(
            tenant_id=tenant_id,
            credit_note_id=credit_note_id,
        )

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.CREDIT_NOTE_VOIDED.value,
                event_data={
                    "credit_note_id": credit_note.credit_note_id,
                    "credit_note_number": credit_note.credit_note_number,
                    "invoice_id": credit_note.invoice_id,
                    "customer_id": credit_note.customer_id,
                    "amount": credit_note.total_amount,
                    "currency": credit_note.currency,
                    "status": credit_note.status.value,
                    "void_reason": reason,
                    "voided_by": voided_by,
                    "voided_at": credit_note.voided_at.isoformat()
                    if credit_note.voided_at
                    else None,
                },
                tenant_id=tenant_id,
                db=self.db,
            )
        except Exception as e:
            logger.warning("Failed to publish credit_note.voided event", error=str(e))

        return CreditNote.model_validate(credit_note)

    async def apply_credit_to_invoice(
        self,
        tenant_id: str,
        credit_note_id: str,
        invoice_id: str,
        amount: int,
    ) -> CreditNote:
        """Apply credit note to an invoice"""

        credit_note = await self._get_credit_note_entity(tenant_id, credit_note_id)
        if not credit_note:
            raise CreditNoteNotFoundError(f"Credit note {credit_note_id} not found")

        if credit_note.status not in [CreditNoteStatus.ISSUED, CreditNoteStatus.PARTIALLY_APPLIED]:
            raise InvalidCreditNoteStatusError(
                f"Cannot apply credit note in {credit_note.status.value} status"
            )

        if amount > credit_note.remaining_credit_amount:
            raise InsufficientCreditError(
                f"Requested amount {amount} exceeds remaining credit {credit_note.remaining_credit_amount}"
            )

        # Update credit note
        credit_note.remaining_credit_amount -= amount
        if credit_note.remaining_credit_amount == 0:
            credit_note.status = CreditNoteStatus.APPLIED
        else:
            credit_note.status = CreditNoteStatus.PARTIALLY_APPLIED

        credit_note.updated_at = datetime.now(UTC)

        application = CreditApplicationEntity(
            tenant_id=tenant_id,
            credit_note_id=credit_note.credit_note_id,
            applied_to_type=CreditApplicationType.INVOICE,
            applied_to_id=invoice_id,
            applied_amount=amount,
            application_date=datetime.now(UTC),
            applied_by="system",
            notes=None,
            extra_data={},
        )

        self.db.add(application)

        await self.db.commit()
        await self.db.refresh(credit_note, attribute_names=["line_items"])

        # Create application transaction
        await self._create_application_transaction(credit_note, invoice_id, amount)

        # Update invoice balance
        await self._update_invoice_balance(tenant_id, invoice_id, amount)

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.CREDIT_NOTE_APPLIED.value,
                event_data={
                    "credit_note_id": credit_note.credit_note_id,
                    "credit_note_number": credit_note.credit_note_number,
                    "invoice_id": invoice_id,
                    "customer_id": credit_note.customer_id,
                    "applied_amount": amount,
                    "remaining_credit_amount": credit_note.remaining_credit_amount,
                    "currency": credit_note.currency,
                    "status": credit_note.status.value,
                    "fully_applied": credit_note.status == CreditNoteStatus.APPLIED,
                    "applied_at": credit_note.updated_at.isoformat(),
                },
                tenant_id=tenant_id,
                db=self.db,
            )
        except Exception as e:
            logger.warning("Failed to publish credit_note.applied event", error=str(e))

        return CreditNote.model_validate(credit_note)

    async def get_available_credits(self, tenant_id: str, customer_id: str) -> list[CreditNote]:
        """Get all available credit notes for a customer"""

        stmt = (
            select(CreditNoteEntity)
            .where(
                and_(
                    CreditNoteEntity.tenant_id == tenant_id,
                    CreditNoteEntity.customer_id == customer_id,
                    CreditNoteEntity.status.in_(
                        [
                            CreditNoteStatus.ISSUED,
                            CreditNoteStatus.PARTIALLY_APPLIED,
                        ]
                    ),
                    CreditNoteEntity.remaining_credit_amount > 0,
                )
            )
            .order_by(CreditNoteEntity.created_at.asc())
        )

        result = await self.db.execute(stmt)
        credit_notes = result.scalars().all()

        return [CreditNote.model_validate(cn) for cn in credit_notes]

    # ============================================================================
    # Private helper methods
    # ============================================================================

    async def _get_invoice(self, tenant_id: str, invoice_id: str) -> InvoiceEntity | None:
        """Get invoice entity"""
        stmt = select(InvoiceEntity).where(
            and_(
                InvoiceEntity.tenant_id == tenant_id,
                InvoiceEntity.invoice_id == invoice_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_credit_note_entity(
        self, tenant_id: str, credit_note_id: str
    ) -> CreditNoteEntity | None:
        """Get credit note entity"""
        stmt = (
            select(CreditNoteEntity)
            .where(
                and_(
                    CreditNoteEntity.tenant_id == tenant_id,
                    CreditNoteEntity.credit_note_id == credit_note_id,
                )
            )
            .options(selectinload(CreditNoteEntity.line_items))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _generate_credit_note_number(self, tenant_id: str) -> str:
        """Generate unique credit note number"""
        # Get the latest credit note number for the tenant
        stmt = (
            select(CreditNoteEntity.credit_note_number)
            .where(CreditNoteEntity.tenant_id == tenant_id)
            .order_by(CreditNoteEntity.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        last_number = result.scalar_one_or_none()

        if last_number:
            # Extract sequence number and increment
            try:
                parts = last_number.split("-")
                sequence = int(parts[-1]) + 1
            except (ValueError, IndexError):
                sequence = 1
        else:
            sequence = 1

        # Format: CN-{year}-{sequence:06d}
        year = datetime.now(UTC).year
        return f"CN-{year}-{sequence:06d}"

    async def _create_credit_note_transaction(self, credit_note: CreditNoteEntity) -> None:
        """Create transaction record for credit note creation"""
        transaction = TransactionEntity(
            tenant_id=credit_note.tenant_id,
            transaction_id=str(uuid4()),
            transaction_type=TransactionType.CREDIT,
            amount=credit_note.total_amount,
            currency=credit_note.currency,
            customer_id=credit_note.customer_id,
            credit_note_id=credit_note.credit_note_id,
            description=f"Credit note {credit_note.credit_note_number} created",
            transaction_date=datetime.now(UTC),
        )
        self.db.add(transaction)
        await self.db.commit()

    async def _create_void_transaction(self, credit_note: CreditNoteEntity) -> None:
        """Create transaction record for credit note void"""
        transaction = TransactionEntity(
            tenant_id=credit_note.tenant_id,
            transaction_id=str(uuid4()),
            transaction_type=TransactionType.ADJUSTMENT,
            amount=credit_note.total_amount,
            currency=credit_note.currency,
            customer_id=credit_note.customer_id,
            credit_note_id=credit_note.credit_note_id,
            description=f"Credit note {credit_note.credit_note_number} voided",
            transaction_date=datetime.now(UTC),
        )
        self.db.add(transaction)
        await self.db.commit()

    async def _create_application_transaction(
        self, credit_note: CreditNoteEntity, invoice_id: str, amount: int
    ) -> None:
        """Create transaction record for credit application"""
        transaction = TransactionEntity(
            tenant_id=credit_note.tenant_id,
            transaction_id=str(uuid4()),
            transaction_type=TransactionType.CREDIT,
            amount=amount,
            currency=credit_note.currency,
            customer_id=credit_note.customer_id,
            credit_note_id=credit_note.credit_note_id,
            invoice_id=invoice_id,
            description=f"Credit {credit_note.credit_note_number} applied to invoice",
            transaction_date=datetime.now(UTC),
        )
        self.db.add(transaction)
        await self.db.commit()

    async def _update_invoice_balance(
        self, tenant_id: str, invoice_id: str, credit_amount: int
    ) -> None:
        """Update invoice balance after credit application"""
        invoice = await self._get_invoice(tenant_id, invoice_id)
        if invoice:
            invoice.total_credits_applied = (invoice.total_credits_applied or 0) + credit_amount
            invoice.remaining_balance = max(0, invoice.total_amount - invoice.total_credits_applied)

            # Update payment status if fully paid via credits
            if invoice.remaining_balance == 0:
                invoice.payment_status = PaymentStatus.SUCCEEDED
                invoice.status = InvoiceStatus.PAID
            elif invoice.total_credits_applied > 0:
                invoice.payment_status = PaymentStatus.PENDING
                invoice.status = InvoiceStatus.PARTIALLY_PAID

            invoice.updated_at = datetime.now(UTC)
            await self.db.commit()
