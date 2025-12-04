"""
Comprehensive tests for Audit Service.

Focuses on filling coverage gaps in audit service functionality.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, Mock, patch
from uuid import uuid4

import pytest
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

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

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def mock_session():
    """Create mock AsyncSession."""
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    return session


@pytest.fixture
def audit_service(mock_session):
    """Create AuditService with mock session."""
    return AuditService(session=mock_session)


@pytest.fixture
def sample_activity():
    """Create sample audit activity."""
    activity = Mock(spec=AuditActivity)
    activity.id = uuid4()
    activity.activity_type = ActivityType.USER_LOGIN
    activity.severity = ActivitySeverity.LOW
    activity.user_id = "user_123"
    activity.tenant_id = "tenant_123"
    activity.timestamp = datetime.now(UTC)
    activity.resource_type = "user"
    activity.resource_id = "user_123"
    activity.action = "login"
    activity.description = "User logged in"
    activity.details = {"ip": "192.168.1.1"}
    activity.ip_address = "192.168.1.1"
    activity.user_agent = "Mozilla/5.0"
    activity.request_id = "req_123"
    return activity


@pytest.fixture
def mock_request():
    """Create mock FastAPI request."""
    request = Mock(spec=Request)
    request.client = Mock()
    request.client.host = "192.168.1.100"
    request.headers = {
        "user-agent": "TestAgent/1.0",
        "x-request-id": "test-req-123",
    }
    request.state = Mock()
    request.state.user_id = "user_456"
    request.state.tenant_id = "tenant_456"
    return request


# ============================================================================
# Log Activity Tests
# ============================================================================


@pytest.mark.integration
class TestLogActivity:
    """Test log_activity method."""

    @pytest.mark.asyncio
    async def test_log_activity_basic(self, audit_service, mock_session):
        """Test basic activity logging."""
        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant_123"):
            await audit_service.log_activity(
                activity_type=ActivityType.USER_LOGIN,
                action="login",
                description="User logged in",
            )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()
        mock_session.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_activity_with_all_fields(self, audit_service, mock_session):
        """Test activity logging with all optional fields."""
        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant_123"):
            await audit_service.log_activity(
                activity_type=ActivityType.SECRET_ACCESSED,
                action="access",
                description="Secret accessed",
                user_id="user_123",
                tenant_id="tenant_123",
                resource_type="secret",
                resource_id="secret_456",
                severity=ActivitySeverity.HIGH,
                details={"key": "value"},
                ip_address="10.0.0.1",
                user_agent="CustomAgent/1.0",
                request_id="req_789",
            )

        mock_session.add.assert_called_once()
        added_activity = mock_session.add.call_args[0][0]
        assert added_activity.user_id == "user_123"
        assert added_activity.tenant_id == "tenant_123"
        assert added_activity.resource_type == "secret"
        assert added_activity.severity == ActivitySeverity.HIGH

    @pytest.mark.asyncio
    async def test_log_activity_default_severity(self, audit_service, mock_session):
        """Test that default severity is LOW."""
        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant_123"):
            await audit_service.log_activity(
                activity_type=ActivityType.API_REQUEST,
                action="request",
                description="API request made",
            )

        added_activity = mock_session.add.call_args[0][0]
        assert added_activity.severity == ActivitySeverity.LOW


# ============================================================================
# Log Request Activity Tests
# ============================================================================


@pytest.mark.integration
class TestLogRequestActivity:
    """Test log_request_activity method."""

    @pytest.mark.asyncio
    async def test_log_request_activity_basic(self, audit_service, mock_session, mock_request):
        """Test logging activity from request context."""
        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant_123"):
            await audit_service.log_request_activity(
                request=mock_request,
                activity_type=ActivityType.API_REQUEST,
                action="GET /users",
                description="List users requested",
            )

        mock_session.add.assert_called_once()
        added_activity = mock_session.add.call_args[0][0]
        assert added_activity.ip_address == "192.168.1.100"
        assert added_activity.user_agent == "TestAgent/1.0"
        assert added_activity.request_id == "test-req-123"
        assert added_activity.user_id == "user_456"
        assert added_activity.tenant_id == "tenant_456"

    @pytest.mark.asyncio
    async def test_log_request_activity_no_client(self, audit_service, mock_session):
        """Test logging activity when request has no client."""
        request = Mock(spec=Request)
        request.client = None
        request.headers = {}
        request.state = Mock()
        request.state.user_id = "user_123"
        request.state.tenant_id = "tenant_123"

        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant_123"):
            await audit_service.log_request_activity(
                request=request,
                activity_type=ActivityType.API_REQUEST,
                action="test",
                description="Test request",
            )

        added_activity = mock_session.add.call_args[0][0]
        assert added_activity.ip_address is None

    @pytest.mark.asyncio
    async def test_log_request_activity_override_user_tenant(
        self, audit_service, mock_session, mock_request
    ):
        """Test overriding user_id and tenant_id from kwargs."""
        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant_123"):
            await audit_service.log_request_activity(
                request=mock_request,
                activity_type=ActivityType.API_REQUEST,
                action="test",
                description="Test",
                user_id="override_user",
                tenant_id="override_tenant",
            )

        added_activity = mock_session.add.call_args[0][0]
        assert added_activity.user_id == "override_user"
        assert added_activity.tenant_id == "override_tenant"

    @pytest.mark.asyncio
    async def test_log_request_activity_missing_state_attributes(self, audit_service, mock_session):
        """Test logging when request.state doesn't have user/tenant attributes."""
        request = Mock(spec=Request)
        request.client = Mock()
        request.client.host = "127.0.0.1"
        request.headers = {}
        request.state = Mock(spec=[])  # No attributes

        with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant_123"):
            await audit_service.log_request_activity(
                request=request,
                activity_type=ActivityType.API_REQUEST,
                action="test",
                description="Test",
            )

        added_activity = mock_session.add.call_args[0][0]
        assert added_activity.user_id is None


