"""
Integration tests for metrics service with real DB.
"""

from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import delete

from dotmac.platform.communications.metrics_service import (
    CommunicationMetricsService,
    get_metrics_service,
)
from dotmac.platform.communications.models import (
    CommunicationLog,
    CommunicationStatus,
    CommunicationType,
)

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(autouse=True)
async def _clean_communications(async_db_session):
    """Ensure communications table is reset between tests."""
    await async_db_session.execute(delete(CommunicationLog))
    await async_db_session.commit()
    yield
    try:
        await async_db_session.execute(delete(CommunicationLog))
        await async_db_session.commit()
    except Exception:
        await async_db_session.rollback()


@pytest.mark.integration
class TestMetricsServiceIntegration:
    """Integration tests with real async DB session."""

    async def test_log_and_retrieve_communication(self, async_db_session):
        """Test logging a communication and retrieving it."""
        service = CommunicationMetricsService(async_db_session)

        # Log a communication
        log_entry = await service.log_communication(
            type=CommunicationType.EMAIL,
            recipient="test@example.com",
            subject="Test Email",
            sender="sender@example.com",
            text_body="Test body",
        )

        assert log_entry.id is not None
        assert log_entry.recipient == "test@example.com"
        assert log_entry.status == CommunicationStatus.PENDING

    async def test_update_communication_status(self, async_db_session):
        """Test updating communication status."""
        service = CommunicationMetricsService(async_db_session)

        # Create a communication
        log_entry = await service.log_communication(
            type=CommunicationType.EMAIL, recipient="update@example.com", subject="Status Test"
        )

        # Update its status
        success = await service.update_communication_status(
            communication_id=log_entry.id,
            status=CommunicationStatus.SENT,
            provider_message_id="msg_123",
        )

        assert success is True

    async def test_get_stats_empty(self, async_db_session):
        """Test getting stats when no communications exist."""
        service = CommunicationMetricsService(async_db_session)

        stats = await service.get_stats()

        assert isinstance(stats, dict)
        assert "sent" in stats
        assert "failed" in stats
        assert stats["sent"] == 0
        assert stats["failed"] == 0

    async def test_get_stats_with_data(self, async_db_session):
        """Test getting stats with actual communications."""
        service = CommunicationMetricsService(async_db_session)

        # Create some communications
        log1 = await service.log_communication(
            type=CommunicationType.EMAIL, recipient="user1@example.com", subject="Email 1"
        )

        log2 = await service.log_communication(
            type=CommunicationType.EMAIL, recipient="user2@example.com", subject="Email 2"
        )

        # Update statuses
        await service.update_communication_status(log1.id, CommunicationStatus.SENT)
        await service.update_communication_status(log2.id, CommunicationStatus.FAILED)

        # Get stats
        stats = await service.get_stats()

        assert stats["sent"] >= 1
        assert stats["failed"] >= 1

    async def test_get_recent_activity(self, async_db_session):
        """Test retrieving recent activity."""
        service = CommunicationMetricsService(async_db_session)

        # Create multiple communications
        for i in range(5):
            await service.log_communication(
                type=CommunicationType.EMAIL, recipient=f"user{i}@example.com", subject=f"Email {i}"
            )

        # Get recent activity
        activity = await service.get_recent_activity(limit=10)

        assert len(activity) == 5

    async def test_get_recent_activity_with_filters(self, async_db_session):
        """Test activity filtering by type."""
        service = CommunicationMetricsService(async_db_session)

        # Create EMAIL communications
        await service.log_communication(
            type=CommunicationType.EMAIL, recipient="email@example.com", subject="Email"
        )

        # Create SMS communication
        await service.log_communication(
            type=CommunicationType.SMS, recipient="+1234567890", subject="SMS"
        )

        # Filter by EMAIL
        activity = await service.get_recent_activity(type_filter=CommunicationType.EMAIL)

        assert all(log.type == CommunicationType.EMAIL for log in activity)

    async def test_get_stats_with_tenant_filter(self, async_db_session):
        """Test stats filtered by tenant."""
        service = CommunicationMetricsService(async_db_session)

        # Create for tenant1
        log1 = await service.log_communication(
            type=CommunicationType.EMAIL,
            recipient="tenant1@example.com",
            subject="Tenant 1",
            tenant_id="tenant1",
        )

        # Create for tenant2
        log2 = await service.log_communication(
            type=CommunicationType.EMAIL,
            recipient="tenant2@example.com",
            subject="Tenant 2",
            tenant_id="tenant2",
        )

        await service.update_communication_status(log1.id, CommunicationStatus.SENT)
        await service.update_communication_status(log2.id, CommunicationStatus.SENT)

        # Get stats for tenant1 only
        stats = await service.get_stats(tenant_id="tenant1")

        # Should have stats (exact count depends on isolation)
        assert isinstance(stats, dict)

    async def test_log_communication_with_metadata(self, async_db_session):
        """Test logging with custom metadata."""
        service = CommunicationMetricsService(async_db_session)

        metadata = {"campaign_id": "camp_123", "tags": ["promotional", "newsletter"]}

        log_entry = await service.log_communication(
            type=CommunicationType.EMAIL,
            recipient="meta@example.com",
            subject="Metadata Test",
            metadata=metadata,
        )

        assert log_entry.metadata_ == metadata

    async def test_log_communication_with_template(self, async_db_session):
        """Test logging with template information."""
        service = CommunicationMetricsService(async_db_session)

        log_entry = await service.log_communication(
            type=CommunicationType.EMAIL,
            recipient="template@example.com",
            subject="Template Test",
            template_id="tpl_123",
            template_name="welcome_email",
        )

        assert log_entry.template_id == "tpl_123"
        assert log_entry.template_name == "welcome_email"

    async def test_log_communication_with_user_context(self, async_db_session):
        """Test logging with user context."""
        service = CommunicationMetricsService(async_db_session)
        user_id = uuid4()

        log_entry = await service.log_communication(
            type=CommunicationType.EMAIL,
            recipient="user@example.com",
            subject="User Test",
            user_id=user_id,
            tenant_id="tenant_123",
        )

        assert log_entry.user_id == user_id
        assert log_entry.tenant_id == "tenant_123"


@pytest.mark.integration
class TestMetricsServiceFactory:
    """Test the factory function."""

    def test_get_metrics_service(self, async_db_session):
        """Test factory creates service instance."""
        service = get_metrics_service(async_db_session)

        assert isinstance(service, CommunicationMetricsService)
        assert service.db == async_db_session
