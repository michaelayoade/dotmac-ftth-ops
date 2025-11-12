"""
Pydantic schemas for IP management API.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

try:
    from pydantic import ConfigDict, Field, field_serializer  # type: ignore[attr-defined]
except ImportError:  # pragma: no cover - Pydantic v1 fallback
    from pydantic import ConfigDict, Field  # type: ignore

    def field_serializer(*_args, **_kwargs):  # type: ignore
        def decorator(func):
            return func

        return decorator


from dotmac.platform.core.pydantic import AppBaseModel
from dotmac.platform.ip_management.models import (
    IPPoolStatus,
    IPPoolType,
    IPReservationStatus,
)


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase."""
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


# ============================================================================
# IP Pool Schemas
# ============================================================================


class IPPoolCreate(AppBaseModel):  # type: ignore[misc]
    """Schema for creating an IP pool."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    pool_name: str = Field(..., min_length=1, max_length=100)
    pool_type: IPPoolType
    network_cidr: str = Field(..., min_length=1, max_length=64)
    gateway: str | None = Field(None, max_length=64)
    dns_servers: str | None = Field(None, max_length=500)
    vlan_id: int | None = Field(None, ge=1, le=4094)
    description: str | None = None
    auto_assign_enabled: bool = True
    allow_manual_reservation: bool = True


class IPPoolUpdate(AppBaseModel):  # type: ignore[misc]
    """Schema for updating an IP pool."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    pool_name: str | None = Field(None, min_length=1, max_length=100)
    status: IPPoolStatus | None = None
    gateway: str | None = Field(None, max_length=64)
    dns_servers: str | None = Field(None, max_length=500)
    vlan_id: int | None = Field(None, ge=1, le=4094)
    description: str | None = None
    auto_assign_enabled: bool | None = None
    allow_manual_reservation: bool | None = None


class IPPoolResponse(AppBaseModel):  # type: ignore[misc]
    """Schema for IP pool response."""

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    id: str | UUID
    tenant_id: str
    pool_name: str
    pool_type: IPPoolType
    network_cidr: str
    gateway: str | None
    dns_servers: str | None
    vlan_id: int | None
    status: IPPoolStatus
    total_addresses: int
    reserved_count: int
    assigned_count: int
    available_count: int = 0
    utilization_percent: float = 0.0
    netbox_prefix_id: int | None
    netbox_synced_at: datetime | None
    auto_assign_enabled: bool
    allow_manual_reservation: bool
    description: str | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("id")
    def serialize_id(self, value: str | UUID) -> str:
        """Convert UUID to string."""
        return str(value) if isinstance(value, UUID) else value

    def model_post_init(self, __context: object) -> None:
        """Calculate derived fields after initialization."""
        # Calculate available count
        total = self.total_addresses
        used = self.reserved_count + self.assigned_count
        self.available_count = max(0, total - used)

        # Calculate utilization percentage
        if total > 0:
            self.utilization_percent = round((used / total) * 100, 2)


# ============================================================================
# IP Reservation Schemas
# ============================================================================


class IPReservationCreate(AppBaseModel):  # type: ignore[misc]
    """Schema for creating an IP reservation (manual)."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    subscriber_id: str = Field(..., min_length=1)
    pool_id: str = Field(..., min_length=1)
    ip_address: str = Field(..., min_length=1)
    ip_type: str = Field(default="ipv4", pattern="^(ipv4|ipv6|ipv6_prefix)$")
    prefix_length: int | None = Field(None, ge=1, le=128)
    assignment_reason: str | None = None
    notes: str | None = None


class IPReservationAutoAssign(AppBaseModel):  # type: ignore[misc]
    """Schema for auto-assigning an IP."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    subscriber_id: str = Field(..., min_length=1)
    pool_id: str = Field(..., min_length=1)
    ip_type: str = Field(default="ipv4", pattern="^(ipv4|ipv6|ipv6_prefix)$")
    assignment_reason: str | None = None


class IPReservationUpdate(AppBaseModel):  # type: ignore[misc]
    """Schema for updating an IP reservation."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    status: IPReservationStatus | None = None
    notes: str | None = None


class IPReservationResponse(AppBaseModel):  # type: ignore[misc]
    """Schema for IP reservation response."""

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    id: str | UUID
    tenant_id: str
    pool_id: str | UUID
    subscriber_id: str
    ip_address: str
    ip_type: str
    prefix_length: int | None
    status: IPReservationStatus
    reserved_at: datetime
    assigned_at: datetime | None
    released_at: datetime | None
    expires_at: datetime | None
    netbox_ip_id: int | None
    netbox_synced: bool
    assigned_by: str | None
    assignment_reason: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("id", "pool_id")
    def serialize_uuid(self, value: str | UUID) -> str:
        """Convert UUID to string."""
        return str(value) if isinstance(value, UUID) else value


# ============================================================================
# Conflict & Validation Schemas
# ============================================================================


class IPConflictCheck(AppBaseModel):  # type: ignore[misc]
    """Schema for checking IP conflicts."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    ip_address: str = Field(..., min_length=1)
    pool_id: str | None = None


class IPConflictResult(AppBaseModel):  # type: ignore[misc]
    """Schema for conflict check result."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    has_conflict: bool
    ip_address: str
    conflicts: list[dict]


class IPAvailabilityResponse(AppBaseModel):  # type: ignore[misc]
    """Schema for IP availability response."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    available_ip: str | None
    pool_id: str
    total_available: int


# ============================================================================
# Statistics Schemas
# ============================================================================


class IPPoolStats(AppBaseModel):  # type: ignore[misc]
    """Schema for IP pool statistics."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    pool_id: str
    pool_name: str
    total_addresses: int
    reserved_count: int
    assigned_count: int
    available_count: int
    utilization_percent: float
    status: IPPoolStatus


class TenantIPStats(AppBaseModel):  # type: ignore[misc]
    """Schema for tenant-wide IP statistics."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    tenant_id: str
    total_pools: int
    active_pools: int
    depleted_pools: int
    total_ips: int
    reserved_ips: int
    assigned_ips: int
    available_ips: int
    utilization_percent: float
    ipv4_pools: int
    ipv6_pools: int
