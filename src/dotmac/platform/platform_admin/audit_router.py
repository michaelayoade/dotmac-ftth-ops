"""
Platform Admin - Cross-Tenant Audit Log Router

Provides cross-tenant access to audit logs for platform administrators.
All endpoints require platform.admin permission.
"""

from datetime import datetime, timedelta
from typing import Any, cast

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import AuditActivity
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.database import get_async_session

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/audit", tags=["Platform Admin - Audit Logs"])


# ============================================================================
# Response Models
# ============================================================================


class CrossTenantAuditLogResponse(BaseModel):
    """Single audit log entry with tenant info"""

    model_config = ConfigDict()

    id: str
    tenant_id: str
    tenant_name: str | None = None
    user_id: str | None = None
    user_email: str | None = None
    action: str
    resource_type: str
    resource_id: str | None = None
    status: str
    ip_address: str | None = None
    user_agent: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class CrossTenantAuditListResponse(BaseModel):
    """Cross-tenant audit log list"""

    model_config = ConfigDict()

    logs: list[CrossTenantAuditLogResponse]
    total_count: int
    has_more: bool
    tenant_summary: dict[str, int] | None = None  # Count by tenant


class AuditSummaryByTenant(BaseModel):
    """Audit activity summary by tenant"""

    model_config = ConfigDict()

    tenant_id: str
    tenant_name: str | None = None
    total_events: int
    unique_users: int
    by_action: dict[str, int]  # Count by action type
    by_status: dict[str, int]  # Count by status
    last_activity: datetime | None = None


# ============================================================================
# Platform Admin Audit Endpoints
# ============================================================================


@router.get(
    "/logs",
    response_model=CrossTenantAuditListResponse,
    summary="List audit logs across all tenants",
    description="Get audit logs from all tenants (platform admin only)",
)
async def list_all_audit_logs(
    tenant_id: str | None = Query(None, description="Optional tenant filter"),
    user_id: str | None = Query(None, description="Filter by user ID"),
    action: str | None = Query(None, description="Filter by action"),
    resource_type: str | None = Query(None, description="Filter by resource type"),
    severity: str | None = Query(None, description="Filter by severity"),
    start_date: datetime | None = Query(None, description="Start date filter"),
    end_date: datetime | None = Query(None, description="End date filter"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_async_session),
    _current_user: UserInfo = Depends(require_permission("platform.admin")),
) -> CrossTenantAuditListResponse:
    """
    List audit logs across all tenants.

    **Required Permission:** platform.admin

    **Filters:**
    - tenant_id: Drill down to specific tenant
    - user_id: Filter by user
    - action: Filter by action type
    - resource_type: Filter by resource
    - severity: Filter by severity level
    - start_date/end_date: Date range

    **Returns:** Cross-tenant audit log list with tenant summary
    """
    try:
        # Build filters
        filters = []

        if tenant_id:
            filters.append(AuditActivity.tenant_id == tenant_id)

        if user_id:
            filters.append(AuditActivity.user_id == user_id)

        if action:
            filters.append(AuditActivity.action == action)

        if resource_type:
            filters.append(AuditActivity.resource_type == resource_type)

        if severity:
            filters.append(AuditActivity.severity == severity)

        if start_date:
            filters.append(AuditActivity.timestamp >= start_date)

        if end_date:
            filters.append(AuditActivity.timestamp <= end_date)

        # Count total
        count_query = select(func.count(AuditActivity.id))
        if filters:
            count_query = count_query.where(and_(*filters))

        count_result = await session.execute(count_query)
        total_count = count_result.scalar_one()

        # Get logs
        query = (
            select(AuditActivity)
            .limit(limit)
            .offset(offset)
            .order_by(AuditActivity.timestamp.desc())
        )

        if filters:
            query = query.where(and_(*filters))

        result = await session.execute(query)
        logs = result.scalars().all()

        # Convert to response model
        log_responses = []
        for log in logs:
            log_response = CrossTenantAuditLogResponse(
                id=str(log.id),
                tenant_id=log.tenant_id,
                tenant_name=None,  # TODO: Join with tenant table
                user_id=log.user_id,
                user_email=getattr(log, "user_email", None),
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                status=log.severity,  # Map severity to status
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                details=log.details or {},
                created_at=log.timestamp,
            )
            log_responses.append(log_response)

        # Get tenant summary if not filtering by specific tenant
        tenant_summary = None
        if not tenant_id:
            summary_query = select(
                AuditActivity.tenant_id,
                func.count(AuditActivity.id).label("count"),
            ).group_by(AuditActivity.tenant_id)

            if filters:
                summary_query = summary_query.where(and_(*filters))

            summary_result = await session.execute(summary_query)
            tenant_summary = {row.tenant_id: row.count for row in summary_result.all()}

        return CrossTenantAuditListResponse(
            logs=log_responses,
            total_count=total_count,
            has_more=(offset + len(log_responses)) < total_count,
            tenant_summary=tenant_summary,
        )

    except Exception as e:
        logger.error("Failed to list cross-tenant audit logs", error=str(e))
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve audit logs: {str(e)}",
        )


