"""
Integration tests for IPv4 Lifecycle Management (Phase 5).

Tests end-to-end IPv4 lifecycle workflows:
- IPv4 allocation from IP pools
- IPv4 activation with RADIUS CoA
- IPv4 suspension and reactivation
- IPv4 revocation and pool return
- NetBox IPAM integration
- Multi-tenant isolation
- Error handling and state transitions
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

pytestmark = pytest.mark.integration
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.ip_management.models import (
    IPPool,
    IPPoolStatus,
    IPPoolType,
    IPReservation,
    IPReservationStatus,
)
from dotmac.platform.network.ipv4_lifecycle_service import IPv4LifecycleService
from dotmac.platform.network.lifecycle_protocol import (
    InvalidTransitionError,
    LifecycleError,
    LifecycleState,
)
from dotmac.platform.subscribers.models import Subscriber, SubscriberStatus


class TestIPv4AllocationWorkflow:
    """Test IPv4 allocation workflow integration."""

    @pytest.mark.asyncio
    async def test_allocate_ipv4_from_pool_success(self, async_db_session: AsyncSession) -> None:
        """Test successful IPv4 allocation from pool during provisioning."""
        # Arrange
        tenant_id = str(uuid4())
        subscriber_id = str(uuid4())

        # Create IP pool
        pool = IPPool(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_name="test-ipv4-pool",
            pool_type=IPPoolType.IPV4_PUBLIC,
            network_cidr="203.0.113.0/24",
            gateway="203.0.113.1",
            dns_servers="8.8.8.8,8.8.4.4",
            vlan_id=100,
            status=IPPoolStatus.ACTIVE,
            total_addresses=254,
            reserved_count=0,
            assigned_count=0,
            available_count=254,
        )
        async_db_session.add(pool)

        # Create available IP reservation
        reservation = IPReservation(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_id=pool.id,
            ip_address="203.0.113.10",
            status=IPReservationStatus.RELEASED,
            lifecycle_state="pending",
            lifecycle_metadata={},
        )
        async_db_session.add(reservation)
        await async_db_session.commit()

        # Create subscriber
        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            subscriber_number=f"SUB-{uuid4().hex[:8]}",
            full_name="Test Subscriber",
            email=f"test{uuid4().hex[:8]}@example.com",
            phone_number="+1234567890",
            status=SubscriberStatus.PENDING,
            is_active=True,
        )
        async_db_session.add(subscriber)
        await async_db_session.commit()

        # Act
        service = IPv4LifecycleService(async_db_session, tenant_id)
        result = await service.allocate(
            subscriber_id=UUID(subscriber_id),
            pool_id=pool.id,
            commit=True,
        )

        # Assert
        assert result.success is True
        assert result.address == "203.0.113.10"
        assert result.state == LifecycleState.ALLOCATED
        assert result.allocated_at is not None

        # Verify database state
        stmt = select(IPReservation).where(IPReservation.id == reservation.id)
        db_result = await async_db_session.execute(stmt)
        updated_reservation = db_result.scalar_one()

        assert updated_reservation.lifecycle_state == "allocated"
        assert updated_reservation.status == IPReservationStatus.ASSIGNED
        assert updated_reservation.subscriber_id == subscriber_id
        assert updated_reservation.lifecycle_allocated_at is not None

    @pytest.mark.asyncio
    async def test_allocate_ipv4_specific_address(self, async_db_session: AsyncSession) -> None:
        """Test IPv4 allocation with specific requested address."""
        # Arrange
        tenant_id = str(uuid4())
        subscriber_id = str(uuid4())

        pool = IPPool(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_name="test-pool-specific",
            pool_type=IPPoolType.IPV4_PUBLIC,
            network_cidr="198.51.100.0/24",
            status=IPPoolStatus.ACTIVE,
            total_addresses=254,
            available_count=254,
        )
        async_db_session.add(pool)

        # Create specific IP reservation
        requested_ip = "198.51.100.42"
        reservation = IPReservation(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_id=pool.id,
            ip_address=requested_ip,
            status=IPReservationStatus.RELEASED,
            lifecycle_state="pending",
        )
        async_db_session.add(reservation)

        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            subscriber_number=f"SUB-{uuid4().hex[:8]}",
            full_name="Test Subscriber",
            email=f"test{uuid4().hex[:8]}@example.com",
            phone_number="+1234567890",
            status=SubscriberStatus.PENDING,
            is_active=True,
        )
        async_db_session.add(subscriber)
        await async_db_session.commit()

        # Act
        service = IPv4LifecycleService(async_db_session, tenant_id)
        result = await service.allocate(
            subscriber_id=UUID(subscriber_id),
            requested_address=requested_ip,
            commit=True,
        )

        # Assert
        assert result.success is True
        assert result.address == requested_ip
        assert result.state == LifecycleState.ALLOCATED


class TestIPv4ActivationWorkflow:
    """Test IPv4 activation workflow integration."""

    @pytest.mark.asyncio
    async def test_activate_ipv4_with_radius_coa(self, async_db_session: AsyncSession) -> None:
        """Test IPv4 activation with RADIUS CoA integration."""
        # Arrange
        tenant_id = str(uuid4())
        subscriber_id = str(uuid4())

        pool = IPPool(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_name="test-pool-activate",
            pool_type=IPPoolType.IPV4_PUBLIC,
            network_cidr="192.0.2.0/24",
            status=IPPoolStatus.ACTIVE,
            total_addresses=254,
        )
        async_db_session.add(pool)

        # Create allocated IP reservation
        reservation = IPReservation(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_id=pool.id,
            subscriber_id=subscriber_id,
            ip_address="192.0.2.100",
            status=IPReservationStatus.ASSIGNED,
            lifecycle_state="allocated",
            lifecycle_allocated_at=datetime.now(UTC),
        )
        async_db_session.add(reservation)

        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            subscriber_number=f"SUB-{uuid4().hex[:8]}",
            full_name="Test Subscriber",
            email=f"test{uuid4().hex[:8]}@example.com",
            phone_number="+1234567890",
            status=SubscriberStatus.ACTIVE,
            is_active=True,
        )
        async_db_session.add(subscriber)
        await async_db_session.commit()

        # Mock RADIUS client
        mock_radius = AsyncMock()
        mock_radius.send_coa = AsyncMock(
            return_value={
                "success": True,
                "code": "CoA-ACK",
                "message": "CoA applied successfully",
            }
        )

        # Mock NetBox client
        mock_netbox = AsyncMock()
        mock_netbox.update_ip_status = AsyncMock(return_value={"id": 999})

        # Act
        service = IPv4LifecycleService(
            async_db_session, tenant_id, radius_client=mock_radius, netbox_client=mock_netbox
        )
        result = await service.activate(
            subscriber_id=UUID(subscriber_id),
            username="test-user@radius",
            nas_ip="10.0.0.1",
            send_coa=True,
            update_netbox=True,
            commit=True,
        )

        # Assert
        assert result.success is True
        assert result.address == "192.0.2.100"
        assert result.state == LifecycleState.ACTIVE
        assert result.activated_at is not None
        assert result.coa_result is not None
        assert result.coa_result["success"] is True
        assert result.netbox_ip_id == 999

        # Verify RADIUS CoA was sent
        mock_radius.send_coa.assert_called_once()
        coa_call_args = mock_radius.send_coa.call_args[1]
        assert coa_call_args["username"] == "test-user@radius"
        assert coa_call_args["nas_ip"] == "10.0.0.1"

        # Verify NetBox update was called
        mock_netbox.update_ip_status.assert_called_once()

        # Verify database state
        await async_db_session.refresh(reservation)
        assert reservation.lifecycle_state == "active"
        assert reservation.lifecycle_activated_at is not None
        assert reservation.lifecycle_metadata is not None
        assert reservation.lifecycle_metadata.get("netbox_ip_id") == 999

    @pytest.mark.asyncio
    async def test_activate_ipv4_invalid_state(self, async_db_session: AsyncSession) -> None:
        """Test activation fails from invalid state."""
        # Arrange
        tenant_id = str(uuid4())
        subscriber_id = str(uuid4())

        pool = IPPool(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_name="invalid-state-pool",
            pool_type=IPPoolType.IPV4_PUBLIC,
            network_cidr="192.0.2.0/24",
            status=IPPoolStatus.ACTIVE,
            total_addresses=254,
        )
        async_db_session.add(pool)

        # Create reservation already in ACTIVE state
        reservation = IPReservation(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_id=pool.id,
            subscriber_id=subscriber_id,
            ip_address="192.0.2.200",
            status=IPReservationStatus.ASSIGNED,
            lifecycle_state="active",  # Already active
            lifecycle_allocated_at=datetime.now(UTC) - timedelta(hours=1),
            lifecycle_activated_at=datetime.now(UTC),
        )
        async_db_session.add(reservation)

        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            subscriber_number=f"SUB-{uuid4().hex[:8]}",
            full_name="Active Subscriber",
            email=f"active{uuid4().hex[:8]}@example.com",
            phone_number="+1234567890",
            status=SubscriberStatus.ACTIVE,
            is_active=True,
        )
        async_db_session.add(subscriber)
        await async_db_session.commit()

        # Act & Assert
        service = IPv4LifecycleService(async_db_session, tenant_id)
        with pytest.raises(InvalidTransitionError) as exc_info:
            await service.activate(
                subscriber_id=UUID(subscriber_id),
                commit=True,
            )

        assert "Cannot activate from state: active" in str(exc_info.value)


class TestIPv4SuspensionWorkflow:
    """Test IPv4 suspension and reactivation workflow."""

    @pytest.mark.asyncio
    async def test_suspend_and_reactivate_ipv4(self, async_db_session: AsyncSession) -> None:
        """Test complete suspend → reactivate workflow."""
        # Arrange
        tenant_id = str(uuid4())
        subscriber_id = str(uuid4())

        pool = IPPool(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_name="suspend-pool",
            pool_type=IPPoolType.IPV4_PUBLIC,
            network_cidr="203.0.113.0/24",
            status=IPPoolStatus.ACTIVE,
            total_addresses=254,
        )
        async_db_session.add(pool)

        reservation = IPReservation(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_id=pool.id,
            subscriber_id=subscriber_id,
            ip_address="203.0.113.50",
            status=IPReservationStatus.ASSIGNED,
            lifecycle_state="active",
            lifecycle_allocated_at=datetime.now(UTC) - timedelta(days=1),
            lifecycle_activated_at=datetime.now(UTC) - timedelta(hours=12),
        )
        async_db_session.add(reservation)

        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            subscriber_number=f"SUB-{uuid4().hex[:8]}",
            full_name="Active Subscriber",
            email=f"active{uuid4().hex[:8]}@example.com",
            phone_number="+1234567890",
            status=SubscriberStatus.ACTIVE,
            is_active=True,
        )
        async_db_session.add(subscriber)
        await async_db_session.commit()

        mock_radius = AsyncMock()
        mock_radius.send_coa = AsyncMock(return_value={"success": True, "code": "CoA-ACK"})

        service = IPv4LifecycleService(async_db_session, tenant_id, radius_client=mock_radius)

        # Act 1: Suspend
        suspend_result = await service.suspend(
            subscriber_id=UUID(subscriber_id),
            username="test-user@radius",
            nas_ip="10.0.0.1",
            send_coa=True,
            reason="Non-payment",
            commit=True,
        )

        # Assert suspension
        assert suspend_result.success is True
        assert suspend_result.state == LifecycleState.SUSPENDED
        assert suspend_result.suspended_at is not None
        mock_radius.send_coa.assert_called_once()

        await async_db_session.refresh(reservation)
        assert reservation.lifecycle_state == "suspended"
        assert reservation.lifecycle_suspended_at is not None
        assert reservation.lifecycle_metadata is not None
        assert reservation.lifecycle_metadata.get("suspension_reason") == "Non-payment"

        # Act 2: Reactivate
        reactivate_result = await service.reactivate(
            subscriber_id=UUID(subscriber_id),
            commit=True,
        )

        # Assert reactivation
        assert reactivate_result.success is True
        assert reactivate_result.state == LifecycleState.ACTIVE
        assert reactivate_result.suspended_at is None

        await async_db_session.refresh(reservation)
        assert reservation.lifecycle_state == "active"
        assert reservation.lifecycle_suspended_at is None


class TestIPv4RevocationWorkflow:
    """Test IPv4 revocation and pool return workflow."""

    @pytest.mark.asyncio
    async def test_revoke_ipv4_with_disconnect_and_pool_return(
        self, async_db_session: AsyncSession
    ) -> None:
        """Test IPv4 revocation with RADIUS disconnect and pool return."""
        # Arrange
        tenant_id = str(uuid4())
        subscriber_id = str(uuid4())

        pool = IPPool(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_name="test-pool-revoke",
            pool_type=IPPoolType.IPV4_PUBLIC,
            network_cidr="198.51.100.0/24",
            status=IPPoolStatus.ACTIVE,
            total_addresses=254,
            assigned_count=1,
            available_count=253,
        )
        async_db_session.add(pool)

        reservation = IPReservation(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_id=pool.id,
            subscriber_id=subscriber_id,
            ip_address="198.51.100.150",
            status=IPReservationStatus.ASSIGNED,
            lifecycle_state="active",
            lifecycle_allocated_at=datetime.now(UTC) - timedelta(days=30),
            lifecycle_activated_at=datetime.now(UTC) - timedelta(days=29),
            lifecycle_netbox_ip_id=12345,
        )
        async_db_session.add(reservation)
        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            subscriber_number=f"SUB-{uuid4().hex[:8]}",
            full_name="Active Subscriber",
            email=f"active{uuid4().hex[:8]}@example.com",
            phone_number="+1234567890",
            status=SubscriberStatus.ACTIVE,
            is_active=True,
        )
        async_db_session.add(subscriber)
        await async_db_session.commit()

        # Mock RADIUS client
        mock_radius = AsyncMock()
        mock_radius.send_disconnect = AsyncMock(
            return_value={
                "success": True,
                "code": "Disconnect-ACK",
                "message": "Session terminated",
            }
        )

        # Mock NetBox client
        mock_netbox = AsyncMock()
        mock_netbox.release_ip = AsyncMock(return_value={"status": "available"})

        # Act
        service = IPv4LifecycleService(
            async_db_session, tenant_id, radius_client=mock_radius, netbox_client=mock_netbox
        )
        result = await service.revoke(
            subscriber_id=UUID(subscriber_id),
            username="test-user@radius",
            nas_ip="10.0.0.1",
            send_disconnect=True,
            release_to_pool=True,
            update_netbox=True,
            commit=True,
        )

        # Assert
        assert result.success is True
        assert result.state == LifecycleState.REVOKED
        assert result.revoked_at is not None
        assert result.disconnect_result is not None
        assert result.disconnect_result["success"] is True

        # Verify RADIUS disconnect was sent
        mock_radius.send_disconnect.assert_called_once()
        disconnect_call_args = mock_radius.send_disconnect.call_args[1]
        assert disconnect_call_args["username"] == "test-user@radius"

        # Verify NetBox cleanup
        mock_netbox.release_ip.assert_called_once()

        # Verify database state
        await async_db_session.refresh(reservation)
        assert reservation.lifecycle_state == "revoked"
        assert reservation.lifecycle_revoked_at is not None
        assert reservation.status == IPReservationStatus.RELEASED
        assert reservation.subscriber_id is None  # Returned to pool

    @pytest.mark.asyncio
    async def test_revoke_ipv4_from_any_state(self, async_db_session: AsyncSession) -> None:
        """Test revocation works from any state (emergency deprovisioning)."""
        # Arrange - subscriber in SUSPENDED state
        tenant_id = str(uuid4())
        subscriber_id = str(uuid4())

        pool = IPPool(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_name="revocation-pool",
            pool_type=IPPoolType.IPV4_PUBLIC,
            network_cidr="192.0.2.0/24",
            status=IPPoolStatus.ACTIVE,
            total_addresses=254,
        )
        async_db_session.add(pool)

        reservation = IPReservation(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_id=pool.id,
            subscriber_id=subscriber_id,
            ip_address="192.0.2.250",
            status=IPReservationStatus.ASSIGNED,
            lifecycle_state="suspended",  # Not ACTIVE
            lifecycle_allocated_at=datetime.now(UTC) - timedelta(days=60),
            lifecycle_activated_at=datetime.now(UTC) - timedelta(days=59),
            lifecycle_suspended_at=datetime.now(UTC) - timedelta(days=30),
        )
        async_db_session.add(reservation)
        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            subscriber_number=f"SUB-{uuid4().hex[:8]}",
            full_name="Suspended Subscriber",
            email=f"suspended{uuid4().hex[:8]}@example.com",
            phone_number="+1234567890",
            status=SubscriberStatus.SUSPENDED,
        )
        async_db_session.add(subscriber)
        await async_db_session.commit()

        # Act
        service = IPv4LifecycleService(async_db_session, tenant_id)
        result = await service.revoke(
            subscriber_id=UUID(subscriber_id),
            release_to_pool=True,
            commit=True,
        )

        # Assert - revocation succeeds from SUSPENDED state
        assert result.success is True
        assert result.state == LifecycleState.REVOKED

        await async_db_session.refresh(reservation)
        assert reservation.lifecycle_state == "revoked"


class TestIPv4MultiTenantIsolation:
    """Test multi-tenant isolation for IPv4 lifecycle."""

    @pytest.mark.asyncio
    async def test_tenant_isolation_allocation(self, async_db_session: AsyncSession) -> None:
        """Test tenant cannot allocate IP from another tenant's pool."""
        # Arrange
        tenant_a = str(uuid4())
        tenant_b = str(uuid4())
        subscriber_b_id = str(uuid4())

        # Tenant A's pool
        pool_a = IPPool(
            id=uuid4(),
            tenant_id=tenant_a,  # Tenant A
            pool_name="tenant-a-pool",
            pool_type=IPPoolType.IPV4_PUBLIC,
            network_cidr="10.1.0.0/24",
            status=IPPoolStatus.ACTIVE,
            total_addresses=254,
        )
        async_db_session.add(pool_a)

        reservation_a = IPReservation(
            id=uuid4(),
            tenant_id=tenant_a,
            pool_id=pool_a.id,
            ip_address="10.1.0.10",
            status=IPReservationStatus.RELEASED,
            lifecycle_state="pending",
        )
        async_db_session.add(reservation_a)

        # Tenant B's subscriber
        subscriber_b = Subscriber(
            id=subscriber_b_id,
            tenant_id=tenant_b,  # Tenant B
            subscriber_number=f"SUB-{uuid4().hex[:8]}",
            full_name="Tenant B Subscriber",
            email=f"tenantb{uuid4().hex[:8]}@example.com",
            phone_number="+1234567890",
            status=SubscriberStatus.PENDING,
            is_active=True,
        )
        async_db_session.add(subscriber_b)
        await async_db_session.commit()

        # Act - Tenant B tries to allocate from Tenant A's pool
        service_b = IPv4LifecycleService(async_db_session, tenant_b)

        with pytest.raises(LifecycleError) as exc_info:
            await service_b.allocate(
                subscriber_id=UUID(subscriber_b_id),
                pool_id=pool_a.id,  # Trying to use Tenant A's pool
                commit=True,
            )

        # Assert - should fail with tenant isolation error
        assert "No available IP addresses found" in str(exc_info.value)


