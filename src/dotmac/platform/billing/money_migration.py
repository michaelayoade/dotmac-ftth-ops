"""
Migration utilities for converting between legacy Decimal/int and Money-based invoices.

Provides seamless conversion between the existing invoice system (using integers
for cents) and the new Money-based system with proper currency handling.
"""

from decimal import Decimal
from typing import Any, cast

import structlog

from dotmac.platform.billing.core.models import Invoice as LegacyInvoice
from dotmac.platform.billing.core.models import InvoiceLineItem as LegacyLineItem
from dotmac.platform.billing.money_models import MoneyField, MoneyInvoice
from dotmac.platform.billing.money_utils import money_handler

logger = structlog.get_logger(__name__)


class InvoiceMigrationAdapter:
    """Adapter for migrating between legacy and Money-based invoice systems."""

    @staticmethod
    def legacy_to_money_invoice(legacy_invoice: LegacyInvoice) -> MoneyInvoice:
        """
        Convert legacy invoice (using int cents) to Money-based invoice.

        Args:
            legacy_invoice: Legacy invoice with amounts in cents

        Returns:
            MoneyInvoice with proper Money objects
        """
        # Convert line items
        line_items = []
        for legacy_item in legacy_invoice.line_items:
            # Convert from cents to decimal amount
            unit_price_decimal = Decimal(legacy_item.unit_price) / 100

            line_item_data = {
                "description": legacy_item.description,
                "quantity": legacy_item.quantity,
                "unit_price": str(unit_price_decimal),
                "tax_rate": legacy_item.tax_rate / 100 if legacy_item.tax_rate else 0,
                "discount_percentage": (
                    legacy_item.discount_percentage / 100 if legacy_item.discount_percentage else 0
                ),
            }

            # Add optional fields
            if legacy_item.product_id:
                line_item_data["product_id"] = legacy_item.product_id
            if legacy_item.line_item_id:
                line_item_data["line_item_id"] = legacy_item.line_item_id

            line_items.append(line_item_data)

        # Create Money invoice
        money_invoice = MoneyInvoice.create_invoice(
            tenant_id=legacy_invoice.tenant_id,
            customer_id=legacy_invoice.customer_id or "",
            billing_email=legacy_invoice.billing_email or "",
            line_items=line_items,
            currency=legacy_invoice.currency,
            invoice_number=legacy_invoice.invoice_number,
            billing_address=legacy_invoice.billing_address,
            notes=legacy_invoice.notes,
            due_date=legacy_invoice.due_date,
            status=legacy_invoice.status,
            payment_status=legacy_invoice.payment_status,
        )

        # Preserve additional fields
        money_invoice.invoice_id = legacy_invoice.invoice_id
        money_invoice.created_at = legacy_invoice.created_at
        money_invoice.updated_at = legacy_invoice.updated_at
        money_invoice.paid_at = legacy_invoice.paid_at
        money_invoice.voided_at = legacy_invoice.voided_at
        money_invoice.subscription_id = legacy_invoice.subscription_id
        money_invoice.internal_notes = legacy_invoice.internal_notes
        money_invoice.created_by = legacy_invoice.created_by
        money_invoice.idempotency_key = legacy_invoice.idempotency_key

        # Handle credits if present
        if legacy_invoice.total_credits_applied:
            credit_amount = Decimal(legacy_invoice.total_credits_applied) / 100
            credit_money = money_handler.create_money(str(credit_amount), legacy_invoice.currency)
            money_invoice.total_credits_applied = MoneyField.from_money(credit_money)

        return money_invoice

    @staticmethod
    def money_to_legacy_invoice(money_invoice: MoneyInvoice) -> LegacyInvoice:
        """
        Convert Money-based invoice back to legacy format for compatibility.

        Args:
            money_invoice: Money-based invoice

        Returns:
            Legacy invoice with amounts in cents
        """
        # Convert line items to legacy format
        legacy_items = []
        for money_item in money_invoice.line_items:
            # Convert Money amounts to cents (amount is a string)
            unit_price_cents = int(Decimal(money_item.unit_price.amount) * 100)
            total_price_cents = int(Decimal(money_item.total_price.amount) * 100)
            tax_amount_cents = int(Decimal(money_item.tax_amount.amount) * 100)
            discount_amount_cents = int(Decimal(money_item.discount_amount.amount) * 100)

            legacy_item = LegacyLineItem(
                line_item_id=money_item.line_item_id,
                description=money_item.description,
                quantity=money_item.quantity,
                unit_price=unit_price_cents,
                total_price=total_price_cents,
                product_id=money_item.product_id,
                subscription_id=money_item.subscription_id,
                tax_rate=float(money_item.tax_rate * 100) if money_item.tax_rate else 0,
                tax_amount=tax_amount_cents,
                discount_percentage=(
                    float(money_item.discount_percentage * 100)
                    if money_item.discount_percentage
                    else 0
                ),
                discount_amount=discount_amount_cents,
            )
            legacy_items.append(legacy_item)

        # Convert main invoice amounts to cents (amount is a string)
        subtotal_cents = int(Decimal(money_invoice.subtotal.amount) * 100)
        tax_amount_cents = (
            int(Decimal(money_invoice.tax_amount.amount) * 100) if money_invoice.tax_amount else 0
        )
        discount_amount_cents = (
            int(Decimal(money_invoice.discount_amount.amount) * 100)
            if money_invoice.discount_amount
            else 0
        )
        total_amount_cents = int(Decimal(money_invoice.total_amount.amount) * 100)

        net_amount_due_field = cast(MoneyField, money_invoice.net_amount_due)
        net_due_money = net_amount_due_field.to_money()
        remaining_balance_cents = int(Decimal(net_due_money.amount) * 100)
        credits_applied_cents = 0

        # Create legacy invoice
        legacy_invoice = LegacyInvoice(
            tenant_id=money_invoice.tenant_id,
            invoice_id=money_invoice.invoice_id,
            invoice_number=money_invoice.invoice_number,
            idempotency_key=money_invoice.idempotency_key,
            created_by=money_invoice.created_by,
            customer_id=money_invoice.customer_id,
            billing_email=money_invoice.billing_email,
            billing_address=money_invoice.billing_address or {},
            issue_date=money_invoice.issue_date,
            due_date=money_invoice.due_date,
            currency=money_invoice.currency,
            subtotal=subtotal_cents,
            tax_amount=tax_amount_cents,
            discount_amount=discount_amount_cents,
            total_amount=total_amount_cents,
            remaining_balance=remaining_balance_cents,
            status=money_invoice.status,
            payment_status=money_invoice.payment_status,
            line_items=legacy_items,
            subscription_id=money_invoice.subscription_id,
            notes=money_invoice.notes,
            internal_notes=money_invoice.internal_notes,
            created_at=money_invoice.created_at,
            updated_at=money_invoice.updated_at,
            paid_at=money_invoice.paid_at,
            voided_at=money_invoice.voided_at,
            total_credits_applied=credits_applied_cents,
            credit_applications=[],
        )

        # Handle credits
        if money_invoice.total_credits_applied:
            legacy_invoice.total_credits_applied = int(
                Decimal(money_invoice.total_credits_applied.amount) * 100
            )

        return legacy_invoice

    @staticmethod
    def cents_to_money(cents: int, currency: str = "USD") -> str:
        """
        Convert cents to Money-compatible decimal string.

        Args:
            cents: Amount in cents
            currency: Currency code

        Returns:
            Decimal string for Money creation
        """
        return str(Decimal(cents) / 100)

    @staticmethod
    def money_to_cents(money_str: str | Decimal) -> int:
        """
        Convert Money amount to cents for legacy compatibility.

        Args:
            money_str: Money amount as string or Decimal

        Returns:
            Amount in cents as integer
        """
        if isinstance(money_str, str):
            decimal_amount = Decimal(money_str)
        else:
            decimal_amount = money_str
        return int(decimal_amount * 100)


