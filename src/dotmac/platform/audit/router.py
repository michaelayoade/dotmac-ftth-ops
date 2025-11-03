"""
FastAPI router for audit and activity endpoints.
"""

from collections.abc import Callable
from datetime import timezone
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..auth.core import UserInfo, get_current_user, get_current_user_optional
from ..auth.platform_admin import is_platform_admin
from ..auth.rbac_dependencies import require_security_audit_read
from ..db import async_session_maker, get_async_session
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

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = timezone.utc

# Sentinel tenant ID used when platform administrators submit frontend logs without
# specifying a target tenant. This keeps the logs queryable via the existing API.
PLATFORM_ADMIN_TENANT_ID = "platform_admin_session"

# Default tenant ID for anonymous/unauthenticated frontend logs
# This allows frontend error tracking without requiring authentication
ANONYMOUS_TENANT_ID = "anonymous_frontend"


async def ensure_audit_access(
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> UserInfo:
    """Ensure the current user can read audit data."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    perms = set(current_user.permissions or [])
    roles = set(current_user.roles or [])

    if (
        "security.audit.read" in perms
        or "audit.read" in perms
        or "audit:*" in perms
        or "admin" in roles
        or is_platform_admin(current_user)
    ):
        return current_user

    return await require_security_audit_read(current_user=current_user, db=db)


def resolve_tenant_for_audit(
    request: Request,
    current_user: UserInfo,
    tenant_id: str | None,
) -> str | None:
    """
    Resolve tenant ID for audit operations, with platform admin support.

    For platform administrators (who have tenant_id=None), this function allows
    them to specify a target tenant via:
    1. X-Target-Tenant-ID header (preferred)
    2. tenant_id query parameter (fallback)

    For regular users, it uses their current tenant context.

    Args:
        request: FastAPI Request
        current_user: Current authenticated user
        tenant_id: Current tenant ID (pass from dependency injection)

    Returns:
        Tenant ID to use for the query, or None if platform admin didn't specify one

    Raises:
        HTTPException: If required tenant context is missing for non-platform users
    """

    # If tenant_id is None, check if user is platform admin
    if tenant_id is None and is_platform_admin(current_user):
        # Platform admins can specify target tenant via header or query param
        tenant_id = request.headers.get("X-Target-Tenant-ID") or request.query_params.get(
            "tenant_id"
        )
        # Fall back to sentinel that captures platform-level events (e.g. UI logs)
        return tenant_id or PLATFORM_ADMIN_TENANT_ID

    # For non-platform users, tenant context is required
    if tenant_id is None:
        raise HTTPException(status_code=400, detail="Tenant context required")

    return tenant_id


def has_audit_permission(current_user: UserInfo) -> bool:
    """
    Check if user has permission to view audit data for other users.

    This replaces hard-coded "admin" role checks with proper permission validation.
    Users with any of these permissions can view other users' audit activities:
    - security.audit.read
    - audit.read or audit:*
    - Platform admin status
    - Admin role (for backwards compatibility)

    Args:
        current_user: Current authenticated user

    Returns:
        True if user has audit permissions
    """
    perms = set(current_user.permissions or [])
    roles = set(current_user.roles or [])

    return (
        "security.audit.read" in perms
        or "audit.read" in perms
        or "audit:*" in perms
        or "admin" in roles
        or is_platform_admin(current_user)
    )


router = APIRouter(tags=["Audit"])


def _register_dual_route(
    path: str,
    *,
    methods: list[str],
    **kwargs: Any,
) -> Callable[[Any], Any]:
    """
    Register the same endpoint under both `/audit/...` and `/...`.

    This keeps backwards compatibility for apps that include the router either at
    `/api/v1` (expecting `/api/v1/audit/...`) or `/api/v1/audit`.
    """

    def decorator(func: Any) -> Any:
        router.add_api_route(f"/audit{path}", func, methods=methods, **kwargs)
        router.add_api_route(path, func, methods=methods, **kwargs)
        return func

    return decorator


@_register_dual_route(
    "/activities",
    methods=["GET"],
    response_model=AuditActivityList,
)
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
    current_user: UserInfo = Depends(ensure_audit_access),
    tenant_id_from_context: str | None = Depends(get_current_tenant_id),
) -> AuditActivityList:
    """
    Get paginated list of audit activities.

    Supports filtering by various criteria and is tenant-aware.
    """
    try:
        # Build filter parameters
        from datetime import datetime, timedelta

        start_date = datetime.now(UTC) - timedelta(days=days) if days else None

        # Resolve tenant ID with platform admin support
        tenant_id = resolve_tenant_for_audit(request, current_user, tenant_id_from_context)

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


@_register_dual_route(
    "/activities/recent",
    methods=["GET"],
    response_model=list[AuditActivityResponse],
)
async def get_recent_activities(
    request: Request,
    limit: int = Query(20, ge=1, le=100, description="Maximum number of activities to return"),
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(ensure_audit_access),
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


@_register_dual_route(
    "/activities/platform",
    methods=["GET"],
    response_model=AuditActivityList,
)
async def get_platform_activities(
    request: Request,
    activity_type: ActivityType | None = Query(None, description="Filter by activity type"),
    severity: ActivitySeverity | None = Query(None, description="Filter by severity"),
    days: int | None = Query(30, ge=1, le=365, description="Number of days to look back"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=1000, description="Items per page"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(ensure_audit_access),
) -> AuditActivityList:
    """
    Get platform-level audit activities (frontend logs from platform administrators).

    This endpoint provides access to logs generated by platform administrators
    when using the admin UI. These logs are stored with a special tenant_id
    sentinel value ("platform_admin_session") to distinguish them from
    tenant-specific activities.

    **Access:** Restricted to platform administrators only.
    **Use Case:** Debugging platform admin UI errors, tracking platform-level actions.

    Returns paginated list of platform-level activities.
    """
    try:
        # Verify platform admin access
        if not is_platform_admin(current_user):
            raise HTTPException(
                status_code=403,
                detail="Access denied: Platform administrator privileges required to view platform logs",
            )

        # Build filter parameters with platform sentinel tenant_id
        from datetime import datetime, timedelta

        start_date = datetime.now(UTC) - timedelta(days=days) if days else None

        filters = AuditFilterParams(
            tenant_id="platform_admin_session",  # Use sentinel value for platform logs
            activity_type=activity_type,
            severity=severity,
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
                action="get_platform_activities",
                description=f"Platform admin {current_user.user_id} retrieved platform-level activities",
                severity=ActivitySeverity.LOW,
                details={
                    "filters": filters.model_dump(exclude_none=True, mode="json"),
                    "result_count": len(activities.activities),
                },
            )

        return activities

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error retrieving platform activities", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve platform activities")


@_register_dual_route(
    "/activities/user/{user_id}",
    methods=["GET"],
    response_model=list[AuditActivityResponse],
)
async def get_user_activities(
    user_id: str,
    request: Request,
    limit: int = Query(50, ge=1, le=200, description="Maximum number of activities to return"),
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(ensure_audit_access),
    tenant_id_from_context: str | None = Depends(get_current_tenant_id),
) -> list[AuditActivityResponse]:
    """
    Get audit activities for a specific user.

    Users can only view their own activities unless they have audit permissions.
    Platform administrators can specify target tenant via X-Target-Tenant-ID header.
    """
    try:
        # Security note: All callers have already passed ensure_audit_access dependency
        # which validates audit permissions (either via direct permissions/roles OR via RBAC fallback).
        # We trust that validation and don't re-check permissions here, because:
        # 1. Redundant security checks add complexity
        # 2. RBAC-verified users may not have permissions in current_user.permissions
        # 3. The dependency is the authoritative check
        #
        # Therefore, anyone who reaches this endpoint can view any user's activities.

        # Resolve tenant ID with platform admin support
        tenant_id = resolve_tenant_for_audit(request, current_user, tenant_id_from_context)

        service = AuditService(session)

        activities = await service.get_recent_activities(
            user_id=user_id,
            tenant_id=tenant_id,  # Now uses resolved tenant_id that works for platform admins
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


@_register_dual_route("/activities/summary", methods=["GET"])
async def get_activity_summary(
    request: Request,
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(ensure_audit_access),
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


@_register_dual_route(
    "/activities/{activity_id}",
    methods=["GET"],
    response_model=AuditActivityResponse,
)
async def get_activity_details(
    activity_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(ensure_audit_access),
    tenant_id_from_context: str | None = Depends(get_current_tenant_id),
) -> AuditActivityResponse:
    """
    Get details for a specific audit activity.

    Returns detailed information about a single audit event.
    Platform administrators can specify target tenant via X-Target-Tenant-ID header.
    """
    try:
        from sqlalchemy import select

        from .models import AuditActivity

        # Resolve tenant ID with platform admin support
        tenant_id = resolve_tenant_for_audit(request, current_user, tenant_id_from_context)

        # Query for the specific activity with resolved tenant_id
        query = select(AuditActivity).where(
            AuditActivity.id == activity_id,
            AuditActivity.tenant_id
            == tenant_id,  # Now uses resolved tenant_id that works for platform admins
        )

        result = await session.execute(query)
        activity = result.scalar_one_or_none()

        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")

        # Security note: All callers have already passed ensure_audit_access dependency
        # which validates audit permissions (either via direct permissions/roles OR via RBAC fallback).
        # We trust that validation and don't re-check permissions here, because:
        # 1. Redundant security checks add complexity
        # 2. RBAC-verified users may not have permissions in current_user.permissions
        # 3. The dependency is the authoritative check
        #
        # Therefore, anyone who reaches this endpoint can view any activity details.

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


@_register_dual_route(
    "/frontend-logs",
    methods=["POST"],
    response_model=FrontendLogsResponse,
)
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

        logs_stored = 0
        ingested_tenants: set[str] = set()

        bind = getattr(session, "bind", None)
        engine = getattr(bind, "engine", None)
        writer_factory = (
            async_sessionmaker(bind=engine, expire_on_commit=False)
            if engine is not None
            else async_session_maker
        )

        # Use dedicated session to ensure commits persist outside request rollback scope
        async with writer_factory() as write_session:
            service = AuditService(write_session)

            # Process each log entry
            for log_entry in logs_request.logs:
                try:
                    # Extract client metadata
                    user_agent = log_entry.metadata.get("userAgent")
                    client_url = log_entry.metadata.get("url")
                    timestamp_str = log_entry.metadata.get("timestamp")

                    # Determine tenant_id (handle anonymous users and platform admins)
                    resolved_tenant_id = None

                    if current_user:
                        try:
                            resolved_tenant_id = get_current_tenant_id()
                        except Exception:
                            # If tenant resolution fails, use user's tenant_id
                            resolved_tenant_id = (
                                current_user.tenant_id if hasattr(current_user, "tenant_id") else None
                            )

                        # For platform admins without tenant context, prefer explicit header,
                        # otherwise fall back to sentinel so logs remain queryable.
                        if not resolved_tenant_id and is_platform_admin(current_user):
                            header_tenant = request.headers.get("X-Target-Tenant-ID")
                            if header_tenant:
                                logger.debug(
                                    "Using X-Target-Tenant-ID for platform admin frontend log",
                                    tenant_id=header_tenant,
                                )
                                resolved_tenant_id = header_tenant

                    # Handle users without tenant context
                    if not resolved_tenant_id:
                        if current_user and is_platform_admin(current_user):
                            # For platform admins, use sentinel value to preserve logs
                            resolved_tenant_id = PLATFORM_ADMIN_TENANT_ID
                            logger.info(
                                "Storing platform admin frontend log without tenant context",
                                user_id=current_user.user_id,
                                message=log_entry.message[:50],
                            )
                        else:
                            # For anonymous users, use anonymous tenant to allow error tracking
                            resolved_tenant_id = ANONYMOUS_TENANT_ID
                            logger.debug(
                                "Storing anonymous frontend log with default tenant",
                                message=log_entry.message[:50],
                                authenticated=current_user is not None,
                            )

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
                        tenant_id=resolved_tenant_id,
                        ip_address=request.client.host if request.client else None,
                        user_agent=user_agent,
                    )
                    if resolved_tenant_id:
                        ingested_tenants.add(resolved_tenant_id)
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
            tenant_ids=sorted(ingested_tenants) if ingested_tenants else [],
        )

        return FrontendLogsResponse(
            status="success",
            logs_received=len(logs_request.logs),
            logs_stored=logs_stored,
        )

    except Exception as e:
        logger.error("Error processing frontend logs", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process frontend logs")
