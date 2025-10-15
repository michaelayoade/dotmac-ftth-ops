"""
Invoice Service using Money models for accurate currency handling.

This service extends the existing InvoiceService to use Money objects internally
while maintaining backward compatibility with the legacy integer-based system.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus
from dotmac.platform.billing.invoicing.service import InvoiceService
from dotmac.platform.billing.money_migration import InvoiceMigrationAdapter
from dotmac.platform.billing.money_models import MoneyField, MoneyInvoice
from dotmac.platform.billing.money_utils import money_handler
from dotmac.platform.billing.pdf_generator_reportlab import ReportLabInvoiceGenerator


class MoneyInvoiceService(InvoiceService):  # type: ignore[misc]  # InvoiceService resolves to Any in isolation
    """
    Invoice service that uses Money objects internally for accurate
    currency calculations while maintaining compatibility with the legacy system.
    """

    def __init__(self, db_session: AsyncSession) -> None:
        super().__init__(db_session)
        self.adapter = InvoiceMigrationAdapter()
        self.pdf_generator = ReportLabInvoiceGenerator()

    async def create_money_invoice(
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
        invoice_number: str | None = None,
    ) -> MoneyInvoice:
        """
        Create invoice using Money models for accurate currency handling.

        This method creates the invoice using Money objects internally, then
        converts to legacy format for database storage.

        Args:
            Same as parent create_invoice, but line_items use decimal strings
            for amounts instead of cents

        Returns:
            MoneyInvoice with proper currency handling
        """
        # Calculate due date if not provided
        if not due_date:
            due_days = due_days or 30
            due_date = datetime.now(UTC) + timedelta(days=due_days)

        # Generate invoice number if not provided
        if not invoice_number:
            invoice_number = await self._generate_invoice_number(tenant_id)

        # Create Money invoice
        money_invoice = MoneyInvoice.create_invoice(
            tenant_id=tenant_id,
            customer_id=customer_id,
            billing_email=billing_email,
            billing_address=billing_address,
            line_items=line_items,
            currency=currency,
            invoice_number=invoice_number,
            notes=notes,
            due_date=due_date,
            status=InvoiceStatus.DRAFT.value,
            payment_status=PaymentStatus.PENDING.value,
        )

        # Add additional fields
        money_invoice.internal_notes = internal_notes
        money_invoice.subscription_id = subscription_id
        money_invoice.created_by = created_by
        money_invoice.idempotency_key = idempotency_key

        # Convert to legacy format for database storage
        legacy_invoice = self.adapter.money_to_legacy_invoice(money_invoice)

        # Use parent class to save to database
        saved_invoice = await super().create_invoice(
            tenant_id=tenant_id,
            customer_id=customer_id,
            billing_email=billing_email,
            billing_address=billing_address,
            line_items=[item.model_dump() for item in legacy_invoice.line_items],
            currency=currency,
            due_days=due_days,
            due_date=due_date,
            notes=notes,
            internal_notes=internal_notes,
            subscription_id=subscription_id,
            created_by=created_by,
            idempotency_key=idempotency_key,
            extra_data=extra_data,
        )

        # Convert saved invoice back to Money format
        return self.adapter.legacy_to_money_invoice(saved_invoice)

    async def get_money_invoice(
        self, tenant_id: str, invoice_id: str, include_line_items: bool = True
    ) -> MoneyInvoice | None:
        """
        Get invoice and return as Money-based invoice.

        Args:
            tenant_id: Tenant ID
            invoice_id: Invoice ID
            include_line_items: Whether to include line items

        Returns:
            MoneyInvoice or None if not found
        """
        legacy_invoice = await super().get_invoice(tenant_id, invoice_id, include_line_items)

        if legacy_invoice:
            return self.adapter.legacy_to_money_invoice(legacy_invoice)

        return None

    async def generate_invoice_pdf(
        self,
        tenant_id: str,
        invoice_id: str,
        company_info: dict[str, Any] | None = None,
        customer_info: dict[str, Any] | None = None,
        payment_instructions: str | None = None,
        locale: str = "en_US",
        output_path: str | None = None,
    ) -> bytes:
        """
        Generate PDF for an invoice using the ReportLab generator.

        Args:
            tenant_id: Tenant ID
            invoice_id: Invoice ID
            company_info: Company details for the invoice
            customer_info: Additional customer details
            payment_instructions: Payment instructions text
            locale: Locale for formatting
            output_path: Optional path to save PDF

        Returns:
            PDF bytes
        """
        # Get invoice as Money invoice
        money_invoice = await self.get_money_invoice(tenant_id, invoice_id)

        if not money_invoice:
            raise ValueError(f"Invoice {invoice_id} not found")

        # Generate PDF
        pdf_bytes: bytes = self.pdf_generator.generate_invoice_pdf(
            invoice=money_invoice,
            company_info=company_info,
            customer_info=customer_info,
            payment_instructions=payment_instructions,
            locale=locale,
            output_path=output_path,
        )

        return pdf_bytes

    async def apply_percentage_discount(
        self,
        tenant_id: str,
        invoice_id: str,
        discount_percentage: float,
        reason: str | None = None,
    ) -> MoneyInvoice:
        """
        Apply a percentage discount to an invoice using Money calculations.

        Args:
            tenant_id: Tenant ID
            invoice_id: Invoice ID
            discount_percentage: Discount percentage (0-100)
            reason: Reason for discount

        Returns:
            Updated MoneyInvoice
        """
        # Get invoice
        money_invoice = await self.get_money_invoice(tenant_id, invoice_id)

        if not money_invoice:
            raise ValueError(f"Invoice {invoice_id} not found")

        # Convert existing amounts to Money objects
        subtotal_money = money_invoice.subtotal.to_money()
        tax_money = money_invoice.tax_amount.to_money()
        # Calculate discount amount using Money
        discount_rate = Decimal(str(discount_percentage)) / Decimal("100")
        discount_money = money_handler.round_money(
            money_handler.multiply_money(subtotal_money, discount_rate)
        )

        # Update invoice discount amount
        money_invoice.discount_amount = MoneyField.from_money(discount_money)

        # Recalculate totals (subtotal already includes tax per line item)
        negative_discount = money_handler.multiply_money(discount_money, Decimal("-1"))
        total_money = money_handler.add_money(subtotal_money, tax_money, negative_discount)

        money_invoice.total_amount = MoneyField.from_money(total_money)
        money_invoice.remaining_balance = MoneyField.from_money(total_money)

        # Add reason to notes
        if reason:
            note = f"Discount applied ({discount_percentage}%): {reason}"
            if money_invoice.internal_notes:
                money_invoice.internal_notes += f"\n{note}"
            else:
                money_invoice.internal_notes = note

        # Convert to legacy format and update in database
        legacy_invoice = self.adapter.money_to_legacy_invoice(money_invoice)

        # Update the invoice entity in the database
        invoice_entity = await self._get_invoice_entity(tenant_id, invoice_id)
        if invoice_entity:
            invoice_entity.discount_amount = legacy_invoice.discount_amount
            invoice_entity.total_amount = legacy_invoice.total_amount
            invoice_entity.internal_notes = legacy_invoice.internal_notes
            invoice_entity.updated_at = datetime.now(UTC)

            await self.db.commit()
            await self.db.refresh(invoice_entity)

        return money_invoice

    async def calculate_tax_for_jurisdiction(
        self,
        tenant_id: str,
        invoice_id: str,
        tax_jurisdiction: str,
        tax_rates: dict[str, float],
    ) -> MoneyInvoice:
        """
        Recalculate tax for an invoice based on jurisdiction using Money precision.

        Args:
            tenant_id: Tenant ID
            invoice_id: Invoice ID
            tax_jurisdiction: Tax jurisdiction code
            tax_rates: Map of product types to tax rates

        Returns:
            Updated MoneyInvoice with recalculated tax
        """
        # Get invoice
        money_invoice = await self.get_money_invoice(tenant_id, invoice_id)

        if not money_invoice:
            raise ValueError(f"Invoice {invoice_id} not found")

        # Recalculate tax for each line item
        total_tax = money_handler.create_money("0", money_invoice.currency)

        for line_item in money_invoice.line_items:
            # Determine tax rate for this item
            # (In real implementation, would look up based on product type)
            tax_rate_value = Decimal(str(tax_rates.get("default", 0)))

            # Calculate tax using Money
            line_item.tax_rate = tax_rate_value
            line_total_money = line_item.total_price.to_money()
            tax_money = money_handler.round_money(
                money_handler.multiply_money(line_total_money, tax_rate_value)
            )
            line_item.tax_amount = MoneyField.from_money(tax_money)

            # Add to total tax
            total_tax = money_handler.add_money(total_tax, tax_money)

        # Update invoice totals
        subtotal_money = money_invoice.subtotal.to_money()
        money_invoice.tax_amount = MoneyField.from_money(total_tax)
        total_money = money_handler.add_money(subtotal_money, total_tax)

        if money_invoice.discount_amount:
            discount_money = money_invoice.discount_amount.to_money()
            total_money = money_handler.add_money(
                total_money, money_handler.multiply_money(discount_money, Decimal("-1"))
            )

        money_invoice.total_amount = MoneyField.from_money(total_money)
        money_invoice.remaining_balance = MoneyField.from_money(total_money)

        return money_invoice

    async def generate_batch_invoices_pdf(
        self,
        tenant_id: str,
        invoice_ids: list[str],
        output_dir: str,
        company_info: dict[str, Any] | None = None,
        locale: str = "en_US",
    ) -> list[str]:
        """
        Generate PDF files for multiple invoices.

        Args:
            tenant_id: Tenant ID
            invoice_ids: List of invoice IDs
            output_dir: Directory to save PDFs
            company_info: Company details
            locale: Locale for formatting

        Returns:
            List of generated file paths
        """
        money_invoices = []

        for invoice_id in invoice_ids:
            invoice = await self.get_money_invoice(tenant_id, invoice_id)
            if invoice:
                money_invoices.append(invoice)

        if not money_invoices:
            return []

        # Generate PDFs
        output_paths: list[str] = self.pdf_generator.generate_batch_invoices(
            invoices=money_invoices,
            output_dir=output_dir,
            company_info=company_info,
            locale=locale,
        )

        return output_paths


# Convenience functions for direct Money invoice creation
def create_money_line_item(
    description: str,
    quantity: int,
    unit_price: str | float,
    currency: str = "USD",
    tax_rate: float = 0,
    discount_percentage: float = 0,
    product_id: str | None = None,
) -> dict[str, Any]:
    """
    Helper to create a line item dict for Money invoice creation.

    Args:
        description: Item description
        quantity: Quantity
        unit_price: Unit price as decimal string or float
        currency: Currency code
        tax_rate: Tax rate (0-1, e.g., 0.1 for 10%)
        discount_percentage: Discount (0-1, e.g., 0.2 for 20%)
        product_id: Optional product ID

    Returns:
        Line item dict for Money invoice creation
    """
    line_item = {
        "description": description,
        "quantity": quantity,
        "unit_price": str(unit_price),
        "tax_rate": tax_rate,
        "discount_percentage": discount_percentage,
    }

    if product_id:
        line_item["product_id"] = product_id

    return line_item
