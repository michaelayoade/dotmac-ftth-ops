"""Partner Multi-Tenant API Router.

Provides endpoints for partners to manage multiple tenant accounts.
"""

from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.rbac_dependencies import PartnerPermissionChecker
from dotmac.platform.db import get_async_session
from dotmac.platform.partner_management.models import PartnerTenantLink
from dotmac.platform.partner_management.schemas_multitenant import (
    BillingAlertListResponse,
    ConsolidatedBillingSummary,
    CreateTicketRequest,
    CreateTicketResponse,
    InvoiceExportRequest,
    InvoiceExportResponse,
    InvoiceListResponse,
    ManagedTenantDetail,
    ManagedTenantListResponse,
    SLAAlertListResponse,
    SLAReportResponse,
    TicketListResponse,
    UpdateTicketRequest,
    UsageReportResponse,
)
from dotmac.platform.tenant.models import Tenant

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/partner", tags=["Partner Multi-Tenant"])


# ============================================
# Tenant Management Endpoints
# ============================================


@router.get(
    "/customers",
    response_model=ManagedTenantListResponse,
    dependencies=[Depends(PartnerPermissionChecker(["partner.tenants.list"]))],
)
async def list_managed_tenants(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: str | None = Query(None, description="Filter by tenant status"),
    include_metrics: bool = Query(False, description="Include tenant metrics"),
) -> ManagedTenantListResponse:
    """
    List all managed tenant accounts for the authenticated partner.

    Returns:
        List of managed tenants with optional metrics
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # Build query for partner's tenant links
    query = (
        select(PartnerTenantLink, Tenant)
        .join(Tenant, PartnerTenantLink.managed_tenant_id == Tenant.id)
        .where(PartnerTenantLink.partner_id == current_user.partner_id)
    )

    # Apply filters
    if status:
        query = query.where(Tenant.status == status)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    query = query.offset(offset).limit(limit)

    # Execute query
    result = await db.execute(query)
    rows = result.all()

    # Build response
    from dotmac.platform.partner_management.schemas_multitenant import (
        ManagedTenantMetrics,
        ManagedTenantSummary,
    )

    tenants_list = []
    for link, tenant in rows:
        metrics = None
        if include_metrics:
            # TODO: Implement metrics calculation
            # For now, return None or basic metrics
            metrics = ManagedTenantMetrics(
                total_subscribers=0,
                total_revenue_mtd=0,
                accounts_receivable=0,
                overdue_invoices_count=0,
                open_tickets_count=0,
            )

        tenant_summary = ManagedTenantSummary(
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            tenant_slug=tenant.slug,
            status=tenant.status.value if hasattr(tenant.status, "value") else str(tenant.status),
            access_role=link.access_role.value,
            relationship_type=link.relationship_type,
            start_date=link.start_date,
            end_date=link.end_date,
            is_active=link.is_active,
            is_expired=link.is_expired,
            metrics=metrics,
        )
        tenants_list.append(tenant_summary)

    logger.info(
        "Partner listed managed tenants",
        partner_id=current_user.partner_id,
        count=len(tenants_list),
        total=total,
    )

    return ManagedTenantListResponse(
        tenants=tenants_list,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/customers/{tenant_id}",
    response_model=ManagedTenantDetail,
    dependencies=[Depends(PartnerPermissionChecker(["partner.tenants.list"]))],
)
async def get_managed_tenant_detail(
    tenant_id: str,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
    include_metrics: bool = Query(False, description="Include tenant metrics"),
) -> ManagedTenantDetail:
    """
    Get detailed information for a specific managed tenant.

    Args:
        tenant_id: Managed tenant ID

    Returns:
        Detailed tenant information including configuration and metrics
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # Validate access to this tenant
    if tenant_id not in current_user.managed_tenant_ids:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Partner does not have access to this tenant",
        )

    # Query for link and tenant
    result = await db.execute(
        select(PartnerTenantLink, Tenant)
        .join(Tenant, PartnerTenantLink.managed_tenant_id == Tenant.id)
        .where(
            and_(
                PartnerTenantLink.partner_id == current_user.partner_id,
                PartnerTenantLink.managed_tenant_id == tenant_id,
            )
        )
    )
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Managed tenant not found",
        )

    link, tenant = row

    # Build metrics if requested
    from dotmac.platform.partner_management.schemas_multitenant import ManagedTenantMetrics

    metrics = None
    if include_metrics:
        # TODO: Implement actual metrics calculation
        metrics = ManagedTenantMetrics(
            total_subscribers=0,
            total_revenue_mtd=0,
            accounts_receivable=0,
            overdue_invoices_count=0,
            open_tickets_count=0,
        )

    logger.info(
        "Partner viewed managed tenant detail",
        partner_id=current_user.partner_id,
        tenant_id=tenant_id,
    )

    return ManagedTenantDetail(
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        tenant_slug=tenant.slug,
        status=tenant.status.value if hasattr(tenant.status, "value") else str(tenant.status),
        access_role=link.access_role.value,
        relationship_type=link.relationship_type,
        start_date=link.start_date,
        end_date=link.end_date,
        is_active=link.is_active,
        is_expired=link.is_expired,
        sla_response_hours=link.sla_response_hours,
        sla_uptime_target=link.sla_uptime_target,
        notify_on_sla_breach=link.notify_on_sla_breach,
        notify_on_billing_threshold=link.notify_on_billing_threshold,
        billing_alert_threshold=link.billing_alert_threshold,
        custom_permissions=link.custom_permissions or {},
        notes=link.notes,
        metadata=link.metadata_ or {},
        metrics=metrics,
    )


