"""
Shared Address Lifecycle Management Protocol (Phase 5).

Defines the common interface for IPv4 and IPv6 lifecycle management,
allowing unified orchestration and tooling across both protocol stacks.
"""

from __future__ import annotations

from abc import abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any, Protocol
from uuid import UUID

import structlog

logger = structlog.get_logger(__name__)


# =============================================================================
# Shared Enums
# =============================================================================


class LifecycleState(str, Enum):
    """
    Common lifecycle states for IP address allocations (IPv4 and IPv6).

    State Machine:
        PENDING -> ALLOCATED -> ACTIVE -> SUSPENDED -> ACTIVE (reactivate)
                                    |
                                    v
                            REVOKING -> REVOKED
                                    |
                                    v
                                 FAILED
    """

    PENDING = "pending"  # Initial state, no allocation yet
    ALLOCATED = "allocated"  # IP/prefix reserved from pool but not active
    ACTIVE = "active"  # IP/prefix actively in use by subscriber
    SUSPENDED = "suspended"  # Temporarily suspended (service pause)
    REVOKING = "revoking"  # In process of being revoked
    REVOKED = "revoked"  # Permanently released back to pool
    FAILED = "failed"  # Lifecycle operation failed


# Valid state transitions
VALID_TRANSITIONS: dict[LifecycleState, set[LifecycleState]] = {
    LifecycleState.PENDING: {LifecycleState.ALLOCATED, LifecycleState.FAILED},
    LifecycleState.ALLOCATED: {
        LifecycleState.ACTIVE,
        LifecycleState.FAILED,
        LifecycleState.REVOKING,
    },
    LifecycleState.ACTIVE: {
        LifecycleState.SUSPENDED,
        LifecycleState.REVOKING,
        LifecycleState.FAILED,
    },
    LifecycleState.SUSPENDED: {
        LifecycleState.ACTIVE,  # Reactivation
        LifecycleState.REVOKING,
        LifecycleState.FAILED,
    },
    LifecycleState.REVOKING: {LifecycleState.REVOKED, LifecycleState.FAILED},
    LifecycleState.REVOKED: set(),  # Terminal state
    LifecycleState.FAILED: {LifecycleState.PENDING},  # Can retry from failed
}


# =============================================================================
# Shared Exceptions
# =============================================================================


class LifecycleError(Exception):
    """Base exception for lifecycle management errors."""

    pass


class InvalidTransitionError(LifecycleError):
    """Raised when attempting an invalid lifecycle state transition."""

    def __init__(
        self,
        current_state: LifecycleState,
        target_state: LifecycleState,
        message: str | None = None,
    ):
        self.current_state = current_state
        self.target_state = target_state
        msg = message or (f"Invalid transition from {current_state.value} to {target_state.value}")
        super().__init__(msg)


class AllocationError(LifecycleError):
    """Raised when IP/prefix allocation fails."""

    pass


class ActivationError(LifecycleError):
    """Raised when activation fails (NetBox/RADIUS/DHCP errors)."""

    pass


class RevocationError(LifecycleError):
    """Raised when revocation fails."""

    pass


class ReactivationError(LifecycleError):
    """Raised when reactivation fails."""

    pass


# =============================================================================
# Lifecycle Response Models
# =============================================================================


