"""
GraphQL types for Tenant Management.

Provides types for tenants with conditional loading of settings, usage,
and invitations to optimize performance.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Any

import strawberry

if TYPE_CHECKING:
    type JSONScalar = Any
else:
    from strawberry.scalars import JSON as JSONScalar

from dotmac.platform.graphql.types.common import BillingCycleEnum


@strawberry.enum
class TenantStatusEnum(str, Enum):
    """Tenant account status."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    INACTIVE = "inactive"
    PENDING = "pending"
    CANCELLED = "cancelled"


@strawberry.enum
class TenantPlanTypeEnum(str, Enum):
    """Tenant subscription plan types."""

    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"
    CUSTOM = "custom"


@strawberry.type
class TenantUsageMetrics:
    """Tenant resource usage metrics."""

    # Limits
    max_users: int
    max_api_calls_per_month: int
    max_storage_gb: int

    # Current usage
    current_users: int
    current_api_calls: int
    current_storage_gb: Decimal

    # Computed flags
    has_exceeded_user_limit: bool
    has_exceeded_api_limit: bool
    has_exceeded_storage_limit: bool


@strawberry.type
class TenantSetting:
    """Individual tenant setting."""

    id: int
    tenant_id: strawberry.ID
    key: str
    value: str
    value_type: str
    description: str | None
    is_encrypted: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, setting: Any) -> "TenantSetting":
        """Convert SQLAlchemy model to GraphQL type."""
        return cls(
            id=setting.id,
            tenant_id=strawberry.ID(str(setting.tenant_id)),
            key=setting.key,
            value=setting.value,
            value_type=setting.value_type,
            description=setting.description,
            is_encrypted=setting.is_encrypted,
            created_at=setting.created_at,
            updated_at=setting.updated_at,
        )


@strawberry.type
class TenantUsageRecord:
    """Historical usage record for a tenant."""

    id: int
    tenant_id: strawberry.ID
    period_start: datetime
    period_end: datetime
    api_calls: int
    storage_gb: Decimal
    active_users: int
    bandwidth_gb: Decimal
    metrics: JSONScalar

    @classmethod
    def from_model(cls, usage: Any) -> "TenantUsageRecord":
        """Convert SQLAlchemy model to GraphQL type."""
        return cls(
            id=usage.id,
            tenant_id=strawberry.ID(str(usage.tenant_id)),
            period_start=usage.period_start,
            period_end=usage.period_end,
            api_calls=usage.api_calls,
            storage_gb=usage.storage_gb,
            active_users=usage.active_users,
            bandwidth_gb=usage.bandwidth_gb,
            metrics=usage.metrics,
        )


