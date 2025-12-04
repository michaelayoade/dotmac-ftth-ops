"""
Invoice service with tenant support and idempotency
"""

import os
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import and_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.billing.core.entities import (
    InvoiceEntity,
    InvoiceLineItemEntity,
    TransactionEntity,
)
from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus, TransactionType
from dotmac.platform.billing.core.exceptions import (
    InvalidInvoiceStatusError,
    InvoiceNotFoundError,
)
from dotmac.platform.billing.core.models import Invoice, InvoiceLineItem
from dotmac.platform.billing.currency.service import CurrencyRateService
from dotmac.platform.billing.metrics import get_billing_metrics
from dotmac.platform.billing.money_utils import money_handler
from dotmac.platform.communications.email_service import EmailMessage, EmailService
from dotmac.platform.settings import settings
from dotmac.platform.webhooks.events import get_event_bus
from dotmac.platform.webhooks.models import WebhookEvent

logger = structlog.get_logger(__name__)


def _build_invoice_url(invoice_id: Any) -> str:
    """Construct invoice portal link using configured base URL."""
    base_url = settings.urls.billing_portal_base_url.rstrip("/")
    return f"{base_url}/invoices/{invoice_id}"


class InvoiceService:
    """Invoice management service with tenant isolation"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.metrics = get_billing_metrics()

    async def _normalize_currency_components(
        self,
        currency: str,
        amounts: dict[str, int],
    ) -> tuple[dict[str, Any], int, str] | None:
        """Normalize invoice monetary components to default currency."""

        testing_flag = os.getenv("TESTING", "").lower()
        in_test_env = testing_flag in {"true", "1", "yes"}
        enable_multi_currency = getattr(settings.billing, "enable_multi_currency", False)

        if not enable_multi_currency and not in_test_env:
            logger.info(
                "currency.normalization.disabled",
                enable_multi_currency=enable_multi_currency,
                testing_flag=testing_flag or None,
            )
            return None

        default_currency = settings.billing.default_currency.upper()
        source_currency = currency.upper()

        if source_currency == default_currency:
            return None

        rate_service = CurrencyRateService(self.db)
        conversion_components: dict[str, Any] = {
            "base_currency": source_currency,
            "target_currency": default_currency,
            "timestamp": datetime.now(UTC).isoformat(),
            "components": {},
        }

        converted_totals: dict[str, int] = {}

        try:
            for key, minor_units in amounts.items():
                money_value = money_handler.money_from_minor_units(minor_units, source_currency)
                converted = await rate_service.convert_money(money_value, default_currency)
                converted_minor = money_handler.money_to_minor_units(converted)
                conversion_components["components"][key] = {
                    "original_minor_units": minor_units,
                    "converted_minor_units": converted_minor,
                    "converted_amount": str(converted.amount),
                }
                converted_totals[key] = converted_minor

            rate = await rate_service.get_rate(source_currency, default_currency)
        except RuntimeError as exc:
            if not enable_multi_currency and in_test_env:
                logger.info(
                    "currency.normalization.skipped_no_integration",
                    base_currency=source_currency,
                    target_currency=default_currency,
                    error=str(exc),
                )
                return None
            raise

        conversion_components["rate"] = str(rate)

        normalized_total = converted_totals.get("total_amount", 0)
        return conversion_components, normalized_total, default_currency

    async def create_invoice(
        self,
        tenant_id: str,
        customer_id: str,
        billing_email: str,
        billing_address: dict[str, str],
        line_items: list[dict[str, Any]],
        currency: str = "USD",
        due_days: int | None = None,
        due_date: datetime | None = None,
        notes: str | None = None,
        internal_notes: str | None = None,
        subscription_id: str | None = None,
        created_by: str = "system",
        idempotency_key: str | None = None,
        extra_data: dict[str, Any] | None = None,
    ) -> Invoice:
        """Create a new invoice with idempotency support"""

        # Check for existing invoice with same idempotency key
        if idempotency_key:
            existing = await self._get_invoice_by_idempotency_key(tenant_id, idempotency_key)
            if existing:
                # Ensure extra_data is a dict for Pydantic validation
                if existing.extra_data is None:
                    existing.extra_data = {}
                await self.db.refresh(existing, attribute_names=["line_items"])
                return Invoice.model_validate(existing)

        # Calculate due date
        if not due_date:
            due_days = due_days or 30
            due_date = datetime.now(UTC) + timedelta(days=due_days)

        # Calculate totals
        subtotal = 0
        tax_amount = 0
        discount_amount = 0

        # Process line items
        invoice_line_items = []
        for item_data in line_items:
            line_item = InvoiceLineItem.model_validate(item_data)
            subtotal += line_item.total_price
            tax_amount += line_item.tax_amount
            discount_amount += line_item.discount_amount
            invoice_line_items.append(line_item)

        total_amount = subtotal + tax_amount - discount_amount

        # Generate invoice number
        invoice_number = await self._generate_invoice_number(tenant_id)

        # Create invoice entity
        invoice_entity = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_number=invoice_number,
            idempotency_key=idempotency_key,
            created_by=created_by,
            customer_id=customer_id,
            billing_email=billing_email,
            billing_address=billing_address,
            issue_date=datetime.now(UTC),
            due_date=due_date,
            currency=currency,
            subtotal=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            total_amount=total_amount,
            remaining_balance=total_amount,
            status=InvoiceStatus.DRAFT,
            payment_status=PaymentStatus.PENDING,
            subscription_id=subscription_id,
            notes=notes,
            internal_notes=internal_notes,
            extra_data=extra_data or {},
        )

        # Add line items
        for line_item in invoice_line_items:
            line_item_entity = InvoiceLineItemEntity(
                invoice_id=invoice_entity.invoice_id,
                description=line_item.description,
                quantity=line_item.quantity,
                unit_price=line_item.unit_price,
                total_price=line_item.total_price,
                product_id=line_item.product_id,
                subscription_id=line_item.subscription_id,
                tax_rate=line_item.tax_rate,
                tax_amount=line_item.tax_amount,
                discount_percentage=line_item.discount_percentage,
                discount_amount=line_item.discount_amount,
                extra_data=line_item.extra_data,
            )
            invoice_entity.line_items.append(line_item_entity)

        # Save to database
        self.db.add(invoice_entity)
        await self.db.commit()
        # Refresh with eager loading of line_items for Pydantic validation
        await self.db.refresh(invoice_entity, attribute_names=["line_items"])

        # Normalize currency totals for reporting/metrics if needed
        normalization = await self._normalize_currency_components(
            currency,
            {
                "subtotal": subtotal,
                "tax_amount": tax_amount,
                "discount_amount": discount_amount,
                "total_amount": total_amount,
            },
        )

        metrics_currency = currency
        metrics_total_amount = total_amount

        if normalization:
            conversion_details, normalized_total, normalized_currency = normalization
            metrics_currency = normalized_currency
            metrics_total_amount = normalized_total
            existing_extra = dict(invoice_entity.extra_data or {})
            conversion_section = dict(existing_extra.get("currency_conversion", {}))
            conversion_section.update(conversion_details)
            existing_extra["currency_conversion"] = conversion_section
            invoice_entity.extra_data = existing_extra
            await self.db.commit()
            await self.db.refresh(invoice_entity, attribute_names=["extra_data"])

        # Create transaction record
        await self._create_invoice_transaction(invoice_entity)

        # Record metrics
        self.metrics.record_invoice_created(
            tenant_id=tenant_id,
            amount=metrics_total_amount,
            currency=metrics_currency,
            customer_id=customer_id,
        )

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.INVOICE_CREATED.value,
                event_data={
                    "invoice_id": invoice_entity.invoice_id,
                    "invoice_number": invoice_entity.invoice_number,
                    "customer_id": customer_id,
                    "amount": float(total_amount),
                    "currency": currency,
                    "status": invoice_entity.status.value,
                    "payment_status": invoice_entity.payment_status.value,
                    "due_date": invoice_entity.due_date.isoformat(),
                    "subscription_id": subscription_id,
                },
                tenant_id=tenant_id,
                db=self.db,
            )
        except Exception as e:
            # Log but don't fail invoice creation
            import structlog

            logger = structlog.get_logger(__name__)
            logger.warning("Failed to publish invoice.created event", error=str(e))

        return Invoice.model_validate(invoice_entity)

    async def get_invoice(
        self, tenant_id: str, invoice_id: str, include_line_items: bool = True
    ) -> Invoice | None:
        """Get invoice by ID with tenant isolation"""

        query = select(InvoiceEntity).where(
            and_(InvoiceEntity.tenant_id == tenant_id, InvoiceEntity.invoice_id == invoice_id)
        )

        if include_line_items:
            query = query.options(selectinload(InvoiceEntity.line_items))

        result = await self.db.execute(query)
        invoice = result.scalar_one_or_none()

        if invoice:
            # Ensure extra_data is a dict for Pydantic validation
            if invoice.extra_data is None:
                invoice.extra_data = {}
            return Invoice.model_validate(invoice)
        return None

    async def list_invoices(
        self,
        tenant_id: str,
        customer_id: str | None = None,
        status: InvoiceStatus | None = None,
        payment_status: PaymentStatus | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Invoice]:
        """List invoices with filtering and tenant isolation"""

        query = select(InvoiceEntity).where(InvoiceEntity.tenant_id == tenant_id)

        if customer_id:
            query = query.where(InvoiceEntity.customer_id == customer_id)
        if status:
            query = query.where(InvoiceEntity.status == status)
        if payment_status:
            query = query.where(InvoiceEntity.payment_status == payment_status)
        if start_date:
            query = query.where(InvoiceEntity.issue_date >= start_date)
        if end_date:
            query = query.where(InvoiceEntity.issue_date <= end_date)

        query = query.order_by(InvoiceEntity.created_at.desc()).limit(limit).offset(offset)

        # Eager load line_items to avoid lazy loading issues
        query = query.options(selectinload(InvoiceEntity.line_items))

        result = await self.db.execute(query)
        invoices = result.scalars().all()

        # Ensure extra_data is a dict for Pydantic validation
        for invoice in invoices:
            if invoice.extra_data is None:
                invoice.extra_data = {}

        return [Invoice.model_validate(invoice) for invoice in invoices]

    async def finalize_invoice(self, tenant_id: str, invoice_id: str) -> Invoice:
        """Finalize a draft invoice to open status"""

        invoice = await self._get_invoice_entity(tenant_id, invoice_id)
        if not invoice:
            raise InvoiceNotFoundError(f"Invoice {invoice_id} not found")

        if invoice.status != InvoiceStatus.DRAFT:
            raise InvalidInvoiceStatusError("Can only finalize draft invoices")

        invoice.status = InvoiceStatus.OPEN
        invoice.updated_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(invoice, attribute_names=["line_items"])

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.INVOICE_FINALIZED.value,
                event_data={
                    "invoice_id": invoice.invoice_id,
                    "invoice_number": invoice.invoice_number,
                    "customer_id": invoice.customer_id,
                    "amount": float(
                        money_handler.from_minor_units(invoice.total_amount, invoice.currency)
                    ),
                    "currency": invoice.currency,
                    "status": invoice.status.value,
                    "due_date": invoice.due_date.isoformat(),
                    "finalized_at": datetime.now(UTC).isoformat(),
                },
                tenant_id=tenant_id,
                db=self.db,
            )
        except Exception as e:
            logger.warning("Failed to publish invoice.finalized event", error=str(e))

        # Send invoice notification
        await self._send_invoice_notification(invoice)

        # Record metrics
        self.metrics.record_invoice_finalized(tenant_id, invoice_id)

        # Ensure extra_data is a dict for Pydantic validation
        if invoice.extra_data is None:
            invoice.extra_data = {}

        return Invoice.model_validate(invoice)

    async def void_invoice(
        self, tenant_id: str, invoice_id: str, reason: str | None = None, voided_by: str = "system"
    ) -> Invoice:
        """Void an invoice"""

        invoice = await self._get_invoice_entity(tenant_id, invoice_id)
        if not invoice:
            raise InvoiceNotFoundError(f"Invoice {invoice_id} not found")

        if invoice.status == InvoiceStatus.VOID:
            await self.db.refresh(invoice, attribute_names=["line_items"])
            return Invoice.model_validate(invoice)

        if (
            invoice.payment_status == PaymentStatus.SUCCEEDED
            or invoice.remaining_balance < invoice.total_amount
        ):
            raise InvalidInvoiceStatusError("Cannot void paid or partially refunded invoices")

        invoice.status = InvoiceStatus.VOID
        invoice.voided_at = datetime.now(UTC)
        invoice.updated_at = datetime.now(UTC)
        invoice.updated_by = voided_by

        if reason:
            invoice.internal_notes = (invoice.internal_notes or "") + f"\nVoided: {reason}"

        await self.db.commit()
        await self.db.refresh(invoice, attribute_names=["line_items"])

        # Create void transaction
        await self._create_void_transaction(invoice)

        # Record metrics
        self.metrics.record_invoice_voided(tenant_id, invoice_id)

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.INVOICE_VOIDED.value,
                event_data={
                    "invoice_id": invoice.invoice_id,
                    "invoice_number": invoice.invoice_number,
                    "customer_id": invoice.customer_id,
                    "amount": float(invoice.total_amount),
                    "currency": invoice.currency,
                    "reason": reason,
                    "voided_by": voided_by,
                    "voided_at": invoice.voided_at.isoformat() if invoice.voided_at else None,
                },
                tenant_id=tenant_id,
                db=self.db,
            )
        except Exception as e:
            import structlog

            logger = structlog.get_logger(__name__)
            logger.warning("Failed to publish invoice.voided event", error=str(e))

        # Ensure extra_data is a dict for Pydantic validation
        if invoice.extra_data is None:
            invoice.extra_data = {}

        return Invoice.model_validate(invoice)

    async def mark_invoice_paid(
        self, tenant_id: str, invoice_id: str, payment_id: str | None = None
    ) -> Invoice:
        """Mark invoice as paid"""

        invoice = await self._get_invoice_entity(tenant_id, invoice_id)
        if not invoice:
            raise InvoiceNotFoundError(f"Invoice {invoice_id} not found")

        invoice.payment_status = PaymentStatus.SUCCEEDED
        invoice.status = InvoiceStatus.PAID
        invoice.paid_at = datetime.now(UTC)
        invoice.remaining_balance = 0
        invoice.updated_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(invoice, attribute_names=["line_items"])

        # Record metrics if paid
        if invoice.payment_status == PaymentStatus.SUCCEEDED:
            self.metrics.record_invoice_paid(
                tenant_id, invoice_id, invoice.total_amount, invoice.currency
            )

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.INVOICE_PAID.value,
                event_data={
                    "invoice_id": invoice.invoice_id,
                    "invoice_number": invoice.invoice_number,
                    "customer_id": invoice.customer_id,
                    "amount": float(invoice.total_amount),
                    "currency": invoice.currency,
                    "payment_id": payment_id,
                    "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
                },
                tenant_id=tenant_id,
                db=self.db,
            )
        except Exception as e:
            import structlog

            logger = structlog.get_logger(__name__)
            logger.warning("Failed to publish invoice.paid event", error=str(e))

        # Ensure extra_data is a dict for Pydantic validation
        if invoice.extra_data is None:
            invoice.extra_data = {}

        return Invoice.model_validate(invoice)

    async def apply_credit_to_invoice(
        self, tenant_id: str, invoice_id: str, credit_amount: int, credit_application_id: str
    ) -> Invoice:
        """Apply credit to invoice and update balances"""

        invoice = await self._get_invoice_entity(tenant_id, invoice_id)
        if not invoice:
            raise InvoiceNotFoundError(f"Invoice {invoice_id} not found")

        # Update invoice with credit application
        invoice.total_credits_applied += credit_amount
        invoice.remaining_balance = max(0, invoice.total_amount - invoice.total_credits_applied)
        invoice.credit_applications.append(credit_application_id)
        invoice.updated_at = datetime.now(UTC)

        # Update payment status based on remaining balance
        if invoice.remaining_balance <= 0:
            invoice.payment_status = PaymentStatus.SUCCEEDED
            invoice.status = InvoiceStatus.PAID
        elif invoice.total_credits_applied > 0:
            invoice.payment_status = PaymentStatus.PENDING
            invoice.status = InvoiceStatus.PARTIALLY_PAID

        await self.db.commit()
        await self.db.refresh(invoice, attribute_names=["line_items"])

        # Create transaction for credit application
        transaction = TransactionEntity(
            tenant_id=tenant_id,
            amount=credit_amount,
            currency=invoice.currency,
            transaction_type=TransactionType.CREDIT,
            description=f"Credit applied to invoice {invoice.invoice_number}",
            customer_id=invoice.customer_id,
            invoice_id=invoice_id,
            extra_data={"credit_application_id": credit_application_id},
        )
        self.db.add(transaction)
        await self.db.commit()

        # Ensure extra_data is a dict for Pydantic validation
        if invoice.extra_data is None:
            invoice.extra_data = {}

        return Invoice.model_validate(invoice)

    async def update_invoice_payment_status(
        self, tenant_id: str, invoice_id: str, payment_status: PaymentStatus
    ) -> Invoice:
        """Update invoice payment status"""

        invoice = await self._get_invoice_entity(tenant_id, invoice_id)
        if not invoice:
            raise InvoiceNotFoundError(f"Invoice {invoice_id} not found")

        invoice.payment_status = payment_status
        invoice.updated_at = datetime.now(UTC)

        if payment_status == PaymentStatus.SUCCEEDED:
            invoice.status = InvoiceStatus.PAID
            invoice.paid_at = datetime.now(UTC)
            invoice.remaining_balance = 0
        elif (
            payment_status == PaymentStatus.PENDING
            and invoice.remaining_balance < invoice.total_amount
        ):
            invoice.status = InvoiceStatus.PARTIALLY_PAID

        await self.db.commit()
        await self.db.refresh(invoice, attribute_names=["line_items"])

        # Ensure extra_data is a dict for Pydantic validation
        if invoice.extra_data is None:
            invoice.extra_data = {}

        return Invoice.model_validate(invoice)

    async def update_invoice(
        self,
        tenant_id: str,
        invoice_id: str,
        due_date: datetime | None = None,
        notes: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Invoice:
        """
        Update invoice fields.

        Args:
            tenant_id: Tenant identifier
            invoice_id: Invoice identifier
            due_date: New due date (optional)
            notes: New notes (optional)
            metadata: Additional metadata to merge (optional)

        Returns:
            Updated invoice

        Raises:
            InvoiceNotFoundError: If invoice doesn't exist
            InvalidInvoiceStatusError: If invoice is in a non-updatable state
        """
        invoice = await self._get_invoice_entity(tenant_id, invoice_id)
        if not invoice:
            raise InvoiceNotFoundError(f"Invoice {invoice_id} not found")

        # Only allow updates on draft or open invoices
        if invoice.status not in [InvoiceStatus.DRAFT, InvoiceStatus.OPEN]:
            raise InvalidInvoiceStatusError(f"Cannot update invoice in {invoice.status} status")

        # Update fields
        if due_date is not None:
            invoice.due_date = due_date
        if notes is not None:
            invoice.notes = notes
        if metadata is not None:
            current_metadata = invoice.extra_data or {}
            invoice.extra_data = {**current_metadata, **metadata}

        invoice.updated_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(invoice, attribute_names=["line_items"])

        # Ensure extra_data is a dict for Pydantic validation
        if invoice.extra_data is None:
            invoice.extra_data = {}

        logger.info(
            "Invoice updated",
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            updated_fields={"due_date": due_date, "notes": bool(notes), "metadata": bool(metadata)},
        )

        return Invoice.model_validate(invoice)

    async def send_invoice_email(
        self, tenant_id: str, invoice_id: str, recipient_email: str | None = None
    ) -> bool:
        """
        Send invoice via email to customer.

        Args:
            tenant_id: Tenant identifier
            invoice_id: Invoice identifier
            recipient_email: Override recipient email (optional, uses invoice billing_email if not provided)

        Returns:
            True if email sent successfully, False otherwise

        Raises:
            InvoiceNotFoundError: If invoice doesn't exist
        """
        invoice = await self._get_invoice_entity(tenant_id, invoice_id)
        if not invoice:
            raise InvoiceNotFoundError(f"Invoice {invoice_id} not found")

        # Determine recipient email
        email = recipient_email or invoice.billing_email
        if not email:
            logger.warning(
                "Cannot send invoice - no email address",
                tenant_id=tenant_id,
                invoice_id=invoice_id,
            )
            return False

        try:
            # Use communications module to send email
            from dotmac.platform.communications.email_service import EmailMessage, get_email_service
            from dotmac.platform.settings import settings

            app_name = getattr(settings, "app_name", "DotMac Platform")
            subject = f"Invoice {invoice.invoice_number} from {app_name}"

            # Create email content
            content = f"""