class LifecycleResult:
    """
    Common result object returned by lifecycle operations.

    Provides a unified response format for both IPv4 and IPv6 operations.
    """

    def __init__(
        self,
        success: bool,
        state: LifecycleState,
        address: str | None = None,
        subscriber_id: UUID | None = None,
        tenant_id: str | None = None,
        allocated_at: datetime | None = None,
        activated_at: datetime | None = None,
        suspended_at: datetime | None = None,
        revoked_at: datetime | None = None,
        metadata: dict[str, Any] | None = None,
        error: str | None = None,
        netbox_ip_id: int | None = None,
        coa_result: dict[str, Any] | None = None,
        disconnect_result: dict[str, Any] | None = None,
    ):
        self.success = success
        self.state = state
        self.address = address
        self.subscriber_id = subscriber_id
        self.tenant_id = tenant_id
        self.allocated_at = allocated_at
        self.activated_at = activated_at
        self.suspended_at = suspended_at
        self.revoked_at = revoked_at
        self.metadata = metadata or {}
        self.error = error
        self.netbox_ip_id = netbox_ip_id
        self.coa_result = coa_result
        self.disconnect_result = disconnect_result

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "success": self.success,
            "state": self.state.value,
            "address": self.address,
            "subscriber_id": str(self.subscriber_id) if self.subscriber_id else None,
            "tenant_id": self.tenant_id,
            "allocated_at": self.allocated_at.isoformat() if self.allocated_at else None,
            "activated_at": self.activated_at.isoformat() if self.activated_at else None,
            "suspended_at": self.suspended_at.isoformat() if self.suspended_at else None,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
            "metadata": self.metadata,
            "error": self.error,
        }

    def __repr__(self) -> str:
        return (
            f"LifecycleResult(success={self.success}, state={self.state.value}, "
            f"address={self.address})"
        )


# =============================================================================
# Address Lifecycle Service Protocol
# =============================================================================


class AddressLifecycleService(Protocol):
    """
    Protocol defining the common interface for IP address lifecycle management.

    Both IPv4LifecycleService and IPv6LifecycleService implement this protocol,
    allowing unified orchestration workflows and tooling.

    Implementation Notes:
    - IPv4 operates on individual addresses from ip_reservations
    - IPv6 operates on delegated prefixes in subscriber_network_profile
    - Both follow the same state machine: PENDING -> ALLOCATED -> ACTIVE ->
      SUSPENDED <-> ACTIVE -> REVOKING -> REVOKED
    """

    @abstractmethod
    async def allocate(
        self,
        subscriber_id: UUID,
        *,
        pool_id: UUID | None = None,
        requested_address: str | None = None,
        metadata: dict[str, Any] | None = None,
        commit: bool = True,
    ) -> LifecycleResult:
        """
        Allocate an IP address or prefix from the pool.

        Transitions: PENDING -> ALLOCATED

        Args:
            subscriber_id: Subscriber to allocate address for
            pool_id: Optional specific pool to allocate from
            requested_address: Optional specific address to allocate
            metadata: Optional metadata to store with allocation
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with allocated address and state

        Raises:
            AllocationError: If allocation fails
            InvalidTransitionError: If current state doesn't allow allocation
        """
        ...

    @abstractmethod
    async def activate(
        self,
        subscriber_id: UUID,
        *,
        username: str | None = None,
        nas_ip: str | None = None,
        send_coa: bool = False,
        update_netbox: bool = True,
        metadata: dict[str, Any] | None = None,
        commit: bool = True,
    ) -> LifecycleResult:
        """
        Activate an allocated IP address or prefix.

        Transitions: ALLOCATED -> ACTIVE

        Args:
            subscriber_id: Subscriber to activate address for
            username: RADIUS username for CoA (if applicable)
            nas_ip: NAS IP address for CoA (if applicable)
            send_coa: Whether to send RADIUS CoA packet
            update_netbox: Whether to update NetBox records
            metadata: Optional metadata to update
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with activated state

        Raises:
            ActivationError: If activation fails
            InvalidTransitionError: If current state doesn't allow activation
        """
        ...

    @abstractmethod
    async def suspend(
        self,
        subscriber_id: UUID,
        *,
        username: str | None = None,
        nas_ip: str | None = None,
        send_coa: bool = True,
        reason: str | None = None,
        metadata: dict[str, Any] | None = None,
        commit: bool = True,
    ) -> LifecycleResult:
        """
        Suspend an active IP address or prefix.

        Transitions: ACTIVE -> SUSPENDED

        Args:
            subscriber_id: Subscriber to suspend address for
            username: RADIUS username for CoA
            nas_ip: NAS IP address for CoA
            send_coa: Whether to send RADIUS CoA packet
            reason: Reason for suspension
            metadata: Optional metadata to update
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with suspended state

        Raises:
            LifecycleError: If suspension fails
            InvalidTransitionError: If current state doesn't allow suspension
        """
        ...

    @abstractmethod
    async def revoke(
        self,
        subscriber_id: UUID,
        *,
        username: str | None = None,
        nas_ip: str | None = None,
        send_disconnect: bool = True,
        release_to_pool: bool = True,
        update_netbox: bool = True,
        metadata: dict[str, Any] | None = None,
        commit: bool = True,
    ) -> LifecycleResult:
        """
        Revoke an IP address or prefix and release back to pool.

        Transitions: ACTIVE/SUSPENDED -> REVOKING -> REVOKED

        Args:
            subscriber_id: Subscriber to revoke address from
            username: RADIUS username for disconnect
            nas_ip: NAS IP address for disconnect
            send_disconnect: Whether to send RADIUS disconnect
            release_to_pool: Whether to release address back to pool
            update_netbox: Whether to update NetBox records
            metadata: Optional metadata to update
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with revoked state

        Raises:
            RevocationError: If revocation fails
            InvalidTransitionError: If current state doesn't allow revocation
        """
        ...

    @abstractmethod
    async def reactivate(
        self,
        subscriber_id: UUID,
        *,
        username: str | None = None,
        nas_ip: str | None = None,
        send_coa: bool = True,
        metadata: dict[str, Any] | None = None,
        commit: bool = True,
    ) -> LifecycleResult:
        """
        Reactivate a suspended IP address or prefix.

        Transitions: SUSPENDED -> ACTIVE

        Args:
            subscriber_id: Subscriber to reactivate address for
            username: RADIUS username for CoA
            nas_ip: NAS IP address for CoA
            send_coa: Whether to send RADIUS CoA packet
            metadata: Optional metadata to update
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with active state

        Raises:
            ReactivationError: If reactivation fails
            InvalidTransitionError: If current state doesn't allow reactivation
        """
        ...

    @abstractmethod
    async def get_state(
        self,
        subscriber_id: UUID,
    ) -> LifecycleResult | None:
        """
        Get current lifecycle state for a subscriber's address.

        Args:
            subscriber_id: Subscriber to query

        Returns:
            LifecycleResult with current state, or None if no allocation exists
        """
        ...

    @abstractmethod
    def validate_transition(
        self, current_state: LifecycleState, target_state: LifecycleState
    ) -> bool:
        """
        Validate if a state transition is allowed.

        Args:
            current_state: Current lifecycle state
            target_state: Desired target state

        Returns:
            True if transition is valid, False otherwise
        """
        ...


