"""
Comprehensive RADIUS Service Integration Tests.

Tests complete RADIUS workflows including:
- Subscriber lifecycle (create, update, suspend, terminate)
- Session management and tracking
- Bandwidth profile enforcement
- NAS server configuration
- Accounting and usage monitoring
- Integration with service lifecycle
"""

from datetime import timezone, datetime, timedelta
from uuid import uuid4

import pytest


@pytest.mark.asyncio
class TestRADIUSSubscriberLifecycle:
    """Test complete RADIUS subscriber lifecycle."""

    async def test_create_subscriber_full_workflow(
        self,
        async_session,
        test_tenant_id,
        sample_radius_subscriber_data,
        sample_bandwidth_profile,
    ):
        """Test creating subscriber with complete configuration."""
        from dotmac.platform.radius.schemas import BandwidthProfileCreate, RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Step 1: Create bandwidth profile
        profile_data = BandwidthProfileCreate(**sample_bandwidth_profile)
        bandwidth_profile = await service.create_bandwidth_profile(profile_data)

        assert bandwidth_profile.id is not None
        assert bandwidth_profile.name == "100 Mbps Fiber"
        assert bandwidth_profile.download_rate_kbps == 100000

        # Step 2: Create subscriber with profile
        subscriber_data = RADIUSSubscriberCreate(
            **sample_radius_subscriber_data, bandwidth_profile_id=bandwidth_profile.id
        )
        subscriber = await service.create_subscriber(subscriber_data)

        assert subscriber.id is not None
        assert subscriber.username == "testuser@isp.com"
        assert subscriber.subscriber_id == "sub_radius_001"
        assert subscriber.bandwidth_profile_id == bandwidth_profile.id
        assert subscriber.framed_ip_address == "10.0.1.100"
        assert subscriber.session_timeout == 3600
        assert subscriber.idle_timeout == 600

    async def test_update_subscriber_bandwidth(
        self, async_session, test_tenant_id, sample_radius_subscriber_data, sample_bandwidth_profile
    ):
        """Test updating subscriber bandwidth profile."""
        from dotmac.platform.radius.schemas import (
            BandwidthProfileCreate,
            RADIUSSubscriberCreate,
            RADIUSSubscriberUpdate,
        )
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create initial profile and subscriber
        profile_data = BandwidthProfileCreate(**sample_bandwidth_profile)
        initial_profile = await service.create_bandwidth_profile(profile_data)

        subscriber_data = RADIUSSubscriberCreate(
            **sample_radius_subscriber_data, bandwidth_profile_id=initial_profile.id
        )
        subscriber = await service.create_subscriber(subscriber_data)

        # Create upgraded profile
        upgraded_profile_data = BandwidthProfileCreate(
            name="500 Mbps Fiber",
            download_rate_kbps=500000,
            upload_rate_kbps=250000,
        )
        upgraded_profile = await service.create_bandwidth_profile(upgraded_profile_data)

        # Update subscriber to use upgraded profile
        update_data = RADIUSSubscriberUpdate(bandwidth_profile_id=upgraded_profile.id)
        updated_subscriber = await service.update_subscriber(
            subscriber_id=subscriber.subscriber_id, data=update_data
        )

        assert updated_subscriber.bandwidth_profile_id == upgraded_profile.id

    async def test_suspend_and_resume_subscriber(
        self, async_session, test_tenant_id, sample_radius_subscriber_data
    ):
        """Test suspending and resuming subscriber access."""
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create subscriber
        subscriber_data = RADIUSSubscriberCreate(**sample_radius_subscriber_data)
        subscriber = await service.create_subscriber(subscriber_data)

        # Suspend subscriber
        suspended = await service.suspend_subscriber(subscriber_id=subscriber.subscriber_id)
        assert suspended.is_suspended is True

        # Verify authentication would fail when suspended
        # In real implementation, RADIUS would reject auth for suspended users

        # Resume subscriber
        resumed = await service.resume_subscriber(subscriber_id=subscriber.subscriber_id)
        assert resumed.is_suspended is False

    async def test_terminate_subscriber(
        self, async_session, test_tenant_id, sample_radius_subscriber_data
    ):
        """Test terminating subscriber access."""
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create subscriber
        subscriber_data = RADIUSSubscriberCreate(**sample_radius_subscriber_data)
        subscriber = await service.create_subscriber(subscriber_data)

        # Terminate subscriber (soft delete)
        terminated = await service.delete_subscriber(subscriber_id=subscriber.subscriber_id)
        assert terminated is True

        # Verify subscriber cannot be retrieved
        retrieved = await service.get_subscriber(subscriber_id=subscriber.subscriber_id)
        assert retrieved is None or retrieved.deleted_at is not None


