"""
GraphQL queries and mutations for IP management.

Provides operations for managing IP pools and reservations with conflict detection.
"""

import json
from uuid import UUID

import strawberry
import structlog
from sqlalchemy import func, select

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.ip_management import (
    IPAvailability,
    IPConflictCheckInput,
    IPConflictResult,
    IPPool,
    IPPoolCreateInput,
    IPPoolStatusEnum,
    IPPoolTypeEnum,
    IPPoolUpdateInput,
    IPReservation,
    IPReservationAutoAssignInput,
    IPReservationCreateInput,
    IPReservationStatusEnum,
    TenantIPStats,
)
from dotmac.platform.ip_management.ip_service import (
    IPConflictError,
    IPManagementService,
    IPPoolDepletedError,
)
from dotmac.platform.ip_management.models import (
    IPPool as IPPoolModel,
)
from dotmac.platform.ip_management.models import (
    IPPoolStatus,
    IPPoolType,
    IPReservationStatus,
)
from dotmac.platform.ip_management.models import (
    IPReservation as IPReservationModel,
)

logger = structlog.get_logger(__name__)


# ============================================================================
# Helper Functions
# ============================================================================


def _to_graphql_pool_type(db_type: IPPoolType) -> IPPoolTypeEnum:
    """Convert database enum to GraphQL enum."""
    return IPPoolTypeEnum(db_type.value)


def _from_graphql_pool_type(graphql_type: IPPoolTypeEnum) -> IPPoolType:
    """Convert GraphQL enum to database enum."""
    return IPPoolType(graphql_type.value)


def _to_graphql_pool_status(db_status: IPPoolStatus) -> IPPoolStatusEnum:
    """Convert database enum to GraphQL enum."""
    return IPPoolStatusEnum(db_status.value)


def _from_graphql_pool_status(graphql_status: IPPoolStatusEnum) -> IPPoolStatus:
    """Convert GraphQL enum to database enum."""
    return IPPoolStatus(graphql_status.value)


def _to_graphql_reservation_status(db_status: IPReservationStatus) -> IPReservationStatusEnum:
    """Convert database enum to GraphQL enum."""
    return IPReservationStatusEnum(db_status.value)


def _to_ip_pool_type(db_pool: IPPoolModel) -> IPPool:
    """Convert database model to GraphQL type."""
    total = db_pool.total_addresses
    used = db_pool.reserved_count + db_pool.assigned_count
    available = max(0, total - used)
    utilization = round((used / total) * 100, 2) if total > 0 else 0.0

    return IPPool(
        id=str(db_pool.id),
        tenant_id=db_pool.tenant_id,
        pool_name=db_pool.pool_name,
        pool_type=_to_graphql_pool_type(db_pool.pool_type),
        network_cidr=db_pool.network_cidr,
        gateway=db_pool.gateway,
        dns_servers=db_pool.dns_servers,
        vlan_id=db_pool.vlan_id,
        status=_to_graphql_pool_status(db_pool.status),
        total_addresses=total,
        reserved_count=db_pool.reserved_count,
        assigned_count=db_pool.assigned_count,
        available_count=available,
        utilization_percent=utilization,
        netbox_prefix_id=db_pool.netbox_prefix_id,
        netbox_synced_at=db_pool.netbox_synced_at,
        auto_assign_enabled=db_pool.auto_assign_enabled,
        allow_manual_reservation=db_pool.allow_manual_reservation,
        description=db_pool.description,
        created_at=db_pool.created_at,
        updated_at=db_pool.updated_at,
    )


def _to_ip_reservation_type(db_reservation: IPReservationModel) -> IPReservation:
    """Convert database model to GraphQL type."""
    return IPReservation(
        id=str(db_reservation.id),
        tenant_id=db_reservation.tenant_id,
        pool_id=str(db_reservation.pool_id),
        subscriber_id=db_reservation.subscriber_id,
        ip_address=db_reservation.ip_address,
        ip_type=db_reservation.ip_type,
        prefix_length=db_reservation.prefix_length,
        status=_to_graphql_reservation_status(db_reservation.status),
        reserved_at=db_reservation.reserved_at,
        assigned_at=db_reservation.assigned_at,
        released_at=db_reservation.released_at,
        expires_at=db_reservation.expires_at,
        netbox_ip_id=db_reservation.netbox_ip_id,
        netbox_synced=db_reservation.netbox_synced,
        assigned_by=db_reservation.assigned_by,
        assignment_reason=db_reservation.assignment_reason,
        notes=db_reservation.notes,
        created_at=db_reservation.created_at,
        updated_at=db_reservation.updated_at,
    )


