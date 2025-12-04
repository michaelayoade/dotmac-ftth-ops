"""
Tests for billing reports functionality
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.billing.reports.generators import (
    AgingReportGenerator,
    CustomerReportGenerator,
    RevenueReportGenerator,
)
from dotmac.platform.billing.reports.service import (
    BillingReportService,
    ReportPeriod,
)


@pytest.fixture
def mock_db():
    """Mock database session"""
    return AsyncMock()


@pytest.fixture
def billing_report_service(mock_db):
    """Billing report service with mocked dependencies"""
    service = BillingReportService(mock_db)

    # Mock the generators
    service.revenue_generator = AsyncMock(spec=RevenueReportGenerator)
    service.customer_generator = AsyncMock(spec=CustomerReportGenerator)
    service.aging_generator = AsyncMock(spec=AgingReportGenerator)
    service.tax_generator = AsyncMock()
    service.tax_generator.tax_service = AsyncMock()

    return service


@pytest.mark.integration
class TestBillingReportService:
    """Test billing report service functionality"""

    @pytest.mark.asyncio
    async def test_generate_executive_summary(self, billing_report_service):
        """Test generating executive summary report"""

        # Mock generator responses
        billing_report_service.revenue_generator.get_revenue_summary = AsyncMock(
            side_effect=[
                {  # Current period
                    "total_revenue": 50000,
                    "invoice_count": 25,
                    "paid_count": 20,
                },
                {  # Previous period
                    "total_revenue": 40000,
                    "invoice_count": 20,
                    "paid_count": 18,
                },
            ]
        )

        billing_report_service.customer_generator.get_customer_metrics = AsyncMock(
            return_value={
                "active_customers": 150,
                "new_customers": 10,
            }
        )

        billing_report_service.aging_generator.get_aging_summary = AsyncMock(
            return_value={
                "total_outstanding": 15000,
                "overdue_amount": 5000,
            }
        )

        billing_report_service.tax_generator.tax_service.get_tax_liability_report = AsyncMock(
            return_value={
                "tax_collected": 4000,
                "net_tax_liability": 3800,
            }
        )

        billing_report_service.revenue_generator.get_revenue_trend = AsyncMock(return_value=[])

        billing_report_service.revenue_generator.get_payment_method_distribution = AsyncMock(
            return_value={}
        )

        # Generate report
        result = await billing_report_service.generate_executive_summary(
            tenant_id="test_tenant",
            period=ReportPeriod.THIS_MONTH,
        )

        # Verify result structure
        assert result["report_type"] == "executive_summary"
        assert result["tenant_id"] == "test_tenant"
        assert "period" in result
        assert "key_metrics" in result

        # Check key metrics
        metrics = result["key_metrics"]
        assert "revenue" in metrics
        assert "invoices" in metrics
        assert "customers" in metrics
        assert "outstanding" in metrics
        assert "tax_liability" in metrics

        # Check revenue metrics
        revenue = metrics["revenue"]
        assert revenue["current_period"] == 50000
        assert revenue["previous_period"] == 40000
        assert revenue["growth_rate"] == 25.0  # (50000-40000)/40000 * 100

        # Check invoice metrics
        invoices = metrics["invoices"]
        assert invoices["total_issued"] == 25
        assert invoices["total_paid"] == 20
        assert invoices["payment_rate"] == 80.0  # 20/25 * 100

    @pytest.mark.asyncio
    async def test_generate_revenue_report(self, billing_report_service):
        """Test generating revenue report"""

        expected_report = {
            "report_type": "revenue_detailed",
            "tenant_id": "test_tenant",
            "summary": {"total_revenue": 50000},
            "trend": [],
            "payment_methods": {},
        }

        billing_report_service.revenue_generator.generate_detailed_report = AsyncMock(
            return_value=expected_report
        )

        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)

        result = await billing_report_service.generate_revenue_report(
            tenant_id="test_tenant",
            start_date=start_date,
            end_date=end_date,
            group_by="day",
        )

        # Verify the generator was called correctly
        billing_report_service.revenue_generator.generate_detailed_report.assert_called_once_with(
            "test_tenant", start_date, end_date, "day"
        )

        assert result == expected_report

    @pytest.mark.asyncio
    async def test_generate_customer_report(self, billing_report_service):
        """Test generating customer report"""

        expected_report = {
            "report_type": "customer_analysis",
            "tenant_id": "test_tenant",
            "metrics": {"active_customers": 100},
            "top_customers": [],
        }

        billing_report_service.customer_generator.generate_customer_report = AsyncMock(
            return_value=expected_report
        )

        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)

        result = await billing_report_service.generate_customer_report(
            tenant_id="test_tenant",
            start_date=start_date,
            end_date=end_date,
            top_n=10,
        )

        # Verify the generator was called correctly
        billing_report_service.customer_generator.generate_customer_report.assert_called_once_with(
            "test_tenant", start_date, end_date, 10
        )

        assert result == expected_report

    @pytest.mark.asyncio
    async def test_generate_aging_report(self, billing_report_service):
        """Test generating aging report"""

        expected_report = {
            "report_type": "aging",
            "tenant_id": "test_tenant",
            "summary": {"total_outstanding": 25000},
        }

        billing_report_service.aging_generator.generate_aging_report = AsyncMock(
            return_value=expected_report
        )

        result = await billing_report_service.generate_aging_report(
            tenant_id="test_tenant",
        )

        # Verify the generator was called
        billing_report_service.aging_generator.generate_aging_report.assert_called_once()

        assert result == expected_report

    @pytest.mark.asyncio
    async def test_generate_custom_report(self, billing_report_service):
        """Test generating custom report"""

        # Mock individual metric responses
        billing_report_service.revenue_generator.get_revenue_summary = AsyncMock(
            return_value={"total_revenue": 30000}
        )

        billing_report_service.customer_generator.get_customer_metrics = AsyncMock(
            return_value={"active_customers": 75}
        )

        report_config = {
            "metrics": ["revenue", "customers"],
            "filters": {
                "start_date": datetime(2024, 1, 1),
                "end_date": datetime(2024, 1, 31),
            },
            "group_by": ["month"],
        }

        result = await billing_report_service.generate_custom_report(
            tenant_id="test_tenant",
            report_config=report_config,
        )

        # Verify result structure
        assert result["report_type"] == "custom"
        assert result["tenant_id"] == "test_tenant"
        assert result["configuration"] == report_config
        assert "data" in result

        # Check that requested metrics were included
        data = result["data"]
        assert "revenue" in data
        assert "customers" in data
        assert data["revenue"]["total_revenue"] == 30000
        assert data["customers"]["active_customers"] == 75

    def test_calculate_date_range_this_month(self, billing_report_service):
        """Test date range calculation for this month"""

        with patch("dotmac.platform.billing.reports.service.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2024, 3, 15, 10, 30, 0, tzinfo=UTC)

            start, end = billing_report_service._calculate_date_range(ReportPeriod.THIS_MONTH)

            assert start == datetime(2024, 3, 1, 0, 0, 0, tzinfo=UTC)
            assert end == datetime(2024, 3, 15, 10, 30, 0, tzinfo=UTC)

    def test_calculate_date_range_last_month(self, billing_report_service):
        """Test date range calculation for last month"""

        with patch("dotmac.platform.billing.reports.service.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2024, 3, 15, 10, 30, 0, tzinfo=UTC)

            start, end = billing_report_service._calculate_date_range(ReportPeriod.LAST_MONTH)

            assert start == datetime(2024, 2, 1, 0, 0, 0, tzinfo=UTC)
            assert end == datetime(2024, 3, 1, 0, 0, 0, tzinfo=UTC)

    def test_calculate_date_range_custom(self, billing_report_service):
        """Test date range calculation for custom period"""

        custom_start = datetime(2024, 1, 15)
        custom_end = datetime(2024, 2, 15)

        start, end = billing_report_service._calculate_date_range(
            ReportPeriod.CUSTOM,
            custom_start=custom_start,
            custom_end=custom_end,
        )

        assert start == custom_start
        assert end == custom_end

    def test_calculate_date_range_custom_missing_dates(self, billing_report_service):
        """Test custom date range with missing dates raises error"""

        with pytest.raises(ValueError, match="Custom period requires start and end dates"):
            billing_report_service._calculate_date_range(ReportPeriod.CUSTOM)

    def test_calculate_previous_period(self, billing_report_service):
        """Test calculation of previous period for comparison"""

        start = datetime(2024, 2, 1)
        end = datetime(2024, 2, 29)

        prev_start, prev_end = billing_report_service._calculate_previous_period(start, end)

        # Previous period should be same duration before start
        period_length = end - start  # 28 days
        expected_prev_end = start  # 2024-02-01
        expected_prev_start = expected_prev_end - period_length  # 2024-01-04

        assert prev_start == expected_prev_start
        assert prev_end == expected_prev_end

    def test_calculate_growth_rate(self, billing_report_service):
        """Test growth rate calculation"""

        # Normal growth
        growth = billing_report_service._calculate_growth_rate(120, 100)
        assert growth == 20.0  # 20% growth

        # Decline
        growth = billing_report_service._calculate_growth_rate(80, 100)
        assert growth == -20.0  # 20% decline

        # Zero previous value
        growth = billing_report_service._calculate_growth_rate(50, 0)
        assert growth == 100.0  # 100% when starting from zero

        # Zero current value
        growth = billing_report_service._calculate_growth_rate(0, 100)
        assert growth == -100.0  # 100% decline

        # Both zero
        growth = billing_report_service._calculate_growth_rate(0, 0)
        assert growth == 0.0

    def test_calculate_percentage(self, billing_report_service):
        """Test percentage calculation"""

        # Normal percentage
        pct = billing_report_service._calculate_percentage(25, 100)
        assert pct == 25.0

        # Zero whole
        pct = billing_report_service._calculate_percentage(25, 0)
        assert pct == 0.0

        # Zero part
        pct = billing_report_service._calculate_percentage(0, 100)
        assert pct == 0.0


@pytest.mark.integration
class TestRevenueReportGenerator:
    """Test revenue report generator"""

    @pytest.fixture
    def revenue_generator(self, mock_db):
        """Revenue report generator with mocked database"""
        return RevenueReportGenerator(mock_db)

    @pytest.mark.asyncio
    async def test_get_revenue_summary(self, revenue_generator):
        """Test getting revenue summary"""

        # Mock database result
        mock_result = MagicMock()
        mock_row = MagicMock()
        mock_row.invoice_count = 50
        mock_row.total_invoiced = 100000
        mock_row.total_revenue = 80000
        mock_row.paid_count = 40
        mock_result.one.return_value = mock_row

        revenue_generator.db.execute = AsyncMock(return_value=mock_result)

        result = await revenue_generator.get_revenue_summary(
            tenant_id="test_tenant",
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
        )

        assert result["invoice_count"] == 50
        assert result["total_invoiced"] == 100000
        assert result["total_revenue"] == 80000
        assert result["paid_count"] == 40
        assert result["collection_rate"] == 80.0  # 40/50 * 100

    @pytest.mark.asyncio
    async def test_get_revenue_trend(self, revenue_generator):
        """Test getting revenue trend"""

        # Mock database result with trend data
        mock_result = MagicMock()
        mock_rows = [
            MagicMock(
                period=datetime(2024, 1, 1),
                invoice_count=10,
                total_amount=20000,
                paid_amount=18000,
            ),
            MagicMock(
                period=datetime(2024, 1, 2),
                invoice_count=15,
                total_amount=30000,
                paid_amount=25000,
            ),
        ]
        mock_result.all.return_value = mock_rows

        revenue_generator.db.execute = AsyncMock(return_value=mock_result)

        result = await revenue_generator.get_revenue_trend(
            tenant_id="test_tenant",
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            group_by="day",
        )

        assert len(result) == 2
        assert result[0]["invoice_count"] == 10
        assert result[0]["total_amount"] == 20000
        assert result[1]["invoice_count"] == 15
        assert result[1]["total_amount"] == 30000


@pytest.mark.integration
class TestCustomerReportGenerator:
    """Test customer report generator"""

    @pytest.fixture
    def customer_generator(self, mock_db):
        """Customer report generator with mocked database"""
        return CustomerReportGenerator(mock_db)

    @pytest.mark.asyncio
    async def test_get_customer_metrics(self, customer_generator):
        """Test getting customer metrics"""

        # Mock database result
        mock_result = MagicMock()
        mock_row = MagicMock()
        mock_row.active_customers = 150
        mock_result.one.return_value = mock_row

        customer_generator.db.execute = AsyncMock(return_value=mock_result)

        result = await customer_generator.get_customer_metrics(
            tenant_id="test_tenant",
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
        )

        assert result["active_customers"] == 150
        assert result["new_customers"] == 150  # Placeholder in current implementation


@pytest.mark.integration
class TestAgingReportGenerator:
    """Test aging report generator"""

    @pytest.fixture
    def aging_generator(self, mock_db):
        """Aging report generator with mocked database"""
        return AgingReportGenerator(mock_db)

    @pytest.mark.asyncio
    async def test_get_aging_summary(self, aging_generator):
        """Test getting aging summary"""

        # Mock database result with aging buckets
        mock_result = MagicMock()
        mock_row = MagicMock()
        mock_row.invoice_count = 25
        mock_row.total_outstanding = 50000
        mock_row.current = 20000
        mock_row.days_1_30 = 15000
        mock_row.days_31_60 = 10000
        mock_row.days_61_90 = 3000
        mock_row.over_90_days = 2000
        mock_result.one.return_value = mock_row

        aging_generator.db.execute = AsyncMock(return_value=mock_result)

        result = await aging_generator.get_aging_summary("test_tenant")

        assert result["invoice_count"] == 25
        assert result["total_outstanding"] == 50000
        assert result["overdue_amount"] == 30000  # Sum of overdue buckets

        buckets = result["buckets"]
        assert buckets["current"] == 20000
        assert buckets["1_30_days"] == 15000
        assert buckets["31_60_days"] == 10000
        assert buckets["61_90_days"] == 3000
        assert buckets["over_90_days"] == 2000
