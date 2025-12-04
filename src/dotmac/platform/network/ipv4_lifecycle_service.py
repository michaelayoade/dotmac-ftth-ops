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

from dotmac.platform.ip_management.ip_service import IPManagementService
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
        self.ip_service = IPManagementService(db, tenant_id)

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
            filters = [
                IPReservation.tenant_id == self.tenant_id,
                IPReservation.deleted_at.is_(None),
                IPReservation.ip_type == "ipv4",
                IPReservation.status == IPReservationStatus.RELEASED,
            ]

            if pool_id:
                filters.append(IPReservation.pool_id == pool_id)
            if requested_address:
                filters.append(IPReservation.ip_address == requested_address)

            stmt = (
                select(IPReservation)
                .where(*filters)
                .order_by(
                    IPReservation.reserved_at.asc().nullsfirst(),
                    IPReservation.created_at.asc(),
                )
                .limit(1)
            )
            result = await self.db.execute(stmt)
            reservation = result.scalar_one_or_none()

            if not reservation:
                raise AllocationError("No available IP addresses found for allocation")

            # Validate state transition
            current_state = LifecycleState(reservation.lifecycle_state)
            validate_lifecycle_transition(
                current_state, LifecycleState.ALLOCATED, raise_on_invalid=True
            )

            previous_status = reservation.status
            now = datetime.now(UTC)

            reservation.subscriber_id = str(subscriber_id)
            reservation.status = IPReservationStatus.ASSIGNED
            reservation.lifecycle_state = LifecycleState.ALLOCATED
            reservation.lifecycle_allocated_at = now
            reservation.ip_type = reservation.ip_type or "ipv4"

            if metadata:
                reservation.lifecycle_metadata = {
                    **(reservation.lifecycle_metadata or {}),
                    **metadata,
                }

            # Optional NetBox sync - best effort
            netbox_ip_id: int | None = reservation.netbox_ip_id
            if self.netbox_client:
                try:
                    netbox_response = await self.netbox_client.reserve_ip(
                        ip_address=reservation.ip_address,
                        pool_id=str(reservation.pool_id),
                        tenant_id=self.tenant_id,
                        subscriber_id=str(subscriber_id),
                    )
                    if isinstance(netbox_response, dict):
                        netbox_ip_id = (
                            netbox_response.get("id")
                            or netbox_response.get("ip_id")
                            or netbox_ip_id
                        )
                        if netbox_ip_id:
                            reservation.netbox_ip_id = netbox_ip_id
                            self._merge_metadata(reservation, {"netbox_ip_id": netbox_ip_id})
                except Exception as e:
                    logger.warning(
                        "ipv4.allocation.netbox_failed",
                        ip_address=reservation.ip_address,
                        error=str(e),
                    )

            await self._update_pool_after_assignment(reservation, previous_status)

            if commit:
                await self.db.commit()
                await self.db.refresh(reservation)
            else:
                await self.db.flush()

            logger.info(
                "IPv4 allocation complete",
                reservation_id=str(reservation.id),
                ip_address=reservation.ip_address,
            )

            return LifecycleResult(
                success=True,
                state=LifecycleState.ALLOCATED,
                address=reservation.ip_address,
                subscriber_id=subscriber_id,
                tenant_id=self.tenant_id,
                allocated_at=reservation.lifecycle_allocated_at,
                metadata=reservation.lifecycle_metadata,
                netbox_ip_id=reservation.netbox_ip_id,
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
            coa_result: dict[str, Any] | None = None
            netbox_ip_id: int | str | None = reservation.netbox_ip_id

            if reservation.lifecycle_metadata is None:
                reservation.lifecycle_metadata = {}

            if metadata:
                reservation.lifecycle_metadata = {
                    **(reservation.lifecycle_metadata or {}),
                    **metadata,
                }

            # Update NetBox if configured
            if update_netbox and self.netbox_client:
                try:
                    netbox_result = await self._update_netbox_ip_status(
                        netbox_ip_id or reservation.ip_address, "active"
                    )
                    if isinstance(netbox_result, dict):
                        netbox_ip_id = netbox_result.get("id") or netbox_ip_id
                    if netbox_ip_id:
                        reservation.netbox_ip_id = netbox_ip_id  # type: ignore[assignment]
                        self._merge_metadata(
                            reservation,
                            {
                                "netbox_ip_id": netbox_ip_id,
                                "netbox_synced": True,
                                "netbox_synced_at": datetime.now(UTC).isoformat(),
                            },
                        )
                except Exception as e:
                    logger.warning(f"Failed to update NetBox: {e}")
                    self._merge_metadata(reservation, {"netbox_sync_error": str(e)})

            # Send RADIUS CoA if configured
            if send_coa and self.radius_client and username and nas_ip:
                try:
                    coa_result = await self._send_radius_coa(
                        username=username,
                        nas_ip=nas_ip,
                        ipv4_address=reservation.ip_address,
                    )
                    metadata_updates = {
                        "coa_sent": True,
                        "coa_sent_at": datetime.now(UTC).isoformat(),
                    }
                    if coa_result is not None:
                        metadata_updates["coa_result"] = coa_result
                    self._merge_metadata(reservation, metadata_updates)
                except Exception as e:
                    logger.warning(f"Failed to send RADIUS CoA: {e}")
                    self._merge_metadata(reservation, {"coa_error": str(e)})

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
                coa_result=coa_result,
                netbox_ip_id=int(netbox_ip_id) if netbox_ip_id is not None else None,
            )

        except InvalidTransitionError as exc:
            raise InvalidTransitionError(
                current_state,
                LifecycleState.ACTIVE,
                message=f"Cannot activate from state: {current_state.value}",
            ) from exc
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
                self._merge_metadata(reservation, metadata)

            if reason:
                self._merge_metadata(reservation, {"suspension_reason": reason})

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

            previous_status = reservation.status
            # Set to REVOKING first
            reservation.lifecycle_state = LifecycleState.REVOKING
            disconnect_result: dict[str, Any] | None = None

            # Send RADIUS disconnect
            if send_disconnect and self.radius_client and username and nas_ip:
                try:
                    disconnect_result = await self._send_radius_disconnect(username, nas_ip)
                except Exception as e:
                    logger.warning("Failed to send RADIUS disconnect", error=str(e))

            # Update NetBox
            if update_netbox and self.netbox_client:
                try:
                    if hasattr(self.netbox_client, "release_ip"):
                        await self.netbox_client.release_ip(
                            ip_id=reservation.netbox_ip_id, ip_address=reservation.ip_address
                        )
                    elif reservation.netbox_ip_id:
                        await self._delete_netbox_ip(reservation.netbox_ip_id)
                except Exception as e:
                    logger.warning("Failed to delete from NetBox", error=str(e))

            # Complete revocation
            reservation.lifecycle_state = LifecycleState.REVOKED
            reservation.lifecycle_revoked_at = datetime.now(UTC)
            reservation.status = IPReservationStatus.RELEASED

            if release_to_pool:
                reservation.released_at = datetime.now(UTC)
                reservation.subscriber_id = None

            await self._update_pool_after_release(reservation, previous_status)

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
                disconnect_result=disconnect_result,
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

    @staticmethod
    def _merge_metadata(reservation: IPReservation, extra: dict[str, Any]) -> None:
        """Safely merge lifecycle metadata ensuring SQLAlchemy detects changes."""
        base = reservation.lifecycle_metadata or {}
        reservation.lifecycle_metadata = {**base, **extra}

    async def _update_pool_after_assignment(
        self, reservation: IPReservation, previous_status: IPReservationStatus
    ) -> None:
        """Keep pool counters in sync when assigning an IP."""
        try:
            pool = await self.ip_service.get_pool(reservation.pool_id)
        except Exception:
            pool = None

        if not pool:
            return

        if previous_status == IPReservationStatus.RESERVED:
            pool.reserved_count = max(pool.reserved_count - 1, 0)
        if previous_status in {
            IPReservationStatus.RELEASED,
            IPReservationStatus.RESERVED,
            IPReservationStatus.EXPIRED,
        }:
            pool.assigned_count += 1

        await self.ip_service._update_pool_utilization(pool)

    async def _update_pool_after_release(
        self, reservation: IPReservation, previous_status: IPReservationStatus
    ) -> None:
        """Keep pool counters accurate when releasing an IP back to the pool."""
        try:
            pool = await self.ip_service.get_pool(reservation.pool_id)
        except Exception:
            pool = None

        if not pool:
            return

        if previous_status == IPReservationStatus.RESERVED:
            pool.reserved_count = max(pool.reserved_count - 1, 0)
        elif previous_status == IPReservationStatus.ASSIGNED:
            pool.assigned_count = max(pool.assigned_count - 1, 0)

        await self.ip_service._update_pool_utilization(pool)

    async def _update_netbox_ip_status(
        self, netbox_ip_id: int | str, status: str
    ) -> dict[str, Any] | None:
        """Update NetBox IP address status (best effort)."""
        if not self.netbox_client:
            return None

        try:
            return await self.netbox_client.update_ip_status(ip_id=netbox_ip_id, status=status)
        except Exception as exc:
            logger.warning(
                "netbox.update.failed",
                ip_id=netbox_ip_id,
                status=status,
                error=str(exc),
            )
            return None

    async def _delete_netbox_ip(self, netbox_ip_id: int | str) -> dict[str, Any] | None:
        """Delete IP address from NetBox (fallback)."""
        if not self.netbox_client:
            return None

        try:
            return await self.netbox_client.delete_ip(ip_id=netbox_ip_id)
        except Exception as exc:
            logger.warning(
                "netbox.delete.failed",
                ip_id=netbox_ip_id,
                error=str(exc),
            )
            return None

    async def _send_radius_coa(
        self,
        username: str,
        nas_ip: str,
        ipv4_address: str,
        suspend: bool = False,
    ) -> Any:
        """Send RADIUS CoA packet."""
        if not self.radius_client:
            return None

        return await self.radius_client.send_coa(
            username=username,
            nas_ip=nas_ip,
            attributes={"Framed-IP-Address": ipv4_address, "Suspend-Session": suspend},
        )

    async def _send_radius_disconnect(self, username: str, nas_ip: str) -> Any:
        """Send RADIUS Disconnect-Request."""
        if not self.radius_client:
            return None

        return await self.radius_client.send_disconnect(username=username, nas_ip=nas_ip)
