"""
Tests for IPv6 Lifecycle Management Service (Phase 4).

Covers all lifecycle state transitions, CoA integration, and error cases.
"""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from dotmac.platform.network.ipv6_lifecycle_service import IPv6LifecycleService
from dotmac.platform.network.lifecycle_protocol import (

pytestmark = pytest.mark.integration
    InvalidTransitionError,
    LifecycleError,
)
from dotmac.platform.network.models import (
    IPv6AssignmentMode,
    IPv6LifecycleState,
    SubscriberNetworkProfile,
)


@pytest.mark.asyncio
async def test_allocate_ipv6_success(async_db_session, subscriber_factory):
    """Test successful IPv6 prefix allocation."""
    subscriber = await subscriber_factory.create()

    # Create network profile with PD mode
    profile = SubscriberNetworkProfile(
        id=str(uuid.uuid4()),
        subscriber_id=subscriber.id,
        tenant_id=subscriber.tenant_id,
        ipv6_assignment_mode=IPv6AssignmentMode.PD,
        ipv6_state=IPv6LifecycleState.PENDING,
        service_vlan=100,
    )
    async_db_session.add(profile)
    await async_db_session.commit()

    # Mock NetBox client
    mock_netbox = AsyncMock()
    mock_netbox.allocate_ipv6_prefix = AsyncMock(
        return_value={"prefix": "2001:db8::/56", "id": 12345}
    )

    service = IPv6LifecycleService(
        async_db_session, subscriber.tenant_id, netbox_client=mock_netbox
    )

    # Allocate IPv6 prefix
    result = await service.allocate_ipv6(subscriber_id=subscriber.id, prefix_size=56, commit=True)

    # Verify result
    assert result["prefix"] == "2001:db8::/56"
    assert result["prefix_size"] == 56
    assert result["state"] == IPv6LifecycleState.ALLOCATED
    assert result["netbox_prefix_id"] == 12345
    assert result["allocated_at"] is not None

    # Verify database state
    await async_db_session.refresh(profile)
    assert profile.ipv6_state == IPv6LifecycleState.ALLOCATED
    assert profile.delegated_ipv6_prefix == "2001:db8::/56"
    assert profile.ipv6_netbox_prefix_id == 12345
    assert profile.ipv6_allocated_at is not None


@pytest.mark.asyncio
async def test_allocate_ipv6_invalid_state(async_db_session, subscriber_factory):
    """Test allocation fails from non-PENDING state."""
    subscriber = await subscriber_factory.create()

    # Create profile already in ACTIVE state
    profile = SubscriberNetworkProfile(
        id=str(uuid.uuid4()),
        subscriber_id=subscriber.id,
        tenant_id=subscriber.tenant_id,
        ipv6_assignment_mode=IPv6AssignmentMode.PD,
        ipv6_state=IPv6LifecycleState.ACTIVE,
        delegated_ipv6_prefix="2001:db8::/56",
        service_vlan=100,
    )
    async_db_session.add(profile)
    await async_db_session.commit()

    service = IPv6LifecycleService(async_db_session, subscriber.tenant_id)

    # Attempt allocation from ACTIVE state should fail
    with pytest.raises(InvalidTransitionError) as exc_info:
        await service.allocate_ipv6(subscriber_id=subscriber.id, commit=True)

    assert "cannot allocate from state" in str(exc_info.value).lower()
    assert "active" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_allocate_ipv6_wrong_assignment_mode(async_db_session, subscriber_factory):
    """Test allocation fails for unsupported assignment modes."""
    subscriber = await subscriber_factory.create()

    # Create profile with SLAAC mode (doesn't support PD)
    profile = SubscriberNetworkProfile(
        id=str(uuid.uuid4()),
        subscriber_id=subscriber.id,
        tenant_id=subscriber.tenant_id,
        ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        ipv6_state=IPv6LifecycleState.PENDING,
        service_vlan=100,
    )
    async_db_session.add(profile)
    await async_db_session.commit()

    service = IPv6LifecycleService(async_db_session, subscriber.tenant_id)

    # Attempt allocation with SLAAC mode should fail
    with pytest.raises(LifecycleError) as exc_info:
        await service.allocate_ipv6(subscriber_id=subscriber.id, commit=True)

    assert "does not support prefix delegation" in str(exc_info.value)