Dear Customer,

Please find your invoice details below:

Invoice Number: {invoice.invoice_number}
Amount Due: {invoice.currency} {invoice.total_amount}
Due Date: {invoice.due_date.strftime("%Y-%m-%d") if invoice.due_date else "N/A"}
Status: {invoice.status.value}

{f"Notes: {invoice.notes}" if invoice.notes else ""}

Thank you for your business!

Best regards,
{app_name} Team
""".strip()

            html_content = f"""
<h2>Invoice {invoice.invoice_number}</h2>
<p><strong>Amount Due:</strong> {invoice.currency} {invoice.total_amount}</p>
<p><strong>Due Date:</strong> {invoice.due_date.strftime("%Y-%m-%d") if invoice.due_date else "N/A"}</p>
<p><strong>Status:</strong> {invoice.status.value}</p>
{f"<p><strong>Notes:</strong> {invoice.notes}</p>" if invoice.notes else ""}
<p>Thank you for your business!</p>
""".strip()

            message = EmailMessage(
                to=[email],
                subject=subject,
                text_body=content,
                html_body=html_content,
            )

            email_service = get_email_service()
            response = await email_service.send_email(message)

            success: bool = response.status == "sent"
            if success:
                logger.info(
                    "Invoice email sent successfully",
                    tenant_id=tenant_id,
                    invoice_id=invoice_id,
                    recipient=email,
                )
            else:
                logger.warning(
                    "Invoice email failed to send",
                    tenant_id=tenant_id,
                    invoice_id=invoice_id,
                    recipient=email,
                )

            return success

        except Exception as e:
            logger.error(
                "Failed to send invoice email",
                tenant_id=tenant_id,
                invoice_id=invoice_id,
                error=str(e),
            )
            return False

    async def send_payment_reminder(
        self, tenant_id: str, invoice_id: str, custom_message: str | None = None
    ) -> bool:
        """
        Send payment reminder email for overdue or unpaid invoice.

        Args:
            tenant_id: Tenant identifier
            invoice_id: Invoice identifier
            custom_message: Optional custom message to include in reminder

        Returns:
            True if reminder sent successfully, False otherwise

        Raises:
            InvoiceNotFoundError: If invoice doesn't exist
            InvalidInvoiceStatusError: If invoice is not in remindable status
        """
        invoice = await self._get_invoice_entity(tenant_id, invoice_id)
        if not invoice:
            raise InvoiceNotFoundError(f"Invoice {invoice_id} not found")

        # Check if invoice is in remindable status
        if invoice.status not in [
            InvoiceStatus.OPEN,
            InvoiceStatus.OVERDUE,
            InvoiceStatus.PARTIALLY_PAID,
        ]:
            raise InvalidInvoiceStatusError(
                f"Cannot send reminder for invoice with status: {invoice.status.value}"
            )

        # Determine recipient email
        email = invoice.billing_email
        if not email:
            logger.warning(
                "Cannot send payment reminder - no email address",
                tenant_id=tenant_id,
                invoice_id=invoice_id,
            )
            return False

        try:
            # Use communications module to send email
            from dotmac.platform.communications.email_service import EmailMessage, get_email_service
            from dotmac.platform.settings import settings

            app_name = getattr(settings, "app_name", "DotMac Platform")
            subject = f"Payment Reminder: Invoice {invoice.invoice_number}"

            # Determine urgency based on status
            urgency_note = ""
            if invoice.status == InvoiceStatus.OVERDUE:
                urgency_note = "\n\n⚠️ URGENT: This invoice is now OVERDUE. Please arrange payment immediately to avoid service interruption."

            # Build custom message section
            custom_msg_section = ""
            if custom_message:
                custom_msg_section = f"\n\nMessage from billing team:\n{custom_message}\n"

            # Create email content
            content = f"""
