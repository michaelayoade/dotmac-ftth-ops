"""
GraphQL types for IPv4 address lifecycle management.

Phase 5: Provides types for managing IPv4 address lifecycle states
across allocation, activation, suspension, and revocation.
"""

from datetime import datetime
from enum import Enum

import strawberry


@strawberry.enum
class LifecycleStateEnum(str, Enum):
    """IPv4 address lifecycle states."""

    PENDING = "pending"
    ALLOCATED = "allocated"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    REVOKING = "revoking"
    REVOKED = "revoked"
    FAILED = "failed"


@strawberry.type
class IPv4LifecycleStatus:
    """IPv4 lifecycle status for a subscriber."""

    subscriber_id: str
    address: str | None
    state: LifecycleStateEnum
    allocated_at: datetime | None
    activated_at: datetime | None
    suspended_at: datetime | None
    revoked_at: datetime | None
    netbox_ip_id: int | None
    metadata: strawberry.scalars.JSON | None


@strawberry.type
class IPv4LifecycleOperation:
    """Result of an IPv4 lifecycle operation."""

    success: bool
    message: str | None
    address: str | None
    state: LifecycleStateEnum
    allocated_at: datetime | None
    activated_at: datetime | None
    suspended_at: datetime | None
    revoked_at: datetime | None
    netbox_ip_id: int | None
    coa_result: strawberry.scalars.JSON | None
    disconnect_result: strawberry.scalars.JSON | None
    metadata: strawberry.scalars.JSON | None


@strawberry.input
class IPv4AllocationInput:
    """Input for allocating IPv4 address."""

    pool_id: str | None = None
    requested_address: str | None = None


@strawberry.input
class IPv4ActivationInput:
    """Input for activating IPv4 address."""

    username: str | None = None
    nas_ip: str | None = None
    send_coa: bool = False
    update_netbox: bool = True


@strawberry.input
class IPv4SuspensionInput:
    """Input for suspending IPv4 address."""

    username: str | None = None
    nas_ip: str | None = None
    send_coa: bool = True
    reason: str | None = None


@strawberry.input
class IPv4RevocationInput:
    """Input for revoking IPv4 address."""

    username: str | None = None
    nas_ip: str | None = None
    send_disconnect: bool = True
    release_to_pool: bool = True
    update_netbox: bool = True


@strawberry.type
class IPv4LifecycleStats:
    """IPv4 lifecycle utilization statistics."""

    state_counts: strawberry.scalars.JSON
    utilization: strawberry.scalars.JSON
    pool_utilization: strawberry.scalars.JSON
    netbox_integration: strawberry.scalars.JSON
