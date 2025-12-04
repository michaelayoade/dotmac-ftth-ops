"""
GraphQL queries for Payment and Billing Management.

Provides efficient payment queries with batched loading of related
customer and invoice data via DataLoaders.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import strawberry
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import PaymentEntity
from dotmac.platform.billing.core.models import PaymentStatus
from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.payment import (
    Payment,
    PaymentConnection,
    PaymentCustomer,
    PaymentInvoice,
    PaymentMetrics,
    PaymentStatusEnum,
)


@strawberry.type
class PaymentQueries:
    """GraphQL queries for payment management."""

    @strawberry.field(description="Get payment by ID with customer and invoice data")  # type: ignore[misc]
    async def payment(
        self,
        info: strawberry.Info[Context],
        id: strawberry.ID,
        include_customer: bool = True,
        include_invoice: bool = True,
    ) -> Payment | None:
        """
        Fetch a single payment by ID.

        Args:
            id: Payment ID (UUID)
            include_customer: Load customer data via DataLoader (default: True)
            include_invoice: Load invoice data via DataLoader (default: True)

        Returns:
            Payment with batched customer and invoice data
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        try:
            payment_id = UUID(id)
        except ValueError:
            return None

        # Fetch payment
        stmt = select(PaymentEntity).where(
            PaymentEntity.payment_id == payment_id,
            PaymentEntity.tenant_id == tenant_id,
        )
        result = await db.execute(stmt)
        payment_entity = result.scalar_one_or_none()

        if not payment_entity:
            return None

        # Convert to GraphQL type
        payment = Payment.from_model(payment_entity)

        # Batch load customer if requested
        if include_customer and payment_entity.customer_id:
            customer_loader = info.context.loaders.get_payment_customer_loader()
            customers = await customer_loader.load_many([str(payment_entity.customer_id)])
            if customers and customers[0]:
                customer_model = customers[0]
                payment.customer = PaymentCustomer(
                    id=strawberry.ID(str(customer_model.id)),
                    name=f"{customer_model.first_name} {customer_model.last_name}",
                    email=customer_model.email,
                    customer_number=customer_model.customer_number,
                )

        # Batch load invoice if requested
        if include_invoice and payment_entity.invoice_id:
            invoice_loader = info.context.loaders.get_payment_invoice_loader()
            invoices = await invoice_loader.load_many([str(payment_entity.invoice_id)])
            if invoices and invoices[0]:
                invoice_model = invoices[0]
                payment.invoice = PaymentInvoice(
                    id=strawberry.ID(str(invoice_model.invoice_id)),
                    invoice_number=invoice_model.invoice_number,
                    total_amount=invoice_model.total_amount,
                    status=invoice_model.status.value,
                )

        return payment

    @strawberry.field(description="Get list of payments with optional filters")  # type: ignore[misc]
    async def payments(
        self,
        info: strawberry.Info[Context],
        limit: int = 50,
        offset: int = 0,
        status: PaymentStatusEnum | None = None,
        customer_id: strawberry.ID | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        include_customer: bool = True,
        include_invoice: bool = False,
    ) -> PaymentConnection:
        """
        Fetch a list of payments with optional filtering.

        Args:
            limit: Maximum number of payments to return (default: 50)
            offset: Number of payments to skip (default: 0)
            status: Filter by payment status
            customer_id: Filter by customer ID
            date_from: Filter payments created after this date
            date_to: Filter payments created before this date
            include_customer: Batch load customer data (default: True)
            include_invoice: Batch load invoice data (default: False)

        Returns:
            PaymentConnection with paginated payments and aggregated metrics
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        # Build base query
        stmt = (
            select(PaymentEntity)
            .where(PaymentEntity.tenant_id == tenant_id)
            .order_by(PaymentEntity.created_at.desc())
        )

        # Apply filters
        if status:
            stmt = stmt.where(PaymentEntity.status == PaymentStatus(status.value))

        if customer_id:
            try:
                customer_uuid = UUID(customer_id)
                stmt = stmt.where(PaymentEntity.customer_id == customer_uuid)
            except ValueError:
                pass

        if date_from:
            stmt = stmt.where(PaymentEntity.created_at >= date_from)

        if date_to:
            stmt = stmt.where(PaymentEntity.created_at <= date_to)

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar() or 0

        # Apply pagination
        stmt = stmt.limit(limit).offset(offset)

        # Execute query
        result = await db.execute(stmt)
        payment_entities = result.scalars().all()

        # Convert to GraphQL types
        payments = [Payment.from_model(p) for p in payment_entities]

        # Batch load customer data if requested
        if include_customer and payment_entities:
            customer_ids = [str(p.customer_id) for p in payment_entities]
            customer_loader = info.context.loaders.get_payment_customer_loader()
            customers = await customer_loader.load_many(customer_ids)

            # Map customers to payments
            for i, customer_model in enumerate(customers):
                if customer_model:
                    payments[i].customer = PaymentCustomer(
                        id=strawberry.ID(str(customer_model.id)),
                        name=f"{customer_model.first_name} {customer_model.last_name}",
                        email=customer_model.email,
                        customer_number=customer_model.customer_number,
                    )

        # Batch load invoice data if requested
        if include_invoice and payment_entities:
            invoice_ids = [str(p.invoice_id) for p in payment_entities if p.invoice_id]
            if invoice_ids:
                invoice_loader = info.context.loaders.get_payment_invoice_loader()
                invoices = await invoice_loader.load_many(invoice_ids)

                # Map invoices to payments (need to handle None invoice_ids)
                invoice_idx = 0
                for payment, payment_entity in zip(payments, payment_entities, strict=False):
                    if payment_entity.invoice_id and invoice_idx < len(invoices):
                        invoice_model = invoices[invoice_idx]
                        if invoice_model:
                            payment.invoice = PaymentInvoice(
                                id=strawberry.ID(str(invoice_model.invoice_id)),
                                invoice_number=invoice_model.invoice_number,
                                total_amount=invoice_model.total_amount,
                                status=invoice_model.status.value,
                            )
                        invoice_idx += 1

        # Calculate aggregated metrics from the filtered set
        metrics_stmt = select(
            func.sum(PaymentEntity.amount).label("total"),
            func.sum(
                case(
                    (PaymentEntity.status == PaymentStatus.SUCCEEDED, PaymentEntity.amount),
                    else_=0,
                )
            ).label("succeeded"),
            func.sum(
                case(
                    (PaymentEntity.status == PaymentStatus.PENDING, PaymentEntity.amount),
                    else_=0,
                )
            ).label("pending"),
            func.sum(
                case(
                    (PaymentEntity.status == PaymentStatus.FAILED, PaymentEntity.amount),
                    else_=0,
                )
            ).label("failed"),
        )

        metrics_stmt = metrics_stmt.where(PaymentEntity.tenant_id == tenant_id)

        # Apply same filters to metrics
        if status:
            metrics_stmt = metrics_stmt.where(PaymentEntity.status == PaymentStatus(status.value))
        if customer_id:
            try:
                customer_uuid = UUID(customer_id)
                metrics_stmt = metrics_stmt.where(PaymentEntity.customer_id == customer_uuid)
            except ValueError:
                pass
        if date_from:
            metrics_stmt = metrics_stmt.where(PaymentEntity.created_at >= date_from)
        if date_to:
            metrics_stmt = metrics_stmt.where(PaymentEntity.created_at <= date_to)

        metrics_result = await db.execute(metrics_stmt)
        metrics_row = metrics_result.one()
        metrics_mapping = metrics_row._mapping

        total_amount = Decimal(str(metrics_mapping.get("total") or 0))
        total_succeeded = Decimal(str(metrics_mapping.get("succeeded") or 0))
        total_pending = Decimal(str(metrics_mapping.get("pending") or 0))
        total_failed = Decimal(str(metrics_mapping.get("failed") or 0))

        return PaymentConnection(
            payments=payments,
            total_count=int(total_count),
            has_next_page=(offset + limit) < total_count,
            total_amount=total_amount,
            total_succeeded=total_succeeded,
            total_pending=total_pending,
            total_failed=total_failed,
        )

    @strawberry.field(description="Get payment metrics and statistics")  # type: ignore[misc]
    async def payment_metrics(
        self,
        info: strawberry.Info[Context],
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> PaymentMetrics:
        """
        Get aggregated payment metrics.

        Args:
            date_from: Calculate metrics from this date
            date_to: Calculate metrics until this date

        Returns:
            PaymentMetrics with counts, amounts, and success rates
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        # Build base query
        stmt = select(
            func.count(PaymentEntity.payment_id).label("total"),
            func.count(case((PaymentEntity.status == PaymentStatus.SUCCEEDED, 1))).label(
                "succeeded"
            ),
            func.count(case((PaymentEntity.status == PaymentStatus.PENDING, 1))).label("pending"),
            func.count(case((PaymentEntity.status == PaymentStatus.FAILED, 1))).label("failed"),
            func.count(case((PaymentEntity.status == PaymentStatus.REFUNDED, 1))).label("refunded"),
            func.sum(
                case(
                    (PaymentEntity.status == PaymentStatus.SUCCEEDED, PaymentEntity.amount),
                    else_=0,
                )
            ).label("revenue"),
            func.sum(
                case(
                    (PaymentEntity.status == PaymentStatus.PENDING, PaymentEntity.amount),
                    else_=0,
                )
            ).label("pending_amount"),
            func.sum(
                case(
                    (PaymentEntity.status == PaymentStatus.FAILED, PaymentEntity.amount),
                    else_=0,
                )
            ).label("failed_amount"),
            func.sum(PaymentEntity.refund_amount).label("refunded_amount"),
        ).where(PaymentEntity.tenant_id == tenant_id)

        # Apply date filters
        if date_from:
            stmt = stmt.where(PaymentEntity.created_at >= date_from)
        if date_to:
            stmt = stmt.where(PaymentEntity.created_at <= date_to)

        result = await db.execute(stmt)
        row = result.one()
        mapping = row._mapping

        total = int(mapping.get("total") or 0)
        succeeded = int(mapping.get("succeeded") or 0)
        pending = int(mapping.get("pending") or 0)
        failed = int(mapping.get("failed") or 0)
        refunded = int(mapping.get("refunded") or 0)

        revenue = Decimal(str(mapping.get("revenue") or 0))
        pending_amount = Decimal(str(mapping.get("pending_amount") or 0))
        failed_amount = Decimal(str(mapping.get("failed_amount") or 0))
        refunded_amount = Decimal(str(mapping.get("refunded_amount") or 0))

        success_rate = (succeeded / total * 100) if total > 0 else 0.0
        avg_payment = (revenue / succeeded) if succeeded > 0 else Decimal(0)

        # Calculate time-based metrics (today, this week, this month)
        now = datetime.now(UTC)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())
        month_start = today_start.replace(day=1)

        # Today's revenue
        today_stmt = select(
            func.sum(
                case(
                    (PaymentEntity.status == PaymentStatus.SUCCEEDED, PaymentEntity.amount),
                    else_=0,
                )
            )
        ).where(
            PaymentEntity.created_at >= today_start,
            PaymentEntity.tenant_id == tenant_id,
        )
        today_result = await db.execute(today_stmt)
        today_revenue = Decimal(str(today_result.scalar() or 0))

        # This week's revenue
        week_stmt = select(
            func.sum(
                case(
                    (PaymentEntity.status == PaymentStatus.SUCCEEDED, PaymentEntity.amount),
                    else_=0,
                )
            )
        ).where(
            PaymentEntity.created_at >= week_start,
            PaymentEntity.tenant_id == tenant_id,
        )
        week_result = await db.execute(week_stmt)
        week_revenue = Decimal(str(week_result.scalar() or 0))

        # This month's revenue
        month_stmt = select(
            func.sum(
                case(
                    (PaymentEntity.status == PaymentStatus.SUCCEEDED, PaymentEntity.amount),
                    else_=0,
                )
            )
        ).where(
            PaymentEntity.created_at >= month_start,
            PaymentEntity.tenant_id == tenant_id,
        )
        month_result = await db.execute(month_stmt)
        month_revenue = Decimal(str(month_result.scalar() or 0))

        return PaymentMetrics(
            total_payments=total,
            succeeded_count=succeeded,
            pending_count=pending,
            failed_count=failed,
            refunded_count=refunded,
            total_revenue=revenue,
            pending_amount=pending_amount,
            failed_amount=failed_amount,
            refunded_amount=refunded_amount,
            success_rate=success_rate,
            average_payment_size=avg_payment,
            today_revenue=today_revenue,
            week_revenue=week_revenue,
            month_revenue=month_revenue,
        )


__all__ = ["PaymentQueries"]
