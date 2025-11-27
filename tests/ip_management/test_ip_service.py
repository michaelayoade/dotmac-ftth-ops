"""
Tests for IP management service.
"""

from uuid import uuid4

import pytest

from dotmac.platform.ip_management.ip_service import (
    IPConflictError,
    IPManagementService,
    IPPoolDepletedError,
)
from dotmac.platform.ip_management.models import (
    IPPoolStatus,
    IPPoolType,
    IPReservationStatus,
)

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


# ============================================================================
# Pool Management Tests
# ============================================================================


async def test_create_pool_basic(async_db_session, test_tenant):
    """Test basic pool creation."""
    service = IPManagementService(async_db_session, test_tenant.id)

    pool = await service.create_pool(
        pool_name="Test Public Pool",
        pool_type=IPPoolType.IPV4_PUBLIC,
        network_cidr="203.0.113.0/24",
        gateway="203.0.113.1",
        dns_servers="8.8.8.8,8.8.4.4",
    )

    assert pool.pool_name == "Test Public Pool"
    assert pool.pool_type == IPPoolType.IPV4_PUBLIC
    assert pool.network_cidr == "203.0.113.0/24"
    assert pool.gateway == "203.0.113.1"
    assert pool.status == IPPoolStatus.ACTIVE
    assert pool.total_addresses == 253  # /24 (256) - network - broadcast - gateway
    assert pool.reserved_count == 0
    assert pool.assigned_count == 0


async def test_create_pool_with_vlan(async_db_session, test_tenant):
    """Test pool creation with VLAN ID."""
    service = IPManagementService(async_db_session, test_tenant.id)

    pool = await service.create_pool(
        pool_name="VLAN 100 Pool",
        pool_type=IPPoolType.IPV4_PUBLIC,
        network_cidr="10.100.0.0/24",
        vlan_id=100,
    )

    assert pool.vlan_id == 100


async def test_create_pool_invalid_cidr(async_db_session, test_tenant):
    """Test pool creation with invalid CIDR."""
    service = IPManagementService(async_db_session, test_tenant.id)

    with pytest.raises(ValueError, match="Invalid network CIDR"):
        await service.create_pool(
            pool_name="Invalid Pool",
            pool_type=IPPoolType.IPV4_PUBLIC,
            network_cidr="invalid-cidr",
        )


async def test_list_pools(async_db_session, test_tenant, ip_pool_factory):
    """Test listing pools with filters."""
    service = IPManagementService(async_db_session, test_tenant.id)

    # Create multiple pools
    await ip_pool_factory(
        pool_name="Public Pool 1",
        pool_type=IPPoolType.IPV4_PUBLIC,
        network_cidr="203.0.113.0/24",
    )
    await ip_pool_factory(
        pool_name="Private Pool 1",
        pool_type=IPPoolType.IPV4_PRIVATE,
        network_cidr="10.0.1.0/24",
    )
    await ip_pool_factory(
        pool_name="Public Pool 2",
        pool_type=IPPoolType.IPV4_PUBLIC,
        network_cidr="203.0.114.0/24",
        status=IPPoolStatus.DEPLETED,
    )

    # List all pools
    all_pools = await service.list_pools()
    assert len(all_pools) == 3

    # Filter by type
    public_pools = await service.list_pools(pool_type=IPPoolType.IPV4_PUBLIC)
    assert len(public_pools) == 2

    # Filter by status
    depleted_pools = await service.list_pools(status=IPPoolStatus.DEPLETED)
    assert len(depleted_pools) == 1


async def test_get_pool(async_db_session, test_tenant, test_ip_pool):
    """Test getting a pool by ID."""
    service = IPManagementService(async_db_session, test_tenant.id)

    pool = await service.get_pool(test_ip_pool.id)
    assert pool is not None
    assert pool.id == test_ip_pool.id


async def test_get_pool_not_found(async_db_session, test_tenant):
    """Test getting non-existent pool."""
    service = IPManagementService(async_db_session, test_tenant.id)

    pool = await service.get_pool(uuid4())
    assert pool is None