@strawberry.type
class TenantInvitation:
    """Tenant user invitation."""

    id: strawberry.ID
    tenant_id: strawberry.ID
    email: str
    role: str
    invited_by: strawberry.ID
    status: str
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime
    is_expired: bool
    is_pending: bool

    @classmethod
    def from_model(cls, invitation: Any) -> "TenantInvitation":
        """Convert SQLAlchemy model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(invitation.id)),
            tenant_id=strawberry.ID(str(invitation.tenant_id)),
            email=invitation.email,
            role=invitation.role,
            invited_by=strawberry.ID(str(invitation.invited_by)),
            status=invitation.status.value,
            expires_at=invitation.expires_at,
            accepted_at=invitation.accepted_at,
            created_at=invitation.created_at,
            is_expired=invitation.is_expired,
            is_pending=invitation.is_pending,
        )


@strawberry.type
class Tenant:
    """
    Tenant/Organization with conditional field loading.

    Settings, usage records, and invitations are loaded conditionally
    via DataLoaders to optimize performance.
    """

    # Core identifiers
    id: strawberry.ID
    name: str
    slug: str
    domain: str | None

    # Status and subscription
    status: TenantStatusEnum
    plan_type: TenantPlanTypeEnum
    billing_cycle: BillingCycleEnum

    # Contact information
    email: str | None
    phone: str | None
    billing_email: str | None

    # Subscription dates
    trial_ends_at: datetime | None
    subscription_starts_at: datetime | None
    subscription_ends_at: datetime | None

    # Usage metrics (always included - lightweight)
    usage_metrics: TenantUsageMetrics

    # Company information
    company_size: str | None
    industry: str | None
    country: str | None
    timezone: str

    # Branding
    logo_url: str | None
    primary_color: str | None

    # Metadata (optional, can be large)
    features: JSONScalar | None
    settings_json: JSONScalar | None
    custom_metadata: JSONScalar | None

    # Timestamps
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    # Computed properties
    is_trial: bool
    is_active: bool
    trial_expired: bool

    # Relationships (conditionally loaded via DataLoaders)
    settings: list[TenantSetting] = strawberry.field(default_factory=list)
    usage_records: list[TenantUsageRecord] = strawberry.field(default_factory=list)
    invitations: list[TenantInvitation] = strawberry.field(default_factory=list)

    @classmethod
    def from_model(cls, tenant: Any, include_metadata: bool = False) -> "Tenant":
        """Convert SQLAlchemy Tenant model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(tenant.id)),
            name=tenant.name,
            slug=tenant.slug,
            domain=tenant.domain,
            status=TenantStatusEnum(tenant.status.value),
            plan_type=TenantPlanTypeEnum(tenant.plan_type.value),
            billing_cycle=BillingCycleEnum(tenant.billing_cycle.value),
            email=tenant.email,
            phone=tenant.phone,
            billing_email=tenant.billing_email,
            trial_ends_at=tenant.trial_ends_at,
            subscription_starts_at=tenant.subscription_starts_at,
            subscription_ends_at=tenant.subscription_ends_at,
            usage_metrics=TenantUsageMetrics(
                max_users=tenant.max_users,
                max_api_calls_per_month=tenant.max_api_calls_per_month,
                max_storage_gb=tenant.max_storage_gb,
                current_users=tenant.current_users,
                current_api_calls=tenant.current_api_calls,
                current_storage_gb=tenant.current_storage_gb,
                has_exceeded_user_limit=tenant.has_exceeded_user_limit,
                has_exceeded_api_limit=tenant.has_exceeded_api_limit,
                has_exceeded_storage_limit=tenant.has_exceeded_storage_limit,
            ),
            company_size=tenant.company_size,
            industry=tenant.industry,
            country=tenant.country,
            timezone=tenant.timezone,
            logo_url=tenant.logo_url,
            primary_color=tenant.primary_color,
            # Conditionally include metadata (can be large)
            features=tenant.features if include_metadata else None,
            settings_json=tenant.settings if include_metadata else None,
            custom_metadata=tenant.custom_metadata if include_metadata else None,
            created_at=tenant.created_at,
            updated_at=tenant.updated_at,
            deleted_at=tenant.deleted_at,
            is_trial=tenant.is_trial,
            is_active=tenant.status_is_active,
            trial_expired=tenant.trial_expired,
            # Relationships populated by DataLoaders
            settings=[],
            usage_records=[],
            invitations=[],
        )


@strawberry.type
class TenantConnection:
    """Paginated tenant results."""

    tenants: list[Tenant]
    total_count: int
    has_next_page: bool
    has_prev_page: bool
    page: int
    page_size: int


@strawberry.type
class TenantOverviewMetrics:
    """Aggregated tenant metrics."""

    total_tenants: int
    active_tenants: int
    trial_tenants: int
    suspended_tenants: int
    cancelled_tenants: int

    # Plan distribution
    free_plan_count: int
    starter_plan_count: int
    professional_plan_count: int
    enterprise_plan_count: int
    custom_plan_count: int

    # Resource usage aggregates
    total_users: int
    total_api_calls: int
    total_storage_gb: Decimal

    # Growth metrics
    new_tenants_this_month: int
    churned_tenants_this_month: int
