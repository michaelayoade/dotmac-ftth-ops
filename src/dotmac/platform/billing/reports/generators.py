"""
Specialized report generators for billing
"""

import logging
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, cast

from sqlalchemy import and_, case, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import (
    CreditNoteEntity,
    InvoiceEntity,
    PaymentEntity,
)
from dotmac.platform.billing.core.enums import (
    CreditNoteStatus,
    InvoiceStatus,
    PaymentStatus,
)
from dotmac.platform.customer_management.models import Customer

logger = logging.getLogger(__name__)


class RevenueReportGenerator:
    """Generate revenue-related reports"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session

    async def get_revenue_summary(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> dict[str, Any]:
        """Get revenue summary for period"""

        # Query invoices
        stmt = select(
            func.count(InvoiceEntity.invoice_id).label("invoice_count"),
            func.sum(InvoiceEntity.total_amount).label("total_invoiced"),
            func.sum(
                case(
                    (
                        InvoiceEntity.payment_status == PaymentStatus.SUCCEEDED,
                        InvoiceEntity.total_amount,
                    ),
                    else_=0,
                )
            ).label("total_revenue"),
            func.count(
                case((InvoiceEntity.payment_status == PaymentStatus.SUCCEEDED, 1), else_=None)
            ).label("paid_count"),
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
            "invoice_count": row.invoice_count or 0,
            "total_invoiced": row.total_invoiced or 0,
            "total_revenue": row.total_revenue or 0,
            "paid_count": row.paid_count or 0,
            "collection_rate": self._calculate_rate(row.paid_count, row.invoice_count),
        }

    async def get_revenue_trend(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        group_by: str = "month",
    ) -> list[dict[str, Any]]:
        """Get revenue trend over time"""

        # Determine date truncation based on group_by
        if group_by == "day":
            date_trunc = func.date_trunc("day", InvoiceEntity.issue_date)
        elif group_by == "week":
            date_trunc = func.date_trunc("week", InvoiceEntity.issue_date)
        elif group_by == "month":
            date_trunc = func.date_trunc("month", InvoiceEntity.issue_date)
        else:
            date_trunc = func.date_trunc("month", InvoiceEntity.issue_date)

        stmt = (
            select(
                date_trunc.label("period"),
                func.count(InvoiceEntity.invoice_id).label("invoice_count"),
                func.sum(InvoiceEntity.total_amount).label("total_amount"),
                func.sum(
                    case(
                        (
                            InvoiceEntity.payment_status == PaymentStatus.SUCCEEDED,
                            InvoiceEntity.total_amount,
                        ),
                        else_=0,
                    )
                ).label("paid_amount"),
            )
            .where(
                and_(
                    InvoiceEntity.tenant_id == tenant_id,
                    InvoiceEntity.issue_date >= start_date,
                    InvoiceEntity.issue_date <= end_date,
                    InvoiceEntity.status != InvoiceStatus.VOID,
                )
            )
            .group_by(date_trunc)
            .order_by(date_trunc)
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        trend = []
        for row in rows:
            trend.append(
                {
                    "period": row.period.isoformat() if row.period else None,
                    "invoice_count": row.invoice_count or 0,
                    "total_amount": row.total_amount or 0,
                    "paid_amount": row.paid_amount or 0,
                }
            )

        return trend

    async def get_payment_method_distribution(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> dict[str, Any]:
        """Get distribution of payment methods used"""

        stmt = (
            select(
                PaymentEntity.payment_method_type,
                func.count(PaymentEntity.payment_id).label("count"),
                func.sum(PaymentEntity.amount).label("total_amount"),
            )
            .where(
                and_(
                    PaymentEntity.tenant_id == tenant_id,
                    PaymentEntity.created_at >= start_date,
                    PaymentEntity.created_at <= end_date,
                    PaymentEntity.status == PaymentStatus.SUCCEEDED,
                )
            )
            .group_by(PaymentEntity.payment_method_type)
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        distribution: dict[str, dict[str, float | int]] = {}
        total_amount = 0.0

        for row in rows:
            method_value = getattr(row, "payment_method_type", None)
            total_amount_raw = getattr(row, "total_amount", None)
            count_raw = getattr(row, "count", None)

            if method_value is None:
                mapping = getattr(row, "_mapping", None)
                if isinstance(mapping, Mapping):
                    method_value = mapping.get("payment_method_type")
                    if total_amount_raw is None:
                        total_amount_raw = mapping.get("total_amount")
                    if count_raw is None:
                        count_raw = mapping.get("count")

            if isinstance(method_value, str) and method_value:
                method = method_value
            elif isinstance(method_value, Enum):
                method = method_value.value
            else:
                method = str(method_value) if method_value else "unknown"

            if isinstance(total_amount_raw, Decimal):
                amount = float(total_amount_raw)
            elif isinstance(total_amount_raw, (int, float)):
                amount = float(total_amount_raw)
            else:
                amount = float(total_amount_raw or 0)

            if count_raw is None:
                count_raw = 0
            try:
                count_value = int(count_raw or 0)
            except TypeError:
                count_value = int(count_raw() or 0) if callable(count_raw) else 0

            distribution[method] = {
                "count": count_value,
                "amount": amount,
            }
            total_amount += amount

        # Calculate percentages
        for _method, data in distribution.items():
            amount_val = float(data.get("amount", 0))
            data["percentage"] = self._calculate_rate(amount_val, total_amount)

        return distribution

    async def generate_detailed_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        group_by: str = "month",
    ) -> dict[str, Any]:
        """Generate detailed revenue report"""

        summary = await self.get_revenue_summary(tenant_id, start_date, end_date)
        trend = await self.get_revenue_trend(tenant_id, start_date, end_date, group_by)
        payment_methods = await self.get_payment_method_distribution(
            tenant_id, start_date, end_date
        )

        # Get refunds summary
        refunds = await self.get_refunds_summary(tenant_id, start_date, end_date)

        return {
            "report_type": "revenue_detailed",
            "tenant_id": tenant_id,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "summary": summary,
            "trend": trend,
            "payment_methods": payment_methods,
            "refunds": refunds,
            "net_revenue": summary["total_revenue"] - refunds["total_refunded"],
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def get_refunds_summary(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> dict[str, Any]:
        """Get refunds summary"""

        stmt = select(
            func.count(CreditNoteEntity.credit_note_id).label("credit_note_count"),
            func.sum(CreditNoteEntity.total_amount).label("total_refunded"),
        ).where(
            and_(
                CreditNoteEntity.tenant_id == tenant_id,
                CreditNoteEntity.created_at >= start_date,
                CreditNoteEntity.created_at <= end_date,
                CreditNoteEntity.status != CreditNoteStatus.VOIDED,
            )
        )

        result = await self.db.execute(stmt)
        row = result.one()

        return {
            "credit_note_count": row.credit_note_count or 0,
            "total_refunded": row.total_refunded or 0,
        }

    async def generate_refunds_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> dict[str, Any]:
        """Generate detailed refunds report"""

        summary = await self.get_refunds_summary(tenant_id, start_date, end_date)

        # Get refund reasons breakdown
        stmt = (
            select(
                CreditNoteEntity.reason,
                func.count(CreditNoteEntity.credit_note_id).label("count"),
                func.sum(CreditNoteEntity.total_amount).label("amount"),
            )
            .where(
                and_(
                    CreditNoteEntity.tenant_id == tenant_id,
                    CreditNoteEntity.created_at >= start_date,
                    CreditNoteEntity.created_at <= end_date,
                    CreditNoteEntity.status != CreditNoteStatus.VOIDED,
                )
            )
            .group_by(CreditNoteEntity.reason)
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        reasons = []
        for row in rows:
            reason_value_raw = getattr(row, "reason", None)
            count_raw = getattr(row, "count", None)
            amount_raw = getattr(row, "amount", None)

            if reason_value_raw is None:
                mapping = getattr(row, "_mapping", None)
                if isinstance(mapping, Mapping):
                    reason_value_raw = mapping.get("reason")
                    if count_raw is None:
                        count_raw = mapping.get("count")
                    if amount_raw is None:
                        amount_raw = mapping.get("amount")

            if isinstance(reason_value_raw, Enum):
                reason_value = cast(str, reason_value_raw.value)
            elif isinstance(reason_value_raw, str) and reason_value_raw:
                reason_value = reason_value_raw
            else:
                reason_value = str(reason_value_raw) if reason_value_raw else "unknown"

            if count_raw is None:
                count_raw = 0
            try:
                count_value = int(count_raw or 0)
            except TypeError:
                count_value = int(count_raw() or 0) if callable(count_raw) else 0

            if isinstance(amount_raw, Decimal):
                amount_value = float(amount_raw)
            elif isinstance(amount_raw, (int, float)):
                amount_value = float(amount_raw)
            else:
                amount_value = float(amount_raw or 0)

            reasons.append(
                {
                    "reason": reason_value,
                    "count": count_value,
                    "amount": amount_value,
                }
            )

        return {
            "report_type": "refunds",
            "tenant_id": tenant_id,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "summary": summary,
            "by_reason": reasons,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    def _calculate_rate(self, part: float | None, whole: float | None) -> float:
        """Calculate percentage rate"""
        if not whole or whole == 0:
            return 0.0
        return (part / whole * 100) if part else 0.0


class CustomerReportGenerator:
    """Generate customer-related reports"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session

    async def get_customer_metrics(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> dict[str, Any]:
        """Get customer metrics for period"""

        # Count unique customers with invoices
        stmt = select(
            func.count(func.distinct(InvoiceEntity.customer_id)).label("active_customers"),
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

        # Get new customers (first invoice in period)
        # This is simplified - in production would track customer creation date
        new_customers = row.active_customers  # Placeholder

        return {
            "active_customers": row.active_customers or 0,
            "new_customers": new_customers or 0,
        }

    async def generate_customer_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
        top_n: int = 20,
    ) -> dict[str, Any]:
        """Generate customer analysis report"""

        # Get top customers by revenue
        stmt = (
            select(
                InvoiceEntity.customer_id,
                func.count(InvoiceEntity.invoice_id).label("invoice_count"),
                func.sum(InvoiceEntity.total_amount).label("total_amount"),
                func.sum(
                    case(
                        (
                            InvoiceEntity.payment_status == PaymentStatus.SUCCEEDED,
                            InvoiceEntity.total_amount,
                        ),
                        else_=0,
                    )
                ).label("paid_amount"),
            )
            .where(
                and_(
                    InvoiceEntity.tenant_id == tenant_id,
                    InvoiceEntity.issue_date >= start_date,
                    InvoiceEntity.issue_date <= end_date,
                    InvoiceEntity.status != InvoiceStatus.VOID,
                )
            )
            .group_by(InvoiceEntity.customer_id)
            .order_by(func.sum(InvoiceEntity.total_amount).desc())
            .limit(top_n)
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        top_customers = []
        for row in rows:
            top_customers.append(
                {
                    "customer_id": row.customer_id,
                    "invoice_count": row.invoice_count or 0,
                    "total_amount": row.total_amount or 0,
                    "paid_amount": row.paid_amount or 0,
                    "outstanding": (row.total_amount or 0) - (row.paid_amount or 0),
                }
            )

        metrics = await self.get_customer_metrics(tenant_id, start_date, end_date)

        return {
            "report_type": "customer_analysis",
            "tenant_id": tenant_id,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "metrics": metrics,
            "top_customers": top_customers,
            "generated_at": datetime.now(UTC).isoformat(),
        }


class AgingReportGenerator:
    """Generate accounts receivable aging reports"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session

    async def get_aging_summary(self, tenant_id: str) -> dict[str, Any]:
        """Get aging summary"""

        current_date = datetime.now(UTC)

        # Define aging buckets
        stmt = select(
            func.count(InvoiceEntity.invoice_id).label("invoice_count"),
            func.sum(InvoiceEntity.remaining_balance).label("total_outstanding"),
            func.sum(
                case(
                    (InvoiceEntity.due_date > current_date, InvoiceEntity.remaining_balance),
                    else_=0,
                )
            ).label("current"),
            func.sum(
                case(
                    (
                        and_(
                            InvoiceEntity.due_date <= current_date,
                            InvoiceEntity.due_date > current_date - timedelta(days=30),
                        ),
                        InvoiceEntity.remaining_balance,
                    ),
                    else_=0,
                )
            ).label("days_1_30"),
            func.sum(
                case(
                    (
                        and_(
                            InvoiceEntity.due_date <= current_date - timedelta(days=30),
                            InvoiceEntity.due_date > current_date - timedelta(days=60),
                        ),
                        InvoiceEntity.remaining_balance,
                    ),
                    else_=0,
                )
            ).label("days_31_60"),
            func.sum(
                case(
                    (
                        and_(
                            InvoiceEntity.due_date <= current_date - timedelta(days=60),
                            InvoiceEntity.due_date > current_date - timedelta(days=90),
                        ),
                        InvoiceEntity.remaining_balance,
                    ),
                    else_=0,
                )
            ).label("days_61_90"),
            func.sum(
                case(
                    (
                        InvoiceEntity.due_date <= current_date - timedelta(days=90),
                        InvoiceEntity.remaining_balance,
                    ),
                    else_=0,
                )
            ).label("over_90_days"),
        ).where(
            and_(
                InvoiceEntity.tenant_id == tenant_id,
                InvoiceEntity.payment_status != PaymentStatus.SUCCEEDED,
                InvoiceEntity.status.in_([InvoiceStatus.OPEN, InvoiceStatus.OVERDUE]),
                InvoiceEntity.remaining_balance > 0,
            )
        )

        result = await self.db.execute(stmt)
        row = result.one()

        total_outstanding = row.total_outstanding or 0
        overdue_amount = (
            (row.days_1_30 or 0)
            + (row.days_31_60 or 0)
            + (row.days_61_90 or 0)
            + (row.over_90_days or 0)
        )

        return {
            "invoice_count": row.invoice_count or 0,
            "total_outstanding": total_outstanding,
            "overdue_amount": overdue_amount,
            "buckets": {
                "current": row.current or 0,
                "1_30_days": row.days_1_30 or 0,
                "31_60_days": row.days_31_60 or 0,
                "61_90_days": row.days_61_90 or 0,
                "over_90_days": row.over_90_days or 0,
            },
        }

    async def generate_aging_report(
        self,
        tenant_id: str,
        as_of_date: datetime,
    ) -> dict[str, Any]:
        """Generate detailed aging report"""

        summary = await self.get_aging_summary(tenant_id)

        # Get detailed invoice list for aging
        # This would include individual invoice details
        # Simplified for now

        return {
            "report_type": "aging",
            "tenant_id": tenant_id,
            "as_of_date": as_of_date.isoformat(),
            "summary": summary,
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def generate_collections_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> dict[str, Any]:
        """Generate collections performance report"""

        # Get invoices that were paid during the period
        stmt = select(
            func.count(InvoiceEntity.invoice_id).label("collected_count"),
            func.sum(InvoiceEntity.total_amount).label("collected_amount"),
            func.avg(func.extract("day", InvoiceEntity.updated_at - InvoiceEntity.due_date)).label(
                "avg_days_to_collect"
            ),
        ).where(
            and_(
                InvoiceEntity.tenant_id == tenant_id,
                InvoiceEntity.payment_status == PaymentStatus.SUCCEEDED,
                InvoiceEntity.updated_at >= start_date,
                InvoiceEntity.updated_at <= end_date,
            )
        )

        result = await self.db.execute(stmt)
        row = result.one()

        return {
            "report_type": "collections",
            "tenant_id": tenant_id,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "summary": {
                "collected_count": row.collected_count or 0,
                "collected_amount": row.collected_amount or 0,
                "avg_days_to_collect": float(row.avg_days_to_collect or 0),
            },
            "generated_at": datetime.now(UTC).isoformat(),
        }

    async def get_aging_by_partner(
        self,
        tenant_id: str,
    ) -> list[dict[str, Any]]:
        """
        Get AR aging breakdown by partner.

        Returns aging buckets grouped by partner_id with full bucket analysis.
        """
        current_date = datetime.now(UTC).date()

        stmt = (
            select(
                Customer.partner_id,
                func.count(InvoiceEntity.invoice_id).label("invoice_count"),
                func.sum(InvoiceEntity.remaining_balance).label("total_outstanding"),
                func.sum(
                    case(
                        (
                            InvoiceEntity.due_date > current_date,
                            InvoiceEntity.remaining_balance,
                        ),
                        else_=0,
                    )
                ).label("current"),
                func.sum(
                    case(
                        (
                            and_(
                                InvoiceEntity.due_date <= current_date,
                                InvoiceEntity.due_date > current_date - timedelta(days=30),
                            ),
                            InvoiceEntity.remaining_balance,
                        ),
                        else_=0,
                    )
                ).label("days_1_30"),
                func.sum(
                    case(
                        (
                            and_(
                                InvoiceEntity.due_date <= current_date - timedelta(days=30),
                                InvoiceEntity.due_date > current_date - timedelta(days=60),
                            ),
                            InvoiceEntity.remaining_balance,
                        ),
                        else_=0,
                    )
                ).label("days_31_60"),
                func.sum(
                    case(
                        (
                            and_(
                                InvoiceEntity.due_date <= current_date - timedelta(days=60),
                                InvoiceEntity.due_date > current_date - timedelta(days=90),
                            ),
                            InvoiceEntity.remaining_balance,
                        ),
                        else_=0,
                    )
                ).label("days_61_90"),
                func.sum(
                    case(
                        (
                            InvoiceEntity.due_date <= current_date - timedelta(days=90),
                            InvoiceEntity.remaining_balance,
                        ),
                        else_=0,
                    )
                ).label("over_90_days"),
            )
            .join(Customer, InvoiceEntity.customer_id == Customer.id)
            .where(
                and_(
                    InvoiceEntity.tenant_id == tenant_id,
                    InvoiceEntity.payment_status != PaymentStatus.SUCCEEDED,
                    InvoiceEntity.status.in_([InvoiceStatus.OPEN, InvoiceStatus.OVERDUE]),
                    InvoiceEntity.remaining_balance > 0,
                )
            )
            .group_by(Customer.partner_id)
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        return [
            {
                "partner_id": row.partner_id,
                "invoice_count": row.invoice_count or 0,
                "total_outstanding": row.total_outstanding or 0,
                "buckets": {
                    "current": row.current or 0,
                    "1_30_days": row.days_1_30 or 0,
                    "31_60_days": row.days_31_60 or 0,
                    "61_90_days": row.days_61_90 or 0,
                    "over_90_days": row.over_90_days or 0,
                },
            }
            for row in rows
        ]

    async def get_aging_by_region(
        self,
        tenant_id: str,
    ) -> list[dict[str, Any]]:
        """
        Get AR aging breakdown by billing region/country.

        Returns aging buckets grouped by billing_country with full bucket analysis.
        """
        current_date = datetime.now(UTC).date()

        stmt = (
            select(
                Customer.billing_country,
                func.count(InvoiceEntity.invoice_id).label("invoice_count"),
                func.sum(InvoiceEntity.remaining_balance).label("total_outstanding"),
                func.sum(
                    case(
                        (
                            InvoiceEntity.due_date > current_date,
                            InvoiceEntity.remaining_balance,
                        ),
                        else_=0,
                    )
                ).label("current"),
                func.sum(
                    case(
                        (
                            and_(
                                InvoiceEntity.due_date <= current_date,
                                InvoiceEntity.due_date > current_date - timedelta(days=30),
                            ),
                            InvoiceEntity.remaining_balance,
                        ),
                        else_=0,
                    )
                ).label("days_1_30"),
                func.sum(
                    case(
                        (
                            and_(
                                InvoiceEntity.due_date <= current_date - timedelta(days=30),
                                InvoiceEntity.due_date > current_date - timedelta(days=60),
                            ),
                            InvoiceEntity.remaining_balance,
                        ),
                        else_=0,
                    )
                ).label("days_31_60"),
                func.sum(
                    case(
                        (
                            and_(
                                InvoiceEntity.due_date <= current_date - timedelta(days=60),
                                InvoiceEntity.due_date > current_date - timedelta(days=90),
                            ),
                            InvoiceEntity.remaining_balance,
                        ),
                        else_=0,
                    )
                ).label("days_61_90"),
                func.sum(
                    case(
                        (
                            InvoiceEntity.due_date <= current_date - timedelta(days=90),
                            InvoiceEntity.remaining_balance,
                        ),
                        else_=0,
                    )
                ).label("over_90_days"),
            )
            .join(Customer, InvoiceEntity.customer_id == Customer.id)
            .where(
                and_(
                    InvoiceEntity.tenant_id == tenant_id,
                    InvoiceEntity.payment_status != PaymentStatus.SUCCEEDED,
                    InvoiceEntity.status.in_([InvoiceStatus.OPEN, InvoiceStatus.OVERDUE]),
                    InvoiceEntity.remaining_balance > 0,
                )
            )
            .group_by(Customer.billing_country)
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        return [
            {
                "region": row.billing_country or "Unknown",
                "invoice_count": row.invoice_count or 0,
                "total_outstanding": row.total_outstanding or 0,
                "buckets": {
                    "current": row.current or 0,
                    "1_30_days": row.days_1_30 or 0,
                    "31_60_days": row.days_31_60 or 0,
                    "61_90_days": row.days_61_90 or 0,
                    "over_90_days": row.over_90_days or 0,
                },
            }
            for row in rows
        ]


class BlockedCustomersReportGenerator:
    """
    Generator for blocked/suspended customers dashboard.

    Provides visibility into suspended subscribers with outstanding balances,
    suspension duration, and recommended next actions for collections.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_blocked_customers_summary(
        self,
        tenant_id: str,
        min_days_blocked: int = 0,
        max_days_blocked: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Get summary of blocked/suspended customers.

        Args:
            tenant_id: Tenant ID
            min_days_blocked: Minimum days in suspended state
            max_days_blocked: Maximum days in suspended state (optional)

        Returns:
            List of blocked customer records with:
            - subscriber_id, username
            - customer name and contact
            - suspended_at, days_blocked
            - outstanding_balance, overdue_invoices
            - next_action, priority
        """
        from dotmac.platform.subscribers.models import Subscriber, SubscriberStatus

        current_date = datetime.now(UTC)

        # Build query to get suspended subscribers with their outstanding balances
        customer_name_expr = func.coalesce(
            Customer.display_name,
            Customer.company_name,
            func.trim(
                func.concat(
                    func.coalesce(Customer.first_name, ""),
                    literal(" "),
                    func.coalesce(Customer.last_name, ""),
                )
            ),
        )

        stmt = (
            select(
                Subscriber.id.label("subscriber_id"),
                Subscriber.username,
                Subscriber.suspended_at,
                Customer.id.label("customer_id"),
                customer_name_expr.label("customer_name"),
                Customer.email,
                Customer.phone,
                func.count(InvoiceEntity.invoice_id).label("overdue_invoices"),
                func.sum(InvoiceEntity.remaining_balance).label("outstanding_balance"),
            )
            .join(Customer, Subscriber.customer_id == Customer.id)
            .outerjoin(
                InvoiceEntity,
                and_(
                    InvoiceEntity.customer_id == Customer.id,
                    InvoiceEntity.status.in_([InvoiceStatus.OPEN, InvoiceStatus.OVERDUE]),
                    InvoiceEntity.remaining_balance > 0,
                ),
            )
            .where(
                and_(
                    Subscriber.tenant_id == tenant_id,
                    Subscriber.status == SubscriberStatus.SUSPENDED,
                    Subscriber.suspended_at.is_not(None),
                )
            )
            .group_by(
                Subscriber.id,
                Subscriber.username,
                Subscriber.suspended_at,
                Customer.id,
                customer_name_expr,
                Customer.email,
                Customer.phone,
            )
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        # Process results
        blocked_customers = []
        for row in rows:
            days_blocked = (current_date - row.suspended_at).days if row.suspended_at else 0

            # Apply filters
            if days_blocked < min_days_blocked:
                continue
            if max_days_blocked is not None and days_blocked > max_days_blocked:
                continue

            outstanding_balance = float(row.outstanding_balance or 0)
            next_action = self._determine_next_action(days_blocked, outstanding_balance)
            priority = self._calculate_priority(days_blocked, outstanding_balance)

            blocked_customers.append(
                {
                    "subscriber_id": row.subscriber_id,
                    "username": row.username,
                    "customer_name": row.full_name,
                    "email": row.email,
                    "phone": row.phone,
                    "suspended_at": row.suspended_at.isoformat() if row.suspended_at else None,
                    "days_blocked": days_blocked,
                    "overdue_invoices": row.overdue_invoices or 0,
                    "outstanding_balance": outstanding_balance,
                    "next_action": next_action,
                    "priority": priority,
                }
            )

        # Sort by priority (critical first) then by days_blocked
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        blocked_customers.sort(
            key=lambda x: (priority_order.get(x["priority"], 4), -x["days_blocked"])
        )

        return blocked_customers

    def _determine_next_action(self, days_blocked: int, outstanding_balance: float) -> str:
        """
        Determine recommended next action based on suspension duration and balance.

        Args:
            days_blocked: Number of days in suspended state
            outstanding_balance: Total outstanding balance

        Returns:
            Next action recommendation
        """
        if days_blocked >= 90:
            return "escalate_to_collections"
        elif days_blocked >= 60:
            return "final_notice"
        elif days_blocked >= 30:
            if outstanding_balance > 10000:
                return "collections_call"
            else:
                return "payment_reminder"
        elif days_blocked >= 14:
            return "payment_reminder"
        else:
            return "monitor"

    def _calculate_priority(self, days_blocked: int, outstanding_balance: float) -> str:
        """
        Calculate priority level for collections.

        Args:
            days_blocked: Number of days in suspended state
            outstanding_balance: Total outstanding balance

        Returns:
            Priority level: critical, high, medium, low
        """
        # Critical: Long suspension + high balance
        if days_blocked >= 90 or outstanding_balance > 50000:
            return "critical"

        # High: Medium suspension + significant balance
        if days_blocked >= 60 or outstanding_balance > 20000:
            return "high"

        # Medium: Recent suspension or moderate balance
        if days_blocked >= 30 or outstanding_balance > 5000:
            return "medium"

        return "low"
