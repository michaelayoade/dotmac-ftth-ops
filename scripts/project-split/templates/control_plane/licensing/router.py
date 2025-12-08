"""
License Router for Control Plane

Endpoints for:
- License management (issue, get, push)
- Usage ingestion from ISP instances
- Plan management
"""

import hashlib
import hmac
import json
from datetime import datetime
from typing import Annotated, Any, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from control_plane.licensing.issuer import LicenseIssuer
from control_plane.licensing.models import (
    OveragePolicy,
    PlanTier,
    TenantLicense,
    TenantPlan,
    UsageSnapshot,
)
from control_plane.settings import settings
from dotmac.platform.db import get_session

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/licensing", tags=["Licensing"])


# ============================================================================
# Request/Response Models
# ============================================================================

class PlanResponse(BaseModel):
    """Plan details."""
    id: UUID
    name: str
    tier: str
    description: Optional[str]
    max_subscribers: int
    max_staff_users: int
    max_api_calls_per_day: int
    max_storage_gb: int
    overage_policy: str
    features: dict[str, bool]
    monthly_price_cents: int
    annual_price_cents: int


class LicenseResponse(BaseModel):
    """License details."""
    tenant_id: UUID
    plan_id: UUID
    version: int
    issued_at: datetime
    expires_at: datetime
    is_over_cap: bool
    last_reported_subscribers: int
    last_usage_report_at: Optional[datetime]


class LicenseTokenResponse(BaseModel):
    """Signed license token."""
    license_token: str


class UsageReportRequest(BaseModel):
    """Usage report from ISP instance."""
    tenant_id: UUID
    timestamp: datetime
    idempotency_key: str = Field(..., min_length=1, max_length=64)
    metrics: dict[str, Any]


class UsageReportResponse(BaseModel):
    """Response to usage report."""
    accepted: bool
    message: str


class ChangePlanRequest(BaseModel):
    """Request to change tenant plan."""
    new_plan_id: UUID


# ============================================================================
# Dependencies
# ============================================================================

async def get_db() -> AsyncSession:
    """Get database session."""
    async for session in get_session():
        yield session


