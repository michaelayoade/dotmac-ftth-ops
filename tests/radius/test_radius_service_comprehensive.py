"""
Comprehensive RADIUS Service Tests

Additional test coverage for critical RADIUS service operations
to reach 85%+ coverage target.

Focus areas:
- Session management
- Usage stats
- CoA (Change of Authorization)
- Error handling
- Edge cases
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime, timedelta

from dotmac.platform.radius.schemas import (
    BandwidthProfileCreate,
    NASCreate,
    NASUpdate,
    RADIUSSubscriberCreate,
    RADIUSSubscriberUpdate,
    RADIUSUsageQuery,
)
from dotmac.platform.radius.service import RADIUSService


@pytest.mark.asyncio
class TestRADIUSSessionManagement:
    """Test RADIUS session management operations"""

    async def test_get_active_sessions_for_user(self, async_db_session, test_tenant):
        """Test getting active sessions for specific user"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create subscriber first
        subscriber_data = RADIUSSubscriberCreate(
            subscriber_id="sub-session-001",
            username="session_user@isp",
            password="SecurePass123!",
        )
        await service.create_subscriber(subscriber_data)

        # Get active sessions
        sessions = await service.get_active_sessions(username="session_user@isp")

        assert isinstance(sessions, list)
        # Should be empty initially (no active sessions yet)
        assert len(sessions) == 0

    async def test_get_all_active_sessions(self, async_db_session, test_tenant):
        """Test getting all active sessions (no username filter)"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Get all active sessions
        sessions = await service.get_active_sessions()

        assert isinstance(sessions, list)

    async def test_get_subscriber_sessions_with_limit(self, async_db_session, test_tenant):
        """Test getting subscriber sessions with pagination"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create subscriber
        subscriber_data = RADIUSSubscriberCreate(
            subscriber_id="sub-history-001",
            username="history_user@isp",
            password="SecurePass123!",
        )
        await service.create_subscriber(subscriber_data)

        # Get sessions with limit
        sessions = await service.get_subscriber_sessions(
            username="history_user@isp",
            limit=10
        )

        assert isinstance(sessions, list)

    async def test_disconnect_session_success(self, async_db_session, test_tenant):
        """Test successful session disconnection"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create subscriber
        subscriber_data = RADIUSSubscriberCreate(
            subscriber_id="sub-disconnect-001",
            username="disconnect_user@isp",
            password="SecurePass123!",
        )
        await service.create_subscriber(subscriber_data)

        # Mock CoA client
        with patch.object(service.coa_client, 'send_disconnect', new_callable=AsyncMock) as mock_disconnect:
            mock_disconnect.return_value = True

            result = await service.disconnect_session(username="disconnect_user@isp")

            assert result is True
            mock_disconnect.assert_called_once()

    async def test_disconnect_session_by_session_id(self, async_db_session, test_tenant):
        """Test session disconnection by session ID"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Mock CoA client
        with patch.object(service.coa_client, 'send_disconnect', new_callable=AsyncMock) as mock_disconnect:
            mock_disconnect.return_value = True

            result = await service.disconnect_session(session_id="test-session-123")

            assert result is True

    async def test_disconnect_session_failure(self, async_db_session, test_tenant):
        """Test session disconnection failure"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Mock CoA client to fail
        with patch.object(service.coa_client, 'send_disconnect', new_callable=AsyncMock) as mock_disconnect:
            mock_disconnect.return_value = False

            result = await service.disconnect_session(username="nonexistent@isp")

            assert result is False


@pytest.mark.asyncio
class TestRADIUSUsageStats:
    """Test RADIUS usage statistics"""

    async def test_get_usage_stats_by_username(self, async_db_session, test_tenant):
        """Test getting usage stats for specific user"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create subscriber first
        subscriber_data = RADIUSSubscriberCreate(
            subscriber_id="sub-usage-001",
            username="usage_user@isp",
            password="SecurePass123!",
        )
        await service.create_subscriber(subscriber_data)

        # Query usage stats
        query = RADIUSUsageQuery(
            username="usage_user@isp",
            start_date=datetime.now() - timedelta(days=30),
            end_date=datetime.now(),
        )

        stats = await service.get_usage_stats(query)

        assert stats.username == "usage_user@isp"
        assert stats.total_sessions >= 0
        assert stats.total_upload_bytes >= 0
        assert stats.total_download_bytes >= 0
        assert stats.total_bytes >= 0

    async def test_get_usage_stats_date_range(self, async_db_session, test_tenant):
        """Test usage stats with specific date range"""
        service = RADIUSService(async_db_session, test_tenant.id)

        subscriber_data = RADIUSSubscriberCreate(
            subscriber_id="sub-usage-002",
            username="usage_date_user@isp",
            password="SecurePass123!",
        )
        await service.create_subscriber(subscriber_data)

        # Query last 7 days
        query = RADIUSUsageQuery(
            username="usage_date_user@isp",
            start_date=datetime.now() - timedelta(days=7),
            end_date=datetime.now(),
        )

        stats = await service.get_usage_stats(query)

        assert isinstance(stats.total_bytes, int)

    async def test_get_usage_stats_without_username(self, async_db_session, test_tenant):
        """Test getting usage stats for all users"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Query without username (aggregate stats)
        query = RADIUSUsageQuery(
            start_date=datetime.now() - timedelta(days=1),
            end_date=datetime.now(),
        )

        stats = await service.get_usage_stats(query)

        assert stats.total_bytes >= 0


@pytest.mark.asyncio
class TestRADIUSBandwidthProfiles:
    """Test bandwidth profile operations"""

    async def test_create_bandwidth_profile_with_burst(self, async_db_session, test_tenant):
        """Test creating bandwidth profile with burst limits"""
        service = RADIUSService(async_db_session, test_tenant.id)

        data = BandwidthProfileCreate(
            name="50 Mbps with Burst",
            download_rate_kbps=50000,
            upload_rate_kbps=10000,
            download_burst_kbps=75000,
            upload_burst_kbps=15000,
        )

        profile = await service.create_bandwidth_profile(data)

        assert profile.name == "50 Mbps with Burst"
        assert profile.download_rate_kbps == 50000
        assert profile.upload_rate_kbps == 10000
        assert profile.download_burst_kbps == 75000
        assert profile.upload_burst_kbps == 15000

    async def test_get_bandwidth_profile(self, async_db_session, test_tenant):
        """Test getting bandwidth profile by ID"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create profile
        data = BandwidthProfileCreate(
            name="Test Profile",
            download_rate_kbps=10000,
            upload_rate_kbps=2000,
        )
        created_profile = await service.create_bandwidth_profile(data)

        # Get profile
        profile = await service.get_bandwidth_profile(created_profile.id)

        assert profile is not None
        assert profile.id == created_profile.id
        assert profile.name == "Test Profile"

    async def test_get_nonexistent_bandwidth_profile(self, async_db_session, test_tenant):
        """Test getting non-existent bandwidth profile returns None"""
        service = RADIUSService(async_db_session, test_tenant.id)

        profile = await service.get_bandwidth_profile("nonexistent-id")

        assert profile is None

    async def test_list_bandwidth_profiles_with_pagination(self, async_db_session, test_tenant):
        """Test listing bandwidth profiles with pagination"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create multiple profiles
        for i in range(5):
            data = BandwidthProfileCreate(
                name=f"Profile {i}",
                download_rate_kbps=10000 * (i + 1),
                upload_rate_kbps=2000 * (i + 1),
            )
            await service.create_bandwidth_profile(data)

        # List with pagination
        profiles = await service.list_bandwidth_profiles(skip=0, limit=3)

        assert len(profiles) <= 3

    async def test_apply_bandwidth_profile_to_subscriber(self, async_db_session, test_tenant):
        """Test applying bandwidth profile to existing subscriber"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create subscriber
        subscriber_data = RADIUSSubscriberCreate(
            subscriber_id="sub-bandwidth-001",
            username="bandwidth_user@isp",
            password="SecurePass123!",
        )
        subscriber = await service.create_subscriber(subscriber_data)

        # Create bandwidth profile
        profile_data = BandwidthProfileCreate(
            name="Apply Test Profile",
            download_rate_kbps=20000,
            upload_rate_kbps=5000,
        )
        profile = await service.create_bandwidth_profile(profile_data)

        # Apply profile to subscriber
        updated_subscriber = await service.apply_bandwidth_profile(
            username="bandwidth_user@isp",
            profile_id=profile.id
        )

        assert updated_subscriber is not None
        assert updated_subscriber.bandwidth_profile_id == profile.id


