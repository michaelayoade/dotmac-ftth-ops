"""
Tests for IPv4 Lifecycle Management Service (Phase 5).

Covers all lifecycle state transitions, NetBox/RADIUS integration, and error cases.
"""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from dotmac.platform.ip_management.models import IPPool, IPReservation
from dotmac.platform.network.ipv4_lifecycle_service import IPv4LifecycleService
from dotmac.platform.network.lifecycle_protocol import (
    AllocationError,
    InvalidTransitionError,
    LifecycleState,
)


@pytest.fixture
async def ip_pool(async_db_session, tenant_id):
    """Create a test IP pool."""
    pool = IPPool(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        name="Test Pool",
        network="192.168.1.0/24",
        gateway="192.168.1.1",
        start_address="192.168.1.10",
        end_address="192.168.1.100",
        vlan_id=100,
        is_active=True,
    )
    async_db_session.add(pool)
    await async_db_session.commit()
    return pool


@pytest.fixture
async def ip_reservation(async_db_session, subscriber, ip_pool):
    """Create a test IP reservation in PENDING state."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="reserved",
        lifecycle_state="pending",
    )
    async_db_session.add(reservation)
    await async_db_session.commit()
    return reservation


# =============================================================================
# Allocation Tests
# =============================================================================


@pytest.mark.asyncio
async def test_allocate_success(async_db_session, subscriber, ip_reservation):
    """Test successful IPv4 address allocation."""
    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    result = await service.allocate(
        subscriber_id=uuid.UUID(subscriber.id),
        commit=True,
    )

    # Verify result
    assert result.success is True
    assert result.state == LifecycleState.ALLOCATED
    assert result.address == "192.168.1.50"
    assert result.allocated_at is not None

    # Verify database state
    stmt = select(IPReservation).where(IPReservation.subscriber_id == subscriber.id)
    db_result = await async_db_session.execute(stmt)
    reservation = db_result.scalar_one()
    assert reservation.lifecycle_state == "allocated"
    assert reservation.lifecycle_allocated_at is not None


@pytest.mark.asyncio
async def test_allocate_with_pool_id(async_db_session, subscriber, ip_pool):
    """Test allocation with specific pool ID."""
    # Create reservation in PENDING state
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.51",
        status="reserved",
        lifecycle_state="pending",
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    result = await service.allocate(
        subscriber_id=uuid.UUID(subscriber.id),
        pool_id=uuid.UUID(ip_pool.id),
        commit=True,
    )

    assert result.success is True
    assert result.state == LifecycleState.ALLOCATED


@pytest.mark.asyncio
async def test_allocate_with_requested_address(async_db_session, subscriber, ip_pool):
    """Test allocation with specific requested address."""
    # Create reservation for specific address
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.99",
        status="reserved",
        lifecycle_state="pending",
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    result = await service.allocate(
        subscriber_id=uuid.UUID(subscriber.id),
        requested_address="192.168.1.99",
        commit=True,
    )

    assert result.success is True
    assert result.address == "192.168.1.99"
    assert result.state == LifecycleState.ALLOCATED


@pytest.mark.asyncio
async def test_allocate_invalid_state(async_db_session, subscriber, ip_pool):
    """Test allocation fails from non-PENDING state."""
    # Create reservation already in ACTIVE state
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="assigned",
        lifecycle_state="active",
        lifecycle_allocated_at=datetime.now(UTC),
        lifecycle_activated_at=datetime.now(UTC),
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    with pytest.raises(InvalidTransitionError) as exc_info:
        await service.allocate(subscriber_id=uuid.UUID(subscriber.id), commit=True)

    assert "active" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_allocate_no_reservation(async_db_session, subscriber):
    """Test allocation fails when no reservation exists."""
    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    with pytest.raises(AllocationError) as exc_info:
        await service.allocate(subscriber_id=uuid.UUID(subscriber.id), commit=True)

    assert "no ip reservation found" in str(exc_info.value).lower()


# =============================================================================
# Activation Tests
# =============================================================================


@pytest.mark.asyncio
async def test_activate_success(async_db_session, subscriber, ip_pool):
    """Test successful IPv4 address activation."""
    # Create reservation in ALLOCATED state
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="reserved",
        lifecycle_state="allocated",
        lifecycle_allocated_at=datetime.now(UTC),
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    result = await service.activate(
        subscriber_id=uuid.UUID(subscriber.id),
        commit=True,
    )

    assert result.success is True
    assert result.state == LifecycleState.ACTIVE
    assert result.activated_at is not None

    # Verify database state
    await async_db_session.refresh(reservation)
    assert reservation.lifecycle_state == "active"
    assert reservation.lifecycle_activated_at is not None


@pytest.mark.asyncio
async def test_activate_with_netbox(async_db_session, subscriber, ip_pool):
    """Test activation with NetBox integration."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="reserved",
        lifecycle_state="allocated",
        lifecycle_allocated_at=datetime.now(UTC),
        lifecycle_metadata={"netbox_ip_id": 12345},
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    mock_netbox = AsyncMock()
    mock_netbox.update_ip_status = AsyncMock(return_value=True)

    service = IPv4LifecycleService(
        async_db_session, subscriber.tenant_id, netbox_client=mock_netbox
    )

    result = await service.activate(
        subscriber_id=uuid.UUID(subscriber.id),
        update_netbox=True,
        commit=True,
    )

    assert result.success is True
    assert result.state == LifecycleState.ACTIVE
    # Verify NetBox was called
    mock_netbox.update_ip_status.assert_called_once()