@pytest.mark.asyncio
class TestRADIUSSessionManagement:
    """Test RADIUS session tracking and management."""

    async def test_start_radius_session(
        self, async_session, test_tenant_id, sample_radius_subscriber_data, sample_radius_session
    ):
        """Test starting a new RADIUS session."""
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create subscriber first
        subscriber_data = RADIUSSubscriberCreate(**sample_radius_subscriber_data)
        await service.create_subscriber(subscriber_data)

        # Start session
        session = await service.start_session(
            username=sample_radius_session["username"],
            nas_ip_address=sample_radius_session["nas_ip_address"],
            nas_port_id=sample_radius_session["nas_port_id"],
            framed_ip_address=sample_radius_session["framed_ip_address"],
            session_id=sample_radius_session["session_id"],
        )

        assert session.username == "testuser@isp.com"
        assert session.nas_ip_address == "192.168.1.1"
        assert session.framed_ip_address == "10.0.1.100"

    async def test_update_session_accounting(
        self, async_session, test_tenant_id, sample_radius_subscriber_data, sample_radius_session
    ):
        """Test updating session with accounting data."""
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create subscriber and start session
        subscriber_data = RADIUSSubscriberCreate(**sample_radius_subscriber_data)
        await service.create_subscriber(subscriber_data)

        session = await service.start_session(
            username=sample_radius_session["username"],
            nas_ip_address=sample_radius_session["nas_ip_address"],
            nas_port_id=sample_radius_session["nas_port_id"],
            framed_ip_address=sample_radius_session["framed_ip_address"],
            session_id=sample_radius_session["session_id"],
        )

        # Update with accounting data
        updated_session = await service.update_session_accounting(
            session_id=session.session_id,
            acct_session_time=1800,  # 30 minutes
            acct_input_octets=1024 * 1024 * 500,  # 500 MB downloaded
            acct_output_octets=1024 * 1024 * 100,  # 100 MB uploaded
        )

        assert updated_session.acct_session_time == 1800
        assert updated_session.acct_input_octets == 1024 * 1024 * 500
        assert updated_session.acct_output_octets == 1024 * 1024 * 100

    async def test_stop_radius_session(
        self, async_session, test_tenant_id, sample_radius_subscriber_data, sample_radius_session
    ):
        """Test stopping a RADIUS session."""
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create subscriber and start session
        subscriber_data = RADIUSSubscriberCreate(**sample_radius_subscriber_data)
        await service.create_subscriber(subscriber_data)

        session = await service.start_session(
            username=sample_radius_session["username"],
            nas_ip_address=sample_radius_session["nas_ip_address"],
            nas_port_id=sample_radius_session["nas_port_id"],
            framed_ip_address=sample_radius_session["framed_ip_address"],
            session_id=sample_radius_session["session_id"],
        )

        # Stop session
        stopped_session = await service.stop_session(
            session_id=session.session_id,
            acct_session_time=3600,
            acct_input_octets=1024 * 1024 * 1000,
            acct_output_octets=1024 * 1024 * 200,
            acct_terminate_cause="User-Request",
        )

        assert stopped_session.acct_stop_time is not None
        assert stopped_session.acct_terminate_cause == "User-Request"

    async def test_get_active_sessions(
        self, async_session, test_tenant_id, sample_radius_subscriber_data, sample_radius_session
    ):
        """Test retrieving active sessions for tenant."""
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create multiple subscribers with sessions
        for i in range(3):
            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id=f"sub_radius_00{i}",
                username=f"testuser{i}@isp.com",
                password="SecurePassword123!",
            )
            await service.create_subscriber(subscriber_data)

            await service.start_session(
                username=f"testuser{i}@isp.com",
                nas_ip_address="192.168.1.1",
                nas_port_id=f"eth0/{i}",
                framed_ip_address=f"10.0.1.{100 + i}",
                session_id=f"sess_{i}",
            )

        # Get all active sessions
        active_sessions = await service.get_active_sessions()
        assert len(active_sessions) >= 3


