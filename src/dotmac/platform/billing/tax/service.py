"""
Tax management service
"""

import logging
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.billing.core.entities import InvoiceEntity, TransactionEntity
from dotmac.platform.billing.core.enums import TransactionType
from dotmac.platform.billing.tax.calculator import TaxCalculator

logger = logging.getLogger(__name__)


class TaxService:
    """Service for managing tax calculations and records"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.calculator = TaxCalculator()
        self._initialize_default_rates()

    def _initialize_default_rates(self) -> None:
        """Initialize default tax rates"""
        # US Sales Tax examples
        self.calculator.add_tax_rate(
            jurisdiction="US-CA",
            name="California Sales Tax",
            rate=7.25,
            tax_type="sales",
        )
        self.calculator.add_tax_rate(
            jurisdiction="US-NY",
            name="New York Sales Tax",
            rate=8.875,
            tax_type="sales",
        )
        self.calculator.add_tax_rate(
            jurisdiction="US-TX",
            name="Texas Sales Tax",
            rate=6.25,
            tax_type="sales",
        )

        # EU VAT examples
        self.calculator.add_tax_rate(
            jurisdiction="EU-DE",
            name="German VAT",
            rate=19.0,
            tax_type="vat",
            is_inclusive=True,
        )
        self.calculator.add_tax_rate(
            jurisdiction="EU-FR",
            name="French VAT",
            rate=20.0,
            tax_type="vat",
            is_inclusive=True,
        )
        self.calculator.add_tax_rate(
            jurisdiction="EU-GB",
            name="UK VAT",
            rate=20.0,
            tax_type="vat",
            is_inclusive=True,
        )

        # Canadian GST/PST examples
        self.calculator.add_tax_rate(
            jurisdiction="CA-ON",
            name="Ontario HST",
            rate=13.0,
            tax_type="hst",
        )
        self.calculator.add_tax_rate(
            jurisdiction="CA-BC",
            name="BC GST",
            rate=5.0,
            tax_type="gst",
        )
        self.calculator.add_tax_rate(
            jurisdiction="CA-BC",
            name="BC PST",
            rate=7.0,
            tax_type="pst",
            is_compound=True,  # PST compounds on GST
        )

    async def calculate_invoice_tax(
        self,
        tenant_id: str,
        invoice_id: str,
        jurisdiction: str,
        line_items: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Calculate tax for an invoice"""

        # Calculate tax for line items
        total_tax, items_with_tax = self.calculator.calculate_line_item_tax(
            line_items=line_items,
            jurisdiction=jurisdiction,
        )

        # Store tax calculation in transaction
        await self._create_tax_transaction(
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            tax_amount=total_tax,
            jurisdiction=jurisdiction,
        )

        return {
            "tax_amount": total_tax,
            "line_items": items_with_tax,
            "jurisdiction": jurisdiction,
            "effective_rate": float(self.calculator.get_effective_rate(jurisdiction)),
        }

    async def recalculate_invoice_tax(
        self,
        tenant_id: str,
        invoice_id: str,
        jurisdiction: str | None = None,
    ) -> dict[str, Any]:
        """Recalculate tax for an existing invoice"""

        # Get invoice
        invoice = await self._get_invoice(tenant_id, invoice_id)
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found")

        # Use provided jurisdiction or invoice's jurisdiction
        tax_jurisdiction = jurisdiction or self._extract_jurisdiction(invoice.billing_address)

        # Convert line items to dict format
        line_items: list[dict[str, Any]] = [
            {
                "description": item.description,
                "amount": item.total_price,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "tax_exempt": getattr(item, "tax_exempt", False),
            }
            for item in invoice.line_items
        ]

        # Calculate tax
        result = await self.calculate_invoice_tax(
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            jurisdiction=tax_jurisdiction,
            line_items=line_items,
        )

        # Update invoice tax amount
        invoice.tax_amount = result["tax_amount"]
        invoice.total_amount = invoice.subtotal + invoice.tax_amount - invoice.discount_amount
        invoice.updated_at = datetime.now(UTC)

        await self.db.commit()

        return result

    async def get_tax_summary_by_jurisdiction(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> list[dict[str, Any]]:
        """Get tax summary grouped by jurisdiction"""

        # Query transactions for tax amounts
        stmt = (
            select(
                TransactionEntity.extra_data["jurisdiction"].label("jurisdiction"),
                func.sum(TransactionEntity.amount).label("total_tax"),
                func.count(TransactionEntity.transaction_id).label("transaction_count"),
            )
            .where(
                and_(
                    TransactionEntity.tenant_id == tenant_id,
                    TransactionEntity.transaction_type == TransactionType.TAX,
                    TransactionEntity.transaction_date >= start_date,
                    TransactionEntity.transaction_date <= end_date,
                )
            )
            .group_by(TransactionEntity.extra_data["jurisdiction"])
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        summary: list[dict[str, Any]] = []
        for row in rows:
            summary.append(
                {
                    "jurisdiction": row.jurisdiction,
                    "total_tax_collected": row.total_tax,
                    "transaction_count": row.transaction_count,
                    "period_start": start_date.isoformat(),
                    "period_end": end_date.isoformat(),
                }
            )

        return summary

    async def get_tax_liability_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        jurisdiction: str | None = None,
    ) -> dict[str, Any]:
        """Generate tax liability report"""

        # Build query
        conditions = [
            TransactionEntity.tenant_id == tenant_id,
            TransactionEntity.transaction_type == TransactionType.TAX,
            TransactionEntity.transaction_date >= start_date,
            TransactionEntity.transaction_date <= end_date,
        ]

        if jurisdiction:
            conditions.append(TransactionEntity.extra_data["jurisdiction"] == jurisdiction)

        # Get tax collected
        stmt = select(
            func.sum(TransactionEntity.amount).label("tax_collected"),
            func.count(TransactionEntity.transaction_id).label("transaction_count"),
        ).where(and_(*conditions))

        result = await self.db.execute(stmt)
        row = result.one()

        # Get refunded tax (from credit notes)
        refund_conditions = conditions.copy()
        refund_conditions[1] = TransactionEntity.transaction_type == TransactionType.CREDIT

        refund_stmt = select(func.sum(TransactionEntity.amount).label("tax_refunded")).where(
            and_(*refund_conditions)
        )

        refund_result = await self.db.execute(refund_stmt)
        refund_row = refund_result.one()

        tax_collected = row.tax_collected or 0
        tax_refunded = refund_row.tax_refunded or 0

        return {
            "tenant_id": tenant_id,
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "jurisdiction": jurisdiction,
            "tax_collected": tax_collected,
            "tax_refunded": tax_refunded,
            "net_tax_liability": tax_collected - tax_refunded,
            "transaction_count": row.transaction_count,
        }

    async def validate_tax_number(
        self,
        tax_number: str,
        jurisdiction: str,
    ) -> dict[str, Any]:
        """Validate a tax identification number"""

        # Basic validation rules by jurisdiction
        validation_rules: dict[str, Callable[[str], tuple[bool, str]]] = {
            "EU": self._validate_eu_vat,
            "US": self._validate_us_ein,
            "CA": self._validate_ca_gst,
        }

        # Determine validation method
        for prefix, validator in validation_rules.items():
            if jurisdiction.startswith(prefix):
                is_valid, message = validator(tax_number)
                return {
                    "tax_number": tax_number,
                    "jurisdiction": jurisdiction,
                    "is_valid": is_valid,
                    "message": message,
                    "validated_at": datetime.now(UTC).isoformat(),
                }

        return {
            "tax_number": tax_number,
            "jurisdiction": jurisdiction,
            "is_valid": False,
            "message": f"No validation rules for jurisdiction {jurisdiction}",
        }

    def _validate_eu_vat(self, vat_number: str) -> tuple[bool, str]:
        """Validate EU VAT number format"""

        # Remove spaces and uppercase
        vat = vat_number.replace(" ", "").upper()

        # Basic format check (2 letter country code + numbers)
        if len(vat) < 8 or not vat[:2].isalpha():
            return False, "Invalid VAT number format"

        # In production, this would call VIES API
        return True, "Format valid (online verification not implemented)"

    def _validate_us_ein(self, ein: str) -> tuple[bool, str]:
        """Validate US EIN format"""

        # Remove hyphens
        ein_clean = ein.replace("-", "")

        # Check format (9 digits)
        if not ein_clean.isdigit() or len(ein_clean) != 9:
            return False, "EIN must be 9 digits"

        return True, "Valid EIN format"

    def _validate_ca_gst(self, gst_number: str) -> tuple[bool, str]:
        """Validate Canadian GST number format"""

        # Remove spaces
        gst = gst_number.replace(" ", "").upper()

        # Check format (9 digits + RT + 4 digits)
        if len(gst) != 15 or not gst[9:11] == "RT":
            return False, "Invalid GST number format"

        return True, "Valid GST format"

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

    async def _create_tax_transaction(
        self,
        tenant_id: str,
        invoice_id: str,
        tax_amount: int,
        jurisdiction: str,
    ) -> None:
        """Create tax transaction record"""

        transaction = TransactionEntity(
            tenant_id=tenant_id,
            transaction_id=str(uuid4()),
            transaction_type=TransactionType.TAX,
            amount=tax_amount,
            currency="USD",  # Should come from settings
            customer_id="system",  # Tax transactions are system-generated
            invoice_id=invoice_id,
            description=f"Tax calculation for invoice {invoice_id}",
            extra_data={
                "jurisdiction": jurisdiction,
                "calculated_at": datetime.now(UTC).isoformat(),
            },
            transaction_date=datetime.now(UTC),
        )
        self.db.add(transaction)
        await self.db.commit()

    def _extract_jurisdiction(self, billing_address: Mapping[str, Any]) -> str:
        """Extract tax jurisdiction from billing address"""

        country_value = billing_address.get("country")
        country = country_value if isinstance(country_value, str) else "US"
        state_value = billing_address.get("state")
        state = state_value if isinstance(state_value, str) else ""

        # Format jurisdiction code
        if country == "US" and state:
            return f"US-{state.upper()}"
        elif country in ["DE", "FR", "GB", "IT", "ES"]:
            return f"EU-{country.upper()}"
        elif country == "CA" and state:
            return f"CA-{state.upper()}"
        else:
            return country.upper()
