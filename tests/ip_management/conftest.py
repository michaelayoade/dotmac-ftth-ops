"""
Fixtures for IP management tests.
"""

from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import delete

from dotmac.platform.ip_management.models import IPPool, IPReservation
from dotmac.platform.subscribers.models import Subscriber


@pytest.fixture
def test_tenant():
    """Create a mock tenant object."""
    return SimpleNamespace(id="tenant-123")


@pytest_asyncio.fixture
async def ip_pool_factory(async_db_session, test_tenant):
    """Factory for creating IP pools."""
    from dotmac.platform.ip_management.models import IPPoolStatus, IPPoolType

    async def _create_pool(
        pool_name="Test Pool",
        pool_type=IPPoolType.IPV4_PUBLIC,
        network_cidr="192.168.1.0/24",
        gateway="192.168.1.1",
        dns_servers="8.8.8.8,8.8.4.4",
        **kwargs,
    ):
        pool = IPPool(
            tenant_id=test_tenant.id,
            pool_name=pool_name,
            pool_type=pool_type,
            network_cidr=network_cidr,
            gateway=gateway,
            dns_servers=dns_servers,
            status=kwargs.get("status", IPPoolStatus.ACTIVE),
            total_addresses=kwargs.get("total_addresses", 253),
            reserved_count=kwargs.get("reserved_count", 0),
            assigned_count=kwargs.get("assigned_count", 0),
            auto_assign_enabled=kwargs.get("auto_assign_enabled", True),
            allow_manual_reservation=kwargs.get("allow_manual_reservation", True),
            vlan_id=kwargs.get("vlan_id"),
            description=kwargs.get("description"),
        )
        async_db_session.add(pool)
        await async_db_session.flush()
        await async_db_session.refresh(pool)
        return pool

    return _create_pool


@pytest_asyncio.fixture
async def test_ip_pool(ip_pool_factory):
    """Create a test IP pool."""
    return await ip_pool_factory()


@pytest_asyncio.fixture
async def ip_reservation_factory(async_db_session, test_tenant):
    """Factory for creating IP reservations."""
    from datetime import datetime

    from dotmac.platform.ip_management.models import IPReservationStatus

    async def _create_reservation(
        pool_id,
        subscriber_id,
        ip_address,
        **kwargs,
    ):
        reservation = IPReservation(
            tenant_id=test_tenant.id,
            pool_id=pool_id,
            subscriber_id=subscriber_id,
            ip_address=ip_address,
            ip_type=kwargs.get("ip_type", "ipv4"),
            status=kwargs.get("status", IPReservationStatus.RESERVED),
            reserved_at=kwargs.get("reserved_at", datetime.utcnow()),
            assigned_at=kwargs.get("assigned_at"),
            assigned_by=kwargs.get("assigned_by"),
            assignment_reason=kwargs.get("assignment_reason"),
            notes=kwargs.get("notes"),
        )
        async_db_session.add(reservation)
        await async_db_session.flush()
        await async_db_session.refresh(reservation)
        return reservation

    return _create_reservation


@pytest_asyncio.fixture
async def test_subscriber(async_db_session, test_tenant):
    """Create a test subscriber for IP assignments."""
    from dotmac.platform.subscribers.models import SubscriberStatus

    subscriber = Subscriber(
        id="TEST-SUB-001",  # id is the primary key
        tenant_id=test_tenant.id,
        username="testuser001",
        password="hashed_password",  # Required field
        status=SubscriberStatus.ACTIVE,
    )
    async_db_session.add(subscriber)
    await async_db_session.flush()
    await async_db_session.refresh(subscriber)
    return subscriber


@pytest_asyncio.fixture(autouse=True)
async def cleanup_ip_management(async_db_session):
    """Clean up IP management tables between tests."""
    # Cleanup before test
    try:
        await async_db_session.rollback()  # Ensure clean state
        await async_db_session.execute(delete(IPReservation))
        await async_db_session.execute(delete(IPPool))
        await async_db_session.commit()
    except Exception:
        await async_db_session.rollback()

    yield

    # Cleanup after test
    try:
        await async_db_session.rollback()  # Handle any pending rollback from test failures
        await async_db_session.execute(delete(IPReservation))
        await async_db_session.execute(delete(IPPool))
        await async_db_session.commit()
    except Exception:
        await async_db_session.rollback()
