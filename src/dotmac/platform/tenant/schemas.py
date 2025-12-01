"""
Pydantic schemas for tenant management API.

Request and response models following Pydantic v2 patterns.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import (
    BillingCycle,
    TenantDeploymentMode,
    TenantInvitationStatus,
    TenantPlanType,
    TenantProvisioningStatus,
    TenantStatus,
)


# Base schemas
class TenantBase(BaseModel):  # BaseModel resolves to Any in isolation
    """Base tenant schema with common fields."""

    model_config = ConfigDict(
        str_strip_whitespace=True, validate_assignment=True, from_attributes=True
    )

    name: str = Field(min_length=1, max_length=255, description="Tenant organization name")
    slug: str = Field(
        min_length=1,
        max_length=255,
        pattern=r"^[a-z0-9-]+$",
        description="Unique URL-friendly identifier",
    )
    domain: str | None = Field(None, max_length=255, description="Custom domain")
    email: EmailStr | None = Field(None, description="Primary contact email")
    phone: str | None = Field(None, max_length=50, description="Contact phone number")


class TenantCreate(TenantBase):  # TenantBase resolves to Any in isolation
    """Schema for creating a new tenant."""

    plan_type: TenantPlanType = Field(
        default=TenantPlanType.FREE, description="Initial subscription plan"
    )
    billing_cycle: BillingCycle = Field(
        default=BillingCycle.MONTHLY, description="Billing frequency"
    )
    billing_email: EmailStr | None = Field(None, description="Billing contact email")

    # Company info (optional)
    company_size: str | None = Field(None, max_length=50, description="Company size range")
    industry: str | None = Field(None, max_length=100, description="Industry sector")
    country: str | None = Field(None, max_length=100, description="Country")
    timezone: str = Field(default="UTC", description="Tenant timezone")

    # Initial limits
    max_users: int = Field(default=5, ge=1, description="Maximum users allowed")
    max_api_calls_per_month: int = Field(default=10000, ge=0, description="Monthly API call limit")
    max_storage_gb: int = Field(default=10, ge=1, description="Storage limit in GB")

    oss_config: dict[str, dict[str, Any]] | None = Field(
        default=None,
        description="Optional VOLTHA/GenieACS/NetBox/AWX overrides per service",
    )
    branding: TenantBrandingConfig | None = Field(
        default=None,
        description="Initial branding configuration applied to the ISP portal",
    )

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        """Ensure slug is lowercase and valid."""
        if not v:
            raise ValueError("Slug cannot be empty")
        v = v.lower().strip()
        if not v.replace("-", "").isalnum():
            raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        return v


class TenantUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating a tenant."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    name: str | None = Field(None, min_length=1, max_length=255)
    domain: str | None = Field(None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    billing_email: EmailStr | None = None
    billing_cycle: BillingCycle | None = None

    # Status updates
    status: TenantStatus | None = None

    # Limits
    max_users: int | None = Field(None, ge=1)
    max_api_calls_per_month: int | None = Field(None, ge=0)
    max_storage_gb: int | None = Field(None, ge=1)

    # Company info
    company_size: str | None = Field(None, max_length=50)
    industry: str | None = Field(None, max_length=100)
    country: str | None = Field(None, max_length=100)
    timezone: str | None = Field(None, max_length=50)

    # Branding
    logo_url: str | None = Field(None, max_length=500)
    primary_color: str | None = Field(None, max_length=20)


class TenantResponse(TenantBase):  # TenantBase resolves to Any in isolation
    """Schema for tenant response."""

    id: str
    status: TenantStatus
    plan_type: TenantPlanType
    billing_cycle: BillingCycle
    billing_email: str | None

    # Subscription dates
    trial_ends_at: datetime | None
    subscription_starts_at: datetime | None
    subscription_ends_at: datetime | None

    # Limits and usage
    max_users: int
    max_api_calls_per_month: int
    max_storage_gb: int
    current_users: int
    current_api_calls: int
    current_storage_gb: float

    # Additional info
    company_size: str | None
    industry: str | None
    country: str | None
    timezone: str
    logo_url: str | None
    primary_color: str | None

    # Metadata
    features: dict[str, Any]
    settings: dict[str, Any]
    custom_metadata: dict[str, Any]

    # Timestamps
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    # Computed properties
    is_trial: bool = False
    is_active: bool = False
    trial_expired: bool = False
    has_exceeded_user_limit: bool = False
    has_exceeded_api_limit: bool = False
    has_exceeded_storage_limit: bool = False


class TenantBrandingConfig(BaseModel):  # BaseModel resolves to Any in isolation
    """Tenant-specific branding configuration."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    product_name: str | None = Field(None, description="Customer-facing product name")
    product_tagline: str | None = Field(None, description="Marketing tagline")
    company_name: str | None = Field(None, description="Company or brand name")
    support_email: EmailStr | None = Field(None, description="Primary support contact email")
    success_email: EmailStr | None = Field(None, description="Customer success contact email")
    operations_email: EmailStr | None = Field(
        None, description="Operations/NOC fallback contact email"
    )
    partner_support_email: EmailStr | None = Field(
        None, description="Partner escalation contact email"
    )
    primary_color: str | None = Field(None, description="Primary brand color (hex/RGB)")
    primary_hover_color: str | None = Field(None, description="Primary hover color (hex/RGB)")
    primary_foreground_color: str | None = Field(
        None, description="Primary foreground (text) color"
    )
    secondary_color: str | None = Field(None, description="Secondary brand color")
    secondary_hover_color: str | None = Field(None, description="Secondary hover color")
    secondary_foreground_color: str | None = Field(
        None, description="Secondary foreground (text) color"
    )
    accent_color: str | None = Field(None, description="Accent brand color")
    background_color: str | None = Field(None, description="Background brand color")
    foreground_color: str | None = Field(None, description="Foreground/text brand color")
    primary_color_dark: str | None = Field(None, description="Dark theme primary brand color")
    primary_hover_color_dark: str | None = Field(
        None, description="Dark theme primary hover color"
    )
    primary_foreground_color_dark: str | None = Field(
        None, description="Dark theme primary foreground (text) color"
    )
    secondary_color_dark: str | None = Field(None, description="Dark theme secondary brand color")
    secondary_hover_color_dark: str | None = Field(
        None, description="Dark theme secondary hover color"
    )
    secondary_foreground_color_dark: str | None = Field(
        None, description="Dark theme secondary foreground (text) color"
    )
    accent_color_dark: str | None = Field(None, description="Dark theme accent brand color")
    background_color_dark: str | None = Field(None, description="Dark theme background color")
    foreground_color_dark: str | None = Field(None, description="Dark theme foreground/text color")
    logo_light_url: str | None = Field(None, description="Light theme logo URL")
    logo_dark_url: str | None = Field(None, description="Dark theme logo URL")
    favicon_url: str | None = Field(None, description="Favicon URL")
    docs_url: str | None = Field(None, description="Documentation or knowledge base URL")
    support_portal_url: str | None = Field(None, description="Support portal URL")
    status_page_url: str | None = Field(None, description="Status page URL")
    terms_url: str | None = Field(None, description="Terms of service URL")
    privacy_url: str | None = Field(None, description="Privacy policy URL")


class TenantBrandingResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response containing tenant branding."""

    tenant_id: str
    branding: TenantBrandingConfig
    updated_at: datetime | None = Field(None, description="Last time branding was updated")


class TenantBrandingUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Payload for updating tenant branding."""

    branding: TenantBrandingConfig = Field(default_factory=TenantBrandingConfig)


class TenantListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for paginated tenant list."""

    model_config = ConfigDict(from_attributes=True)

    items: list[TenantResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# Tenant Settings Schemas
class TenantSettingCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for creating a tenant setting."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    key: str = Field(min_length=1, max_length=255, description="Setting key")
    value: str = Field(description="Setting value")
    value_type: str = Field(default="string", description="Value type (string, int, bool, json)")
    description: str | None = Field(None, description="Setting description")
    is_encrypted: bool = Field(default=False, description="Whether to encrypt the value")


class TenantSettingUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating a tenant setting."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    value: str | None = None
    value_type: str | None = None
    description: str | None = None
    is_encrypted: bool | None = None


class TenantSettingResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for tenant setting response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: str
    key: str
    value: str
    value_type: str
    description: str | None
    is_encrypted: bool
    created_at: datetime
    updated_at: datetime


# Tenant Usage Schemas
class TenantUsageCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for creating a usage record."""

    model_config = ConfigDict(validate_assignment=True)

    period_start: datetime
    period_end: datetime
    api_calls: int = Field(default=0, ge=0)
    storage_gb: float = Field(default=0, ge=0)
    active_users: int = Field(default=0, ge=0)
    bandwidth_gb: float = Field(default=0, ge=0)
    metrics: dict[str, Any] = Field(default_factory=lambda: {})


class TenantUsageResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for usage response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: str
    period_start: datetime
    period_end: datetime
    api_calls: int
    storage_gb: float
    active_users: int
    bandwidth_gb: float
    metrics: dict[str, Any]
    created_at: datetime
    updated_at: datetime


# Tenant Invitation Schemas
class TenantInvitationCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for creating a tenant invitation."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    email: EmailStr = Field(description="Email address to invite")
    role: str = Field(default="member", description="Role to assign")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Ensure email is lowercase."""
        return v.lower().strip()


class TenantInvitationResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for invitation response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    email: str
    role: str
    invited_by: str
    token: str
    status: TenantInvitationStatus
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime
    is_expired: bool = False
    is_pending: bool = False


class TenantInvitationAccept(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for accepting an invitation."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    token: str = Field(min_length=1, description="Invitation token")


# Tenant Statistics Schemas
class TenantStatsResponse(BaseModel):
    """Schema for tenant statistics."""

    model_config = ConfigDict(from_attributes=True)

    tenant_id: str
    total_users: int
    active_users: int
    total_api_calls: int
    total_storage_gb: float
    total_bandwidth_gb: float

    # Limits
    user_limit: int
    api_limit: int
    storage_limit: int

    # Usage percentages
    user_usage_percent: float
    api_usage_percent: float
    storage_usage_percent: float

    # Subscription info
    plan_type: TenantPlanType
    status: TenantStatus
    days_until_expiry: int | None


# Feature management
class TenantFeatureUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating tenant features."""

    model_config = ConfigDict(validate_assignment=True)

    features: dict[str, bool] = Field(description="Feature flags to enable/disable")


class TenantMetadataUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating tenant metadata."""

    model_config = ConfigDict(validate_assignment=True)

    custom_metadata: dict[str, Any] = Field(description="Custom metadata")


# Bulk operations
class TenantBulkStatusUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for bulk status updates."""

    model_config = ConfigDict(validate_assignment=True)

    tenant_ids: list[str] = Field(min_length=1, description="List of tenant IDs")
    status: TenantStatus = Field(description="New status to set")


class TenantBulkDeleteRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for bulk tenant deletion."""

    model_config = ConfigDict(validate_assignment=True)

    tenant_ids: list[str] = Field(min_length=1, description="List of tenant IDs to delete")
    permanent: bool = Field(default=False, description="Permanently delete (vs soft delete)")


# Provisioning workflows
class TenantProvisioningJobCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Request payload for scheduling tenant infrastructure provisioning."""

    model_config = ConfigDict(validate_assignment=True)

    deployment_mode: TenantDeploymentMode = Field(
        description="Target infrastructure profile for the tenant environment."
    )
    awx_template_id: int | None = Field(
        default=None,
        description="Optional AWX job template identifier to launch.",
    )
    extra_vars: dict[str, Any] | None = Field(
        default_factory=dict,
        description="Additional Ansible variables injected into the job template.",
    )
    connection_profile: dict[str, Any] | None = Field(
        default=None,
        description="Connectivity metadata (host, port, credentials reference) for customer supplied servers.",
    )


class TenantProvisioningJobResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response payload representing a provisioning job."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    status: TenantProvisioningStatus
    deployment_mode: TenantDeploymentMode
    awx_template_id: int | None
    awx_job_id: int | None
    requested_by: str | None
    started_at: datetime | None
    finished_at: datetime | None
    retry_count: int
    error_message: str | None
    extra_vars: dict[str, Any] | None
    connection_profile: dict[str, Any] | None
    last_acknowledged_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TenantProvisioningJobListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Paginated list of provisioning jobs for a tenant."""

    model_config = ConfigDict(from_attributes=True)

    items: list[TenantProvisioningJobResponse]
    total: int
