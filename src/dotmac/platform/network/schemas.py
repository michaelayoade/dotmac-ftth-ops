"""
Pydantic schemas for subscriber network profiles.
"""

from __future__ import annotations

from datetime import datetime
from ipaddress import IPv4Address, IPv6Address
from typing import Any
from uuid import UUID

try:
    from pydantic import ConfigDict, Field, field_serializer  # type: ignore[attr-defined]
except ImportError:  # pragma: no cover - Pydantic v1 fallback
    from pydantic import ConfigDict, Field  # type: ignore

    def field_serializer(*_args, **_kwargs):  # type: ignore
        def decorator(func):
            return func

        return decorator


from dotmac.platform.core.ip_validation import validate_ip_network
from dotmac.platform.core.pydantic import AppBaseModel
from dotmac.platform.network.lifecycle_protocol import LifecycleState
from dotmac.platform.network.models import IPv6AssignmentMode, IPv6LifecycleState, Option82Policy


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase."""
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class NetworkProfileBase(AppBaseModel):  # type: ignore[misc]
    """Shared fields between create/update payloads."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    circuit_id: str | None = Field(None, max_length=255)
    remote_id: str | None = Field(None, max_length=255)

    service_vlan: int | None = Field(None, ge=1, le=4094)
    inner_vlan: int | None = Field(None, ge=1, le=4094)
    vlan_pool: str | None = Field(None, max_length=100)
    qinq_enabled: bool | None = None

    static_ipv4: IPv4Address | None = None
    static_ipv6: IPv6Address | None = None
    delegated_ipv6_prefix: str | None = Field(
        default=None,
        description="IPv6 prefix in CIDR notation (e.g., 2001:db8::/56)",
    )
    ipv6_pd_size: int | None = Field(None, ge=0, le=128)
    ipv6_assignment_mode: IPv6AssignmentMode | None = None

    option82_policy: Option82Policy | None = None
    metadata: dict[str, Any] | None = Field(
        default=None,
        validation_alias="metadata_",
        serialization_alias="metadata",
    )

    @staticmethod
    def _validate_prefix(value: str | None) -> str | None:
        if value is None:
            return None
        validate_ip_network(value)
        return value

    @classmethod
    def _normalize_metadata(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        return dict(value.items())


class NetworkProfileUpdate(NetworkProfileBase):  # type: ignore[misc]
    """Update payload."""

    delegated_ipv6_prefix: str | None = Field(
        default=None,
        description="IPv6 prefix in CIDR notation (e.g., 2001:db8::/56)",
    )

    @property
    def normalized_metadata(self) -> dict[str, Any] | None:
        return self._normalize_metadata(self.metadata)

    def validated_prefix(self) -> str | None:
        return self._validate_prefix(self.delegated_ipv6_prefix)


class NetworkProfileResponse(NetworkProfileBase):  # type: ignore[misc]
    """Response schema that includes database identifiers."""

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    id: str | UUID
    subscriber_id: str
    tenant_id: str
    option82_policy: Option82Policy
    ipv6_assignment_mode: IPv6AssignmentMode

    @field_serializer("id")
    def serialize_id(self, value: str | UUID) -> str:
        """Convert UUID to string if needed."""
        return str(value) if isinstance(value, UUID) else value

    @field_serializer("static_ipv4", "static_ipv6")
    def serialize_ip_addresses(self, value: IPv4Address | IPv6Address | str | None) -> str | None:
        """Convert IP address objects to strings for serialization."""
        if value is None:
            return None
        return str(value)


# Phase 4: IPv6 Lifecycle API Schemas


class IPv6AllocationRequest(AppBaseModel):  # type: ignore[misc]
    """Request schema for IPv6 prefix allocation."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    prefix_size: int = Field(
        default=56, ge=48, le=64, description="Prefix size in bits (e.g., 56 for /56)"
    )
    netbox_pool_id: int | None = Field(None, description="NetBox parent prefix ID")


class IPv6ActivationRequest(AppBaseModel):  # type: ignore[misc]
    """Request schema for IPv6 prefix activation."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    username: str | None = Field(None, description="RADIUS username for CoA")
    nas_ip: str | None = Field(None, description="NAS IP address for CoA routing")
    send_coa: bool = Field(default=False, description="Send RADIUS CoA to update active session")


class IPv6RevocationRequest(AppBaseModel):  # type: ignore[misc]
    """Request schema for IPv6 prefix revocation."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    username: str | None = Field(None, description="RADIUS username for disconnect")
    nas_ip: str | None = Field(None, description="NAS IP address for disconnect routing")
    send_disconnect: bool = Field(default=False, description="Send RADIUS Disconnect-Request")
    release_to_netbox: bool = Field(default=True, description="Release prefix back to NetBox")


class IPv6LifecycleStatusResponse(AppBaseModel):  # type: ignore[misc]
    """Response schema for IPv6 lifecycle status."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    subscriber_id: str
    prefix: str | None = Field(None, description="Delegated IPv6 prefix in CIDR notation")
    prefix_size: int | None = Field(None, description="Prefix size in bits")
    state: IPv6LifecycleState = Field(..., description="Current lifecycle state")
    allocated_at: datetime | None = Field(None, description="Allocation timestamp")
    activated_at: datetime | None = Field(None, description="Activation timestamp")
    revoked_at: datetime | None = Field(None, description="Revocation timestamp")
    netbox_prefix_id: int | None = Field(None, description="NetBox prefix ID")
    assignment_mode: IPv6AssignmentMode = Field(..., description="IPv6 assignment mode")


class IPv6OperationResponse(AppBaseModel):  # type: ignore[misc]
    """Response schema for IPv6 lifecycle operations."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    success: bool = Field(..., description="Whether the operation succeeded")
    message: str | None = Field(None, description="Human-readable result message")
    prefix: str | None = Field(None, description="IPv6 prefix")
    state: IPv6LifecycleState = Field(..., description="Current lifecycle state")
    allocated_at: datetime | None = None
    activated_at: datetime | None = None
    revoked_at: datetime | None = None
    netbox_prefix_id: int | None = None
    coa_result: dict[str, Any] | None = Field(None, description="RADIUS CoA result if sent")
    disconnect_result: dict[str, Any] | None = Field(
        None, description="RADIUS disconnect result if sent"
    )


class NetworkProfileStatsResponse(AppBaseModel):  # type: ignore[misc]
    """Aggregate statistics for network profiles in the tenant."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    total_profiles: int = Field(..., description="Total number of network profiles")
    profiles_with_static_ipv4: int = Field(..., description="Profiles with static IPv4 addresses")
    profiles_with_static_ipv6: int = Field(..., description="Profiles with static IPv6 addresses")
    profiles_with_vlans: int = Field(..., description="Profiles with VLAN configuration")
    profiles_with_qinq: int = Field(..., description="Profiles using 802.1ad QinQ")
    profiles_with_option82: int = Field(..., description="Profiles with DHCP Option 82 bindings")
    option82_enforce_count: int = Field(..., description="Profiles with enforce policy")
    option82_log_count: int = Field(..., description="Profiles with log policy")
    option82_ignore_count: int = Field(..., description="Profiles with ignore policy")
    # Dual-stack and NetBox integration
    dual_stack_profiles: int = Field(..., description="Profiles with both IPv4 and IPv6 addresses")
    netbox_tracked_profiles: int = Field(..., description="Profiles tracked in NetBox IPAM")
    # IPv6 lifecycle state tracking
    ipv6_allocated: int = Field(..., description="IPv6 prefixes allocated but not yet active")
    ipv6_active: int = Field(..., description="IPv6 prefixes currently active")
    ipv6_suspended: int = Field(..., description="IPv6 prefixes suspended")
    ipv6_revoked: int = Field(..., description="IPv6 prefixes revoked and returned to pool")


class IPv6LifecycleStatsResponse(AppBaseModel):  # type: ignore[misc]
    """IPv6 lifecycle utilization and NetBox integration statistics."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    # State counts
    state_counts: dict[str, int] = Field(..., description="Count of prefixes by lifecycle state")

    # Utilization metrics
    utilization: dict[str, Any] = Field(
        ...,
        description="IPv6 utilization metrics (total, active, allocated, revoked, utilization_rate)",
    )

    # NetBox integration
    netbox_integration: dict[str, Any] = Field(
        ..., description="NetBox integration statistics (tracking rate, sync status)"
    )


# Phase 5: IPv4 Lifecycle API Schemas


class IPv4AllocationRequest(AppBaseModel):  # type: ignore[misc]
    """Request schema for IPv4 address allocation."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    pool_id: UUID | None = Field(None, description="IP pool ID to allocate from")
    requested_address: str | None = Field(None, description="Specific IPv4 address to request")


class IPv4ActivationRequest(AppBaseModel):  # type: ignore[misc]
    """Request schema for IPv4 address activation."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    username: str | None = Field(None, description="RADIUS username for CoA")
    nas_ip: str | None = Field(None, description="NAS IP address for CoA routing")
    send_coa: bool = Field(default=False, description="Send RADIUS CoA to update active session")
    update_netbox: bool = Field(default=True, description="Update NetBox IPAM status")


class IPv4SuspensionRequest(AppBaseModel):  # type: ignore[misc]
    """Request schema for IPv4 address suspension."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    username: str | None = Field(None, description="RADIUS username for CoA")
    nas_ip: str | None = Field(None, description="NAS IP address for CoA routing")
    send_coa: bool = Field(default=True, description="Send RADIUS CoA to limit session")
    reason: str | None = Field(None, max_length=500, description="Suspension reason")


class IPv4RevocationRequest(AppBaseModel):  # type: ignore[misc]
    """Request schema for IPv4 address revocation."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    username: str | None = Field(None, description="RADIUS username for disconnect")
    nas_ip: str | None = Field(None, description="NAS IP address for disconnect routing")
    send_disconnect: bool = Field(default=True, description="Send RADIUS Disconnect-Request")
    release_to_pool: bool = Field(default=True, description="Release address back to pool")
    update_netbox: bool = Field(default=True, description="Update/delete NetBox IPAM record")


class IPv4LifecycleStatusResponse(AppBaseModel):  # type: ignore[misc]
    """Response schema for IPv4 lifecycle status."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    subscriber_id: str
    address: str | None = Field(None, description="IPv4 address")
    state: LifecycleState = Field(..., description="Current lifecycle state")
    allocated_at: datetime | None = Field(None, description="Allocation timestamp")
    activated_at: datetime | None = Field(None, description="Activation timestamp")
    suspended_at: datetime | None = Field(None, description="Suspension timestamp")
    revoked_at: datetime | None = Field(None, description="Revocation timestamp")
    netbox_ip_id: int | None = Field(None, description="NetBox IP address ID")
    metadata: dict[str, Any] | None = Field(None, description="Lifecycle metadata")


class IPv4OperationResponse(AppBaseModel):  # type: ignore[misc]
    """Response schema for IPv4 lifecycle operations."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    success: bool = Field(..., description="Whether the operation succeeded")
    message: str | None = Field(None, description="Human-readable result message")
    address: str | None = Field(None, description="IPv4 address")
    state: LifecycleState = Field(..., description="Current lifecycle state")
    allocated_at: datetime | None = None
    activated_at: datetime | None = None
    suspended_at: datetime | None = None
    revoked_at: datetime | None = None
    netbox_ip_id: int | None = None
    coa_result: dict[str, Any] | None = Field(None, description="RADIUS CoA result if sent")
    disconnect_result: dict[str, Any] | None = Field(
        None, description="RADIUS disconnect result if sent"
    )
    metadata: dict[str, Any] | None = Field(None, description="Lifecycle metadata")


class IPv4LifecycleStatsResponse(AppBaseModel):  # type: ignore[misc]
    """IPv4 lifecycle utilization and pool statistics."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        alias_generator=to_camel,
        populate_by_name=True,
    )

    # State counts
    state_counts: dict[str, int] = Field(..., description="Count of addresses by lifecycle state")

    # Utilization metrics
    utilization: dict[str, Any] = Field(
        ...,
        description="IPv4 utilization metrics (total, active, allocated, revoked, utilization_rate)",
    )

    # Pool statistics
    pool_utilization: dict[str, Any] = Field(
        ...,
        description="IPv4 pool utilization statistics (pool_count, addresses_per_pool, exhaustion_risk)",
    )

    # NetBox integration
    netbox_integration: dict[str, Any] = Field(
        ..., description="NetBox integration statistics (tracking rate, sync status)"
    )