# ============================================================================
# Get Activities Tests
# ============================================================================


@pytest.mark.integration
class TestGetActivities:
    """Test get_activities method."""

    @pytest.mark.asyncio
    async def test_get_activities_with_user_filter(
        self, audit_service, mock_session, sample_activity
    ):
        """Test filtering activities by user_id."""
        # Mock count query
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        # Mock activities query
        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity]

        mock_session.execute.side_effect = [count_result, activities_result]

        filters = AuditFilterParams(
            tenant_id="tenant_123",
            user_id="user_123",
            page=1,
            per_page=50,
        )

        result = await audit_service.get_activities(filters)

        assert len(result.activities) == 1
        assert result.total == 1
        assert result.page == 1
        assert result.per_page == 50

    @pytest.mark.asyncio
    async def test_get_activities_with_for_user(self, audit_service, mock_session, sample_activity):
        """Test using for_user parameter."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity]

        mock_session.execute.side_effect = [count_result, activities_result]

        filters = AuditFilterParams(tenant_id="tenant_123")

        result = await audit_service.get_activities(filters, for_user="user_123")

        assert len(result.activities) == 1

    @pytest.mark.asyncio
    async def test_get_activities_with_for_tenant(
        self, audit_service, mock_session, sample_activity
    ):
        """Test using for_tenant parameter."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity]

        mock_session.execute.side_effect = [count_result, activities_result]

        filters = AuditFilterParams(tenant_id="tenant_456")

        result = await audit_service.get_activities(filters, for_tenant="tenant_123")

        assert len(result.activities) == 1

    @pytest.mark.asyncio
    async def test_get_activities_with_activity_type_filter(
        self, audit_service, mock_session, sample_activity
    ):
        """Test filtering by activity type."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity]

        mock_session.execute.side_effect = [count_result, activities_result]

        filters = AuditFilterParams(
            tenant_id="tenant_123",
            activity_type=ActivityType.USER_LOGIN,
        )

        result = await audit_service.get_activities(filters)

        assert len(result.activities) == 1

    @pytest.mark.asyncio
    async def test_get_activities_with_severity_filter(
        self, audit_service, mock_session, sample_activity
    ):
        """Test filtering by severity."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity]

        mock_session.execute.side_effect = [count_result, activities_result]

        filters = AuditFilterParams(
            tenant_id="tenant_123",
            severity=ActivitySeverity.HIGH,
        )

        result = await audit_service.get_activities(filters)

        assert len(result.activities) == 1

    @pytest.mark.asyncio
    async def test_get_activities_with_resource_filters(
        self, audit_service, mock_session, sample_activity
    ):
        """Test filtering by resource type and ID."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity]

        mock_session.execute.side_effect = [count_result, activities_result]

        filters = AuditFilterParams(
            tenant_id="tenant_123",
            resource_type="user",
            resource_id="user_123",
        )

        result = await audit_service.get_activities(filters)

        assert len(result.activities) == 1

    @pytest.mark.asyncio
    async def test_get_activities_with_date_range(
        self, audit_service, mock_session, sample_activity
    ):
        """Test filtering by date range."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity]

        mock_session.execute.side_effect = [count_result, activities_result]

        start_date = datetime.now(UTC) - timedelta(days=7)
        end_date = datetime.now(UTC)

        filters = AuditFilterParams(
            tenant_id="tenant_123",
            start_date=start_date,
            end_date=end_date,
        )

        result = await audit_service.get_activities(filters)

        assert len(result.activities) == 1

    @pytest.mark.asyncio
    async def test_get_activities_pagination_has_next(
        self, audit_service, mock_session, sample_activity
    ):
        """Test pagination with has_next=True."""
        count_result = MagicMock()
        count_result.scalar.return_value = 100  # More than per_page

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity] * 50

        mock_session.execute.side_effect = [count_result, activities_result]

        filters = AuditFilterParams(
            tenant_id="tenant_123",
            page=1,
            per_page=50,
        )

        result = await audit_service.get_activities(filters)

        assert result.has_next is True
        assert result.has_prev is False

    @pytest.mark.asyncio
    async def test_get_activities_pagination_has_prev(
        self, audit_service, mock_session, sample_activity
    ):
        """Test pagination with has_prev=True."""
        count_result = MagicMock()
        count_result.scalar.return_value = 100

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity] * 50

        mock_session.execute.side_effect = [count_result, activities_result]

        filters = AuditFilterParams(
            tenant_id="tenant_123",
            page=2,
            per_page=50,
        )

        result = await audit_service.get_activities(filters)

        assert result.has_prev is True


