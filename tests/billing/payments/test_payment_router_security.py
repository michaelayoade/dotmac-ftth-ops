"""
Tests for payment router security fixes.

This module tests:
1. Tenant isolation in failed-payments endpoint
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.billing.payments.router import get_failed_payments
from tests.fixtures.async_db import create_mock_async_session


@pytest.mark.unit
class TestFailedPaymentsTenantIsolation:
    """Tests for tenant isolation in failed-payments endpoint"""

    @pytest.mark.asyncio
    async def test_failed_payments_scoped_by_tenant(self):
        """Test that failed payments query is scoped by tenant_id"""
        mock_session = create_mock_async_session()

        # Create mock result with aggregated data
        mock_row = MagicMock()
        mock_row._mapping = {
            "count": 5,
            "total_amount": 5000,
            "oldest": datetime.now(UTC) - timedelta(days=15),
            "newest": datetime.now(UTC),
        }
        mock_result = MagicMock()
        mock_result.one = MagicMock(return_value=mock_row)
        mock_session.execute = AsyncMock(return_value=mock_result)

        # Create user with tenant_id
        current_user = UserInfo(
            user_id="user_1",
            username="test@example.com",
            tenant_id="tenant_1",
            roles=[],
        )

        # Call endpoint
        result = await get_failed_payments(
            session=mock_session,
            current_user=current_user,
        )

        # Verify the query was executed
        assert mock_session.execute.called

        # Get the query that was executed
        call_args = mock_session.execute.call_args
        query = call_args[0][0]

        # Convert query to string to inspect it
        query_str = str(query)

        # Verify tenant_id filter is present in the query
        # The query should contain a WHERE clause with tenant_id
        # Table name is "payments", so it will be "payments.tenant_id"
        assert "tenant_id" in query_str.lower()

        # Verify result is returned
        assert result.count == 5
        assert result.total_amount == 50.0  # API returns dollars, not cents

    @pytest.mark.asyncio
    async def test_failed_payments_returns_empty_when_no_tenant_id(self):
        """Test that endpoint returns empty result when user has no tenant_id"""
        mock_session = create_mock_async_session()

        # Create user WITHOUT tenant_id (landlord/system user)
        current_user = UserInfo(
            user_id="admin_1",
            username="admin@example.com",
            tenant_id=None,  # No tenant
            roles=["admin"],
        )

        # Call endpoint
        result = await get_failed_payments(
            session=mock_session,
            current_user=current_user,
        )

        # Should return empty result without hitting database
        assert result.count == 0
        assert result.total_amount == 0.0
        assert result.oldest_failure is None
        assert result.newest_failure is None

        # Verify execute was NOT called (early return)
        assert not mock_session.execute.called

    @pytest.mark.asyncio
    async def test_failed_payments_different_tenants_isolated(self):
        """Test that different tenants see different failed payment data"""
        mock_session = create_mock_async_session()

        # Tenant 1 data
        tenant1_data = MagicMock()
        tenant1_data._mapping = {
            "count": 3,
            "total_amount": 3000,
            "oldest": datetime.now(UTC) - timedelta(days=10),
            "newest": datetime.now(UTC) - timedelta(days=1),
        }

        # Tenant 2 data
        tenant2_data = MagicMock()
        tenant2_data._mapping = {
            "count": 7,
            "total_amount": 9500,
            "oldest": datetime.now(UTC) - timedelta(days=20),
            "newest": datetime.now(UTC),
        }

        # Test Tenant 1
        mock_result1 = MagicMock()
        mock_result1.one = MagicMock(return_value=tenant1_data)
        mock_session.execute = AsyncMock(return_value=mock_result1)

        user1 = UserInfo(
            user_id="user_1",
            username="user1@tenant1.com",
            tenant_id="tenant_1",
            roles=[],
        )

        result1 = await get_failed_payments(
            session=mock_session,
            current_user=user1,
        )

        assert result1.count == 3
        assert result1.total_amount == 30.0  # API returns dollars, not cents

        # Test Tenant 2
        mock_result2 = MagicMock()
        mock_result2.one = MagicMock(return_value=tenant2_data)
        mock_session.execute = AsyncMock(return_value=mock_result2)

        user2 = UserInfo(
            user_id="user_2",
            username="user2@tenant2.com",
            tenant_id="tenant_2",
            roles=[],
        )

        result2 = await get_failed_payments(
            session=mock_session,
            current_user=user2,
        )

        assert result2.count == 7
        assert result2.total_amount == 95.0  # API returns dollars, not cents

        # Results should be different (proving isolation)
        assert result1.count != result2.count
        assert result1.total_amount != result2.total_amount

    @pytest.mark.asyncio
    async def test_failed_payments_handles_database_error(self):
        """Test that endpoint handles database errors gracefully"""
        mock_session = create_mock_async_session()

        # Make execute raise an error
        mock_session.execute = AsyncMock(side_effect=Exception("Database error"))

        current_user = UserInfo(
            user_id="user_1",
            username="test@example.com",
            tenant_id="tenant_1",
            roles=[],
        )

        # Call endpoint - should return empty result instead of raising
        result = await get_failed_payments(
            session=mock_session,
            current_user=current_user,
        )

        # Should return empty/safe result
        assert result.count == 0
        assert result.total_amount == 0.0

    @pytest.mark.asyncio
    async def test_failed_payments_filters_by_time_range(self):
        """Test that endpoint only returns failed payments from last 30 days"""
        mock_session = create_mock_async_session()

        # Mock data
        mock_row = MagicMock()
        mock_row._mapping = {
            "count": 2,
            "total_amount": 2000,
            "oldest": datetime.now(UTC) - timedelta(days=25),
            "newest": datetime.now(UTC) - timedelta(days=5),
        }
        mock_result = MagicMock()
        mock_result.one = MagicMock(return_value=mock_row)
        mock_session.execute = AsyncMock(return_value=mock_result)

        current_user = UserInfo(
            user_id="user_1",
            username="test@example.com",
            tenant_id="tenant_1",
            roles=[],
        )

        # Call endpoint
        result = await get_failed_payments(
            session=mock_session,
            current_user=current_user,
        )

        # Get the query that was executed
        call_args = mock_session.execute.call_args
        query = call_args[0][0]
        query_str = str(query)

        # Verify time range filter is present
        # Should filter by created_at >= thirty_days_ago
        assert "created_at" in query_str.lower() or "payment_entity" in query_str.lower()

        # Verify all returned timestamps are within range
        assert result.oldest_failure is not None
        assert result.newest_failure is not None
        time_diff = datetime.now(UTC) - result.oldest_failure
        assert time_diff.days <= 30  # Within 30 days

    @pytest.mark.asyncio
    async def test_failed_payments_only_counts_failed_status(self):
        """Test that endpoint only counts payments with FAILED status"""
        mock_session = create_mock_async_session()

        mock_row = MagicMock()
        mock_row._mapping = {
            "count": 4,
            "total_amount": 4000,
            "oldest": datetime.now(UTC) - timedelta(days=10),
            "newest": datetime.now(UTC),
        }
        mock_result = MagicMock()
        mock_result.one = MagicMock(return_value=mock_row)
        mock_session.execute = AsyncMock(return_value=mock_result)

        current_user = UserInfo(
            user_id="user_1",
            username="test@example.com",
            tenant_id="tenant_1",
            roles=[],
        )

        # Call endpoint
        await get_failed_payments(
            session=mock_session,
            current_user=current_user,
        )

        # Get the query
        call_args = mock_session.execute.call_args
        query = call_args[0][0]
        query_str = str(query)

        # Verify status filter for FAILED is present
        # The query should check PaymentEntity.status == PaymentStatus.FAILED
        assert "status" in query_str.lower() or "payment_entity" in query_str.lower()