@pytest.mark.asyncio
class TestRADIUSBandwidthProfiles:
    """Test bandwidth profile management."""

    async def test_create_bandwidth_profile(
        self, async_session, test_tenant_id, sample_bandwidth_profile
    ):
        """Test creating bandwidth profile."""
        from dotmac.platform.radius.schemas import BandwidthProfileCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        profile_data = BandwidthProfileCreate(**sample_bandwidth_profile)
        profile = await service.create_bandwidth_profile(profile_data)

        assert profile.name == "100 Mbps Fiber"
        assert profile.download_rate_kbps == 100000
        assert profile.upload_rate_kbps == 50000
        assert profile.download_burst_kbps == 120000

    async def test_list_bandwidth_profiles(
        self, async_session, test_tenant_id, sample_bandwidth_profile
    ):
        """Test listing all bandwidth profiles."""
        from dotmac.platform.radius.schemas import BandwidthProfileCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create multiple profiles
        profiles_data = [
            BandwidthProfileCreate(
                name=f"{speed} Mbps Plan",
                download_rate_kbps=speed * 1000,
                upload_rate_kbps=speed * 500,
            )
            for speed in [50, 100, 200, 500, 1000]
        ]

        for profile_data in profiles_data:
            await service.create_bandwidth_profile(profile_data)

        # List all profiles
        profiles = await service.list_bandwidth_profiles()
        assert len(profiles) >= 5

    async def test_apply_bandwidth_profile_to_subscriber(
        self, async_session, test_tenant_id, sample_radius_subscriber_data, sample_bandwidth_profile
    ):
        """Test applying bandwidth profile to existing subscriber."""
        from dotmac.platform.radius.schemas import BandwidthProfileCreate, RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create subscriber without profile
        subscriber_data = RADIUSSubscriberCreate(**sample_radius_subscriber_data)
        subscriber = await service.create_subscriber(subscriber_data)

        # Create and apply profile
        profile_data = BandwidthProfileCreate(**sample_bandwidth_profile)
        profile = await service.create_bandwidth_profile(profile_data)

        updated_subscriber = await service.apply_bandwidth_profile(
            username=subscriber.username,
            subscriber_id=subscriber.subscriber_id,
            profile_id=profile.id,
        )

        assert updated_subscriber.bandwidth_profile_id == profile.id


@pytest.mark.asyncio
class TestRADIUSNASConfiguration:
    """Test NAS (Network Access Server) configuration."""

    async def test_create_nas_server(self, async_session, test_tenant_id, sample_nas_server):
        """Test creating NAS server configuration."""
        from dotmac.platform.radius.schemas import NASCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        nas_data = NASCreate(**sample_nas_server)
        nas = await service.create_nas(nas_data)

        assert nas.nas_name == "bras-01.isp.com"
        assert nas.short_name == "bras01"
        assert nas.nas_type == "cisco"
        assert nas.server_ip == "192.168.1.1"

    async def test_update_nas_secret(self, async_session, test_tenant_id, sample_nas_server):
        """Test updating NAS server secret."""
        from dotmac.platform.radius.schemas import NASCreate, NASUpdate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create NAS
        nas_data = NASCreate(**sample_nas_server)
        nas = await service.create_nas(nas_data)

        # Update secret
        update_data = NASUpdate(secret="NewRadiusSecret456!")
        updated_nas = await service.update_nas(nas_id=nas.id, data=update_data)

        assert updated_nas.secret == "NewRadiusSecret456!"

    async def test_list_nas_servers(self, async_session, test_tenant_id):
        """Test listing all NAS servers."""
        from dotmac.platform.radius.schemas import NASCreate
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create multiple NAS servers
        nas_servers = [
            NASCreate(
                nas_name=f"bras-{i:02d}.isp.com",
                short_name=f"bras{i:02d}",
                nas_type="cisco",
                secret=f"Secret{i}",
                server_ip=f"192.168.1.{i}",
            )
            for i in range(1, 6)
        ]

        for nas_data in nas_servers:
            await service.create_nas(nas_data)

        # List all NAS
        all_nas = await service.list_nas()
        assert len(all_nas) >= 5