async def test_update_pool_status(async_db_session, test_tenant, test_ip_pool):
    """Test updating pool status."""
    service = IPManagementService(async_db_session, test_tenant.id)

    updated_pool = await service.update_pool_status(
        test_ip_pool.id,
        IPPoolStatus.RESERVED,
    )

    assert updated_pool.status == IPPoolStatus.RESERVED


# ============================================================================
# Conflict Detection Tests
# ============================================================================


async def test_check_ip_conflicts_none(async_db_session, test_tenant, test_ip_pool):
    """Test conflict check with no conflicts."""
    service = IPManagementService(async_db_session, test_tenant.id)

    conflicts = await service.check_ip_conflicts("192.168.1.100")
    assert len(conflicts) == 0


async def test_check_ip_conflicts_existing(
    async_db_session,
    test_tenant,
    test_ip_pool,
    test_subscriber,
    ip_reservation_factory,
):
    """Test conflict check with existing reservation."""
    service = IPManagementService(async_db_session, test_tenant.id)

    # Create existing reservation
    await ip_reservation_factory(
        pool_id=test_ip_pool.id,
        subscriber_id=test_subscriber.id,
        ip_address="192.168.1.100",
        status=IPReservationStatus.ASSIGNED,
    )

    conflicts = await service.check_ip_conflicts("192.168.1.100")
    assert len(conflicts) == 1
    assert conflicts[0]["type"] == "reservation"
    assert conflicts[0]["subscriber_id"] == test_subscriber.id


async def test_validate_ip_in_pool(async_db_session, test_tenant, test_ip_pool):
    """Test IP validation against pool network."""
    service = IPManagementService(async_db_session, test_tenant.id)

    # Valid IP in pool
    assert await service.validate_ip_in_pool("192.168.1.100", test_ip_pool.id) is True

    # Invalid IP outside pool
    assert await service.validate_ip_in_pool("10.0.0.1", test_ip_pool.id) is False


# ============================================================================
# IP Assignment Tests
# ============================================================================


async def test_reserve_ip_manual(
    async_db_session,
    test_tenant,
    test_ip_pool,
    test_subscriber,
):
    """Test manual IP reservation."""
    service = IPManagementService(async_db_session, test_tenant.id)

    reservation = await service.reserve_ip(
        subscriber_id=test_subscriber.id,
        ip_address="192.168.1.100",
        pool_id=test_ip_pool.id,
        assigned_by="admin@example.com",
        assignment_reason="Static IP request",
    )

    assert reservation.ip_address == "192.168.1.100"
    assert reservation.subscriber_id == test_subscriber.id
    assert reservation.status == IPReservationStatus.RESERVED
    assert reservation.assigned_by == "admin@example.com"

    # Verify pool counters updated
    await async_db_session.refresh(test_ip_pool)
    assert test_ip_pool.reserved_count == 1


async def test_reserve_ip_conflict(
    async_db_session,
    test_tenant,
    test_ip_pool,
    test_subscriber,
    ip_reservation_factory,
):
    """Test IP reservation with conflict."""
    service = IPManagementService(async_db_session, test_tenant.id)

    # Create existing reservation
    await ip_reservation_factory(
        pool_id=test_ip_pool.id,
        subscriber_id=test_subscriber.id,
        ip_address="192.168.1.100",
    )

    # Try to reserve same IP
    with pytest.raises(IPConflictError) as exc_info:
        await service.reserve_ip(
            subscriber_id="another-subscriber",
            ip_address="192.168.1.100",
            pool_id=test_ip_pool.id,
        )

    assert exc_info.value.ip_address == "192.168.1.100"
    assert len(exc_info.value.conflicts) > 0


async def test_reserve_ip_not_in_pool(
    async_db_session,
    test_tenant,
    test_ip_pool,
    test_subscriber,
):
    """Test IP reservation outside pool network."""
    service = IPManagementService(async_db_session, test_tenant.id)

    with pytest.raises(ValueError, match="not in pool"):
        await service.reserve_ip(
            subscriber_id=test_subscriber.id,
            ip_address="10.0.0.1",  # Outside pool network
            pool_id=test_ip_pool.id,
        )