# ============================================================================
# Queries
# ============================================================================


@strawberry.type
class IPManagementQueries:
    """Queries for IP management."""

    @strawberry.field(description="List IP pools")  # type: ignore[misc]
    async def ip_pools(
        self,
        info: strawberry.Info[Context],
        pool_type: IPPoolTypeEnum | None = None,
        status: IPPoolStatusEnum | None = None,
        limit: int = 100,
    ) -> list[IPPool]:
        """
        List IP pools for the tenant.

        Args:
            pool_type: Filter by pool type
            status: Filter by status
            limit: Maximum number of pools to return (default: 100)

        Returns:
            List of IP pools
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        service = IPManagementService(context.db, tenant_id)

        # Convert GraphQL enums to database enums
        db_pool_type = _from_graphql_pool_type(pool_type) if pool_type else None
        db_status = _from_graphql_pool_status(status) if status else None

        pools = await service.list_pools(
            pool_type=db_pool_type,
            status=db_status,
            limit=limit,
        )

        return [_to_ip_pool_type(pool) for pool in pools]

    @strawberry.field(description="Get IP pool by ID")  # type: ignore[misc]
    async def ip_pool(
        self,
        info: strawberry.Info[Context],
        pool_id: str,
    ) -> IPPool | None:
        """
        Get IP pool by ID.

        Args:
            pool_id: Pool ID

        Returns:
            IP pool if found, None otherwise
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        service = IPManagementService(context.db, tenant_id)
        pool = await service.get_pool(UUID(pool_id))

        if not pool:
            return None

        return _to_ip_pool_type(pool)

    @strawberry.field(description="Get available IPs in pool")  # type: ignore[misc]
    async def ip_pool_availability(
        self,
        info: strawberry.Info[Context],
        pool_id: str,
    ) -> IPAvailability | None:
        """
        Get available IP information for a pool.

        Args:
            pool_id: Pool ID

        Returns:
            IP availability information
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        service = IPManagementService(context.db, tenant_id)
        pool = await service.get_pool(UUID(pool_id))

        if not pool:
            return None

        available_ip = await service.find_available_ip(UUID(pool_id))
        available_count = pool.total_addresses - (pool.reserved_count + pool.assigned_count)

        return IPAvailability(
            available_ip=available_ip,
            pool_id=pool_id,
            total_available=available_count,
        )

    @strawberry.field(description="Get IP reservation by ID")  # type: ignore[misc]
    async def ip_reservation(
        self,
        info: strawberry.Info[Context],
        reservation_id: str,
    ) -> IPReservation | None:
        """
        Get IP reservation by ID.

        Args:
            reservation_id: Reservation ID

        Returns:
            IP reservation if found, None otherwise
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        stmt = select(IPReservationModel).where(
            IPReservationModel.id == UUID(reservation_id),
            IPReservationModel.tenant_id == tenant_id,
        )
        result = await context.db.execute(stmt)
        reservation = result.scalar_one_or_none()

        if not reservation:
            return None

        return _to_ip_reservation_type(reservation)

    @strawberry.field(description="Get subscriber IP reservations")  # type: ignore[misc]
    async def subscriber_ip_reservations(
        self,
        info: strawberry.Info[Context],
        subscriber_id: str,
    ) -> list[IPReservation]:
        """
        Get all IP reservations for a subscriber.

        Args:
            subscriber_id: Subscriber ID

        Returns:
            List of IP reservations
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        service = IPManagementService(context.db, tenant_id)
        reservations = await service.get_subscriber_reservations(subscriber_id)

        return [_to_ip_reservation_type(r) for r in reservations]

    @strawberry.field(description="Check for IP conflicts")  # type: ignore[misc]
    async def check_ip_conflict(
        self,
        info: strawberry.Info[Context],
        check: IPConflictCheckInput,
    ) -> IPConflictResult:
        """
        Check for IP address conflicts.

        Args:
            check: Conflict check input

        Returns:
            Conflict check result
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        service = IPManagementService(context.db, tenant_id)
        conflicts = await service.check_ip_conflicts(check.ip_address)

        # Serialize conflicts as JSON strings for GraphQL
        conflict_json_list = [json.dumps(c) for c in conflicts]

        return IPConflictResult(
            has_conflict=len(conflicts) > 0,
            ip_address=check.ip_address,
            conflicts=conflict_json_list,
        )

    @strawberry.field(description="Get tenant IP statistics")  # type: ignore[misc]
    async def tenant_ip_stats(
        self,
        info: strawberry.Info[Context],
    ) -> TenantIPStats:
        """
        Get aggregated IP statistics for the tenant.

        Returns:
            Tenant IP statistics
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        # Query pool statistics
        stmt = select(
            func.count(IPPoolModel.id).label("total_pools"),
            func.sum(func.case((IPPoolModel.status == IPPoolStatus.ACTIVE, 1), else_=0)).label(
                "active_pools"
            ),
            func.sum(func.case((IPPoolModel.status == IPPoolStatus.DEPLETED, 1), else_=0)).label(
                "depleted_pools"
            ),
            func.sum(IPPoolModel.total_addresses).label("total_ips"),
            func.sum(IPPoolModel.reserved_count).label("reserved_ips"),
            func.sum(IPPoolModel.assigned_count).label("assigned_ips"),
            func.sum(
                func.case(
                    (
                        IPPoolModel.pool_type.in_(
                            [IPPoolType.IPV4_PUBLIC, IPPoolType.IPV4_PRIVATE]
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("ipv4_pools"),
        ).where(
            IPPoolModel.tenant_id == tenant_id,
            IPPoolModel.deleted_at.is_(None),
        )

        result = await context.db.execute(stmt)
        row = result.one()

        total_ips = row.total_ips or 0
        reserved_ips = row.reserved_ips or 0
        assigned_ips = row.assigned_ips or 0
        available_ips = max(0, total_ips - reserved_ips - assigned_ips)
        utilization = (
            round(((reserved_ips + assigned_ips) / total_ips) * 100, 2) if total_ips > 0 else 0.0
        )

        return TenantIPStats(
            tenant_id=tenant_id,
            total_pools=row.total_pools or 0,
            active_pools=row.active_pools or 0,
            depleted_pools=row.depleted_pools or 0,
            total_ips=total_ips,
            reserved_ips=reserved_ips,
            assigned_ips=assigned_ips,
            available_ips=available_ips,
            utilization_percent=utilization,
            ipv4_pools=row.ipv4_pools or 0,
            ipv6_pools=0,  # TODO: Implement IPv6 detection
        )


# ============================================================================
# Mutations
# ============================================================================


@strawberry.type
class IPManagementMutations:
    """Mutations for IP management."""

    @strawberry.mutation(description="Create IP pool")  # type: ignore[misc]
    async def create_ip_pool(
        self,
        info: strawberry.Info[Context],
        pool: IPPoolCreateInput,
    ) -> IPPool:
        """
        Create a new IP pool.

        Args:
            pool: Pool creation input

        Returns:
            Created IP pool
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        service = IPManagementService(context.db, tenant_id)

        # Convert GraphQL enum to database enum
        db_pool_type = _from_graphql_pool_type(pool.pool_type)

        db_pool = await service.create_pool(
            pool_name=pool.pool_name,
            pool_type=db_pool_type,
            network_cidr=pool.network_cidr,
            gateway=pool.gateway,
            dns_servers=pool.dns_servers,
            vlan_id=pool.vlan_id,
            description=pool.description,
            auto_assign_enabled=pool.auto_assign_enabled,
        )

        await context.db.commit()

        logger.info(
            "ip_pool_created_graphql",
            pool_id=str(db_pool.id),
            tenant_id=tenant_id,
            pool_name=pool.pool_name,
        )

        return _to_ip_pool_type(db_pool)

    @strawberry.mutation(description="Update IP pool")  # type: ignore[misc]
    async def update_ip_pool(
        self,
        info: strawberry.Info[Context],
        pool_id: str,
        updates: IPPoolUpdateInput,
    ) -> IPPool | None:
        """
        Update an IP pool.

        Args:
            pool_id: Pool ID
            updates: Pool update input

        Returns:
            Updated IP pool
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()

        service = IPManagementService(context.db, tenant_id)
        pool = await service.get_pool(UUID(pool_id))

        if not pool:
            return None

        # Apply updates
        if updates.pool_name is not None:
            pool.pool_name = updates.pool_name
        if updates.status is not None:
            pool.status = _from_graphql_pool_status(updates.status)
        if updates.gateway is not None:
            pool.gateway = updates.gateway
        if updates.dns_servers is not None:
            pool.dns_servers = updates.dns_servers
        if updates.vlan_id is not None:
            pool.vlan_id = updates.vlan_id
        if updates.description is not None:
            pool.description = updates.description
        if updates.auto_assign_enabled is not None:
            pool.auto_assign_enabled = updates.auto_assign_enabled
        if updates.allow_manual_reservation is not None:
            pool.allow_manual_reservation = updates.allow_manual_reservation

        await context.db.commit()
        await context.db.refresh(pool)

        logger.info(
            "ip_pool_updated_graphql",
            pool_id=pool_id,
            tenant_id=tenant_id,
        )

        return _to_ip_pool_type(pool)

    @strawberry.mutation(description="Reserve specific IP address")  # type: ignore[misc]
    async def reserve_ip(
        self,
        info: strawberry.Info[Context],
        reservation: IPReservationCreateInput,
    ) -> IPReservation:
        """
        Manually reserve a specific IP address.

        Args:
            reservation: Reservation creation input

        Returns:
            Created IP reservation

        Raises:
            Exception: If IP conflict detected or validation fails
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        user_email = context.current_user.email if context.current_user else "unknown"

        service = IPManagementService(context.db, tenant_id)

        try:
            db_reservation = await service.reserve_ip(
                subscriber_id=reservation.subscriber_id,
                ip_address=reservation.ip_address,
                pool_id=UUID(reservation.pool_id),
                ip_type=reservation.ip_type,
                assigned_by=user_email,
                assignment_reason=reservation.assignment_reason,
            )
            await context.db.commit()

            logger.info(
                "ip_reserved_graphql",
                reservation_id=str(db_reservation.id),
                ip_address=reservation.ip_address,
                subscriber_id=reservation.subscriber_id,
                tenant_id=tenant_id,
            )

            return _to_ip_reservation_type(db_reservation)

        except IPConflictError as e:
            logger.warning(
                "ip_conflict_detected_graphql",
                ip_address=e.ip_address,
                conflicts=e.conflicts,
                tenant_id=tenant_id,
            )
            raise Exception(f"IP conflict detected for {e.ip_address}: {e.conflicts}")
        except ValueError as e:
            logger.warning("ip_reservation_validation_error", error=str(e), tenant_id=tenant_id)
            raise Exception(str(e))

    @strawberry.mutation(description="Auto-assign available IP")  # type: ignore[misc]
    async def auto_assign_ip(
        self,
        info: strawberry.Info[Context],
        request: IPReservationAutoAssignInput,
    ) -> IPReservation:
        """
        Automatically assign an available IP from pool.

        Args:
            request: Auto-assignment input

        Returns:
            Created IP reservation

        Raises:
            Exception: If pool depleted or validation fails
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        user_email = context.current_user.email if context.current_user else "unknown"

        service = IPManagementService(context.db, tenant_id)

        try:
            db_reservation = await service.assign_ip_auto(
                subscriber_id=request.subscriber_id,
                pool_id=UUID(request.pool_id),
                ip_type=request.ip_type,
                assigned_by=user_email,
            )
            await context.db.commit()

            logger.info(
                "ip_auto_assigned_graphql",
                reservation_id=str(db_reservation.id),
                ip_address=db_reservation.ip_address,
                subscriber_id=request.subscriber_id,
                tenant_id=tenant_id,
            )

            return _to_ip_reservation_type(db_reservation)

        except IPPoolDepletedError as e:
            logger.warning("ip_pool_depleted_graphql", error=str(e), tenant_id=tenant_id)
            raise Exception(str(e))
        except ValueError as e:
            logger.warning("ip_auto_assign_validation_error", error=str(e), tenant_id=tenant_id)
            raise Exception(str(e))

    @strawberry.mutation(description="Release IP reservation")  # type: ignore[misc]
    async def release_ip(
        self,
        info: strawberry.Info[Context],
        reservation_id: str,
    ) -> bool:
        """
        Release an IP reservation.

        Args:
            reservation_id: Reservation ID

        Returns:
            True if released, False if not found
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        user_email = context.current_user.email if context.current_user else "unknown"

        service = IPManagementService(context.db, tenant_id)
        released = await service.release_ip(
            reservation_id=UUID(reservation_id),
            released_by=user_email,
        )

        if released:
            await context.db.commit()
            logger.info(
                "ip_released_graphql",
                reservation_id=reservation_id,
                tenant_id=tenant_id,
                released_by=user_email,
            )

        return released
