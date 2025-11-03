"""
Query Handlers - Execute queries and return read models

Handlers optimize for read performance using:
1. Denormalized read models
2. Caching strategies
3. Database query optimization
4. Minimal data transformation
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import structlog
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.billing.core.entities import (
    InvoiceEntity,
    PaymentEntity,
)
from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus
from dotmac.platform.billing.models import BillingSubscriptionTable
from dotmac.platform.billing.read_models.invoice_read_models import (
    InvoiceDetail,
    InvoiceListItem,
    InvoiceStatistics,
)
from dotmac.platform.billing.read_models.payment_read_models import (
    PaymentDetail,
    PaymentListItem,
    PaymentStatistics,
)
from dotmac.platform.billing.read_models.subscription_read_models import (
    SubscriptionDetail,
    SubscriptionListItem,
)

from .invoice_queries import (
    GetInvoiceQuery,
    GetInvoiceStatisticsQuery,
    GetOverdueInvoicesQuery,
    ListInvoicesQuery,
)
from .payment_queries import (
    GetPaymentQuery,
    GetPaymentStatisticsQuery,
    ListPaymentsQuery,
)
from .subscription_queries import (
    GetActiveSubscriptionsQuery,
    GetSubscriptionQuery,
    ListSubscriptionsQuery,
)

logger = structlog.get_logger(__name__)


def _format_currency(amount: int | Decimal | None, currency: str) -> str:
    """Format minor units as human readable currency string without float rounding."""
    currency_code = (currency or "USD").upper()
    minor_amount = Decimal(str(amount if amount is not None else 0))
    major = (minor_amount / Decimal("100")).quantize(Decimal("0.01"))
    formatted = format(major, ",.2f")
    if currency_code == "USD":
        return f"${formatted}"
    return f"{currency_code} {formatted}"


class InvoiceQueryHandler:
    """Handles invoice queries with optimized read models"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session

    async def handle_get_invoice(self, query: GetInvoiceQuery) -> InvoiceDetail | None:
        """Get single invoice with full details"""
        logger.debug("Handling GetInvoiceQuery", invoice_id=query.invoice_id)

        stmt = select(InvoiceEntity).where(
            and_(
                InvoiceEntity.tenant_id == query.tenant_id,
                InvoiceEntity.invoice_id == query.invoice_id,
            )
        )

        if query.include_line_items:
            stmt = stmt.options(selectinload(InvoiceEntity.line_items))
        if query.include_payments:
            stmt = stmt.options(selectinload(InvoiceEntity.payments))

        result = await self.db.execute(stmt)
        invoice = result.scalar_one_or_none()

        if not invoice:
            return None

        return self._map_to_detail(invoice)

    async def handle_list_invoices(self, query: ListInvoicesQuery) -> dict[str, Any]:
        """List invoices with pagination"""
        logger.debug("Handling ListInvoicesQuery", page=query.page)

        # Build query with filters
        stmt = select(InvoiceEntity).where(InvoiceEntity.tenant_id == query.tenant_id)

        if query.customer_id:
            stmt = stmt.where(InvoiceEntity.customer_id == query.customer_id)
        if query.status:
            stmt = stmt.where(InvoiceEntity.status == query.status)
        if query.created_after:
            stmt = stmt.where(InvoiceEntity.created_at >= query.created_after)
        if query.created_before:
            stmt = stmt.where(InvoiceEntity.created_at <= query.created_before)

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count_raw = await self.db.scalar(count_stmt)
        total_count = int(total_count_raw or 0)

        # Apply sorting and pagination
        if query.sort_order == "desc":
            stmt = stmt.order_by(getattr(InvoiceEntity, query.sort_by).desc())
        else:
            stmt = stmt.order_by(getattr(InvoiceEntity, query.sort_by).asc())

        offset = (query.page - 1) * query.page_size
        stmt = stmt.offset(offset).limit(query.page_size)

        result = await self.db.execute(stmt)
        invoices = result.scalars().all()

        total_pages = (total_count + query.page_size - 1) // query.page_size if total_count else 0

        return {
            "items": [self._map_to_list_item(inv) for inv in invoices],
            "total": total_count,
            "page": query.page,
            "page_size": query.page_size,
            "total_pages": total_pages,
        }

    async def handle_get_overdue_invoices(
        self, query: GetOverdueInvoicesQuery
    ) -> list[InvoiceListItem]:
        """Get overdue invoices"""
        logger.debug("Handling GetOverdueInvoicesQuery")

        now = datetime.now(UTC)
        stmt = (
            select(InvoiceEntity)
            .where(
                and_(
                    InvoiceEntity.tenant_id == query.tenant_id,
                    InvoiceEntity.status == InvoiceStatus.OPEN,
                    InvoiceEntity.due_date < now,
                    InvoiceEntity.remaining_balance > 0,
                )
            )
            .order_by(InvoiceEntity.due_date.asc())
            .limit(query.limit)
        )

        if query.customer_id:
            stmt = stmt.where(InvoiceEntity.customer_id == query.customer_id)

        result = await self.db.execute(stmt)
        invoices = result.scalars().all()

        return [self._map_to_list_item(inv) for inv in invoices]

    async def handle_get_invoice_statistics(
        self, query: GetInvoiceStatisticsQuery
    ) -> InvoiceStatistics:
        """Get aggregated invoice statistics"""
        logger.debug("Handling GetInvoiceStatisticsQuery")

        stmt = select(
            func.count(InvoiceEntity.invoice_id).label("total_count"),
            func.sum(case((InvoiceEntity.status == InvoiceStatus.DRAFT, 1), else_=0)).label(
                "draft_count"
            ),
            func.sum(case((InvoiceEntity.status == InvoiceStatus.OPEN, 1), else_=0)).label(
                "open_count"
            ),
            func.sum(case((InvoiceEntity.status == InvoiceStatus.PAID, 1), else_=0)).label(
                "paid_count"
            ),
            func.sum(InvoiceEntity.total_amount).label("total_amount"),
            func.sum(InvoiceEntity.remaining_balance).label("outstanding_amount"),
            func.avg(InvoiceEntity.total_amount).label("average_amount"),
        ).where(
            and_(
                InvoiceEntity.tenant_id == query.tenant_id,
                InvoiceEntity.created_at >= query.start_date,
                InvoiceEntity.created_at <= query.end_date,
            )
        )

        if query.customer_id:
            stmt = stmt.where(InvoiceEntity.customer_id == query.customer_id)

        result = await self.db.execute(stmt)
        row = result.one()

        total_amount = int(row.total_amount or 0)
        outstanding_amount = int(row.outstanding_amount or 0)
        paid_amount = total_amount - outstanding_amount

        currency = "USD"
        return InvoiceStatistics(
            total_count=int(row.total_count or 0),
            draft_count=int(row.draft_count or 0),
            open_count=int(row.open_count or 0),
            paid_count=int(row.paid_count or 0),
            void_count=0,
            overdue_count=0,
            total_amount=total_amount,
            paid_amount=max(paid_amount, 0),
            outstanding_amount=outstanding_amount,
            overdue_amount=0,
            currency=currency,
            average_invoice_amount=int(row.average_amount or 0),
            average_payment_time_days=None,
            period_start=query.start_date,
            period_end=query.end_date,
            previous_period_total=None,
            growth_rate=None,
            formatted_total=_format_currency(total_amount, currency),
            formatted_outstanding=_format_currency(outstanding_amount, currency),
        )

    def _map_to_list_item(self, invoice: InvoiceEntity) -> InvoiceListItem:
        """Map entity to lightweight list item"""
        now = datetime.now(UTC)
        days_until_due = (invoice.due_date - now).days if invoice.due_date else None

        invoice_number = invoice.invoice_number or invoice.invoice_id

        status_value = (
            invoice.status.value
            if isinstance(invoice.status, InvoiceStatus)
            else str(invoice.status)
        )
        currency = getattr(invoice, "currency", None) or "USD"
        customer_name = (
            invoice.billing_address.get("name")
            if isinstance(invoice.billing_address, dict)
            else None
        )
        customer_email = invoice.billing_email or ""
        resolved_customer_name = customer_name or customer_email or invoice.customer_id

        line_items = list(invoice.line_items) if getattr(invoice, "line_items", None) else []
        payments = list(invoice.payments) if getattr(invoice, "payments", None) else []
        is_overdue = bool(
            invoice.due_date and invoice.due_date < now and invoice.status == InvoiceStatus.OPEN
        )
        formatted_total = _format_currency(invoice.total_amount, currency)
        formatted_balance = _format_currency(invoice.remaining_balance, currency)

        return InvoiceListItem(
            invoice_id=invoice.invoice_id,
            invoice_number=invoice_number,
            customer_id=invoice.customer_id,
            customer_name=resolved_customer_name,
            customer_email=customer_email,
            total_amount=invoice.total_amount,
            remaining_balance=invoice.remaining_balance,
            currency=currency,
            status=status_value,
            is_overdue=is_overdue,
            created_at=invoice.created_at,
            due_date=invoice.due_date,
            paid_at=invoice.paid_at,
            line_item_count=len(line_items),
            payment_count=len(payments),
            formatted_total=formatted_total,
            formatted_balance=formatted_balance,
            days_until_due=days_until_due,
        )

    def _map_to_detail(self, invoice: InvoiceEntity) -> InvoiceDetail:
        """Map entity to detailed view"""
        line_items_data: list[dict[str, Any]] = []
        if getattr(invoice, "line_items", None):
            for item in invoice.line_items:
                line_items_data.append(
                    {
                        "description": item.description,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price,
                        "total_price": item.total_price,
                        "product_id": item.product_id,
                        "subscription_id": item.subscription_id,
                        "tax_rate": item.tax_rate,
                        "tax_amount": item.tax_amount,
                        "discount_percentage": item.discount_percentage,
                        "discount_amount": item.discount_amount,
                        "metadata": item.extra_data or {},
                    }
                )

        payment_summaries: list[dict[str, Any]] = []
        if getattr(invoice, "payments", None):
            for association in invoice.payments:
                summary: dict[str, Any] = {
                    "payment_id": association.payment_id,
                    "amount_applied": association.amount_applied,
                    "applied_at": association.applied_at,
                }
                payment_entity = getattr(association, "payment", None)
                if payment_entity is not None:
                    summary["status"] = getattr(payment_entity, "status", None)
                payment_summaries.append(summary)

        total_paid = sum(entry["amount_applied"] for entry in payment_summaries)
        if not payment_summaries:
            total_paid = max(invoice.total_amount - invoice.remaining_balance, 0)

        tenant_id_value = invoice.tenant_id or ""
        customer_email = invoice.billing_email or ""
        raw_customer_name = (
            invoice.billing_address.get("name")
            if isinstance(invoice.billing_address, dict)
            else None
        )
        customer_name_value = raw_customer_name or customer_email or invoice.customer_id

        status_value = (
            invoice.status.value
            if isinstance(invoice.status, InvoiceStatus)
            else str(invoice.status)
        )
        extra_data = invoice.extra_data or {}
        if not isinstance(extra_data, dict):
            extra_data = {}
        payment_link = extra_data.get("payment_link")

        now = datetime.now(UTC)
        is_overdue = bool(
            invoice.due_date and invoice.due_date < now and invoice.status == InvoiceStatus.OPEN
        )
        days_overdue = (
            (now - invoice.due_date).days if invoice.due_date and invoice.due_date < now else None
        )

        invoice_number = invoice.invoice_number or invoice.invoice_id

        return InvoiceDetail(
            invoice_id=invoice.invoice_id,
            invoice_number=invoice_number,
            tenant_id=tenant_id_value,
            customer_id=invoice.customer_id,
            customer_name=customer_name_value,
            customer_email=customer_email,
            billing_address=invoice.billing_address,
            line_items=line_items_data,
            subtotal=invoice.subtotal,
            tax_amount=invoice.tax_amount,
            discount_amount=invoice.discount_amount,
            total_amount=invoice.total_amount,
            remaining_balance=invoice.remaining_balance,
            currency=invoice.currency,
            status=status_value,
            created_at=invoice.created_at,
            updated_at=invoice.updated_at,
            issue_date=invoice.issue_date,
            due_date=invoice.due_date,
            finalized_at=getattr(invoice, "finalized_at", None),
            paid_at=invoice.paid_at,
            voided_at=invoice.voided_at,
            payments=payment_summaries,
            total_paid=total_paid,
            notes=invoice.notes,
            internal_notes=invoice.internal_notes,
            subscription_id=invoice.subscription_id,
            idempotency_key=invoice.idempotency_key,
            created_by=invoice.created_by,
            extra_data=extra_data,
            is_overdue=is_overdue,
            days_overdue=days_overdue,
            payment_link=payment_link,
        )