# ============================================
# Billing Endpoints
# ============================================


@router.get(
    "/billing/summary",
    response_model=ConsolidatedBillingSummary,
    dependencies=[Depends(PartnerPermissionChecker(["partner.billing.summary.read"]))],
)
async def get_consolidated_billing_summary(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
    from_date: datetime | None = Query(None, description="Start date for revenue calculation"),
    status: str | None = Query(None, description="Filter by invoice status (e.g., overdue)"),
) -> ConsolidatedBillingSummary:
    """
    Get consolidated billing summary across all managed tenants.

    Args:
        from_date: Optional start date for revenue calculation
        status: Optional filter by invoice status

    Returns:
        Consolidated billing metrics with per-tenant breakdown
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # TODO: Implement actual billing calculation
    # For now, return placeholder data
    from decimal import Decimal

    logger.info(
        "Partner requested consolidated billing summary",
        partner_id=current_user.partner_id,
        managed_tenants_count=len(current_user.managed_tenant_ids),
    )

    return ConsolidatedBillingSummary(
        total_revenue=Decimal("0.00"),
        total_ar=Decimal("0.00"),
        total_overdue=Decimal("0.00"),
        overdue_invoices_count=0,
        tenants_count=len(current_user.managed_tenant_ids),
        tenants=[],
        as_of_date=datetime.now(UTC),
    )


@router.get(
    "/billing/invoices",
    response_model=InvoiceListResponse,
    dependencies=[Depends(PartnerPermissionChecker(["partner.billing.invoices.read"]))],
)
async def list_invoices(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    tenant_id: str | None = Query(None, description="Filter by specific tenant"),
    status: str | None = Query(None, description="Filter by invoice status"),
    from_date: datetime | None = Query(None, description="Filter by invoice date >= from_date"),
    to_date: datetime | None = Query(None, description="Filter by invoice date <= to_date"),
) -> InvoiceListResponse:
    """
    List invoices across all managed tenants.

    Returns:
        Paginated list of invoices with filtering options
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # Validate tenant_id if provided
    if tenant_id and tenant_id not in current_user.managed_tenant_ids:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Partner does not have access to this tenant",
        )

    # TODO: Implement actual invoice querying
    # For now, return empty list
    logger.info(
        "Partner listed invoices",
        partner_id=current_user.partner_id,
        filters={"tenant_id": tenant_id, "status": status},
    )

    return InvoiceListResponse(
        invoices=[],
        total=0,
        offset=offset,
        limit=limit,
        filters_applied={
            "tenant_id": tenant_id,
            "status": status,
            "from_date": from_date,
            "to_date": to_date,
        },
    )


