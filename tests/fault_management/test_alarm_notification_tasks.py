"""
Tests for Alarm Notification Tasks

Tests for the alarm notification integration including helper functions
and the send_alarm_notifications Celery task.
"""

from datetime import timezone, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def session(async_db_session):
    """Alias for async_db_session to match test expectations."""
    return async_db_session


from dotmac.platform.fault_management.models import (  # noqa: E402
    Alarm,
    AlarmSeverity,
    AlarmSource,
    AlarmStatus,
)
from dotmac.platform.fault_management.tasks import (  # noqa: E402
    _determine_alarm_channels,
    _format_alarm_message,
    _get_users_to_notify,
    _map_alarm_severity_to_priority,
    send_alarm_notifications,
)
from dotmac.platform.notifications.models import (  # noqa: E402
    NotificationChannel,
    NotificationPriority,
)
from dotmac.platform.user_management.models import User  # noqa: E402


class TestDetermineAlarmChannels:
    """Test channel determination based on alarm severity and impact"""

    def test_critical_alarm_high_impact(self):
        """Critical alarm with >10 subscribers gets all channels"""
        alarm = Alarm(
            tenant_id="test-tenant",
            alarm_id="test-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Critical Alarm",
            subscriber_count=15,  # High impact
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )

        channels = _determine_alarm_channels(alarm)

        assert NotificationChannel.EMAIL in channels
        assert NotificationChannel.SMS in channels
        assert NotificationChannel.PUSH in channels
        assert NotificationChannel.WEBHOOK in channels
        assert len(channels) == 4

    def test_critical_alarm_low_impact(self):
        """Critical alarm with <=10 subscribers gets email, push, webhook"""
        alarm = Alarm(
            tenant_id="test-tenant",
            alarm_id="test-002",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Critical Alarm",
            subscriber_count=5,  # Low impact
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )

        channels = _determine_alarm_channels(alarm)

        assert NotificationChannel.EMAIL in channels
        assert NotificationChannel.SMS not in channels  # No SMS for low impact
        assert NotificationChannel.PUSH in channels
        assert NotificationChannel.WEBHOOK in channels
        assert len(channels) == 3

    def test_critical_alarm_no_subscriber_count(self):
        """Critical alarm without subscriber count gets email, push, webhook"""
        alarm = Alarm(
            tenant_id="test-tenant",
            alarm_id="test-003",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Critical Alarm",
            subscriber_count=None,  # No subscriber info
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )

        channels = _determine_alarm_channels(alarm)

        assert NotificationChannel.EMAIL in channels
        assert NotificationChannel.SMS not in channels
        assert NotificationChannel.PUSH in channels
        assert NotificationChannel.WEBHOOK in channels
        assert len(channels) == 3

    def test_major_alarm(self):
        """Major alarm gets email and webhook"""
        alarm = Alarm(
            tenant_id="test-tenant",
            alarm_id="test-004",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.SERVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="service.degraded",
            title="Major Alarm",
            subscriber_count=20,
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )

        channels = _determine_alarm_channels(alarm)

        assert NotificationChannel.EMAIL in channels
        assert NotificationChannel.SMS not in channels
        assert NotificationChannel.PUSH not in channels
        assert NotificationChannel.WEBHOOK in channels
        assert len(channels) == 2

    def test_minor_alarm(self):
        """Minor alarm gets only webhook"""
        alarm = Alarm(
            tenant_id="test-tenant",
            alarm_id="test-005",
            severity=AlarmSeverity.MINOR,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="threshold.cpu",
            title="Minor Alarm",
            subscriber_count=0,
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )

        channels = _determine_alarm_channels(alarm)

        assert NotificationChannel.EMAIL not in channels
        assert NotificationChannel.SMS not in channels
        assert NotificationChannel.PUSH not in channels
        assert NotificationChannel.WEBHOOK in channels
        assert len(channels) == 1

    def test_warning_alarm(self):
        """Warning alarm gets only webhook"""
        alarm = Alarm(
            tenant_id="test-tenant",
            alarm_id="test-006",
            severity=AlarmSeverity.WARNING,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="threshold.memory",
            title="Warning Alarm",
            subscriber_count=0,
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )

        channels = _determine_alarm_channels(alarm)

        assert NotificationChannel.EMAIL not in channels
        assert NotificationChannel.SMS not in channels
        assert NotificationChannel.PUSH not in channels
        assert NotificationChannel.WEBHOOK in channels
        assert len(channels) == 1


