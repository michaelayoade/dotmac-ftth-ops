"""
Platform Admin - Cross-Tenant Billing Router

Provides cross-tenant access to billing data for platform administrators.
All endpoints require platform.admin permission.
"""

# mypy: ignore-errors

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus
from dotmac.platform.billing.core.models import Invoice, Payment
from dotmac.platform.database import get_async_session

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/billing", tags=["Platform Admin - Billing"])


# ============================================================================
# Response Models
# ============================================================================


class TenantInvoiceSummary(BaseModel):
    """Summary of invoices for a tenant"""

    model_config = ConfigDict(from_attributes=True)

    tenant_id: str
    tenant_name: str | None = None
    total_invoices: int
    draft_count: int
    open_count: int
    paid_count: int
    void_count: int
    uncollectible_count: int
    total_amount: int  # Total across all invoices
    total_paid: int  # Total paid amount
    total_outstanding: int  # Total outstanding amount


class CrossTenantInvoiceListResponse(BaseModel):
    """Cross-tenant invoice list"""

    model_config = ConfigDict()

    invoices: list[dict[str, Any]]
    total_count: int
    has_more: bool
    tenant_summaries: list[TenantInvoiceSummary] | None = None


class CrossTenantPaymentListResponse(BaseModel):
    """Cross-tenant payment list"""

    model_config = ConfigDict()

    payments: list[dict[str, Any]]
    total_count: int
    has_more: bool


class PlatformBillingSummary(BaseModel):
    """Platform-wide billing summary"""

    model_config = ConfigDict()

    total_tenants: int
    total_invoices: int
    total_payments: int
    total_revenue: int  # Total paid
    total_outstanding: int  # Total unpaid
    mrr: int  # Monthly Recurring Revenue
    arr: int  # Annual Recurring Revenue
    by_status: dict[str, int]  # Count by invoice status
    by_tenant: list[TenantInvoiceSummary]


# ============================================================================
# Platform Admin Billing Endpoints
# ============================================================================


