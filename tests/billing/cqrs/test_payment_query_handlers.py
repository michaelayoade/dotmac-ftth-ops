"""Tests for Payment Query Handlers (CQRS Pattern)"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from dotmac.platform.billing.core.enums import PaymentStatus
from dotmac.platform.billing.queries.handlers import PaymentQueryHandler
from dotmac.platform.billing.queries.payment_queries import (
    GetPaymentQuery,
    GetPaymentStatisticsQuery,
    ListPaymentsQuery,
)
from dotmac.platform.billing.read_models.payment_read_models import (
    PaymentStatistics,
)


@pytest.mark.unit
class TestPaymentQueryHandler:
    """Test PaymentQueryHandler with mocked database"""

    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session"""
        return AsyncMock()

    @pytest.fixture
    def query_handler(self, mock_db_session):
        """Create query handler with mocked dependencies"""
        return PaymentQueryHandler(mock_db_session)

    @pytest.mark.asyncio
    async def test_handle_get_payment_not_found(self, query_handler, mock_db_session):
        """Test get payment returns None when not found"""
        query = GetPaymentQuery(tenant_id="tenant-1", payment_id="pay-999")

        # Mock database returns None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_get_payment(query)

        # Verify result
        assert result is None

    @pytest.mark.asyncio
    async def test_handle_list_payments_with_filters(self, query_handler, mock_db_session):
        """Test list payments with customer and status filters"""
        query = ListPaymentsQuery(
            tenant_id="tenant-1",
            customer_id="cust-456",
            status=PaymentStatus.SUCCEEDED,
            page=1,
            page_size=50,
        )

        # Mock database results
        mock_db_session.scalar.return_value = 0
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_list_payments(query)

        # Verify result structure
        assert result["total"] == 0
        assert len(result["items"]) == 0
        assert result["page"] == 1
        assert result["page_size"] == 50

    @pytest.mark.asyncio
    async def test_handle_get_payment_statistics(self, query_handler, mock_db_session):
        """Test get payment statistics with aggregations"""
        query = GetPaymentStatisticsQuery(
            tenant_id="tenant-1",
            start_date=datetime.now(UTC) - timedelta(days=30),
            end_date=datetime.now(UTC),
        )

        # Mock aggregation result
        mock_row = MagicMock()
        mock_row.total_count = 100
        mock_row.succeeded_count = 90
        mock_row.failed_count = 10
        mock_row.total_amount = 1000000  # $10,000 in cents

        mock_result = MagicMock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_get_payment_statistics(query)

        # Verify result
        assert isinstance(result, PaymentStatistics)
        assert result.total_count == 100
        assert result.succeeded_count == 90
        assert result.failed_count == 10
        assert result.total_amount == 1000000
        assert result.success_rate == 0.9  # 90/100

    @pytest.mark.asyncio
    async def test_handle_get_payment_statistics_empty(self, query_handler, mock_db_session):
        """Test payment statistics with no data"""
        query = GetPaymentStatisticsQuery(
            tenant_id="tenant-1",
            start_date=datetime.now(UTC) - timedelta(days=30),
            end_date=datetime.now(UTC),
        )

        # Mock empty result
        mock_row = MagicMock()
        mock_row.total_count = None
        mock_row.succeeded_count = None
        mock_row.failed_count = None
        mock_row.total_amount = None

        mock_result = MagicMock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_get_payment_statistics(query)

        # Verify defaults
        assert result.total_count == 0
        assert result.succeeded_count == 0
        assert result.failed_count == 0
        assert result.total_amount == 0
        assert result.success_rate == 0


@pytest.mark.unit
class TestPaymentStatisticsCalculations:
    """Test payment statistics calculations"""

    @pytest.fixture
    def query_handler(self):
        """Create query handler"""
        return PaymentQueryHandler(AsyncMock())

    @pytest.mark.asyncio
    async def test_success_rate_calculation_100_percent(self):
        """Test success rate with 100% success"""
        handler = PaymentQueryHandler(AsyncMock())
        mock_db_session = handler.db

        query = GetPaymentStatisticsQuery(
            tenant_id="tenant-1",
            start_date=datetime.now(UTC) - timedelta(days=7),
            end_date=datetime.now(UTC),
        )

        # Mock all payments succeeded
        mock_row = MagicMock()
        mock_row.total_count = 50
        mock_row.succeeded_count = 50
        mock_row.failed_count = 0
        mock_row.total_amount = 500000

        mock_result = MagicMock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await handler.handle_get_payment_statistics(query)

        # Verify success rate
        assert result.success_rate == 1.0

    @pytest.mark.asyncio
    async def test_success_rate_calculation_zero_payments(self):
        """Test success rate with zero payments"""
        handler = PaymentQueryHandler(AsyncMock())
        mock_db_session = handler.db

        query = GetPaymentStatisticsQuery(
            tenant_id="tenant-1",
            start_date=datetime.now(UTC) - timedelta(days=7),
            end_date=datetime.now(UTC),
        )

        # Mock no payments
        mock_row = MagicMock()
        mock_row.total_count = 0
        mock_row.succeeded_count = 0
        mock_row.failed_count = 0
        mock_row.total_amount = 0

        mock_result = MagicMock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await handler.handle_get_payment_statistics(query)

        # Verify success rate doesn't divide by zero
        assert result.success_rate == 0