@pytest.mark.asyncio
async def test_activate_ipv6_success(async_db_session, subscriber_factory):
    """Test successful IPv6 prefix activation."""
    subscriber = await subscriber_factory.create()

    # Create profile in ALLOCATED state
    profile = SubscriberNetworkProfile(
        id=str(uuid.uuid4()),
        subscriber_id=subscriber.id,
        tenant_id=subscriber.tenant_id,
        ipv6_assignment_mode=IPv6AssignmentMode.PD,
        ipv6_state=IPv6LifecycleState.ALLOCATED,
        delegated_ipv6_prefix="2001:db8::/56",
        ipv6_allocated_at=datetime.now(UTC),
        service_vlan=100,
    )
    async_db_session.add(profile)
    await async_db_session.commit()

    service = IPv6LifecycleService(async_db_session, subscriber.tenant_id)

    # Activate IPv6 prefix
    result = await service.activate_ipv6(subscriber_id=subscriber.id, commit=True)

    # Verify result
    assert result["prefix"] == "2001:db8::/56"
    assert result["state"] == IPv6LifecycleState.ACTIVE
    assert result["activated_at"] is not None

    # Verify database state
    await async_db_session.refresh(profile)
    assert profile.ipv6_state == IPv6LifecycleState.ACTIVE
    assert profile.ipv6_activated_at is not None


@pytest.mark.asyncio
async def test_activate_ipv6_with_coa(async_db_session, subscriber_factory):
    """Test IPv6 activation with RADIUS CoA."""
    subscriber = await subscriber_factory.create()

    # Create profile in ALLOCATED state
    profile = SubscriberNetworkProfile(
        id=str(uuid.uuid4()),
        subscriber_id=subscriber.id,
        tenant_id=subscriber.tenant_id,
        ipv6_assignment_mode=IPv6AssignmentMode.PD,
        ipv6_state=IPv6LifecycleState.ALLOCATED,
        delegated_ipv6_prefix="2001:db8::/56",
        ipv6_allocated_at=datetime.now(UTC),
        service_vlan=100,
    )
    async_db_session.add(profile)
    await async_db_session.commit()

    # Mock CoA client
    mock_coa = AsyncMock()
    mock_coa.update_ipv6_prefix = AsyncMock(return_value={"success": True, "message": "CoA sent"})

    service = IPv6LifecycleService(async_db_session, subscriber.tenant_id, coa_client=mock_coa)

    # Activate with CoA
    result = await service.activate_ipv6(
        subscriber_id=subscriber.id,
        username="subscriber123",
        nas_ip="10.0.0.1",
        send_coa=True,
        commit=True,
    )

    # Verify CoA was called
    mock_coa.update_ipv6_prefix.assert_called_once_with(
        username="subscriber123",
        delegated_prefix="2001:db8::/56",
        nas_ip="10.0.0.1",
    )

    # Verify result includes CoA result
    assert result["coa_result"] is not None
    assert result["coa_result"]["success"] is True


@pytest.mark.asyncio
async def test_suspend_ipv6_success(async_db_session, subscriber_factory):
    """Test successful IPv6 prefix suspension."""
    subscriber = await subscriber_factory.create()

    # Create profile in ACTIVE state
    profile = SubscriberNetworkProfile(
        id=str(uuid.uuid4()),
        subscriber_id=subscriber.id,
        tenant_id=subscriber.tenant_id,
        ipv6_assignment_mode=IPv6AssignmentMode.PD,
        ipv6_state=IPv6LifecycleState.ACTIVE,
        delegated_ipv6_prefix="2001:db8::/56",
        ipv6_allocated_at=datetime.now(UTC),
        ipv6_activated_at=datetime.now(UTC),
        service_vlan=100,
    )
    async_db_session.add(profile)
    await async_db_session.commit()

    service = IPv6LifecycleService(async_db_session, subscriber.tenant_id)

    # Suspend IPv6 prefix
    result = await service.suspend_ipv6(subscriber_id=subscriber.id, commit=True)

    # Verify result
    assert result["prefix"] == "2001:db8::/56"
    assert result["state"] == IPv6LifecycleState.SUSPENDED

    # Verify database state
    await async_db_session.refresh(profile)
    assert profile.ipv6_state == IPv6LifecycleState.SUSPENDED
    # Prefix should still be assigned (not cleared)
    assert profile.delegated_ipv6_prefix == "2001:db8::/56"


