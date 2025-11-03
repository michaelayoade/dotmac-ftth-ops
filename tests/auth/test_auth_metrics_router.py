"""Tests for auth metrics router."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import ActivitySeverity, AuditActivity
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.metrics_router import (
    AuthMetricsResponse,
    _get_auth_metrics_cached,
)
from dotmac.platform.auth.metrics_router import router as metrics_router
from dotmac.platform.user_management.models import User

pytestmark = pytest.mark.integration


@pytest.fixture
def app_with_metrics():
    """Create FastAPI app with metrics router."""
    app = FastAPI()
    app.include_router(metrics_router, prefix="/api/v1/metrics/auth", tags=["Auth Metrics"])
    return app


@pytest.fixture
def mock_user_info():
    """Mock authenticated user."""
    return UserInfo(
        user_id="test-user-id",
        username="testuser",
        email="test@example.com",
        permissions=["auth:metrics:read"],
        roles=["admin"],
        tenant_id="test-tenant",
    )


@pytest_asyncio.fixture
async def sample_users(async_db_session: AsyncSession):
    """Create sample users for testing."""
    now = datetime.now(UTC)
    users = [
        User(
            id=uuid4(),
            username=f"user{i}",
            email=f"user{i}@example.com",
            password_hash="hashed_password",  # Required field
            tenant_id="test-tenant",
            is_active=True,
            mfa_enabled=(i % 2 == 0),  # Half have MFA
            last_login=now - timedelta(days=i),
            created_at=now - timedelta(days=i * 10),
        )
        for i in range(5)
    ]

    for user in users:
        async_db_session.add(user)
    await async_db_session.commit()

    return users


@pytest_asyncio.fixture
async def sample_audit_activities(async_db_session: AsyncSession):
    """Create sample audit activities for login tracking."""
    now = datetime.now(UTC)
    activities = []

    # Successful logins
    for i in range(10):
        activities.append(
            AuditActivity(
                id=uuid4(),
                activity_type="login",
                description="User logged in",
                severity=ActivitySeverity.LOW.value,
                user_id=str(uuid4()),
                tenant_id="test-tenant",
                action="login",
                created_at=now - timedelta(hours=i),
            )
        )

    # Failed logins
    for i in range(3):
        activities.append(
            AuditActivity(
                id=uuid4(),
                activity_type="login",
                description="Login failed",
                severity=ActivitySeverity.MEDIUM.value,
                user_id=str(uuid4()),
                tenant_id="test-tenant",
                action="login_failed",
                created_at=now - timedelta(hours=i),
            )
        )

    # Password resets
    activities.append(
        AuditActivity(
            id=uuid4(),
            activity_type="password_reset_request",
            description="Password reset requested",
            severity=ActivitySeverity.MEDIUM.value,
            user_id=str(uuid4()),
            tenant_id="test-tenant",
            action="password_reset",
            created_at=now - timedelta(hours=1),
        )
    )

    # Account lockout
    activities.append(
        AuditActivity(
            id=uuid4(),
            activity_type="account_locked",
            description="Account locked",
            severity=ActivitySeverity.HIGH.value,
            user_id=str(uuid4()),
            tenant_id="test-tenant",
            action="account_lock",
            created_at=now - timedelta(hours=2),
        )
    )

    for activity in activities:
        async_db_session.add(activity)
    await async_db_session.commit()

    return activities


# ============================================================================
# Cached Helper Function Tests
# ============================================================================


class TestGetAuthMetricsCached:
    """Test the cached metrics helper function."""

    @pytest.mark.asyncio
    async def test_basic_metrics_calculation(
        self, async_db_session, sample_users, sample_audit_activities
    ):
        """Test basic metrics calculation."""
        metrics = await _get_auth_metrics_cached(
            period_days=30,
            tenant_id="test-tenant",
            session=async_db_session,
        )

        assert "total_users" in metrics
        assert "active_users" in metrics
        assert "new_users_this_period" in metrics
        assert "total_logins" in metrics
        assert "successful_logins" in metrics
        assert "failed_logins" in metrics
        assert "login_success_rate" in metrics
        assert "mfa_enabled_users" in metrics
        assert "mfa_adoption_rate" in metrics
        assert "password_reset_requests" in metrics
        assert "account_lockouts" in metrics
        assert "unique_active_users" in metrics
        assert "period" in metrics
        assert "timestamp" in metrics

        # Check data types
        assert isinstance(metrics["total_users"], int)
        assert isinstance(metrics["login_success_rate"], (int, float))
        assert isinstance(metrics["mfa_adoption_rate"], (int, float))
        # Timestamp can be either datetime (fresh) or string (from cache)
        assert isinstance(metrics["timestamp"], (datetime, str))

    @pytest.mark.asyncio
    async def test_metrics_with_users(
        self, async_db_session, sample_users, sample_audit_activities
    ):
        """Test metrics calculation with actual users."""
        # Call the unwrapped version to bypass cache
        metrics = await _get_auth_metrics_cached.__wrapped__(
            period_days=30,
            tenant_id="test-tenant",
            session=async_db_session,
        )

        # Should have 5 users total
        assert metrics["total_users"] == 5

        # MFA adoption should be 60% (3 out of 5 - users 0, 2, 4 have MFA)
        assert metrics["mfa_enabled_users"] == 3
        assert metrics["mfa_adoption_rate"] == 60.0

    @pytest.mark.asyncio
    async def test_metrics_login_success_rate(
        self, async_db_session, sample_users, sample_audit_activities
    ):
        """Test login success rate calculation."""
        # Call the unwrapped version to bypass cache
        metrics = await _get_auth_metrics_cached.__wrapped__(
            period_days=30,
            tenant_id="test-tenant",
            session=async_db_session,
        )

        # Should have logins
        assert metrics["total_logins"] > 0
        assert metrics["successful_logins"] >= 0
        assert metrics["failed_logins"] >= 0
        assert 0 <= metrics["login_success_rate"] <= 100

    @pytest.mark.asyncio
    async def test_metrics_without_tenant_filter(
        self, async_db_session, sample_users, sample_audit_activities
    ):
        """Test metrics calculation without tenant filter."""
        metrics = await _get_auth_metrics_cached(
            period_days=30,
            tenant_id=None,
            session=async_db_session,
        )

        # Should still return metrics
        assert metrics["total_users"] >= 0
        assert "period" in metrics

    @pytest.mark.asyncio
    async def test_metrics_different_periods(
        self, async_db_session, sample_users, sample_audit_activities
    ):
        """Test metrics for different time periods."""
        # 7 days
        metrics_7d = await _get_auth_metrics_cached(
            period_days=7,
            tenant_id="test-tenant",
            session=async_db_session,
        )

        # 90 days
        metrics_90d = await _get_auth_metrics_cached(
            period_days=90,
            tenant_id="test-tenant",
            session=async_db_session,
        )

        assert metrics_7d["period"] == "7d"
        assert metrics_90d["period"] == "90d"

        # 90 day period should have more or equal new users
        assert metrics_90d["new_users_this_period"] >= metrics_7d["new_users_this_period"]


# ============================================================================
# Endpoint Tests
# ============================================================================


class TestAuthMetricsEndpoint:
    """Test the /auth/metrics endpoint."""

    def test_metrics_endpoint_success(self, app_with_metrics, mock_user_info, async_db_session):
        """Test successful metrics retrieval."""
        client = TestClient(app_with_metrics)

        # Mock dependencies
        from dotmac.platform.auth.dependencies import get_current_user
        from dotmac.platform.db import get_session_dependency

        app_with_metrics.dependency_overrides[get_current_user] = lambda: mock_user_info
        app_with_metrics.dependency_overrides[get_session_dependency] = lambda: async_db_session

        with patch("dotmac.platform.auth.metrics_router._get_auth_metrics_cached") as mock_cached:
            mock_cached.return_value = {
                "total_users": 100,
                "active_users": 75,
                "new_users_this_period": 10,
                "total_logins": 500,
                "successful_logins": 450,
                "failed_logins": 50,
                "login_success_rate": 90.0,
                "mfa_enabled_users": 60,
                "mfa_adoption_rate": 60.0,
                "password_reset_requests": 5,
                "account_lockouts": 2,
                "unique_active_users": 80,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = client.get("/api/v1/metrics/auth?period_days=30")

            assert response.status_code == 200
            data = response.json()

            assert data["total_users"] == 100
            assert data["active_users"] == 75
            assert data["login_success_rate"] == 90.0
            assert data["mfa_adoption_rate"] == 60.0

    def test_metrics_endpoint_default_period(
        self, app_with_metrics, mock_user_info, async_db_session
    ):
        """Test metrics endpoint with default period."""
        client = TestClient(app_with_metrics)

        from dotmac.platform.auth.dependencies import get_current_user
        from dotmac.platform.db import get_session_dependency

        app_with_metrics.dependency_overrides[get_current_user] = lambda: mock_user_info
        app_with_metrics.dependency_overrides[get_session_dependency] = lambda: async_db_session

        with patch("dotmac.platform.auth.metrics_router._get_auth_metrics_cached") as mock_cached:
            mock_cached.return_value = {
                "total_users": 50,
                "active_users": 40,
                "new_users_this_period": 5,
                "total_logins": 200,
                "successful_logins": 180,
                "failed_logins": 20,
                "login_success_rate": 90.0,
                "mfa_enabled_users": 30,
                "mfa_adoption_rate": 60.0,
                "password_reset_requests": 3,
                "account_lockouts": 1,
                "unique_active_users": 45,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = client.get("/api/v1/metrics/auth")

            assert response.status_code == 200
            # Should use default period of 30 days
            mock_cached.assert_called_once()
            args = mock_cached.call_args[1]
            assert args["period_days"] == 30

    def test_metrics_endpoint_custom_period(
        self, app_with_metrics, mock_user_info, async_db_session
    ):
        """Test metrics endpoint with custom period."""
        client = TestClient(app_with_metrics)

        from dotmac.platform.auth.dependencies import get_current_user
        from dotmac.platform.db import get_session_dependency

        app_with_metrics.dependency_overrides[get_current_user] = lambda: mock_user_info
        app_with_metrics.dependency_overrides[get_session_dependency] = lambda: async_db_session

        with patch("dotmac.platform.auth.metrics_router._get_auth_metrics_cached") as mock_cached:
            mock_cached.return_value = {
                "total_users": 50,
                "active_users": 40,
                "new_users_this_period": 5,
                "total_logins": 200,
                "successful_logins": 180,
                "failed_logins": 20,
                "login_success_rate": 90.0,
                "mfa_enabled_users": 30,
                "mfa_adoption_rate": 60.0,
                "password_reset_requests": 3,
                "account_lockouts": 1,
                "unique_active_users": 45,
                "period": "7d",
                "timestamp": datetime.now(UTC),
            }

            response = client.get("/api/v1/metrics/auth?period_days=7")

            assert response.status_code == 200
            args = mock_cached.call_args[1]
            assert args["period_days"] == 7

    def test_metrics_endpoint_error_handling(
        self, app_with_metrics, mock_user_info, async_db_session
    ):
        """Test error handling in metrics endpoint."""
        client = TestClient(app_with_metrics)

        from dotmac.platform.auth.dependencies import get_current_user
        from dotmac.platform.db import get_session_dependency

        app_with_metrics.dependency_overrides[get_current_user] = lambda: mock_user_info
        app_with_metrics.dependency_overrides[get_session_dependency] = lambda: async_db_session

        with patch("dotmac.platform.auth.metrics_router._get_auth_metrics_cached") as mock_cached:
            # Simulate database error
            mock_cached.side_effect = Exception("Database error")

            response = client.get("/api/v1/metrics/auth?period_days=30")

            # Should still return 200 with safe defaults
            assert response.status_code == 200
            data = response.json()

            # All metrics should be 0
            assert data["total_users"] == 0
            assert data["active_users"] == 0
            assert data["total_logins"] == 0

    def test_metrics_endpoint_tenant_isolation(
        self, app_with_metrics, mock_user_info, async_db_session
    ):
        """Test that metrics respect tenant isolation."""
        client = TestClient(app_with_metrics)

        from dotmac.platform.auth.dependencies import get_current_user
        from dotmac.platform.db import get_session_dependency

        app_with_metrics.dependency_overrides[get_current_user] = lambda: mock_user_info
        app_with_metrics.dependency_overrides[get_session_dependency] = lambda: async_db_session

        with patch("dotmac.platform.auth.metrics_router._get_auth_metrics_cached") as mock_cached:
            mock_cached.return_value = {
                "total_users": 50,
                "active_users": 40,
                "new_users_this_period": 5,
                "total_logins": 200,
                "successful_logins": 180,
                "failed_logins": 20,
                "login_success_rate": 90.0,
                "mfa_enabled_users": 30,
                "mfa_adoption_rate": 60.0,
                "password_reset_requests": 3,
                "account_lockouts": 1,
                "unique_active_users": 45,
                "period": "30d",
                "timestamp": datetime.now(UTC),
            }

            response = client.get("/api/v1/metrics/auth?period_days=30")

            assert response.status_code == 200

            # Verify tenant_id was passed to cached function
            args = mock_cached.call_args[1]
            assert args["tenant_id"] == "test-tenant"


# ============================================================================
# Response Model Tests
# ============================================================================


class TestAuthMetricsResponse:
    """Test AuthMetricsResponse model."""

    def test_response_model_validation(self):
        """Test response model validates correctly."""
        response = AuthMetricsResponse(
            total_users=100,
            active_users=75,
            new_users_this_period=10,
            total_logins=500,
            successful_logins=450,
            failed_logins=50,
            login_success_rate=90.0,
            mfa_enabled_users=60,
            mfa_adoption_rate=60.0,
            password_reset_requests=5,
            account_lockouts=2,
            unique_active_users=80,
            period="30d",
            timestamp=datetime.now(UTC),
        )

        assert response.total_users == 100
        assert response.login_success_rate == 90.0
        assert response.period == "30d"

    def test_response_model_dict(self):
        """Test response model can be converted to dict."""
        now = datetime.now(UTC)
        response = AuthMetricsResponse(
            total_users=100,
            active_users=75,
            new_users_this_period=10,
            total_logins=500,
            successful_logins=450,
            failed_logins=50,
            login_success_rate=90.0,
            mfa_enabled_users=60,
            mfa_adoption_rate=60.0,
            password_reset_requests=5,
            account_lockouts=2,
            unique_active_users=80,
            period="30d",
            timestamp=now,
        )

        data = response.model_dump()
        assert data["total_users"] == 100
        assert data["mfa_adoption_rate"] == 60.0