async def test_assign_ip_auto(
    async_db_session,
    test_tenant,
    test_ip_pool,
    test_subscriber,
):
    """Test automatic IP assignment."""
    service = IPManagementService(async_db_session, test_tenant.id)

    reservation = await service.assign_ip_auto(
        subscriber_id=test_subscriber.id,
        pool_id=test_ip_pool.id,
        assigned_by="system",
    )

    assert reservation.ip_address is not None
    assert reservation.subscriber_id == test_subscriber.id
    assert reservation.status == IPReservationStatus.ASSIGNED
    assert reservation.assignment_reason == "Auto-assigned"

    # Verify pool counters updated
    await async_db_session.refresh(test_ip_pool)
    assert test_ip_pool.assigned_count == 1


async def test_assign_ip_auto_pool_depleted(
    async_db_session,
    test_tenant,
    test_subscriber,
):
    """Test auto-assignment from depleted pool."""
    service = IPManagementService(async_db_session, test_tenant.id)

    # Create a very small pool (only 1 usable IP)
    # /30 has 4 addresses: network, 2 hosts, broadcast
    # Minus network and broadcast = 2 hosts
    # Minus gateway = 1 usable IP
    pool = await service.create_pool(
        pool_name="Tiny Pool",
        pool_type=IPPoolType.IPV4_PUBLIC,
        network_cidr="203.0.113.0/30",
        gateway="203.0.113.1",  # Specify gateway to leave only 1 usable IP
    )

    # Verify we have only 1 usable IP
    assert pool.total_addresses == 1

    # Assign the only available IP
    await service.assign_ip_auto(
        subscriber_id=test_subscriber.id,
        pool_id=pool.id,
    )

    # Try to assign another - should fail
    with pytest.raises(IPPoolDepletedError):
        await service.assign_ip_auto(
            subscriber_id="another-subscriber",
            pool_id=pool.id,
        )


async def test_mark_assigned(
    async_db_session,
    test_tenant,
    test_ip_pool,
    test_subscriber,
    ip_reservation_factory,
):
    """Test marking reservation as assigned."""
    service = IPManagementService(async_db_session, test_tenant.id)

    # Create reservation in RESERVED state
    reservation = await ip_reservation_factory(
        pool_id=test_ip_pool.id,
        subscriber_id=test_subscriber.id,
        ip_address="192.168.1.100",
        status=IPReservationStatus.RESERVED,
    )

    # Manually update pool counter to match the reservation we created
    # (normally this would be done by reserve_ip service method)
    test_ip_pool.reserved_count = 1
    await async_db_session.flush()

    # Mark as assigned
    updated = await service.mark_assigned(reservation.id)

    assert updated.status == IPReservationStatus.ASSIGNED
    assert updated.assigned_at is not None

    # Verify pool counters
    await async_db_session.refresh(test_ip_pool)
    assert test_ip_pool.reserved_count == 0
    assert test_ip_pool.assigned_count == 1


async def test_release_ip(
    async_db_session,
    test_tenant,
    test_ip_pool,
    test_subscriber,
    ip_reservation_factory,
):
    """Test releasing IP reservation."""
    service = IPManagementService(async_db_session, test_tenant.id)

    # Create assigned reservation
    reservation = await ip_reservation_factory(
        pool_id=test_ip_pool.id,
        subscriber_id=test_subscriber.id,
        ip_address="192.168.1.100",
        status=IPReservationStatus.ASSIGNED,
    )

    # Update pool counters manually for test
    test_ip_pool.assigned_count = 1
    await async_db_session.flush()

    # Release IP
    released = await service.release_ip(
        reservation_id=reservation.id,
        released_by="admin@example.com",
    )

    assert released is True

    # Verify reservation status
    await async_db_session.refresh(reservation)
    assert reservation.status == IPReservationStatus.RELEASED
    assert reservation.released_at is not None

    # Verify pool counters
    await async_db_session.refresh(test_ip_pool)
    assert test_ip_pool.assigned_count == 0


async def test_find_available_ip(async_db_session, test_tenant, test_ip_pool):
    """Test finding available IP in pool."""
    service = IPManagementService(async_db_session, test_tenant.id)

    # Find first available IP
    ip = await service.find_available_ip(test_ip_pool.id)
    assert ip is not None
    assert ip.startswith("192.168.1.")


