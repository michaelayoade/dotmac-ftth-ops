"""
Receipt service for generating and managing payment receipts
"""

import logging
from datetime import UTC, datetime
from typing import Any, cast
from uuid import uuid4

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.billing.core.entities import InvoiceEntity, PaymentEntity
from dotmac.platform.billing.core.enums import PaymentStatus
from dotmac.platform.billing.metrics import get_billing_metrics
from dotmac.platform.billing.receipts.generators import HTMLReceiptGenerator, PDFReceiptGenerator
from dotmac.platform.billing.receipts.models import Receipt, ReceiptLineItem

logger = logging.getLogger(__name__)


class ReceiptService:
    """Service for generating and managing receipts"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.metrics = get_billing_metrics()
        self.pdf_generator = PDFReceiptGenerator()
        self.html_generator = HTMLReceiptGenerator()

    async def generate_receipt_for_payment(
        self,
        tenant_id: str,
        payment_id: str,
        include_pdf: bool = True,
        include_html: bool = True,
        send_email: bool = False,
    ) -> Receipt:
        """Generate receipt for a payment"""

        # Get payment details
        payment = await self._get_payment(tenant_id, payment_id)
        if not payment:
            raise ValueError(f"Payment {payment_id} not found")

        if payment.status != PaymentStatus.SUCCEEDED:
            raise ValueError(f"Cannot generate receipt for payment with status {payment.status}")

        payment_extra = dict(payment.extra_data or {})
        invoice_ids: list[str] = []
        if getattr(payment, "invoices", None):
            invoice_ids.extend(
                [link.invoice_id for link in payment.invoices if getattr(link, "invoice_id", None)]
            )
        extra_invoice_id = cast(str | None, payment_extra.get("invoice_id"))
        if extra_invoice_id:
            invoice_ids.append(extra_invoice_id)

        invoice_ids = list(dict.fromkeys(invoice_ids))
        invoices: list[InvoiceEntity] = []
        for invoice_id in invoice_ids:
            invoice_entity = await self._get_invoice(tenant_id, invoice_id)
            if invoice_entity:
                invoices.append(invoice_entity)

        primary_invoice = invoices[0] if invoices else None

        # Generate receipt number
        receipt_number = await self._generate_receipt_number(tenant_id)

        # Build line items from payment/invoice
        line_items, computed_subtotal, computed_tax = self._build_receipt_line_items(
            payment, invoices
        )

        # Create receipt
        total_amount = payment.amount
        subtotal = (
            computed_subtotal
            if computed_subtotal
            else int(payment_extra.get("subtotal", total_amount))
        )
        tax_amount = computed_tax if computed_tax else int(payment_extra.get("tax_amount", 0))

        payment_method_label = cast(str | None, payment_extra.get("payment_method_label"))
        if not payment_method_label:
            details = payment.payment_method_details or {}
            brand = details.get("brand")
            last4 = details.get("last4")
            if brand and last4:
                payment_method_label = f"{brand} ****{last4}"
            else:
                payment_method_label = payment.payment_method_type.value

        if primary_invoice:
            billing_address_raw = primary_invoice.billing_address or {}
            customer_email = primary_invoice.billing_email or cast(
                str, payment_extra.get("customer_email", "")
            )
            customer_name = cast(str | None, billing_address_raw.get("name"))
            if not customer_name:
                customer_name = cast(str | None, payment_extra.get("customer_name"))
            customer_name = customer_name or customer_email or "Customer"
        else:
            billing_address_raw = cast(dict[str, Any], payment_extra.get("billing_address", {}))
            customer_email = cast(str, payment_extra.get("customer_email", ""))
            customer_name = cast(
                str, payment_extra.get("customer_name", customer_email or "Customer")
            )

        billing_address = {
            str(key): str(value)
            for key, value in billing_address_raw.items()
            if isinstance(key, str) and isinstance(value, str)
        }

        notes: str | None = None
        if invoices:
            collected_notes = [inv.notes for inv in invoices if getattr(inv, "notes", None)]
            if collected_notes:
                notes = "\n".join(note for note in collected_notes if note)
        if not notes:
            notes = payment_extra.get("notes")

        receipt_extra: dict[str, Any] = {}
        if invoice_ids:
            receipt_extra["invoice_ids"] = invoice_ids

        receipt = Receipt(
            receipt_id=str(uuid4()),
            receipt_number=receipt_number,
            tenant_id=tenant_id,
            payment_id=payment_id,
            invoice_id=invoice_ids[0] if invoice_ids else None,
            customer_id=payment.customer_id,
            issue_date=datetime.now(UTC),
            currency=payment.currency,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total_amount=total_amount,
            payment_method=payment_method_label,
            payment_status=payment.status.value,
            line_items=line_items,
            customer_name=customer_name,
            customer_email=customer_email,
            billing_address=billing_address,
            notes=notes,
            pdf_url=None,
            html_content=None,
            sent_at=None,
            delivery_method=None,
            extra_data=receipt_extra,
        )

        sequence = self._parse_receipt_sequence(receipt_number)

        payment_extra.update(
            {
                "receipt_number": receipt_number,
                "receipt_sequence": sequence,
            }
        )
        if invoice_ids:
            payment_extra["invoice_ids"] = invoice_ids
        payment.extra_data = payment_extra

        for invoice_entity in invoices:
            invoice_extra = dict(invoice_entity.extra_data or {})
            numbers = invoice_extra.get("receipt_numbers")
            if isinstance(numbers, list):
                number_list = [str(value) for value in numbers]
            elif numbers is None:
                number_list = []
            else:
                number_list = [str(numbers)]
            if receipt_number not in number_list:
                number_list.append(receipt_number)
            invoice_extra["receipt_numbers"] = number_list
            invoice_extra["receipt_sequence"] = sequence
            invoice_extra["last_receipt_number"] = receipt_number
            invoice_entity.extra_data = invoice_extra

        await self.db.commit()

        # Generate PDF if requested
        if include_pdf:
            pdf_content = await self.pdf_generator.generate_pdf(receipt)
            pdf_url = await self._store_pdf(receipt.receipt_id, pdf_content)
            receipt.pdf_url = pdf_url

        # Generate HTML if requested
        if include_html:
            receipt.html_content = await self.html_generator.generate_html(receipt)

        # Send email if requested
        if send_email and receipt.customer_email:
            await self._send_receipt_email(receipt)
            receipt.sent_at = datetime.now(UTC)
            receipt.delivery_method = "email"

        # Record metrics
        self.metrics.record_receipt_generated(
            tenant_id=tenant_id,
            amount=receipt.total_amount,
            currency=receipt.currency,
            payment_id=payment_id,
        )

        logger.info(f"Receipt {receipt.receipt_number} generated for payment {payment_id}")
        return receipt

    async def generate_receipt_for_invoice(
        self,
        tenant_id: str,
        invoice_id: str,
        payment_details: dict[str, Any],
        include_pdf: bool = True,
        include_html: bool = True,
    ) -> Receipt:
        """Generate receipt for an invoice payment"""

        # Get invoice details
        invoice = await self._get_invoice(tenant_id, invoice_id)
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found")

        # Generate receipt number
        receipt_number = await self._generate_receipt_number(tenant_id)

        # Build line items from invoice
        line_items: list[ReceiptLineItem] = []
        for item in invoice.line_items:
            sku_value = None
            if item.extra_data:
                sku_value = cast(str | None, item.extra_data.get("sku"))
            item_extra = dict(item.extra_data or {})
            item_extra.setdefault("invoice_id", invoice_id)
            line_items.append(
                ReceiptLineItem(
                    line_item_id=item.line_item_id,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    total_price=item.total_price,
                    tax_rate=item.tax_rate,
                    tax_amount=item.tax_amount,
                    product_id=item.product_id,
                    sku=sku_value,
                    extra_data=item_extra,
                )
            )

        # Create receipt
        payment_method_label = cast(str, payment_details.get("method", "unknown"))

        receipt = Receipt(
            receipt_id=str(uuid4()),
            receipt_number=receipt_number,
            tenant_id=tenant_id,
            payment_id=None,
            invoice_id=invoice_id,
            customer_id=invoice.customer_id,
            issue_date=datetime.now(UTC),
            currency=invoice.currency,
            subtotal=invoice.subtotal,
            tax_amount=invoice.tax_amount,
            total_amount=invoice.total_amount,
            payment_method=payment_method_label,
            payment_status=invoice.payment_status.value,
            line_items=line_items,
            customer_name=cast(str, invoice.billing_address.get("name", "Customer")),
            customer_email=invoice.billing_email,
            billing_address={
                str(key): str(value)
                for key, value in invoice.billing_address.items()
                if isinstance(key, str) and isinstance(value, str)
            },
            notes=invoice.notes,
            pdf_url=None,
            html_content=None,
            sent_at=None,
            delivery_method=None,
            extra_data={"invoice_ids": [invoice_id]},
        )

        sequence = self._parse_receipt_sequence(receipt_number)

        invoice_extra = dict(invoice.extra_data or {})
        numbers = invoice_extra.get("receipt_numbers")
        if isinstance(numbers, list):
            number_list = [str(value) for value in numbers]
        elif numbers is None:
            number_list = []
        else:
            number_list = [str(numbers)]
        if receipt_number not in number_list:
            number_list.append(receipt_number)
        invoice_extra["receipt_numbers"] = number_list
        invoice_extra["receipt_sequence"] = sequence
        invoice_extra["last_receipt_number"] = receipt_number
        invoice.extra_data = invoice_extra

        await self.db.commit()

        # Generate content if requested
        if include_pdf:
            pdf_content = await self.pdf_generator.generate_pdf(receipt)
            pdf_url = await self._store_pdf(receipt.receipt_id, pdf_content)
            receipt.pdf_url = pdf_url

        if include_html:
            receipt.html_content = await self.html_generator.generate_html(receipt)

        logger.info(f"Receipt {receipt.receipt_number} generated for invoice {invoice_id}")
        return receipt

    async def get_receipt(self, tenant_id: str, receipt_id: str) -> Receipt | None:
        """Get receipt by ID (this would typically be stored in database)"""
        # In a real implementation, this would query a receipts table
        # For now, this is a placeholder
        logger.warning("Receipt storage not implemented - receipts are generated on demand")
        return None

    async def list_receipts(
        self,
        tenant_id: str,
        customer_id: str | None = None,
        payment_id: str | None = None,
        invoice_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Receipt]:
        """List receipts with filtering"""
        # In a real implementation, this would query a receipts table
        # For now, this is a placeholder
        logger.warning("Receipt storage not implemented - use payment/invoice queries instead")
        return []

    # ============================================================================
    # Private helper methods
    # ============================================================================

    async def _get_payment(self, tenant_id: str, payment_id: str) -> PaymentEntity | None:
        """Get payment entity"""
        stmt = (
            select(PaymentEntity)
            .where(
                and_(
                    PaymentEntity.tenant_id == tenant_id,
                    PaymentEntity.payment_id == payment_id,
                )
            )
            .options(selectinload(PaymentEntity.invoices))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_invoice(self, tenant_id: str, invoice_id: str) -> InvoiceEntity | None:
        """Get invoice entity"""
        stmt = (
            select(InvoiceEntity)
            .where(
                and_(
                    InvoiceEntity.tenant_id == tenant_id,
                    InvoiceEntity.invoice_id == invoice_id,
                )
            )
            .options(selectinload(InvoiceEntity.line_items))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _generate_receipt_number(self, tenant_id: str) -> str:
        """Generate unique receipt number"""
        current_year = datetime.now(UTC).year

        max_sequence = 0

        payment_stmt = select(PaymentEntity.extra_data).where(PaymentEntity.tenant_id == tenant_id)
        payment_result = await self.db.execute(payment_stmt)
        for extra in payment_result.scalars():
            sequence = self._extract_sequence_from_extra(extra)
            if sequence > max_sequence:
                max_sequence = sequence

        invoice_stmt = select(InvoiceEntity.extra_data).where(InvoiceEntity.tenant_id == tenant_id)
        invoice_result = await self.db.execute(invoice_stmt)
        for extra in invoice_result.scalars():
            sequence = self._extract_sequence_from_extra(extra)
            if sequence > max_sequence:
                max_sequence = sequence

        next_sequence = max_sequence + 1
        return f"REC-{current_year}-{next_sequence:06d}"

    @staticmethod
    def _extract_sequence_from_extra(extra: Any) -> int:
        if isinstance(extra, dict):
            sequence = extra.get("receipt_sequence")
            if isinstance(sequence, int):
                return sequence
            if isinstance(sequence, str) and sequence.isdigit():
                return int(sequence)
        return 0

    @staticmethod
    def _parse_receipt_sequence(receipt_number: str) -> int:
        try:
            return int(receipt_number.split("-")[-1])
        except (ValueError, AttributeError):
            return 0

    def _build_receipt_line_items(
        self, payment: PaymentEntity, invoices: list[InvoiceEntity]
    ) -> tuple[list[ReceiptLineItem], int, int]:
        """Build receipt line items from payment and associated invoices."""

        line_items: list[ReceiptLineItem] = []
        subtotal = 0
        tax_total = 0

        invoice_map = {inv.invoice_id: inv for inv in invoices}
        associations = list(getattr(payment, "invoices", []))

        if associations:
            seen_invoice_ids: set[str] = set()
            for association in associations:
                invoice_id = getattr(association, "invoice_id", None)
                if not invoice_id:
                    continue
                seen_invoice_ids.add(invoice_id)
                applied_amount = int(getattr(association, "amount_applied", payment.amount))
                invoice_entity = invoice_map.get(invoice_id)
                description = (
                    f"Invoice {invoice_entity.invoice_number or invoice_id}"
                    if invoice_entity
                    else f"Invoice {invoice_id}"
                )
                tax_portion = 0
                tax_rate = 0.0
                if invoice_entity and getattr(invoice_entity, "total_amount", 0):
                    invoice_total = invoice_entity.total_amount or 0
                    invoice_tax = invoice_entity.tax_amount or 0
                    if invoice_total > 0 and invoice_tax:
                        tax_portion = int(round(invoice_tax * (applied_amount / invoice_total)))
                    if invoice_entity.subtotal:
                        tax_rate = float(
                            (invoice_entity.tax_amount or 0) / invoice_entity.subtotal * 100
                        )
                subtotal += applied_amount
                tax_total += tax_portion
                line_items.append(
                    ReceiptLineItem(
                        description=description,
                        quantity=1,
                        unit_price=applied_amount,
                        total_price=applied_amount,
                        tax_rate=tax_rate,
                        tax_amount=tax_portion,
                        extra_data={"invoice_id": invoice_id},
                    )
                )

            for invoice_id in (
                inv_id for inv_id in invoice_map.keys() if inv_id not in seen_invoice_ids
            ):
                available = payment.amount - subtotal
                if available <= 0:
                    break
                invoice_entity = invoice_map[invoice_id]
                proposed_amount = invoice_entity.total_amount
                applied_amount = min(proposed_amount, available)
                subtotal += applied_amount
                tax_allocation = 0
                tax_rate = 0.0
                if invoice_entity.total_amount and invoice_entity.tax_amount:
                    tax_allocation = int(
                        round(
                            (invoice_entity.tax_amount or 0)
                            * (applied_amount / invoice_entity.total_amount)
                        )
                    )
                if invoice_entity.subtotal:
                    tax_rate = float(
                        (invoice_entity.tax_amount or 0) / invoice_entity.subtotal * 100
                    )
                tax_total += tax_allocation
                description = f"Invoice {invoice_entity.invoice_number or invoice_id}"
                line_items.append(
                    ReceiptLineItem(
                        description=description,
                        quantity=1,
                        unit_price=applied_amount,
                        total_price=applied_amount,
                        tax_rate=tax_rate,
                        tax_amount=tax_allocation,
                        extra_data={"invoice_id": invoice_id},
                    )
                )

            residual = payment.amount - subtotal
            if residual:
                line_items.append(
                    ReceiptLineItem(
                        description="Unallocated amount",
                        quantity=1,
                        unit_price=residual,
                        total_price=residual,
                        tax_rate=0.0,
                        tax_amount=0,
                        extra_data={"payment_id": payment.payment_id},
                    )
                )
                subtotal += residual
        else:
            payment_extra = payment.extra_data or {}
            if invoices:
                remaining = payment.amount
                for invoice_entity in invoices:
                    if remaining <= 0:
                        break
                    applied_amount = min(invoice_entity.total_amount, remaining)
                    remaining -= applied_amount
                    tax_amount = 0
                    tax_rate = 0.0
                    if invoice_entity.total_amount and invoice_entity.tax_amount:
                        tax_amount = int(
                            round(
                                (invoice_entity.tax_amount or 0)
                                * (applied_amount / invoice_entity.total_amount)
                            )
                        )
                    if invoice_entity.subtotal:
                        tax_rate = float(
                            (invoice_entity.tax_amount or 0) / invoice_entity.subtotal * 100
                        )
                    subtotal += applied_amount
                    tax_total += tax_amount
                    line_items.append(
                        ReceiptLineItem(
                            description=f"Invoice {invoice_entity.invoice_number or invoice_entity.invoice_id}",
                            quantity=1,
                            unit_price=applied_amount,
                            total_price=applied_amount,
                            tax_rate=tax_rate,
                            tax_amount=tax_amount,
                            extra_data={"invoice_id": invoice_entity.invoice_id},
                        )
                    )
                if remaining > 0:
                    line_items.append(
                        ReceiptLineItem(
                            description="Unallocated amount",
                            quantity=1,
                            unit_price=remaining,
                            total_price=remaining,
                            extra_data={"payment_id": payment.payment_id},
                        )
                    )
                    subtotal += remaining
            else:
                description = cast(
                    str, payment_extra.get("description", f"Payment {payment.payment_id}")
                )
                product_id = cast(str | None, payment_extra.get("product_id"))
                tax_amount = int(payment_extra.get("tax_amount", 0))
                tax_rate = float(payment_extra.get("tax_rate", 0.0))
                subtotal = payment.amount
                tax_total = tax_amount
                line_items.append(
                    ReceiptLineItem(
                        description=description,
                        quantity=1,
                        unit_price=payment.amount,
                        total_price=payment.amount,
                        product_id=product_id,
                        tax_rate=tax_rate,
                        tax_amount=tax_amount,
                        extra_data={"payment_id": payment.payment_id},
                    )
                )

        if not line_items:
            line_items.append(
                ReceiptLineItem(
                    description=f"Payment {payment.payment_id}",
                    quantity=1,
                    unit_price=payment.amount,
                    total_price=payment.amount,
                )
            )
            subtotal = payment.amount

        return line_items, subtotal, tax_total

    async def _store_pdf(self, receipt_id: str, pdf_content: bytes) -> str:
        """Store PDF content and return URL"""
        # In a real implementation, this would store in S3, filesystem, etc.
        # For now, return a placeholder URL
        return f"/api/receipts/{receipt_id}/pdf"

    async def _send_receipt_email(self, receipt: Receipt) -> None:
        """Send receipt via email"""
        # In a real implementation, this would use an email service
        logger.info(f"Would send receipt {receipt.receipt_number} to {receipt.customer_email}")
