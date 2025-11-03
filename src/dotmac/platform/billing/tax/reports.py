"""
Tax report generation
"""

import csv
import io
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import InvoiceEntity
from dotmac.platform.billing.core.enums import InvoiceStatus
from dotmac.platform.billing.tax.service import TaxService

logger = logging.getLogger(__name__)


class TaxReportGenerator:
    """Generate tax reports for compliance and filing"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.tax_service = TaxService(db_session)

    async def generate_quarterly_report(
        self,
        tenant_id: str,
        year: int,
        quarter: int,
        jurisdiction: str | None = None,
    ) -> dict[str, Any]:
        """Generate quarterly tax report"""

        # Calculate date range
        start_month = (quarter - 1) * 3 + 1
        start_date = datetime(year, start_month, 1)

        if quarter == 4:
            end_date = datetime(year + 1, 1, 1) - timedelta(seconds=1)
        else:
            end_date = datetime(year, start_month + 3, 1) - timedelta(seconds=1)

        # Get tax summary by jurisdiction
        summary_by_jurisdiction = await self.tax_service.get_tax_summary_by_jurisdiction(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
        )

        # Get overall liability
        liability = await self.tax_service.get_tax_liability_report(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            jurisdiction=jurisdiction,
        )

        # Get invoice statistics
        invoice_stats = await self._get_invoice_statistics(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
        )

        return {
            "report_type": "quarterly_tax_report",
            "tenant_id": tenant_id,
            "year": year,
            "quarter": quarter,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "summary_by_jurisdiction": summary_by_jurisdiction,
            "total_liability": liability,
            "invoice_statistics": invoice_stats,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def generate_annual_report(
        self,
        tenant_id: str,
        year: int,
    ) -> dict[str, Any]:
        """Generate annual tax report"""

        start_date = datetime(year, 1, 1)
        end_date = datetime(year + 1, 1, 1) - timedelta(seconds=1)

        # Get quarterly breakdowns
        quarterly_reports = []
        for quarter in range(1, 5):
            q_report = await self.generate_quarterly_report(
                tenant_id=tenant_id,
                year=year,
                quarter=quarter,
            )
            quarterly_reports.append(q_report)

        # Get annual summary
        annual_summary = await self.tax_service.get_tax_summary_by_jurisdiction(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
        )

        # Get annual liability
        annual_liability = await self.tax_service.get_tax_liability_report(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
        )

        return {
            "report_type": "annual_tax_report",
            "tenant_id": tenant_id,
            "year": year,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "quarterly_breakdown": quarterly_reports,
            "annual_summary": annual_summary,
            "annual_liability": annual_liability,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def generate_sales_tax_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        state: str,
    ) -> dict[str, Any]:
        """Generate state sales tax report (US specific)"""

        jurisdiction = f"US-{state.upper()}"

        # Get liability for state
        liability = await self.tax_service.get_tax_liability_report(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            jurisdiction=jurisdiction,
        )

        # Get taxable sales
        taxable_sales = await self._get_taxable_sales(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            jurisdiction=jurisdiction,
        )

        # Get exempt sales
        exempt_sales = await self._get_exempt_sales(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            jurisdiction=jurisdiction,
        )

        return {
            "report_type": "sales_tax_report",
            "tenant_id": tenant_id,
            "state": state,
            "jurisdiction": jurisdiction,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "taxable_sales": taxable_sales,
            "exempt_sales": exempt_sales,
            "tax_collected": liability["tax_collected"],
            "tax_refunded": liability["tax_refunded"],
            "net_tax_due": liability["net_tax_liability"],
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def generate_vat_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        country: str,
    ) -> dict[str, Any]:
        """Generate VAT report (EU specific)"""

        jurisdiction = f"EU-{country.upper()}"

        # Get VAT liability
        liability = await self.tax_service.get_tax_liability_report(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            jurisdiction=jurisdiction,
        )

        # Get VAT transactions
        vat_transactions = await self._get_vat_transactions(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            jurisdiction=jurisdiction,
        )

        # Calculate VAT summary
        standard_rate_sales = sum(
            t["amount"] for t in vat_transactions if t.get("rate") == "standard"
        )
        reduced_rate_sales = sum(
            t["amount"] for t in vat_transactions if t.get("rate") == "reduced"
        )
        zero_rate_sales = sum(t["amount"] for t in vat_transactions if t.get("rate") == "zero")

        return {
            "report_type": "vat_report",
            "tenant_id": tenant_id,
            "country": country,
            "jurisdiction": jurisdiction,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "sales_breakdown": {
                "standard_rate": standard_rate_sales,
                "reduced_rate": reduced_rate_sales,
                "zero_rate": zero_rate_sales,
                "total": standard_rate_sales + reduced_rate_sales + zero_rate_sales,
            },
            "vat_collected": liability["tax_collected"],
            "vat_refunded": liability["tax_refunded"],
            "net_vat_due": liability["net_tax_liability"],
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def export_tax_report_csv(
        self,
        report_data: dict[str, Any],
        report_type: str = "summary",
    ) -> str:
        """Export tax report to CSV format"""

        output = io.StringIO()

        if report_type == "summary":
            writer = csv.DictWriter(
                output,
                fieldnames=[
                    "jurisdiction",
                    "tax_collected",
                    "tax_refunded",
                    "net_liability",
                    "transaction_count",
                ],
            )
            writer.writeheader()

            for item in report_data.get("summary_by_jurisdiction", []):
                writer.writerow(
                    {
                        "jurisdiction": item["jurisdiction"],
                        "tax_collected": item["total_tax_collected"],
                        "tax_refunded": 0,  # Would need to calculate
                        "net_liability": item["total_tax_collected"],
                        "transaction_count": item["transaction_count"],
                    }
                )

        elif report_type == "detailed":
            writer = csv.DictWriter(
                output,
                fieldnames=[
                    "date",
                    "invoice_id",
                    "customer_id",
                    "jurisdiction",
                    "subtotal",
                    "tax_amount",
                    "total",
                ],
            )
            writer.writeheader()

            # Would need to implement detailed transaction export

        return output.getvalue()

    async def _get_invoice_statistics(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> dict[str, Any]:
        """Get invoice statistics for period"""

        stmt = select(
            func.count(InvoiceEntity.invoice_id).label("total_invoices"),
            func.sum(InvoiceEntity.subtotal).label("total_sales"),
            func.sum(InvoiceEntity.tax_amount).label("total_tax"),
            func.sum(InvoiceEntity.total_amount).label("total_with_tax"),
        ).where(
            and_(
                InvoiceEntity.tenant_id == tenant_id,
                InvoiceEntity.issue_date >= start_date,
                InvoiceEntity.issue_date <= end_date,
                InvoiceEntity.status != InvoiceStatus.VOID,
            )
        )

        result = await self.db.execute(stmt)
        row = result.one()

        return {
            "total_invoices": row.total_invoices or 0,
            "total_sales": row.total_sales or 0,
            "total_tax": row.total_tax or 0,
            "total_with_tax": row.total_with_tax or 0,
        }

    async def _get_taxable_sales(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        jurisdiction: str,
    ) -> dict[str, Any]:
        """Get taxable sales for period and jurisdiction"""

        # This would query invoices with tax > 0 for the jurisdiction
        stmt = select(
            func.sum(InvoiceEntity.subtotal).label("taxable_amount"),
            func.count(InvoiceEntity.invoice_id).label("invoice_count"),
        ).where(
            and_(
                InvoiceEntity.tenant_id == tenant_id,
                InvoiceEntity.issue_date >= start_date,
                InvoiceEntity.issue_date <= end_date,
                InvoiceEntity.tax_amount > 0,
                InvoiceEntity.status != InvoiceStatus.VOID,
            )
        )

        result = await self.db.execute(stmt)
        row = result.one()

        return {
            "taxable_amount": row.taxable_amount or 0,
            "invoice_count": row.invoice_count or 0,
        }

    async def _get_exempt_sales(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        jurisdiction: str,
    ) -> dict[str, Any]:
        """Get tax-exempt sales for period and jurisdiction"""

        # This would query invoices with tax = 0 for the jurisdiction
        stmt = select(
            func.sum(InvoiceEntity.subtotal).label("exempt_amount"),
            func.count(InvoiceEntity.invoice_id).label("invoice_count"),
        ).where(
            and_(
                InvoiceEntity.tenant_id == tenant_id,
                InvoiceEntity.issue_date >= start_date,
                InvoiceEntity.issue_date <= end_date,
                InvoiceEntity.tax_amount == 0,
                InvoiceEntity.status != InvoiceStatus.VOID,
            )
        )

        result = await self.db.execute(stmt)
        row = result.one()

        return {
            "exempt_amount": row.exempt_amount or 0,
            "invoice_count": row.invoice_count or 0,
        }

    async def _get_vat_transactions(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        jurisdiction: str,
    ) -> list[dict[str, Any]]:
        """Get VAT transactions for period"""

        # This would be more complex in production
        # For now, return empty list
        return []
