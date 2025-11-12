"""
IPv4 Lifecycle Management Service (Phase 5).

Implements the AddressLifecycleService protocol for IPv4 static IP addresses,
providing unified lifecycle management across provisioning, suspension, and
revocation workflows.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.ip_management.models import IPReservation, IPReservationStatus
from dotmac.platform.network.lifecycle_protocol import (
    ActivationError,
    AllocationError,
    InvalidTransitionError,
    LifecycleResult,
    LifecycleState,
    ReactivationError,
    RevocationError,
    validate_lifecycle_transition,
)

logger = structlog.get_logger(__name__)


class IPv4LifecycleService:
    """
    IPv4 address lifecycle management service.

    Manages the complete lifecycle of IPv4 static IP allocations:
    - Allocation from IP pools
    - Activation with NetBox/DHCP/RADIUS integration
    - Suspension and reactivation
    - Revocation and pool release

    Implementation Notes:
    - Operates on IPReservation records in ip_reservations table
    - Follows the same state machine as IPv6: PENDING -> ALLOCATED -> ACTIVE
      -> SUSPENDED <-> ACTIVE -> REVOKING -> REVOKED
    - Integrates with IPManagementService for pool operations
    - Supports NetBox synchronization for IP tracking
    - Sends RADIUS CoA/Disconnect for dynamic session updates
    """

    def __init__(
        self,
        db: AsyncSession,
        tenant_id: str,
        *,
        netbox_client: Any | None = None,
        radius_client: Any | None = None,
        dhcp_client: Any | None = None,
    ):
        """
        Initialize IPv4 lifecycle service.

        Args:
            db: Async database session
            tenant_id: Tenant ID for multi-tenant isolation
            netbox_client: Optional NetBox API client for IP sync
            radius_client: Optional RADIUS client for CoA/Disconnect
            dhcp_client: Optional DHCP client for lease management
        """
        self.db = db
        self.tenant_id = tenant_id
        self.netbox_client = netbox_client
        self.radius_client = radius_client
        self.dhcp_client = dhcp_client

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
        Allocate an IPv4 address from the pool for a subscriber.

        Transitions: PENDING -> ALLOCATED

        Process:
        1. Check if subscriber already has an allocation
        2. Validate state transition (must be PENDING or FAILED)
        3. Allocate IP from IPManagementService
        4. Create/update IPReservation with lifecycle state
        5. Optionally sync to NetBox
        6. Return LifecycleResult

        Args:
            subscriber_id: Subscriber to allocate IP for
            pool_id: Optional specific pool to allocate from
            requested_address: Optional specific IP to allocate
            metadata: Optional metadata to store
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with allocated IP and state

        Raises:
            AllocationError: If allocation fails
            InvalidTransitionError: If current state doesn't allow allocation
        """
        logger.info(
            "Starting IPv4 allocation",
            subscriber_id=str(subscriber_id),
            pool_id=str(pool_id) if pool_id else None,
            tenant_id=self.tenant_id,
        )

        try:
            # Check for existing reservation
            stmt = select(IPReservation).where(
                IPReservation.tenant_id == self.tenant_id,
                IPReservation.subscriber_id == str(subscriber_id),
                IPReservation.ip_type == "ipv4",
            )
            result = await self.db.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                # Validate transition
                current_state = LifecycleState(existing.lifecycle_state)
                validate_lifecycle_transition(
                    current_state, LifecycleState.ALLOCATED, raise_on_invalid=True
                )

                # Update existing reservation
                existing.lifecycle_state = LifecycleState.ALLOCATED
                existing.lifecycle_allocated_at = datetime.now(UTC)
                if metadata:
                    existing.lifecycle_metadata = {
                        **(existing.lifecycle_metadata or {}),
                        **metadata,
                    }

                if commit:
                    await self.db.commit()
                    await self.db.refresh(existing)

                logger.info(
                    "Updated existing IPv4 reservation to ALLOCATED",
                    reservation_id=str(existing.id),
                    ip_address=existing.ip_address,
                )

                return LifecycleResult(
                    success=True,
                    state=LifecycleState.ALLOCATED,
                    address=existing.ip_address,
                    subscriber_id=subscriber_id,
                    tenant_id=self.tenant_id,
                    allocated_at=existing.lifecycle_allocated_at,
                    metadata=existing.lifecycle_metadata,
                )

            # No existing reservation - need to allocate from pool
            # This requires integration with IPManagementService
            # For now, raise an error indicating the service needs to be called first
            raise AllocationError(
                f"No existing IPv4 reservation found for subscriber {subscriber_id}. "
                "Use IPManagementService.allocate_static_ip() to create the reservation first."
            )

        except InvalidTransitionError:
            raise
        except Exception as e:
            logger.error(
                "IPv4 allocation failed",
                subscriber_id=str(subscriber_id),
                error=str(e),
                exc_info=True,
            )
            raise AllocationError(f"Failed to allocate IPv4: {e}") from e

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
        Activate an allocated IPv4 address.

        Transitions: ALLOCATED -> ACTIVE

        Process:
        1. Fetch IP reservation
        2. Validate state transition
        3. Update lifecycle state to ACTIVE
        4. Optionally update NetBox
        5. Optionally send RADIUS CoA
        6. Return result

        Args:
            subscriber_id: Subscriber to activate IP for
            username: RADIUS username for CoA
            nas_ip: NAS IP for CoA
            send_coa: Whether to send RADIUS CoA
            update_netbox: Whether to update NetBox
            metadata: Optional metadata to update
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with active state

        Raises:
            ActivationError: If activation fails
            InvalidTransitionError: If current state doesn't allow activation
        """
        logger.info(
            "Starting IPv4 activation",
            subscriber_id=str(subscriber_id),
            tenant_id=self.tenant_id,
        )

        try:
            # Fetch reservation
            stmt = select(IPReservation).where(
                IPReservation.tenant_id == self.tenant_id,
                IPReservation.subscriber_id == str(subscriber_id),
                IPReservation.ip_type == "ipv4",
            )
            result = await self.db.execute(stmt)
            reservation = result.scalar_one_or_none()

            if not reservation:
                raise ActivationError(f"No IPv4 reservation found for subscriber {subscriber_id}")

            # Validate transition
            current_state = LifecycleState(reservation.lifecycle_state)
            validate_lifecycle_transition(
                current_state, LifecycleState.ACTIVE, raise_on_invalid=True
            )

            # Update lifecycle state
            reservation.lifecycle_state = LifecycleState.ACTIVE
            reservation.lifecycle_activated_at = datetime.now(UTC)
            reservation.status = IPReservationStatus.ASSIGNED  # Update old status too

            if reservation.lifecycle_metadata is None:
                reservation.lifecycle_metadata = {}

            if metadata:
                reservation.lifecycle_metadata = {
                    **(reservation.lifecycle_metadata or {}),
                    **metadata,
                }

            # Update NetBox if configured
            if update_netbox and self.netbox_client and reservation.netbox_ip_id:
                try:
                    await self._update_netbox_ip_status(reservation.netbox_ip_id, "active")
                    reservation.lifecycle_metadata["netbox_synced"] = True
                    reservation.lifecycle_metadata["netbox_synced_at"] = datetime.now(
                        UTC
                    ).isoformat()
                except Exception as e:
                    logger.warning(f"Failed to update NetBox: {e}")
                    reservation.lifecycle_metadata["netbox_sync_error"] = str(e)

            # Send RADIUS CoA if configured
            if send_coa and self.radius_client and username and nas_ip:
                try:
                    await self._send_radius_coa(
                        username=username,
                        nas_ip=nas_ip,
                        ipv4_address=reservation.ip_address,
                    )
                    reservation.lifecycle_metadata["coa_sent"] = True
                    reservation.lifecycle_metadata["coa_sent_at"] = datetime.now(UTC).isoformat()
                except Exception as e:
                    logger.warning(f"Failed to send RADIUS CoA: {e}")
                    reservation.lifecycle_metadata["coa_error"] = str(e)

            if commit:
                await self.db.commit()
                await self.db.refresh(reservation)

            logger.info(
                "IPv4 activation complete",
                reservation_id=str(reservation.id),
                ip_address=reservation.ip_address,
            )

            return LifecycleResult(
                success=True,
                state=LifecycleState.ACTIVE,
                address=reservation.ip_address,
                subscriber_id=subscriber_id,
                tenant_id=self.tenant_id,
                allocated_at=reservation.lifecycle_allocated_at,
                activated_at=reservation.lifecycle_activated_at,
                metadata=reservation.lifecycle_metadata,
            )

        except InvalidTransitionError:
            raise
        except Exception as e:
            logger.error(
                "IPv4 activation failed",
                subscriber_id=str(subscriber_id),
                error=str(e),
                exc_info=True,
            )
            raise ActivationError(f"Failed to activate IPv4: {e}") from e

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
        Suspend an active IPv4 address.

        Transitions: ACTIVE -> SUSPENDED

        Args:
            subscriber_id: Subscriber to suspend IP for
            username: RADIUS username for CoA
            nas_ip: NAS IP for CoA
            send_coa: Whether to send RADIUS CoA
            reason: Reason for suspension
            metadata: Optional metadata to update
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with suspended state

        Raises:
            InvalidTransitionError: If current state doesn't allow suspension
        """
        logger.info(
            "Starting IPv4 suspension",
            subscriber_id=str(subscriber_id),
            reason=reason,
        )

        try:
            stmt = select(IPReservation).where(
                IPReservation.tenant_id == self.tenant_id,
                IPReservation.subscriber_id == str(subscriber_id),
                IPReservation.ip_type == "ipv4",
            )
            result = await self.db.execute(stmt)
            reservation = result.scalar_one_or_none()

            if not reservation:
                raise ActivationError(f"No IPv4 reservation found for subscriber {subscriber_id}")

            # Validate transition
            current_state = LifecycleState(reservation.lifecycle_state)
            validate_lifecycle_transition(
                current_state, LifecycleState.SUSPENDED, raise_on_invalid=True
            )

            # Update state
            reservation.lifecycle_state = LifecycleState.SUSPENDED
            reservation.lifecycle_suspended_at = datetime.now(UTC)

            if metadata:
                reservation.lifecycle_metadata = {
                    **(reservation.lifecycle_metadata or {}),
                    **metadata,
                }

            if reason:
                if reservation.lifecycle_metadata is None:
                    reservation.lifecycle_metadata = {}
                reservation.lifecycle_metadata["suspension_reason"] = reason

            # Send CoA to update session
            if send_coa and self.radius_client and username and nas_ip:
                try:
                    await self._send_radius_coa(
                        username=username,
                        nas_ip=nas_ip,
                        ipv4_address=reservation.ip_address,
                        suspend=True,
                    )
                except Exception as e:
                    logger.warning(f"Failed to send RADIUS CoA: {e}")

            if commit:
                await self.db.commit()
                await self.db.refresh(reservation)

            logger.info("IPv4 suspension complete", ip_address=reservation.ip_address)

            return LifecycleResult(
                success=True,
                state=LifecycleState.SUSPENDED,
                address=reservation.ip_address,
                subscriber_id=subscriber_id,
                tenant_id=self.tenant_id,
                suspended_at=reservation.lifecycle_suspended_at,
                metadata=reservation.lifecycle_metadata,
            )

        except InvalidTransitionError:
            raise
        except Exception as e:
            logger.error(f"IPv4 suspension failed: {e}", exc_info=True)
            raise

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
        Revoke an IPv4 address and release back to pool.

        Transitions: ACTIVE/SUSPENDED -> REVOKING -> REVOKED

        Args:
            subscriber_id: Subscriber to revoke IP from
            username: RADIUS username for disconnect
            nas_ip: NAS IP for disconnect
            send_disconnect: Whether to send RADIUS disconnect
            release_to_pool: Whether to release IP back to pool
            update_netbox: Whether to update NetBox
            metadata: Optional metadata to update
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with revoked state

        Raises:
            RevocationError: If revocation fails
        """
        logger.info("Starting IPv4 revocation", subscriber_id=str(subscriber_id))

        try:
            stmt = select(IPReservation).where(
                IPReservation.tenant_id == self.tenant_id,
                IPReservation.subscriber_id == str(subscriber_id),
                IPReservation.ip_type == "ipv4",
            )
            result = await self.db.execute(stmt)
            reservation = result.scalar_one_or_none()

            if not reservation:
                raise RevocationError(f"No IPv4 reservation found for subscriber {subscriber_id}")

            # Set to REVOKING first
            reservation.lifecycle_state = LifecycleState.REVOKING

            # Send RADIUS disconnect
            if send_disconnect and self.radius_client and username and nas_ip:
                try:
                    await self._send_radius_disconnect(username, nas_ip)
                except Exception as e:
                    logger.warning("Failed to send RADIUS disconnect", error=str(e))

            # Update NetBox
            if update_netbox and self.netbox_client and reservation.netbox_ip_id:
                try:
                    await self._delete_netbox_ip(reservation.netbox_ip_id)
                except Exception as e:
                    logger.warning("Failed to delete from NetBox", error=str(e))

            # Complete revocation
            reservation.lifecycle_state = LifecycleState.REVOKED
            reservation.lifecycle_revoked_at = datetime.now(UTC)
            reservation.status = IPReservationStatus.RELEASED

            if release_to_pool:
                reservation.released_at = datetime.now(UTC)

            if metadata:
                reservation.lifecycle_metadata = {
                    **(reservation.lifecycle_metadata or {}),
                    **metadata,
                }

            if commit:
                await self.db.commit()
                await self.db.refresh(reservation)

            logger.info("IPv4 revocation complete", ip_address=reservation.ip_address)

            return LifecycleResult(
                success=True,
                state=LifecycleState.REVOKED,
                address=reservation.ip_address,
                subscriber_id=subscriber_id,
                tenant_id=self.tenant_id,
                revoked_at=reservation.lifecycle_revoked_at,
                metadata=reservation.lifecycle_metadata,
            )

        except Exception as e:
            logger.error(f"IPv4 revocation failed: {e}", exc_info=True)
            raise RevocationError(f"Failed to revoke IPv4: {e}") from e

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
        Reactivate a suspended IPv4 address.

        Transitions: SUSPENDED -> ACTIVE

        Args:
            subscriber_id: Subscriber to reactivate IP for
            username: RADIUS username for CoA
            nas_ip: NAS IP for CoA
            send_coa: Whether to send RADIUS CoA
            metadata: Optional metadata to update
            commit: Whether to commit transaction

        Returns:
            LifecycleResult with active state

        Raises:
            ReactivationError: If reactivation fails
        """
        logger.info("Starting IPv4 reactivation", subscriber_id=str(subscriber_id))

        try:
            stmt = select(IPReservation).where(
                IPReservation.tenant_id == self.tenant_id,
                IPReservation.subscriber_id == str(subscriber_id),
                IPReservation.ip_type == "ipv4",
            )
            result = await self.db.execute(stmt)
            reservation = result.scalar_one_or_none()

            if not reservation:
                raise ReactivationError(f"No IPv4 reservation found for subscriber {subscriber_id}")

            # Validate transition
            current_state = LifecycleState(reservation.lifecycle_state)
            validate_lifecycle_transition(
                current_state, LifecycleState.ACTIVE, raise_on_invalid=True
            )

            # Reactivate
            reservation.lifecycle_state = LifecycleState.ACTIVE
            reservation.lifecycle_activated_at = datetime.now(UTC)
            reservation.lifecycle_suspended_at = None

            if metadata:
                reservation.lifecycle_metadata = {
                    **(reservation.lifecycle_metadata or {}),
                    **metadata,
                }

            # Send CoA
            if send_coa and self.radius_client and username and nas_ip:
                try:
                    await self._send_radius_coa(
                        username=username,
                        nas_ip=nas_ip,
                        ipv4_address=reservation.ip_address,
                    )
                except Exception as e:
                    logger.warning(f"Failed to send RADIUS CoA: {e}")

            if commit:
                await self.db.commit()
                await self.db.refresh(reservation)

            logger.info("IPv4 reactivation complete", ip_address=reservation.ip_address)

            return LifecycleResult(
                success=True,
                state=LifecycleState.ACTIVE,
                address=reservation.ip_address,
                subscriber_id=subscriber_id,
                tenant_id=self.tenant_id,
                activated_at=reservation.lifecycle_activated_at,
                metadata=reservation.lifecycle_metadata,
            )

        except InvalidTransitionError:
            raise
        except Exception as e:
            logger.error(f"IPv4 reactivation failed: {e}", exc_info=True)
            raise ReactivationError(f"Failed to reactivate IPv4: {e}") from e

    async def get_state(
        self,
        subscriber_id: UUID,
    ) -> LifecycleResult | None:
        """
        Get current lifecycle state for a subscriber's IPv4 address.

        Args:
            subscriber_id: Subscriber to query

        Returns:
            LifecycleResult with current state, or None if no allocation
        """
        stmt = select(IPReservation).where(
            IPReservation.tenant_id == self.tenant_id,
            IPReservation.subscriber_id == str(subscriber_id),
            IPReservation.ip_type == "ipv4",
        )
        result = await self.db.execute(stmt)
        reservation = result.scalar_one_or_none()

        if not reservation:
            return None

        return LifecycleResult(
            success=True,
            state=LifecycleState(reservation.lifecycle_state),
            address=reservation.ip_address,
            subscriber_id=subscriber_id,
            tenant_id=self.tenant_id,
            allocated_at=reservation.lifecycle_allocated_at,
            activated_at=reservation.lifecycle_activated_at,
            suspended_at=reservation.lifecycle_suspended_at,
            revoked_at=reservation.lifecycle_revoked_at,
            metadata=reservation.lifecycle_metadata,
        )

    def validate_transition(
        self, current_state: LifecycleState, target_state: LifecycleState
    ) -> bool:
        """Validate if a state transition is allowed."""
        return validate_lifecycle_transition(current_state, target_state, raise_on_invalid=False)

    # =======================================================================
    # Private Helper Methods
    # =======================================================================

    async def _update_netbox_ip_status(self, netbox_ip_id: int, status: str) -> None:
        """Update NetBox IP address status."""
        if not self.netbox_client:
            return

        # Placeholder for NetBox integration
        logger.debug(f"Would update NetBox IP {netbox_ip_id} to status {status}")
        # await self.netbox_client.ipam.ip_addresses.update(
        #     id=netbox_ip_id, status=status
        # )

    async def _delete_netbox_ip(self, netbox_ip_id: int) -> None:
        """Delete IP address from NetBox."""
        if not self.netbox_client:
            return

        logger.debug(f"Would delete NetBox IP {netbox_ip_id}")
        # await self.netbox_client.ipam.ip_addresses.delete(id=netbox_ip_id)

    async def _send_radius_coa(
        self,
        username: str,
        nas_ip: str,
        ipv4_address: str,
        suspend: bool = False,
    ) -> None:
        """Send RADIUS CoA packet."""
        if not self.radius_client:
            return

        logger.debug(
            f"Would send RADIUS CoA to {nas_ip} for {username} "
            f"(IPv4: {ipv4_address}, suspend: {suspend})"
        )
        # await self.radius_client.send_coa(
        #     username=username,
        #     nas_ip=nas_ip,
        #     attributes={"Framed-IP-Address": ipv4_address}
        # )

    async def _send_radius_disconnect(self, username: str, nas_ip: str) -> None:
        """Send RADIUS Disconnect-Request."""
        if not self.radius_client:
            return

        logger.debug(f"Would send RADIUS disconnect to {nas_ip} for {username}")
        # await self.radius_client.send_disconnect(
        #     username=username, nas_ip=nas_ip
        # )
