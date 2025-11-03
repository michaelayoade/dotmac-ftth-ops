"""
Comprehensive tests for billing report service integration.

Tests service orchestration, custom reports, and end-to-end scenarios.
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from dotmac.platform.billing.reports.service import (
    BillingReportService,
    ReportPeriod,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_db():
    """Mock database session."""
    return AsyncMock()


@pytest.fixture
def report_service(mock_db):
    """Billing report service with mocked dependencies."""
    service = BillingReportService(mock_db)

    # Mock all generators
    service.revenue_generator = AsyncMock()
    service.customer_generator = AsyncMock()
    service.aging_generator = AsyncMock()
    service.tax_generator = AsyncMock()
    service.tax_generator.tax_service = AsyncMock()

    return service


@pytest.mark.integration
class TestExecutiveSummaryReport:
    """Test executive summary report generation."""

    @pytest.mark.asyncio
    async def test_generate_executive_summary_this_month(self, report_service):
        """Test generating executive summary for this month."""
        tenant_id = "test-tenant"

        # Mock all generator responses
        report_service.revenue_generator.get_revenue_summary = AsyncMock(
            side_effect=[
                # Current period
                {
                    "total_revenue": Decimal("100000.00"),
                    "invoice_count": 200,
                    "paid_count": 180,
                },
                # Previous period
                {
                    "total_revenue": Decimal("85000.00"),
                    "invoice_count": 170,
                    "paid_count": 150,
                },
            ]
        )

        report_service.customer_generator.get_customer_metrics = AsyncMock(
            return_value={
                "active_customers": 150,
                "new_customers": 25,
                "previous_period_new_customers": 20,
            }
        )

        report_service.aging_generator.get_aging_summary = AsyncMock(
            return_value={
                "total_outstanding": Decimal("15000.00"),
                "overdue_amount": Decimal("5000.00"),
            }
        )

        report_service.tax_generator.tax_service.get_tax_liability_report = AsyncMock(
            return_value={
                "tax_collected": Decimal("10000.00"),
                "net_tax_liability": Decimal("9500.00"),
            }
        )

        report_service.revenue_generator.get_revenue_trend = AsyncMock(return_value=[])

        report_service.revenue_generator.get_payment_method_distribution = AsyncMock(
            return_value={}
        )

        report = await report_service.generate_executive_summary(
            tenant_id, period=ReportPeriod.THIS_MONTH
        )

        assert report["report_type"] == "executive_summary"
        assert report["tenant_id"] == tenant_id
        assert "period" in report
        assert "key_metrics" in report
        assert "trends" in report
        assert "generated_at" in report

        # Verify key metrics structure
        metrics = report["key_metrics"]
        assert "revenue" in metrics
        assert "invoices" in metrics
        assert "customers" in metrics
        assert "outstanding" in metrics
        assert "tax_liability" in metrics

        # Verify revenue metrics
        assert metrics["revenue"]["current_period"] == Decimal("100000.00")
        assert metrics["revenue"]["previous_period"] == Decimal("85000.00")
        assert "growth_rate" in metrics["revenue"]

    @pytest.mark.asyncio
    async def test_generate_executive_summary_custom_period(self, report_service):
        """Test executive summary with custom date range."""
        tenant_id = "test-tenant"
        custom_start = datetime(2024, 1, 1, tzinfo=UTC)
        custom_end = datetime(2024, 3, 31, tzinfo=UTC)

        # Mock responses
        report_service.revenue_generator.get_revenue_summary = AsyncMock(
            return_value={
                "total_revenue": Decimal("250000.00"),
                "invoice_count": 500,
                "paid_count": 450,
            }
        )
        report_service.customer_generator.get_customer_metrics = AsyncMock(
            return_value={"active_customers": 300, "new_customers": 75}
        )
        report_service.aging_generator.get_aging_summary = AsyncMock(
            return_value={
                "total_outstanding": Decimal("30000.00"),
                "overdue_amount": Decimal("10000.00"),
            }
        )
        report_service.tax_generator.tax_service.get_tax_liability_report = AsyncMock(
            return_value={
                "tax_collected": Decimal("25000.00"),
                "net_tax_liability": Decimal("24500.00"),
            }
        )
        report_service.revenue_generator.get_revenue_trend = AsyncMock(return_value=[])
        report_service.revenue_generator.get_payment_method_distribution = AsyncMock(
            return_value={}
        )

        report = await report_service.generate_executive_summary(
            tenant_id, period=ReportPeriod.CUSTOM, custom_start=custom_start, custom_end=custom_end
        )

        assert report["period"]["type"] == "custom"
        assert report["period"]["start"] == custom_start.isoformat()
        assert report["period"]["end"] == custom_end.isoformat()

    @pytest.mark.asyncio
    async def test_generate_executive_summary_calculates_growth(self, report_service):
        """Test that executive summary calculates growth rates correctly."""
        tenant_id = "test-tenant"

        # Mock with specific values to test growth calculation
        report_service.revenue_generator.get_revenue_summary = AsyncMock(
            side_effect=[
                {"total_revenue": Decimal("150000.00"), "invoice_count": 300, "paid_count": 270},
                {"total_revenue": Decimal("100000.00"), "invoice_count": 200, "paid_count": 180},
            ]
        )
        report_service.customer_generator.get_customer_metrics = AsyncMock(
            return_value={
                "active_customers": 200,
                "new_customers": 30,
                "previous_period_new_customers": 20,
            }
        )
        report_service.aging_generator.get_aging_summary = AsyncMock(
            return_value={"total_outstanding": Decimal("0"), "overdue_amount": Decimal("0")}
        )
        report_service.tax_generator.tax_service.get_tax_liability_report = AsyncMock(
            return_value={"tax_collected": Decimal("0"), "net_tax_liability": Decimal("0")}
        )
        report_service.revenue_generator.get_revenue_trend = AsyncMock(return_value=[])
        report_service.revenue_generator.get_payment_method_distribution = AsyncMock(
            return_value={}
        )

        report = await report_service.generate_executive_summary(tenant_id)

        # Revenue growth: (150000 - 100000) / 100000 * 100 = 50%
        assert report["key_metrics"]["revenue"]["growth_rate"] == 50.0

        # Customer growth: (30 - 20) / 20 * 100 = 50%
        assert report["key_metrics"]["customers"]["growth_rate"] == 50.0


@pytest.mark.integration
class TestSpecializedReports:
    """Test specialized report generation methods."""

    @pytest.mark.asyncio
    async def test_generate_revenue_report(self, report_service):
        """Test generating detailed revenue report."""
        tenant_id = "test-tenant"
        start_date = datetime(2024, 1, 1, tzinfo=UTC)
        end_date = datetime(2024, 1, 31, tzinfo=UTC)

        expected_report = {
            "report_type": "revenue_detailed",
            "summary": {},
            "trend": [],
            "payment_methods": {},
        }

        report_service.revenue_generator.generate_detailed_report = AsyncMock(
            return_value=expected_report
        )

        report = await report_service.generate_revenue_report(
            tenant_id, start_date, end_date, group_by="month"
        )

        assert report == expected_report
        report_service.revenue_generator.generate_detailed_report.assert_called_once_with(
            tenant_id, start_date, end_date, "month"
        )

    @pytest.mark.asyncio
    async def test_generate_customer_report(self, report_service):
        """Test generating customer analysis report."""
        tenant_id = "test-tenant"
        start_date = datetime(2024, 1, 1, tzinfo=UTC)
        end_date = datetime(2024, 1, 31, tzinfo=UTC)

        expected_report = {
            "report_type": "customer_analysis",
            "metrics": {},
            "top_customers": [],
        }

        report_service.customer_generator.generate_customer_report = AsyncMock(
            return_value=expected_report
        )

        report = await report_service.generate_customer_report(
            tenant_id, start_date, end_date, top_n=20
        )

        assert report == expected_report
        report_service.customer_generator.generate_customer_report.assert_called_once_with(
            tenant_id, start_date, end_date, 20
        )

    @pytest.mark.asyncio
    async def test_generate_aging_report(self, report_service):
        """Test generating aging report."""
        tenant_id = "test-tenant"
        as_of_date = datetime(2024, 1, 31, tzinfo=UTC)

        expected_report = {
            "report_type": "aging",
            "summary": {},
        }

        report_service.aging_generator.generate_aging_report = AsyncMock(
            return_value=expected_report
        )

        report = await report_service.generate_aging_report(tenant_id, as_of_date)

        assert report == expected_report
        report_service.aging_generator.generate_aging_report.assert_called_once_with(
            tenant_id, as_of_date
        )

    @pytest.mark.asyncio
    async def test_generate_aging_report_default_date(self, report_service):
        """Test aging report with default as_of_date."""
        tenant_id = "test-tenant"

        report_service.aging_generator.generate_aging_report = AsyncMock(return_value={})

        with patch("dotmac.platform.billing.reports.service.datetime") as mock_datetime:
            mock_now = datetime(2024, 1, 31, 12, 0, 0, tzinfo=UTC)
            mock_datetime.utcnow.return_value = mock_now

            await report_service.generate_aging_report(tenant_id)

            # Should use current time as default
            report_service.aging_generator.generate_aging_report.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_collections_report(self, report_service):
        """Test generating collections performance report."""
        tenant_id = "test-tenant"
        start_date = datetime(2024, 1, 1, tzinfo=UTC)
        end_date = datetime(2024, 1, 31, tzinfo=UTC)

        expected_report = {
            "report_type": "collections",
            "summary": {},
        }

        report_service.aging_generator.generate_collections_report = AsyncMock(
            return_value=expected_report
        )

        report = await report_service.generate_collections_report(tenant_id, start_date, end_date)

        assert report == expected_report
        report_service.aging_generator.generate_collections_report.assert_called_once_with(
            tenant_id, start_date, end_date
        )

    @pytest.mark.asyncio
    async def test_generate_refunds_report(self, report_service):
        """Test generating refunds report."""
        tenant_id = "test-tenant"
        start_date = datetime(2024, 1, 1, tzinfo=UTC)
        end_date = datetime(2024, 1, 31, tzinfo=UTC)

        expected_report = {
            "report_type": "refunds",
            "summary": {},
        }

        report_service.revenue_generator.generate_refunds_report = AsyncMock(
            return_value=expected_report
        )

        report = await report_service.generate_refunds_report(tenant_id, start_date, end_date)

        assert report == expected_report
        report_service.revenue_generator.generate_refunds_report.assert_called_once_with(
            tenant_id, start_date, end_date
        )


@pytest.mark.integration
class TestCustomReports:
    """Test custom report generation."""

    @pytest.mark.asyncio
    async def test_generate_custom_report_revenue_metric(self, report_service):
        """Test custom report with revenue metric."""
        tenant_id = "test-tenant"
        report_config = {
            "metrics": ["revenue"],
            "filters": {
                "start_date": datetime(2024, 1, 1, tzinfo=UTC),
                "end_date": datetime(2024, 1, 31, tzinfo=UTC),
            },
            "group_by": ["month"],
        }

        report_service.revenue_generator.get_revenue_summary = AsyncMock(
            return_value={"total_revenue": Decimal("100000.00")}
        )

        report = await report_service.generate_custom_report(tenant_id, report_config)

        assert report["report_type"] == "custom"
        assert report["tenant_id"] == tenant_id
        assert "revenue" in report["data"]
        assert report["data"]["revenue"]["total_revenue"] == Decimal("100000.00")

    @pytest.mark.asyncio
    async def test_generate_custom_report_multiple_metrics(self, report_service):
        """Test custom report with multiple metrics."""
        tenant_id = "test-tenant"
        report_config = {
            "metrics": ["revenue", "customers", "aging", "tax"],
            "filters": {
                "start_date": datetime(2024, 1, 1, tzinfo=UTC),
                "end_date": datetime(2024, 1, 31, tzinfo=UTC),
            },
        }

        # Mock all metrics
        report_service.revenue_generator.get_revenue_summary = AsyncMock(
            return_value={"total_revenue": Decimal("100000.00")}
        )
        report_service.customer_generator.get_customer_metrics = AsyncMock(
            return_value={"active_customers": 150}
        )
        report_service.aging_generator.get_aging_summary = AsyncMock(
            return_value={"total_outstanding": Decimal("15000.00")}
        )
        report_service.tax_generator.tax_service.get_tax_summary_by_jurisdiction = AsyncMock(
            return_value={"total_tax": Decimal("10000.00")}
        )

        report = await report_service.generate_custom_report(tenant_id, report_config)

        assert "revenue" in report["data"]
        assert "customers" in report["data"]
        assert "aging" in report["data"]
        assert "tax" in report["data"]

    @pytest.mark.asyncio
    async def test_generate_custom_report_empty_metrics(self, report_service):
        """Test custom report with no metrics specified."""
        tenant_id = "test-tenant"
        report_config = {
            "metrics": [],
            "filters": {},
        }

        report = await report_service.generate_custom_report(tenant_id, report_config)

        assert report["report_type"] == "custom"
        assert report["data"] == {}

    @pytest.mark.asyncio
    async def test_generate_custom_report_includes_configuration(self, report_service):
        """Test custom report includes the configuration."""
        tenant_id = "test-tenant"
        report_config = {
            "metrics": ["revenue"],
            "filters": {"start_date": datetime(2024, 1, 1, tzinfo=UTC)},
            "group_by": ["month", "product"],
        }

        report_service.revenue_generator.get_revenue_summary = AsyncMock(return_value={})

        report = await report_service.generate_custom_report(tenant_id, report_config)

        assert report["configuration"] == report_config


@pytest.mark.integration
class TestReportPeriodScenarios:
    """Test various report period scenarios."""

    @pytest.mark.asyncio
    async def test_report_for_last_week(self, report_service):
        """Test generating report for last week."""
        tenant_id = "test-tenant"

        # Mock minimal responses
        report_service.revenue_generator.get_revenue_summary = AsyncMock(
            return_value={"total_revenue": Decimal("0"), "invoice_count": 0, "paid_count": 0}
        )
        report_service.customer_generator.get_customer_metrics = AsyncMock(
            return_value={"active_customers": 0, "new_customers": 0}
        )
        report_service.aging_generator.get_aging_summary = AsyncMock(
            return_value={"total_outstanding": Decimal("0"), "overdue_amount": Decimal("0")}
        )
        report_service.tax_generator.tax_service.get_tax_liability_report = AsyncMock(
            return_value={"tax_collected": Decimal("0"), "net_tax_liability": Decimal("0")}
        )
        report_service.revenue_generator.get_revenue_trend = AsyncMock(return_value=[])
        report_service.revenue_generator.get_payment_method_distribution = AsyncMock(
            return_value={}
        )

        report = await report_service.generate_executive_summary(
            tenant_id, period=ReportPeriod.LAST_WEEK
        )

        assert report["period"]["type"] == "last_week"

        # Verify date range is exactly 7 days
        start = datetime.fromisoformat(report["period"]["start"])
        end = datetime.fromisoformat(report["period"]["end"])
        assert (end - start).days == 7

    @pytest.mark.asyncio
    async def test_report_for_this_quarter(self, report_service):
        """Test generating report for this quarter."""
        tenant_id = "test-tenant"

        # Mock minimal responses
        report_service.revenue_generator.get_revenue_summary = AsyncMock(
            return_value={"total_revenue": Decimal("0"), "invoice_count": 0, "paid_count": 0}
        )
        report_service.customer_generator.get_customer_metrics = AsyncMock(
            return_value={"active_customers": 0, "new_customers": 0}
        )
        report_service.aging_generator.get_aging_summary = AsyncMock(
            return_value={"total_outstanding": Decimal("0"), "overdue_amount": Decimal("0")}
        )
        report_service.tax_generator.tax_service.get_tax_liability_report = AsyncMock(
            return_value={"tax_collected": Decimal("0"), "net_tax_liability": Decimal("0")}
        )
        report_service.revenue_generator.get_revenue_trend = AsyncMock(return_value=[])
        report_service.revenue_generator.get_payment_method_distribution = AsyncMock(
            return_value={}
        )

        report = await report_service.generate_executive_summary(
            tenant_id, period=ReportPeriod.THIS_QUARTER
        )

        assert report["period"]["type"] == "this_quarter"

        # Verify start date is first day of quarter
        start = datetime.fromisoformat(report["period"]["start"])
        assert start.day == 1
        assert start.month in [1, 4, 7, 10]


@pytest.mark.integration
class TestEdgeCases:
    """Test edge cases and error scenarios."""

    @pytest.mark.asyncio
    async def test_report_with_zero_revenue(self, report_service):
        """Test report generation with zero revenue."""
        tenant_id = "test-tenant"

        # Mock zero revenue scenario
        report_service.revenue_generator.get_revenue_summary = AsyncMock(
            side_effect=[
                {"total_revenue": Decimal("0"), "invoice_count": 0, "paid_count": 0},
                {"total_revenue": Decimal("0"), "invoice_count": 0, "paid_count": 0},
            ]
        )
        report_service.customer_generator.get_customer_metrics = AsyncMock(
            return_value={"active_customers": 0, "new_customers": 0}
        )
        report_service.aging_generator.get_aging_summary = AsyncMock(
            return_value={"total_outstanding": Decimal("0"), "overdue_amount": Decimal("0")}
        )
        report_service.tax_generator.tax_service.get_tax_liability_report = AsyncMock(
            return_value={"tax_collected": Decimal("0"), "net_tax_liability": Decimal("0")}
        )
        report_service.revenue_generator.get_revenue_trend = AsyncMock(return_value=[])
        report_service.revenue_generator.get_payment_method_distribution = AsyncMock(
            return_value={}
        )

        report = await report_service.generate_executive_summary(tenant_id)

        # Should handle gracefully
        assert report["key_metrics"]["revenue"]["current_period"] == Decimal("0")
        assert report["key_metrics"]["revenue"]["growth_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_report_with_division_by_zero_prevention(self, report_service):
        """Test that report handles division by zero gracefully."""
        tenant_id = "test-tenant"

        # Mock scenario where previous period has zero revenue
        report_service.revenue_generator.get_revenue_summary = AsyncMock(
            side_effect=[
                {"total_revenue": Decimal("100000.00"), "invoice_count": 100, "paid_count": 90},
                {"total_revenue": Decimal("0"), "invoice_count": 0, "paid_count": 0},
            ]
        )
        report_service.customer_generator.get_customer_metrics = AsyncMock(
            return_value={
                "active_customers": 100,
                "new_customers": 10,
                "previous_period_new_customers": 0,
            }
        )
        report_service.aging_generator.get_aging_summary = AsyncMock(
            return_value={"total_outstanding": Decimal("0"), "overdue_amount": Decimal("0")}
        )
        report_service.tax_generator.tax_service.get_tax_liability_report = AsyncMock(
            return_value={"tax_collected": Decimal("0"), "net_tax_liability": Decimal("0")}
        )
        report_service.revenue_generator.get_revenue_trend = AsyncMock(return_value=[])
        report_service.revenue_generator.get_payment_method_distribution = AsyncMock(
            return_value={}
        )

        report = await report_service.generate_executive_summary(tenant_id)

        # Growth rate should be 100% when going from 0 to positive
        assert report["key_metrics"]["revenue"]["growth_rate"] == 100.0
        assert report["key_metrics"]["customers"]["growth_rate"] == 100.0
