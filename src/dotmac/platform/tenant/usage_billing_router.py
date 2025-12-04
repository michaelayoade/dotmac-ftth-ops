"""
Tenant usage-based billing API endpoints.

Provides REST endpoints for usage tracking integrated with billing.
"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.core import UserInfo, get_current_user
from ..billing.subscriptions.service import SubscriptionService
from ..database import get_async_session
from .schemas import TenantUsageCreate
from .service import TenantService
from .usage_billing_integration import (
    TenantUsageBillingIntegration,
)

router = APIRouter(prefix="", tags=["Tenant Usage Billing"])


# Dependencies
async def get_tenant_service(db: AsyncSession = Depends(get_async_session)) -> TenantService:
    """Get tenant service instance."""
    return TenantService(db)


async def get_subscription_service(
    db: AsyncSession = Depends(get_async_session),
) -> SubscriptionService:
    """Get subscription service instance."""
    return SubscriptionService(db)


async def get_usage_billing_integration(
    tenant_service: TenantService = Depends(get_tenant_service),
    subscription_service: SubscriptionService = Depends(get_subscription_service),
) -> TenantUsageBillingIntegration:
    """Get usage billing integration instance."""
    return TenantUsageBillingIntegration(
        tenant_service=tenant_service,
        subscription_service=subscription_service,
    )


@router.post(
    "/{tenant_id}/usage/record-with-billing",
    response_model=dict[str, Any],
    status_code=status.HTTP_201_CREATED,
)
async def record_usage_with_billing(
    tenant_id: str,
    usage_data: TenantUsageCreate,
    subscription_id: str | None = Query(
        None, description="Subscription ID (auto-detected if not provided)"
    ),
    current_user: UserInfo = Depends(get_current_user),
    integration: TenantUsageBillingIntegration = Depends(get_usage_billing_integration),
) -> dict[str, Any]:
    """
    Record usage in both tenant tracking and billing system.

    This endpoint automatically:
    1. Records usage in tenant usage history
    2. Updates tenant usage counters
    3. Records usage in subscription billing for usage-based charges

    Supports:
    - API call tracking
    - Storage usage
    - Bandwidth consumption
    - Active user counts
    """
    try:
        result = await integration.record_tenant_usage_with_billing(
            tenant_id=tenant_id,
            usage_data=usage_data,
            subscription_id=subscription_id,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record usage: {str(e)}",
        )


@router.post("/{tenant_id}/usage/sync-billing", response_model=dict[str, Any])
async def sync_tenant_usage_to_billing(
    tenant_id: str,
    subscription_id: str | None = Query(None, description="Subscription ID"),
    current_user: UserInfo = Depends(get_current_user),
    integration: TenantUsageBillingIntegration = Depends(get_usage_billing_integration),
) -> dict[str, Any]:
    """
    Sync current tenant usage counters to billing system.

    Useful for:
    - Manual sync when counters are updated outside normal flow
    - Reconciliation of usage data
    - Billing period transitions
    """
    result = await integration.sync_tenant_counters_with_billing(
        tenant_id=tenant_id,
        subscription_id=subscription_id,
    )
    return result


@router.get("/{tenant_id}/usage/overages", response_model=dict[str, Any])
async def get_usage_overages(
    tenant_id: str,
    period_start: datetime | None = Query(None, description="Period start"),
    period_end: datetime | None = Query(None, description="Period end"),
    current_user: UserInfo = Depends(get_current_user),
    integration: TenantUsageBillingIntegration = Depends(get_usage_billing_integration),
) -> dict[str, Any]:
    """
    Calculate overage charges for tenant exceeding plan limits.

    Returns:
    - Overage metrics (API calls, storage, users)
    - Per-unit overage rates
    - Total overage charges
    - Limit vs actual usage comparison
    """
    result = await integration.calculate_overage_charges(
        tenant_id=tenant_id,
        period_start=period_start,
        period_end=period_end,
    )
    return dict(result)


@router.get("/{tenant_id}/billing/preview", response_model=dict[str, Any])
async def get_billing_preview(
    tenant_id: str,
    include_overages: bool = Query(True, description="Include overage calculations"),
    current_user: UserInfo = Depends(get_current_user),
    integration: TenantUsageBillingIntegration = Depends(get_usage_billing_integration),
) -> dict[str, Any]:
    """
    Get preview of upcoming billing charges.

    Provides:
    - Base subscription cost
    - Current usage vs limits
    - Overage charges (if applicable)
    - Total estimated charge
    - Usage percentage breakdowns

    Useful for:
    - Displaying usage dashboards
    - Budget forecasting
    - Alerting on overage potential
    """
    result = await integration.get_billing_preview(
        tenant_id=tenant_id,
        include_overages=include_overages,
    )
    return dict(result)


@router.get("/{tenant_id}/usage/billing-status", response_model=dict[str, Any])
async def get_usage_billing_status(
    tenant_id: str,
    current_user: UserInfo = Depends(get_current_user),
    tenant_service: TenantService = Depends(get_tenant_service),
) -> dict[str, Any]:
    """
    Get comprehensive usage and billing status for tenant.

    Returns:
    - Current usage across all metrics
    - Limit status (within/exceeded)
    - Billing plan details
    - Recommendations for plan changes
    """
    from .service import TenantNotFoundError

    try:
        tenant = await tenant_service.get_tenant(tenant_id)
        stats = await tenant_service.get_tenant_stats(tenant_id)
    except TenantNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant with ID '{tenant_id}' not found",
        )

    recommendations = []

    # Generate recommendations
    if tenant.has_exceeded_api_limit:
        recommendations.append(
            {
                "metric": "api_calls",
                "message": "API call limit exceeded. Consider upgrading plan or purchasing additional capacity.",
                "severity": "high",
            }
        )

    if tenant.has_exceeded_storage_limit:
        recommendations.append(
            {
                "metric": "storage",
                "message": "Storage limit exceeded. Additional charges may apply.",
                "severity": "high",
            }
        )

    if tenant.has_exceeded_user_limit:
        recommendations.append(
            {
                "metric": "users",
                "message": "User limit reached. Upgrade plan to add more team members.",
                "severity": "medium",
            }
        )

    # Warn if approaching limits
    if stats.api_usage_percent > 80 and not tenant.has_exceeded_api_limit:
        recommendations.append(
            {
                "metric": "api_calls",
                "message": f"API usage at {stats.api_usage_percent:.1f}%. Consider upgrading soon.",
                "severity": "low",
            }
        )

    if stats.storage_usage_percent > 80 and not tenant.has_exceeded_storage_limit:
        recommendations.append(
            {
                "metric": "storage",
                "message": f"Storage at {stats.storage_usage_percent:.1f}%. Consider upgrading soon.",
                "severity": "low",
            }
        )

    return {
        "tenant_id": tenant_id,
        "plan_type": tenant.plan_type,
        "status": tenant.status,
        "usage": {
            "api_calls": {
                "current": tenant.current_api_calls,
                "limit": tenant.max_api_calls_per_month,
                "percentage": stats.api_usage_percent,
                "exceeded": tenant.has_exceeded_api_limit,
            },
            "storage_gb": {
                "current": float(tenant.current_storage_gb),
                "limit": tenant.max_storage_gb,
                "percentage": stats.storage_usage_percent,
                "exceeded": tenant.has_exceeded_storage_limit,
            },
            "users": {
                "current": tenant.current_users,
                "limit": tenant.max_users,
                "percentage": stats.user_usage_percent,
                "exceeded": tenant.has_exceeded_user_limit,
            },
        },
        "recommendations": recommendations,
        "requires_action": len([r for r in recommendations if r["severity"] == "high"]) > 0,
    }