Dear Customer,

This is a friendly reminder that you have an outstanding invoice:

Invoice Number: {invoice.invoice_number}
Amount Due: {invoice.currency} {invoice.remaining_balance or invoice.total_amount}
Original Amount: {invoice.currency} {invoice.total_amount}
Due Date: {invoice.due_date.strftime("%Y-%m-%d") if invoice.due_date else "N/A"}
Status: {invoice.status.value.upper()}{urgency_note}{custom_msg_section}

Please arrange payment at your earliest convenience.

If you have already made payment, please disregard this reminder.

Thank you for your business!

Best regards,
{app_name} Team
""".strip()

            html_urgency = ""
            if invoice.status == InvoiceStatus.OVERDUE:
                html_urgency = '<p style="color: #dc2626; font-weight: bold;">⚠️ URGENT: This invoice is now OVERDUE. Please arrange payment immediately to avoid service interruption.</p>'

            html_custom_msg = ""
            if custom_message:
                html_custom_msg = f'<div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-left: 4px solid #3b82f6;"><strong>Message from billing team:</strong><p>{custom_message}</p></div>'

            html_content = f"""
<h2>Payment Reminder</h2>
<p>This is a friendly reminder that you have an outstanding invoice:</p>

<table style="margin: 20px 0; border-collapse: collapse;">
    <tr><td style="padding: 8px; font-weight: bold;">Invoice Number:</td><td style="padding: 8px;">{invoice.invoice_number}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Amount Due:</td><td style="padding: 8px;">{invoice.currency} {invoice.remaining_balance or invoice.total_amount}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Original Amount:</td><td style="padding: 8px;">{invoice.currency} {invoice.total_amount}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Due Date:</td><td style="padding: 8px;">{invoice.due_date.strftime("%Y-%m-%d") if invoice.due_date else "N/A"}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">Status:</td><td style="padding: 8px;">{invoice.status.value.upper()}</td></tr>