@pytest.mark.asyncio
async def test_resume_ipv6_success(async_db_session, subscriber_factory):
    """Test successful IPv6 prefix resumption."""
    subscriber = await subscriber_factory.create()

    # Create profile in SUSPENDED state
    profile = SubscriberNetworkProfile(
        id=str(uuid.uuid4()),
        subscriber_id=subscriber.id,
        tenant_id=subscriber.tenant_id,
        ipv6_assignment_mode=IPv6AssignmentMode.PD,
        ipv6_state=IPv6LifecycleState.SUSPENDED,
        delegated_ipv6_prefix="2001:db8::/56",
        ipv6_allocated_at=datetime.now(UTC),
        ipv6_activated_at=datetime.now(UTC),
        service_vlan=100,
    )
    async_db_session.add(profile)
    await async_db_session.commit()

    service = IPv6LifecycleService(async_db_session, subscriber.tenant_id)

    # Resume IPv6 prefix
    result = await service.resume_ipv6(subscriber_id=subscriber.id, commit=True)

    # Verify result
    assert result["prefix"] == "2001:db8::/56"
    assert result["state"] == IPv6LifecycleState.ACTIVE

    # Verify database state
    await async_db_session.refresh(profile)
    assert profile.ipv6_state == IPv6LifecycleState.ACTIVE


@pytest.mark.asyncio
async def test_revoke_ipv6_success(async_db_session, subscriber_factory):
    """Test successful IPv6 prefix revocation."""
    subscriber = await subscriber_factory.create()

    # Create profile in ACTIVE state
    profile = SubscriberNetworkProfile(
        id=str(uuid.uuid4()),
        subscriber_id=subscriber.id,
        tenant_id=subscriber.tenant_id,
        ipv6_assignment_mode=IPv6AssignmentMode.PD,
        ipv6_state=IPv6LifecycleState.ACTIVE,
        delegated_ipv6_prefix="2001:db8::/56",
        ipv6_allocated_at=datetime.now(UTC),
        ipv6_activated_at=datetime.now(UTC),
        ipv6_netbox_prefix_id=12345,
        service_vlan=100,
    )
    async_db_session.add(profile)
    await async_db_session.commit()

    # Mock NetBox client
    mock_netbox = AsyncMock()
    mock_netbox.release_ipv6_prefix = AsyncMock(return_value={"status": "released"})

    service = IPv6LifecycleService(
        async_db_session, subscriber.tenant_id, netbox_client=mock_netbox
    )

    # Revoke IPv6 prefix
    result = await service.revoke_ipv6(
        subscriber_id=subscriber.id, release_to_netbox=True, commit=True
    )

    # Verify result
    assert result["prefix"] == "2001:db8::/56"
    assert result["state"] == IPv6LifecycleState.REVOKED
    assert result["revoked_at"] is not None

    # Verify NetBox release was called
    mock_netbox.release_ipv6_prefix.assert_called_once_with(12345)

    # Verify database state
    await async_db_session.refresh(profile)
    assert profile.ipv6_state == IPv6LifecycleState.REVOKED
    assert profile.delegated_ipv6_prefix is None  # Cleared
    assert profile.ipv6_netbox_prefix_id is None  # Cleared
    assert profile.ipv6_revoked_at is not None