@router.post(
    "/billing/invoices/export",
    response_model=InvoiceExportResponse,
    dependencies=[Depends(PartnerPermissionChecker(["partner.billing.invoices.export"]))],
)
async def export_invoices(
    request: InvoiceExportRequest,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
) -> InvoiceExportResponse:
    """
    Request invoice export (CSV or PDF).

    Returns:
        Export job information with download URL when ready
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # Validate tenant_ids if provided
    if request.tenant_ids:
        unauthorized = set(request.tenant_ids) - set(current_user.managed_tenant_ids)
        if unauthorized:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail=f"Partner does not have access to tenants: {unauthorized}",
            )

    # TODO: Implement actual export job creation
    import uuid

    export_id = str(uuid.uuid4())

    logger.info(
        "Partner requested invoice export",
        partner_id=current_user.partner_id,
        export_id=export_id,
        format=request.format,
    )

    return InvoiceExportResponse(
        export_id=export_id,
        status="pending",
        download_url=None,
        expires_at=None,
        estimated_completion=datetime.now(UTC),
    )


# ============================================
# Support/Ticketing Endpoints
# ============================================


@router.get(
    "/support/tickets",
    response_model=TicketListResponse,
    dependencies=[Depends(PartnerPermissionChecker(["partner.support.tickets.list"]))],
)
async def list_tickets(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    tenant_id: str | None = Query(None, description="Filter by specific tenant"),
    status: str | None = Query(None, description="Filter by ticket status"),
    priority: str | None = Query(None, description="Filter by priority"),
) -> TicketListResponse:
    """
    List support tickets across all managed tenants.

    Returns:
        Paginated list of tickets with filtering options
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # Validate tenant_id if provided
    if tenant_id and tenant_id not in current_user.managed_tenant_ids:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Partner does not have access to this tenant",
        )

    # TODO: Implement actual ticket querying
    logger.info(
        "Partner listed tickets",
        partner_id=current_user.partner_id,
        filters={"tenant_id": tenant_id, "status": status, "priority": priority},
    )

    return TicketListResponse(
        tickets=[],
        total=0,
        offset=offset,
        limit=limit,
        filters_applied={"tenant_id": tenant_id, "status": status, "priority": priority},
    )


@router.post(
    "/support/tickets",
    response_model=CreateTicketResponse,
    dependencies=[Depends(PartnerPermissionChecker(["partner.support.tickets.create"]))],
)
async def create_ticket(
    request: CreateTicketRequest,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
) -> CreateTicketResponse:
    """
    Create a support ticket on behalf of a managed tenant.

    Requires X-Active-Tenant-Id header to specify which tenant the ticket is for.

    Returns:
        Created ticket information
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # Require cross-tenant context
    if not current_user.is_cross_tenant_access:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="X-Active-Tenant-Id header required to create ticket for managed tenant",
        )

    # TODO: Implement actual ticket creation
    import uuid

    ticket_id = str(uuid.uuid4())

    logger.info(
        "Partner created ticket for managed tenant",
        partner_id=current_user.partner_id,
        tenant_id=current_user.active_managed_tenant_id,
        ticket_id=ticket_id,
        subject=request.subject,
    )

    return CreateTicketResponse(
        ticket_id=ticket_id,
        ticket_number=f"TKT-{uuid.uuid4().hex[:8].upper()}",
        tenant_id=current_user.active_managed_tenant_id or "",
        status="open",
        created_at=datetime.now(UTC),
    )


@router.patch(
    "/support/tickets/{ticket_id}",
    dependencies=[Depends(PartnerPermissionChecker(["partner.support.tickets.update"]))],
)
async def update_ticket(
    ticket_id: str,
    request: UpdateTicketRequest,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
) -> dict:
    """
    Update a support ticket.

    Returns:
        Updated ticket information
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # TODO: Implement actual ticket update
    logger.info(
        "Partner updated ticket",
        partner_id=current_user.partner_id,
        ticket_id=ticket_id,
        updates=request.dict(exclude_none=True),
    )

    return {"ticket_id": ticket_id, "status": "updated", "updated_at": datetime.now(UTC)}


# ============================================
# Reporting Endpoints
# ============================================


