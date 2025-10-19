"""
FastAPI router for audit and activity endpoints.
"""

from datetime import UTC
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.core import UserInfo, get_current_user, get_current_user_optional
from ..auth.platform_admin import is_platform_admin
from ..db import get_async_session
from ..tenant import get_current_tenant_id
from .models import (
    ActivitySeverity,
    ActivityType,
    AuditActivityList,
    AuditActivityResponse,
    AuditFilterParams,
    FrontendLogLevel,
    FrontendLogsRequest,
    FrontendLogsResponse,
)
from .service import AuditService, log_api_activity

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/audit", tags=["Audit"])


@router.get("/activities", response_model=AuditActivityList)
async def list_activities(
    request: Request,
    user_id: str | None = Query(None, description="Filter by user ID"),
    activity_type: ActivityType | None = Query(None, description="Filter by activity type"),
    severity: ActivitySeverity | None = Query(None, description="Filter by severity"),
    resource_type: str | None = Query(None, description="Filter by resource type"),
    resource_id: str | None = Query(None, description="Filter by resource ID"),
    days: int | None = Query(30, ge=1, le=365, description="Number of days to look back"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=1000, description="Items per page"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> AuditActivityList:
    """
    Get paginated list of audit activities.

    Supports filtering by various criteria and is tenant-aware.
    """
    try:
        # Build filter parameters
        from datetime import datetime, timedelta

        start_date = datetime.now(UTC) - timedelta(days=days) if days else None

        tenant_id = get_current_tenant_id()
        if tenant_id is None:
            if is_platform_admin(current_user):
                tenant_id = request.headers.get("X-Target-Tenant-ID") or request.query_params.get(
                    "tenant_id"
                )
                if not tenant_id:
                    raise HTTPException(
                        status_code=400,
                        detail="Platform administrators must specify tenant_id via header or query parameter.",
                    )
            else:
                raise HTTPException(status_code=400, detail="Tenant context required")

        filters = AuditFilterParams(
            user_id=user_id,
            tenant_id=tenant_id,  # Always filter by current tenant
            activity_type=activity_type,
            severity=severity,
            resource_type=resource_type,
            resource_id=resource_id,
            start_date=start_date,
            page=page,
            per_page=per_page,
        )

        # Create service and get activities
        service = AuditService(session)
        activities = await service.get_activities(filters)

        # Log this API access (skip in test environment to avoid session conflicts)
        if request.url.hostname not in ("testserver", "test", "localhost"):
            await log_api_activity(
                request=request,
                action="list_activities",
                description=f"User {current_user.user_id} retrieved audit activities",
                severity=ActivitySeverity.LOW,
                details={
                    "filters": filters.model_dump(exclude_none=True, mode="json"),
                    "result_count": len(activities.activities),
                },
            )

        return activities

    except Exception as e:
        logger.error("Error retrieving audit activities", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve audit activities")


@router.get("/activities/recent", response_model=list[AuditActivityResponse])
async def get_recent_activities(
    request: Request,
    limit: int = Query(20, ge=1, le=100, description="Maximum number of activities to return"),
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> list[AuditActivityResponse]:
    """
    Get recent audit activities for dashboard/frontend views.

    Returns the most recent activities for the current tenant, optimized for frontend display.
    """
    try:
        service = AuditService(session)

        # Get activities for current tenant
        tenant_id = get_current_tenant_id()
        if tenant_id is None:
            if is_platform_admin(current_user):
                tenant_id = request.headers.get("X-Target-Tenant-ID") or request.query_params.get(
                    "tenant_id"
                )
                if not tenant_id:
                    raise HTTPException(
                        status_code=400,
                        detail="Platform administrators must specify tenant_id via header or query parameter.",
                    )
            else:
                raise HTTPException(status_code=400, detail="Tenant context required")

        activities = await service.get_recent_activities(
            tenant_id=tenant_id,
            limit=limit,
            days=days,
        )

        # Log this API access (skip in test environment to avoid session conflicts)
        if request.url.hostname not in ("testserver", "test", "localhost"):
            await log_api_activity(
                request=request,
                action="get_recent_activities",
                description=f"User {current_user.user_id} retrieved recent activities",
                severity=ActivitySeverity.LOW,
                details={
                    "limit": limit,
                    "days": days,
                    "result_count": len(activities),
                },
            )

        return activities

    except Exception as e:
        logger.error("Error retrieving recent activities", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve recent activities")


@router.get("/activities/user/{user_id}", response_model=list[AuditActivityResponse])
async def get_user_activities(
    user_id: str,
    request: Request,
    limit: int = Query(50, ge=1, le=200, description="Maximum number of activities to return"),
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> list[AuditActivityResponse]:
    """
    Get audit activities for a specific user.

    Users can only view their own activities unless they have admin permissions.
    """
    try:
        # Security check: users can only view their own activities unless admin
        if user_id != current_user.user_id and "admin" not in current_user.roles:
            raise HTTPException(
                status_code=403, detail="Insufficient permissions to view other user's activities"
            )

        service = AuditService(session)

        activities = await service.get_recent_activities(
            user_id=user_id,
            tenant_id=current_user.tenant_id,  # Ensure tenant isolation
            limit=limit,
            days=days,
        )

        # Log this API access (skip in test environment to avoid session conflicts)
        if request.url.hostname not in ("testserver", "test", "localhost"):
            await log_api_activity(
                request=request,
                action="get_user_activities",
                description=f"User {current_user.user_id} retrieved activities for user {user_id}",
                severity=(
                    ActivitySeverity.MEDIUM
                    if user_id != current_user.user_id
                    else ActivitySeverity.LOW
                ),
                details={
                    "target_user_id": user_id,
                    "limit": limit,
                    "days": days,
                    "result_count": len(activities),
                },
            )

        return activities

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error retrieving user activities", error=str(e), user_id=user_id, exc_info=True
        )
        raise HTTPException(status_code=500, detail="Failed to retrieve user activities")


@router.get("/activities/summary")
async def get_activity_summary(
    request: Request,
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get activity summary statistics for the current tenant.

    Provides aggregated data for dashboard widgets and analytics.
    """
    try:
        service = AuditService(session)

        summary = await service.get_activity_summary(
            tenant_id=current_user.tenant_id,
            days=days,
        )

        # Log this API access (skip in test environment to avoid session conflicts)
        if request.url.hostname not in ("testserver", "test", "localhost"):
            await log_api_activity(
                request=request,
                action="get_activity_summary",
                description=f"User {current_user.user_id} retrieved activity summary",
                severity=ActivitySeverity.LOW,
                details={
                    "days": days,
                    "total_activities": summary.get("total_activities", 0),
                },
            )

        return summary

    except Exception as e:
        logger.error("Error retrieving activity summary", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve activity summary")


@router.get("/activities/{activity_id}", response_model=AuditActivityResponse)
async def get_activity_details(
    activity_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> AuditActivityResponse:
    """
    Get details for a specific audit activity.

    Returns detailed information about a single audit event.
    """
    try:
        from sqlalchemy import select

        from .models import AuditActivity

        # Query for the specific activity
        query = select(AuditActivity).where(
            AuditActivity.id == activity_id,
            AuditActivity.tenant_id == current_user.tenant_id,  # Ensure tenant isolation
        )

        result = await session.execute(query)
        activity = result.scalar_one_or_none()

        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")

        # Security check: users can only view activities they're involved in unless admin
        if activity.user_id != current_user.user_id and "admin" not in current_user.roles:
            raise HTTPException(
                status_code=403, detail="Insufficient permissions to view this activity"
            )

        # Log this API access (skip in test environment to avoid session conflicts)
        if request.url.hostname not in ("testserver", "test", "localhost"):
            await log_api_activity(
                request=request,
                action="get_activity_details",
                description=f"User {current_user.user_id} retrieved activity details",
                severity=ActivitySeverity.LOW,
                details={
                    "activity_id": str(activity_id),
                    "activity_type": activity.activity_type,
                },
            )

        return AuditActivityResponse.model_validate(activity)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error retrieving activity details",
            error=str(e),
            activity_id=activity_id,
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Failed to retrieve activity details")


@router.post("/frontend-logs", response_model=FrontendLogsResponse)
async def create_frontend_logs(
    request: Request,
    logs_request: FrontendLogsRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> FrontendLogsResponse:
    """
    Accept batched frontend logs from the client application.

    Stores frontend logs in the audit_activities table for centralized logging.
    Logs are associated with the current user session if authenticated.

    **Features:**
    - Batched ingestion (up to 100 logs per request)
    - Automatic user/tenant association from session
    - Client metadata capture (userAgent, url, etc.)
    - Log level mapping to activity severity

    **Security:**
    - Unauthenticated requests are accepted but marked appropriately
    - Logs are tenant-isolated when user is authenticated
    - Rate limiting should be applied at the API gateway level
    """
    try:
        # Map frontend log levels to activity severities
        severity_map = {
            FrontendLogLevel.ERROR: ActivitySeverity.HIGH,
            FrontendLogLevel.WARNING: ActivitySeverity.MEDIUM,
            FrontendLogLevel.INFO: ActivitySeverity.LOW,
            FrontendLogLevel.DEBUG: ActivitySeverity.LOW,
        }

        service = AuditService(session)
        logs_stored = 0

        # Process each log entry
        for log_entry in logs_request.logs:
            try:
                # Extract client metadata
                user_agent = log_entry.metadata.get("userAgent")
                client_url = log_entry.metadata.get("url")
                timestamp_str = log_entry.metadata.get("timestamp")

                # Determine tenant_id (handle anonymous users)
                tenant_id = None
                if current_user:
                    try:
                        tenant_id = get_current_tenant_id()
                    except Exception:
                        # If tenant resolution fails, use user's tenant_id
                        tenant_id = (
                            current_user.tenant_id if hasattr(current_user, "tenant_id") else None
                        )

                # Skip if no tenant_id for anonymous users (tenant_id is NOT NULL in the table)
                if not tenant_id:
                    logger.warning(
                        "Skipping frontend log without tenant_id",
                        message=log_entry.message[:50],
                        authenticated=current_user is not None,
                    )
                    continue

                # Create audit activity
                await service.log_activity(
                    activity_type=ActivityType.FRONTEND_LOG,
                    action=f"frontend.{log_entry.level.lower()}",
                    description=log_entry.message,
                    severity=severity_map.get(log_entry.level, ActivitySeverity.LOW),
                    details={
                        "service": log_entry.service,
                        "level": log_entry.level,
                        "url": client_url,
                        "timestamp": timestamp_str,
                        **log_entry.metadata,  # Include all metadata
                    },
                    user_id=current_user.user_id if current_user else None,
                    tenant_id=tenant_id,
                    ip_address=request.client.host if request.client else None,
                    user_agent=user_agent,
                )
                logs_stored += 1

            except Exception as log_error:
                # Log individual entry failures but continue processing
                logger.warning(
                    "Failed to store individual frontend log entry",
                    error=str(log_error),
                    log_level=log_entry.level,
                    log_message=log_entry.message[:100],  # Truncate for logging
                )

        # Log the batch ingestion
        logger.info(
            "frontend.logs.ingested",
            logs_received=len(logs_request.logs),
            logs_stored=logs_stored,
            user_id=current_user.user_id if current_user else "anonymous",
            tenant_id=get_current_tenant_id() if current_user else "anonymous",
        )

        return FrontendLogsResponse(
            status="success",
            logs_received=len(logs_request.logs),
            logs_stored=logs_stored,
        )

    except Exception as e:
        logger.error("Error processing frontend logs", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process frontend logs")
