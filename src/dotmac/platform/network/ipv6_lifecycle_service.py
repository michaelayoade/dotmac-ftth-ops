"""
IPv6 Lifecycle Management Service (Phase 4 + Phase 5 Refactor).

Implements the shared AddressLifecycleService protocol for IPv6 prefix management,
providing unified lifecycle operations alongside IPv4LifecycleService.

Refactored in Phase 5 to implement the common protocol while maintaining backward
compatibility with Phase 4 workflows.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Protocol
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.network.lifecycle_protocol import (
    ActivationError,
    AllocationError,
    LifecycleResult,
    LifecycleState,
    ReactivationError,
    RevocationError,
    validate_lifecycle_transition,
)
from dotmac.platform.network.models import (
    IPv6AssignmentMode,
    IPv6LifecycleState,
    SubscriberNetworkProfile,
)


class RadiusCoaClient(Protocol):
    """Protocol for RADIUS CoA client integration."""

    async def update_ipv6_prefix(
        self,
        *,
        username: str,
        delegated_prefix: str,
        nas_ip: str | None,
    ) -> Mapping[str, object]: ...

    async def disconnect_session(
        self,
        *,
        username: str,
        nas_ip: str | None,
    ) -> Mapping[str, object]: ...


if TYPE_CHECKING:
    from dotmac.platform.integrations.netbox.client import NetBoxClient

logger = structlog.get_logger(__name__)


# State mapping between old IPv6LifecycleState and new shared LifecycleState
def _map_to_lifecycle_state(ipv6_state: IPv6LifecycleState) -> LifecycleState:
    """Map IPv6LifecycleState to shared LifecycleState."""
    mapping = {
        IPv6LifecycleState.PENDING: LifecycleState.PENDING,
        IPv6LifecycleState.ALLOCATED: LifecycleState.ALLOCATED,
        IPv6LifecycleState.ACTIVE: LifecycleState.ACTIVE,
        IPv6LifecycleState.SUSPENDED: LifecycleState.SUSPENDED,
        IPv6LifecycleState.REVOKING: LifecycleState.REVOKING,
        IPv6LifecycleState.REVOKED: LifecycleState.REVOKED,
        IPv6LifecycleState.FAILED: LifecycleState.FAILED,
    }
    return mapping.get(ipv6_state, LifecycleState.PENDING)


def _map_to_ipv6_state(lifecycle_state: LifecycleState) -> IPv6LifecycleState:
    """Map shared LifecycleState to IPv6LifecycleState."""
    mapping = {
        LifecycleState.PENDING: IPv6LifecycleState.PENDING,
        LifecycleState.ALLOCATED: IPv6LifecycleState.ALLOCATED,
        LifecycleState.ACTIVE: IPv6LifecycleState.ACTIVE,
        LifecycleState.SUSPENDED: IPv6LifecycleState.SUSPENDED,
        LifecycleState.REVOKING: IPv6LifecycleState.REVOKING,
        LifecycleState.REVOKED: IPv6LifecycleState.REVOKED,
        LifecycleState.FAILED: IPv6LifecycleState.FAILED,
    }
    return mapping.get(lifecycle_state, IPv6LifecycleState.PENDING)


class IPv6LifecycleService:
    """
    Service for managing IPv6 prefix lifecycle operations.

    Implements AddressLifecycleService protocol for unified lifecycle management.

    Handles state transitions from allocation through activation to revocation,
    integrating with NetBox for IPAM operations and tracking lifecycle timestamps.
    """

    def __init__(
        self,
        session: AsyncSession,
        tenant_id: str,
        netbox_client: NetBoxClient | None = None,
        coa_client: RadiusCoaClient | None = None,
    ):
        self.session = session
        self.tenant_id = tenant_id
        self.netbox_client = netbox_client
        self.coa_client = coa_client
        self.logger = logger.bind(tenant_id=tenant_id)
        # Alias for protocol compatibility
        self.db = session

    async def get_profile(self, subscriber_id: str | UUID) -> SubscriberNetworkProfile | None:
        """Fetch network profile for a subscriber."""
        subscriber_id_str = str(subscriber_id)
        stmt = (
            select(SubscriberNetworkProfile)
            .where(
                SubscriberNetworkProfile.tenant_id == self.tenant_id,
                SubscriberNetworkProfile.subscriber_id == subscriber_id_str,
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    # ========================================================================
    # AddressLifecycleService Protocol Implementation (Phase 5)
    # ========================================================================

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
        Allocate an IPv6 prefix from NetBox for a subscriber.

        Transitions: PENDING -> ALLOCATED

        Args:
            subscriber_id: Subscriber UUID
            pool_id: NetBox pool/parent prefix ID (as UUID, converted to int internally)
            requested_address: Not used for IPv6 (prefix is auto-allocated)
            metadata: Optional metadata (e.g., prefix_size)
            commit: Whether to commit the transaction

        Returns:
            LifecycleResult with allocated prefix

        Raises:
            AllocationError: If allocation fails
            InvalidTransitionError: If current state doesn't allow allocation
        """
        prefix_size = metadata.get("prefix_size", 56) if metadata else 56
        netbox_pool_id = int(pool_id) if pool_id else None

        try:
            result_dict = await self.allocate_ipv6(
                subscriber_id=str(subscriber_id),
                prefix_size=prefix_size,
                netbox_pool_id=netbox_pool_id,
                commit=commit,
            )

            return LifecycleResult(
                success=True,
                state=_map_to_lifecycle_state(result_dict["state"]),  # type: ignore
                address=result_dict.get("prefix"),  # type: ignore
                subscriber_id=subscriber_id,
                tenant_id=self.tenant_id,
                allocated_at=result_dict.get("allocated_at"),  # type: ignore
                metadata={
                    "prefix_size": result_dict.get("prefix_size"),
                    "netbox_prefix_id": result_dict.get("netbox_prefix_id"),
                    **(metadata or {}),
                },
            )
        except Exception as e:
            self.logger.error(f"IPv6 allocation failed: {e}", exc_info=True)
            raise AllocationError(f"Failed to allocate IPv6 prefix: {e}") from e

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
        Mark IPv6 prefix as active after RADIUS provisioning.

        Transitions: ALLOCATED -> ACTIVE

        Args:
            subscriber_id: Subscriber UUID
            username: RADIUS username for CoA
            nas_ip: NAS IP address
            send_coa: Whether to send RADIUS CoA
            update_netbox: Not used for IPv6 (NetBox updated during allocation)
            metadata: Optional metadata
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with active state

        Raises:
            ActivationError: If activation fails
            InvalidTransitionError: If current state doesn't allow activation
        """
        try:
            result_dict = await self.activate_ipv6(
                subscriber_id=str(subscriber_id),
                username=username,
                nas_ip=nas_ip,
                send_coa=send_coa,
                commit=commit,
            )

            profile = await self.get_profile(subscriber_id)

            return LifecycleResult(
                success=True,
                state=_map_to_lifecycle_state(result_dict["state"]),  # type: ignore
                address=result_dict.get("prefix"),  # type: ignore
                subscriber_id=subscriber_id,
                tenant_id=self.tenant_id,
                allocated_at=profile.ipv6_allocated_at if profile else None,
                activated_at=result_dict.get("activated_at"),  # type: ignore
                metadata={
                    "coa_sent": "coa_result" in result_dict,
                    **(metadata or {}),
                },
            )
        except Exception as e:
            self.logger.error(f"IPv6 activation failed: {e}", exc_info=True)
            raise ActivationError(f"Failed to activate IPv6 prefix: {e}") from e

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
        Suspend IPv6 prefix (service suspended but reservation kept).

        Transitions: ACTIVE -> SUSPENDED

        Args:
            subscriber_id: Subscriber UUID
            username: RADIUS username (for future CoA support)
            nas_ip: NAS IP (for future CoA support)
            send_coa: Whether to send CoA (not yet implemented for suspend)
            reason: Suspension reason
            metadata: Optional metadata
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with suspended state

        Raises:
            InvalidTransitionError: If current state doesn't allow suspension
        """
        try:
            result_dict = await self.suspend_ipv6(
                subscriber_id=str(subscriber_id),
                commit=commit,
            )

            await self.get_profile(subscriber_id)

            return LifecycleResult(
                success=True,
                state=_map_to_lifecycle_state(result_dict["state"]),  # type: ignore
                address=result_dict.get("prefix"),  # type: ignore
                subscriber_id=subscriber_id,
                tenant_id=self.tenant_id,
                suspended_at=datetime.now(UTC),
                metadata={"reason": reason, **(metadata or {})},
            )
        except Exception as e:
            self.logger.error(f"IPv6 suspension failed: {e}", exc_info=True)
            raise

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
        Resume IPv6 prefix after suspension.

        Transitions: SUSPENDED -> ACTIVE

        Args:
            subscriber_id: Subscriber UUID
            username: RADIUS username (for future CoA)
            nas_ip: NAS IP (for future CoA)
            send_coa: Whether to send CoA
            metadata: Optional metadata
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with active state

        Raises:
            ReactivationError: If reactivation fails
            InvalidTransitionError: If current state doesn't allow reactivation
        """
        try:
            result_dict = await self.resume_ipv6(
                subscriber_id=str(subscriber_id),
                commit=commit,
            )

            profile = await self.get_profile(subscriber_id)

            return LifecycleResult(
                success=True,
                state=_map_to_lifecycle_state(result_dict["state"]),  # type: ignore
                address=result_dict.get("prefix"),  # type: ignore
                subscriber_id=subscriber_id,
                tenant_id=self.tenant_id,
                activated_at=profile.ipv6_activated_at if profile else None,
                metadata=metadata,
            )
        except Exception as e:
            self.logger.error(f"IPv6 reactivation failed: {e}", exc_info=True)
            raise ReactivationError(f"Failed to reactivate IPv6 prefix: {e}") from e

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
        Revoke IPv6 prefix and return to pool.

        Transitions: ANY -> REVOKING -> REVOKED

        Args:
            subscriber_id: Subscriber UUID
            username: RADIUS username for disconnect
            nas_ip: NAS IP address
            send_disconnect: Whether to send RADIUS disconnect
            release_to_pool: Whether to release prefix to NetBox
            update_netbox: Alias for release_to_pool
            metadata: Optional metadata
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with revoked state

        Raises:
            RevocationError: If revocation fails
        """
        try:
            result_dict = await self.revoke_ipv6(
                subscriber_id=str(subscriber_id),
                username=username,
                nas_ip=nas_ip,
                send_disconnect=send_disconnect,
                release_to_netbox=release_to_pool or update_netbox,
                commit=commit,
            )

            return LifecycleResult(
                success=True,
                state=_map_to_lifecycle_state(result_dict["state"]),  # type: ignore
                address=result_dict.get("prefix"),  # type: ignore
                subscriber_id=subscriber_id,
                tenant_id=self.tenant_id,
                revoked_at=result_dict.get("revoked_at"),  # type: ignore
                metadata={
                    "previous_state": str(result_dict.get("previous_state", "")),
                    "disconnect_sent": "disconnect_result" in result_dict,
                    **(metadata or {}),
                },
            )
        except Exception as e:
            self.logger.error(f"IPv6 revocation failed: {e}", exc_info=True)
            raise RevocationError(f"Failed to revoke IPv6 prefix: {e}") from e

    async def get_state(
        self,
        subscriber_id: UUID,
    ) -> LifecycleResult | None:
        """
        Get current lifecycle state for a subscriber's IPv6 prefix.

        Args:
            subscriber_id: Subscriber UUID

        Returns:
            LifecycleResult with current state, or None if no allocation
        """
        profile = await self.get_profile(subscriber_id)
        if not profile or not profile.delegated_ipv6_prefix:
            return None

        return LifecycleResult(
            success=True,
            state=_map_to_lifecycle_state(profile.ipv6_state),
            address=profile.delegated_ipv6_prefix,
            subscriber_id=subscriber_id,
            tenant_id=self.tenant_id,
            allocated_at=profile.ipv6_allocated_at,
            activated_at=profile.ipv6_activated_at,
            revoked_at=profile.ipv6_revoked_at,
            metadata={
                "prefix_size": profile.ipv6_pd_size,
                "netbox_prefix_id": profile.ipv6_netbox_prefix_id,
                "assignment_mode": str(profile.ipv6_assignment_mode),
            },
        )

    def validate_transition(
        self, current_state: LifecycleState, target_state: LifecycleState
    ) -> bool:
        """Validate if a state transition is allowed."""
        return validate_lifecycle_transition(current_state, target_state, raise_on_invalid=False)

    # ========================================================================
    # Original Phase 4 Methods (Backward Compatibility)
    # ========================================================================

    async def allocate_ipv6(
        self,
        subscriber_id: str,
        prefix_size: int = 56,
        *,
        netbox_pool_id: int | None = None,
        commit: bool = False,
    ) -> dict[str, object]:
        """
        Allocate an IPv6 prefix from NetBox for a subscriber.

        DEPRECATED: Use allocate() instead for protocol compliance.
        Maintained for backward compatibility with Phase 4 workflows.
        """
        profile = await self.get_profile(subscriber_id)
        if not profile:
            raise AllocationError(f"No network profile found for subscriber {subscriber_id}")

        # Validate state transition
        current_state = _map_to_lifecycle_state(profile.ipv6_state)
        validate_lifecycle_transition(current_state, LifecycleState.ALLOCATED)

        # Check if assignment mode requires prefix delegation
        if profile.ipv6_assignment_mode not in (
            IPv6AssignmentMode.PD,
            IPv6AssignmentMode.DUAL_STACK,
        ):
            raise AllocationError(
                f"IPv6 assignment mode {profile.ipv6_assignment_mode} "
                f"does not support prefix delegation"
            )

        allocated_prefix = None
        netbox_prefix_id = None

        # Allocate from NetBox if client is available
        if self.netbox_client:
            try:
                result = await self.netbox_client.allocate_ipv6_prefix(
                    tenant_id=self.tenant_id,
                    prefix_length=prefix_size,
                    parent_prefix_id=netbox_pool_id,
                    description=f"Subscriber {subscriber_id} IPv6 PD",
                )
                allocated_prefix = result["prefix"]
                netbox_prefix_id = result["id"]

                self.logger.info(
                    "ipv6.allocated_from_netbox",
                    subscriber_id=subscriber_id,
                    prefix=allocated_prefix,
                    netbox_prefix_id=netbox_prefix_id,
                    prefix_size=prefix_size,
                )
            except Exception as e:
                self.logger.error(
                    "ipv6.netbox_allocation_failed",
                    subscriber_id=subscriber_id,
                    error=str(e),
                    prefix_size=prefix_size,
                )
                profile.ipv6_state = IPv6LifecycleState.FAILED
                await self.session.flush()
                if commit:
                    await self.session.commit()
                raise AllocationError(f"NetBox allocation failed: {e}") from e
        else:
            # No NetBox client - use existing delegated prefix if available
            allocated_prefix = profile.delegated_ipv6_prefix
            if not allocated_prefix:
                raise AllocationError("No NetBox client available and no pre-configured prefix")

        # Update profile with allocation details
        profile.delegated_ipv6_prefix = allocated_prefix
        profile.ipv6_pd_size = prefix_size
        profile.ipv6_state = IPv6LifecycleState.ALLOCATED
        profile.ipv6_allocated_at = datetime.now(UTC)
        if netbox_prefix_id:
            profile.ipv6_netbox_prefix_id = netbox_prefix_id

        await self.session.flush()
        if commit:
            await self.session.commit()

        self.logger.info(
            "ipv6.lifecycle.allocated",
            subscriber_id=subscriber_id,
            prefix=allocated_prefix,
            state_transition="PENDING -> ALLOCATED",
            netbox_prefix_id=netbox_prefix_id,
        )

        return {
            "prefix": allocated_prefix,
            "prefix_size": prefix_size,
            "netbox_prefix_id": netbox_prefix_id,
            "state": IPv6LifecycleState.ALLOCATED,
            "allocated_at": profile.ipv6_allocated_at,
        }

    async def activate_ipv6(
        self,
        subscriber_id: str,
        *,
        username: str | None = None,
        nas_ip: str | None = None,
        send_coa: bool = False,
        commit: bool = False,
    ) -> dict[str, object]:
        """
        Mark IPv6 prefix as active after RADIUS provisioning.

        DEPRECATED: Use activate() instead for protocol compliance.
        """
        profile = await self.get_profile(subscriber_id)
        if not profile:
            raise ActivationError(f"No network profile found for subscriber {subscriber_id}")

        # Validate state transition
        current_state = _map_to_lifecycle_state(profile.ipv6_state)
        validate_lifecycle_transition(current_state, LifecycleState.ACTIVE)

        # Transition to ACTIVE
        profile.ipv6_state = IPv6LifecycleState.ACTIVE
        profile.ipv6_activated_at = datetime.now(UTC)

        await self.session.flush()
        if commit:
            await self.session.commit()

        # Send CoA to update active RADIUS session
        coa_result = None
        if send_coa and self.coa_client and profile.delegated_ipv6_prefix:
            if not username:
                self.logger.warning(
                    "ipv6.coa_skipped_no_username",
                    subscriber_id=subscriber_id,
                    prefix=profile.delegated_ipv6_prefix,
                )
            else:
                try:
                    coa_result = await self.coa_client.update_ipv6_prefix(
                        username=username,
                        delegated_prefix=profile.delegated_ipv6_prefix,
                        nas_ip=nas_ip,
                    )
                    if coa_result.get("success"):
                        self.logger.info(
                            "ipv6.coa_update_sent",
                            subscriber_id=subscriber_id,
                            username=username,
                            prefix=profile.delegated_ipv6_prefix,
                        )
                    else:
                        self.logger.warning(
                            "ipv6.coa_update_failed",
                            subscriber_id=subscriber_id,
                            username=username,
                            prefix=profile.delegated_ipv6_prefix,
                            error=coa_result.get("message"),
                        )
                except Exception as e:
                    self.logger.error(
                        "ipv6.coa_update_error",
                        subscriber_id=subscriber_id,
                        username=username,
                        prefix=profile.delegated_ipv6_prefix,
                        error=str(e),
                    )

        self.logger.info(
            "ipv6.lifecycle.activated",
            subscriber_id=subscriber_id,
            prefix=profile.delegated_ipv6_prefix,
            state_transition="ALLOCATED -> ACTIVE",
            activated_at=profile.ipv6_activated_at,
            coa_sent=coa_result is not None,
        )

        result: dict[str, object] = {
            "prefix": profile.delegated_ipv6_prefix,
            "state": IPv6LifecycleState.ACTIVE,
            "activated_at": profile.ipv6_activated_at,
        }
        if coa_result:
            result["coa_result"] = coa_result

        return result

    async def suspend_ipv6(
        self,
        subscriber_id: str,
        *,
        commit: bool = False,
    ) -> dict[str, object]:
        """
        Suspend IPv6 prefix.

        DEPRECATED: Use suspend() instead for protocol compliance.
        """
        profile = await self.get_profile(subscriber_id)
        if not profile:
            raise AllocationError(f"No network profile found for subscriber {subscriber_id}")

        # Validate state transition
        current_state = _map_to_lifecycle_state(profile.ipv6_state)
        validate_lifecycle_transition(current_state, LifecycleState.SUSPENDED)

        # Transition to SUSPENDED
        profile.ipv6_state = IPv6LifecycleState.SUSPENDED

        await self.session.flush()
        if commit:
            await self.session.commit()

        self.logger.info(
            "ipv6.lifecycle.suspended",
            subscriber_id=subscriber_id,
            prefix=profile.delegated_ipv6_prefix,
            state_transition="ACTIVE -> SUSPENDED",
        )

        return {
            "prefix": profile.delegated_ipv6_prefix,
            "state": IPv6LifecycleState.SUSPENDED,
        }

    async def resume_ipv6(
        self,
        subscriber_id: str,
        *,
        commit: bool = False,
    ) -> dict[str, object]:
        """
        Resume IPv6 prefix after suspension.

        DEPRECATED: Use reactivate() instead for protocol compliance.
        """
        profile = await self.get_profile(subscriber_id)
        if not profile:
            raise ReactivationError(f"No network profile found for subscriber {subscriber_id}")

        # Validate state transition
        current_state = _map_to_lifecycle_state(profile.ipv6_state)
        validate_lifecycle_transition(current_state, LifecycleState.ACTIVE)

        # Transition back to ACTIVE
        profile.ipv6_state = IPv6LifecycleState.ACTIVE

        await self.session.flush()
        if commit:
            await self.session.commit()

        self.logger.info(
            "ipv6.lifecycle.resumed",
            subscriber_id=subscriber_id,
            prefix=profile.delegated_ipv6_prefix,
            state_transition="SUSPENDED -> ACTIVE",
        )

        return {
            "prefix": profile.delegated_ipv6_prefix,
            "state": IPv6LifecycleState.ACTIVE,
        }

    async def revoke_ipv6(
        self,
        subscriber_id: str,
        *,
        username: str | None = None,
        nas_ip: str | None = None,
        send_disconnect: bool = False,
        release_to_netbox: bool = True,
        commit: bool = False,
    ) -> dict[str, object]:
        """
        Revoke IPv6 prefix and return to pool.

        DEPRECATED: Use revoke() instead for protocol compliance.
        """
        profile = await self.get_profile(subscriber_id)
        if not profile:
            raise RevocationError(f"No network profile found for subscriber {subscriber_id}")

        # Already revoked - idempotent operation
        if profile.ipv6_state == IPv6LifecycleState.REVOKED:
            self.logger.warning(
                "ipv6.lifecycle.already_revoked",
                subscriber_id=subscriber_id,
                prefix=profile.delegated_ipv6_prefix,
            )
            return {
                "prefix": profile.delegated_ipv6_prefix,
                "state": IPv6LifecycleState.REVOKED,
                "revoked_at": profile.ipv6_revoked_at,
            }

        previous_state = profile.ipv6_state
        prefix_to_revoke = profile.delegated_ipv6_prefix
        netbox_prefix_id = profile.ipv6_netbox_prefix_id

        # Transition to REVOKING
        profile.ipv6_state = IPv6LifecycleState.REVOKING
        await self.session.flush()

        # Send RADIUS Disconnect
        disconnect_result = None
        if send_disconnect and self.coa_client and username:
            try:
                disconnect_result = await self.coa_client.disconnect_session(
                    username=username,
                    nas_ip=nas_ip,
                )
                if disconnect_result.get("success"):
                    self.logger.info(
                        "ipv6.disconnect_sent_on_revoke",
                        subscriber_id=subscriber_id,
                        username=username,
                        prefix=prefix_to_revoke,
                    )
            except Exception as e:
                self.logger.error(
                    "ipv6.disconnect_error_on_revoke",
                    subscriber_id=subscriber_id,
                    error=str(e),
                )

        # Release to NetBox
        if release_to_netbox and netbox_prefix_id and self.netbox_client:
            try:
                await self.netbox_client.release_ipv6_prefix(netbox_prefix_id)
                self.logger.info(
                    "ipv6.released_to_netbox",
                    subscriber_id=subscriber_id,
                    prefix=prefix_to_revoke,
                    netbox_prefix_id=netbox_prefix_id,
                )
            except Exception as e:
                self.logger.error(
                    "ipv6.netbox_release_failed",
                    subscriber_id=subscriber_id,
                    error=str(e),
                )

        # Complete revocation
        profile.ipv6_state = IPv6LifecycleState.REVOKED
        profile.ipv6_revoked_at = datetime.now(UTC)
        profile.delegated_ipv6_prefix = None
        profile.ipv6_netbox_prefix_id = None

        await self.session.flush()
        if commit:
            await self.session.commit()

        self.logger.info(
            "ipv6.lifecycle.revoked",
            subscriber_id=subscriber_id,
            prefix=prefix_to_revoke,
            state_transition=f"{previous_state} -> REVOKING -> REVOKED",
            revoked_at=profile.ipv6_revoked_at,
        )

        result: dict[str, object] = {
            "prefix": prefix_to_revoke,
            "state": IPv6LifecycleState.REVOKED,
            "revoked_at": profile.ipv6_revoked_at,
            "previous_state": previous_state,
        }
        if disconnect_result:
            result["disconnect_result"] = disconnect_result

        return result

    async def get_lifecycle_status(
        self,
        subscriber_id: str,
    ) -> dict[str, object]:
        """
        Get current IPv6 lifecycle status.

        DEPRECATED: Use get_state() instead for protocol compliance.
        """
        profile = await self.get_profile(subscriber_id)
        if not profile:
            raise AllocationError(f"No network profile found for subscriber {subscriber_id}")

        return {
            "subscriber_id": subscriber_id,
            "prefix": profile.delegated_ipv6_prefix,
            "prefix_size": profile.ipv6_pd_size,
            "state": profile.ipv6_state,
            "allocated_at": profile.ipv6_allocated_at,
            "activated_at": profile.ipv6_activated_at,
            "revoked_at": profile.ipv6_revoked_at,
            "netbox_prefix_id": profile.ipv6_netbox_prefix_id,
            "assignment_mode": profile.ipv6_assignment_mode,
        }
