"""
Billing reports service - Main orchestrator for all billing reports
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any, cast

from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.reports.generators import (
    AgingReportGenerator,
    CustomerReportGenerator,
    RevenueReportGenerator,
)
from dotmac.platform.billing.tax.reports import TaxReportGenerator
from dotmac.platform.billing.utils.currency import format_money

logger = logging.getLogger(__name__)


class ReportType(Enum):
    """Available report types"""

    REVENUE = "revenue"
    CUSTOMER = "customer"
    AGING = "aging"
    TAX = "tax"
    SUMMARY = "summary"
    DETAILED_TRANSACTIONS = "detailed_transactions"
    PAYMENT_METHODS = "payment_methods"
    REFUNDS = "refunds"


class ReportPeriod(Enum):
    """Predefined report periods"""

    TODAY = "today"
    YESTERDAY = "yesterday"
    THIS_WEEK = "this_week"
    LAST_WEEK = "last_week"
    THIS_MONTH = "this_month"
    LAST_MONTH = "last_month"
    THIS_QUARTER = "this_quarter"
    LAST_QUARTER = "last_quarter"
    THIS_YEAR = "this_year"
    LAST_YEAR = "last_year"
    CUSTOM = "custom"


class BillingReportService:
    """Main service for generating billing reports"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.revenue_generator = RevenueReportGenerator(db_session)
        self.customer_generator = CustomerReportGenerator(db_session)
        self.aging_generator = AgingReportGenerator(db_session)
        self.tax_generator = TaxReportGenerator(db_session)

    async def generate_executive_summary(
        self,
        tenant_id: str,
        period: ReportPeriod = ReportPeriod.THIS_MONTH,
        custom_start: datetime | None = None,
        custom_end: datetime | None = None,
    ) -> dict[str, Any]:
        """Generate executive summary report with key metrics"""

        # Calculate date range
        start_date, end_date = self._calculate_date_range(period, custom_start, custom_end)

        # Get previous period for comparison
        prev_start, prev_end = self._calculate_previous_period(start_date, end_date)

        # Gather all metrics concurrently
        (
            current_revenue,
            previous_revenue,
            customer_metrics,
            aging_summary,
            tax_liability,
        ) = await asyncio.gather(
            self.revenue_generator.get_revenue_summary(tenant_id, start_date, end_date),
            self.revenue_generator.get_revenue_summary(tenant_id, prev_start, prev_end),
            self.customer_generator.get_customer_metrics(tenant_id, start_date, end_date),
            self.aging_generator.get_aging_summary(tenant_id),
            self.tax_generator.tax_service.get_tax_liability_report(
                tenant_id, start_date, end_date
            ),
        )

        # Calculate growth rates
        revenue_growth = self._calculate_growth_rate(
            current_revenue.get("total_revenue", 0), previous_revenue.get("total_revenue", 0)
        )

        customer_growth = self._calculate_growth_rate(
            customer_metrics.get("new_customers", 0),
            customer_metrics.get("previous_period_new_customers", 0),
        )

        currency_code = (current_revenue.get("currency") or "USD").upper()

        def format_amount(amount: int | None) -> str:
            minor_amount = int(amount or 0)
            numeric = format_money(minor_amount, include_symbol=False)
            if currency_code == "USD":
                return f"${numeric}"
            return f"{currency_code} {numeric}"

        summary: dict[str, Any] = {
            "report_type": "executive_summary",
            "tenant_id": tenant_id,
            "period": {
                "type": period.value,
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "key_metrics": {
                "revenue": {
                    "current_period": current_revenue.get("total_revenue", 0),
                    "previous_period": previous_revenue.get("total_revenue", 0),
                    "growth_rate": revenue_growth,
                    "formatted": format_amount(current_revenue.get("total_revenue", 0)),
                },
                "invoices": {
                    "total_issued": current_revenue.get("invoice_count", 0),
                    "total_paid": current_revenue.get("paid_count", 0),
                    "payment_rate": self._calculate_percentage(
                        current_revenue.get("paid_count", 0),
                        current_revenue.get("invoice_count", 0),
                    ),
                },
                "customers": {
                    "total_active": customer_metrics.get("active_customers", 0),
                    "new_this_period": customer_metrics.get("new_customers", 0),
                    "growth_rate": customer_growth,
                },
                "outstanding": {
                    "total_outstanding": aging_summary.get("total_outstanding", 0),
                    "overdue_amount": aging_summary.get("overdue_amount", 0),
                    "formatted": format_amount(aging_summary.get("total_outstanding", 0)),
                },
                "tax_liability": {
                    "total_collected": tax_liability.get("tax_collected", 0),
                    "net_liability": tax_liability.get("net_tax_liability", 0),
                    "formatted": format_amount(tax_liability.get("net_tax_liability", 0)),
                },
            },
            "trends": {
                "revenue_trend": await self.revenue_generator.get_revenue_trend(
                    tenant_id, start_date, end_date, "daily"
                ),
                "payment_method_distribution": await self.revenue_generator.get_payment_method_distribution(
                    tenant_id, start_date, end_date
                ),
            },
            "generated_at": datetime.now(UTC).isoformat(),
        }
        summary["key_metrics"]["revenue"]["currency"] = currency_code
        summary["key_metrics"]["outstanding"]["currency"] = currency_code
        summary["key_metrics"]["tax_liability"]["currency"] = currency_code
        return summary

    async def generate_revenue_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        group_by: str = "month",
    ) -> dict[str, Any]:
        """Generate detailed revenue report"""

        report: dict[str, Any] = await self.revenue_generator.generate_detailed_report(
            tenant_id, start_date, end_date, group_by
        )
        return report

    async def generate_customer_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        top_n: int = 20,
    ) -> dict[str, Any]:
        """Generate customer analysis report"""

        report: dict[str, Any] = await self.customer_generator.generate_customer_report(
            tenant_id, start_date, end_date, top_n
        )
        return report

    async def generate_aging_report(
        self,
        tenant_id: str,
        as_of_date: datetime | None = None,
    ) -> dict[str, Any]:
        """Generate accounts receivable aging report"""

        report: dict[str, Any] = await self.aging_generator.generate_aging_report(
            tenant_id, as_of_date or datetime.now(UTC)
        )
        return report

    async def generate_collections_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> dict[str, Any]:
        """Generate collections performance report"""

        report: dict[str, Any] = await self.aging_generator.generate_collections_report(
            tenant_id, start_date, end_date
        )
        return report

    async def generate_refunds_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> dict[str, Any]:
        """Generate refunds and credit notes report"""

        report: dict[str, Any] = await self.revenue_generator.generate_refunds_report(
            tenant_id, start_date, end_date
        )
        return report

    async def generate_custom_report(
        self,
        tenant_id: str,
        report_config: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate custom report based on configuration"""

        # Extract configuration
        metrics = report_config.get("metrics", [])
        filters = report_config.get("filters", {})

        # Build custom report
        report_data: dict[str, Any] = {
            "report_type": "custom",
            "tenant_id": tenant_id,
            "configuration": report_config,
            "data": {},
            "generated_at": datetime.now(UTC).isoformat(),
        }

        data_section = cast(dict[str, Any], report_data["data"])

        # Add requested metrics
        if "revenue" in metrics:
            data_section["revenue"] = await self.revenue_generator.get_revenue_summary(
                tenant_id,
                filters.get("start_date"),
                filters.get("end_date"),
            )

        if "customers" in metrics:
            data_section["customers"] = await self.customer_generator.get_customer_metrics(
                tenant_id,
                filters.get("start_date"),
                filters.get("end_date"),
            )

        if "aging" in metrics:
            data_section["aging"] = await self.aging_generator.get_aging_summary(tenant_id)

        if "tax" in metrics:
            data_section[
                "tax"
            ] = await self.tax_generator.tax_service.get_tax_summary_by_jurisdiction(
                tenant_id,
                filters.get("start_date"),
                filters.get("end_date"),
            )

        return report_data

    def _get_date_bounds(self) -> tuple[datetime, datetime]:
        """Get current datetime and today's start."""
        now = datetime.now(UTC)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return now, today

    def _calculate_daily_range(
        self, today: datetime, now: datetime, period: ReportPeriod
    ) -> tuple[datetime, datetime]:
        """Calculate daily period ranges."""
        if period == ReportPeriod.TODAY:
            return today, now
        elif period == ReportPeriod.YESTERDAY:
            yesterday = today - timedelta(days=1)
            return yesterday, today
        raise ValueError(f"Invalid daily period: {period}")

    def _calculate_weekly_range(
        self, today: datetime, now: datetime, period: ReportPeriod
    ) -> tuple[datetime, datetime]:
        """Calculate weekly period ranges."""
        if period == ReportPeriod.THIS_WEEK:
            start = today - timedelta(days=today.weekday())
            return start, now
        elif period == ReportPeriod.LAST_WEEK:
            start = today - timedelta(days=today.weekday() + 7)
            end = start + timedelta(days=7)
            return start, end
        raise ValueError(f"Invalid weekly period: {period}")

    def _calculate_monthly_range(
        self, today: datetime, now: datetime, period: ReportPeriod
    ) -> tuple[datetime, datetime]:
        """Calculate monthly period ranges."""
        if period == ReportPeriod.THIS_MONTH:
            start = today.replace(day=1)
            return start, now
        elif period == ReportPeriod.LAST_MONTH:
            last_month = today.replace(day=1) - timedelta(days=1)
            start = last_month.replace(day=1)
            end = today.replace(day=1)
            return start, end
        raise ValueError(f"Invalid monthly period: {period}")

    def _calculate_quarterly_range(
        self, today: datetime, now: datetime, period: ReportPeriod
    ) -> tuple[datetime, datetime]:
        """Calculate quarterly period ranges."""
        if period == ReportPeriod.THIS_QUARTER:
            quarter = (today.month - 1) // 3
            start = today.replace(month=quarter * 3 + 1, day=1)
            return start, now
        elif period == ReportPeriod.LAST_QUARTER:
            current_quarter = (today.month - 1) // 3
            if current_quarter == 0:
                start = today.replace(year=today.year - 1, month=10, day=1)
                end = today.replace(month=1, day=1)
            else:
                start = today.replace(month=(current_quarter - 1) * 3 + 1, day=1)
                end = today.replace(month=current_quarter * 3 + 1, day=1)
            return start, end
        raise ValueError(f"Invalid quarterly period: {period}")

    def _calculate_yearly_range(
        self, today: datetime, now: datetime, period: ReportPeriod
    ) -> tuple[datetime, datetime]:
        """Calculate yearly period ranges."""
        if period == ReportPeriod.THIS_YEAR:
            start = today.replace(month=1, day=1)
            return start, now
        elif period == ReportPeriod.LAST_YEAR:
            start = today.replace(year=today.year - 1, month=1, day=1)
            end = today.replace(month=1, day=1)
            return start, end
        raise ValueError(f"Invalid yearly period: {period}")

    def _calculate_date_range(
        self,
        period: ReportPeriod,
        custom_start: datetime | None = None,
        custom_end: datetime | None = None,
    ) -> tuple[datetime, datetime]:
        """Calculate date range for report period"""
        # Handle custom period first
        if period == ReportPeriod.CUSTOM:
            if not custom_start or not custom_end:
                raise ValueError("Custom period requires start and end dates")
            return custom_start, custom_end

        # Get date bounds
        now, today = self._get_date_bounds()

        # Route to appropriate calculator based on period type
        daily_periods = {ReportPeriod.TODAY, ReportPeriod.YESTERDAY}
        weekly_periods = {ReportPeriod.THIS_WEEK, ReportPeriod.LAST_WEEK}
        monthly_periods = {ReportPeriod.THIS_MONTH, ReportPeriod.LAST_MONTH}
        quarterly_periods = {ReportPeriod.THIS_QUARTER, ReportPeriod.LAST_QUARTER}
        yearly_periods = {ReportPeriod.THIS_YEAR, ReportPeriod.LAST_YEAR}

        if period in daily_periods:
            return self._calculate_daily_range(today, now, period)
        elif period in weekly_periods:
            return self._calculate_weekly_range(today, now, period)
        elif period in monthly_periods:
            return self._calculate_monthly_range(today, now, period)
        elif period in quarterly_periods:
            return self._calculate_quarterly_range(today, now, period)
        elif period in yearly_periods:
            return self._calculate_yearly_range(today, now, period)
        else:
            raise ValueError(f"Invalid report period: {period}")

    def _calculate_previous_period(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> tuple[datetime, datetime]:
        """Calculate previous period for comparison"""

        period_length = end_date - start_date
        prev_end = start_date
        prev_start = prev_end - period_length

        return prev_start, prev_end

    def _calculate_growth_rate(self, current: float, previous: float) -> float:
        """Calculate percentage growth rate"""

        if previous == 0:
            return 100.0 if current > 0 else 0.0

        return ((current - previous) / previous) * 100

    def _calculate_percentage(self, part: float, whole: float) -> float:
        """Calculate percentage"""

        if whole == 0:
            return 0.0

        return (part / whole) * 100
