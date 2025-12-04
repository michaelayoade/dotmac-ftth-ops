"""
GraphQL types for IP management operations.
"""

from datetime import datetime
from enum import Enum

import strawberry

# ============================================================================
# Enums
# ============================================================================


@strawberry.enum
class IPPoolTypeEnum(str, Enum):
    """IP pool type."""

    IPV4_PUBLIC = "ipv4_public"
    IPV4_PRIVATE = "ipv4_private"
    IPV6_GLOBAL = "ipv6_global"
    IPV6_ULA = "ipv6_ula"
    IPV6_PREFIX_DELEGATION = "ipv6_pd"


@strawberry.enum
class IPPoolStatusEnum(str, Enum):
    """IP pool status."""

    ACTIVE = "active"
    DEPLETED = "depleted"
    RESERVED = "reserved"
    DEPRECATED = "deprecated"


@strawberry.enum
class IPReservationStatusEnum(str, Enum):
    """IP reservation status."""

    RESERVED = "reserved"
    ASSIGNED = "assigned"
    RELEASED = "released"
    EXPIRED = "expired"


# ============================================================================
# IP Pool Types
# ============================================================================


@strawberry.type
class IPPool:
    """IP address pool for static IP allocation."""

    id: str
    tenant_id: str
    pool_name: str
    pool_type: IPPoolTypeEnum
    network_cidr: str
    gateway: str | None
    dns_servers: str | None
    vlan_id: int | None
    status: IPPoolStatusEnum
    total_addresses: int
    reserved_count: int
    assigned_count: int
    available_count: int
    utilization_percent: float
    netbox_prefix_id: int | None
    netbox_synced_at: datetime | None
    auto_assign_enabled: bool
    allow_manual_reservation: bool
    description: str | None
    created_at: datetime
    updated_at: datetime


@strawberry.input
class IPPoolCreateInput:
    """Input for creating an IP pool."""

    pool_name: str
    pool_type: IPPoolTypeEnum
    network_cidr: str
    gateway: str | None = None
    dns_servers: str | None = None
    vlan_id: int | None = None
    description: str | None = None
    auto_assign_enabled: bool = True
    allow_manual_reservation: bool = True


@strawberry.input
class IPPoolUpdateInput:
    """Input for updating an IP pool."""

    pool_name: str | None = None
    status: IPPoolStatusEnum | None = None
    gateway: str | None = None
    dns_servers: str | None = None
    vlan_id: int | None = None
    description: str | None = None
    auto_assign_enabled: bool | None = None
    allow_manual_reservation: bool | None = None


@strawberry.type
class IPAvailability:
    """IP availability information."""

    available_ip: str | None
    pool_id: str
    total_available: int


# ============================================================================
# IP Reservation Types
# ============================================================================


@strawberry.type
class IPReservation:
    """IP address reservation."""

    id: str
    tenant_id: str
    pool_id: str
    subscriber_id: str | None
    ip_address: str
    ip_type: str
    prefix_length: int | None
    status: IPReservationStatusEnum
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


@strawberry.input
class IPReservationCreateInput:
    """Input for creating an IP reservation (manual)."""

    subscriber_id: str
    pool_id: str
    ip_address: str
    ip_type: str = "ipv4"
    prefix_length: int | None = None
    assignment_reason: str | None = None
    notes: str | None = None


@strawberry.input
class IPReservationAutoAssignInput:
    """Input for auto-assigning an IP."""

    subscriber_id: str
    pool_id: str
    ip_type: str = "ipv4"
    assignment_reason: str | None = None


# ============================================================================
# Conflict Detection Types
# ============================================================================


@strawberry.type
class IPConflict:
    """IP address conflict details."""

    type: str
    reservation_id: str | None = None
    subscriber_id: str | None = None
    status: str | None = None
    assigned_at: datetime | None = None


@strawberry.type
class IPConflictResult:
    """Result of IP conflict check."""

    has_conflict: bool
    ip_address: str
    conflicts: list[str]  # JSON-encoded conflict details


@strawberry.input
class IPConflictCheckInput:
    """Input for checking IP conflicts."""

    ip_address: str
    pool_id: str | None = None


# ============================================================================
# Statistics Types
# ============================================================================


@strawberry.type
class IPPoolStats:
    """Statistics for an IP pool."""

    pool_id: str
    pool_name: str
    total_addresses: int
    reserved_count: int
    assigned_count: int
    available_count: int
    utilization_percent: float
    status: IPPoolStatusEnum


@strawberry.type
class TenantIPStats:
    """Tenant-wide IP statistics."""

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