</table>

{html_urgency}
{html_custom_msg}

<p>Please arrange payment at your earliest convenience.</p>
<p><em>If you have already made payment, please disregard this reminder.</em></p>
<p>Thank you for your business!</p>
""".strip()

            message = EmailMessage(
                to=[email],
                subject=subject,
                text_body=content,
                html_body=html_content,
            )

            email_service = get_email_service()
            response = await email_service.send_email(message)

            success: bool = response.status == "sent"
            if success:
                logger.info(
                    "Payment reminder sent successfully",
                    tenant_id=tenant_id,
                    invoice_id=invoice_id,
                    recipient=email,
                    invoice_status=invoice.status.value,
                )
            else:
                logger.warning(
                    "Payment reminder failed to send",
                    tenant_id=tenant_id,
                    invoice_id=invoice_id,
                    recipient=email,
                )

            return success

        except Exception as e:
            logger.error(
                "Failed to send payment reminder",
                tenant_id=tenant_id,
                invoice_id=invoice_id,
                error=str(e),
            )
            return False

    async def apply_payment_to_invoice(
        self, tenant_id: str, invoice_id: str, payment_id: str, amount: int
    ) -> Invoice:
        """
        Apply a payment to an invoice.

        Args:
            tenant_id: Tenant identifier
            invoice_id: Invoice identifier
            payment_id: Payment identifier
            amount: Payment amount to apply

        Returns:
            Updated invoice

        Raises:
            InvoiceNotFoundError: If invoice doesn't exist
            InvalidInvoiceStatusError: If invoice cannot accept payments
        """
        invoice = await self._get_invoice_entity(tenant_id, invoice_id)
        if not invoice:
            raise InvoiceNotFoundError(f"Invoice {invoice_id} not found")

        # Check if invoice can accept payments
        if invoice.status not in [
            InvoiceStatus.OPEN,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE,
        ]:
            raise InvalidInvoiceStatusError(
                f"Cannot apply payment to invoice in {invoice.status} status"
            )

        # Calculate new balance
        old_balance = int(invoice.remaining_balance or invoice.total_amount)
        new_balance = max(0, old_balance - amount)

        # Update invoice
        invoice.remaining_balance = new_balance
        invoice.updated_at = datetime.now(UTC)

        # Update status based on new balance
        if new_balance == 0:
            invoice.status = InvoiceStatus.PAID
            invoice.paid_at = datetime.now(UTC)
            invoice.payment_status = PaymentStatus.SUCCEEDED
        elif new_balance < invoice.total_amount:
            invoice.status = InvoiceStatus.PARTIALLY_PAID
            invoice.payment_status = PaymentStatus.PENDING

        # Store payment reference in metadata
        current_metadata = invoice.extra_data or {}
        payments = current_metadata.get("payments", [])
        payments.append(
            {
                "payment_id": payment_id,
                "amount": float(amount),
                "applied_at": datetime.now(UTC).isoformat(),
            }
        )
        invoice.extra_data = {**current_metadata, "payments": payments}

        await self.db.commit()
        await self.db.refresh(invoice, attribute_names=["line_items"])

        # Ensure extra_data is a dict for Pydantic validation
        if invoice.extra_data is None:
            invoice.extra_data = {}

        logger.info(
            "Payment applied to invoice",
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            payment_id=payment_id,
            amount=amount,
            new_balance=new_balance,
            new_status=invoice.status,
        )

        return Invoice.model_validate(invoice)

    async def check_overdue_invoices(self, tenant_id: str) -> list[Invoice]:
        """Check for overdue invoices and update their status"""

        current_date = datetime.now(UTC)

        query = select(InvoiceEntity).where(
            and_(
                InvoiceEntity.tenant_id == tenant_id,
                InvoiceEntity.status == InvoiceStatus.OPEN,
                InvoiceEntity.due_date < current_date,
                InvoiceEntity.payment_status.not_in(
                    [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED]
                ),
            )
        )

        # Eager load line_items to avoid lazy loading issues
        query = query.options(selectinload(InvoiceEntity.line_items))

        result = await self.db.execute(query)
        overdue_invoices = result.scalars().all()

        for invoice in overdue_invoices:
            invoice.status = InvoiceStatus.OVERDUE
            invoice.updated_at = datetime.now(UTC)
            # Ensure extra_data is a dict for Pydantic validation
            if invoice.extra_data is None:
                invoice.extra_data = {}

        if overdue_invoices:
            await self.db.commit()

        return [Invoice.model_validate(invoice) for invoice in overdue_invoices]

    # ============================================================================
    # Private helper methods
    # ============================================================================

    async def _get_invoice_entity(self, tenant_id: str, invoice_id: str) -> InvoiceEntity | None:
        """Get invoice entity by ID with tenant isolation"""

        query = select(InvoiceEntity).where(
            and_(InvoiceEntity.tenant_id == tenant_id, InvoiceEntity.invoice_id == invoice_id)
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_invoice_by_idempotency_key(
        self, tenant_id: str, idempotency_key: str
    ) -> InvoiceEntity | None:
        """Get invoice by idempotency key"""

        query = select(InvoiceEntity).where(
            and_(
                InvoiceEntity.tenant_id == tenant_id,
                InvoiceEntity.idempotency_key == idempotency_key,
            )
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _generate_invoice_number(self, tenant_id: str) -> str:
        """Generate unique invoice number for tenant using advisory lock for atomicity.

        SECURITY: Uses PostgreSQL advisory lock to prevent duplicate invoice numbers
        under concurrent load. The lock is automatically released at transaction end.
        """

        # Get tenant settings for invoice number format
        # For now, use simple sequential numbering
        year = datetime.now(UTC).year

        # Use a short tenant-specific suffix to guarantee uniqueness across tenants
        import hashlib

        tenant_suffix = hashlib.sha256(tenant_id.encode()).hexdigest()[:4].upper()

        # CRITICAL: Use PostgreSQL advisory lock to prevent race conditions
        # Lock key incorporates tenant-specific suffix and year
        lock_key = int(hashlib.sha256(f"{tenant_suffix}-{year}".encode()).hexdigest()[:15], 16) % (
            2**31
        )

        # Acquire advisory lock (automatically released at transaction end)
        # Only use PostgreSQL advisory locks when using PostgreSQL
        if self.db.bind.dialect.name == "postgresql":
            await self.db.execute(text(f"SELECT pg_advisory_xact_lock({lock_key})"))
        # For SQLite and other databases, the transaction isolation provides sufficient protection

        # Now safely query for last invoice number (protected by advisory lock)
        query = (
            select(InvoiceEntity)
            .where(
                and_(
                    InvoiceEntity.tenant_id == tenant_id,
                    InvoiceEntity.invoice_number.like(f"INV-{tenant_suffix}-{year}-%"),
                )
            )
            .order_by(InvoiceEntity.invoice_number.desc())
            .limit(1)
        )

        result = await self.db.execute(query)
        last_invoice = result.scalar_one_or_none()

        if last_invoice and last_invoice.invoice_number:
            # Extract sequence number and increment
            last_seq = int(last_invoice.invoice_number.split("-")[-1])
            next_seq = last_seq + 1
        else:
            next_seq = 1

        return f"INV-{tenant_suffix}-{year}-{next_seq:06d}"

    async def _create_invoice_transaction(self, invoice: InvoiceEntity) -> None:
        """Create transaction record for invoice creation"""

        transaction = TransactionEntity(
            tenant_id=invoice.tenant_id,
            amount=invoice.total_amount,
            currency=invoice.currency,
            transaction_type=TransactionType.CHARGE,
            description=f"Invoice {invoice.invoice_number} created",
            customer_id=invoice.customer_id,
            invoice_id=invoice.invoice_id,
            extra_data={"invoice_number": invoice.invoice_number},
        )
        self.db.add(transaction)
        await self.db.commit()

    async def _create_void_transaction(self, invoice: InvoiceEntity) -> None:
        """Create transaction record for invoice void"""

        transaction = TransactionEntity(
            tenant_id=invoice.tenant_id,
            amount=-invoice.total_amount,
            currency=invoice.currency,
            transaction_type=TransactionType.ADJUSTMENT,
            description=f"Invoice {invoice.invoice_number} voided",
            customer_id=invoice.customer_id,
            invoice_id=invoice.invoice_id,
            extra_data={"action": "void", "invoice_number": invoice.invoice_number},
        )
        self.db.add(transaction)
        await self.db.commit()

    async def _send_invoice_notification(self, invoice: InvoiceEntity) -> None:
        """Send invoice notification to customer via email"""
        try:
            # Check if notifications are enabled for this tenant
            from dotmac.platform.billing.settings.service import BillingSettingsService

            settings_service = BillingSettingsService(self.db)
            tenant_id = invoice.tenant_id
            if tenant_id is None:
                logger.warning(
                    "Skipping invoice email; invoice missing tenant_id",
                    invoice_id=str(invoice.invoice_id),
                )
                return

            billing_settings = await settings_service.get_settings(tenant_id)

            # Check both invoice and notification settings
            if not billing_settings.invoice_settings.send_invoice_emails:
                logger.info(
                    "Invoice emails disabled for tenant",
                    tenant_id=tenant_id,
                    invoice_id=str(invoice.invoice_id),
                )
                return

            if not billing_settings.notification_settings.send_invoice_notifications:
                logger.info(
                    "Invoice notifications disabled for tenant",
                    tenant_id=tenant_id,
                    invoice_id=str(invoice.invoice_id),
                )
                return
            # Initialize email service with default settings
            email_service = EmailService()

            invoice_url = _build_invoice_url(invoice.invoice_id)
            amount_display = f"{invoice.currency} {invoice.total_amount / 100:.2f}"

            company_info = billing_settings.company_info
            if not invoice.billing_email:
                logger.warning(
                    "Invoice billing email missing",
                    tenant_id=tenant_id,
                    invoice_id=str(invoice.invoice_id),
                )
                return

            sender_email_value = company_info.email or email_service.default_from
            sender_email = sender_email_value  # EmailStr is a type annotation, not a constructor
            sender_name = company_info.name or "DotMac Billing"
            reply_to_email = sender_email

            recipient_email = (
                invoice.billing_email
            )  # EmailStr is a type annotation, not a constructor

            email_message = EmailMessage(
                from_email=sender_email,
                from_name=sender_name,
                reply_to=reply_to_email,
                to=[recipient_email],
                subject=f"Invoice #{invoice.invoice_number} - {amount_display}",
                html_body=f"""
                <html>
                <body style="font-family: Arial, sans-serif; color: #333;">
                    <h2>Invoice #{invoice.invoice_number}</h2>

                    <p>Dear Customer,</p>

                    <p>Your invoice has been finalized and is ready for your review.</p>

                    <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
                        <h3>Invoice Details:</h3>
                        <p><strong>Invoice Number:</strong> {invoice.invoice_number}</p>
                        <p><strong>Issue Date:</strong> {invoice.issue_date.strftime("%B %d, %Y")}</p>
                        <p><strong>Due Date:</strong> {invoice.due_date.strftime("%B %d, %Y")}</p>
                        <p><strong>Amount Due:</strong> {amount_display}</p>
                    </div>

                    <p>You can view and download your invoice at:</p>
                    <p><a href="{invoice_url}" style="color: #007bff;">{invoice_url}</a></p>

                    {f"<p><strong>Notes:</strong> {invoice.notes}</p>" if invoice.notes else ""}

                    <p>If you have any questions about this invoice, please don't hesitate to contact our support team.</p>

                    <p>Thank you for your business!</p>

                    <hr style="margin-top: 40px; border: none; border-top: 1px solid #ddd;">
                    <p style="color: #666; font-size: 12px;">
                        This is an automated notification from DotMac Platform Billing.<br>
                        Please do not reply to this email.
                    </p>
                </body>
                </html>
                """,
                text_body=f"""
