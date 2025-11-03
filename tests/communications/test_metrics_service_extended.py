"""
Extended tests for communication metrics service to improve coverage.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.communications.metrics_service import (
    CommunicationMetricsService,
    get_metrics_service,
)
from dotmac.platform.communications.models import (
    CommunicationLog,
    CommunicationStats,
    CommunicationStatus,
    CommunicationType,
)

# ============================================================================
# Fixtures
# ============================================================================


pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_db_session():
    """Create mock AsyncSession."""
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.add = MagicMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def metrics_service(mock_db_session):
    """Create metrics service instance."""
    return CommunicationMetricsService(mock_db_session)


@pytest.fixture
def sample_log_entry():
    """Create a sample communication log entry."""
    log_entry = MagicMock(spec=CommunicationLog)
    log_entry.id = uuid4()
    log_entry.type = CommunicationType.EMAIL
    log_entry.recipient = "test@example.com"
    log_entry.status = CommunicationStatus.PENDING
    log_entry.retry_count = 0
    log_entry.sent_at = None
    log_entry.delivered_at = None
    log_entry.failed_at = None
    log_entry.error_message = None
    log_entry.provider_message_id = None
    return log_entry


# ============================================================================
# Update Communication Status Tests with Delivered Status
# ============================================================================


@pytest.mark.integration
class TestUpdateCommunicationStatusDelivered:
    """Test updating communication status to delivered."""

    @pytest.mark.asyncio
    async def test_update_to_delivered_status(
        self, metrics_service, mock_db_session, sample_log_entry
    ):
        """Test updating communication to delivered status."""
        # Setup mock
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = sample_log_entry
        mock_db_session.execute.return_value = result_mock

        # Execute
        success = await metrics_service.update_communication_status(
            communication_id=sample_log_entry.id,
            status=CommunicationStatus.DELIVERED,
        )

        # Verify
        assert success is True
        assert sample_log_entry.status == CommunicationStatus.DELIVERED
        assert sample_log_entry.delivered_at is not None
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_to_sent_status(self, metrics_service, mock_db_session, sample_log_entry):
        """Test updating communication to sent status."""
        # Setup mock
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = sample_log_entry
        mock_db_session.execute.return_value = result_mock

        # Execute
        success = await metrics_service.update_communication_status(
            communication_id=sample_log_entry.id,
            status=CommunicationStatus.SENT,
        )

        # Verify
        assert success is True
        assert sample_log_entry.status == CommunicationStatus.SENT
        assert sample_log_entry.sent_at is not None
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_to_failed_status_with_error(
        self, metrics_service, mock_db_session, sample_log_entry
    ):
        """Test updating communication to failed status with error message."""
        # Setup mock
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = sample_log_entry
        mock_db_session.execute.return_value = result_mock

        error_msg = "SMTP server unavailable"

        # Execute
        success = await metrics_service.update_communication_status(
            communication_id=sample_log_entry.id,
            status=CommunicationStatus.FAILED,
            error_message=error_msg,
        )

        # Verify
        assert success is True
        assert sample_log_entry.status == CommunicationStatus.FAILED
        assert sample_log_entry.failed_at is not None
        assert sample_log_entry.error_message == error_msg
        assert sample_log_entry.retry_count == 1
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_with_provider_message_id(
        self, metrics_service, mock_db_session, sample_log_entry
    ):
        """Test updating communication with provider message ID."""
        # Setup mock
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = sample_log_entry
        mock_db_session.execute.return_value = result_mock

        provider_id = "msg_abc123xyz"

        # Execute
        success = await metrics_service.update_communication_status(
            communication_id=sample_log_entry.id,
            status=CommunicationStatus.DELIVERED,
            provider_message_id=provider_id,
        )

        # Verify
        assert success is True
        assert sample_log_entry.provider_message_id == provider_id
        mock_db_session.commit.assert_called_once()


# ============================================================================
# Log Communication Tests
# ============================================================================


@pytest.mark.integration
class TestLogCommunication:
    """Test logging communication."""

    @pytest.mark.asyncio
    async def test_log_email_communication(self, metrics_service, mock_db_session):
        """Test logging an email communication."""
        # Setup mock
        log_entry = MagicMock(spec=CommunicationLog)
        log_entry.id = uuid4()
        log_entry.type = CommunicationType.EMAIL
        log_entry.recipient = "user@example.com"
        log_entry.status = CommunicationStatus.PENDING

        mock_db_session.refresh = AsyncMock(
            side_effect=lambda x: setattr(log_entry, "id", log_entry.id)
        )

        # Execute
        await metrics_service.log_communication(
            type=CommunicationType.EMAIL,
            recipient="user@example.com",
            subject="Test Email",
            sender="noreply@example.com",
            text_body="This is a test",
            html_body="<p>This is a test</p>",
            template_id="template_123",
            template_name="welcome_email",
            user_id=uuid4(),
            job_id="job_abc",
            tenant_id="tenant_xyz",
            metadata={"campaign": "welcome_series"},
        )

        # Verify
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()
        mock_db_session.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_sms_communication(self, metrics_service, mock_db_session):
        """Test logging an SMS communication."""
        # Execute
        await metrics_service.log_communication(
            type=CommunicationType.SMS,
            recipient="+1234567890",
            text_body="Test SMS",
        )

        # Verify
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()


# ============================================================================
# Get Stats Tests with Date Filtering
# ============================================================================


# ============================================================================
# Get Recent Activity Tests
# ============================================================================


@pytest.mark.integration
class TestGetRecentActivity:
    """Test getting recent communication activity."""

    @pytest.mark.asyncio
    async def test_get_recent_activity_with_type_filter(self, metrics_service, mock_db_session):
        """Test getting recent activity filtered by type."""
        # Setup mock
        log1 = MagicMock(spec=CommunicationLog)
        log1.id = uuid4()
        log1.type = CommunicationType.EMAIL

        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [log1]
        mock_db_session.execute.return_value = result_mock

        # Execute
        activities = await metrics_service.get_recent_activity(
            limit=10,
            offset=0,
            type_filter=CommunicationType.EMAIL,
        )

        # Verify
        assert len(activities) == 1
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_recent_activity_with_tenant_and_type(self, metrics_service, mock_db_session):
        """Test getting recent activity with both tenant and type filters."""
        # Setup mock
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = result_mock

        # Execute
        activities = await metrics_service.get_recent_activity(
            limit=5,
            offset=10,
            type_filter=CommunicationType.SMS,
            tenant_id="tenant_123",
        )

        # Verify
        assert len(activities) == 0
        mock_db_session.execute.assert_called_once()


# ============================================================================
# Aggregate Daily Stats Tests
# ============================================================================


@pytest.mark.integration
class TestAggregateDailyStats:
    """Test aggregating daily statistics."""

    @pytest.mark.asyncio
    async def test_aggregate_daily_stats_default_date(self, metrics_service, mock_db_session):
        """Test aggregating stats with default date (yesterday)."""
        # Setup mocks for status counts
        status_result_mock = MagicMock()
        status_row1 = MagicMock()
        status_row1.status = CommunicationStatus.SENT
        status_row1.count = 10
        status_row2 = MagicMock()
        status_row2.status = CommunicationStatus.DELIVERED
        status_row2.count = 8
        status_result_mock.__iter__ = MagicMock(return_value=iter([status_row1, status_row2]))

        # Setup mock for average delivery time
        avg_result_mock = MagicMock()
        avg_result_mock.scalar.return_value = 120.5  # 120.5 seconds

        # Setup mock for existing stats check
        existing_result_mock = MagicMock()
        existing_result_mock.scalar_one_or_none.return_value = None

        # Configure execute to return different values for different queries
        mock_db_session.execute.side_effect = [
            status_result_mock,  # First call for status counts
            avg_result_mock,  # Second call for avg delivery time
            existing_result_mock,  # Third call for existing stats
            status_result_mock,  # Repeat for other comm types...
            avg_result_mock,
            existing_result_mock,
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
        ]

        # Execute
        result = await metrics_service.aggregate_daily_stats(tenant_id="tenant_123")

        # Verify
        assert result is not None
        mock_db_session.commit.assert_called_once()
        # Should call add for each communication type (4 types)
        assert mock_db_session.add.call_count == 4

    @pytest.mark.asyncio
    async def test_aggregate_daily_stats_specific_date(self, metrics_service, mock_db_session):
        """Test aggregating stats for a specific date."""
        specific_date = datetime(2024, 1, 15, tzinfo=UTC)

        # Setup mocks
        status_result_mock = MagicMock()
        status_row = MagicMock()
        status_row.status = CommunicationStatus.SENT
        status_row.count = 15
        status_result_mock.__iter__ = MagicMock(return_value=iter([status_row]))

        avg_result_mock = MagicMock()
        avg_result_mock.scalar.return_value = 90.0

        existing_result_mock = MagicMock()
        existing_result_mock.scalar_one_or_none.return_value = None

        # Configure execute for all communication types
        mock_db_session.execute.side_effect = [
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
        ]

        # Execute
        result = await metrics_service.aggregate_daily_stats(
            date=specific_date, tenant_id="tenant_123"
        )

        # Verify
        assert result is not None
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_aggregate_daily_stats_updates_existing(self, metrics_service, mock_db_session):
        """Test aggregating stats updates existing entry."""
        # Create existing stats entry with proper attribute initialization
        existing_stats = MagicMock(spec=CommunicationStats)
        existing_stats.id = uuid4()
        existing_stats.stats_date = datetime.now(UTC).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        existing_stats.type = CommunicationType.EMAIL
        # Use configure_mock to set initial values
        existing_stats.configure_mock(
            total_sent=5,
            total_delivered=3,
            total_failed=1,
            total_bounced=0,
            total_pending=0,
            avg_delivery_time_seconds=100.0,
        )

        # Setup mocks
        status_result_mock = MagicMock()
        status_row1 = MagicMock()
        status_row1.status = CommunicationStatus.SENT
        status_row1.count = 20
        status_result_mock.__iter__ = MagicMock(return_value=iter([status_row1]))

        avg_result_mock = MagicMock()
        avg_result_mock.scalar.return_value = 150.0

        # Return existing stats
        existing_result_mock = MagicMock()
        existing_result_mock.scalar_one_or_none.return_value = existing_stats

        # Configure execute for all types
        mock_db_session.execute.side_effect = [
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
        ]

        # Execute
        await metrics_service.aggregate_daily_stats()

        # Verify existing entry was updated (just check that attributes were set)
        # The mock allows setting but we verify commit was called
        mock_db_session.commit.assert_called_once()
        # Should not add new entries since they exist
        assert mock_db_session.add.call_count == 0

    @pytest.mark.asyncio
    async def test_aggregate_daily_stats_with_tenant_filter(self, metrics_service, mock_db_session):
        """Test aggregating stats with tenant filter."""
        # Setup mocks
        status_result_mock = MagicMock()
        status_row = MagicMock()
        status_row.status = CommunicationStatus.DELIVERED
        status_row.count = 25
        status_result_mock.__iter__ = MagicMock(return_value=iter([status_row]))

        avg_result_mock = MagicMock()
        avg_result_mock.scalar.return_value = 180.5

        existing_result_mock = MagicMock()
        existing_result_mock.scalar_one_or_none.return_value = None

        # Configure for all types
        mock_db_session.execute.side_effect = [
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
            status_result_mock,
            avg_result_mock,
            existing_result_mock,
        ]

        # Execute
        result = await metrics_service.aggregate_daily_stats(tenant_id="specific_tenant")

        # Verify
        assert result is not None
        mock_db_session.commit.assert_called_once()


# ============================================================================
# Get Metrics Service Factory Tests
# ============================================================================


@pytest.mark.integration
class TestGetMetricsServiceFactory:
    """Test the get_metrics_service factory function."""

    @pytest.mark.asyncio
    async def test_get_metrics_service_creates_new_instance(self, mock_db_session):
        """Test that factory creates new instance."""
        service = get_metrics_service(mock_db_session)

        assert service is not None
        assert isinstance(service, CommunicationMetricsService)
        assert service.db == mock_db_session

    @pytest.mark.asyncio
    async def test_get_metrics_service_returns_existing_instance(self, mock_db_session):
        """Test that factory returns existing instance for same session."""
        service1 = get_metrics_service(mock_db_session)
        service2 = get_metrics_service(mock_db_session)

        # Should return the same instance
        assert service1 is service2

    @pytest.mark.asyncio
    async def test_get_metrics_service_creates_new_for_different_session(self):
        """Test that factory creates new instance for different session."""
        session1 = AsyncMock(spec=AsyncSession)
        session2 = AsyncMock(spec=AsyncSession)

        service1 = get_metrics_service(session1)
        service2 = get_metrics_service(session2)

        # Should be different instances
        assert service1 is not service2
        assert service1.db == session1
        assert service2.db == session2
