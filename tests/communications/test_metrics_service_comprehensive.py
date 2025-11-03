"""
Comprehensive tests for communications metrics service.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from dotmac.platform.communications.metrics_service import (
    CommunicationMetricsService,
    get_metrics_service,
)
from dotmac.platform.communications.models import (
    CommunicationStatus,
    CommunicationType,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_db_session():
    """Create mock database session."""
    session = AsyncMock()
    session.add = Mock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def metrics_service(mock_db_session):
    """Create metrics service instance."""
    return CommunicationMetricsService(mock_db_session)


@pytest.mark.integration
class TestCommunicationMetricsService:
    """Test CommunicationMetricsService class."""

    async def test_log_communication_basic(self, metrics_service, mock_db_session):
        """Test basic communication logging."""

        # Mock refresh to set attributes
        async def mock_refresh(obj):
            obj.id = uuid4()
            obj.created_at = datetime.now(UTC)

        mock_db_session.refresh.side_effect = mock_refresh

        await metrics_service.log_communication(
            type=CommunicationType.EMAIL,
            recipient="test@example.com",
            subject="Test Subject",
            sender="sender@example.com",
        )

        assert mock_db_session.add.called
        assert mock_db_session.commit.called
        assert mock_db_session.refresh.called

    async def test_log_communication_full_fields(self, metrics_service, mock_db_session):
        """Test communication logging with all fields."""
        user_id = uuid4()

        async def mock_refresh(obj):
            obj.id = uuid4()
            obj.created_at = datetime.now(UTC)

        mock_db_session.refresh.side_effect = mock_refresh

        await metrics_service.log_communication(
            type=CommunicationType.EMAIL,
            recipient="test@example.com",
            subject="Full Test",
            sender="sender@example.com",
            text_body="Plain text",
            html_body="<p>HTML</p>",
            template_id="tpl_123",
            template_name="welcome",
            user_id=user_id,
            job_id="job_123",
            tenant_id="tenant_123",
            metadata={"key": "value"},
        )

        assert mock_db_session.add.called
        call_args = mock_db_session.add.call_args[0][0]
        assert call_args.recipient == "test@example.com"
        assert call_args.template_id == "tpl_123"
        assert call_args.tenant_id == "tenant_123"

    async def test_update_communication_status_success(self, metrics_service, mock_db_session):
        """Test successful status update."""
        comm_id = uuid4()
        mock_log = Mock()
        mock_log.id = comm_id
        mock_log.status = CommunicationStatus.PENDING

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = mock_log
        mock_db_session.execute.return_value = mock_result

        success = await metrics_service.update_communication_status(
            communication_id=comm_id, status=CommunicationStatus.SENT, provider_message_id="msg_123"
        )

        assert success is True
        assert mock_log.status == CommunicationStatus.SENT
        assert mock_log.provider_message_id == "msg_123"
        assert mock_db_session.commit.called

    async def test_update_communication_status_not_found(self, metrics_service, mock_db_session):
        """Test status update when communication not found."""
        comm_id = uuid4()

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        success = await metrics_service.update_communication_status(
            communication_id=comm_id, status=CommunicationStatus.SENT
        )

        assert success is False
        assert not mock_db_session.commit.called

    async def test_update_communication_status_with_error(self, metrics_service, mock_db_session):
        """Test status update with error message."""
        comm_id = uuid4()
        mock_log = Mock()
        mock_log.id = comm_id
        mock_log.retry_count = 0  # Initialize retry_count for += operation

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = mock_log
        mock_db_session.execute.return_value = mock_result

        success = await metrics_service.update_communication_status(
            communication_id=comm_id,
            status=CommunicationStatus.FAILED,
            error_message="SMTP connection failed",
        )

        assert success is True
        assert mock_log.status == CommunicationStatus.FAILED
        assert mock_log.error_message == "SMTP connection failed"
        assert mock_log.retry_count == 1  # Should be incremented

    async def test_get_stats_with_filters(self, metrics_service, mock_db_session):
        """Test stats with tenant and date filters."""
        start_date = datetime.now(UTC) - timedelta(days=7)
        end_date = datetime.now(UTC)

        mock_result = Mock()
        mock_result.__iter__ = Mock(return_value=iter([]))
        mock_db_session.execute.return_value = mock_result

        stats = await metrics_service.get_stats(
            tenant_id="tenant_123", start_date=start_date, end_date=end_date
        )

        assert isinstance(stats, dict)
        assert "sent" in stats
        assert "failed" in stats

    async def test_get_recent_activity(self, metrics_service, mock_db_session):
        """Test retrieving recent activity."""
        mock_logs = [
            Mock(
                id=uuid4(),
                type=CommunicationType.EMAIL,
                recipient=f"user{i}@example.com",
                status=CommunicationStatus.SENT,
                created_at=datetime.now(UTC) - timedelta(minutes=i),
            )
            for i in range(3)
        ]

        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = mock_logs
        mock_db_session.execute.return_value = mock_result

        results = await metrics_service.get_recent_activity(limit=10)

        assert len(results) == 3
        assert mock_db_session.execute.called

    async def test_get_recent_activity_with_filters(self, metrics_service, mock_db_session):
        """Test activity with type and tenant filters."""
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        results = await metrics_service.get_recent_activity(
            type_filter=CommunicationType.EMAIL, tenant_id="tenant_123", limit=5
        )

        assert isinstance(results, list)
        assert mock_db_session.execute.called

    async def test_aggregate_daily_stats(self, metrics_service, mock_db_session):
        """Test daily statistics aggregation."""
        # The aggregate_daily_stats method loops through all CommunicationType values
        # and makes multiple DB queries for each. Mocking this complex flow is tricky.
        # Instead, we'll set up basic iterables for the queries.

        # Mock status query result (returns iterable of rows)
        mock_status_rows = []
        mock_status_result = Mock()
        mock_status_result.__iter__ = Mock(return_value=iter(mock_status_rows))

        # Mock avg delivery time result
        mock_avg_result = Mock()
        mock_avg_result.scalar.return_value = 30.5  # 30.5 seconds avg

        # Mock existing stats query
        mock_existing_result = Mock()
        mock_existing_result.scalar_one_or_none.return_value = None  # No existing stats

        # Set up execute to return these mocks in sequence for each communication type
        mock_db_session.execute.side_effect = [
            # For each of the 4 CommunicationType values (EMAIL, SMS, WEBHOOK, PUSH):
            # 1. status query, 2. avg delivery time, 3. existing stats check
            mock_status_result,
            mock_avg_result,
            mock_existing_result,  # EMAIL
            mock_status_result,
            mock_avg_result,
            mock_existing_result,  # SMS
            mock_status_result,
            mock_avg_result,
            mock_existing_result,  # WEBHOOK
            mock_status_result,
            mock_avg_result,
            mock_existing_result,  # PUSH
        ]

        await metrics_service.aggregate_daily_stats()

        # Result should be a CommunicationStats entry (from last iteration)
        assert mock_db_session.commit.called
        assert mock_db_session.add.called  # Should add stats entries


@pytest.mark.integration
class TestGetMetricsService:
    """Test the get_metrics_service factory function."""

    def test_get_metrics_service_creates_instance(self):
        """Test that factory creates service instance."""
        mock_db = Mock()
        service = get_metrics_service(mock_db)

        assert isinstance(service, CommunicationMetricsService)
        assert service.db == mock_db

    def test_get_metrics_service_returns_different_instances(self):
        """Test that factory returns new instances."""
        mock_db1 = Mock()
        mock_db2 = Mock()

        service1 = get_metrics_service(mock_db1)
        service2 = get_metrics_service(mock_db2)

        assert service1 is not service2
        assert service1.db == mock_db1
        assert service2.db == mock_db2
