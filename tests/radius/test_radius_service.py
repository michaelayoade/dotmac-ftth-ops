"""
Tests for RADIUS Service Layer

Tests business logic for RADIUS operations.
"""


import pytest

from dotmac.platform.radius.schemas import (
    BandwidthProfileCreate,
    NASCreate,
    RADIUSSubscriberCreate,
    RADIUSSubscriberUpdate,
)
from dotmac.platform.radius.service import RADIUSService


@pytest.mark.asyncio
class TestRADIUSService:
    """Test RADIUS service operations"""

    async def test_create_subscriber_basic(self, async_db_session, test_tenant):
        """Test creating basic RADIUS subscriber"""
        service = RADIUSService(async_db_session, test_tenant.id)

        data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="SecurePass123!",
        )

        subscriber = await service.create_subscriber(data)

        assert subscriber.username == "testuser@isp"
        assert subscriber.subscriber_id == "sub-001"
        assert subscriber.tenant_id == test_tenant.id

    async def test_create_subscriber_with_bandwidth_profile(self, async_db_session, test_tenant):
        """Test creating subscriber with bandwidth profile"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create bandwidth profile first
        profile_data = BandwidthProfileCreate(
            name="10 Mbps Plan",
            download_rate_kbps=10000,
            upload_rate_kbps=2000,
        )
        profile = await service.create_bandwidth_profile(profile_data)

        # Create subscriber with profile
        data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="SecurePass123!",
            bandwidth_profile_id=profile.id,
        )

        subscriber = await service.create_subscriber(data)

        assert subscriber.bandwidth_profile_id == profile.id

    async def test_create_subscriber_with_static_ip(self, async_db_session, test_tenant):
        """Test creating subscriber with static IP"""
        service = RADIUSService(async_db_session, test_tenant.id)

        data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="SecurePass123!",
            framed_ip_address="10.0.0.100",
        )

        subscriber = await service.create_subscriber(data)

        assert subscriber.framed_ip_address == "10.0.0.100"

    async def test_create_subscriber_with_timeouts(self, async_db_session, test_tenant):
        """Test creating subscriber with session and idle timeouts"""
        service = RADIUSService(async_db_session, test_tenant.id)

        data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="SecurePass123!",
            session_timeout=3600,
            idle_timeout=600,
        )

        subscriber = await service.create_subscriber(data)

        assert subscriber.session_timeout == 3600
        assert subscriber.idle_timeout == 600

    async def test_create_subscriber_duplicate_username(self, async_db_session, test_tenant):
        """Test creating subscriber with duplicate username fails"""
        service = RADIUSService(async_db_session, test_tenant.id)

        data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="SecurePass123!",
        )

        # Create first subscriber
        await service.create_subscriber(data)

        # Try to create duplicate
        data2 = RADIUSSubscriberCreate(
            subscriber_id="sub-002",
            username="testuser@isp",
            password="SecurePass456!",
        )

        with pytest.raises(ValueError, match="already exists"):
            await service.create_subscriber(data2)

    async def test_get_subscriber(self, async_db_session, test_tenant):
        """Test retrieving subscriber"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create subscriber
        data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="SecurePass123!",
        )
        await service.create_subscriber(data)

        # Retrieve
        subscriber = await service.get_subscriber("testuser@isp")

        assert subscriber is not None
        assert subscriber.username == "testuser@isp"

    async def test_list_subscribers(self, async_db_session, test_tenant):
        """Test listing subscribers with pagination"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create multiple subscribers
        for i in range(5):
            data = RADIUSSubscriberCreate(
                subscriber_id=f"sub-{i:03d}",
                username=f"user{i}@isp",
                password=f"Pass{i}123!",
            )
            await service.create_subscriber(data)

        # List with pagination
        subscribers = await service.list_subscribers(skip=0, limit=3)
        assert len(subscribers) == 3

    async def test_update_subscriber_password(self, async_db_session, test_tenant):
        """Test updating subscriber password"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create subscriber
        data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="OldPass123!",
        )
        await service.create_subscriber(data)

        # Update password
        update_data = RADIUSSubscriberUpdate(password="NewPass456!")
        updated = await service.update_subscriber("testuser@isp", update_data)

        assert updated is not None
        # Verify password was updated in radcheck
        radcheck = await service.repository.get_radcheck_by_username(test_tenant.id, "testuser@isp")
        assert radcheck.value == "NewPass456!"

    async def test_update_subscriber_bandwidth_profile(self, async_db_session, test_tenant):
        """Test updating subscriber bandwidth profile"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create bandwidth profiles
        profile1_data = BandwidthProfileCreate(
            name="10 Mbps", download_rate_kbps=10000, upload_rate_kbps=2000
        )
        profile1 = await service.create_bandwidth_profile(profile1_data)

        profile2_data = BandwidthProfileCreate(
            name="20 Mbps", download_rate_kbps=20000, upload_rate_kbps=4000
        )
        profile2 = await service.create_bandwidth_profile(profile2_data)

        # Create subscriber with profile1
        data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="SecurePass123!",
            bandwidth_profile_id=profile1.id,
        )
        await service.create_subscriber(data)

        # Update to profile2
        update_data = RADIUSSubscriberUpdate(bandwidth_profile_id=profile2.id)
        updated = await service.update_subscriber("testuser@isp", update_data)

        assert updated.bandwidth_profile_id == profile2.id

    async def test_enable_disable_subscriber(self, async_db_session, test_tenant):
        """Test enabling and disabling subscriber"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create subscriber
        data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="SecurePass123!",
        )
        await service.create_subscriber(data)

        # Disable subscriber
        disabled = await service.disable_subscriber("testuser@isp")
        assert disabled.enabled is False

        # Enable subscriber
        enabled = await service.enable_subscriber("testuser@isp")
        assert enabled.enabled is True

    async def test_delete_subscriber(self, async_db_session, test_tenant):
        """Test deleting subscriber"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create subscriber
        data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="SecurePass123!",
        )
        await service.create_subscriber(data)

        # Delete
        deleted = await service.delete_subscriber("testuser@isp")
        assert deleted is True

        # Verify deleted
        subscriber = await service.get_subscriber("testuser@isp")
        assert subscriber is None

    async def test_create_nas(self, async_db_session, test_tenant):
        """Test creating NAS device"""
        service = RADIUSService(async_db_session, test_tenant.id)

        data = NASCreate(
            nasname="192.168.1.1",
            shortname="router01",
            type="mikrotik",
            secret="SharedSecret123!",
            ports=1024,
            description="Main Router",
        )

        nas = await service.create_nas(data)

        assert nas.nasname == "192.168.1.1"
        assert nas.shortname == "router01"
        assert nas.type == "mikrotik"

    async def test_create_bandwidth_profile(self, async_db_session, test_tenant):
        """Test creating bandwidth profile"""
        service = RADIUSService(async_db_session, test_tenant.id)

        data = BandwidthProfileCreate(
            name="10 Mbps Plan",
            download_rate_kbps=10000,
            upload_rate_kbps=2000,
            download_burst_kbps=15000,
            upload_burst_kbps=3000,
            description="Standard 10 Mbps plan",
        )

        profile = await service.create_bandwidth_profile(data)

        assert profile.name == "10 Mbps Plan"
        assert profile.download_rate_kbps == 10000
        assert profile.upload_rate_kbps == 2000
        assert profile.download_burst_kbps == 15000
        assert profile.upload_burst_kbps == 3000

    async def test_bandwidth_profile_rate_limit_format(self, async_db_session, test_tenant):
        """Test bandwidth profile generates correct Mikrotik-Rate-Limit format"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create profile
        profile_data = BandwidthProfileCreate(
            name="10 Mbps",
            download_rate_kbps=10000,
            upload_rate_kbps=2000,
            download_burst_kbps=15000,
            upload_burst_kbps=3000,
        )
        profile = await service.create_bandwidth_profile(profile_data)

        # Create subscriber with profile
        subscriber_data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="SecurePass123!",
            bandwidth_profile_id=profile.id,
        )
        await service.create_subscriber(subscriber_data)

        # Check radreply has Mikrotik-Rate-Limit attribute
        radreplies = await service.repository.get_radreplies_by_username(
            test_tenant.id, "testuser@isp"
        )

        rate_limit = next((r for r in radreplies if r.attribute == "Mikrotik-Rate-Limit"), None)
        assert rate_limit is not None
        # Format should be: download/upload download_burst/upload_burst
        assert rate_limit.value == "10000k/2000k 15000k/3000k"

    async def test_generate_random_password(self):
        """Test random password generation"""
        password = RADIUSService.generate_random_password(length=16)

        assert len(password) == 16
        # Should contain letters and digits
        assert any(c.isalpha() for c in password)
        assert any(c.isdigit() for c in password)

    async def test_tenant_isolation(self, async_db_session, test_tenant, test_tenant_2):
        """Test that subscribers are tenant-isolated"""
        service1 = RADIUSService(async_db_session, test_tenant.id)
        service2 = RADIUSService(async_db_session, test_tenant_2.id)

        # Create subscriber in tenant 1
        data = RADIUSSubscriberCreate(
            subscriber_id="sub-001",
            username="testuser@isp",
            password="SecurePass123!",
        )
        await service1.create_subscriber(data)

        # Try to get from tenant 2
        subscriber = await service2.get_subscriber("testuser@isp")
        assert subscriber is None

    async def test_update_nonexistent_subscriber(self, async_db_session, test_tenant):
        """Test updating nonexistent subscriber returns None"""
        service = RADIUSService(async_db_session, test_tenant.id)

        update_data = RADIUSSubscriberUpdate(password="NewPass123!")
        updated = await service.update_subscriber("nonexistent@isp", update_data)

        assert updated is None

    async def test_delete_nonexistent_subscriber(self, async_db_session, test_tenant):
        """Test deleting nonexistent subscriber returns False"""
        service = RADIUSService(async_db_session, test_tenant.id)

        deleted = await service.delete_subscriber("nonexistent@isp")
        assert deleted is False
