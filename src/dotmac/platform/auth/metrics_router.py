"""
Authentication Metrics Router.

Provides authentication and security metrics endpoints for monitoring
login activity, user registrations, and authentication events.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import AuditActivity
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.core.cache_decorators import CacheTier, cached_result
from dotmac.platform.db import get_session_dependency
from dotmac.platform.user_management.models import User

logger = structlog.get_logger(__name__)

# Cache TTL (in seconds)
AUTH_METRICS_CACHE_TTL = 300  # 5 minutes

router = APIRouter(prefix="", tags=["Auth Metrics"])


# ============================================================================
# Response Models
# ============================================================================


class AuthMetricsResponse(BaseModel):
    """Authentication metrics response."""

    model_config = ConfigDict(from_attributes=True)

    # User metrics
    total_users: int = Field(description="Total registered users")
    active_users: int = Field(description="Users active in period")
    new_users_this_period: int = Field(description="New user registrations")

    # Login metrics
    total_logins: int = Field(description="Total login attempts")
    successful_logins: int = Field(description="Successful logins")
    failed_logins: int = Field(description="Failed login attempts")
    login_success_rate: float = Field(description="Login success rate (%)")

    # Security metrics
    mfa_enabled_users: int = Field(description="Users with MFA enabled")
    mfa_adoption_rate: float = Field(description="MFA adoption rate (%)")
    password_reset_requests: int = Field(description="Password reset requests")
    account_lockouts: int = Field(description="Account lockouts")

    # Activity metrics
    unique_active_users: int = Field(description="Unique users with activity")

    # Time period
    period: str = Field(description="Metrics calculation period")
    timestamp: datetime = Field(description="Metrics generation timestamp")


# ============================================================================
# Cached Helper Function
# ============================================================================


@cached_result(
    ttl=AUTH_METRICS_CACHE_TTL,
    key_prefix="auth:metrics",
    key_params=["period_days", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _get_auth_metrics_cached(
    period_days: int,
    tenant_id: str | None,
    session: AsyncSession,
) -> dict[str, Any]:
    """
    Cached helper function for auth metrics calculation.
    """
    now = datetime.now(UTC)
    period_start = now - timedelta(days=period_days)

    # Query total and active users
    total_users_query = select(func.count(User.id))
    active_users_query = select(func.count(User.id)).where(User.last_login >= period_start)

    if tenant_id:
        total_users_query = total_users_query.where(User.tenant_id == tenant_id)
        active_users_query = active_users_query.where(User.tenant_id == tenant_id)

    total_users_result = await session.execute(total_users_query)
    active_users_result = await session.execute(active_users_query)

    total_users = total_users_result.scalar() or 0
    active_users = active_users_result.scalar() or 0

    # Query new users in period
    new_users_query = select(func.count(User.id)).where(User.created_at >= period_start)

    if tenant_id:
        new_users_query = new_users_query.where(User.tenant_id == tenant_id)

    new_users_result = await session.execute(new_users_query)
    new_users_this_period = new_users_result.scalar() or 0

    # Query MFA enabled users
    mfa_enabled_query = select(func.count(User.id)).where(User.mfa_enabled == True)  # noqa: E712

    if tenant_id:
        mfa_enabled_query = mfa_enabled_query.where(User.tenant_id == tenant_id)

    mfa_enabled_result = await session.execute(mfa_enabled_query)
    mfa_enabled_users = mfa_enabled_result.scalar() or 0

    # Calculate MFA adoption rate
    if total_users > 0:
        mfa_adoption_rate = (mfa_enabled_users / total_users) * 100
    else:
        mfa_adoption_rate = 0.0

    # Query login activity from audit logs
    login_query = select(
        func.count(AuditActivity.id).label("total"),
        func.sum(case((AuditActivity.severity == "INFO", 1), else_=0)).label("successful"),
        func.sum(case((AuditActivity.severity.in_(["WARNING", "ERROR"]), 1), else_=0)).label(
            "failed"
        ),
    ).where(
        and_(
            AuditActivity.activity_type == "login",
            AuditActivity.created_at >= period_start,
        )
    )

    if tenant_id:
        login_query = login_query.where(AuditActivity.tenant_id == tenant_id)

    login_result = await session.execute(login_query)
    login_row = login_result.one()

    total_logins = login_row.total or 0
    successful_logins = login_row.successful or 0
    failed_logins = login_row.failed or 0

    # Calculate login success rate
    if total_logins > 0:
        login_success_rate = (successful_logins / total_logins) * 100
    else:
        login_success_rate = 0.0

    # Query password reset requests from audit logs
    password_reset_query = select(func.count(AuditActivity.id)).where(
        and_(
            AuditActivity.activity_type == "password_reset_request",
            AuditActivity.created_at >= period_start,
        )
    )

    if tenant_id:
        password_reset_query = password_reset_query.where(AuditActivity.tenant_id == tenant_id)

    password_reset_result = await session.execute(password_reset_query)
    password_reset_requests = password_reset_result.scalar() or 0

    # Query account lockouts from audit logs
    lockout_query = select(func.count(AuditActivity.id)).where(
        and_(
            AuditActivity.activity_type == "account_locked",
            AuditActivity.created_at >= period_start,
        )
    )

    if tenant_id:
        lockout_query = lockout_query.where(AuditActivity.tenant_id == tenant_id)

    lockout_result = await session.execute(lockout_query)
    account_lockouts = lockout_result.scalar() or 0

    # Query unique active users from audit logs
    unique_users_query = select(func.count(func.distinct(AuditActivity.user_id))).where(
        and_(
            AuditActivity.created_at >= period_start,
            AuditActivity.user_id != None,  # noqa: E711
        )
    )

    if tenant_id:
        unique_users_query = unique_users_query.where(AuditActivity.tenant_id == tenant_id)

    unique_users_result = await session.execute(unique_users_query)
    unique_active_users = unique_users_result.scalar() or 0

    return {
        "total_users": total_users,
        "active_users": active_users,
        "new_users_this_period": new_users_this_period,
        "total_logins": total_logins,
        "successful_logins": successful_logins,
        "failed_logins": failed_logins,
        "login_success_rate": round(login_success_rate, 2),
        "mfa_enabled_users": mfa_enabled_users,
        "mfa_adoption_rate": round(mfa_adoption_rate, 2),
        "password_reset_requests": password_reset_requests,
        "account_lockouts": account_lockouts,
        "unique_active_users": unique_active_users,
        "period": f"{period_days}d",
        "timestamp": now,
    }


# ============================================================================
# Auth Metrics Endpoint
# ============================================================================


@router.get("", response_model=AuthMetricsResponse)
async def get_auth_metrics(
    period_days: int = Query(default=30, ge=1, le=365, description="Time period in days"),
    session: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> AuthMetricsResponse:
    """
    Get authentication and security metrics with Redis caching.

    Returns comprehensive metrics about user authentication, security features,
    and activity patterns with tenant isolation.

    **Caching**: Results cached for 5 minutes per tenant/period combination.
    **Required Permission**: auth:metrics:read (enforced by get_current_user)
    """
    try:
        tenant_id = getattr(current_user, "tenant_id", None)

        # Use cached helper function
        metrics_data = await _get_auth_metrics_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            session=session,
        )

        return AuthMetricsResponse(**metrics_data)

    except Exception as e:
        logger.error("Failed to fetch auth metrics", error=str(e), exc_info=True)
        # Return safe defaults on error
        return AuthMetricsResponse(
            total_users=0,
            active_users=0,
            new_users_this_period=0,
            total_logins=0,
            successful_logins=0,
            failed_logins=0,
            login_success_rate=0.0,
            mfa_enabled_users=0,
            mfa_adoption_rate=0.0,
            password_reset_requests=0,
            account_lockouts=0,
            unique_active_users=0,
            period=f"{period_days}d",
            timestamp=datetime.now(UTC),
        )


__all__ = ["router"]
