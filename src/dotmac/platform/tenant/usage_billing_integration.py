"""
Tenant usage tracking integration with billing system.

Connects tenant usage metrics with usage-based billing to automatically
track and bill for resource consumption.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, TypedDict

from ..billing.catalog.models import UsageType
from ..billing.subscriptions.models import SubscriptionStatus, UsageRecordRequest
from ..billing.subscriptions.service import SubscriptionService
from .schemas import TenantUsageCreate
from .service import TenantService


class BillingRecordEntry(TypedDict):
    """Summary entry describing a single usage record attempt."""

    type: str
    quantity: int | float
    recorded: bool


class UsageOverageDetail(TypedDict):
    """Details about a specific overage metric."""

    metric: str
    limit: int | float
    usage: int | float
    overage: int | float
    rate: str
    charge: str


class OverageSummary(TypedDict):
    """Structured overage calculation output."""

    tenant_id: str
    period_start: datetime | None
    period_end: datetime | None
    has_overages: bool
    overages: list[UsageOverageDetail]
    total_overage_charge: str
    currency: str


class UsageMetric(TypedDict):
    """Single usage metric summary for previews."""

    current: int | float
    limit: int | float
    percentage: float


class UsageSummary(TypedDict):
    """Collection of usage metrics."""

    api_calls: UsageMetric
    storage_gb: UsageMetric
    users: UsageMetric


class BillingPreview(TypedDict, total=False):
    """Preview of upcoming billing charges."""

    tenant_id: str
    plan_type: str
    billing_cycle: str
    base_subscription_cost: str
    usage_summary: UsageSummary
    overages: OverageSummary
    total_estimated_charge: str


class TenantUsageBillingIntegration:
    """
    Integration service to sync tenant usage tracking with billing system.

    Automatically records usage to both tenant metrics and subscription billing.
    """

    def __init__(
        self,
        tenant_service: TenantService,
        subscription_service: SubscriptionService,
    ):
        """Initialize integration service."""
        self.tenant_service = tenant_service
        self.subscription_service = subscription_service

    async def record_tenant_usage_with_billing(
        self,
        tenant_id: str,
        usage_data: TenantUsageCreate,
        subscription_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Record usage in both tenant tracking and billing system.

        Args:
            tenant_id: Tenant ID
            usage_data: Usage metrics to record
            subscription_id: Optional subscription ID (auto-detected if not provided)

        Returns:
            Dictionary with tenant usage record and billing records
        """
        # Record in tenant usage tracking
        tenant_usage = await self.tenant_service.record_usage(tenant_id, usage_data)

        # Get tenant's active subscription if not provided
        if not subscription_id:
            subscription_id = await self._get_active_subscription_id(tenant_id)

        billing_records = []

        if subscription_id:
            # Record API calls usage
            if usage_data.api_calls > 0:
                await self.subscription_service.record_usage(
                    UsageRecordRequest(
                        subscription_id=subscription_id,
                        usage_type=UsageType.API_CALLS.value,
                        quantity=usage_data.api_calls,
                        timestamp=usage_data.period_end,
                    ),
                    tenant_id,
                )
                billing_records.append(
                    {
                        "type": "api_calls",
                        "quantity": usage_data.api_calls,
                        "recorded": True,
                    }
                )

            # Record storage usage
            if usage_data.storage_gb > 0:
                await self.subscription_service.record_usage(
                    UsageRecordRequest(
                        subscription_id=subscription_id,
                        usage_type=UsageType.STORAGE_GB.value,
                        quantity=int(usage_data.storage_gb),
                        timestamp=usage_data.period_end,
                    ),
                    tenant_id,
                )
                billing_records.append(
                    {
                        "type": "storage_gb",
                        "quantity": usage_data.storage_gb,
                        "recorded": True,
                    }
                )

            # Record bandwidth usage
            if usage_data.bandwidth_gb > 0:
                await self.subscription_service.record_usage(
                    UsageRecordRequest(
                        subscription_id=subscription_id,
                        usage_type=UsageType.BANDWIDTH_GB.value,
                        quantity=int(usage_data.bandwidth_gb),
                        timestamp=usage_data.period_end,
                    ),
                    tenant_id,
                )
                billing_records.append(
                    {
                        "type": "bandwidth_gb",
                        "quantity": usage_data.bandwidth_gb,
                        "recorded": True,
                    }
                )

            # Record user count (if it's a usage-based metric)
            if usage_data.active_users > 0:
                await self.subscription_service.record_usage(
                    UsageRecordRequest(
                        subscription_id=subscription_id,
                        usage_type=UsageType.USERS.value,
                        quantity=usage_data.active_users,
                        timestamp=usage_data.period_end,
                    ),
                    tenant_id,
                )
                billing_records.append(
                    {
                        "type": "users",
                        "quantity": usage_data.active_users,
                        "recorded": True,
                    }
                )

        return {
            "tenant_usage_id": tenant_usage.id,
            "tenant_id": tenant_id,
            "period_start": usage_data.period_start,
            "period_end": usage_data.period_end,
            "billing_records": billing_records,
            "subscription_id": subscription_id,
        }

    async def sync_tenant_counters_with_billing(
        self,
        tenant_id: str,
        subscription_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Sync current tenant usage counters to billing system.

        Args:
            tenant_id: Tenant ID
            subscription_id: Optional subscription ID

        Returns:
            Sync status and recorded metrics
        """
        tenant = await self.tenant_service.get_tenant(tenant_id)

        if not subscription_id:
            subscription_id = await self._get_active_subscription_id(tenant_id)

        if not subscription_id:
            return {
                "synced": False,
                "reason": "No active subscription found",
                "tenant_id": tenant_id,
            }

        now = datetime.now(UTC)
        usage_data = TenantUsageCreate(
            period_start=tenant.updated_at or tenant.created_at,
            period_end=now,
            api_calls=tenant.current_api_calls,
            storage_gb=float(tenant.current_storage_gb),
            active_users=tenant.current_users,
            bandwidth_gb=0,  # Not tracked in counters
        )

        result = await self.record_tenant_usage_with_billing(
            tenant_id=tenant_id,
            usage_data=usage_data,
            subscription_id=subscription_id,
        )

        return {
            "synced": True,
            "tenant_id": tenant_id,
            "subscription_id": subscription_id,
            "metrics_synced": result["billing_records"],
        }

    async def calculate_overage_charges(
        self,
        tenant_id: str,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
    ) -> OverageSummary:
        """
        Calculate overage charges for tenant exceeding plan limits.

        Args:
            tenant_id: Tenant ID
            period_start: Start of billing period
            period_end: End of billing period

        Returns:
            Overage details and charges
        """
        tenant = await self.tenant_service.get_tenant(tenant_id)

        overages: list[UsageOverageDetail] = []
        total_overage_amount = Decimal("0")

        # Check API calls overage
        if tenant.has_exceeded_api_limit:
            api_overage = tenant.current_api_calls - tenant.max_api_calls_per_month
            overage_rate = Decimal("0.001")  # $0.001 per API call (configurable)
            overage_cost = Decimal(api_overage) * overage_rate

            overages.append(
                {
                    "metric": "api_calls",
                    "limit": tenant.max_api_calls_per_month,
                    "usage": tenant.current_api_calls,
                    "overage": api_overage,
                    "rate": str(overage_rate),
                    "charge": str(overage_cost),
                }
            )
            total_overage_amount += overage_cost

        # Check storage overage
        if tenant.has_exceeded_storage_limit:
            storage_overage = float(tenant.current_storage_gb) - tenant.max_storage_gb
            overage_rate = Decimal("0.10")  # $0.10 per GB (configurable)
            overage_cost = Decimal(str(storage_overage)) * overage_rate

            overages.append(
                {
                    "metric": "storage_gb",
                    "limit": tenant.max_storage_gb,
                    "usage": float(tenant.current_storage_gb),
                    "overage": storage_overage,
                    "rate": str(overage_rate),
                    "charge": str(overage_cost),
                }
            )
            total_overage_amount += overage_cost

        # Check user overage
        if tenant.has_exceeded_user_limit:
            user_overage = tenant.current_users - tenant.max_users
            overage_rate = Decimal("5.00")  # $5 per user (configurable)
            overage_cost = Decimal(user_overage) * overage_rate

            overages.append(
                {
                    "metric": "users",
                    "limit": tenant.max_users,
                    "usage": tenant.current_users,
                    "overage": user_overage,
                    "rate": str(overage_rate),
                    "charge": str(overage_cost),
                }
            )
            total_overage_amount += overage_cost

        return {
            "tenant_id": tenant_id,
            "period_start": period_start,
            "period_end": period_end,
            "has_overages": len(overages) > 0,
            "overages": overages,
            "total_overage_charge": str(total_overage_amount),
            "currency": "USD",
        }

    async def get_billing_preview(
        self,
        tenant_id: str,
        include_overages: bool = True,
    ) -> BillingPreview:
        """
        Get preview of upcoming billing charges for tenant.

        Args:
            tenant_id: Tenant ID
            include_overages: Include overage calculations

        Returns:
            Billing preview with base charges and overages
        """
        tenant = await self.tenant_service.get_tenant(tenant_id)
        stats = await self.tenant_service.get_tenant_stats(tenant_id)

        plan_type_value = (
            tenant.plan_type.value if hasattr(tenant.plan_type, "value") else str(tenant.plan_type)
        )
        billing_cycle_value = (
            tenant.billing_cycle.value
            if hasattr(tenant.billing_cycle, "value")
            else str(tenant.billing_cycle)
        )
        base_subscription_cost = self._get_plan_base_cost(plan_type_value)

        preview: BillingPreview = {
            "tenant_id": tenant_id,
            "plan_type": plan_type_value,
            "billing_cycle": billing_cycle_value,
            "base_subscription_cost": base_subscription_cost,
            "usage_summary": {
                "api_calls": {
                    "current": tenant.current_api_calls,
                    "limit": tenant.max_api_calls_per_month,
                    "percentage": float(stats.api_usage_percent),
                },
                "storage_gb": {
                    "current": float(tenant.current_storage_gb),
                    "limit": tenant.max_storage_gb,
                    "percentage": float(stats.storage_usage_percent),
                },
                "users": {
                    "current": tenant.current_users,
                    "limit": tenant.max_users,
                    "percentage": float(stats.user_usage_percent),
                },
            },
        }

        if include_overages:
            overage_data = await self.calculate_overage_charges(tenant_id)
            preview["overages"] = overage_data

            base_cost = Decimal(base_subscription_cost)
            overage_cost = Decimal(overage_data["total_overage_charge"])
            preview["total_estimated_charge"] = str(base_cost + overage_cost)
        else:
            preview["total_estimated_charge"] = base_subscription_cost

        return preview

    async def _get_active_subscription_id(self, tenant_id: str) -> str | None:
        """Get active subscription ID for tenant."""
        # This would query the subscription service
        # For now, return None if not found
        subscriptions = await self.subscription_service.list_subscriptions(
            tenant_id=tenant_id,
            status=SubscriptionStatus.ACTIVE,
        )

        if subscriptions:
            first_subscription = subscriptions[0]
            subscription_id = getattr(first_subscription, "subscription_id", None)
            if subscription_id is not None:
                return str(subscription_id)

        return None

    def _get_plan_base_cost(self, plan_type: str) -> str:
        """Get base monthly cost for plan type."""
        # This should be configurable or fetched from product catalog
        plan_costs = {
            "free": "0.00",
            "starter": "29.00",
            "professional": "99.00",
            "enterprise": "499.00",
            "custom": "0.00",  # Custom pricing
        }
        return plan_costs.get(plan_type.lower(), "0.00")


# Dependency injection helper
async def get_usage_billing_integration(
    tenant_service: TenantService,
    subscription_service: SubscriptionService,
) -> TenantUsageBillingIntegration:
    """Get usage billing integration instance."""
    return TenantUsageBillingIntegration(
        tenant_service=tenant_service,
        subscription_service=subscription_service,
    )