# ============================================================================
# Get Recent Activities Tests
# ============================================================================


@pytest.mark.integration
class TestGetRecentActivities:
    """Test get_recent_activities method."""

    @pytest.mark.asyncio
    async def test_get_recent_activities_default_params(
        self, audit_service, mock_session, sample_activity
    ):
        """Test getting recent activities with default parameters."""
        count_result = MagicMock()
        count_result.scalar.return_value = 5

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity] * 5

        mock_session.execute.side_effect = [count_result, activities_result]

        activities = await audit_service.get_recent_activities(tenant_id="tenant_123")

        assert len(activities) == 5

    @pytest.mark.asyncio
    async def test_get_recent_activities_custom_limit(
        self, audit_service, mock_session, sample_activity
    ):
        """Test with custom limit."""
        count_result = MagicMock()
        count_result.scalar.return_value = 10

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity] * 10

        mock_session.execute.side_effect = [count_result, activities_result]

        activities = await audit_service.get_recent_activities(
            tenant_id="tenant_123",
            limit=10,
        )

        assert len(activities) == 10

    @pytest.mark.asyncio
    async def test_get_recent_activities_custom_days(
        self, audit_service, mock_session, sample_activity
    ):
        """Test with custom days parameter."""
        count_result = MagicMock()
        count_result.scalar.return_value = 3

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity] * 3

        mock_session.execute.side_effect = [count_result, activities_result]

        activities = await audit_service.get_recent_activities(
            tenant_id="tenant_123",
            days=7,
        )

        assert len(activities) == 3

    @pytest.mark.asyncio
    async def test_get_recent_activities_with_user_id(
        self, audit_service, mock_session, sample_activity
    ):
        """Test filtering recent activities by user."""
        count_result = MagicMock()
        count_result.scalar.return_value = 2

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity] * 2

        mock_session.execute.side_effect = [count_result, activities_result]

        activities = await audit_service.get_recent_activities(
            tenant_id="tenant_123",
            user_id="user_123",
        )

        assert len(activities) == 2


