"""
Tests for audit service functionality.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.audit.models import (
    ActivitySeverity,
    ActivityType,
    AuditActivity,
    AuditFilterParams,
)
from dotmac.platform.audit.service import (
    AuditService,
    log_api_activity,
    log_system_activity,
    log_user_activity,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture
def audit_service():
    """Create audit service instance."""
    return AuditService()


@pytest.fixture
def mock_request():
    """Create mock FastAPI request."""
    request = MagicMock()
    request.client.host = "192.168.1.100"
    request.headers = {
        "user-agent": "Mozilla/5.0",
        "x-request-id": "req-123",
    }
    request.state = MagicMock()
    request.state.user_id = "user123"
    request.state.tenant_id = "tenant456"
    return request


@pytest.mark.integration
class TestAuditService:
    """Test AuditService core functionality."""

    @pytest.mark.asyncio
    async def test_log_activity_basic(self, audit_service, async_db_session):
        """Test basic activity logging."""
        audit_service._session = async_db_session

        activity = await audit_service.log_activity(
            activity_type=ActivityType.USER_LOGIN,
            action="login",
            description="User logged in successfully",
            user_id="user123",
            tenant_id="tenant456",
        )

        assert activity.id is not None
        assert activity.activity_type == ActivityType.USER_LOGIN
        assert activity.user_id == "user123"
        assert activity.tenant_id == "tenant456"
        assert activity.action == "login"

    @pytest.mark.asyncio
    async def test_log_activity_with_metadata(self, audit_service, async_db_session):
        """Test logging activity with additional metadata."""
        audit_service._session = async_db_session

        details = {"path": "/api/secrets/key", "method": "GET"}

        activity = await audit_service.log_activity(
            activity_type=ActivityType.SECRET_ACCESSED,
            action="secret_access",
            description="Secret accessed",
            user_id="user123",
            tenant_id="tenant456",
            severity=ActivitySeverity.MEDIUM,
            resource_type="secret",
            resource_id="secret/key",
            details=details,
            ip_address="192.168.1.100",
        )

        assert activity.severity == ActivitySeverity.MEDIUM
        assert activity.resource_type == "secret"
        assert activity.resource_id == "secret/key"
        assert activity.details == details
        assert activity.ip_address == "192.168.1.100"

    @pytest.mark.asyncio
    async def test_log_request_activity(self, audit_service, mock_request, async_db_session):
        """Test logging activity from request context."""
        audit_service._session = async_db_session

        activity = await audit_service.log_request_activity(
            request=mock_request,
            activity_type=ActivityType.API_REQUEST,
            action="api_call",
            description="API request processed",
        )

        assert activity.user_id == "user123"
        assert activity.tenant_id == "tenant456"
        assert activity.ip_address == "192.168.1.100"
        assert activity.user_agent == "Mozilla/5.0"
        assert activity.request_id == "req-123"

    @pytest.mark.asyncio
    async def test_get_activities_with_filters(self, audit_service, async_db_session):
        """Test retrieving activities with filters."""
        audit_service._session = async_db_session

        # Create test activities
        for i in range(5):
            activity = AuditActivity(
                id=uuid4(),
                activity_type=ActivityType.USER_LOGIN if i % 2 == 0 else ActivityType.API_REQUEST,
                severity=ActivitySeverity.LOW,
                user_id=f"user{i}",
                tenant_id="tenant456",
                action="test_action",
                description=f"Test activity {i}",
                timestamp=datetime.now(UTC) - timedelta(hours=i),
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            async_db_session.add(activity)
        await async_db_session.commit()

        # Test filtering by activity type
        filters = AuditFilterParams(
            activity_type=ActivityType.USER_LOGIN,
            tenant_id="tenant456",
            page=1,
            per_page=10,
        )

        result = await audit_service.get_activities(filters)

        assert result.total >= 3  # At least 3 USER_LOGIN activities
        assert all(a.activity_type == ActivityType.USER_LOGIN for a in result.activities)

    @pytest.mark.asyncio
    async def test_get_activities_pagination(self, audit_service, async_db_session):
        """Test activity pagination."""
        audit_service._session = async_db_session

        # Create 15 test activities
        for i in range(15):
            activity = AuditActivity(
                id=uuid4(),
                activity_type=ActivityType.API_REQUEST,
                severity=ActivitySeverity.LOW,
                user_id="user123",
                tenant_id="tenant456",
                action="test_action",
                description=f"Test activity {i}",
                timestamp=datetime.now(UTC) - timedelta(minutes=i),
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            async_db_session.add(activity)
        await async_db_session.commit()

        # Test first page
        filters = AuditFilterParams(
            tenant_id="tenant456",
            page=1,
            per_page=5,
        )

        result = await audit_service.get_activities(filters)

        assert len(result.activities) <= 5
        assert result.has_next == (result.total > 5)
        assert result.has_prev is False

        # Test second page
        filters.page = 2
        result = await audit_service.get_activities(filters)

        assert result.has_prev is True

    @pytest.mark.asyncio
    async def test_get_recent_activities(self, audit_service, async_db_session):
        """Test getting recent activities."""
        audit_service._session = async_db_session

        # Create activities with different ages
        now = datetime.now(UTC)

        # Recent activity
        recent = AuditActivity(
            id=uuid4(),
            activity_type=ActivityType.USER_LOGIN,
            severity=ActivitySeverity.LOW,
            user_id="user123",
            tenant_id="tenant456",
            action="login",
            description="Recent login",
            timestamp=now - timedelta(hours=1),
            created_at=now,
            updated_at=now,
        )

        # Old activity
        old = AuditActivity(
            id=uuid4(),
            activity_type=ActivityType.USER_LOGIN,
            severity=ActivitySeverity.LOW,
            user_id="user123",
            tenant_id="tenant456",
            action="login",
            description="Old login",
            timestamp=now - timedelta(days=40),
            created_at=now,
            updated_at=now,
        )

        async_db_session.add(recent)
        async_db_session.add(old)
        await async_db_session.commit()

        # Get activities from last 7 days
        activities = await audit_service.get_recent_activities(
            tenant_id="tenant456",
            limit=10,
            days=7,
        )

        assert len(activities) >= 1
        assert any(a.description == "Recent login" for a in activities)
        assert not any(a.description == "Old login" for a in activities)

    @pytest.mark.asyncio
    async def test_get_activity_summary(self, audit_service, async_db_session):
        """Test getting activity summary statistics."""
        audit_service._session = async_db_session

        # Create activities with different types and severities
        now = datetime.now(UTC)

        activities_data = [
            (ActivityType.USER_LOGIN, ActivitySeverity.LOW),
            (ActivityType.USER_LOGIN, ActivitySeverity.LOW),
            (ActivityType.SECRET_ACCESSED, ActivitySeverity.MEDIUM),
            (ActivityType.FILE_UPLOADED, ActivitySeverity.LOW),
            (ActivityType.API_REQUEST, ActivitySeverity.HIGH),
        ]

        for activity_type, severity in activities_data:
            activity = AuditActivity(
                id=uuid4(),
                activity_type=activity_type,
                severity=severity,
                user_id="user123",
                tenant_id="tenant456",
                action="test",
                description="Test activity",
                timestamp=now - timedelta(hours=1),
                created_at=now,
                updated_at=now,
            )
            async_db_session.add(activity)
        await async_db_session.commit()

        summary = await audit_service.get_activity_summary(
            tenant_id="tenant456",
            days=7,
        )

        assert summary["total_activities"] >= 5
        assert ActivityType.USER_LOGIN in summary["activities_by_type"]
        assert summary["activities_by_type"][ActivityType.USER_LOGIN] >= 2
        assert ActivitySeverity.LOW in summary["activities_by_severity"]
        assert ActivitySeverity.HIGH in summary["activities_by_severity"]

    @pytest.mark.asyncio
    async def test_log_activity_without_explicit_tenant(self, audit_service, async_db_session):
        """Test that tenant_id is resolved from context when not explicitly provided."""
        audit_service._session = async_db_session

        # Should use tenant from context when available
        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="context_tenant"):
            activity = await audit_service.log_activity(
                activity_type=ActivityType.USER_LOGIN,
                action="login",
                description="User logged in successfully",
                user_id="user123",
            )

            assert activity.tenant_id == "context_tenant"

    @pytest.mark.asyncio
    async def test_log_activity_tenant_isolation_enforced(self, audit_service, async_db_session):
        """Test that tenant_id is required for audit logging when no context is available."""
        audit_service._session = async_db_session

        # Configure the tenant system to require tenant_id
        with patch("dotmac.platform.tenant.get_tenant_config") as mock_config:
            mock_tenant_config = MagicMock()
            mock_tenant_config.is_single_tenant = False
            mock_tenant_config.default_tenant_id = None
            mock_config.return_value = mock_tenant_config

            with patch("dotmac.platform.tenant.get_current_tenant_id", return_value=None):
                with pytest.raises(ValueError, match="tenant_id is required"):
                    await audit_service.log_activity(
                        activity_type=ActivityType.USER_LOGIN,
                        action="login",
                        description="User logged in successfully",
                        user_id="user123",
                    )

    @pytest.mark.asyncio
    async def test_log_activity_with_tenant_context(self, audit_service, async_db_session):
        """Test that tenant_id is auto-populated from context."""
        audit_service._session = async_db_session

        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant456"):
            activity = await audit_service.log_activity(
                activity_type=ActivityType.USER_LOGIN,
                action="login",
                description="User logged in successfully",
                user_id="user123",
            )

            assert activity.tenant_id == "tenant456"
            assert activity.user_id == "user123"

    @pytest.mark.asyncio
    async def test_tenant_isolation_in_queries(self, audit_service, async_db_session):
        """Test that queries properly filter by tenant_id."""
        audit_service._session = async_db_session

        # Create activities for different tenants
        await audit_service.log_activity(
            activity_type=ActivityType.USER_LOGIN,
            action="login",
            description="Tenant 1 activity",
            user_id="user1",
            tenant_id="tenant1",
        )

        await audit_service.log_activity(
            activity_type=ActivityType.USER_LOGIN,
            action="login",
            description="Tenant 2 activity",
            user_id="user2",
            tenant_id="tenant2",
        )

        # Query activities for tenant1 only
        from dotmac.platform.audit.models import AuditFilterParams

        filters = AuditFilterParams(
            tenant_id="tenant1",
            page=1,
            per_page=10,
        )

        result = await audit_service.get_activities(filters)

        # Should only return activities for tenant1
        assert len(result.activities) >= 1
        assert all(a.tenant_id == "tenant1" for a in result.activities)
        assert not any(a.tenant_id == "tenant2" for a in result.activities)


@pytest.mark.integration
class TestAuditHelperFunctions:
    """Test audit helper functions."""

    @pytest.mark.asyncio
    async def test_log_user_activity(self, async_db_session):
        """Test log_user_activity helper."""
        with patch("dotmac.platform.audit.service.AuditService") as MockService:
            mock_service = AsyncMock()
            MockService.return_value = mock_service
            mock_service.log_activity = AsyncMock()

            await log_user_activity(
                user_id="user123",
                activity_type=ActivityType.USER_CREATED,
                action="create",
                description="User created",
            )

            mock_service.log_activity.assert_called_once_with(
                activity_type=ActivityType.USER_CREATED,
                action="create",
                description="User created",
                user_id="user123",
            )

    @pytest.mark.asyncio
    async def test_log_api_activity(self, mock_request):
        """Test log_api_activity helper."""
        with patch("dotmac.platform.audit.service.AuditService") as MockService:
            mock_service = AsyncMock()
            MockService.return_value = mock_service
            mock_service.log_request_activity = AsyncMock()

            await log_api_activity(
                request=mock_request,
                action="api_call",
                description="API called",
            )

            mock_service.log_request_activity.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_system_activity(self):
        """Test log_system_activity helper."""
        with patch("dotmac.platform.audit.service.AuditService") as MockService:
            mock_service = AsyncMock()
            MockService.return_value = mock_service
            mock_service.log_activity = AsyncMock()

            await log_system_activity(
                activity_type=ActivityType.SYSTEM_STARTUP,
                action="startup",
                description="System started",
            )

            mock_service.log_activity.assert_called_once()
            call_args = mock_service.log_activity.call_args[1]
            assert call_args["severity"] == ActivitySeverity.MEDIUM
