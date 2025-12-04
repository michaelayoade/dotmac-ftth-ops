"""
Comprehensive tests for billing/reports/generators.py to improve coverage from 0%.

Tests cover:
- RevenueReportGenerator: revenue summary, trend, payment methods, detailed report
- CustomerReportGenerator: customer metrics, customer analysis
- AgingReportGenerator: aging summary, aging report, collections report
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock

import pytest

from dotmac.platform.billing.core.enums import (
    CreditReason,
)
from dotmac.platform.billing.reports.generators import (
    AgingReportGenerator,
    CustomerReportGenerator,
    RevenueReportGenerator,
)


@pytest.fixture
def mock_db_session():
    """Create mock database session."""
    return AsyncMock()


@pytest.fixture
def tenant_id():
    """Test tenant ID."""
    return "tenant_123"


@pytest.fixture
def date_range():
    """Test date range."""
    start = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
    end = datetime(2024, 1, 31, 23, 59, 59, tzinfo=UTC)
    return {"start": start, "end": end}


@pytest.mark.unit
class TestRevenueReportGenerator:
    """Test RevenueReportGenerator."""

    @pytest.mark.asyncio
    async def test_init(self, mock_db_session):
        """Test generator initialization."""
        generator = RevenueReportGenerator(mock_db_session)
        assert generator.db == mock_db_session

    @pytest.mark.asyncio
    async def test_get_revenue_summary_success(self, mock_db_session, tenant_id, date_range):
        """Test revenue summary with data."""
        generator = RevenueReportGenerator(mock_db_session)

        # Mock query result
        mock_row = Mock()
        mock_row.invoice_count = 10
        mock_row.total_invoiced = 100000  # $1000.00
        mock_row.total_revenue = 80000  # $800.00
        mock_row.paid_count = 8

        mock_result = Mock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        summary = await generator.get_revenue_summary(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert summary["invoice_count"] == 10
        assert summary["total_invoiced"] == 100000
        assert summary["total_revenue"] == 80000
        assert summary["paid_count"] == 8
        assert summary["collection_rate"] == 80.0  # 8/10 * 100

    @pytest.mark.asyncio
    async def test_get_revenue_summary_no_data(self, mock_db_session, tenant_id, date_range):
        """Test revenue summary with no data."""
        generator = RevenueReportGenerator(mock_db_session)

        # Mock empty result
        mock_row = Mock()
        mock_row.invoice_count = None
        mock_row.total_invoiced = None
        mock_row.total_revenue = None
        mock_row.paid_count = None

        mock_result = Mock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        summary = await generator.get_revenue_summary(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert summary["invoice_count"] == 0
        assert summary["total_invoiced"] == 0
        assert summary["total_revenue"] == 0
        assert summary["paid_count"] == 0
        assert summary["collection_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_get_revenue_trend_by_month(self, mock_db_session, tenant_id, date_range):
        """Test revenue trend grouped by month."""
        generator = RevenueReportGenerator(mock_db_session)

        # Mock query results for 3 months
        mock_rows = [
            Mock(
                period=datetime(2024, 1, 1, tzinfo=UTC),
                invoice_count=10,
                total_amount=50000,
                paid_amount=40000,
            ),
            Mock(
                period=datetime(2024, 2, 1, tzinfo=UTC),
                invoice_count=15,
                total_amount=75000,
                paid_amount=60000,
            ),
            Mock(
                period=datetime(2024, 3, 1, tzinfo=UTC),
                invoice_count=12,
                total_amount=60000,
                paid_amount=55000,
            ),
        ]

        mock_result = Mock()
        mock_result.all.return_value = mock_rows
        mock_db_session.execute.return_value = mock_result

        trend = await generator.get_revenue_trend(
            tenant_id, date_range["start"], date_range["end"], group_by="month"
        )

        assert len(trend) == 3
        assert trend[0]["period"] == "2024-01-01T00:00:00+00:00"
        assert trend[0]["invoice_count"] == 10
        assert trend[0]["total_amount"] == 50000
        assert trend[0]["paid_amount"] == 40000

    @pytest.mark.asyncio
    async def test_get_revenue_trend_by_day(self, mock_db_session, tenant_id, date_range):
        """Test revenue trend grouped by day."""
        generator = RevenueReportGenerator(mock_db_session)

        mock_result = Mock()
        mock_result.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        trend = await generator.get_revenue_trend(
            tenant_id, date_range["start"], date_range["end"], group_by="day"
        )

        assert isinstance(trend, list)
        assert len(trend) == 0

    @pytest.mark.asyncio
    async def test_get_revenue_trend_by_week(self, mock_db_session, tenant_id, date_range):
        """Test revenue trend grouped by week."""
        generator = RevenueReportGenerator(mock_db_session)

        mock_result = Mock()
        mock_result.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        trend = await generator.get_revenue_trend(
            tenant_id, date_range["start"], date_range["end"], group_by="week"
        )

        assert isinstance(trend, list)

    @pytest.mark.asyncio
    async def test_get_revenue_trend_invalid_group_by(self, mock_db_session, tenant_id, date_range):
        """Test revenue trend with invalid group_by defaults to month."""
        generator = RevenueReportGenerator(mock_db_session)

        mock_result = Mock()
        mock_result.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        trend = await generator.get_revenue_trend(
            tenant_id, date_range["start"], date_range["end"], group_by="invalid"
        )

        assert isinstance(trend, list)

    @pytest.mark.asyncio
    async def test_get_payment_method_distribution(self, mock_db_session, tenant_id, date_range):
        """Test payment method distribution."""
        generator = RevenueReportGenerator(mock_db_session)

        # Mock payment method data
        mock_rows = [
            Mock(payment_method_type="credit_card", count=50, total_amount=250000),
            Mock(payment_method_type="bank_transfer", count=30, total_amount=150000),
            Mock(payment_method_type="paypal", count=20, total_amount=100000),
        ]

        mock_result = Mock()
        mock_result.all.return_value = mock_rows
        mock_db_session.execute.return_value = mock_result

        distribution = await generator.get_payment_method_distribution(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert "credit_card" in distribution
        assert distribution["credit_card"]["count"] == 50
        assert distribution["credit_card"]["amount"] == 250000
        assert distribution["credit_card"]["percentage"] == 50.0  # 250k/500k * 100

        assert "bank_transfer" in distribution
        assert distribution["bank_transfer"]["percentage"] == 30.0

        assert "paypal" in distribution
        assert distribution["paypal"]["percentage"] == 20.0

    @pytest.mark.asyncio
    async def test_get_payment_method_distribution_with_none_method(
        self, mock_db_session, tenant_id, date_range
    ):
        """Test payment method distribution with None method type."""
        generator = RevenueReportGenerator(mock_db_session)

        mock_rows = [
            Mock(payment_method_type=None, count=10, total_amount=50000),
        ]

        mock_result = Mock()
        mock_result.all.return_value = mock_rows
        mock_db_session.execute.return_value = mock_result

        distribution = await generator.get_payment_method_distribution(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert "unknown" in distribution
        assert distribution["unknown"]["count"] == 10
        assert distribution["unknown"]["amount"] == 50000

    @pytest.mark.asyncio
    async def test_get_refunds_summary(self, mock_db_session, tenant_id, date_range):
        """Test refunds summary."""
        generator = RevenueReportGenerator(mock_db_session)

        mock_row = Mock()
        mock_row.credit_note_count = 5
        mock_row.total_refunded = 25000

        mock_result = Mock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        refunds = await generator.get_refunds_summary(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert refunds["credit_note_count"] == 5
        assert refunds["total_refunded"] == 25000

    @pytest.mark.asyncio
    async def test_get_refunds_summary_no_data(self, mock_db_session, tenant_id, date_range):
        """Test refunds summary with no data."""
        generator = RevenueReportGenerator(mock_db_session)

        mock_row = Mock()
        mock_row.credit_note_count = None
        mock_row.total_refunded = None

        mock_result = Mock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        refunds = await generator.get_refunds_summary(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert refunds["credit_note_count"] == 0
        assert refunds["total_refunded"] == 0

    @pytest.mark.asyncio
    async def test_generate_detailed_report(self, mock_db_session, tenant_id, date_range):
        """Test generating detailed revenue report."""
        generator = RevenueReportGenerator(mock_db_session)

        # Mock all sub-method results
        mock_summary_row = Mock(
            invoice_count=10,
            total_invoiced=100000,
            total_revenue=80000,
            paid_count=8,
        )
        mock_trend_row = Mock(
            period=datetime(2024, 1, 1, tzinfo=UTC),
            invoice_count=10,
            total_amount=100000,
            paid_amount=80000,
        )
        mock_payment_row = Mock(payment_method_type="credit_card", count=8, total_amount=80000)
        mock_refunds_row = Mock(credit_note_count=2, total_refunded=10000)

        # Configure mock to return different results for different queries
        mock_results = [
            Mock(one=Mock(return_value=mock_summary_row)),  # Summary
            Mock(all=Mock(return_value=[mock_trend_row])),  # Trend
            Mock(all=Mock(return_value=[mock_payment_row])),  # Payment methods
            Mock(one=Mock(return_value=mock_refunds_row)),  # Refunds
        ]

        mock_db_session.execute.side_effect = mock_results

        report = await generator.generate_detailed_report(
            tenant_id, date_range["start"], date_range["end"], group_by="month"
        )

        assert report["report_type"] == "revenue_detailed"
        assert report["tenant_id"] == tenant_id
        assert "period" in report
        assert "summary" in report
        assert "trend" in report
        assert "payment_methods" in report
        assert "refunds" in report
        assert report["net_revenue"] == 70000  # 80000 - 10000
        assert "generated_at" in report

    @pytest.mark.asyncio
    async def test_generate_refunds_report(self, mock_db_session, tenant_id, date_range):
        """Test generating refunds report."""
        generator = RevenueReportGenerator(mock_db_session)

        # Mock refund summary
        mock_summary_row = Mock(credit_note_count=5, total_refunded=25000)

        # Mock refund reasons
        mock_reason_rows = [
            Mock(reason=CreditReason.DUPLICATE_CHARGE, count=2, amount=10000),
            Mock(reason=CreditReason.SERVICE_ISSUE, count=3, amount=15000),
        ]

        mock_db_session.execute.side_effect = [
            Mock(one=Mock(return_value=mock_summary_row)),
            Mock(all=Mock(return_value=mock_reason_rows)),
        ]

        report = await generator.generate_refunds_report(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert report["report_type"] == "refunds"
        assert report["tenant_id"] == tenant_id
        assert report["summary"]["credit_note_count"] == 5
        assert report["summary"]["total_refunded"] == 25000
        assert len(report["by_reason"]) == 2
        assert report["by_reason"][0]["reason"] == "duplicate_charge"
        assert report["by_reason"][0]["count"] == 2
        assert "generated_at" in report

    @pytest.mark.asyncio
    async def test_generate_refunds_report_with_none_reason(
        self, mock_db_session, tenant_id, date_range
    ):
        """Test refunds report with None reason."""
        generator = RevenueReportGenerator(mock_db_session)

        mock_summary_row = Mock(credit_note_count=1, total_refunded=5000)
        mock_reason_row = Mock(reason=None, count=1, amount=5000)

        mock_db_session.execute.side_effect = [
            Mock(one=Mock(return_value=mock_summary_row)),
            Mock(all=Mock(return_value=[mock_reason_row])),
        ]

        report = await generator.generate_refunds_report(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert report["by_reason"][0]["reason"] == "unknown"

    @pytest.mark.asyncio
    async def test_calculate_rate_normal(self):
        """Test _calculate_rate with normal values."""
        generator = RevenueReportGenerator(AsyncMock())

        rate = generator._calculate_rate(80, 100)
        assert rate == 80.0

    @pytest.mark.asyncio
    async def test_calculate_rate_zero_whole(self):
        """Test _calculate_rate with zero whole."""
        generator = RevenueReportGenerator(AsyncMock())

        rate = generator._calculate_rate(50, 0)
        assert rate == 0.0

    @pytest.mark.asyncio
    async def test_calculate_rate_none_values(self):
        """Test _calculate_rate with None values."""
        generator = RevenueReportGenerator(AsyncMock())

        rate = generator._calculate_rate(None, 100)
        assert rate == 0.0

        rate = generator._calculate_rate(50, None)
        assert rate == 0.0


@pytest.mark.unit
class TestCustomerReportGenerator:
    """Test CustomerReportGenerator."""

    @pytest.mark.asyncio
    async def test_init(self, mock_db_session):
        """Test generator initialization."""
        generator = CustomerReportGenerator(mock_db_session)
        assert generator.db == mock_db_session

    @pytest.mark.asyncio
    async def test_get_customer_metrics(self, mock_db_session, tenant_id, date_range):
        """Test customer metrics."""
        generator = CustomerReportGenerator(mock_db_session)

        mock_row = Mock(active_customers=50)

        mock_result = Mock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        metrics = await generator.get_customer_metrics(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert metrics["active_customers"] == 50
        assert metrics["new_customers"] == 50  # Placeholder equals active

    @pytest.mark.asyncio
    async def test_get_customer_metrics_no_data(self, mock_db_session, tenant_id, date_range):
        """Test customer metrics with no data."""
        generator = CustomerReportGenerator(mock_db_session)

        mock_row = Mock(active_customers=None)

        mock_result = Mock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        metrics = await generator.get_customer_metrics(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert metrics["active_customers"] == 0
        assert metrics["new_customers"] == 0

    @pytest.mark.asyncio
    async def test_generate_customer_report(self, mock_db_session, tenant_id, date_range):
        """Test generating customer analysis report."""
        generator = CustomerReportGenerator(mock_db_session)

        # Mock top customers query
        mock_customer_rows = [
            Mock(
                customer_id="cust_1",
                invoice_count=10,
                total_amount=100000,
                paid_amount=90000,
            ),
            Mock(
                customer_id="cust_2",
                invoice_count=5,
                total_amount=50000,
                paid_amount=50000,
            ),
        ]

        # Mock metrics query
        mock_metrics_row = Mock(active_customers=100)

        mock_db_session.execute.side_effect = [
            Mock(all=Mock(return_value=mock_customer_rows)),
            Mock(one=Mock(return_value=mock_metrics_row)),
        ]

        report = await generator.generate_customer_report(
            tenant_id, date_range["start"], date_range["end"], top_n=20
        )

        assert report["report_type"] == "customer_analysis"
        assert report["tenant_id"] == tenant_id
        assert len(report["top_customers"]) == 2
        assert report["top_customers"][0]["customer_id"] == "cust_1"
        assert report["top_customers"][0]["invoice_count"] == 10
        assert report["top_customers"][0]["total_amount"] == 100000
        assert report["top_customers"][0]["paid_amount"] == 90000
        assert report["top_customers"][0]["outstanding"] == 10000  # 100k - 90k
        assert report["metrics"]["active_customers"] == 100
        assert "generated_at" in report

    @pytest.mark.asyncio
    async def test_generate_customer_report_with_none_amounts(
        self, mock_db_session, tenant_id, date_range
    ):
        """Test customer report with None amounts."""
        generator = CustomerReportGenerator(mock_db_session)

        mock_customer_row = Mock(
            customer_id="cust_1",
            invoice_count=None,
            total_amount=None,
            paid_amount=None,
        )

        mock_metrics_row = Mock(active_customers=10)

        mock_db_session.execute.side_effect = [
            Mock(all=Mock(return_value=[mock_customer_row])),
            Mock(one=Mock(return_value=mock_metrics_row)),
        ]

        report = await generator.generate_customer_report(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert report["top_customers"][0]["invoice_count"] == 0
        assert report["top_customers"][0]["total_amount"] == 0
        assert report["top_customers"][0]["paid_amount"] == 0
        assert report["top_customers"][0]["outstanding"] == 0


@pytest.mark.unit
class TestAgingReportGenerator:
    """Test AgingReportGenerator."""

    @pytest.mark.asyncio
    async def test_init(self, mock_db_session):
        """Test generator initialization."""
        generator = AgingReportGenerator(mock_db_session)
        assert generator.db == mock_db_session

    @pytest.mark.asyncio
    async def test_get_aging_summary(self, mock_db_session, tenant_id):
        """Test aging summary."""
        generator = AgingReportGenerator(mock_db_session)

        mock_row = Mock(
            invoice_count=10,
            total_outstanding=50000,
            current=20000,
            days_1_30=15000,
            days_31_60=8000,
            days_61_90=5000,
            over_90_days=2000,
        )

        mock_result = Mock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        summary = await generator.get_aging_summary(tenant_id)

        assert summary["invoice_count"] == 10
        assert summary["total_outstanding"] == 50000
        assert summary["overdue_amount"] == 30000  # 15k + 8k + 5k + 2k
        assert summary["buckets"]["current"] == 20000
        assert summary["buckets"]["1_30_days"] == 15000
        assert summary["buckets"]["31_60_days"] == 8000
        assert summary["buckets"]["61_90_days"] == 5000
        assert summary["buckets"]["over_90_days"] == 2000

    @pytest.mark.asyncio
    async def test_get_aging_summary_no_data(self, mock_db_session, tenant_id):
        """Test aging summary with no data."""
        generator = AgingReportGenerator(mock_db_session)

        mock_row = Mock(
            invoice_count=None,
            total_outstanding=None,
            current=None,
            days_1_30=None,
            days_31_60=None,
            days_61_90=None,
            over_90_days=None,
        )

        mock_result = Mock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        summary = await generator.get_aging_summary(tenant_id)

        assert summary["invoice_count"] == 0
        assert summary["total_outstanding"] == 0
        assert summary["overdue_amount"] == 0
        assert summary["buckets"]["current"] == 0
        assert summary["buckets"]["1_30_days"] == 0

    @pytest.mark.asyncio
    async def test_generate_aging_report(self, mock_db_session, tenant_id):
        """Test generating aging report."""
        generator = AgingReportGenerator(mock_db_session)

        as_of_date = datetime.now(UTC)

        mock_row = Mock(
            invoice_count=5,
            total_outstanding=25000,
            current=10000,
            days_1_30=8000,
            days_31_60=5000,
            days_61_90=2000,
            over_90_days=0,
        )

        mock_result = Mock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        report = await generator.generate_aging_report(tenant_id, as_of_date)

        assert report["report_type"] == "aging"
        assert report["tenant_id"] == tenant_id
        assert "as_of_date" in report
        assert report["summary"]["invoice_count"] == 5
        assert report["summary"]["total_outstanding"] == 25000
        assert "generated_at" in report

    @pytest.mark.asyncio
    async def test_generate_collections_report(self, mock_db_session, tenant_id, date_range):
        """Test generating collections performance report."""
        generator = AgingReportGenerator(mock_db_session)

        mock_row = Mock(
            collected_count=15,
            collected_amount=75000,
            avg_days_to_collect=12.5,
        )

        mock_result = Mock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        report = await generator.generate_collections_report(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert report["report_type"] == "collections"
        assert report["tenant_id"] == tenant_id
        assert report["summary"]["collected_count"] == 15
        assert report["summary"]["collected_amount"] == 75000
        assert report["summary"]["avg_days_to_collect"] == 12.5
        assert "generated_at" in report

    @pytest.mark.asyncio
    async def test_generate_collections_report_no_data(
        self, mock_db_session, tenant_id, date_range
    ):
        """Test collections report with no data."""
        generator = AgingReportGenerator(mock_db_session)

        mock_row = Mock(
            collected_count=None,
            collected_amount=None,
            avg_days_to_collect=None,
        )

        mock_result = Mock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        report = await generator.generate_collections_report(
            tenant_id, date_range["start"], date_range["end"]
        )

        assert report["summary"]["collected_count"] == 0
        assert report["summary"]["collected_amount"] == 0
        assert report["summary"]["avg_days_to_collect"] == 0.0
