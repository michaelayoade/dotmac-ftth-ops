"""
Comprehensive tests for billing reports models and enums.

Tests report types, periods, and data structures.
"""

from datetime import UTC, datetime

import pytest

from dotmac.platform.billing.reports.service import (
    BillingReportService,
    ReportPeriod,
    ReportType,
)


@pytest.mark.unit
class TestReportTypeEnum:
    """Test ReportType enum."""

    def test_report_type_values(self):
        """Test ReportType enum has expected values."""
        assert ReportType.REVENUE.value == "revenue"
        assert ReportType.CUSTOMER.value == "customer"
        assert ReportType.AGING.value == "aging"
        assert ReportType.TAX.value == "tax"
        assert ReportType.SUMMARY.value == "summary"
        assert ReportType.DETAILED_TRANSACTIONS.value == "detailed_transactions"
        assert ReportType.PAYMENT_METHODS.value == "payment_methods"
        assert ReportType.REFUNDS.value == "refunds"

    def test_report_type_enum_members(self):
        """Test ReportType has all expected members."""
        expected_types = {
            "REVENUE",
            "CUSTOMER",
            "AGING",
            "TAX",
            "SUMMARY",
            "DETAILED_TRANSACTIONS",
            "PAYMENT_METHODS",
            "REFUNDS",
        }
        actual_types = set(ReportType.__members__.keys())
        assert actual_types == expected_types

    def test_report_type_iteration(self):
        """Test iterating over ReportType enum."""
        report_types = list(ReportType)
        assert len(report_types) == 8
        assert ReportType.REVENUE in report_types
        assert ReportType.CUSTOMER in report_types


@pytest.mark.unit
class TestReportPeriodEnum:
    """Test ReportPeriod enum."""

    def test_report_period_values(self):
        """Test ReportPeriod enum has expected values."""
        assert ReportPeriod.TODAY.value == "today"
        assert ReportPeriod.YESTERDAY.value == "yesterday"
        assert ReportPeriod.THIS_WEEK.value == "this_week"
        assert ReportPeriod.LAST_WEEK.value == "last_week"
        assert ReportPeriod.THIS_MONTH.value == "this_month"
        assert ReportPeriod.LAST_MONTH.value == "last_month"
        assert ReportPeriod.THIS_QUARTER.value == "this_quarter"
        assert ReportPeriod.LAST_QUARTER.value == "last_quarter"
        assert ReportPeriod.THIS_YEAR.value == "this_year"
        assert ReportPeriod.LAST_YEAR.value == "last_year"
        assert ReportPeriod.CUSTOM.value == "custom"

    def test_report_period_enum_members(self):
        """Test ReportPeriod has all expected members."""
        expected_periods = {
            "TODAY",
            "YESTERDAY",
            "THIS_WEEK",
            "LAST_WEEK",
            "THIS_MONTH",
            "LAST_MONTH",
            "THIS_QUARTER",
            "LAST_QUARTER",
            "THIS_YEAR",
            "LAST_YEAR",
            "CUSTOM",
        }
        actual_periods = set(ReportPeriod.__members__.keys())
        assert actual_periods == expected_periods

    def test_report_period_iteration(self):
        """Test iterating over ReportPeriod enum."""
        periods = list(ReportPeriod)
        assert len(periods) == 11
        assert ReportPeriod.THIS_MONTH in periods
        assert ReportPeriod.CUSTOM in periods