@router.get(
    "/reports/usage",
    response_model=UsageReportResponse,
    dependencies=[Depends(PartnerPermissionChecker(["partner.reports.usage.read"]))],
)
async def get_usage_report(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
    from_date: datetime = Query(..., description="Report start date"),
    to_date: datetime = Query(..., description="Report end date"),
    tenant_ids: list[str] | None = Query(None, description="Filter by specific tenants"),
) -> UsageReportResponse:
    """
    Get usage report across managed tenants.

    Args:
        from_date: Report period start
        to_date: Report period end
        tenant_ids: Optional list of tenant IDs to include

    Returns:
        Usage metrics aggregated across tenants
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # Validate tenant_ids if provided
    if tenant_ids:
        unauthorized = set(tenant_ids) - set(current_user.managed_tenant_ids)
        if unauthorized:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail=f"Partner does not have access to tenants: {unauthorized}",
            )

    # TODO: Implement actual usage report generation
    from decimal import Decimal

    logger.info(
        "Partner requested usage report",
        partner_id=current_user.partner_id,
        period_start=from_date,
        period_end=to_date,
    )

    return UsageReportResponse(
        period_start=from_date,
        period_end=to_date,
        tenants=[],
        total_data_gb=Decimal("0.00"),
        total_sessions=0,
    )


@router.get(
    "/reports/sla",
    response_model=SLAReportResponse,
    dependencies=[Depends(PartnerPermissionChecker(["partner.reports.sla.read"]))],
)
async def get_sla_report(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
    from_date: datetime = Query(..., description="Report start date"),
    to_date: datetime = Query(..., description="Report end date"),
    tenant_ids: list[str] | None = Query(None, description="Filter by specific tenants"),
) -> SLAReportResponse:
    """
    Get SLA compliance report across managed tenants.

    Args:
        from_date: Report period start
        to_date: Report period end
        tenant_ids: Optional list of tenant IDs to include

    Returns:
        SLA compliance metrics per tenant
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # Validate tenant_ids if provided
    if tenant_ids:
        unauthorized = set(tenant_ids) - set(current_user.managed_tenant_ids)
        if unauthorized:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail=f"Partner does not have access to tenants: {unauthorized}",
            )

    # TODO: Implement actual SLA report generation
    from decimal import Decimal

    logger.info(
        "Partner requested SLA report",
        partner_id=current_user.partner_id,
        period_start=from_date,
        period_end=to_date,
    )

    return SLAReportResponse(
        period_start=from_date,
        period_end=to_date,
        tenants=[],
        overall_compliance_pct=Decimal("100.00"),
    )


# ============================================
# Alert Endpoints
# ============================================


@router.get(
    "/alerts/sla",
    response_model=SLAAlertListResponse,
    dependencies=[Depends(PartnerPermissionChecker(["partner.alerts.sla.read"]))],
)
async def get_sla_alerts(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
    tenant_id: str | None = Query(None, description="Filter by specific tenant"),
    acknowledged: bool | None = Query(None, description="Filter by acknowledged status"),
) -> SLAAlertListResponse:
    """
    Get SLA breach alerts for managed tenants.

    Returns:
        List of SLA alerts with acknowledgment status
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # Validate tenant_id if provided
    if tenant_id and tenant_id not in current_user.managed_tenant_ids:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Partner does not have access to this tenant",
        )

    # TODO: Implement actual SLA alert querying
    logger.info(
        "Partner requested SLA alerts",
        partner_id=current_user.partner_id,
        filters={"tenant_id": tenant_id, "acknowledged": acknowledged},
    )

    return SLAAlertListResponse(
        alerts=[],
        total=0,
        unacknowledged_count=0,
    )


@router.get(
    "/alerts/billing",
    response_model=BillingAlertListResponse,
    dependencies=[Depends(PartnerPermissionChecker(["partner.alerts.billing.read"]))],
)
async def get_billing_alerts(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
    tenant_id: str | None = Query(None, description="Filter by specific tenant"),
    acknowledged: bool | None = Query(None, description="Filter by acknowledged status"),
) -> BillingAlertListResponse:
    """
    Get billing threshold alerts for managed tenants.

    Returns:
        List of billing alerts with acknowledgment status
    """
    if not current_user.partner_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a partner",
        )

    # Validate tenant_id if provided
    if tenant_id and tenant_id not in current_user.managed_tenant_ids:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Partner does not have access to this tenant",
        )

    # TODO: Implement actual billing alert querying
    logger.info(
        "Partner requested billing alerts",
        partner_id=current_user.partner_id,
        filters={"tenant_id": tenant_id, "acknowledged": acknowledged},
    )

    return BillingAlertListResponse(
        alerts=[],
        total=0,
        unacknowledged_count=0,
    )
