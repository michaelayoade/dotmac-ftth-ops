"""Comprehensive tests for audit/router.py (24.44% coverage -> 90%+)

Tests all audit activity endpoints including:
- List activities with filtering and pagination
- Get recent activities
- Get user activities
- Get activity summary
- Get single activity by ID
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import ActivitySeverity, AuditActivity
from dotmac.platform.audit.router import ensure_audit_access
from dotmac.platform.audit.router import router as audit_router
from dotmac.platform.auth.core import UserInfo, get_current_user, get_current_user_optional
from dotmac.platform.db import get_async_session
from dotmac.platform.tenant import get_current_tenant_id, set_current_tenant_id

pytestmark = pytest.mark.integration

SampleActivities = tuple[list[AuditActivity], str]


@pytest.fixture
def app() -> FastAPI:
    """Create FastAPI app with audit router."""
    app = FastAPI()
    app.include_router(audit_router, prefix="/api/v1")
    return app


@pytest.fixture
def test_user() -> UserInfo:
    """Create test user info."""
    return UserInfo(
        user_id=str(uuid4()),
        username="testuser",
        email="test@example.com",
        tenant_id="test-tenant",
        roles=["user"],
        permissions=["security.audit.read"],
    )


@pytest.fixture
def client(app: FastAPI, async_db_session: AsyncSession, test_user: UserInfo) -> TestClient:
    """Create test client with database and user."""
    app.dependency_overrides[get_async_session] = lambda: async_db_session
    app.dependency_overrides[get_current_user] = lambda: test_user
    app.dependency_overrides[get_current_user_optional] = lambda: test_user
    app.dependency_overrides[get_current_tenant_id] = lambda: "test-tenant"
    app.dependency_overrides[ensure_audit_access] = lambda: test_user
    set_current_tenant_id("test-tenant")
    client = TestClient(app)
    try:
        yield client
    finally:
        client.close()
        set_current_tenant_id(None)


@pytest_asyncio.fixture
async def sample_activities(async_db_session: AsyncSession) -> SampleActivities:
    """Create sample audit activities."""
    user_id = str(uuid4())

    activities = [
        # Recent activities (within 7 days)
        AuditActivity(
            id=uuid4(),
            activity_type="user.login",
            severity=ActivitySeverity.LOW.value,
            user_id=user_id,
            tenant_id="test-tenant",
            action="login",
            description="User logged in",
            resource_type="user",
            resource_id=user_id,
            ip_address="192.168.1.1",
            timestamp=datetime.now(UTC) - timedelta(days=1),
            created_at=datetime.now(UTC) - timedelta(days=1),
        ),
        AuditActivity(
            id=uuid4(),
            activity_type="user.logout",
            severity=ActivitySeverity.LOW.value,
            user_id=user_id,
            tenant_id="test-tenant",
            action="logout",
            description="User logged out",
            timestamp=datetime.now(UTC) - timedelta(hours=12),
            created_at=datetime.now(UTC) - timedelta(hours=12),
        ),
        # Medium severity activity
        AuditActivity(
            id=uuid4(),
            activity_type="secret.created",
            severity=ActivitySeverity.MEDIUM.value,
            user_id=user_id,
            tenant_id="test-tenant",
            action="create_secret",
            description="Secret created",
            resource_type="secret",
            resource_id=str(uuid4()),
            timestamp=datetime.now(UTC) - timedelta(days=2),
            created_at=datetime.now(UTC) - timedelta(days=2),
        ),
        # High severity activity
        AuditActivity(
            id=uuid4(),
            activity_type="api.error",
            severity=ActivitySeverity.HIGH.value,
            user_id=user_id,
            tenant_id="test-tenant",
            action="api_error",
            description="API error occurred",
            timestamp=datetime.now(UTC) - timedelta(days=5),
            created_at=datetime.now(UTC) - timedelta(days=5),
        ),
        # Old activity (35 days ago)
        AuditActivity(
            id=uuid4(),
            activity_type="user.created",
            severity=ActivitySeverity.LOW.value,
            user_id=str(uuid4()),
            tenant_id="test-tenant",
            action="create_user",
            description="User created",
            timestamp=datetime.now(UTC) - timedelta(days=35),
            created_at=datetime.now(UTC) - timedelta(days=35),
        ),
        # Different tenant activity (should be filtered out)
        AuditActivity(
            id=uuid4(),
            activity_type="user.login",
            severity=ActivitySeverity.LOW.value,
            user_id=str(uuid4()),
            tenant_id="different-tenant",
            action="login",
            description="User logged in",
            timestamp=datetime.now(UTC) - timedelta(days=1),
            created_at=datetime.now(UTC) - timedelta(days=1),
        ),
    ]

    for activity in activities:
        async_db_session.add(activity)
    await async_db_session.commit()

    return activities, user_id


# ==================== List Activities Tests ====================


class TestListActivities:
    """Test GET /audit/activities endpoint."""

    @pytest.mark.asyncio
    async def test_list_activities_default_params(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test listing activities with default parameters."""
        response = client.get("/api/v1/audit/activities")

        assert response.status_code == 200
        data = response.json()

        assert "activities" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert "has_next" in data
        assert "has_prev" in data

        # Should only include test-tenant activities (not different-tenant)
        assert data["total"] <= 5  # Excludes different-tenant activity

    @pytest.mark.asyncio
    async def test_list_activities_with_user_filter(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test filtering activities by user ID."""
        activities, user_id = sample_activities

        response = client.get(f"/api/v1/audit/activities?user_id={user_id}")

        assert response.status_code == 200
        data = response.json()

        # All returned activities should be for the specified user
        for activity in data["activities"]:
            if activity["user_id"]:
                assert activity["user_id"] == user_id

    @pytest.mark.asyncio
    async def test_list_activities_with_activity_type_filter(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test filtering by activity type."""
        response = client.get("/api/v1/audit/activities?activity_type=user.login")

        assert response.status_code == 200
        data = response.json()

        # All returned activities should be of type user.login
        for activity in data["activities"]:
            assert activity["activity_type"] == "user.login"

    @pytest.mark.asyncio
    async def test_list_activities_with_severity_filter(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test filtering by severity."""
        response = client.get("/api/v1/audit/activities?severity=high")

        assert response.status_code == 200
        data = response.json()

        # All returned activities should be high severity
        for activity in data["activities"]:
            assert activity["severity"] == "high"

    @pytest.mark.asyncio
    async def test_list_activities_with_resource_filter(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test filtering by resource type."""
        response = client.get("/api/v1/audit/activities?resource_type=user")

        assert response.status_code == 200
        data = response.json()

        for activity in data["activities"]:
            if activity["resource_type"]:
                assert activity["resource_type"] == "user"

    @pytest.mark.asyncio
    async def test_list_activities_with_days_filter(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test filtering by days parameter."""
        # Get activities from last 7 days only
        response = client.get("/api/v1/audit/activities?days=7")

        assert response.status_code == 200
        data = response.json()

        # Should not include 35-day-old activity
        assert data["total"] < 5  # Less than all activities

    @pytest.mark.asyncio
    async def test_list_activities_pagination(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test pagination."""
        # Page 1 with 2 items per page
        response = client.get("/api/v1/audit/activities?page=1&per_page=2")

        assert response.status_code == 200
        data = response.json()

        assert data["page"] == 1
        assert data["per_page"] == 2
        assert len(data["activities"]) <= 2

        # If there are more than 2 activities, has_next should be true
        if data["total"] > 2:
            assert data["has_next"] is True

    @pytest.mark.asyncio
    async def test_list_activities_invalid_page(self, client: TestClient) -> None:
        """Test with invalid page number."""
        response = client.get("/api/v1/audit/activities?page=0")

        # Should return validation error
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_activities_invalid_per_page(self, client: TestClient) -> None:
        """Test with invalid per_page value."""
        response = client.get("/api/v1/audit/activities?per_page=2000")

        # Should return validation error (max is 1000)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_activities_without_user(
        self, app: FastAPI, async_db_session: AsyncSession, test_user: UserInfo
    ) -> None:
        """Test listing activities without authenticated user but with tenant context.

        This is an edge case where tenant_id is provided but user is None.
        In production, this wouldn't happen, but the endpoint handles it gracefully.
        """
        # Override to return None for user but provide tenant_id
        app.dependency_overrides[get_async_session] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: None
        app.dependency_overrides[get_current_user_optional] = lambda: None
        app.dependency_overrides[get_current_tenant_id] = lambda: "test-tenant"
        app.dependency_overrides[ensure_audit_access] = lambda: test_user

        client = TestClient(app)
        response = client.get("/api/v1/audit/activities")

        # Should still work with tenant_id override, just won't log the API activity
        assert response.status_code == 200


# ==================== Recent Activities Tests ====================


class TestRecentActivities:
    """Test GET /audit/activities/recent endpoint."""

    @pytest.mark.asyncio
    async def test_get_recent_activities_default(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test getting recent activities with default parameters."""
        response = client.get("/api/v1/audit/activities/recent")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)
        # Default limit is 20, default days is 7
        assert len(data) <= 20

        # All should be from test-tenant
        for activity in data:
            assert activity["tenant_id"] == "test-tenant"

    @pytest.mark.asyncio
    async def test_get_recent_activities_with_limit(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test getting recent activities with custom limit."""
        response = client.get("/api/v1/audit/activities/recent?limit=2")

        assert response.status_code == 200
        data = response.json()

        assert len(data) <= 2

    @pytest.mark.asyncio
    async def test_get_recent_activities_with_days(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test getting recent activities with custom days."""
        response = client.get("/api/v1/audit/activities/recent?days=1")

        assert response.status_code == 200
        data = response.json()

        # Should only include activities from last 1 day
        now = datetime.now(UTC)
        for activity in data:
            created_at = datetime.fromisoformat(activity["timestamp"].replace("Z", "+00:00"))
            assert (now - created_at).days <= 1

    @pytest.mark.asyncio
    async def test_get_recent_activities_invalid_limit(self, client: TestClient) -> None:
        """Test with invalid limit parameter."""
        response = client.get("/api/v1/audit/activities/recent?limit=200")

        # Should return validation error (max is 100)
        assert response.status_code == 422


# ==================== User Activities Tests ====================


class TestUserActivities:
    """Test GET /audit/activities/user/{user_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_user_activities(
        self, authenticated_client: AsyncClient, sample_activities: SampleActivities
    ) -> None:
        """Test getting activities for specific user."""
        activities, user_id = sample_activities

        response = await authenticated_client.get(f"/api/v1/audit/activities/user/{user_id}")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)

        # All activities should be for this user
        for activity in data:
            if activity["user_id"]:
                assert activity["user_id"] == user_id

    @pytest.mark.asyncio
    async def test_get_user_activities_with_limit(
        self, authenticated_client: AsyncClient, sample_activities: SampleActivities
    ) -> None:
        """Test getting user activities with limit."""
        activities, user_id = sample_activities

        response = await authenticated_client.get(
            f"/api/v1/audit/activities/user/{user_id}?limit=1"
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data) <= 1

    @pytest.mark.asyncio
    async def test_get_user_activities_nonexistent_user(
        self, authenticated_client: AsyncClient
    ) -> None:
        """Test getting activities for non-existent user."""
        fake_user_id = str(uuid4())

        response = await authenticated_client.get(f"/api/v1/audit/activities/user/{fake_user_id}")

        assert response.status_code == 200
        data = response.json()

        # Should return empty list
        assert data == []


# ==================== Activity Summary Tests ====================


class TestActivitySummary:
    """Test GET /audit/activities/summary endpoint."""

    @pytest.mark.asyncio
    async def test_get_activity_summary_default(
        self, authenticated_client: AsyncClient, sample_activities: SampleActivities
    ) -> None:
        """Test getting activity summary with default parameters."""
        response = await authenticated_client.get("/api/v1/audit/activities/summary")

        assert response.status_code == 200
        data = response.json()

        # Summary should include counts and aggregations
        assert (
            "total_activities" in data
            or "activities_by_type" in data
            or "activities_by_severity" in data
        )

    @pytest.mark.asyncio
    async def test_get_activity_summary_with_days(
        self, authenticated_client: AsyncClient, sample_activities: SampleActivities
    ) -> None:
        """Test getting activity summary for specific timeframe."""
        response = await authenticated_client.get("/api/v1/audit/activities/summary?days=7")

        assert response.status_code == 200
        data = response.json()

        # Should return summary data
        assert data is not None

    @pytest.mark.asyncio
    async def test_get_activity_summary_includes_ui_fields(
        self, authenticated_client: AsyncClient, sample_activities: SampleActivities
    ) -> None:
        """Summary should include UI-friendly aggregations."""
        response = await authenticated_client.get("/api/v1/audit/activities/summary")

        assert response.status_code == 200
        data = response.json()

        assert "by_severity" in data and isinstance(data["by_severity"], dict)
        assert "by_type" in data and isinstance(data["by_type"], dict)
        assert "by_user" in data and isinstance(data["by_user"], list)
        assert "timeline" in data and isinstance(data["timeline"], list)
        assert "recent_critical" in data and isinstance(data["recent_critical"], list)


# ==================== Single Activity Tests ====================


class TestSingleActivity:
    """Test GET /audit/activities/{activity_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_activity_by_id(
        self, authenticated_client: AsyncClient, sample_activities: SampleActivities
    ) -> None:
        """Test getting single activity by ID."""
        activities, user_id = sample_activities
        activity_id = str(activities[0].id)

        response = await authenticated_client.get(f"/api/v1/audit/activities/{activity_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == activity_id
        assert "activity_type" in data
        assert "severity" in data

    @pytest.mark.asyncio
    async def test_get_activity_nonexistent_id(self, authenticated_client: AsyncClient) -> None:
        """Test getting non-existent activity returns 404."""
        fake_id = str(uuid4())

        response = await authenticated_client.get(f"/api/v1/audit/activities/{fake_id}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_activity_invalid_uuid(self, authenticated_client: AsyncClient) -> None:
        """Test with invalid UUID format."""
        response = await authenticated_client.get("/api/v1/audit/activities/not-a-uuid")

        # Should return validation error
        assert response.status_code == 422


# ==================== Error Handling Tests ====================


class TestAuditRouterErrorHandling:
    """Test error handling in audit router."""

    @pytest.mark.asyncio
    async def test_list_activities_database_error(
        self, test_app: FastAPI, async_db_session: AsyncSession, test_user: UserInfo
    ) -> None:
        """Test handling of database errors during query execution."""
        from unittest.mock import AsyncMock, patch

        from httpx import ASGITransport, AsyncClient

        # Mock AuditService.get_activities to raise a database error
        with patch("dotmac.platform.audit.router.AuditService") as MockService:
            mock_service = AsyncMock()
            mock_service.get_activities = AsyncMock(side_effect=Exception("Database error"))
            MockService.return_value = mock_service

            test_app.dependency_overrides[get_current_user] = lambda: test_user
            test_app.dependency_overrides[get_current_user_optional] = lambda: test_user
            test_app.dependency_overrides[get_current_tenant_id] = lambda: "test-tenant"
            test_app.dependency_overrides[ensure_audit_access] = lambda: test_user

            transport = ASGITransport(app=test_app)
            async with AsyncClient(
                transport=transport,
                base_url="http://testserver",
                headers={"X-Tenant-ID": "test-tenant"},
            ) as client:
                response = await client.get("/api/v1/audit/activities")

            # Should return 500 error from endpoint's exception handler
            assert response.status_code == 500
            assert "Failed to retrieve" in response.json()["detail"]


# ==================== Tenant Isolation Tests ====================


class TestTenantIsolation:
    """Test that activities are properly isolated by tenant."""

    @pytest.mark.asyncio
    async def test_tenant_isolation_in_listing(
        self,
        app: FastAPI,
        async_db_session: AsyncSession,
        sample_activities: SampleActivities,
        test_user: UserInfo,
    ) -> None:
        """Test that only activities for current tenant are returned."""
        app.dependency_overrides[get_async_session] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: test_user
        app.dependency_overrides[get_current_user_optional] = lambda: test_user
        app.dependency_overrides[get_current_tenant_id] = lambda: "test-tenant"
        app.dependency_overrides[ensure_audit_access] = lambda: test_user

        client = TestClient(app)
        response = client.get("/api/v1/audit/activities")

        assert response.status_code == 200
        data = response.json()

        # All activities should be from test-tenant
        for activity in data["activities"]:
            assert activity["tenant_id"] == "test-tenant"

    @pytest.mark.asyncio
    async def test_different_tenant_activities_not_visible(
        self,
        app: FastAPI,
        async_db_session: AsyncSession,
        sample_activities: SampleActivities,
        test_user: UserInfo,
    ) -> None:
        """Test that activities from different tenant are not visible."""
        # Switch to different tenant
        app.dependency_overrides[get_async_session] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: test_user
        app.dependency_overrides[get_current_user_optional] = lambda: test_user
        app.dependency_overrides[get_current_tenant_id] = lambda: "different-tenant"
        app.dependency_overrides[ensure_audit_access] = lambda: test_user

        client = TestClient(app)
        response = client.get("/api/v1/audit/activities")

        assert response.status_code == 200
        data = response.json()

        # Should only see different-tenant activity
        for activity in data["activities"]:
            assert activity["tenant_id"] == "different-tenant"


# ==================== Combined Filters Tests ====================


class TestCombinedFilters:
    """Test using multiple filters together."""

    @pytest.mark.asyncio
    async def test_combined_user_and_severity_filter(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test combining user_id and severity filters."""
        activities, user_id = sample_activities

        response = client.get(f"/api/v1/audit/activities?user_id={user_id}&severity=medium")

        assert response.status_code == 200
        data = response.json()

        for activity in data["activities"]:
            if activity["user_id"]:
                assert activity["user_id"] == user_id
            assert activity["severity"] == "medium"

    @pytest.mark.asyncio
    async def test_combined_type_and_resource_filter(
        self, client: TestClient, sample_activities: SampleActivities
    ) -> None:
        """Test combining activity_type and resource_type filters."""
        response = client.get(
            "/api/v1/audit/activities?activity_type=user.login&resource_type=user"
        )

        assert response.status_code == 200
        data = response.json()

        for activity in data["activities"]:
            assert activity["activity_type"] == "user.login"
            if activity["resource_type"]:
                assert activity["resource_type"] == "user"