@pytest.mark.unit
class TestDateRangeCalculation:
    """Test date range calculation utility methods."""

    def test_calculate_date_range_today(self):
        """Test calculating date range for TODAY period."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start, end = service._calculate_date_range(ReportPeriod.TODAY)

        # Should be from start of today to now
        assert start.hour == 0
        assert start.minute == 0
        assert start.second == 0
        assert end > start
        assert (end - start).days == 0

    def test_calculate_date_range_yesterday(self):
        """Test calculating date range for YESTERDAY period."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start, end = service._calculate_date_range(ReportPeriod.YESTERDAY)

        # Should be exactly 24 hours
        assert (end - start).days == 1
        assert start.hour == 0
        assert end.hour == 0

    def test_calculate_date_range_this_week(self):
        """Test calculating date range for THIS_WEEK period."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start, end = service._calculate_date_range(ReportPeriod.THIS_WEEK)

        # Start should be Monday of current week
        assert start.weekday() == 0  # Monday
        assert end > start

    def test_calculate_date_range_last_week(self):
        """Test calculating date range for LAST_WEEK period."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start, end = service._calculate_date_range(ReportPeriod.LAST_WEEK)

        # Should be exactly 7 days
        assert (end - start).days == 7
        assert start.weekday() == 0  # Monday

    def test_calculate_date_range_this_month(self):
        """Test calculating date range for THIS_MONTH period."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start, end = service._calculate_date_range(ReportPeriod.THIS_MONTH)

        # Start should be first day of current month
        assert start.day == 1
        assert start.hour == 0
        assert end > start

    def test_calculate_date_range_last_month(self):
        """Test calculating date range for LAST_MONTH period."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start, end = service._calculate_date_range(ReportPeriod.LAST_MONTH)

        # Start should be first day of last month
        assert start.day == 1
        assert end.day == 1
        assert end > start

    def test_calculate_date_range_this_quarter(self):
        """Test calculating date range for THIS_QUARTER period."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start, end = service._calculate_date_range(ReportPeriod.THIS_QUARTER)

        # Start should be first day of quarter
        assert start.day == 1
        assert start.month in [1, 4, 7, 10]  # Quarter starts
        assert end > start

    def test_calculate_date_range_last_quarter(self):
        """Test calculating date range for LAST_QUARTER period."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start, end = service._calculate_date_range(ReportPeriod.LAST_QUARTER)

        # Start should be first day of last quarter
        assert start.day == 1
        assert start.month in [1, 4, 7, 10]  # Quarter starts
        assert end > start
        # Should be approximately 3 months
        assert 80 <= (end - start).days <= 95

    def test_calculate_date_range_this_year(self):
        """Test calculating date range for THIS_YEAR period."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start, end = service._calculate_date_range(ReportPeriod.THIS_YEAR)

        # Start should be January 1st of current year
        assert start.month == 1
        assert start.day == 1
        assert start.hour == 0
        assert end > start

    def test_calculate_date_range_last_year(self):
        """Test calculating date range for LAST_YEAR period."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start, end = service._calculate_date_range(ReportPeriod.LAST_YEAR)

        # Should be Jan 1 to Dec 31 of last year
        assert start.month == 1
        assert start.day == 1
        assert end.month == 1
        assert end.day == 1
        # Should be approximately 365 days
        assert 364 <= (end - start).days <= 367

    def test_calculate_date_range_custom(self):
        """Test calculating date range for CUSTOM period."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        custom_start = datetime(2024, 1, 1, tzinfo=UTC)
        custom_end = datetime(2024, 3, 31, tzinfo=UTC)

        start, end = service._calculate_date_range(
            ReportPeriod.CUSTOM, custom_start=custom_start, custom_end=custom_end
        )

        assert start == custom_start
        assert end == custom_end

    def test_calculate_date_range_custom_missing_dates_raises_error(self):
        """Test CUSTOM period without dates raises ValueError."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        with pytest.raises(ValueError, match="Custom period requires start and end dates"):
            service._calculate_date_range(ReportPeriod.CUSTOM)

    def test_calculate_date_range_custom_missing_end_date_raises_error(self):
        """Test CUSTOM period without end date raises ValueError."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        with pytest.raises(ValueError, match="Custom period requires start and end dates"):
            service._calculate_date_range(ReportPeriod.CUSTOM, custom_start=datetime.now(UTC))


@pytest.mark.unit
class TestPreviousPeriodCalculation:
    """Test previous period calculation for comparisons."""

    def test_calculate_previous_period_same_length(self):
        """Test calculating previous period with same length."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start = datetime(2024, 3, 1, tzinfo=UTC)
        end = datetime(2024, 3, 31, tzinfo=UTC)

        prev_start, prev_end = service._calculate_previous_period(start, end)

        # Previous period should be same length
        assert (end - start) == (prev_end - prev_start)
        # Previous period should end where current period starts
        assert prev_end == start

    def test_calculate_previous_period_one_month(self):
        """Test calculating previous period for one month."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start = datetime(2024, 3, 1, tzinfo=UTC)
        end = datetime(2024, 4, 1, tzinfo=UTC)

        prev_start, prev_end = service._calculate_previous_period(start, end)

        # Previous period should be same length and end where current starts
        assert (end - start) == (prev_end - prev_start)
        assert prev_end == start
        # Previous start should be approximately February
        assert (
            prev_start.month == 1 or prev_start.month == 2
        )  # Could be late Jan or Feb depending on calculation

    def test_calculate_previous_period_one_week(self):
        """Test calculating previous period for one week."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        start = datetime(2024, 3, 11, tzinfo=UTC)  # Monday
        end = datetime(2024, 3, 18, tzinfo=UTC)  # Monday

        prev_start, prev_end = service._calculate_previous_period(start, end)

        # Should be exactly 7 days before
        assert (end - start).days == 7
        assert (prev_end - prev_start).days == 7
        assert prev_start == datetime(2024, 3, 4, tzinfo=UTC)


@pytest.mark.unit
class TestGrowthRateCalculation:
    """Test growth rate calculation utility."""

    def test_calculate_growth_rate_positive_growth(self):
        """Test calculating positive growth rate."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        growth = service._calculate_growth_rate(150.0, 100.0)

        assert growth == 50.0

    def test_calculate_growth_rate_negative_growth(self):
        """Test calculating negative growth rate."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        growth = service._calculate_growth_rate(75.0, 100.0)

        assert growth == -25.0

    def test_calculate_growth_rate_zero_previous(self):
        """Test growth rate with zero previous value."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        growth = service._calculate_growth_rate(100.0, 0.0)

        assert growth == 100.0

    def test_calculate_growth_rate_both_zero(self):
        """Test growth rate with both values zero."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        growth = service._calculate_growth_rate(0.0, 0.0)

        assert growth == 0.0

    def test_calculate_growth_rate_large_numbers(self):
        """Test growth rate with large numbers."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        growth = service._calculate_growth_rate(1_000_000.0, 500_000.0)

        assert growth == 100.0


@pytest.mark.unit
class TestPercentageCalculation:
    """Test percentage calculation utility."""

    def test_calculate_percentage_half(self):
        """Test calculating 50%."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        percentage = service._calculate_percentage(50.0, 100.0)

        assert percentage == 50.0

    def test_calculate_percentage_zero_whole(self):
        """Test percentage with zero whole."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        percentage = service._calculate_percentage(50.0, 0.0)

        assert percentage == 0.0

    def test_calculate_percentage_zero_part(self):
        """Test percentage with zero part."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        percentage = service._calculate_percentage(0.0, 100.0)

        assert percentage == 0.0

    def test_calculate_percentage_over_100(self):
        """Test percentage over 100%."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        percentage = service._calculate_percentage(150.0, 100.0)

        assert percentage == 150.0

    def test_calculate_percentage_decimal(self):
        """Test percentage with decimal values."""
        from unittest.mock import AsyncMock

        service = BillingReportService(AsyncMock())

        percentage = service._calculate_percentage(33.33, 100.0)

        assert percentage == pytest.approx(33.33, rel=0.01)
