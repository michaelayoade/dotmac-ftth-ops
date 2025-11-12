"""
GraphQL types for subscriber network profiles.

Provides types for viewing and managing subscriber-level network configuration
including VLANs, static IPs, Option 82 settings, and IPv6 assignments.
"""

from datetime import datetime
from enum import Enum

import strawberry


@strawberry.enum
class IPv6AssignmentModeEnum(str, Enum):
    """IPv6 allocation strategy."""

    NONE = "none"
    SLAAC = "slaac"
    STATEFUL = "stateful"
    PD = "pd"
    DUAL_STACK = "dual_stack"


@strawberry.enum
class Option82PolicyEnum(str, Enum):
    """DHCP Option 82 enforcement policy."""

    ENFORCE = "enforce"
    LOG = "log"
    IGNORE = "ignore"


@strawberry.type
class NetworkProfile:
    """Subscriber network configuration profile."""

    id: str
    subscriber_id: str
    tenant_id: str

    # Option 82 / Circuit Binding
    circuit_id: str | None
    remote_id: str | None
    option82_policy: Option82PolicyEnum

    # VLAN Configuration
    service_vlan: int | None
    inner_vlan: int | None
    vlan_pool: str | None
    qinq_enabled: bool

    # IP Addressing
    static_ipv4: str | None
    static_ipv6: str | None
    delegated_ipv6_prefix: str | None
    ipv6_pd_size: int | None
    ipv6_assignment_mode: IPv6AssignmentModeEnum

    # Metadata
    metadata: strawberry.scalars.JSON | None
    created_at: datetime | None
    updated_at: datetime | None


@strawberry.input
class NetworkProfileInput:
    """Input for creating/updating network profiles."""

    circuit_id: str | None = None
    remote_id: str | None = None
    service_vlan: int | None = None
    inner_vlan: int | None = None
    vlan_pool: str | None = None
    qinq_enabled: bool | None = None
    static_ipv4: str | None = None
    static_ipv6: str | None = None
    delegated_ipv6_prefix: str | None = None
    ipv6_pd_size: int | None = None
    ipv6_assignment_mode: IPv6AssignmentModeEnum | None = None
    option82_policy: Option82PolicyEnum | None = None
    metadata: strawberry.scalars.JSON | None = None


@strawberry.type
class NetworkProfileStats:
    """Aggregated statistics for network profiles."""

    total_profiles: int
    profiles_with_static_ipv4: int
    profiles_with_static_ipv6: int
    profiles_with_vlans: int
    profiles_with_qinq: int
    profiles_with_option82: int
    option82_enforce_count: int
    option82_log_count: int
    option82_ignore_count: int


@strawberry.type
class Option82Alert:
    """Alert for Option 82 mismatch or violations."""

    id: str
    subscriber_id: str
    subscriber_username: str | None
    severity: str
    alert_type: str
    message: str
    expected_circuit_id: str | None
    actual_circuit_id: str | None
    expected_remote_id: str | None
    actual_remote_id: str | None
    triggered_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    is_active: bool