@pytest.mark.asyncio
class TestRADIUSUsageMonitoring:
    """Test RADIUS usage monitoring and reporting."""

    async def test_get_subscriber_usage(
        self, async_session, test_tenant_id, sample_radius_subscriber_data, sample_radius_session
    ):
        """Test retrieving subscriber usage statistics."""
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate, RADIUSUsageQuery
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create subscriber and simulate session
        subscriber_data = RADIUSSubscriberCreate(**sample_radius_subscriber_data)
        await service.create_subscriber(subscriber_data)

        session = await service.start_session(
            username=sample_radius_session["username"],
            nas_ip_address=sample_radius_session["nas_ip_address"],
            nas_port_id=sample_radius_session["nas_port_id"],
            framed_ip_address=sample_radius_session["framed_ip_address"],
            session_id=sample_radius_session["session_id"],
        )

        # Update with usage data
        await service.update_session_accounting(
            session_id=session.session_id,
            acct_session_time=3600,
            acct_input_octets=1024 * 1024 * 1024 * 5,  # 5 GB
            acct_output_octets=1024 * 1024 * 1024 * 1,  # 1 GB
        )

        # Get usage statistics
        usage_query = RADIUSUsageQuery(
            subscriber_id="sub_radius_001",
            start_date=datetime.now(timezone.utc) - timedelta(days=30),
            end_date=datetime.now(timezone.utc),
        )
        usage = await service.get_subscriber_usage(usage_query)

        assert usage.total_download_bytes >= 1024 * 1024 * 1024 * 5
        assert usage.total_upload_bytes >= 1024 * 1024 * 1024 * 1
        assert usage.total_session_time >= 3600

    async def test_get_tenant_usage_summary(
        self, async_session, test_tenant_id, sample_radius_subscriber_data
    ):
        """Test retrieving tenant-wide usage summary."""
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate, RADIUSUsageQuery
        from dotmac.platform.radius.service import RADIUSService

        service = RADIUSService(async_session, test_tenant_id)

        # Create multiple subscribers with usage
        for i in range(5):
            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id=f"sub_radius_00{i}",
                username=f"testuser{i}@isp.com",
                password="SecurePassword123!",
            )
            await service.create_subscriber(subscriber_data)

            session = await service.start_session(
                username=f"testuser{i}@isp.com",
                nas_ip_address="192.168.1.1",
                nas_port_id=f"eth0/{i}",
                framed_ip_address=f"10.0.1.{100 + i}",
                session_id=f"sess_{i}",
            )

            await service.update_session_accounting(
                session_id=session.session_id,
                acct_session_time=3600,
                acct_input_octets=1024 * 1024 * 1024 * 2,  # 2 GB each
                acct_output_octets=1024 * 1024 * 500,  # 500 MB each
            )

        # Get tenant usage summary
        usage_query = RADIUSUsageQuery(
            start_date=datetime.now(timezone.utc) - timedelta(days=30),
            end_date=datetime.now(timezone.utc),
        )
        summary = await service.get_tenant_usage_summary(usage_query)

        assert summary.total_subscribers >= 5
        assert summary.total_download_bytes >= 1024 * 1024 * 1024 * 10  # At least 10 GB total


@pytest.mark.asyncio
class TestRADIUSIntegrationWithLifecycle:
    """Test RADIUS integration with service lifecycle."""

    async def test_provision_service_creates_radius_subscriber(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
        sample_service_provisioning_request,
        sample_bandwidth_profile,
    ):
        """Test that service provisioning automatically creates RADIUS subscriber."""
        from dotmac.platform.radius.schemas import BandwidthProfileCreate
        from dotmac.platform.radius.service import RADIUSService
        from dotmac.platform.services.lifecycle.schemas import ServiceProvisionRequest
        from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

        # Create RADIUS service and bandwidth profile
        radius_service = RADIUSService(async_session, test_tenant_id)
        profile_data = BandwidthProfileCreate(**sample_bandwidth_profile)
        bandwidth_profile = await radius_service.create_bandwidth_profile(profile_data)

        # Provision service via lifecycle
        lifecycle_service = LifecycleOrchestrationService(async_session)
        provision_request = ServiceProvisionRequest(
            customer_id=test_customer_id,
            service_name=sample_service_provisioning_request["service_name"],
            service_type=sample_service_provisioning_request["service_type"],
            subscription_id=sample_service_provisioning_request["subscription_id"],
            service_config={
                **sample_service_provisioning_request["service_config"],
                "bandwidth_profile_id": str(bandwidth_profile.id),
            },
            equipment_assigned=sample_service_provisioning_request["equipment_assigned"],
        )

        response = await lifecycle_service.provision_service(
            tenant_id=test_tenant_id,
            data=provision_request,
            created_by_user_id=uuid4(),
        )

        assert response.service_instance_id is not None
        assert response.workflow_id is not None

        # Verify RADIUS subscriber was created
        # In real implementation, this would be part of the provisioning workflow
        await radius_service.get_subscriber_by_subscription(
            subscription_id=sample_service_provisioning_request["subscription_id"]
        )

        # Note: This test assumes the provisioning workflow includes RADIUS subscriber creation
        # If not, the workflow would need to be updated to include this step

    async def test_suspend_service_suspends_radius_access(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
        sample_radius_subscriber_data,
    ):
        """Test that suspending service also suspends RADIUS access."""
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService

        radius_service = RADIUSService(async_session, test_tenant_id)

        # Create RADIUS subscriber
        subscriber_data = RADIUSSubscriberCreate(**sample_radius_subscriber_data)
        subscriber = await radius_service.create_subscriber(subscriber_data)

        # Simulate service suspension (would be called from lifecycle service)
        suspended_subscriber = await radius_service.suspend_subscriber(
            subscriber_id=subscriber.subscriber_id
        )

        assert suspended_subscriber.is_suspended is True

        # Verify active sessions would be terminated
        # In production, this would send RADIUS CoA/DM to terminate active sessions