# ============================================================================
# Get Activity Summary Tests
# ============================================================================


@pytest.mark.integration
class TestGetActivitySummary:
    """Test get_activity_summary method."""

    @pytest.mark.asyncio
    async def test_get_activity_summary_basic(self, audit_service, mock_session):
        """Test getting activity summary."""
        # Mock total count
        count_result = MagicMock()
        count_result.scalar.return_value = 100

        # Mock activities by type
        type_result = MagicMock()
        type_result.all.return_value = [
            (ActivityType.USER_LOGIN, 50),
            (ActivityType.API_REQUEST, 30),
        ]

        # Mock activities by severity
        severity_result = MagicMock()
        severity_result.all.return_value = [
            (ActivitySeverity.LOW, 70),
            (ActivitySeverity.HIGH, 30),
        ]

        mock_session.execute.side_effect = [count_result, type_result, severity_result]

        summary = await audit_service.get_activity_summary(tenant_id="tenant_123")

        assert summary["total_activities"] == 100
        assert summary["period_days"] == 7
        assert ActivityType.USER_LOGIN in summary["activities_by_type"]
        assert ActivitySeverity.LOW in summary["activities_by_severity"]

    @pytest.mark.asyncio
    async def test_get_activity_summary_with_user_filter(self, audit_service, mock_session):
        """Test summary with user filter."""
        count_result = MagicMock()
        count_result.scalar.return_value = 20

        type_result = MagicMock()
        type_result.all.return_value = [(ActivityType.USER_LOGIN, 20)]

        severity_result = MagicMock()
        severity_result.all.return_value = [(ActivitySeverity.LOW, 20)]

        mock_session.execute.side_effect = [count_result, type_result, severity_result]

        summary = await audit_service.get_activity_summary(
            tenant_id="tenant_123",
            user_id="user_123",
        )

        assert summary["total_activities"] == 20

    @pytest.mark.asyncio
    async def test_get_activity_summary_custom_days(self, audit_service, mock_session):
        """Test summary with custom days parameter."""
        count_result = MagicMock()
        count_result.scalar.return_value = 50

        type_result = MagicMock()
        type_result.all.return_value = []

        severity_result = MagicMock()
        severity_result.all.return_value = []

        mock_session.execute.side_effect = [count_result, type_result, severity_result]

        summary = await audit_service.get_activity_summary(
            tenant_id="tenant_123",
            days=30,
        )

        assert summary["period_days"] == 30


# ============================================================================
# Helper Functions Tests
# ============================================================================