@pytest.mark.asyncio
async def test_activate_with_radius_coa(async_db_session, subscriber, ip_pool):
    """Test activation with RADIUS CoA."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="reserved",
        lifecycle_state="allocated",
        lifecycle_allocated_at=datetime.now(UTC),
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    mock_radius = AsyncMock()
    mock_radius.send_coa = AsyncMock(return_value={"success": True})

    service = IPv4LifecycleService(
        async_db_session, subscriber.tenant_id, radius_client=mock_radius
    )

    result = await service.activate(
        subscriber_id=uuid.UUID(subscriber.id),
        username="test@example.com",
        nas_ip="10.0.0.1",
        send_coa=True,
        commit=True,
    )

    assert result.success is True
    assert result.coa_result is not None
    # Verify RADIUS CoA was sent
    mock_radius.send_coa.assert_called_once()


@pytest.mark.asyncio
async def test_activate_invalid_state(async_db_session, subscriber, ip_pool):
    """Test activation fails from non-ALLOCATED state."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="reserved",
        lifecycle_state="pending",
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    with pytest.raises(InvalidTransitionError) as exc_info:
        await service.activate(subscriber_id=uuid.UUID(subscriber.id), commit=True)

    assert "pending" in str(exc_info.value).lower()


# =============================================================================
# Suspension Tests
# =============================================================================


@pytest.mark.asyncio
async def test_suspend_success(async_db_session, subscriber, ip_pool):
    """Test successful IPv4 address suspension."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="assigned",
        lifecycle_state="active",
        lifecycle_allocated_at=datetime.now(UTC),
        lifecycle_activated_at=datetime.now(UTC),
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    result = await service.suspend(
        subscriber_id=uuid.UUID(subscriber.id),
        reason="Non-payment",
        commit=True,
    )

    assert result.success is True
    assert result.state == LifecycleState.SUSPENDED
    assert result.suspended_at is not None

    # Verify database state
    await async_db_session.refresh(reservation)
    assert reservation.lifecycle_state == "suspended"
    assert reservation.lifecycle_suspended_at is not None
    assert reservation.lifecycle_metadata.get("suspension_reason") == "Non-payment"


@pytest.mark.asyncio
async def test_suspend_with_radius_coa(async_db_session, subscriber, ip_pool):
    """Test suspension with RADIUS CoA."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="assigned",
        lifecycle_state="active",
        lifecycle_allocated_at=datetime.now(UTC),
        lifecycle_activated_at=datetime.now(UTC),
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    mock_radius = AsyncMock()
    mock_radius.send_coa = AsyncMock(return_value={"success": True})

    service = IPv4LifecycleService(
        async_db_session, subscriber.tenant_id, radius_client=mock_radius
    )

    result = await service.suspend(
        subscriber_id=uuid.UUID(subscriber.id),
        username="test@example.com",
        nas_ip="10.0.0.1",
        send_coa=True,
        commit=True,
    )

    assert result.success is True
    mock_radius.send_coa.assert_called_once()


@pytest.mark.asyncio
async def test_suspend_invalid_state(async_db_session, subscriber, ip_pool):
    """Test suspension fails from non-ACTIVE state."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="reserved",
        lifecycle_state="allocated",
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    with pytest.raises(InvalidTransitionError):
        await service.suspend(subscriber_id=uuid.UUID(subscriber.id), commit=True)


# =============================================================================
# Reactivation Tests
# =============================================================================


@pytest.mark.asyncio
async def test_reactivate_success(async_db_session, subscriber, ip_pool):
    """Test successful IPv4 address reactivation."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="assigned",
        lifecycle_state="suspended",
        lifecycle_allocated_at=datetime.now(UTC),
        lifecycle_activated_at=datetime.now(UTC),
        lifecycle_suspended_at=datetime.now(UTC),
        lifecycle_metadata={"suspension_reason": "Non-payment"},
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    result = await service.reactivate(
        subscriber_id=uuid.UUID(subscriber.id),
        commit=True,
    )

    assert result.success is True
    assert result.state == LifecycleState.ACTIVE
    assert result.suspended_at is None  # Should be cleared

    # Verify database state
    await async_db_session.refresh(reservation)
    assert reservation.lifecycle_state == "active"
    assert reservation.lifecycle_suspended_at is None