class TestGetUsersToNotify:
    """Test user lookup for notifications"""

    @pytest.mark.asyncio
    async def test_get_superusers(self, session: AsyncSession, test_tenant: str):
        """Test fetching superuser/admin users"""
        # Create test users
        admin_user = User(
            tenant_id=test_tenant,
            username="admin",
            email="admin@test.com",
            password_hash="hashed",
            full_name="Admin User",
            is_active=True,
            is_superuser=True,
        )
        regular_user = User(
            tenant_id=test_tenant,
            username="user",
            email="user@test.com",
            password_hash="hashed",
            full_name="Regular User",
            is_active=True,
            is_superuser=False,
        )
        inactive_admin = User(
            tenant_id=test_tenant,
            username="inactive",
            email="inactive@test.com",
            password_hash="hashed",
            full_name="Inactive Admin",
            is_active=False,
            is_superuser=True,
        )

        session.add_all([admin_user, regular_user, inactive_admin])
        await session.commit()

        # Create dummy alarm
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="test-alarm",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="test",
            title="Test",
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )

        users = await _get_users_to_notify(session, test_tenant, alarm)

        # Should only get active superuser
        assert len(users) == 1
        assert users[0].email == "admin@test.com"
        assert users[0].is_superuser is True
        assert users[0].is_active is True

    @pytest.mark.asyncio
    async def test_get_users_empty_result(self, session: AsyncSession, test_tenant: str):
        """Test when no users match criteria"""
        # Create only regular, non-admin users
        regular_user = User(
            tenant_id=test_tenant,
            username="user2",
            email="user@test.com",
            password_hash="hashed",
            full_name="Regular User",
            is_active=True,
            is_superuser=False,
        )
        session.add(regular_user)
        await session.commit()

        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="test-alarm",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="test",
            title="Test",
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )

        users = await _get_users_to_notify(session, test_tenant, alarm)

        assert len(users) == 0

    @pytest.mark.asyncio
    async def test_get_users_different_tenant(self, session: AsyncSession, test_tenant: str):
        """Test tenant isolation in user lookup"""
        # Create admin in different tenant
        other_tenant_admin = User(
            tenant_id="other-tenant",
            username="other_admin",
            email="admin@other.com",
            password_hash="hashed",
            full_name="Other Admin",
            is_active=True,
            is_superuser=True,
        )
        session.add(other_tenant_admin)
        await session.commit()

        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="test-alarm",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="test",
            title="Test",
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )

        users = await _get_users_to_notify(session, test_tenant, alarm)

        # Should not get admin from different tenant
        assert len(users) == 0


class TestFormatAlarmMessage:
    """Test alarm message formatting"""

    def test_format_basic_alarm(self):
        """Test formatting alarm with basic info"""
        alarm = Alarm(
            tenant_id="test-tenant",
            alarm_id="test-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Device Down",
            resource_name="OLT-001-Port-1",
            first_occurrence=datetime(2025, 10, 15, 10, 30, 0, tzinfo=timezone.utc),
            last_occurrence=datetime(2025, 10, 15, 10, 30, 0, tzinfo=timezone.utc),
            occurrence_count=1,
        )

        message = _format_alarm_message(alarm)

        assert "Type: device.down" in message
        assert "Title: Device Down" in message
        assert "Resource: OLT-001-Port-1" in message
        assert "First occurred: 2025-10-15 10:30:00 UTC" in message

    def test_format_alarm_with_subscriber_impact(self):
        """Test formatting alarm with subscriber impact"""
        alarm = Alarm(
            tenant_id="test-tenant",
            alarm_id="test-002",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Device Down",
            resource_name="OLT-002",
            subscriber_count=25,
            first_occurrence=datetime(2025, 10, 15, 11, 0, 0, tzinfo=timezone.utc),
            last_occurrence=datetime(2025, 10, 15, 11, 0, 0, tzinfo=timezone.utc),
            occurrence_count=1,
        )

        message = _format_alarm_message(alarm)

        assert "Impact: 25 subscribers affected" in message

    def test_format_alarm_with_cause_and_problem(self):
        """Test formatting alarm with probable cause and description"""
        alarm = Alarm(
            tenant_id="test-tenant",
            alarm_id="test-003",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.SERVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="service.degraded",
            title="Service Degraded",
            resource_name="Service-001",
            probable_cause="High latency detected",
            description="Packet loss >5%",
            first_occurrence=datetime(2025, 10, 15, 12, 0, 0, tzinfo=timezone.utc),
            last_occurrence=datetime(2025, 10, 15, 12, 0, 0, tzinfo=timezone.utc),
            occurrence_count=1,
        )

        message = _format_alarm_message(alarm)

        assert "Cause: High latency detected" in message
        assert "Details: Packet loss >5%" in message

    def test_format_alarm_with_multiple_occurrences(self):
        """Test formatting alarm with multiple occurrences"""
        alarm = Alarm(
            tenant_id="test-tenant",
            alarm_id="test-004",
            severity=AlarmSeverity.MINOR,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="threshold.cpu",
            title="High CPU",
            resource_name="Device-001",
            first_occurrence=datetime(2025, 10, 15, 9, 0, 0, tzinfo=timezone.utc),
            last_occurrence=datetime(2025, 10, 15, 13, 0, 0, tzinfo=timezone.utc),
            occurrence_count=5,
        )

        message = _format_alarm_message(alarm)

        assert "Occurrences: 5" in message

    def test_format_alarm_complete(self):
        """Test formatting alarm with all fields"""
        alarm = Alarm(
            tenant_id="test-tenant",
            alarm_id="test-005",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Critical Device Failure",
            resource_name="OLT-003-Chassis",
            subscriber_count=100,
            probable_cause="Hardware failure",
            description="Power supply fault",
            first_occurrence=datetime(2025, 10, 15, 14, 30, 0, tzinfo=timezone.utc),
            last_occurrence=datetime(2025, 10, 15, 14, 35, 0, tzinfo=timezone.utc),
            occurrence_count=3,
        )

        message = _format_alarm_message(alarm)

        assert "Type: device.down" in message
        assert "Title: Critical Device Failure" in message
        assert "Resource: OLT-003-Chassis" in message
        assert "Impact: 100 subscribers affected" in message
        assert "Cause: Hardware failure" in message
        assert "Details: Power supply fault" in message
        assert "First occurred: 2025-10-15 14:30:00 UTC" in message
        assert "Occurrences: 3" in message


