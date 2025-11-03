"""
Additional tests for metrics_router.py to achieve 90%+ coverage.

Focuses on testing the _get_communication_stats_cached function
and error handling paths in the endpoint.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import Mock
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.communications.metrics_router import (
    CommunicationStatsResponse,
    _get_communication_stats_cached,
    get_communication_stats,
)
from dotmac.platform.communications.models import (
    CommunicationLog,
    CommunicationStatus,
    CommunicationType,
)

try:
    UTC = datetime.UTC  # type: ignore[attr-defined]
except AttributeError:  # pragma: no cover - older Python versions
    UTC = timezone.utc  # noqa: UP017 - fallback for Python <3.11

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture(autouse=True)
async def _clean_communication_logs(async_db_session: AsyncSession):
    """Ensure communication logs table is cleared between tests."""
    await async_db_session.execute(delete(CommunicationLog))
    await async_db_session.commit()
    yield
    try:
        await async_db_session.execute(delete(CommunicationLog))
        await async_db_session.commit()
    except Exception:
        await async_db_session.rollback()


class TestGetCommunicationStatsCached:
    """Test the cached stats helper function."""

    @pytest.mark.asyncio
    async def test_stats_with_data(self, async_db_session: AsyncSession):
        """Test stats calculation with actual data."""
        # Create test data
        now = datetime.now(UTC)
        logs = [
            CommunicationLog(
                id=uuid4(),
                type=CommunicationType.EMAIL,
                status=CommunicationStatus.DELIVERED,
                recipient="user1@example.com",
                subject="Test 1",
                tenant_id="test-tenant",
                created_at=now - timedelta(hours=1),
            ),
            CommunicationLog(
                id=uuid4(),
                type=CommunicationType.EMAIL,
                status=CommunicationStatus.SENT,
                recipient="user2@example.com",
                subject="Test 2",
                tenant_id="test-tenant",
                created_at=now - timedelta(hours=2),
            ),
            CommunicationLog(
                id=uuid4(),
                type=CommunicationType.SMS,
                status=CommunicationStatus.FAILED,
                recipient="+1234567890",
                tenant_id="test-tenant",
                created_at=now - timedelta(hours=3),
            ),
            CommunicationLog(
                id=uuid4(),
                type=CommunicationType.WEBHOOK,
                status=CommunicationStatus.BOUNCED,
                recipient="https://example.com/webhook",
                tenant_id="test-tenant",
                created_at=now - timedelta(hours=4),
            ),
            CommunicationLog(
                id=uuid4(),
                type=CommunicationType.PUSH,
                status=CommunicationStatus.PENDING,
                recipient="device-token-123",
                tenant_id="test-tenant",
                created_at=now - timedelta(hours=5),
            ),
        ]

        for log in logs:
            async_db_session.add(log)
        await async_db_session.commit()

        # Call the cached function directly (bypass cache)
        stats = await _get_communication_stats_cached.__wrapped__(
            period_days=30,
            tenant_id="test-tenant",
            session=async_db_session,
        )

        # Verify counts
        assert stats["total_sent"] == 5
        assert stats["total_delivered"] == 1
        assert stats["total_failed"] == 1
        assert stats["total_bounced"] == 1
        assert stats["total_pending"] == 1

        # Verify rates (1 delivered out of 5 = 20%)
        assert stats["delivery_rate"] == 20.0
        assert stats["failure_rate"] == 20.0
        assert stats["bounce_rate"] == 20.0

        # Verify by type
        assert stats["emails_sent"] == 2
        assert stats["sms_sent"] == 1
        assert stats["webhooks_sent"] == 1
        assert stats["push_sent"] == 1

        # Verify metadata
        assert stats["period"] == "30d"
        assert isinstance(stats["timestamp"], datetime)

    @pytest.mark.asyncio
    async def test_stats_with_no_data(self, async_db_session: AsyncSession):
        """Test stats calculation with empty database."""
        stats = await _get_communication_stats_cached.__wrapped__(
            period_days=7,
            tenant_id="empty-tenant",
            session=async_db_session,
        )

        # All counts should be 0
        assert stats["total_sent"] == 0
        assert stats["total_delivered"] == 0
        assert stats["total_failed"] == 0
        assert stats["total_bounced"] == 0
        assert stats["total_pending"] == 0

        # Rates should be 0.0 when total_sent is 0
        assert stats["delivery_rate"] == 0.0
        assert stats["failure_rate"] == 0.0
        assert stats["bounce_rate"] == 0.0

        # Type counts should be 0
        assert stats["emails_sent"] == 0
        assert stats["sms_sent"] == 0
        assert stats["webhooks_sent"] == 0
        assert stats["push_sent"] == 0

    @pytest.mark.asyncio
    async def test_stats_without_tenant_filter(self, async_db_session: AsyncSession):
        """Test stats calculation without tenant isolation."""
        # Create data for multiple tenants
        now = datetime.now(UTC)
        logs = [
            CommunicationLog(
                id=uuid4(),
                type=CommunicationType.EMAIL,
                status=CommunicationStatus.SENT,
                recipient="user1@example.com",
                subject="Test 1",
                tenant_id="tenant-1",
                created_at=now,
            ),
            CommunicationLog(
                id=uuid4(),
                type=CommunicationType.EMAIL,
                status=CommunicationStatus.SENT,
                recipient="user2@example.com",
                subject="Test 2",
                tenant_id="tenant-2",
                created_at=now,
            ),
        ]

        for log in logs:
            async_db_session.add(log)
        await async_db_session.commit()

        # Query without tenant filter
        stats = await _get_communication_stats_cached.__wrapped__(
            period_days=30,
            tenant_id=None,
            session=async_db_session,
        )

        # Should include all tenants
        assert stats["total_sent"] >= 2

    @pytest.mark.asyncio
    async def test_stats_different_periods(self, async_db_session: AsyncSession):
        """Test stats for different time periods."""
        now = datetime.now(UTC)

        # Create logs at different times
        old_log = CommunicationLog(
            id=uuid4(),
            type=CommunicationType.EMAIL,
            status=CommunicationStatus.SENT,
            recipient="old@example.com",
            subject="Old",
            tenant_id="test-tenant",
            created_at=now - timedelta(days=100),  # Outside 30 day window
        )
        recent_log = CommunicationLog(
            id=uuid4(),
            type=CommunicationType.EMAIL,
            status=CommunicationStatus.SENT,
            recipient="recent@example.com",
            subject="Recent",
            tenant_id="test-tenant",
            created_at=now - timedelta(days=5),  # Within 30 day window
        )

        async_db_session.add(old_log)
        async_db_session.add(recent_log)
        await async_db_session.commit()

        # 30 day period should only include recent
        stats_30d = await _get_communication_stats_cached.__wrapped__(
            period_days=30,
            tenant_id="test-tenant",
            session=async_db_session,
        )

        # 365 day period should include both
        stats_365d = await _get_communication_stats_cached.__wrapped__(
            period_days=365,
            tenant_id="test-tenant",
            session=async_db_session,
        )

        assert stats_30d["total_sent"] < stats_365d["total_sent"]
        assert stats_30d["period"] == "30d"
        assert stats_365d["period"] == "365d"


class TestGetCommunicationStatsEndpoint:
    """Test the endpoint function directly."""

    @pytest.mark.asyncio
    async def test_endpoint_user_without_tenant(self, async_db_session: AsyncSession):
        """Test endpoint with user that has no tenant_id."""
        mock_user = Mock(spec=UserInfo)
        # User without tenant_id attribute
        del mock_user.tenant_id

        result = await get_communication_stats(
            period_days=7,
            session=async_db_session,
            current_user=mock_user,
        )

        # Should still work, querying across all tenants
        assert isinstance(result, CommunicationStatsResponse)
        assert result.period == "7d"

    @pytest.mark.asyncio
    async def test_endpoint_different_period_values(self, async_db_session: AsyncSession):
        """Test endpoint with various period values."""
        mock_user = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            permissions=[],
            roles=[],
            tenant_id="test-tenant",
        )

        # Test minimum period (1 day)
        result_1d = await get_communication_stats(
            period_days=1,
            session=async_db_session,
            current_user=mock_user,
        )
        assert result_1d.period == "1d"

        # Test maximum period (365 days)
        result_365d = await get_communication_stats(
            period_days=365,
            session=async_db_session,
            current_user=mock_user,
        )
        assert result_365d.period == "365d"

        # Test typical period (30 days)
        result_30d = await get_communication_stats(
            period_days=30,
            session=async_db_session,
            current_user=mock_user,
        )
        assert result_30d.period == "30d"