class PaymentQueryHandler:
    """Handles payment queries"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session

    async def handle_get_payment(self, query: GetPaymentQuery) -> PaymentDetail | None:
        """Get single payment"""
        stmt = select(PaymentEntity).where(
            and_(
                PaymentEntity.tenant_id == query.tenant_id,
                PaymentEntity.payment_id == query.payment_id,
            )
        )

        result = await self.db.execute(stmt)
        payment = result.scalar_one_or_none()

        if not payment:
            return None

        return PaymentDetail.model_validate(payment)

    async def handle_list_payments(self, query: ListPaymentsQuery) -> dict[str, Any]:
        """List payments with pagination"""
        stmt = select(PaymentEntity).where(PaymentEntity.tenant_id == query.tenant_id)

        if query.customer_id:
            stmt = stmt.where(PaymentEntity.customer_id == query.customer_id)
        if query.status:
            stmt = stmt.where(PaymentEntity.status == query.status)

        # Count and paginate
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = await self.db.scalar(count_stmt)

        offset = (query.page - 1) * query.page_size
        stmt = stmt.order_by(PaymentEntity.created_at.desc()).offset(offset).limit(query.page_size)

        result = await self.db.execute(stmt)
        payments = result.scalars().all()

        items = []
        for payment in payments:
            currency = getattr(payment, "currency", None) or "USD"
            data = {k: v for k, v in payment.__dict__.items() if not k.startswith("_")}
            data["currency"] = currency
            data["formatted_amount"] = _format_currency(getattr(payment, "amount", 0), currency)
            if "payment_method" not in data or not data["payment_method"]:
                payment_type = getattr(payment, "payment_method_type", None)
                data["payment_method"] = str(payment_type) if payment_type else "unknown"
            if "customer_name" not in data or not data["customer_name"]:
                data["customer_name"] = getattr(payment, "customer_name", "") or getattr(
                    payment, "customer_id", ""
                )
            items.append(PaymentListItem.model_validate(data))

        return {
            "items": items,
            "total": total_count,
            "page": query.page,
            "page_size": query.page_size,
        }

    async def handle_get_payment_statistics(
        self, query: GetPaymentStatisticsQuery
    ) -> PaymentStatistics:
        """Get payment statistics"""
        stmt = select(
            func.count(PaymentEntity.payment_id).label("total_count"),
            func.sum(case((PaymentEntity.status == PaymentStatus.SUCCEEDED, 1), else_=0)).label(
                "succeeded_count"
            ),
            func.sum(case((PaymentEntity.status == PaymentStatus.FAILED, 1), else_=0)).label(
                "failed_count"
            ),
            func.sum(PaymentEntity.amount).label("total_amount"),
        ).where(
            and_(
                PaymentEntity.tenant_id == query.tenant_id,
                PaymentEntity.created_at >= query.start_date,
                PaymentEntity.created_at <= query.end_date,
            )
        )

        result = await self.db.execute(stmt)
        row = result.one()

        return PaymentStatistics(
            total_count=row.total_count or 0,
            succeeded_count=row.succeeded_count or 0,
            failed_count=row.failed_count or 0,
            total_amount=row.total_amount or 0,
            success_rate=row.succeeded_count / row.total_count if row.total_count else 0,
            period_start=query.start_date,
            period_end=query.end_date,
        )


class SubscriptionQueryHandler:
    """Handles subscription queries"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session

    async def handle_get_subscription(
        self, query: GetSubscriptionQuery
    ) -> SubscriptionDetail | None:
        """Get single subscription"""
        stmt = select(BillingSubscriptionTable).where(
            and_(
                BillingSubscriptionTable.tenant_id == query.tenant_id,
                BillingSubscriptionTable.subscription_id == query.subscription_id,
            )
        )

        result = await self.db.execute(stmt)
        subscription = result.scalar_one_or_none()

        if not subscription:
            return None

        return SubscriptionDetail.model_validate(subscription)

    async def handle_list_subscriptions(self, query: ListSubscriptionsQuery) -> dict[str, Any]:
        """List subscriptions"""
        stmt = select(BillingSubscriptionTable).where(
            BillingSubscriptionTable.tenant_id == query.tenant_id
        )

        if query.customer_id:
            stmt = stmt.where(BillingSubscriptionTable.customer_id == query.customer_id)
        if query.status:
            stmt = stmt.where(BillingSubscriptionTable.status == query.status)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = await self.db.scalar(count_stmt)

        offset = (query.page - 1) * query.page_size
        stmt = (
            stmt.order_by(BillingSubscriptionTable.created_at.desc())
            .offset(offset)
            .limit(query.page_size)
        )

        result = await self.db.execute(stmt)
        subscriptions = result.scalars().all()

        return {
            "items": [SubscriptionListItem.model_validate(s) for s in subscriptions],
            "total": total_count,
            "page": query.page,
            "page_size": query.page_size,
        }

    async def handle_get_active_subscriptions(
        self, query: GetActiveSubscriptionsQuery
    ) -> list[SubscriptionListItem]:
        """Get active subscriptions"""
        stmt = (
            select(BillingSubscriptionTable)
            .where(
                and_(
                    BillingSubscriptionTable.tenant_id == query.tenant_id,
                    BillingSubscriptionTable.status == "active",
                )
            )
            .limit(query.limit)
        )

        if query.customer_id:
            stmt = stmt.where(BillingSubscriptionTable.customer_id == query.customer_id)

        result = await self.db.execute(stmt)
        subscriptions = result.scalars().all()

        return [SubscriptionListItem.model_validate(s) for s in subscriptions]