@router.get(
    "/summary",
    response_model=list[AuditSummaryByTenant],
    summary="Get audit activity summary by tenant",
    description="Get audit activity metrics for all tenants (platform admin only)",
)
async def get_audit_summary_by_tenant(
    period_days: int = Query(30, ge=1, le=365),
    min_events: int = Query(0, ge=0, description="Minimum event count to include"),
    session: AsyncSession = Depends(get_async_session),
    _current_user: UserInfo = Depends(require_permission("platform.admin")),
) -> list[AuditSummaryByTenant]:
    """
    Get audit activity summary grouped by tenant.

    **Required Permission:** platform.admin

    **Returns:** List of tenant audit summaries with activity metrics
    """
    try:
        period_start = datetime.utcnow() - timedelta(days=period_days)

        # Get summary by tenant
        summary_query = (
            select(
                AuditActivity.tenant_id,
                AuditActivity.action,
                AuditActivity.severity,
                func.count(AuditActivity.id).label("count"),
                func.count(func.distinct(AuditActivity.user_id)).label("unique_users"),
                func.max(AuditActivity.timestamp).label("last_activity"),
            )
            .where(AuditActivity.timestamp >= period_start)
            .group_by(AuditActivity.tenant_id, AuditActivity.action, AuditActivity.severity)
        )

        result = await session.execute(summary_query)
        rows = result.all()

        # Aggregate by tenant
        tenant_data: dict[str, dict[str, Any]] = {}
        for row in rows:
            t_id = row.tenant_id
            if t_id not in tenant_data:
                tenant_data[t_id] = {
                    "tenant_id": t_id,
                    "tenant_name": None,
                    "total_events": 0,
                    "unique_users": row.unique_users,
                    "by_action": {},
                    "by_status": {},  # Keep by_status for response compatibility
                    "last_activity": row.last_activity,
                }

            tenant_data[t_id]["total_events"] += row.count

            # Aggregate by action
            if row.action in tenant_data[t_id]["by_action"]:
                tenant_data[t_id]["by_action"][row.action] += row.count
            else:
                tenant_data[t_id]["by_action"][row.action] = row.count

            # Aggregate by severity (map to by_status for response)
            if row.severity in tenant_data[t_id]["by_status"]:
                tenant_data[t_id]["by_status"][row.severity] += row.count
            else:
                tenant_data[t_id]["by_status"][row.severity] = row.count

            # Update last activity if newer
            if (
                tenant_data[t_id]["last_activity"] is None
                or row.last_activity > tenant_data[t_id]["last_activity"]
            ):
                tenant_data[t_id]["last_activity"] = row.last_activity

        # Filter by min_events and convert to response model
        summaries = [
            AuditSummaryByTenant(**data)
            for data in tenant_data.values()
            if data["total_events"] >= min_events
        ]

        # Sort by total events descending
        summaries.sort(key=lambda x: x.total_events, reverse=True)

        return summaries

    except Exception as e:
        logger.error("Failed to get audit summary by tenant", error=str(e))
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve audit summary: {str(e)}",
        )


@router.get(
    "/actions",
    response_model=dict[str, int],
    summary="Get audit action counts across all tenants",
    description="Get count of each action type across all tenants (platform admin only)",
)
async def get_action_counts(
    tenant_id: str | None = Query(None, description="Optional tenant filter"),
    period_days: int = Query(30, ge=1, le=365),
    session: AsyncSession = Depends(get_async_session),
    _current_user: UserInfo = Depends(require_permission("platform.admin")),
) -> dict[str, int]:
    """
    Get count of each action type across all tenants.

    **Required Permission:** platform.admin

    **Returns:** Dictionary of action types and their counts
    """
    try:
        period_start = datetime.utcnow() - timedelta(days=period_days)

        filters = [AuditActivity.timestamp >= period_start]

        if tenant_id:
            filters.append(AuditActivity.tenant_id == tenant_id)

        query = (
            select(
                AuditActivity.action,
                func.count(AuditActivity.id).label("count"),
            )
            .where(and_(*filters))
            .group_by(AuditActivity.action)
        )

        result = await session.execute(query)
        rows = result.all()

        return {row.action: cast(int, row.count) for row in rows}

    except Exception as e:
        logger.error("Failed to get action counts", error=str(e))
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve action counts: {str(e)}",
        )


__all__ = ["router"]