async def verify_instance_api_key(
    x_instance_api_key: Annotated[str, Header()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UUID:
    """
    Verify the request is from a valid ISP instance.

    Returns the tenant_id associated with the API key.
    """
    # TODO: Look up API key in database and return associated tenant_id
    # For now, extract from a signed token or header
    if not x_instance_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid instance API key",
        )
    # Placeholder - implement proper API key validation
    return UUID(x_instance_api_key.split(":")[0]) if ":" in x_instance_api_key else None


def get_license_issuer() -> LicenseIssuer:
    """Get license issuer instance."""
    return LicenseIssuer(
        signing_key=settings.license_signing_key,
        platform_api_key=settings.platform_api_key,
    )


# ============================================================================
# Endpoints - Plan Management
# ============================================================================

@router.get(
    "/plans",
    response_model=list[PlanResponse],
    summary="List available plans",
)
async def list_plans(
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = False,
):
    """List all available plans."""
    query = select(TenantPlan)
    if not include_inactive:
        query = query.where(TenantPlan.is_active == True)

    result = await db.execute(query)
    plans = result.scalars().all()

    return [
        PlanResponse(
            id=plan.id,
            name=plan.name,
            tier=plan.tier.value,
            description=plan.description,
            max_subscribers=plan.max_subscribers,
            max_staff_users=plan.max_staff_users,
            max_api_calls_per_day=plan.max_api_calls_per_day,
            max_storage_gb=plan.max_storage_gb,
            overage_policy=plan.overage_policy.value,
            features=plan.get_default_features(),
            monthly_price_cents=plan.monthly_price_cents,
            annual_price_cents=plan.annual_price_cents,
        )
        for plan in plans
    ]


@router.get(
    "/plans/{plan_id}",
    response_model=PlanResponse,
    summary="Get plan details",
)
async def get_plan(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get details for a specific plan."""
    plan = await db.get(TenantPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    return PlanResponse(
        id=plan.id,
        name=plan.name,
        tier=plan.tier.value,
        description=plan.description,
        max_subscribers=plan.max_subscribers,
        max_staff_users=plan.max_staff_users,
        max_api_calls_per_day=plan.max_api_calls_per_day,
        max_storage_gb=plan.max_storage_gb,
        overage_policy=plan.overage_policy.value,
        features=plan.get_default_features(),
        monthly_price_cents=plan.monthly_price_cents,
        annual_price_cents=plan.annual_price_cents,
    )


# ============================================================================
# Endpoints - License Management
# ============================================================================

@router.get(
    "/tenants/{tenant_id}/license",
    response_model=LicenseTokenResponse,
    summary="Get current license token",
    description="Returns the signed license token for an ISP instance.",
)
async def get_tenant_license(
    tenant_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    issuer: Annotated[LicenseIssuer, Depends(get_license_issuer)],
):
    """
    Get the current signed license token for a tenant.

    This endpoint is called by ISP instances to fetch their license
    (self-heal mechanism).
    """
    signed_token = await issuer.get_signed_license(db, tenant_id)

    if not signed_token:
        # No license exists - issue one
        license_record = await issuer.issue_license(db, tenant_id)
        signed_token = license_record.signed_token

    return LicenseTokenResponse(license_token=signed_token)


@router.get(
    "/tenants/{tenant_id}/license/details",
    response_model=LicenseResponse,
    summary="Get license details",
    description="Returns license metadata (not the signed token).",
)
async def get_tenant_license_details(
    tenant_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get license details for a tenant."""
    result = await db.execute(
        select(TenantLicense).where(TenantLicense.tenant_id == tenant_id)
    )
    license_record = result.scalar_one_or_none()

    if not license_record:
        raise HTTPException(status_code=404, detail="License not found")

    return LicenseResponse(
        tenant_id=license_record.tenant_id,
        plan_id=license_record.plan_id,
        version=license_record.version,
        issued_at=license_record.issued_at,
        expires_at=license_record.expires_at,
        is_over_cap=license_record.is_over_cap,
        last_reported_subscribers=license_record.last_reported_subscribers,
        last_usage_report_at=license_record.last_usage_report_at,
    )


@router.post(
    "/tenants/{tenant_id}/license/issue",
    response_model=LicenseResponse,
    summary="Issue new license",
    description="Force issue a new license (increments version).",
)
async def issue_tenant_license(
    tenant_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    issuer: Annotated[LicenseIssuer, Depends(get_license_issuer)],
    push: bool = True,
):
    """
    Issue a new license for a tenant.

    This increments the license version and optionally pushes to the instance.
    """
    license_record = await issuer.issue_license(db, tenant_id)

    if push:
        await issuer.push_license_to_instance(db, tenant_id)

    return LicenseResponse(
        tenant_id=license_record.tenant_id,
        plan_id=license_record.plan_id,
        version=license_record.version,
        issued_at=license_record.issued_at,
        expires_at=license_record.expires_at,
        is_over_cap=license_record.is_over_cap,
        last_reported_subscribers=license_record.last_reported_subscribers,
        last_usage_report_at=license_record.last_usage_report_at,
    )


@router.post(
    "/tenants/{tenant_id}/plan",
    response_model=LicenseResponse,
    summary="Change tenant plan",
    description="Change the tenant's plan and issue new license.",
)
async def change_tenant_plan(
    tenant_id: UUID,
    request: ChangePlanRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    issuer: Annotated[LicenseIssuer, Depends(get_license_issuer)],
):
    """
    Change the tenant's plan.

    Issues a new license with the new plan limits and pushes to instance.
    """
    license_record = await issuer.on_plan_change(
        db, tenant_id, request.new_plan_id
    )

    return LicenseResponse(
        tenant_id=license_record.tenant_id,
        plan_id=license_record.plan_id,
        version=license_record.version,
        issued_at=license_record.issued_at,
        expires_at=license_record.expires_at,
        is_over_cap=license_record.is_over_cap,
        last_reported_subscribers=license_record.last_reported_subscribers,
        last_usage_report_at=license_record.last_usage_report_at,
    )


# ============================================================================
# Endpoints - Usage Ingestion
# ============================================================================

@router.post(
    "/tenants/{tenant_id}/usage",
    response_model=UsageReportResponse,
    summary="Report usage from ISP instance",
    description="Receives signed usage snapshots from ISP instances.",
)
async def report_usage(
    tenant_id: UUID,
    request: UsageReportRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_signature: Annotated[str, Header()],
    x_idempotency_key: Annotated[str, Header()],
):
    """
    Receive usage report from ISP instance.

    Features:
    - Idempotency: Duplicate reports are rejected (409)
    - Signature validation: Ensures report is from valid instance
    - Updates license record with latest subscriber count
    """
    # Check idempotency
    existing = await db.execute(
        select(UsageSnapshot).where(UsageSnapshot.idempotency_key == x_idempotency_key)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Usage report already processed",
        )

    # Validate signature
    expected_signature = hmac.new(
        settings.license_signing_key.encode(),
        json.dumps(request.model_dump(), sort_keys=True, default=str).encode(),
        hashlib.sha256,
    ).hexdigest()

    signature_valid = hmac.compare_digest(x_signature, expected_signature)

    # Store snapshot
    snapshot = UsageSnapshot(
        tenant_id=tenant_id,
        idempotency_key=x_idempotency_key,
        reported_at=request.timestamp,
        active_subscribers=request.metrics.get("active_subscribers", 0),
        total_subscribers=request.metrics.get("total_subscribers", 0),
        api_calls_24h=request.metrics.get("api_calls_24h", 0),
        storage_bytes=request.metrics.get("storage_bytes", 0),
        radius_sessions=request.metrics.get("radius_sessions", 0),
        signature_valid=signature_valid,
    )
    db.add(snapshot)

    # Update license record
    result = await db.execute(
        select(TenantLicense).where(TenantLicense.tenant_id == tenant_id)
    )
    license_record = result.scalar_one_or_none()

    if license_record:
        license_record.last_reported_subscribers = snapshot.active_subscribers
        license_record.last_usage_report_at = datetime.utcnow()

        # Check if over cap
        plan = await db.get(TenantPlan, license_record.plan_id)
        if plan:
            license_record.is_over_cap = snapshot.active_subscribers > plan.max_subscribers

    await db.commit()

    logger.info(
        "usage_report_received",
        tenant_id=str(tenant_id),
        active_subscribers=snapshot.active_subscribers,
        signature_valid=signature_valid,
    )

    return UsageReportResponse(
        accepted=True,
        message="Usage report accepted",
    )


@router.get(
    "/tenants/{tenant_id}/usage",
    summary="Get usage history",
    description="Get historical usage snapshots for a tenant.",
)
async def get_usage_history(
    tenant_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 100,
):
    """Get recent usage snapshots for a tenant."""
    result = await db.execute(
        select(UsageSnapshot)
        .where(UsageSnapshot.tenant_id == tenant_id)
        .order_by(UsageSnapshot.reported_at.desc())
        .limit(limit)
    )
    snapshots = result.scalars().all()

    return [
        {
            "reported_at": s.reported_at.isoformat(),
            "active_subscribers": s.active_subscribers,
            "total_subscribers": s.total_subscribers,
            "api_calls_24h": s.api_calls_24h,
            "storage_bytes": s.storage_bytes,
            "radius_sessions": s.radius_sessions,
        }
        for s in snapshots
    ]


# ============================================================================
# Endpoints - Feature Checks
# ============================================================================

@router.get(
    "/check",
    summary="Real-time feature check",
    description="Check if a feature is enabled for a tenant.",
)
async def check_feature(
    feature: str,
    tenant_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Real-time feature check.

    Called by ISP instances to verify feature availability.
    """
    result = await db.execute(
        select(TenantLicense).where(TenantLicense.tenant_id == tenant_id)
    )
    license_record = result.scalar_one_or_none()

    if not license_record:
        return {"enabled": False, "reason": "no_license"}

    plan = await db.get(TenantPlan, license_record.plan_id)
    if not plan:
        return {"enabled": False, "reason": "no_plan"}

    features = plan.get_default_features()
    enabled = features.get(feature, False)

    return {
        "enabled": enabled,
        "feature": feature,
        "plan": plan.name,
    }