Invoice #{invoice.invoice_number}

Dear Customer,

Your invoice has been finalized and is ready for your review.

Invoice Details:
- Invoice Number: {invoice.invoice_number}
- Issue Date: {invoice.issue_date.strftime("%B %d, %Y")}
- Due Date: {invoice.due_date.strftime("%B %d, %Y")}
- Amount Due: {amount_display}

You can view and download your invoice at:
{invoice_url}

{f"Notes: {invoice.notes}" if invoice.notes else ""}

If you have any questions about this invoice, please don't hesitate to contact our support team.

Thank you for your business!

---
This is an automated notification from DotMac Platform Billing.
Please do not reply to this email.
                """,
            )

            # Send the email
            await email_service.send_email(email_message, tenant_id=tenant_id)

            # Log successful notification
            from dotmac.platform.audit import ActivityType, log_system_activity

            await log_system_activity(
                activity_type=ActivityType.API_REQUEST,
                action="invoice_notification_sent",
                description="Invoice notification email dispatched",
                tenant_id=tenant_id,
                user_id=invoice.created_by,
                resource_type="invoice",
                resource_id=str(invoice.invoice_id),
                details={
                    "email": invoice.billing_email,
                    "invoice_number": invoice.invoice_number,
                },
            )

        except Exception as e:
            # Log the error but don't fail the invoice finalization
            logger.error(
                "Failed to send invoice notification",
                invoice_id=str(invoice.invoice_id),
                invoice_number=invoice.invoice_number,
                email=invoice.billing_email,
                error=str(e),
            )
            # Continue without raising - invoice is still finalized even if email fails