class TestMapAlarmSeverityToPriority:
    """Test severity to priority mapping"""

    def test_critical_to_urgent(self):
        """Critical severity maps to URGENT priority"""
        priority = _map_alarm_severity_to_priority(AlarmSeverity.CRITICAL)
        assert priority == NotificationPriority.URGENT

    def test_major_to_high(self):
        """Major severity maps to HIGH priority"""
        priority = _map_alarm_severity_to_priority(AlarmSeverity.MAJOR)
        assert priority == NotificationPriority.HIGH

    def test_minor_to_medium(self):
        """Minor severity maps to MEDIUM priority"""
        priority = _map_alarm_severity_to_priority(AlarmSeverity.MINOR)
        assert priority == NotificationPriority.MEDIUM

    def test_warning_to_low(self):
        """Warning severity maps to LOW priority"""
        priority = _map_alarm_severity_to_priority(AlarmSeverity.WARNING)
        assert priority == NotificationPriority.LOW


class TestSendAlarmNotificationsTask:
    """Test the send_alarm_notifications Celery task.

    Tests use Celery eager mode (configured in tests/conftest.py) which
    executes tasks synchronously in the same process.
    """

    @pytest.mark.asyncio
    async def test_send_notifications_alarm_not_found(
        self, session: AsyncSession, test_tenant: str
    ):
        """Test task when alarm doesn't exist"""
        non_existent_alarm_id = str(uuid4())

        result = send_alarm_notifications(non_existent_alarm_id, test_tenant)

        assert result["alarm_id"] == non_existent_alarm_id
        assert result["notifications_sent"] is False
        assert result["error"] == "Alarm not found"

    @pytest.mark.asyncio
    async def test_send_notifications_no_users(self, session: AsyncSession, test_tenant: str):
        """Test task when no users to notify"""
        # Create alarm
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="test-alarm-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Device Down",
            resource_name="OLT-001",
            subscriber_count=10,
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )
        session.add(alarm)
        await session.commit()
        await session.refresh(alarm)

        # No users in database (no admins)
        result = send_alarm_notifications(str(alarm.id), test_tenant)

        assert result["alarm_id"] == str(alarm.id)
        assert result["notifications_sent"] is False
        assert result["error"] == "No users to notify"
        assert result["users_notified"] == 0

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_send_notifications_success(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test successful notification sending"""
        # Create alarm
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="test-alarm-002",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Device Down",
            resource_name="OLT-002",
            subscriber_count=15,
            probable_cause="Link failure",
            description="Fiber cut",
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )
        session.add(alarm)

        # Create admin users
        admin1 = User(
            tenant_id=test_tenant,
            username="admin1",
            email="admin1@test.com",
            password_hash="hashed",
            full_name="Admin One",
            is_active=True,
            is_superuser=True,
        )
        admin2 = User(
            tenant_id=test_tenant,
            username="admin2",
            email="admin2@test.com",
            password_hash="hashed",
            full_name="Admin Two",
            is_active=True,
            is_superuser=True,
        )
        session.add_all([admin1, admin2])
        await session.commit()
        await session.refresh(alarm)
        await session.refresh(admin1)
        await session.refresh(admin2)

        # Mock notification service
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.return_value = mock_notification
        mock_notification_service.return_value = mock_service_instance

        result = send_alarm_notifications(str(alarm.id), test_tenant)

        assert result["alarm_id"] == str(alarm.id)
        assert result["notifications_sent"] is True
        assert result["users_notified"] == 2
        assert result["notifications_failed"] == 0
        assert result["severity"] == "critical"

        # Verify channels include SMS (high impact critical alarm)
        assert NotificationChannel.EMAIL.value in result["channels"]
        assert NotificationChannel.SMS.value in result["channels"]
        assert NotificationChannel.PUSH.value in result["channels"]
        assert NotificationChannel.WEBHOOK.value in result["channels"]

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_send_notifications_partial_failure(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test notification sending with partial failures"""
        # Create alarm
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="test-alarm-003",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.SERVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="service.degraded",
            title="Service Degraded",
            resource_name="Service-001",
            subscriber_count=5,
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )
        session.add(alarm)

        # Create admin users
        admin1 = User(
            tenant_id=test_tenant,
            username="admin1",
            email="admin1@test.com",
            password_hash="hashed",
            full_name="Admin One",
            is_active=True,
            is_superuser=True,
        )
        admin2 = User(
            tenant_id=test_tenant,
            username="admin2",
            email="admin2@test.com",
            password_hash="hashed",
            full_name="Admin Two",
            is_active=True,
            is_superuser=True,
        )
        session.add_all([admin1, admin2])
        await session.commit()
        await session.refresh(alarm)
        await session.refresh(admin1)
        await session.refresh(admin2)

        # Mock notification service - succeed for first user, fail for second
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.side_effect = [
            mock_notification,  # Success for first user
            Exception("Notification failed"),  # Failure for second user
        ]
        mock_notification_service.return_value = mock_service_instance

        result = send_alarm_notifications(str(alarm.id), test_tenant)

        assert result["alarm_id"] == str(alarm.id)
        assert result["notifications_sent"] is True
        assert result["users_notified"] == 1
        assert result["notifications_failed"] == 1
        assert result["severity"] == "major"

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_send_notifications_channels_for_minor_alarm(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test that minor alarms only get webhook channel"""
        # Create minor alarm
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="test-alarm-004",
            severity=AlarmSeverity.MINOR,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="threshold.cpu",
            title="High CPU",
            resource_name="Device-001",
            subscriber_count=0,
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )
        session.add(alarm)

        # Create admin user
        admin = User(
            tenant_id=test_tenant,
            username="admin",
            email="admin@test.com",
            password_hash="hashed",
            full_name="Admin",
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)
        await session.commit()
        await session.refresh(alarm)
        await session.refresh(admin)

        # Mock notification service
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.return_value = mock_notification
        mock_notification_service.return_value = mock_service_instance

        result = send_alarm_notifications(str(alarm.id), test_tenant)

        assert result["notifications_sent"] is True
        assert result["severity"] == "minor"

        # Only webhook for minor alarms
        assert NotificationChannel.WEBHOOK.value in result["channels"]
        assert NotificationChannel.EMAIL.value not in result["channels"]
        assert NotificationChannel.SMS.value not in result["channels"]
        assert NotificationChannel.PUSH.value not in result["channels"]
        assert len(result["channels"]) == 1


class TestNotificationMetadata:
    """Test notification metadata and action URLs.

    Tests use Celery eager mode (configured in tests/conftest.py) which
    executes tasks synchronously in the same process.
    """

    @pytest.mark.asyncio
    @patch("dotmac.platform.fault_management.tasks.NotificationService")
    async def test_notification_includes_metadata(
        self, mock_notification_service, session: AsyncSession, test_tenant: str
    ):
        """Test that notification includes proper metadata"""
        # Create alarm with all metadata fields
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="external-alarm-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Critical Alarm",
            resource_name="OLT-001",
            subscriber_count=25,
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )
        session.add(alarm)

        admin = User(
            tenant_id=test_tenant,
            username="admin",
            email="admin@test.com",
            password_hash="hashed",
            full_name="Admin",
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)
        await session.commit()
        await session.refresh(alarm)
        await session.refresh(admin)

        # Mock notification service and capture call arguments
        mock_notification = MagicMock()
        mock_notification.id = uuid4()
        mock_service_instance = AsyncMock()
        mock_service_instance.create_notification.return_value = mock_notification
        mock_notification_service.return_value = mock_service_instance

        result = send_alarm_notifications(str(alarm.id), test_tenant)

        assert result["notifications_sent"] is True

        # Verify create_notification was called with correct metadata
        call_args = mock_service_instance.create_notification.call_args
        assert call_args is not None

        # Check action URL
        assert call_args.kwargs["action_url"] == f"/faults/alarms/{alarm.id}"
        assert call_args.kwargs["action_label"] == "View Alarm"

        # Check metadata
        metadata = call_args.kwargs["metadata"]
        assert metadata["alarm_id"] == str(alarm.id)
        assert metadata["external_alarm_id"] == "external-alarm-001"
        assert metadata["severity"] == "critical"
        assert metadata["alarm_type"] == "device.down"
        assert metadata["subscriber_count"] == 25
