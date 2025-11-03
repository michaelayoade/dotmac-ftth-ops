"""
Rate Limit Management Router.

API endpoints for managing rate limit rules.
"""

from datetime import UTC
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import get_current_user
from dotmac.platform.database import get_async_session
from dotmac.platform.rate_limit.models import (
    RateLimitAction,
    RateLimitLog,
    RateLimitRule,
    RateLimitScope,
    RateLimitWindow,
)
from dotmac.platform.rate_limit.service import RateLimitService
from dotmac.platform.user_management.models import User

router = APIRouter(
    prefix="/rate-limits",
)


# Request/Response Models


class RateLimitRuleRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request schema for creating/updating rate limit rule."""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    scope: RateLimitScope
    endpoint_pattern: str | None = Field(None, max_length=500)
    max_requests: int = Field(..., gt=0)
    window: RateLimitWindow
    action: RateLimitAction = RateLimitAction.BLOCK
    priority: int = Field(default=0)
    is_active: bool = Field(default=True)
    exempt_user_ids: list[str] = Field(default_factory=lambda: [])
    exempt_ip_addresses: list[str] = Field(default_factory=lambda: [])
    exempt_api_keys: list[str] = Field(default_factory=lambda: [])
    config: dict[str, Any] = Field(default_factory=lambda: {})


class RateLimitRuleResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response schema for rate limit rule."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    name: str
    description: str | None
    scope: RateLimitScope
    endpoint_pattern: str | None
    max_requests: int
    window: RateLimitWindow
    window_seconds: int
    action: RateLimitAction
    priority: int
    is_active: bool
    exempt_user_ids: list[str]
    exempt_ip_addresses: list[str]
    exempt_api_keys: list[str]
    config: dict[str, Any]
    created_at: str
    updated_at: str


class RateLimitStatusResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response schema for rate limit status."""

    model_config = ConfigDict()

    endpoint: str
    rules_applied: int
    limits: list[dict[str, Any]]


class RateLimitLogResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response schema for rate limit log."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    rule_id: UUID | None
    rule_name: str
    user_id: UUID | None
    ip_address: str | None
    api_key_id: str | None
    endpoint: str
    method: str
    current_count: int
    limit: int
    window: RateLimitWindow
    action: RateLimitAction
    was_blocked: bool
    created_at: str


# API Endpoints