@pytest.mark.asyncio
async def test_revoke_ipv6_with_disconnect(async_db_session, subscriber_factory):
    """Test IPv6 revocation with RADIUS Disconnect-Request."""
    subscriber = await subscriber_factory.create()

    # Create profile in ACTIVE state
    profile = SubscriberNetworkProfile(
        id=str(uuid.uuid4()),
        subscriber_id=subscriber.id,
        tenant_id=subscriber.tenant_id,
        ipv6_assignment_mode=IPv6AssignmentMode.PD,
        ipv6_state=IPv6LifecycleState.ACTIVE,
        delegated_ipv6_prefix="2001:db8::/56",
        ipv6_allocated_at=datetime.now(UTC),
        ipv6_activated_at=datetime.now(UTC),
        service_vlan=100,
    )
    async_db_session.add(profile)
    await async_db_session.commit()

    # Mock CoA client
    mock_coa = AsyncMock()
    mock_coa.disconnect_session = AsyncMock(
        return_value={"success": True, "message": "Disconnect sent"}
    )

    service = IPv6LifecycleService(async_db_session, subscriber.tenant_id, coa_client=mock_coa)

    # Revoke with disconnect
    result = await service.revoke_ipv6(
        subscriber_id=subscriber.id,
        username="subscriber123",
        nas_ip="10.0.0.1",
        send_disconnect=True,
        commit=True,
    )

    # Verify disconnect was called
    mock_coa.disconnect_session.assert_called_once_with(
        username="subscriber123",
        nas_ip="10.0.0.1",
    )

    # Verify result includes disconnect result
    assert result["disconnect_result"] is not None
    assert result["disconnect_result"]["success"] is True


@pytest.mark.asyncio
async def test_revoke_ipv6_idempotent(async_db_session, subscriber_factory):
    """Test that revoking an already revoked prefix is idempotent."""
    subscriber = await subscriber_factory.create()

    # Create profile already in REVOKED state
    revoked_at = datetime.now(UTC)
    profile = SubscriberNetworkProfile(
        id=str(uuid.uuid4()),
        subscriber_id=subscriber.id,
        tenant_id=subscriber.tenant_id,
        ipv6_assignment_mode=IPv6AssignmentMode.PD,
        ipv6_state=IPv6LifecycleState.REVOKED,
        ipv6_revoked_at=revoked_at,
        service_vlan=100,
    )
    async_db_session.add(profile)
    await async_db_session.commit()

    service = IPv6LifecycleService(async_db_session, subscriber.tenant_id)

    # Attempt to revoke again
    result = await service.revoke_ipv6(subscriber_id=subscriber.id, commit=True)

    # Should succeed (idempotent)
    assert result["state"] == IPv6LifecycleState.REVOKED
    # Revoked_at should remain the original timestamp (idempotent)
    # Compare without timezone and microseconds as DB may handle these differently
    result_dt = result["revoked_at"].replace(tzinfo=None, microsecond=0)
    original_dt = revoked_at.replace(tzinfo=None, microsecond=0)
    assert result_dt == original_dt


@pytest.mark.asyncio
async def test_get_lifecycle_status(async_db_session, subscriber_factory):
    """Test getting lifecycle status for a subscriber."""
    subscriber = await subscriber_factory.create()

    # Create profile with complete lifecycle data
    profile = SubscriberNetworkProfile(
        id=str(uuid.uuid4()),
        subscriber_id=subscriber.id,
        tenant_id=subscriber.tenant_id,
        ipv6_assignment_mode=IPv6AssignmentMode.PD,
        ipv6_state=IPv6LifecycleState.ACTIVE,
        delegated_ipv6_prefix="2001:db8::/56",
        ipv6_pd_size=56,
        ipv6_allocated_at=datetime(2025, 1, 1, 10, 0, 0, tzinfo=UTC),
        ipv6_activated_at=datetime(2025, 1, 1, 10, 5, 0, tzinfo=UTC),
        ipv6_netbox_prefix_id=12345,
        service_vlan=100,
    )
    async_db_session.add(profile)
    await async_db_session.commit()

    service = IPv6LifecycleService(async_db_session, subscriber.tenant_id)

    # Get status
    status = await service.get_lifecycle_status(subscriber_id=subscriber.id)

    # Verify status
    assert status["subscriber_id"] == subscriber.id
    assert status["prefix"] == "2001:db8::/56"
    assert status["prefix_size"] == 56
    assert status["state"] == IPv6LifecycleState.ACTIVE
    # Compare datetime without timezone to handle DB storage differences
    assert status["allocated_at"].replace(tzinfo=None) == datetime(2025, 1, 1, 10, 0, 0)
    assert status["activated_at"].replace(tzinfo=None) == datetime(2025, 1, 1, 10, 5, 0)
    assert status["netbox_prefix_id"] == 12345
    assert status["assignment_mode"] == IPv6AssignmentMode.PD
