"""Pydantic schemas for Subscriber API."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from dotmac.platform.services.lifecycle.models import ServiceType
from dotmac.platform.subscribers.models import SubscriberStatus


class SubscriberBase(BaseModel):
    """Shared fields across subscriber create/update."""

    model_config = ConfigDict(from_attributes=True)

    customer_id: UUID | None = Field(None, description="Billing customer ID")
    user_id: UUID | None = Field(None, description="Linked portal user (optional)")
    subscriber_number: str | None = Field(
        None, description="Human readable subscriber ID (unique per tenant if set)"
    )
    full_name: str | None = Field(None, description="Subscriber full name")
    email: EmailStr | None = Field(None, description="Subscriber contact email")
    phone_number: str | None = Field(None, description="Subscriber contact phone")
    service_type: ServiceType | None = Field(
        None, description="Service type (e.g., fiber, wireless)"
    )
    bandwidth_profile_id: str | None = Field(
        None, description="Bandwidth/QoS profile to apply (radius_bandwidth_profiles.id)"
    )
    download_speed_kbps: int | None = Field(None, description="Downstream speed override (kbps)")
    upload_speed_kbps: int | None = Field(None, description="Upstream speed override (kbps)")
    static_ipv4: str | None = Field(None, description="Static IPv4 address (optional)")
    ipv6_prefix: str | None = Field(None, description="IPv6 prefix delegation")
    vlan_id: int | None = Field(None, description="VLAN assignment")
    nas_identifier: str | None = Field(None, description="NAS identifier")
    onu_serial: str | None = Field(None, description="ONU serial number (fiber)")
    cpe_mac_address: str | None = Field(None, description="CPE MAC address")
    service_address: str | None = Field(None, description="Service address")
    service_coordinates: dict[str, Any] | None = Field(
        None, description="GPS coordinates {lat, lon}"
    )
    site_id: str | None = Field(None, description="Network site/POP identifier")
    activation_date: datetime | None = Field(None, description="Activation date")
    session_timeout: int | None = Field(None, description="RADIUS Session-Timeout (seconds)")
    idle_timeout: int | None = Field(None, description="RADIUS Idle-Timeout (seconds)")
    simultaneous_use: int | None = Field(None, description="Max concurrent sessions")
    metadata: dict[str, Any] | None = Field(default=None, description="Arbitrary metadata")


class SubscriberCreate(SubscriberBase):
    """Create subscriber request."""

    username: str | None = Field(None, min_length=3, max_length=64, description="RADIUS username")
    password: str | None = Field(
        None, min_length=8, max_length=255, description="RADIUS password (auto-generated if blank)"
    )
    status: SubscriberStatus | None = Field(
        None, description="Initial status (default: pending)"
    )
    plan_id: str | None = Field(
        None, description="Billing subscription plan ID to create a subscription"
    )


class SubscriberUpdate(SubscriberBase):
    """Update subscriber request."""

    username: str | None = Field(None, description="Update username")
    password: str | None = Field(None, min_length=8, description="Update password")
    status: SubscriberStatus | None = Field(None, description="Update status")
    plan_id: str | None = Field(
        None,
        description="Update subscription plan. If provided, a new subscription is created and tracked.",
    )


class SubscriberResponse(BaseModel):
    """Subscriber response payload."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    customer_id: UUID | None
    user_id: UUID | None
    username: str
    subscriber_number: str | None
    full_name: str | None
    email: EmailStr | None
    phone_number: str | None
    status: SubscriberStatus
    service_type: ServiceType
    bandwidth_profile_id: str | None
    download_speed_kbps: int | None
    upload_speed_kbps: int | None
    static_ipv4: str | None
    ipv6_prefix: str | None
    vlan_id: int | None
    nas_identifier: str | None
    onu_serial: str | None
    cpe_mac_address: str | None
    service_address: str | None
    service_coordinates: dict[str, Any]
    site_id: str | None
    activation_date: datetime | None
    session_timeout: int | None
    idle_timeout: int | None
    simultaneous_use: int
    subscription_id: str | None = Field(
        None, description="Billing subscription created for this subscriber (metadata tracked)"
    )
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime | None


class SubscriberListResponse(BaseModel):
    """Paginated subscriber list."""

    items: list[SubscriberResponse]
    total: int