async def test_find_available_ip_skips_gateway(
    async_db_session,
    test_tenant,
    test_ip_pool,
):
    """Test that gateway IP is excluded from available IPs."""
    service = IPManagementService(async_db_session, test_tenant.id)

    # Get first 10 available IPs
    available_ips = []
    for _ in range(10):
        ip = await service.find_available_ip(test_ip_pool.id)
        if ip:
            available_ips.append(ip)

    # Gateway should not be in the list
    assert test_ip_pool.gateway not in available_ips


async def test_get_subscriber_reservations(
    async_db_session,
    test_tenant,
    test_ip_pool,
    test_subscriber,
    ip_reservation_factory,
):
    """Test getting all reservations for a subscriber."""
    service = IPManagementService(async_db_session, test_tenant.id)

    # Create multiple reservations with different IP types to avoid UNIQUE constraint
    # In reality, a subscriber might have both IPv4 and IPv6 addresses
    await ip_reservation_factory(
        pool_id=test_ip_pool.id,
        subscriber_id=test_subscriber.id,
        ip_address="192.168.1.100",
        ip_type="ipv4",
    )
    await ip_reservation_factory(
        pool_id=test_ip_pool.id,
        subscriber_id=test_subscriber.id,
        ip_address="2001:db8::1",
        ip_type="ipv6",
    )

    reservations = await service.get_subscriber_reservations(test_subscriber.id)

    assert len(reservations) == 2


# ============================================================================
# Lifecycle Management Tests
# ============================================================================


async def test_cleanup_expired_reservations(
    async_db_session,
    test_tenant,
    test_ip_pool,
    test_subscriber,
    ip_reservation_factory,
):
    """Test cleanup of expired reservations."""
    from datetime import datetime, timedelta

    service = IPManagementService(async_db_session, test_tenant.id)

    # Create expired reservation
    expired_time = datetime.utcnow() - timedelta(hours=1)
    await ip_reservation_factory(
        pool_id=test_ip_pool.id,
        subscriber_id=test_subscriber.id,
        ip_address="192.168.1.100",
        status=IPReservationStatus.RESERVED,
        reserved_at=expired_time,
    )

    # Update the reservation to set expires_at
    from sqlalchemy import select, update

    from dotmac.platform.ip_management.models import IPReservation

    stmt = (
        update(IPReservation)
        .where(IPReservation.ip_address == "192.168.1.100")
        .values(expires_at=expired_time)
    )
    await async_db_session.execute(stmt)
    await async_db_session.commit()

    # Update pool counter manually
    test_ip_pool.reserved_count = 1
    await async_db_session.flush()

    # Run cleanup
    count = await service.cleanup_expired_reservations()

    assert count == 1

    # Verify reservation status changed
    stmt = select(IPReservation).where(IPReservation.ip_address == "192.168.1.100")
    result = await async_db_session.execute(stmt)
    reservation = result.scalar_one()
    assert reservation.status == IPReservationStatus.EXPIRED

    # Verify pool counter updated
    await async_db_session.refresh(test_ip_pool)
    assert test_ip_pool.reserved_count == 0


# ============================================================================
# Pool Utilization Tests
# ============================================================================


async def test_pool_utilization_update(
    async_db_session,
    test_tenant,
    test_ip_pool,
    test_subscriber,
):
    """Test pool utilization status updates."""
    service = IPManagementService(async_db_session, test_tenant.id)

    # Initially active
    assert test_ip_pool.status == IPPoolStatus.ACTIVE

    # Manually set pool to fully utilized
    test_ip_pool.total_addresses = 10
    test_ip_pool.assigned_count = 10
    await async_db_session.flush()

    # Update utilization (internal method)
    await service._update_pool_utilization(test_ip_pool)

    # Should be marked as depleted
    assert test_ip_pool.status == IPPoolStatus.DEPLETED

    # Free up an IP
    test_ip_pool.assigned_count = 9
    await service._update_pool_utilization(test_ip_pool)

    # Should be active again
    assert test_ip_pool.status == IPPoolStatus.ACTIVE