class BatchMigrationService:
    """Service for batch migrating existing invoices to Money format."""

    def __init__(self) -> None:
        self.adapter = InvoiceMigrationAdapter()

    async def migrate_invoices_batch(
        self, legacy_invoices: list[LegacyInvoice], preserve_ids: bool = True
    ) -> list[MoneyInvoice]:
        """
        Migrate a batch of legacy invoices to Money format.

        Args:
            legacy_invoices: List of legacy invoices
            preserve_ids: Whether to preserve original invoice IDs

        Returns:
            List of Money-based invoices
        """
        money_invoices = []

        for legacy_invoice in legacy_invoices:
            try:
                money_invoice = self.adapter.legacy_to_money_invoice(legacy_invoice)

                if not preserve_ids:
                    # Generate new IDs if requested
                    money_invoice.invoice_id = None

                money_invoices.append(money_invoice)

            except Exception as e:
                # Log error but continue with other invoices
                logger.error(
                    "invoice.migration.error",
                    invoice_id=legacy_invoice.invoice_id,
                    error=str(e),
                    error_type=type(e).__name__,
                )
                continue

        return money_invoices

    def validate_migration(
        self, legacy_invoice: LegacyInvoice, money_invoice: MoneyInvoice
    ) -> dict[str, Any]:
        """
        Validate that migration preserved all important data.

        Args:
            legacy_invoice: Original legacy invoice
            money_invoice: Migrated Money invoice

        Returns:
            Validation results with any discrepancies
        """
        issues = []

        # Check totals match
        legacy_total_cents = legacy_invoice.total_amount
        money_total_cents = InvoiceMigrationAdapter.money_to_cents(
            money_invoice.total_amount.amount
        )

        if legacy_total_cents != money_total_cents:
            issues.append(
                {
                    "field": "total_amount",
                    "legacy": legacy_total_cents,
                    "money": money_total_cents,
                    "difference": money_total_cents - legacy_total_cents,
                }
            )

        # Check line items count
        if len(legacy_invoice.line_items) != len(money_invoice.line_items):
            issues.append(
                {
                    "field": "line_items_count",
                    "legacy": len(legacy_invoice.line_items),
                    "money": len(money_invoice.line_items),
                }
            )

        # Check customer data preserved
        if legacy_invoice.customer_id != money_invoice.customer_id:
            issues.append(
                {
                    "field": "customer_id",
                    "legacy": legacy_invoice.customer_id,
                    "money": money_invoice.customer_id,
                }
            )

        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "invoice_number": legacy_invoice.invoice_number,
        }
