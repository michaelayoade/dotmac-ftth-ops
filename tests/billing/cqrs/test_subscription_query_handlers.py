"""Tests for Subscription Query Handlers (CQRS Pattern)"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from dotmac.platform.billing.queries.handlers import SubscriptionQueryHandler
from dotmac.platform.billing.queries.subscription_queries import (
    GetActiveSubscriptionsQuery,
    GetSubscriptionQuery,
    ListSubscriptionsQuery,
)
from dotmac.platform.billing.read_models.subscription_read_models import (
    SubscriptionDetail,
)


@pytest.mark.unit
class TestSubscriptionQueryHandler:
    """Test SubscriptionQueryHandler with mocked database"""

    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session"""
        return AsyncMock()

    @pytest.fixture
    def query_handler(self, mock_db_session):
        """Create query handler with mocked dependencies"""
        return SubscriptionQueryHandler(mock_db_session)

    @pytest.mark.asyncio
    async def test_handle_get_subscription_returns_detail(self, query_handler, mock_db_session):
        """Test get subscription returns SubscriptionDetail"""
        query = GetSubscriptionQuery(tenant_id="tenant-1", subscription_id="sub-123")

        # Mock database result
        now = datetime.now(UTC)
        mock_subscription = MagicMock()
        mock_subscription.subscription_id = "sub-123"
        mock_subscription.tenant_id = "tenant-1"
        mock_subscription.customer_id = "cust-456"
        mock_subscription.plan_id = "plan-789"
        mock_subscription.status = "active"
        mock_subscription.quantity = 5
        mock_subscription.billing_cycle_anchor = now
        mock_subscription.current_period_start = now
        mock_subscription.current_period_end = now + timedelta(days=30)
        mock_subscription.trial_start = None
        mock_subscription.trial_end = None
        mock_subscription.cancel_at_period_end = False
        mock_subscription.cancelled_at = None
        mock_subscription.ended_at = None
        mock_subscription.created_at = now
        mock_subscription.items = []
        mock_subscription.latest_invoice_id = "inv-latest"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_subscription
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_get_subscription(query)

        # Verify result
        assert result is not None
        assert isinstance(result, SubscriptionDetail)
        assert result.subscription_id == "sub-123"
        assert result.customer_id == "cust-456"
        assert result.plan_id == "plan-789"
        assert result.status == "active"
        assert result.quantity == 5

    @pytest.mark.asyncio
    async def test_handle_get_subscription_not_found(self, query_handler, mock_db_session):
        """Test get subscription returns None when not found"""
        query = GetSubscriptionQuery(tenant_id="tenant-1", subscription_id="sub-999")

        # Mock database returns None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_get_subscription(query)

        # Verify result
        assert result is None

    @pytest.mark.asyncio
    async def test_handle_list_subscriptions_with_filters(self, query_handler, mock_db_session):
        """Test list subscriptions with customer and status filters"""
        query = ListSubscriptionsQuery(
            tenant_id="tenant-1",
            customer_id="cust-456",
            status="active",
            page=1,
            page_size=50,
        )

        # Mock database results
        mock_db_session.scalar.return_value = 0
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_list_subscriptions(query)

        # Verify result structure
        assert result["total"] == 0
        assert len(result["items"]) == 0
        assert result["page"] == 1
        assert result["page_size"] == 50

    @pytest.mark.asyncio
    async def test_handle_get_active_subscriptions_filtered_by_customer(
        self, query_handler, mock_db_session
    ):
        """Test get active subscriptions filtered by customer"""
        query = GetActiveSubscriptionsQuery(tenant_id="tenant-1", customer_id="cust-456", limit=5)

        # Mock database results
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_get_active_subscriptions(query)

        # Verify result
        assert len(result) == 0


@pytest.mark.unit
class TestSubscriptionQueryEdgeCases:
    """Test edge cases for subscription queries"""

    @pytest.fixture
    def query_handler(self):
        """Create query handler"""
        return SubscriptionQueryHandler(AsyncMock())

    @pytest.mark.asyncio
    async def test_list_subscriptions_empty_result(self, query_handler):
        """Test list subscriptions with no results"""
        mock_db_session = query_handler.db
        query = ListSubscriptionsQuery(tenant_id="tenant-empty", page=1, page_size=10)

        # Mock empty results
        mock_db_session.scalar.return_value = 0
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_list_subscriptions(query)

        # Verify empty result
        assert result["total"] == 0
        assert result["items"] == []
        assert result["page"] == 1
        assert result["page_size"] == 10
