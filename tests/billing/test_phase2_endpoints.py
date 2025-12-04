"""
Comprehensive tests for Phase 2 operational monitoring endpoints.

Tests expiring subscriptions and auth metrics endpoints with proper mocking.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock

import pytest

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.metrics_router import AuthMetricsResponse, get_auth_metrics
from dotmac.platform.billing.metrics_router import (
    ExpiringSubscriptionsResponse,
    get_expiring_subscriptions,
)

try:
    UTC = datetime.UTC  # type: ignore[attr-defined]
except AttributeError:  # pragma: no cover - older Python versions
    UTC = timezone.utc  # noqa: UP017 - fallback for Python <3.11

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def reset_billing_cache(monkeypatch):
    """Provide a fresh billing cache instance for each test to avoid cross-test leaks."""

    from dotmac.platform.billing.cache import BillingCache
    from dotmac.platform.core.caching import cache_clear

    cache = BillingCache()
    monkeypatch.setattr(
        "dotmac.platform.billing.cache.get_billing_cache",
        lambda: cache,
    )
    cache_clear()
    yield


@pytest.fixture
def mock_session():
    """Create mock database session."""
    session = AsyncMock()
    return session


@pytest.fixture
def mock_user():
    """Create mock user with tenant."""
    return UserInfo(
        user_id="test-user",
        username="testuser",
        email="test@example.com",
        tenant_id="test-tenant",
    )


# ============================================================================
# Expiring Subscriptions Endpoint Tests
# ============================================================================


class TestExpiringSubscriptionsEndpoint:
    """Test GET /api/v1/billing/subscriptions/expiring endpoint."""

    @pytest.mark.asyncio
    async def test_get_expiring_subscriptions_with_data(self, mock_session, mock_user):
        """Test expiring subscriptions with data."""
        now = datetime.now(UTC)

        # Mock subscriptions expiring in next 30 days
        mock_subscriptions = [
            Mock(
                subscription_id=f"sub_{i}",
                customer_id=f"cust_{i}",
                plan_id=f"plan_{i}",
                current_period_end=now + timedelta(days=5 + i),
                status="active",
                cancel_at_period_end=False,
            )
            for i in range(5)
        ]

        result = Mock()
        result.scalars.return_value.all.return_value = mock_subscriptions
        mock_session.execute = AsyncMock(return_value=result)

        response = await get_expiring_subscriptions(
            days=30, limit=50, session=mock_session, current_user=mock_user
        )

        assert isinstance(response, ExpiringSubscriptionsResponse)
        assert len(response.subscriptions) == 5
        assert response.total_count == 5
        assert response.days_threshold == 30
        assert response.subscriptions[0].subscription_id == "sub_0"
        # Days calculation: (current_period_end - now).days
        # Mock has current_period_end = now + timedelta(days=5)
        # So days_until_expiry should be 4 or 5 depending on time precision
        assert response.subscriptions[0].days_until_expiry >= 4
        assert response.subscriptions[0].days_until_expiry <= 5

    @pytest.mark.asyncio
    async def test_get_expiring_subscriptions_empty(self, mock_session, mock_user):
        """Test expiring subscriptions with no data."""
        result = Mock()
        result.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=result)

        response = await get_expiring_subscriptions(
            days=30, limit=50, session=mock_session, current_user=mock_user
        )

        assert len(response.subscriptions) == 0
        assert response.total_count == 0
        assert response.days_threshold == 30

    @pytest.mark.asyncio
    async def test_get_expiring_subscriptions_custom_threshold(self, mock_session, mock_user):
        """Test expiring subscriptions with custom days threshold."""
        now = datetime.now(UTC)

        mock_subscriptions = [
            Mock(
                subscription_id="sub_urgent",
                customer_id="cust_123",
                plan_id="plan_premium",
                current_period_end=now + timedelta(days=3),
                status="active",
                cancel_at_period_end=True,
            )
        ]

        result = Mock()
        result.scalars.return_value.all.return_value = mock_subscriptions
        mock_session.execute = AsyncMock(return_value=result)

        response = await get_expiring_subscriptions(
            days=7, limit=10, session=mock_session, current_user=mock_user
        )

        assert len(response.subscriptions) == 1
        assert response.days_threshold == 7
        # Allow for time precision in days calculation
        assert response.subscriptions[0].days_until_expiry >= 2
        assert response.subscriptions[0].days_until_expiry <= 3
        assert response.subscriptions[0].cancel_at_period_end is True

    @pytest.mark.asyncio
    async def test_get_expiring_subscriptions_exception_handling(self, mock_session, mock_user):
        """Test expiring subscriptions handles exceptions gracefully."""
        mock_session.execute = AsyncMock(side_effect=Exception("Database error"))

        response = await get_expiring_subscriptions(
            days=30, limit=50, session=mock_session, current_user=mock_user
        )

        # Should return empty list on error
        assert len(response.subscriptions) == 0
        assert response.total_count == 0
        assert response.days_threshold == 30


# ============================================================================
# Auth Metrics Endpoint Tests
# ============================================================================


class TestAuthMetricsEndpoint:
    """Test GET /api/v1/auth/metrics endpoint."""

    @pytest.mark.asyncio
    async def test_get_auth_metrics_with_full_data(self, mock_session, mock_user):
        """Test auth metrics with complete data."""
        # Mock user counts
        total_users_result = Mock()
        total_users_result.scalar.return_value = 1000

        active_users_result = Mock()
        active_users_result.scalar.return_value = 750

        new_users_result = Mock()
        new_users_result.scalar.return_value = 100

        mfa_enabled_result = Mock()
        mfa_enabled_result.scalar.return_value = 600

        # Mock login stats
        login_result = Mock()
        login_result.one.return_value = Mock(total=5000, successful=4500, failed=500)

        # Mock password resets
        password_reset_result = Mock()
        password_reset_result.scalar.return_value = 50

        # Mock lockouts
        lockout_result = Mock()
        lockout_result.scalar.return_value = 10

        # Mock unique active users
        unique_users_result = Mock()
        unique_users_result.scalar.return_value = 700

        mock_session.execute = AsyncMock(
            side_effect=[
                total_users_result,
                active_users_result,
                new_users_result,
                mfa_enabled_result,
                login_result,
                password_reset_result,
                lockout_result,
                unique_users_result,
            ]
        )

        response = await get_auth_metrics(
            period_days=30, session=mock_session, current_user=mock_user
        )

        assert isinstance(response, AuthMetricsResponse)
        assert response.total_users == 1000
        assert response.active_users == 750
        assert response.new_users_this_period == 100
        assert response.total_logins == 5000
        assert response.successful_logins == 4500
        assert response.failed_logins == 500
        assert response.login_success_rate == 90.0  # 4500/5000 * 100
        assert response.mfa_enabled_users == 600
        assert response.mfa_adoption_rate == 60.0  # 600/1000 * 100
        assert response.password_reset_requests == 50
        assert response.account_lockouts == 10
        assert response.unique_active_users == 700
        assert response.period == "30d"

    @pytest.mark.asyncio
    async def test_get_auth_metrics_with_zero_data(self, mock_session, mock_user):
        """Test auth metrics with no data."""
        # Mock all queries returning zero
        zero_result = Mock()
        zero_result.scalar.return_value = 0

        login_result = Mock()
        login_result.one.return_value = Mock(total=0, successful=0, failed=0)

        mock_session.execute = AsyncMock(
            side_effect=[
                zero_result,  # total_users
                zero_result,  # active_users
                zero_result,  # new_users
                zero_result,  # mfa_enabled
                login_result,  # login stats
                zero_result,  # password_reset
                zero_result,  # lockouts
                zero_result,  # unique_active
            ]
        )

        response = await get_auth_metrics(
            period_days=30, session=mock_session, current_user=mock_user
        )

        assert response.total_users == 0
        assert response.active_users == 0
        assert response.login_success_rate == 0.0
        assert response.mfa_adoption_rate == 0.0

    @pytest.mark.asyncio
    async def test_get_auth_metrics_login_success_rate_calculation(self, mock_session, mock_user):
        """Test auth metrics login success rate calculation."""
        # Mock user counts (not relevant for this test)
        zero_result = Mock()
        zero_result.scalar.return_value = 0

        # Mock login stats with specific success rate
        login_result = Mock()
        login_result.one.return_value = Mock(total=1000, successful=850, failed=150)

        mock_session.execute = AsyncMock(
            side_effect=[
                zero_result,  # total_users
                zero_result,  # active_users
                zero_result,  # new_users
                zero_result,  # mfa_enabled
                login_result,  # login stats
                zero_result,  # password_reset
                zero_result,  # lockouts
                zero_result,  # unique_active
            ]
        )

        response = await get_auth_metrics(
            period_days=30, session=mock_session, current_user=mock_user
        )

        # Login success rate: 850/1000 * 100 = 85%
        assert response.login_success_rate == 85.0
        assert response.total_logins == 1000
        assert response.successful_logins == 850
        assert response.failed_logins == 150

    @pytest.mark.asyncio
    async def test_get_auth_metrics_mfa_adoption_calculation(self, mock_session, mock_user):
        """Test auth metrics MFA adoption rate calculation."""
        # Mock user counts
        total_users_result = Mock()
        total_users_result.scalar.return_value = 500

        active_users_result = Mock()
        active_users_result.scalar.return_value = 400

        new_users_result = Mock()
        new_users_result.scalar.return_value = 50

        # 300 out of 500 users have MFA enabled = 60%
        mfa_enabled_result = Mock()
        mfa_enabled_result.scalar.return_value = 300

        # Mock login stats
        login_result = Mock()
        login_result.one.return_value = Mock(total=100, successful=90, failed=10)

        # Mock other stats
        zero_result = Mock()
        zero_result.scalar.return_value = 0

        mock_session.execute = AsyncMock(
            side_effect=[
                total_users_result,
                active_users_result,
                new_users_result,
                mfa_enabled_result,
                login_result,
                zero_result,  # password_reset
                zero_result,  # lockouts
                zero_result,  # unique_active
            ]
        )

        response = await get_auth_metrics(
            period_days=30, session=mock_session, current_user=mock_user
        )

        # MFA adoption: 300/500 * 100 = 60%
        assert response.mfa_adoption_rate == 60.0
        assert response.mfa_enabled_users == 300
        assert response.total_users == 500

    @pytest.mark.asyncio
    async def test_get_auth_metrics_exception_handling(self, mock_session, mock_user):
        """Test auth metrics handles exceptions gracefully."""
        mock_session.execute = AsyncMock(side_effect=Exception("Database error"))

        response = await get_auth_metrics(
            period_days=30, session=mock_session, current_user=mock_user
        )

        # Should return safe defaults on error
        assert response.total_users == 0
        assert response.active_users == 0
        assert response.login_success_rate == 0.0
        assert response.mfa_adoption_rate == 0.0
        assert response.period == "30d"

    @pytest.mark.asyncio
    async def test_get_auth_metrics_custom_period(self, mock_session, mock_user):
        """Test auth metrics with custom time period."""
        # Mock results
        total_users_result = Mock()
        total_users_result.scalar.return_value = 2000

        active_users_result = Mock()
        active_users_result.scalar.return_value = 1500

        new_users_result = Mock()
        new_users_result.scalar.return_value = 300

        mfa_enabled_result = Mock()
        mfa_enabled_result.scalar.return_value = 1200

        login_result = Mock()
        login_result.one.return_value = Mock(total=10000, successful=9500, failed=500)

        zero_result = Mock()
        zero_result.scalar.return_value = 0

        mock_session.execute = AsyncMock(
            side_effect=[
                total_users_result,
                active_users_result,
                new_users_result,
                mfa_enabled_result,
                login_result,
                zero_result,
                zero_result,
                zero_result,
            ]
        )

        response = await get_auth_metrics(
            period_days=90, session=mock_session, current_user=mock_user
        )

        assert response.period == "90d"
        assert response.total_users == 2000
        assert response.new_users_this_period == 300


# ============================================================================
# Integration Tests
# ============================================================================


class TestPhase2Integration:
    """Test Phase 2 endpoint integration."""

    @pytest.mark.asyncio
    async def test_expiring_subscriptions_imports(self):
        """Test expiring subscriptions function can be imported."""
        from dotmac.platform.billing.metrics_router import get_expiring_subscriptions

        assert get_expiring_subscriptions is not None
        assert callable(get_expiring_subscriptions)

    @pytest.mark.asyncio
    async def test_auth_metrics_imports(self):
        """Test auth metrics function can be imported."""
        from dotmac.platform.auth.metrics_router import get_auth_metrics

        assert get_auth_metrics is not None
        assert callable(get_auth_metrics)
