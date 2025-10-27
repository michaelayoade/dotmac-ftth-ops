"""
Integration Tests for Alarm Notification System

End-to-end tests for the complete alarm notification workflow including
alarm creation, channel routing, user notification, and delivery tracking.
"""

from datetime import timezone, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmSeverity,
    AlarmSource,
    AlarmStatus,
)
from dotmac.platform.fault_management.schemas import AlarmCreate
from dotmac.platform.fault_management.service import AlarmService
from dotmac.platform.fault_management.tasks import send_alarm_notifications
from dotmac.platform.notifications.models import (
    NotificationChannel,
    NotificationPriority,
    NotificationType,
)
from dotmac.platform.user_management.models import User


class TestAlarmNotificationIntegration:
    """Integration tests for complete alarm notification workflow.

    Tests use Celery eager mode (configured in tests/conftest.py) which
    executes tasks synchronously in the same process.
    """

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_critical_alarm_triggers_notifications(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test that creating a critical alarm triggers notifications"""
        # Setup: Create admin users
        admin1 = User(
            tenant_id=test_tenant,
            email="noc1@test.com",
            username="noc1@test.com",  # Added username field
            password_hash="hashed",
            full_name="NOC Operator 1",
            is_active=True,
            is_superuser=True,
        )
        admin2 = User(
            tenant_id=test_tenant,
            email="noc2@test.com",
            username="noc2@test.com",  # Added username field
            password_hash="hashed",
            full_name="NOC Operator 2",
            is_active=True,
            is_superuser=True,
        )
        session.add_all([admin1, admin2])
        await session.commit()

        # Create critical alarm via service
        alarm_service = AlarmService(session, test_tenant)
        alarm_data = AlarmCreate(
            alarm_id="critical-device-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            alarm_type="device.down",
            title="Critical OLT Down",
            description="OLT-METRO-01 is not responding",
            resource_type="olt",
            resource_id="olt-metro-01",
            resource_name="OLT Metro 01",
            subscriber_count=150,  # High impact
            probable_cause="Power failure",
            recommended_action="Dispatch technician immediately",
        )

        alarm = await alarm_service.create(alarm_data)

        # Mock notification service
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.return_value = mock_notification
        mock_notification_service.return_value = mock_service_instance

        # Execute: Send notifications
        result = send_alarm_notifications(str(alarm.id), test_tenant)

        # Verify: Notifications sent successfully
        assert result["notifications_sent"] is True
        assert result["users_notified"] == 2
        assert result["notifications_failed"] == 0
        assert result["severity"] == "critical"

        # Verify: All channels used for high-impact critical alarm
        assert NotificationChannel.EMAIL.value in result["channels"]
        assert NotificationChannel.SMS.value in result["channels"]
        assert NotificationChannel.PUSH.value in result["channels"]
        assert NotificationChannel.WEBHOOK.value in result["channels"]

        # Verify: Notification service called twice (once per user)
        assert mock_service_instance.create_notification.call_count == 2

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_major_alarm_limited_channels(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test that major alarms use limited channels"""
        # Setup: Create admin user
        admin = User(
            tenant_id=test_tenant,
            email="admin@test.com",
            username="admin@test.com",  # Added username field
            password_hash="hashed",
            full_name="Admin",
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)
        await session.commit()

        # Create major alarm
        alarm_service = AlarmService(session, test_tenant)
        alarm_data = AlarmCreate(
            alarm_id="major-service-001",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.SERVICE,
            alarm_type="service.degraded",
            title="Service Degradation",
            description="High latency detected",
            resource_type="service",
            resource_id="service-001",
            resource_name="Internet Service",
            subscriber_count=10,
        )

        alarm = await alarm_service.create(alarm_data)

        # Mock notification service
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.return_value = mock_notification
        mock_notification_service.return_value = mock_service_instance

        # Execute: Send notifications
        result = send_alarm_notifications(str(alarm.id), test_tenant)

        # Verify: Limited channels for major alarm
        assert result["notifications_sent"] is True
        assert NotificationChannel.EMAIL.value in result["channels"]
        assert NotificationChannel.WEBHOOK.value in result["channels"]
        assert NotificationChannel.SMS.value not in result["channels"]  # No SMS
        assert NotificationChannel.PUSH.value not in result["channels"]  # No Push

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_notification_priority_mapping(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test that alarm severity maps to correct notification priority"""
        # Setup: Create admin user
        admin = User(
            tenant_id=test_tenant,
            email="admin@test.com",
            username="admin@test.com",  # Added username field
            password_hash="hashed",
            full_name="Admin",
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)
        await session.commit()

        # Create critical alarm
        alarm_service = AlarmService(session, test_tenant)
        alarm_data = AlarmCreate(
            alarm_id="critical-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            alarm_type="device.down",
            title="Critical Device Down",
            resource_type="device",
            resource_id="device-001",
            subscriber_count=50,
        )

        alarm = await alarm_service.create(alarm_data)

        # Mock notification service
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.return_value = mock_notification
        mock_notification_service.return_value = mock_service_instance

        # Execute: Send notifications
        send_alarm_notifications(str(alarm.id), test_tenant)

        # Verify: Notification created with URGENT priority
        call_args = mock_service_instance.create_notification.call_args
        assert call_args.kwargs["priority"] == NotificationPriority.URGENT
        assert call_args.kwargs["notification_type"] == NotificationType.ALARM

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_notification_title_and_message(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test notification title and message formatting"""
        # Setup: Create admin user
        admin = User(
            tenant_id=test_tenant,
            email="admin@test.com",
            username="admin@test.com",  # Added username field
            password_hash="hashed",
            full_name="Admin",
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)
        await session.commit()

        # Create alarm with specific details
        alarm_service = AlarmService(session, test_tenant)
        alarm_data = AlarmCreate(
            alarm_id="alarm-with-details",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.NETWORK_DEVICE,
            alarm_type="link.down",
            title="Fiber Link Down",
            description="No light detected on RX",
            resource_type="port",
            resource_id="port-001",
            resource_name="Uplink Port 1",
            subscriber_count=25,
            probable_cause="Fiber cut",
        )

        alarm = await alarm_service.create(alarm_data)

        # Mock notification service
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.return_value = mock_notification
        mock_notification_service.return_value = mock_service_instance

        # Execute: Send notifications
        result = send_alarm_notifications(str(alarm.id), test_tenant)

        # Verify: Title and message content match actual format
        call_args = mock_service_instance.create_notification.call_args
        title = call_args.kwargs["title"]
        message = call_args.kwargs["message"]

        # Title format: "{severity.upper()} Alarm: {title}"
        assert "MAJOR Alarm:" in title
        assert "Fiber Link Down" in title

        # Message format uses: Type, Title, Resource, Impact, Cause, Details
        assert "Resource: Uplink Port 1" in message
        assert "Impact: 25 subscribers affected" in message
        assert "Cause: Fiber cut" in message
        assert "Details: No light detected on RX" in message

    @pytest.mark.asyncio
    async def test_multi_tenant_isolation(self, session: AsyncSession):
        """Test that notifications respect tenant isolation"""
        tenant1 = "tenant-001"
        tenant2 = "tenant-002"

        # Setup: Create admin for tenant 1
        admin_tenant1 = User(
            tenant_id=tenant1,
            email="admin@tenant1.com",
            username="admin@tenant1.com",  # Added username field
            password_hash="hashed",
            full_name="Tenant 1 Admin",
            is_active=True,
            is_superuser=True,
        )

        # Create admin for tenant 2
        admin_tenant2 = User(
            tenant_id=tenant2,
            email="admin@tenant2.com",
            username="admin@tenant2.com",  # Added username field
            password_hash="hashed",
            full_name="Tenant 2 Admin",
            is_active=True,
            is_superuser=True,
        )

        session.add_all([admin_tenant1, admin_tenant2])
        await session.commit()

        # Create alarm for tenant 1
        alarm_tenant1 = Alarm(
            tenant_id=tenant1,
            alarm_id="tenant1-alarm-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Tenant 1 Device Down",
            resource_name="Device-T1",
            subscriber_count=10,
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )
        session.add(alarm_tenant1)
        await session.commit()
        await session.refresh(alarm_tenant1)

        # Execute: Send notifications for tenant 1 alarm
        with patch("dotmac.platform.fault_management.tasks.NotificationService") as mock_service:
            mock_notification = MagicMock()
            mock_notification.id = uuid4()
            mock_service_instance = AsyncMock()
            mock_service_instance.create_notification.return_value = mock_notification
            mock_service.return_value = mock_service_instance

            result = send_alarm_notifications(str(alarm_tenant1.id), tenant1)

            # Verify: Only tenant 1 admin notified
            assert result["users_notified"] == 1

            # Verify notification created for tenant 1
            call_args = mock_service_instance.create_notification.call_args
            assert call_args.kwargs["tenant_id"] == tenant1
            assert call_args.kwargs["user_id"] == admin_tenant1.id

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_notification_resilience_continues_on_failure(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test that notification process continues even if some fail"""
        # Setup: Create multiple admin users
        admins = [
            User(
                tenant_id=test_tenant,
                email=f"admin{i}@test.com",
                username=f"admin{i}",  # Added username field
                password_hash="hashed",
                full_name=f"Admin {i}",
                is_active=True,
                is_superuser=True,
            )
            for i in range(5)
        ]
        session.add_all(admins)
        await session.commit()

        # Create alarm
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="resilience-test-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Test Alarm",
            resource_name="Device",
            subscriber_count=10,
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )
        session.add(alarm)
        await session.commit()
        await session.refresh(alarm)

        # Mock notification service - fail for some users
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.side_effect = [
            mock_notification,  # Success
            Exception("Network error"),  # Fail
            mock_notification,  # Success
            Exception("Timeout"),  # Fail
            mock_notification,  # Success
        ]
        mock_notification_service.return_value = mock_service_instance

        # Execute: Send notifications
        result = send_alarm_notifications(str(alarm.id), test_tenant)

        # Verify: Task completes and tracks both successes and failures
        assert result["notifications_sent"] is True
        assert result["users_notified"] == 3  # 3 successes
        assert result["notifications_failed"] == 2  # 2 failures

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_notification_auto_send_flag(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test that notifications are created with auto_send=True"""
        # Setup: Create admin user
        admin = User(
            tenant_id=test_tenant,
            email="admin@test.com",
            username="admin@test.com",  # Added username field
            password_hash="hashed",
            full_name="Admin",
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)
        await session.commit()

        # Create alarm
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="auto-send-test",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Test Alarm",
            resource_name="Device",
            subscriber_count=10,
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )
        session.add(alarm)
        await session.commit()
        await session.refresh(alarm)

        # Mock notification service
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.return_value = mock_notification
        mock_notification_service.return_value = mock_service_instance

        # Execute: Send notifications
        send_alarm_notifications(str(alarm.id), test_tenant)

        # Verify: auto_send flag set to True
        call_args = mock_service_instance.create_notification.call_args
        assert call_args.kwargs["auto_send"] is True

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_alarm_with_multiple_occurrences(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test notification for alarm with multiple occurrences"""
        # Setup: Create admin user
        admin = User(
            tenant_id=test_tenant,
            email="admin@test.com",
            username="admin@test.com",  # Added username field
            password_hash="hashed",
            full_name="Admin",
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)
        await session.commit()

        # Create alarm with multiple occurrences
        alarm_service = AlarmService(session, test_tenant)
        alarm_data = AlarmCreate(
            alarm_id="recurring-alarm-001",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.MONITORING,
            alarm_type="threshold.cpu",
            title="High CPU Usage",
            resource_type="device",
            resource_id="device-001",
        )

        # Create alarm multiple times to increment occurrence count
        alarm = await alarm_service.create(alarm_data)
        alarm = await alarm_service.create(alarm_data)  # Increment
        alarm = await alarm_service.create(alarm_data)  # Increment again

        # Verify occurrence count
        result = await session.execute(select(Alarm).where(Alarm.id == alarm.id))
        db_alarm = result.scalar_one()
        assert db_alarm.occurrence_count == 3

        # Set required fields
        db_alarm.alarm_name = "High CPU"
        db_alarm.alarm_source = "Monitor"
        db_alarm.managed_object_instance = "Device-001"
        await session.commit()

        # Mock notification service
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.return_value = mock_notification
        mock_notification_service.return_value = mock_service_instance

        # Execute: Send notifications
        result = send_alarm_notifications(str(alarm.id), test_tenant)

        # Verify: Message includes occurrence count
        call_args = mock_service_instance.create_notification.call_args
        message = call_args.kwargs["message"]
        assert "Occurrences: 3" in message


class TestAlarmNotificationWorkflow:
    """Test complete workflow from alarm creation to notification delivery.

    Tests use Celery eager mode (configured in tests/conftest.py) which
    executes tasks synchronously in the same process.
    """

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_complete_critical_alarm_workflow(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test complete workflow for critical alarm"""
        # Step 1: Setup operators
        noc_operator = User(
            tenant_id=test_tenant,
            email="noc@isp.com",
            username="noc@isp.com",  # Added username field
            password_hash="hashed",
            full_name="NOC Operator",
            phone="+1234567890",
            is_active=True,
            is_superuser=True,
        )
        session.add(noc_operator)
        await session.commit()
        await session.refresh(noc_operator)

        # Step 2: Create critical alarm
        alarm_service = AlarmService(session, test_tenant)
        alarm_data = AlarmCreate(
            alarm_id="workflow-test-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            alarm_type="olt.down",
            title="OLT Downtown Failure",
            description="OLT-DOWNTOWN-01 has lost connectivity",
            resource_type="olt",
            resource_id="olt-downtown-01",
            resource_name="OLT Downtown 01",
            subscriber_count=250,  # High impact
            probable_cause="Power failure",
            specific_problem="No SNMP response",
            recommended_action="Dispatch emergency technician",
        )

        alarm = await alarm_service.create(alarm_data)
        assert alarm.status == AlarmStatus.ACTIVE
        assert alarm.severity == AlarmSeverity.CRITICAL

        # Step 3: Mock notification service
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.return_value = mock_notification
        mock_notification_service.return_value = mock_service_instance

        # Step 4: Trigger notifications
        result = send_alarm_notifications(str(alarm.id), test_tenant)

        # Step 5: Verify complete workflow
        assert result["notifications_sent"] is True
        assert result["users_notified"] == 1
        assert result["severity"] == "critical"

        # Verify all channels used for high-impact critical
        assert len(result["channels"]) == 4
        assert NotificationChannel.EMAIL.value in result["channels"]
        assert NotificationChannel.SMS.value in result["channels"]
        assert NotificationChannel.PUSH.value in result["channels"]
        assert NotificationChannel.WEBHOOK.value in result["channels"]

        # Verify notification details
        call_args = mock_service_instance.create_notification.call_args
        assert call_args.kwargs["notification_type"] == NotificationType.ALARM
        assert call_args.kwargs["priority"] == NotificationPriority.URGENT
        assert call_args.kwargs["tenant_id"] == test_tenant
        assert call_args.kwargs["user_id"] == noc_operator.id
        assert "CRITICAL Alarm:" in call_args.kwargs["title"]
        assert "250 subscribers affected" in call_args.kwargs["message"]
        assert call_args.kwargs["auto_send"] is True