class TestIPv4ErrorHandlingAndRollback:
    """Test error handling and transaction rollback."""

    @pytest.mark.asyncio
    async def test_allocation_rollback_on_netbox_failure(
        self, async_db_session: AsyncSession
    ) -> None:
        """Test allocation rollback when NetBox integration fails."""
        # Arrange
        tenant_id = str(uuid4())
        subscriber_id = str(uuid4())

        pool = IPPool(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_name="test-pool-rollback",
            pool_type=IPPoolType.IPV4_PUBLIC,
            network_cidr="203.0.113.0/24",
            status=IPPoolStatus.ACTIVE,
            total_addresses=254,
        )
        async_db_session.add(pool)

        reservation = IPReservation(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_id=pool.id,
            ip_address="203.0.113.99",
            status=IPReservationStatus.RELEASED,
            lifecycle_state="pending",
        )
        async_db_session.add(reservation)
        reservation_id = reservation.id

        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            subscriber_number=f"SUB-{uuid4().hex[:8]}",
            full_name="Test Subscriber",
            email=f"test{uuid4().hex[:8]}@example.com",
            phone_number="+1234567890",
            status=SubscriberStatus.PENDING,
            is_active=True,
        )
        async_db_session.add(subscriber)
        await async_db_session.commit()

        # Mock NetBox client that fails
        mock_netbox = AsyncMock()
        mock_netbox.reserve_ip = AsyncMock(side_effect=Exception("NetBox API connection failed"))

        # Act
        service = IPv4LifecycleService(async_db_session, tenant_id, netbox_client=mock_netbox)

        # Should not raise exception, but return failed result
        result = await service.allocate(
            subscriber_id=UUID(subscriber_id),
            pool_id=pool.id,
            commit=False,  # Don't commit to test rollback
        )

        # Assert - allocation should still succeed in DB even if NetBox fails
        assert result.success is True  # DB operation succeeded
        assert result.address == "203.0.113.99"

        # Verify reservation was not committed (because commit=False)
        await async_db_session.rollback()
        stmt = select(IPReservation).where(IPReservation.id == reservation_id)
        db_result = await async_db_session.execute(stmt)
        rolled_back_reservation = db_result.scalar_one()
        assert rolled_back_reservation.lifecycle_state == "pending"  # Rolled back