@pytest.mark.integration
class TestHelperFunctions:
    """Test helper functions."""

    @pytest.mark.asyncio
    async def test_log_user_activity(self, mock_session):
        """Test log_user_activity helper."""
        with patch("dotmac.platform.audit.service.AuditService") as MockService:
            mock_service = MockService.return_value
            mock_service.log_activity = AsyncMock()

            with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant_123"):
                await log_user_activity(
                    user_id="user_123",
                    activity_type=ActivityType.USER_LOGIN,
                    action="login",
                    description="User logged in",
                )

            mock_service.log_activity.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_api_activity(self, mock_request):
        """Test log_api_activity helper."""
        with patch("dotmac.platform.audit.service.AuditService") as MockService:
            mock_service = MockService.return_value
            mock_service.log_request_activity = AsyncMock()

            with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant_123"):
                await log_api_activity(
                    request=mock_request,
                    action="GET /users",
                    description="List users",
                )

            mock_service.log_request_activity.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_system_activity(self):
        """Test log_system_activity helper."""
        with patch("dotmac.platform.audit.service.AuditService") as MockService:
            mock_service = MockService.return_value
            mock_service.log_activity = AsyncMock()

            with patch("dotmac.platform.tenant.get_current_tenant_id", return_value="tenant_123"):
                await log_system_activity(
                    activity_type=ActivityType.SYSTEM_STARTUP,
                    action="startup",
                    description="System started",
                )

            mock_service.log_activity.assert_called_once()
            # Verify severity is MEDIUM for system activities
            call_kwargs = mock_service.log_activity.call_args[1]
            assert call_kwargs["severity"] == ActivitySeverity.MEDIUM


# ============================================================================
# Session Management Tests
# ============================================================================


@pytest.mark.integration
class TestSessionManagement:
    """Test _get_session method."""

    def test_get_session_with_existing_session(self, mock_session):
        """Test that existing session is used."""
        service = AuditService(session=mock_session)
        session_context = service._get_session()

        # Should return a context manager
        assert hasattr(session_context, "__aenter__")
        assert hasattr(session_context, "__aexit__")

    def test_get_session_without_session(self):
        """Test creating new session when none provided."""
        service = AuditService(session=None)

        with patch("dotmac.platform.db.AsyncSessionLocal") as MockSessionLocal:
            service._get_session()

            # Should call AsyncSessionLocal
            MockSessionLocal.assert_called_once()


# ============================================================================
# Additional Coverage Tests
# ============================================================================


@pytest.mark.integration
class TestAdditionalCoverage:
    """Additional tests to reach 90% coverage."""

    @pytest.mark.asyncio
    async def test_get_activities_with_tenant_filter_from_params(
        self, audit_service, mock_session, sample_activity
    ):
        """Test that tenant_id from filters is used when for_tenant is not provided."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity]

        mock_session.execute.side_effect = [count_result, activities_result]

        filters = AuditFilterParams(tenant_id="tenant_from_filters")

        result = await audit_service.get_activities(filters)

        assert len(result.activities) == 1

    @pytest.mark.asyncio
    async def test_get_activities_prefer_filters_over_for_params(
        self, audit_service, mock_session, sample_activity
    ):
        """Test that filters take precedence over for_user/for_tenant."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1

        activities_result = MagicMock()
        activities_result.scalars.return_value.all.return_value = [sample_activity]

        mock_session.execute.side_effect = [count_result, activities_result]

        # Filters have user_id, so for_user should be ignored
        filters = AuditFilterParams(
            tenant_id="tenant_123",
            user_id="filter_user",
        )

        result = await audit_service.get_activities(filters, for_user="ignored_user")

        assert len(result.activities) == 1

    @pytest.mark.asyncio
    async def test_get_activity_summary_with_both_filters(self, audit_service, mock_session):
        """Test summary with both user and tenant filters."""
        count_result = MagicMock()
        count_result.scalar.return_value = 15

        type_result = MagicMock()
        type_result.all.return_value = [(ActivityType.API_REQUEST, 15)]

        severity_result = MagicMock()
        severity_result.all.return_value = [(ActivitySeverity.LOW, 15)]

        mock_session.execute.side_effect = [count_result, type_result, severity_result]

        summary = await audit_service.get_activity_summary(
            tenant_id="tenant_123",
            user_id="user_123",
            days=14,
        )

        assert summary["total_activities"] == 15
        assert summary["period_days"] == 14
