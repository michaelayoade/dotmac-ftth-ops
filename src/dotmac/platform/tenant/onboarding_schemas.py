"""
Schemas for tenant onboarding automation.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from .schemas import (
    TenantCreate,
    TenantInvitationCreate,
    TenantInvitationResponse,
    TenantResponse,
    TenantSettingCreate,
)


class OnboardingAdminUserCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Details for creating the initial tenant administrator."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    username: str = Field(min_length=3, max_length=50, description="Username for the admin user")
    email: EmailStr = Field(description="Email address for the admin user")
    password: str | None = Field(
        default=None,
        min_length=8,
        description="Password for the admin user. Required unless generate_password is true.",
    )
    generate_password: bool = Field(
        default=False,
        description="Generate a secure password automatically when one is not provided.",
    )
    full_name: str | None = Field(default=None, description="Full name of the admin user")
    roles: list[str] = Field(
        default_factory=lambda: ["tenant_admin"],
        description="Roles to assign to the admin user.",
    )
    send_activation_email: bool = Field(
        default=False,
        description="Reserved flag for future email automation integration.",
    )

    @model_validator(mode="after")
    def ensure_password(self) -> OnboardingAdminUserCreate:
        """Ensure a password is provided or auto-generation is enabled."""
        if self.password is None and not self.generate_password:
            raise ValueError("password is required when generate_password is false")
        return self


class TenantOnboardingOptions(BaseModel):  # BaseModel resolves to Any in isolation
    """Toggleable options controlling onboarding automation behaviour."""

    model_config = ConfigDict(validate_assignment=True)

    apply_default_settings: bool = Field(
        default=True, description="Populate opinionated default tenant settings."
    )
    mark_onboarding_complete: bool = Field(
        default=True, description="Mark onboarding as completed in tenant metadata."
    )
    activate_tenant: bool = Field(
        default=False, description="Activate the tenant after onboarding completes."
    )
    allow_existing_tenant: bool = Field(
        default=False,
        description="Allow onboarding to continue if the tenant already exists (matched by slug).",
    )


class TenantOnboardingRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request body for tenant onboarding automation."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    tenant: TenantCreate | None = Field(
        default=None, description="Tenant attributes when creating a new tenant."
    )
    tenant_id: str | None = Field(
        default=None, description="Existing tenant identifier to automate onboarding for."
    )
    options: TenantOnboardingOptions = Field(
        default_factory=TenantOnboardingOptions, description="Automation behaviour toggles."
    )
    admin_user: OnboardingAdminUserCreate | None = Field(
        default=None,
        description="Optional administrator account to provision as part of onboarding.",
    )
    settings: list[TenantSettingCreate] = Field(
        default_factory=list,
        description="Additional tenant settings to create or update.",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Custom metadata to merge into the tenant record.",
    )
    invitations: list[TenantInvitationCreate] = Field(
        default_factory=list,
        description="Optional list of invitations to send after onboarding.",
    )
    feature_flags: dict[str, bool] | None = Field(
        default=None,
        description="Override tenant feature flags after onboarding.",
    )

    @model_validator(mode="after")
    def validate_target(self) -> TenantOnboardingRequest:
        """Ensure either tenant data or tenant_id is provided, but not both."""
        if not self.tenant and not self.tenant_id:
            raise ValueError("Provide either tenant payload or tenant_id for onboarding.")
        if self.tenant and self.tenant_id:
            raise ValueError("tenant and tenant_id cannot both be provided.")
        return self


class TenantOnboardingResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response payload returned after onboarding automation."""

    model_config = ConfigDict(from_attributes=True)

    tenant: TenantResponse = Field(description="Tenant data after onboarding completes.")
    created: bool = Field(description="Whether a new tenant record was created.")
    onboarding_status: str = Field(description="Current onboarding status value.")
    admin_user_id: str | None = Field(
        default=None, description="Identifier of the admin user that was created."
    )
    admin_user_password: str | None = Field(
        default=None,
        description="Generated password for the admin user when auto-generated; plaintext is only returned once.",
    )
    invitations: list[TenantInvitationResponse] = Field(
        default_factory=list, description="Invitations created during onboarding."
    )
    applied_settings: list[str] = Field(
        default_factory=list, description="List of settings keys applied to the tenant."
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Tenant metadata after onboarding updates."
    )
    feature_flags_updated: bool = Field(
        default=False, description="Indicates whether tenant feature flags were modified."
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Non-fatal warnings captured during onboarding automation.",
    )
    logs: list[str] = Field(default_factory=list, description="Human-readable activity log.")


class TenantOnboardingStatusResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response payload summarising onboarding status for a tenant."""

    model_config = ConfigDict(from_attributes=True)

    tenant_id: str = Field(description="Tenant identifier.")
    status: str = Field(description="Computed onboarding status value.")
    completed: bool = Field(description="Whether onboarding is marked as completed.")
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Tenant metadata used to compute the status."
    )
    updated_at: datetime | None = Field(
        default=None, description="Timestamp of the last tenant update."
    )