# =============================================================================
# Shared Utility Functions
# =============================================================================


def validate_lifecycle_transition(
    current_state: LifecycleState,
    target_state: LifecycleState,
    *,
    raise_on_invalid: bool = True,
) -> bool:
    """
    Validate a lifecycle state transition.

    Args:
        current_state: Current state
        target_state: Desired target state
        raise_on_invalid: Whether to raise exception on invalid transition

    Returns:
        True if valid, False otherwise

    Raises:
        InvalidTransitionError: If transition is invalid and raise_on_invalid=True
    """
    valid = target_state in VALID_TRANSITIONS.get(current_state, set())

    if not valid and raise_on_invalid:
        raise InvalidTransitionError(current_state, target_state)

    return valid


def get_allowed_transitions(state: LifecycleState) -> set[LifecycleState]:
    """
    Get all allowed transitions from a given state.

    Args:
        state: Current lifecycle state

    Returns:
        Set of allowed target states
    """
    return VALID_TRANSITIONS.get(state, set())


def is_terminal_state(state: LifecycleState) -> bool:
    """
    Check if a state is terminal (no further transitions allowed).

    Args:
        state: Lifecycle state to check

    Returns:
        True if terminal, False otherwise
    """
    return len(VALID_TRANSITIONS.get(state, set())) == 0