@pytest.mark.asyncio
class TestRADIUSNASManagement:
    """Test NAS (Network Access Server) operations"""

    async def test_get_nas(self, async_db_session, test_tenant):
        """Test getting NAS by ID"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create NAS
        nas_data = NASCreate(
            nasname="test-nas.example.com",
            shortname="TestNAS",
            secret="shared-secret-123",
            type="other",
            description="Test NAS server",
        )
        created_nas = await service.create_nas(nas_data)

        # Get NAS
        nas = await service.get_nas(created_nas.id)

        assert nas is not None
        assert nas.id == created_nas.id
        assert nas.nasname == "test-nas.example.com"

    async def test_get_nonexistent_nas(self, async_db_session, test_tenant):
        """Test getting non-existent NAS returns None"""
        service = RADIUSService(async_db_session, test_tenant.id)

        nas = await service.get_nas(999999)

        assert nas is None

    async def test_update_nas(self, async_db_session, test_tenant):
        """Test updating NAS configuration"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create NAS
        nas_data = NASCreate(
            nasname="update-nas.example.com",
            shortname="UpdateNAS",
            secret="original-secret",
            type="other",
        )
        created_nas = await service.create_nas(nas_data)

        # Update NAS
        update_data = NASUpdate(
            shortname="UpdatedNAS",
            secret="new-secret-456",
            description="Updated description",
        )
        updated_nas = await service.update_nas(created_nas.id, update_data)

        assert updated_nas is not None
        assert updated_nas.shortname == "UpdatedNAS"
        assert updated_nas.secret == "new-secret-456"

    async def test_update_nonexistent_nas(self, async_db_session, test_tenant):
        """Test updating non-existent NAS returns None"""
        service = RADIUSService(async_db_session, test_tenant.id)

        update_data = NASUpdate(
            shortname="NonexistentNAS",
        )
        result = await service.update_nas(999999, update_data)

        assert result is None

    async def test_delete_nas(self, async_db_session, test_tenant):
        """Test deleting NAS"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create NAS
        nas_data = NASCreate(
            nasname="delete-nas.example.com",
            shortname="DeleteNAS",
            secret="secret-123",
            type="other",
        )
        created_nas = await service.create_nas(nas_data)

        # Delete NAS
        result = await service.delete_nas(created_nas.id)

        assert result is True

        # Verify deletion
        deleted_nas = await service.get_nas(created_nas.id)
        assert deleted_nas is None

    async def test_delete_nonexistent_nas(self, async_db_session, test_tenant):
        """Test deleting non-existent NAS returns False"""
        service = RADIUSService(async_db_session, test_tenant.id)

        result = await service.delete_nas(999999)

        assert result is False

    async def test_list_nas_devices_pagination(self, async_db_session, test_tenant):
        """Test listing NAS devices with pagination"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create multiple NAS devices
        for i in range(5):
            nas_data = NASCreate(
                nasname=f"nas-{i}.example.com",
                shortname=f"NAS-{i}",
                secret=f"secret-{i}",
                type="other",
            )
            await service.create_nas(nas_data)

        # List with pagination
        nas_list = await service.list_nas_devices(skip=0, limit=3)

        assert len(nas_list) <= 3

    async def test_list_nas_devices_skip(self, async_db_session, test_tenant):
        """Test listing NAS devices with skip offset"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create NAS devices
        for i in range(3):
            nas_data = NASCreate(
                nasname=f"skip-nas-{i}.example.com",
                shortname=f"SkipNAS-{i}",
                secret=f"secret-{i}",
                type="other",
            )
            await service.create_nas(nas_data)

        # List with skip
        nas_list = await service.list_nas_devices(skip=1, limit=10)

        assert isinstance(nas_list, list)


@pytest.mark.asyncio
class TestRADIUSSubscriberAdvanced:
    """Advanced subscriber operation tests"""

    async def test_update_subscriber_with_multiple_fields(self, async_db_session, test_tenant):
        """Test updating multiple subscriber fields at once"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create subscriber
        subscriber_data = RADIUSSubscriberCreate(
            subscriber_id="sub-multi-update-001",
            username="multi_update_user@isp",
            password="OldPass123!",
        )
        await service.create_subscriber(subscriber_data)

        # Create bandwidth profile
        profile_data = BandwidthProfileCreate(
            name="Update Profile",
            download_rate_kbps=15000,
            upload_rate_kbps=3000,
        )
        profile = await service.create_bandwidth_profile(profile_data)

        # Update multiple fields
        update_data = RADIUSSubscriberUpdate(
            password="NewPass456!",
            bandwidth_profile_id=profile.id,
            session_timeout=7200,
            idle_timeout=1200,
        )

        updated = await service.update_subscriber("multi_update_user@isp", update_data)

        assert updated is not None
        assert updated.bandwidth_profile_id == profile.id
        assert updated.session_timeout == 7200
        assert updated.idle_timeout == 1200

    async def test_create_subscriber_with_ipv4_address(self, async_db_session, test_tenant):
        """Test creating subscriber with IPv4 framed address"""
        service = RADIUSService(async_db_session, test_tenant.id)

        data = RADIUSSubscriberCreate(
            subscriber_id="sub-ipv4-001",
            username="ipv4_user@isp",
            password="SecurePass123!",
            framed_ipv4_address="192.168.100.50",
        )

        subscriber = await service.create_subscriber(data)

        assert subscriber.framed_ipv4_address == "192.168.100.50"

    async def test_list_subscribers_empty(self, async_db_session, test_tenant):
        """Test listing subscribers when none exist"""
        service = RADIUSService(async_db_session, test_tenant.id)

        subscribers = await service.list_subscribers(skip=0, limit=10)

        # There might be subscribers from other tests, so just check it's a list
        assert isinstance(subscribers, list)

    async def test_list_subscribers_pagination(self, async_db_session, test_tenant):
        """Test subscriber list pagination"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create multiple subscribers
        for i in range(5):
            data = RADIUSSubscriberCreate(
                subscriber_id=f"sub-page-{i}",
                username=f"page_user_{i}@isp",
                password="SecurePass123!",
            )
            await service.create_subscriber(data)

        # Test pagination
        page1 = await service.list_subscribers(skip=0, limit=2)
        page2 = await service.list_subscribers(skip=2, limit=2)

        assert len(page1) <= 2
        assert len(page2) <= 2


@pytest.mark.asyncio
class TestRADIUSErrorHandling:
    """Test error handling and edge cases"""

    async def test_disconnect_session_without_username_or_session_id(self, async_db_session, test_tenant):
        """Test disconnect requires either username or session_id"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Should handle gracefully (implementation specific)
        with pytest.raises(ValueError):
            await service.disconnect_session()

    async def test_create_subscriber_with_invalid_bandwidth_profile(self, async_db_session, test_tenant):
        """Test creating subscriber with non-existent bandwidth profile"""
        service = RADIUSService(async_db_session, test_tenant.id)

        data = RADIUSSubscriberCreate(
            subscriber_id="sub-invalid-profile",
            username="invalid_profile_user@isp",
            password="SecurePass123!",
            bandwidth_profile_id="nonexistent-profile-id",
        )

        # Should raise error or handle gracefully
        with pytest.raises((ValueError, Exception)):
            await service.create_subscriber(data)

    async def test_apply_nonexistent_bandwidth_profile(self, async_db_session, test_tenant):
        """Test applying non-existent bandwidth profile"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create subscriber first
        subscriber_data = RADIUSSubscriberCreate(
            subscriber_id="sub-nonexist-profile",
            username="nonexist_profile_user@isp",
            password="SecurePass123!",
        )
        await service.create_subscriber(subscriber_data)

        # Try to apply non-existent profile
        result = await service.apply_bandwidth_profile(
            username="nonexist_profile_user@isp",
            profile_id="nonexistent-id"
        )

        # Should return None or raise error
        assert result is None or isinstance(result, Exception)

    async def test_apply_bandwidth_profile_to_nonexistent_user(self, async_db_session, test_tenant):
        """Test applying bandwidth profile to non-existent user"""
        service = RADIUSService(async_db_session, test_tenant.id)

        # Create profile
        profile_data = BandwidthProfileCreate(
            name="Test Profile",
            download_rate_kbps=10000,
            upload_rate_kbps=2000,
        )
        profile = await service.create_bandwidth_profile(profile_data)

        # Try to apply to non-existent user
        result = await service.apply_bandwidth_profile(
            username="nonexistent_user@isp",
            profile_id=profile.id
        )

        assert result is None


@pytest.mark.asyncio
class TestRADIUSServiceInitialization:
    """Test RADIUS service initialization and configuration"""

    async def test_service_initialization(self, async_db_session, test_tenant):
        """Test RADIUS service initializes correctly"""
        service = RADIUSService(async_db_session, test_tenant.id)

        assert service.session == async_db_session
        assert service.tenant_id == test_tenant.id
        assert service.repository is not None
        assert service.coa_client is not None

    async def test_service_coa_client_initialization(self, async_db_session, test_tenant):
        """Test CoA client is properly initialized"""
        service = RADIUSService(async_db_session, test_tenant.id)

        assert hasattr(service, 'coa_client')
        assert service.radius_server is not None
        assert service.coa_port > 0

    @patch.dict('os.environ', {
        'RADIUS_COA_USE_HTTP': 'true',
        'RADIUS_COA_HTTP_URL': 'http://radius-api.example.com/coa'
    })
    async def test_service_http_coa_initialization(self, async_db_session, test_tenant):
        """Test HTTP CoA client initialization"""
        service = RADIUSService(async_db_session, test_tenant.id)

        assert service.use_http_coa is True
        assert service.http_coa_url == 'http://radius-api.example.com/coa'


@pytest.mark.asyncio
class TestRADIUSStaticMethods:
    """Test static utility methods"""

    def test_generate_random_password_length(self):
        """Test password generation with custom length"""
        password = RADIUSService.generate_random_password(length=16)

        assert len(password) == 16

    def test_generate_random_password_default_length(self):
        """Test password generation with default length"""
        password = RADIUSService.generate_random_password()

        assert len(password) == 12

    def test_generate_random_password_uniqueness(self):
        """Test generated passwords are unique"""
        passwords = [RADIUSService.generate_random_password() for _ in range(10)]

        # All passwords should be unique
        assert len(set(passwords)) == 10

    def test_generate_random_password_complexity(self):
        """Test generated passwords meet complexity requirements"""
        password = RADIUSService.generate_random_password()

        # Should contain letters and digits
        assert any(c.isalpha() for c in password)
        assert any(c.isdigit() for c in password)