@router.post(
    "/rate-limits/rules",
    response_model=RateLimitRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create rate limit rule",
    description="Create a new rate limit rule for the tenant",
)
async def create_rate_limit_rule(
    rule_data: RateLimitRuleRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> RateLimitRule:
    """Create rate limit rule."""
    service = RateLimitService(db)

    # Calculate window seconds
    window_seconds = service._get_window_seconds(rule_data.window)

    rule = RateLimitRule(
        tenant_id=current_user.tenant_id,
        name=rule_data.name,
        description=rule_data.description,
        scope=rule_data.scope,
        endpoint_pattern=rule_data.endpoint_pattern,
        max_requests=rule_data.max_requests,
        window=rule_data.window,
        window_seconds=window_seconds,
        action=rule_data.action,
        priority=rule_data.priority,
        is_active=rule_data.is_active,
        exempt_user_ids=rule_data.exempt_user_ids,
        exempt_ip_addresses=rule_data.exempt_ip_addresses,
        exempt_api_keys=rule_data.exempt_api_keys,
        config=rule_data.config,
        created_by_id=current_user.id,
    )

    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return rule


@router.get(
    "/rate-limits/rules",
    response_model=list[RateLimitRuleResponse],
    summary="List rate limit rules",
    description="List all rate limit rules for the tenant",
)
async def list_rate_limit_rules(
    is_active: bool | None = Query(None, description="Filter by active status"),
    scope: RateLimitScope | None = Query(None, description="Filter by scope"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> list[RateLimitRule]:
    """List rate limit rules."""
    stmt = select(RateLimitRule).where(
        RateLimitRule.tenant_id == current_user.tenant_id, RateLimitRule.deleted_at.is_(None)
    )

    if is_active is not None:
        stmt = stmt.where(RateLimitRule.is_active == is_active)

    if scope is not None:
        stmt = stmt.where(RateLimitRule.scope == scope)

    stmt = stmt.order_by(RateLimitRule.priority.desc()).limit(limit).offset(offset)

    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/rate-limits/rules/{rule_id}",
    response_model=RateLimitRuleResponse,
    summary="Get rate limit rule",
    description="Get a specific rate limit rule",
)
async def get_rate_limit_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> RateLimitRule:
    """Get rate limit rule."""
    stmt = select(RateLimitRule).where(
        RateLimitRule.tenant_id == current_user.tenant_id,
        RateLimitRule.id == rule_id,
        RateLimitRule.deleted_at.is_(None),
    )

    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rate limit rule not found"
        )

    return rule


@router.put(
    "/rate-limits/rules/{rule_id}",
    response_model=RateLimitRuleResponse,
    summary="Update rate limit rule",
    description="Update an existing rate limit rule",
)
async def update_rate_limit_rule(
    rule_id: UUID,
    rule_data: RateLimitRuleRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> RateLimitRule:
    """Update rate limit rule."""
    stmt = select(RateLimitRule).where(
        RateLimitRule.tenant_id == current_user.tenant_id,
        RateLimitRule.id == rule_id,
        RateLimitRule.deleted_at.is_(None),
    )

    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rate limit rule not found"
        )

    service = RateLimitService(db)

    # Update fields
    rule.name = rule_data.name
    rule.description = rule_data.description
    rule.scope = rule_data.scope
    rule.endpoint_pattern = rule_data.endpoint_pattern
    rule.max_requests = rule_data.max_requests
    rule.window = rule_data.window
    rule.window_seconds = service._get_window_seconds(rule_data.window)
    rule.action = rule_data.action
    rule.priority = rule_data.priority
    rule.is_active = rule_data.is_active
    rule.exempt_user_ids = rule_data.exempt_user_ids
    rule.exempt_ip_addresses = rule_data.exempt_ip_addresses
    rule.exempt_api_keys = rule_data.exempt_api_keys
    rule.config = rule_data.config
    rule.updated_by_id = current_user.id

    await db.commit()
    await db.refresh(rule)

    return rule


@router.delete(
    "/rate-limits/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete rate limit rule",
    description="Soft delete a rate limit rule",
)
async def delete_rate_limit_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete rate limit rule."""
    stmt = select(RateLimitRule).where(
        RateLimitRule.tenant_id == current_user.tenant_id,
        RateLimitRule.id == rule_id,
        RateLimitRule.deleted_at.is_(None),
    )

    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rate limit rule not found"
        )

    from datetime import datetime

    rule.deleted_at = datetime.now(UTC)
    await db.commit()


@router.get(
    "/rate-limits/status",
    response_model=RateLimitStatusResponse,
    summary="Get rate limit status",
    description="Get current rate limit status for endpoint",
)
async def get_rate_limit_status(
    endpoint: str = Query(..., description="Endpoint path"),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> RateLimitStatusResponse:
    """Get rate limit status."""
    service = RateLimitService(db)

    status_data = await service.get_rate_limit_status(
        tenant_id=current_user.tenant_id,
        endpoint=endpoint,
        user_id=current_user.id,
    )

    return RateLimitStatusResponse.model_validate(status_data)


@router.post(
    "/rate-limits/reset",
    status_code=status.HTTP_200_OK,
    summary="Reset rate limit",
    description="Reset rate limit counter for specific identifier",
)
async def reset_rate_limit(
    rule_id: UUID = Query(..., description="Rule ID"),
    identifier: str = Query(..., description="Identifier (user ID, IP, etc.)"),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Reset rate limit."""
    service = RateLimitService(db)

    success = await service.reset_limit(
        tenant_id=current_user.tenant_id, rule_id=rule_id, identifier=identifier
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rate limit rule not found"
        )

    return {"message": "Rate limit reset successfully"}


@router.get(
    "/rate-limits/logs",
    response_model=list[RateLimitLogResponse],
    summary="List rate limit violations",
    description="List rate limit violation logs",
)
async def list_rate_limit_logs(
    rule_id: UUID | None = Query(None, description="Filter by rule ID"),
    user_id: UUID | None = Query(None, description="Filter by user ID"),
    ip_address: str | None = Query(None, description="Filter by IP address"),
    was_blocked: bool | None = Query(None, description="Filter by blocked status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> list[RateLimitLog]:
    """List rate limit logs."""
    stmt = select(RateLimitLog).where(RateLimitLog.tenant_id == current_user.tenant_id)

    if rule_id:
        stmt = stmt.where(RateLimitLog.rule_id == rule_id)

    if user_id:
        stmt = stmt.where(RateLimitLog.user_id == user_id)

    if ip_address:
        stmt = stmt.where(RateLimitLog.ip_address == ip_address)

    if was_blocked is not None:
        stmt = stmt.where(RateLimitLog.was_blocked == was_blocked)

    stmt = stmt.order_by(RateLimitLog.created_at.desc()).limit(limit).offset(offset)

    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/rate-limits/analytics",
    summary="Get rate limit analytics",
    description="Get analytics on rate limit violations",
)
async def get_rate_limit_analytics(
    hours: int = Query(24, ge=1, le=168, description="Hours to analyze"),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Get rate limit analytics."""
    from datetime import datetime, timedelta

    since = datetime.now(UTC) - timedelta(hours=hours)

    # Total violations
    total_stmt = select(func.count(RateLimitLog.id)).where(
        RateLimitLog.tenant_id == current_user.tenant_id, RateLimitLog.created_at >= since
    )
    total_result = await db.execute(total_stmt)
    total_violations = int(total_result.scalar() or 0)

    # Blocked vs allowed
    blocked_stmt = select(func.count(RateLimitLog.id)).where(
        RateLimitLog.tenant_id == current_user.tenant_id,
        RateLimitLog.created_at >= since,
        RateLimitLog.was_blocked.is_(True),
    )
    blocked_result = await db.execute(blocked_stmt)
    blocked_count = int(blocked_result.scalar() or 0)

    # Top violators by IP
    top_ips_stmt = (
        select(RateLimitLog.ip_address, func.count(RateLimitLog.id).label("count"))
        .where(
            RateLimitLog.tenant_id == current_user.tenant_id,
            RateLimitLog.created_at >= since,
            RateLimitLog.ip_address.isnot(None),
        )
        .group_by(RateLimitLog.ip_address)
        .order_by(func.count(RateLimitLog.id).desc())
        .limit(10)
    )
    top_ips_result = await db.execute(top_ips_stmt)
    top_ips = [{"ip_address": row[0], "violations": row[1]} for row in top_ips_result.all()]

    # Top violated endpoints
    top_endpoints_stmt = (
        select(RateLimitLog.endpoint, func.count(RateLimitLog.id).label("count"))
        .where(RateLimitLog.tenant_id == current_user.tenant_id, RateLimitLog.created_at >= since)
        .group_by(RateLimitLog.endpoint)
        .order_by(func.count(RateLimitLog.id).desc())
        .limit(10)
    )
    top_endpoints_result = await db.execute(top_endpoints_stmt)
    top_endpoints = [
        {"endpoint": row[0], "violations": row[1]} for row in top_endpoints_result.all()
    ]

    return {
        "period_hours": hours,
        "total_violations": total_violations,
        "blocked_requests": blocked_count,
        "allowed_requests": max(0, total_violations - blocked_count),
        "top_violators_by_ip": top_ips,
        "top_violated_endpoints": top_endpoints,
    }