@router.get(
    "/invoices",
    response_model=CrossTenantInvoiceListResponse,
    summary="List all invoices across tenants",
    description="Get invoices from all tenants (platform admin only)",
)
async def list_all_invoices(
    tenant_id: str | None = Query(None, description="Optional tenant filter"),
    status: InvoiceStatus | None = Query(None, description="Filter by invoice status"),
    customer_id: str | None = Query(None, description="Filter by customer ID"),
    limit: int = Query(100, ge=1, le=1000, description="Max results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    session: AsyncSession = Depends(get_async_session),
    _current_user=Depends(require_permission("platform.admin")),
):
    """
    List invoices across all tenants.

    **Required Permission:** platform.admin

    **Filters:**
    - tenant_id: Drill down to specific tenant
    - status: Filter by invoice status
    - customer_id: Filter by customer

    **Returns:** Cross-tenant invoice list with tenant summaries
    """
    try:
        # Build base query
        filters = []

        if tenant_id:
            filters.append(Invoice.tenant_id == tenant_id)

        if status:
            filters.append(Invoice.status == status)

        if customer_id:
            filters.append(Invoice.customer_id == customer_id)

        # Count total
        count_query = select(func.count(Invoice.id))
        if filters:
            count_query = count_query.where(and_(*filters))

        count_result = await session.execute(count_query)
        total_count = count_result.scalar_one()

        # Get invoices
        query = select(Invoice).limit(limit).offset(offset).order_by(Invoice.created_at.desc())

        if filters:
            query = query.where(and_(*filters))

        result = await session.execute(query)
        invoices = result.scalars().all()

        # Convert to dict with tenant_id included
        invoice_dicts = []
        for invoice in invoices:
            invoice_dict = {
                "id": invoice.id,
                "tenant_id": invoice.tenant_id,  # ✅ Include tenant_id
                "customer_id": invoice.customer_id,
                "status": invoice.status,
                "amount": invoice.amount_due,
                "amount_paid": invoice.amount_paid or 0,
                "amount_remaining": invoice.amount_remaining or invoice.amount_due,
                "currency": invoice.currency,
                "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
                "created_at": invoice.created_at.isoformat(),
                "billing_email": invoice.billing_email,
            }
            invoice_dicts.append(invoice_dict)

        # Get tenant summaries if not filtering by specific tenant
        tenant_summaries = None
        if not tenant_id:
            summary_query = select(
                Invoice.tenant_id,
                Invoice.status,
                func.count(Invoice.id).label("count"),
                func.sum(Invoice.amount_due).label("total_amount"),
                func.sum(Invoice.amount_paid).label("total_paid"),
            ).group_by(Invoice.tenant_id, Invoice.status)

            summary_result = await session.execute(summary_query)
            summary_rows = summary_result.all()

            # Aggregate by tenant
            tenant_data: dict[str, dict[str, Any]] = {}
            for row in summary_rows:
                t_id = row.tenant_id
                if t_id not in tenant_data:
                    tenant_data[t_id] = {
                        "tenant_id": t_id,
                        "tenant_name": None,  # TODO: Join with tenant table
                        "total_invoices": 0,
                        "draft_count": 0,
                        "open_count": 0,
                        "paid_count": 0,
                        "void_count": 0,
                        "uncollectible_count": 0,
                        "total_amount": 0,
                        "total_paid": 0,
                        "total_outstanding": 0,
                    }

                tenant_data[t_id]["total_invoices"] += row.count

                if row.status == InvoiceStatus.DRAFT:
                    tenant_data[t_id]["draft_count"] = row.count
                elif row.status == InvoiceStatus.OPEN:
                    tenant_data[t_id]["open_count"] = row.count
                elif row.status == InvoiceStatus.PAID:
                    tenant_data[t_id]["paid_count"] = row.count
                elif row.status == InvoiceStatus.VOID:
                    tenant_data[t_id]["void_count"] = row.count
                elif row.status == InvoiceStatus.UNCOLLECTIBLE:
                    tenant_data[t_id]["uncollectible_count"] = row.count

                tenant_data[t_id]["total_amount"] += row.total_amount or 0
                tenant_data[t_id]["total_paid"] += row.total_paid or 0

            # Calculate outstanding
            for t_data in tenant_data.values():
                t_data["total_outstanding"] = t_data["total_amount"] - t_data["total_paid"]

            tenant_summaries = [TenantInvoiceSummary(**data) for data in tenant_data.values()]

        return CrossTenantInvoiceListResponse(
            invoices=invoice_dicts,
            total_count=total_count,
            has_more=(offset + len(invoice_dicts)) < total_count,
            tenant_summaries=tenant_summaries,
        )

    except Exception as e:
        logger.error("Failed to list cross-tenant invoices", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve invoices: {str(e)}",
        )


@router.get(
    "/payments",
    response_model=CrossTenantPaymentListResponse,
    summary="List all payments across tenants",
    description="Get payments from all tenants (platform admin only)",
)
async def list_all_payments(
    tenant_id: str | None = Query(None, description="Optional tenant filter"),
    status: PaymentStatus | None = Query(None, description="Filter by payment status"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_async_session),
    _current_user=Depends(require_permission("platform.admin")),
):
    """
    List payments across all tenants.

    **Required Permission:** platform.admin

    **Returns:** Cross-tenant payment list
    """
    try:
        filters = []

        if tenant_id:
            filters.append(Payment.tenant_id == tenant_id)

        if status:
            filters.append(Payment.status == status)

        # Count total
        count_query = select(func.count(Payment.id))
        if filters:
            count_query = count_query.where(and_(*filters))

        count_result = await session.execute(count_query)
        total_count = count_result.scalar_one()

        # Get payments
        query = select(Payment).limit(limit).offset(offset).order_by(Payment.created_at.desc())

        if filters:
            query = query.where(and_(*filters))

        result = await session.execute(query)
        payments = result.scalars().all()

        # Convert to dict with tenant_id
        payment_dicts = []
        for payment in payments:
            payment_dict = {
                "id": payment.id,
                "tenant_id": payment.tenant_id,  # ✅ Include tenant_id
                "invoice_id": payment.invoice_id,
                "amount": payment.amount,
                "currency": payment.currency,
                "status": payment.status,
                "payment_method": getattr(payment, "payment_method", None),
                "created_at": payment.created_at.isoformat(),
            }
            payment_dicts.append(payment_dict)

        return CrossTenantPaymentListResponse(
            payments=payment_dicts,
            total_count=total_count,
            has_more=(offset + len(payment_dicts)) < total_count,
        )

    except Exception as e:
        logger.error("Failed to list cross-tenant payments", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve payments: {str(e)}",
        )


@router.get(
    "/summary",
    response_model=PlatformBillingSummary,
    summary="Get platform-wide billing summary",
    description="Get billing metrics across all tenants (platform admin only)",
)
async def get_platform_billing_summary(
    session: AsyncSession = Depends(get_async_session),
    _current_user=Depends(require_permission("platform.admin")),
):
    """
    Get platform-wide billing summary with cross-tenant metrics.

    **Required Permission:** platform.admin

    **Returns:**
    - Total tenants
    - Total invoices and payments
    - Revenue metrics (MRR, ARR)
    - Per-tenant breakdown
    """
    try:
        # Count unique tenants
        tenant_count_query = select(func.count(func.distinct(Invoice.tenant_id)))
        tenant_count_result = await session.execute(tenant_count_query)
        total_tenants = tenant_count_result.scalar_one()

        # Total invoices
        invoice_count_query = select(func.count(Invoice.id))
        invoice_count_result = await session.execute(invoice_count_query)
        total_invoices = invoice_count_result.scalar_one()

        # Total payments
        payment_count_query = select(func.count(Payment.id))
        payment_count_result = await session.execute(payment_count_query)
        total_payments = payment_count_result.scalar_one()

        # Revenue metrics
        revenue_query = select(
            func.sum(Invoice.amount_paid).label("total_revenue"),
            func.sum(Invoice.amount_remaining).label("total_outstanding"),
        )
        revenue_result = await session.execute(revenue_query)
        revenue_row = revenue_result.one()

        total_revenue = revenue_row.total_revenue or 0
        total_outstanding = revenue_row.total_outstanding or 0

        # Count by status
        status_query = select(Invoice.status, func.count(Invoice.id).label("count")).group_by(
            Invoice.status
        )
        status_result = await session.execute(status_query)
        by_status = {row.status: row.count for row in status_result.all()}

        # Tenant summaries (same as in list_all_invoices)
        summary_query = select(
            Invoice.tenant_id,
            Invoice.status,
            func.count(Invoice.id).label("count"),
            func.sum(Invoice.amount_due).label("total_amount"),
            func.sum(Invoice.amount_paid).label("total_paid"),
        ).group_by(Invoice.tenant_id, Invoice.status)

        summary_result = await session.execute(summary_query)
        summary_rows = summary_result.all()

        tenant_data: dict[str, dict[str, Any]] = {}
        for row in summary_rows:
            t_id = row.tenant_id
            if t_id not in tenant_data:
                tenant_data[t_id] = {
                    "tenant_id": t_id,
                    "tenant_name": None,
                    "total_invoices": 0,
                    "draft_count": 0,
                    "open_count": 0,
                    "paid_count": 0,
                    "void_count": 0,
                    "uncollectible_count": 0,
                    "total_amount": 0,
                    "total_paid": 0,
                    "total_outstanding": 0,
                }

            tenant_data[t_id]["total_invoices"] += row.count

            if row.status == InvoiceStatus.DRAFT:
                tenant_data[t_id]["draft_count"] = row.count
            elif row.status == InvoiceStatus.OPEN:
                tenant_data[t_id]["open_count"] = row.count
            elif row.status == InvoiceStatus.PAID:
                tenant_data[t_id]["paid_count"] = row.count
            elif row.status == InvoiceStatus.VOID:
                tenant_data[t_id]["void_count"] = row.count
            elif row.status == InvoiceStatus.UNCOLLECTIBLE:
                tenant_data[t_id]["uncollectible_count"] = row.count

            tenant_data[t_id]["total_amount"] += row.total_amount or 0
            tenant_data[t_id]["total_paid"] += row.total_paid or 0

        for t_data in tenant_data.values():
            t_data["total_outstanding"] = t_data["total_amount"] - t_data["total_paid"]

        by_tenant = [TenantInvoiceSummary(**data) for data in tenant_data.values()]

        # TODO: Calculate MRR and ARR properly from subscription data
        mrr = 0  # Placeholder
        arr = 0  # Placeholder

        return PlatformBillingSummary(
            total_tenants=total_tenants,
            total_invoices=total_invoices,
            total_payments=total_payments,
            total_revenue=total_revenue,
            total_outstanding=total_outstanding,
            mrr=mrr,
            arr=arr,
            by_status=by_status,
            by_tenant=by_tenant,
        )

    except Exception as e:
        logger.error("Failed to generate platform billing summary", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate summary: {str(e)}",
        )


__all__ = ["router"]
