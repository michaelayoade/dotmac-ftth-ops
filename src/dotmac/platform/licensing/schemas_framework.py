"""
Pydantic schemas for composable licensing framework API.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from dotmac.platform.licensing.framework import (
    BillingCycle,
    EventType,
    ModuleCategory,
    PricingModel,
    SubscriptionStatus,
)

# ========================================================================
# FEATURE MODULE SCHEMAS
# ========================================================================


class ModuleCapabilityCreate(BaseModel):
    """Create a new module capability."""

    capability_code: str = Field(..., min_length=1, max_length=100)
    capability_name: str = Field(..., min_length=1, max_length=200)
    description: str
    api_endpoints: list[str] = Field(default_factory=list)
    ui_routes: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)
    config: dict[str, Any] = Field(default_factory=dict)


class ModuleCapabilityResponse(BaseModel):
    """Module capability response."""

    id: UUID
    module_id: UUID
    capability_code: str
    capability_name: str
    description: str
    api_endpoints: list[str]
    ui_routes: list[str]
    permissions: list[str]
    config: dict[str, Any]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class FeatureModuleCreate(BaseModel):
    """Create a new feature module."""

    module_code: str = Field(..., min_length=1, max_length=100)
    module_name: str = Field(..., min_length=1, max_length=200)
    category: ModuleCategory
    description: str
    dependencies: list[str] = Field(default_factory=list)
    pricing_model: PricingModel
    base_price: float = Field(..., ge=0)
    config_schema: dict[str, Any] = Field(default_factory=dict)
    default_config: dict[str, Any] = Field(default_factory=dict)
    capabilities: list[ModuleCapabilityCreate] = Field(default_factory=list)


class FeatureModuleResponse(BaseModel):
    """Feature module response."""

    id: UUID
    module_code: str
    module_name: str
    category: ModuleCategory
    description: str
    dependencies: list[str]
    pricing_model: PricingModel
    base_price: float
    config_schema: dict[str, Any]
    default_config: dict[str, Any]
    is_active: bool
    capabilities: list[ModuleCapabilityResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FeatureModuleUpdate(BaseModel):
    """Update feature module."""

    module_name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    dependencies: list[str] | None = None
    pricing_model: PricingModel | None = None
    base_price: float | None = Field(None, ge=0)
    config_schema: dict[str, Any] | None = None
    default_config: dict[str, Any] | None = None
    is_active: bool | None = None


# ========================================================================
# QUOTA DEFINITION SCHEMAS
# ========================================================================


class QuotaDefinitionCreate(BaseModel):
    """Create a new quota definition."""

    quota_code: str = Field(..., min_length=1, max_length=100)
    quota_name: str = Field(..., min_length=1, max_length=200)
    description: str
    unit_name: str = Field(..., min_length=1, max_length=50)
    pricing_model: PricingModel
    overage_rate: float = Field(..., ge=0)
    is_metered: bool = False
    reset_period: str | None = None  # MONTHLY, QUARTERLY, or ANNUAL
    config: dict[str, Any] = Field(default_factory=dict)


class QuotaDefinitionResponse(BaseModel):
    """Quota definition response."""

    id: UUID
    quota_code: str
    quota_name: str
    description: str
    unit_name: str
    pricing_model: PricingModel
    overage_rate: float
    is_metered: bool
    reset_period: str | None
    config: dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class QuotaDefinitionUpdate(BaseModel):
    """Update quota definition."""

    quota_name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    unit_name: str | None = Field(None, min_length=1, max_length=50)
    pricing_model: PricingModel | None = None
    overage_rate: float | None = Field(None, ge=0)
    is_metered: bool | None = None
    reset_period: str | None = None  # MONTHLY, QUARTERLY, or ANNUAL
    config: dict[str, Any] | None = None
    is_active: bool | None = None


# ========================================================================
# SERVICE PLAN SCHEMAS
# ========================================================================


class PlanModuleConfig(BaseModel):
    """Module configuration for a service plan."""

    module_id: UUID
    included: bool = True
    addon: bool = False
    price: float | None = Field(None, ge=0)
    trial_only: bool = False
    promotional_until: datetime | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class PlanQuotaConfig(BaseModel):
    """Quota configuration for a service plan."""

    quota_id: UUID
    quantity: int = Field(..., ge=-1)  # -1 = unlimited
    soft_limit: int | None = Field(None, ge=0)
    allow_overage: bool = False
    overage_rate: float | None = Field(None, ge=0)
    pricing_tiers: list[dict[str, Any]] = Field(default_factory=list)
    config: dict[str, Any] = Field(default_factory=dict)

    @field_validator("quantity", mode="before")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        if v < -1:
            raise ValueError("quantity must be -1 (unlimited) or non-negative")
        return v


class ServicePlanCreate(BaseModel):
    """Create a new service plan by composing modules and quotas."""

    plan_name: str = Field(..., min_length=1, max_length=200)
    plan_code: str = Field(..., min_length=1, max_length=100)
    description: str
    base_price_monthly: float = Field(..., ge=0)
    annual_discount_percent: float = Field(default=0, ge=0, le=100)
    is_template: bool = False
    is_public: bool = False
    is_custom: bool = False
    trial_days: int = Field(default=0, ge=0)
    trial_modules: list[str] = Field(default_factory=list)
    modules: list[PlanModuleConfig] = Field(default_factory=list)
    quotas: list[PlanQuotaConfig] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class PlanModuleResponse(BaseModel):
    """Plan module response."""

    id: UUID
    module_id: UUID
    module_name: str
    module_code: str
    included_by_default: bool
    is_optional_addon: bool
    override_price: float | None
    trial_only: bool
    promotional_until: datetime | None
    config: dict[str, Any]

    model_config = {"from_attributes": True}


class PlanQuotaResponse(BaseModel):
    """Plan quota response."""

    id: UUID
    quota_id: UUID
    quota_name: str
    quota_code: str
    unit_name: str
    included_quantity: int
    soft_limit: int | None
    allow_overage: bool
    overage_rate_override: float | None
    pricing_tiers: list[dict[str, Any]]
    config: dict[str, Any]

    model_config = {"from_attributes": True}


class ServicePlanResponse(BaseModel):
    """Service plan response."""

    id: UUID
    plan_name: str
    plan_code: str
    description: str
    version: int
    is_template: bool
    is_public: bool
    is_custom: bool
    base_price_monthly: float
    annual_discount_percent: float
    trial_days: int
    trial_modules: list[str]
    metadata: dict[str, Any]
    is_active: bool
    modules: list[PlanModuleResponse]
    quotas: list[PlanQuotaResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ServicePlanUpdate(BaseModel):
    """Update service plan."""

    plan_name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    base_price_monthly: float | None = Field(None, ge=0)
    annual_discount_percent: float | None = Field(None, ge=0, le=100)
    is_public: bool | None = None
    trial_days: int | None = Field(None, ge=0)
    trial_modules: list[str] | None = None
    metadata: dict[str, Any] | None = None
    is_active: bool | None = None


class ServicePlanDuplicate(BaseModel):
    """Duplicate a service plan as template."""

    new_plan_name: str = Field(..., min_length=1, max_length=200)
    new_plan_code: str = Field(..., min_length=1, max_length=100)


class PlanPricingResponse(BaseModel):
    """Plan pricing calculation response."""

    base_monthly: float
    addon_monthly: float
    total_monthly: float
    annual_discount_percent: float
    discount_amount: float
    total_annual: float | None


# ========================================================================
# SUBSCRIPTION SCHEMAS
# ========================================================================


class SubscriptionCreate(BaseModel):
    """Create a new subscription."""

    tenant_id: UUID
    plan_id: UUID
    billing_cycle: BillingCycle
    start_trial: bool = False
    addon_module_ids: list[UUID] = Field(default_factory=list)
    custom_config: dict[str, Any] = Field(default_factory=dict)
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None


class SubscriptionModuleResponse(BaseModel):
    """Subscription module response."""

    id: UUID
    module_id: UUID
    module_name: str
    module_code: str
    is_enabled: bool
    source: str  # PLAN, ADDON, TRIAL, PROMOTION, CUSTOM
    addon_price: float | None
    expires_at: datetime | None
    config: dict[str, Any]

    model_config = {"from_attributes": True}


class SubscriptionQuotaResponse(BaseModel):
    """Subscription quota usage response."""

    id: UUID
    quota_id: UUID
    quota_name: str
    quota_code: str
    unit_name: str
    period_start: datetime
    period_end: datetime | None
    allocated_quantity: int
    current_usage: int
    overage_quantity: int
    overage_charges: float

    model_config = {"from_attributes": True}


class TenantSubscriptionResponse(BaseModel):
    """Tenant subscription response."""

    id: UUID
    tenant_id: UUID
    plan_id: UUID
    plan_name: str
    status: SubscriptionStatus
    billing_cycle: BillingCycle
    monthly_price: float
    annual_price: float | None
    trial_start: datetime | None
    trial_end: datetime | None
    current_period_start: datetime
    current_period_end: datetime
    stripe_customer_id: str | None
    stripe_subscription_id: str | None
    custom_config: dict[str, Any]
    modules: list[SubscriptionModuleResponse]
    quotas: list[SubscriptionQuotaResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AddAddonRequest(BaseModel):
    """Request to add an add-on module."""

    module_id: UUID


class RemoveAddonRequest(BaseModel):
    """Request to remove an add-on module."""

    module_id: UUID


# ========================================================================
# ENTITLEMENT & QUOTA SCHEMAS
# ========================================================================


class FeatureEntitlementCheck(BaseModel):
    """Check feature entitlement request."""

    module_code: str
    capability_code: str | None = None


class FeatureEntitlementResponse(BaseModel):
    """Feature entitlement check response."""

    entitled: bool
    module_code: str
    capability_code: str | None
    subscription_id: UUID | None
    expires_at: datetime | None


class EntitledCapabilitiesResponse(BaseModel):
    """Entitled capabilities grouped by module."""

    capabilities: dict[str, list[str]]  # module_code -> [capability_codes]


class QuotaCheckRequest(BaseModel):
    """Check quota availability request."""

    quota_code: str
    requested_quantity: int = Field(default=1, ge=1)


class QuotaCheckResponse(BaseModel):
    """Quota check response."""

    allowed: bool
    quota_code: str
    allocated: int  # -1 = unlimited
    current: int
    available: int
    overage_allowed: bool
    overage_rate: float
    soft_limit: int | None


class QuotaConsumeRequest(BaseModel):
    """Consume quota request."""

    quota_code: str
    quantity: int = Field(default=1, ge=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class QuotaConsumeResponse(BaseModel):
    """Quota consumption response."""

    success: bool
    quota_code: str
    new_usage: int
    overage: int
    overage_charge: float


class QuotaReleaseRequest(BaseModel):
    """Release quota request."""

    quota_code: str
    quantity: int = Field(default=1, ge=1)


# ========================================================================
# EVENT & AUDIT SCHEMAS
# ========================================================================


class SubscriptionEventResponse(BaseModel):
    """Subscription event response."""

    id: UUID
    subscription_id: UUID
    event_type: EventType
    event_data: dict[str, Any]
    created_by: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FeatureUsageStats(BaseModel):
    """Feature usage statistics."""

    module_code: str
    feature_name: str
    total_usage: int
    period_start: datetime
    period_end: datetime