class TestIPv4FullProvisioningIntegration:
    """Test complete provisioning workflow with IPv4 lifecycle."""

    @pytest.mark.asyncio
    async def test_complete_subscriber_provisioning_with_ipv4(
        self, async_db_session: AsyncSession
    ) -> None:
        """Test complete subscriber provisioning workflow with IPv4 lifecycle."""
        # Arrange
        tenant_id = str(uuid4())
        subscriber_id = str(uuid4())

        pool = IPPool(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_name="provisioning-pool",
            pool_type=IPPoolType.IPV4_PUBLIC,
            network_cidr="192.0.2.0/24",
            status=IPPoolStatus.ACTIVE,
            total_addresses=254,
        )
        async_db_session.add(pool)

        reservation = IPReservation(
            id=uuid4(),
            tenant_id=tenant_id,
            pool_id=pool.id,
            ip_address="192.0.2.100",
            status=IPReservationStatus.RELEASED,
            lifecycle_state="pending",
        )
        async_db_session.add(reservation)

        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            subscriber_number=f"SUB-{uuid4().hex[:8]}",
            full_name="Full Workflow Test",
            email=f"fulltest{uuid4().hex[:8]}@example.com",
            phone_number="+1234567890",
            status=SubscriberStatus.PENDING,
            is_active=True,
        )
        async_db_session.add(subscriber)
        await async_db_session.commit()

        mock_radius = AsyncMock()
        mock_radius.send_coa = AsyncMock(return_value={"success": True, "code": "CoA-ACK"})

        service = IPv4LifecycleService(async_db_session, tenant_id, radius_client=mock_radius)

        # Act 1: Allocate
        allocate_result = await service.allocate(
            subscriber_id=UUID(subscriber_id),
            pool_id=pool.id,
            commit=True,
        )

        # Act 2: Activate
        activate_result = await service.activate(
            subscriber_id=UUID(subscriber_id),
            username=f"sub-{subscriber_id}@radius",
            nas_ip="10.0.0.1",
            send_coa=True,
            commit=True,
        )

        # Assert workflow success
        assert allocate_result.success is True
        assert allocate_result.state == LifecycleState.ALLOCATED

        assert activate_result.success is True
        assert activate_result.state == LifecycleState.ACTIVE
        assert activate_result.address == "192.0.2.100"

        # Verify final database state
        await async_db_session.refresh(reservation)
        assert reservation.lifecycle_state == "active"
        assert reservation.subscriber_id == subscriber_id
        assert reservation.lifecycle_allocated_at is not None
        assert reservation.lifecycle_activated_at is not None

        # Verify RADIUS integration
        mock_radius.send_coa.assert_called_once()
