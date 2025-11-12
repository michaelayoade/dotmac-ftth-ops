"""
IP Management Service with conflict detection and auto-assignment.

Provides comprehensive IP pool and reservation management with automatic
conflict detection, NetBox synchronization, and lifecycle management.
"""

from __future__ import annotations

import ipaddress
from datetime import datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.ip_management.models import (
    IPPool,
    IPPoolStatus,
    IPPoolType,
    IPReservation,
    IPReservationStatus,
)

logger = structlog.get_logger(__name__)


class IPConflictError(Exception):
    """Raised when IP conflict is detected."""

    def __init__(self, ip_address: str, conflicts: list[dict[str, Any]]):
        self.ip_address = ip_address
        self.conflicts = conflicts
        super().__init__(f"IP conflict detected for {ip_address}")


class IPPoolDepletedError(Exception):
    """Raised when IP pool has no available addresses."""

    pass


class IPManagementService:
    """
    Service for managing IP pools and reservations.

    Provides conflict detection, auto-assignment, and lifecycle management
    for static IP addresses in ISP networks.
    """

    def __init__(self, db: AsyncSession, tenant_id: str):
        """
        Initialize IP management service.

        Args:
            db: Database session
            tenant_id: Tenant ID for multi-tenant isolation
        """
        self.db = db
        self.tenant_id = tenant_id

    # ========================================================================
    # Pool Management
    # ========================================================================

    async def create_pool(
        self,
        pool_name: str,
        pool_type: IPPoolType,
        network_cidr: str,
        gateway: str | None = None,
        dns_servers: str | None = None,
        vlan_id: int | None = None,
        description: str | None = None,
        auto_assign_enabled: bool = True,
    ) -> IPPool:
        """
        Create a new IP pool.

        Args:
            pool_name: Human-readable pool name
            pool_type: Type of IP pool
            network_cidr: Network CIDR (e.g., "203.0.113.0/24")
            gateway: Gateway IP address
            dns_servers: Comma-separated DNS servers
            vlan_id: Associated VLAN ID
            description: Pool description
            auto_assign_enabled: Enable automatic assignment

        Returns:
            Created IP pool

        Raises:
            ValueError: If CIDR is invalid
        """
        # Validate CIDR
        try:
            network = ipaddress.ip_network(network_cidr, strict=False)
        except ValueError as e:
            raise ValueError(f"Invalid network CIDR: {e}")

        # Calculate total usable addresses
        if network.version == 4:
            # IPv4: Total - network - broadcast
            total_addresses = network.num_addresses - 2
            if gateway:
                total_addresses -= 1  # Exclude gateway
        else:
            # IPv6: Use a reasonable limit for UI display
            total_addresses = min(network.num_addresses, 1000000)

        pool = IPPool(
            tenant_id=self.tenant_id,
            pool_name=pool_name,
            pool_type=pool_type,
            network_cidr=str(network),
            gateway=gateway,
            dns_servers=dns_servers,
            vlan_id=vlan_id,
            description=description,
            auto_assign_enabled=auto_assign_enabled,
            status=IPPoolStatus.ACTIVE,
            total_addresses=total_addresses,
            reserved_count=0,
            assigned_count=0,
        )

        self.db.add(pool)
        await self.db.flush()

        logger.info(
            "ip_pool_created",
            pool_id=str(pool.id),
            pool_name=pool_name,
            network=str(network),
            tenant_id=self.tenant_id,
        )

        return pool

    async def list_pools(
        self,
        pool_type: IPPoolType | None = None,
        status: IPPoolStatus | None = None,
        limit: int = 100,
    ) -> list[IPPool]:
        """
        List IP pools for the tenant.

        Args:
            pool_type: Filter by pool type
            status: Filter by status
            limit: Maximum number of pools to return

        Returns:
            List of IP pools
        """
        stmt = select(IPPool).where(
            IPPool.tenant_id == self.tenant_id,
            IPPool.deleted_at.is_(None),
        )

        if pool_type:
            stmt = stmt.where(IPPool.pool_type == pool_type)
        if status:
            stmt = stmt.where(IPPool.status == status)

        stmt = stmt.limit(limit).order_by(IPPool.pool_name)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_pool(self, pool_id: UUID) -> IPPool | None:
        """
        Get IP pool by ID.

        Args:
            pool_id: Pool ID

        Returns:
            IP pool if found, None otherwise
        """
        stmt = select(IPPool).where(
            IPPool.id == pool_id,
            IPPool.tenant_id == self.tenant_id,
            IPPool.deleted_at.is_(None),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_pool_status(
        self,
        pool_id: UUID,
        status: IPPoolStatus,
    ) -> IPPool:
        """
        Update pool status.

        Args:
            pool_id: Pool ID
            status: New status

        Returns:
            Updated pool

        Raises:
            ValueError: If pool not found
        """
        pool = await self.get_pool(pool_id)
        if not pool:
            raise ValueError(f"Pool {pool_id} not found")

        pool.status = status
        await self.db.flush()

        logger.info(
            "ip_pool_status_updated",
            pool_id=str(pool_id),
            status=status.value,
            tenant_id=self.tenant_id,
        )

        return pool

    # ========================================================================
    # Conflict Detection
    # ========================================================================

    async def check_ip_conflicts(
        self,
        ip_address: str,
        exclude_reservation_id: UUID | None = None,
    ) -> list[dict[str, Any]]:
        """
        Check for IP address conflicts.

        Args:
            ip_address: IP address to check
            exclude_reservation_id: Exclude this reservation from check

        Returns:
            List of conflicts found
        """
        conflicts: list[dict[str, Any]] = []

        # Check existing reservations
        stmt = select(IPReservation).where(
            IPReservation.tenant_id == self.tenant_id,
            IPReservation.ip_address == ip_address,
            IPReservation.deleted_at.is_(None),
            IPReservation.status.in_(
                [
                    IPReservationStatus.RESERVED,
                    IPReservationStatus.ASSIGNED,
                ]
            ),
        )

        if exclude_reservation_id:
            stmt = stmt.where(IPReservation.id != exclude_reservation_id)

        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            conflicts.append(
                {
                    "type": "reservation",
                    "reservation_id": str(existing.id),
                    "subscriber_id": existing.subscriber_id,
                    "status": existing.status.value,
                    "assigned_at": existing.assigned_at,
                }
            )

        return conflicts

    async def validate_ip_in_pool(
        self,
        ip_address: str,
        pool_id: UUID,
    ) -> bool:
        """
        Validate that IP address belongs to pool network.

        Args:
            ip_address: IP address to validate
            pool_id: Pool ID

        Returns:
            True if IP is in pool, False otherwise
        """
        pool = await self.get_pool(pool_id)
        if not pool:
            return False

        try:
            ip = ipaddress.ip_address(ip_address)
            network = ipaddress.ip_network(pool.network_cidr)
            return ip in network
        except ValueError:
            return False

    # ========================================================================
    # IP Assignment
    # ========================================================================

    async def reserve_ip(
        self,
        subscriber_id: str,
        ip_address: str,
        pool_id: UUID,
        ip_type: str = "ipv4",
        assigned_by: str | None = None,
        assignment_reason: str | None = None,
        auto_assign: bool = False,
    ) -> IPReservation:
        """
        Reserve an IP address for a subscriber.

        Args:
            subscriber_id: Subscriber ID
            ip_address: IP address to reserve
            pool_id: Pool ID
            ip_type: IP type (ipv4, ipv6, ipv6_prefix)
            assigned_by: User who assigned the IP
            assignment_reason: Reason for assignment
            auto_assign: Whether this was auto-assigned

        Returns:
            IP reservation

        Raises:
            IPConflictError: If IP is already reserved
            ValueError: If IP not in pool
        """
        # Check if IP is in pool
        if not await self.validate_ip_in_pool(ip_address, pool_id):
            raise ValueError(f"IP {ip_address} not in pool {pool_id}")

        # Check for conflicts
        conflicts = await self.check_ip_conflicts(ip_address)
        if conflicts:
            raise IPConflictError(ip_address, conflicts)

        # Get pool
        pool = await self.get_pool(pool_id)
        if not pool:
            raise ValueError(f"Pool {pool_id} not found")

        # Create reservation
        reservation = IPReservation(
            tenant_id=self.tenant_id,
            pool_id=pool_id,
            subscriber_id=subscriber_id,
            ip_address=ip_address,
            ip_type=ip_type,
            status=IPReservationStatus.RESERVED,
            reserved_at=datetime.utcnow(),
            assigned_by=assigned_by,
            assignment_reason=assignment_reason or ("Auto-assigned" if auto_assign else "Manual"),
        )

        self.db.add(reservation)

        # Update pool counters
        pool.reserved_count += 1
        await self._update_pool_utilization(pool)

        await self.db.flush()

        logger.info(
            "ip_reserved",
            reservation_id=str(reservation.id),
            ip_address=ip_address,
            subscriber_id=subscriber_id,
            pool_id=str(pool_id),
            auto_assign=auto_assign,
            tenant_id=self.tenant_id,
        )

        return reservation

    async def assign_ip_auto(
        self,
        subscriber_id: str,
        pool_id: UUID,
        ip_type: str = "ipv4",
        assigned_by: str | None = None,
    ) -> IPReservation:
        """
        Automatically assign an available IP from pool.

        Args:
            subscriber_id: Subscriber ID
            pool_id: Pool ID
            ip_type: IP type
            assigned_by: User who triggered assignment

        Returns:
            IP reservation

        Raises:
            IPPoolDepletedError: If no IPs available
        """
        # Find available IP
        ip_address = await self.find_available_ip(pool_id)
        if not ip_address:
            raise IPPoolDepletedError(f"No available IPs in pool {pool_id}")

        # Reserve it
        reservation = await self.reserve_ip(
            subscriber_id=subscriber_id,
            ip_address=ip_address,
            pool_id=pool_id,
            ip_type=ip_type,
            assigned_by=assigned_by,
            auto_assign=True,
        )

        # Mark as assigned and return the updated reservation
        updated_reservation = await self.mark_assigned(reservation.id)

        return updated_reservation

    async def mark_assigned(self, reservation_id: UUID) -> IPReservation:
        """
        Mark reservation as assigned.

        Args:
            reservation_id: Reservation ID

        Returns:
            Updated reservation

        Raises:
            ValueError: If reservation not found
        """
        stmt = select(IPReservation).where(
            IPReservation.id == reservation_id,
            IPReservation.tenant_id == self.tenant_id,
        )
        result = await self.db.execute(stmt)
        reservation = result.scalar_one_or_none()

        if not reservation:
            raise ValueError(f"Reservation {reservation_id} not found")

        if reservation.status != IPReservationStatus.RESERVED:
            raise ValueError("Reservation not in RESERVED status")

        # Update reservation
        reservation.status = IPReservationStatus.ASSIGNED
        reservation.assigned_at = datetime.utcnow()

        # Update pool counters
        pool = await self.get_pool(reservation.pool_id)
        if pool:
            pool.reserved_count -= 1
            pool.assigned_count += 1
            await self._update_pool_utilization(pool)

        await self.db.flush()

        logger.info(
            "ip_assigned",
            reservation_id=str(reservation_id),
            ip_address=reservation.ip_address,
            subscriber_id=reservation.subscriber_id,
            tenant_id=self.tenant_id,
        )

        return reservation

    async def release_ip(
        self,
        reservation_id: UUID,
        released_by: str | None = None,
    ) -> bool:
        """
        Release an IP reservation.

        Args:
            reservation_id: Reservation ID
            released_by: User who released the IP

        Returns:
            True if released, False if not found

        Raises:
            ValueError: If reservation not found
        """
        stmt = select(IPReservation).where(
            IPReservation.id == reservation_id,
            IPReservation.tenant_id == self.tenant_id,
        )
        result = await self.db.execute(stmt)
        reservation = result.scalar_one_or_none()

        if not reservation:
            return False

        old_status = reservation.status

        # Update reservation
        reservation.status = IPReservationStatus.RELEASED
        reservation.released_at = datetime.utcnow()

        # Update pool counters
        pool = await self.get_pool(reservation.pool_id)
        if pool:
            if old_status == IPReservationStatus.RESERVED:
                pool.reserved_count -= 1
            elif old_status == IPReservationStatus.ASSIGNED:
                pool.assigned_count -= 1
            await self._update_pool_utilization(pool)

        await self.db.flush()

        logger.info(
            "ip_released",
            reservation_id=str(reservation_id),
            ip_address=reservation.ip_address,
            subscriber_id=reservation.subscriber_id,
            released_by=released_by,
            tenant_id=self.tenant_id,
        )

        return True

    async def find_available_ip(self, pool_id: UUID) -> str | None:
        """
        Find next available IP in pool.

        Args:
            pool_id: Pool ID

        Returns:
            Available IP address or None if pool depleted
        """
        pool = await self.get_pool(pool_id)
        if not pool:
            return None

        # Parse network
        network = ipaddress.ip_network(pool.network_cidr)

        # Get all assigned IPs in pool
        stmt = select(IPReservation.ip_address).where(
            IPReservation.pool_id == pool_id,
            IPReservation.tenant_id == self.tenant_id,
            IPReservation.deleted_at.is_(None),
            IPReservation.status.in_(
                [
                    IPReservationStatus.RESERVED,
                    IPReservationStatus.ASSIGNED,
                ]
            ),
        )
        result = await self.db.execute(stmt)
        assigned_ips = {row[0] for row in result.all()}

        # Add gateway to exclusion list
        if pool.gateway:
            assigned_ips.add(pool.gateway)

        # Find first available IP
        for ip in network.hosts():
            ip_str = str(ip)
            if ip_str not in assigned_ips:
                return ip_str

        return None

    # ========================================================================
    # Utilities
    # ========================================================================

    async def _update_pool_utilization(self, pool: IPPool) -> None:
        """
        Update pool utilization and status.

        Args:
            pool: Pool to update
        """
        total = pool.total_addresses
        used = pool.reserved_count + pool.assigned_count

        # Update status based on utilization
        if total > 0:
            utilization = (used / total) * 100

            if utilization >= 100:
                pool.status = IPPoolStatus.DEPLETED
            elif pool.status == IPPoolStatus.DEPLETED and utilization < 100:
                # Restore to active if IPs become available
                pool.status = IPPoolStatus.ACTIVE

    async def get_subscriber_reservations(
        self,
        subscriber_id: str,
    ) -> list[IPReservation]:
        """
        Get all IP reservations for a subscriber.

        Args:
            subscriber_id: Subscriber ID

        Returns:
            List of reservations
        """
        stmt = (
            select(IPReservation)
            .where(
                IPReservation.subscriber_id == subscriber_id,
                IPReservation.tenant_id == self.tenant_id,
                IPReservation.deleted_at.is_(None),
            )
            .order_by(IPReservation.created_at.desc())
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def cleanup_expired_reservations(self) -> int:
        """
        Clean up expired reservations.

        Returns:
            Number of reservations cleaned up
        """
        now = datetime.utcnow()

        stmt = select(IPReservation).where(
            IPReservation.tenant_id == self.tenant_id,
            IPReservation.status == IPReservationStatus.RESERVED,
            IPReservation.expires_at.is_not(None),
            IPReservation.expires_at < now,
            IPReservation.deleted_at.is_(None),
        )

        result = await self.db.execute(stmt)
        reservations = result.scalars().all()

        count = 0
        for reservation in reservations:
            reservation.status = IPReservationStatus.EXPIRED
            count += 1

            # Update pool counters
            pool = await self.get_pool(reservation.pool_id)
            if pool:
                pool.reserved_count -= 1
                await self._update_pool_utilization(pool)

        await self.db.flush()

        if count > 0:
            logger.info(
                "expired_reservations_cleaned",
                count=count,
                tenant_id=self.tenant_id,
            )

        return count