@pytest.mark.asyncio
async def test_reactivate_invalid_state(async_db_session, subscriber, ip_pool):
    """Test reactivation fails from non-SUSPENDED state."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="reserved",
        lifecycle_state="allocated",
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    with pytest.raises(InvalidTransitionError):
        await service.reactivate(subscriber_id=uuid.UUID(subscriber.id), commit=True)


# =============================================================================
# Revocation Tests
# =============================================================================


@pytest.mark.asyncio
async def test_revoke_success(async_db_session, subscriber, ip_pool):
    """Test successful IPv4 address revocation."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="assigned",
        lifecycle_state="active",
        lifecycle_allocated_at=datetime.now(UTC),
        lifecycle_activated_at=datetime.now(UTC),
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    result = await service.revoke(
        subscriber_id=uuid.UUID(subscriber.id),
        release_to_pool=True,
        commit=True,
    )

    assert result.success is True
    assert result.state == LifecycleState.REVOKED
    assert result.revoked_at is not None

    # Verify database state
    await async_db_session.refresh(reservation)
    assert reservation.lifecycle_state == "revoked"
    assert reservation.lifecycle_revoked_at is not None
    assert reservation.status == "released"  # Backward compatibility


@pytest.mark.asyncio
async def test_revoke_with_radius_disconnect(async_db_session, subscriber, ip_pool):
    """Test revocation with RADIUS Disconnect-Request."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="assigned",
        lifecycle_state="active",
        lifecycle_allocated_at=datetime.now(UTC),
        lifecycle_activated_at=datetime.now(UTC),
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    mock_radius = AsyncMock()
    mock_radius.send_disconnect = AsyncMock(return_value={"success": True})

    service = IPv4LifecycleService(
        async_db_session, subscriber.tenant_id, radius_client=mock_radius
    )

    result = await service.revoke(
        subscriber_id=uuid.UUID(subscriber.id),
        username="test@example.com",
        nas_ip="10.0.0.1",
        send_disconnect=True,
        commit=True,
    )

    assert result.success is True
    assert result.disconnect_result is not None
    mock_radius.send_disconnect.assert_called_once()


@pytest.mark.asyncio
async def test_revoke_with_netbox_cleanup(async_db_session, subscriber, ip_pool):
    """Test revocation with NetBox IP deletion."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="assigned",
        lifecycle_state="active",
        lifecycle_allocated_at=datetime.now(UTC),
        lifecycle_activated_at=datetime.now(UTC),
        lifecycle_metadata={"netbox_ip_id": 12345},
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    mock_netbox = AsyncMock()
    mock_netbox.delete_ip = AsyncMock(return_value=True)

    service = IPv4LifecycleService(
        async_db_session, subscriber.tenant_id, netbox_client=mock_netbox
    )

    result = await service.revoke(
        subscriber_id=uuid.UUID(subscriber.id),
        update_netbox=True,
        commit=True,
    )

    assert result.success is True
    mock_netbox.delete_ip.assert_called_once_with(12345)


# =============================================================================
# State Query Tests
# =============================================================================


@pytest.mark.asyncio
async def test_get_state_success(async_db_session, subscriber, ip_reservation):
    """Test successful state query."""
    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    result = await service.get_state(uuid.UUID(subscriber.id))

    assert result is not None
    assert result.address == "192.168.1.50"
    assert result.state == LifecycleState.PENDING
    assert result.subscriber_id == uuid.UUID(subscriber.id)


@pytest.mark.asyncio
async def test_get_state_not_found(async_db_session, subscriber):
    """Test state query returns None when no reservation exists."""
    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    result = await service.get_state(uuid.UUID(subscriber.id))

    assert result is None


# =============================================================================
# Multi-tenant Isolation Tests
# =============================================================================


@pytest.mark.asyncio
async def test_tenant_isolation(async_db_session, subscriber, ip_pool):
    """Test that operations are isolated by tenant."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="reserved",
        lifecycle_state="pending",
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    # Try to access from different tenant
    service = IPv4LifecycleService(async_db_session, "different-tenant-id")

    with pytest.raises(AllocationError):
        await service.allocate(subscriber_id=uuid.UUID(subscriber.id), commit=True)


# =============================================================================
# Metadata Tests
# =============================================================================


@pytest.mark.asyncio
async def test_metadata_storage(async_db_session, subscriber, ip_pool):
    """Test metadata storage during lifecycle operations."""
    reservation = IPReservation(
        id=str(uuid.uuid4()),
        tenant_id=subscriber.tenant_id,
        subscriber_id=subscriber.id,
        pool_id=ip_pool.id,
        ip_address="192.168.1.50",
        status="reserved",
        lifecycle_state="pending",
    )
    async_db_session.add(reservation)
    await async_db_session.commit()

    service = IPv4LifecycleService(async_db_session, subscriber.tenant_id)

    # Allocate with custom metadata
    result = await service.allocate(
        subscriber_id=uuid.UUID(subscriber.id),
        metadata={"source": "api", "request_id": "12345"},
        commit=True,
    )

    assert result.metadata["source"] == "api"
    assert result.metadata["request_id"] == "12345"

    # Verify persisted to database
    await async_db_session.refresh(reservation)
    assert reservation.lifecycle_metadata["source"] == "api"
