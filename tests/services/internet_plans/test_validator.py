"""
Unit tests for Internet Service Plan Validator

Tests the comprehensive validation logic for service plan configurations.
"""

import pytest
from datetime import time
from decimal import Decimal
from uuid import uuid4

from dotmac.platform.services.internet_plans.models import (
    InternetServicePlan,
    SpeedUnit,
    DataUnit,
    PlanType,
    PlanStatus,
    ThrottlePolicy,
    BillingCycle,
)
from dotmac.platform.services.internet_plans.schemas import PlanValidationRequest
from dotmac.platform.services.internet_plans.validator import PlanValidator


@pytest.fixture
def basic_plan():
    """Create a basic valid plan for testing."""
    return InternetServicePlan(
        id=uuid4(),
        tenant_id=uuid4(),
        plan_code="BASIC-100",
        name="Basic 100Mbps",
        description="Basic internet plan",
        plan_type=PlanType.RESIDENTIAL,
        status=PlanStatus.ACTIVE,
        download_speed=Decimal("100"),
        upload_speed=Decimal("50"),
        speed_unit=SpeedUnit.MBPS,
        has_data_cap=False,
        throttle_policy=ThrottlePolicy.NO_THROTTLE,
        has_fup=False,
        has_time_restrictions=False,
        qos_priority=50,
        traffic_shaping_enabled=False,
        monthly_price=Decimal("50.00"),
        setup_fee=Decimal("25.00"),
        currency="USD",
        billing_cycle=BillingCycle.MONTHLY,
        is_public=True,
        is_promotional=False,
        minimum_contract_months=12,
        early_termination_fee=Decimal("100.00"),
        contention_ratio="1:20",
        ipv4_included=True,
        ipv6_included=True,
        static_ip_included=False,
        static_ip_count=0,
        router_included=False,
        installation_included=False,
        technical_support_level="basic",
        tags={},
        features=[],
        restrictions=[],
        validation_errors=[],
    )


class TestPlanValidatorSpeedValidation:
    """Test speed configuration validation."""

    def test_valid_speeds(self, basic_plan):
        """Test validation passes for valid speeds."""
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            validate_speeds=True,
            validate_data_caps=False,
            validate_pricing=False,
            validate_time_restrictions=False,
            validate_qos=False,
            test_download_usage_gb=Decimal("100"),
            test_upload_usage_gb=Decimal("50"),
            test_duration_hours=720,
            test_concurrent_users=1,
        )

        result = validator.validate(request)

        assert result.overall_status in ["passed", "info"]
        assert result.failed_checks == 0
        # Should have speed checks
        assert any(r.check_name == "speed_download_positive" for r in result.results)
        assert any(r.check_name == "speed_upload_positive" for r in result.results)

    def test_negative_download_speed(self, basic_plan):
        """Test validation fails for negative download speed."""
        basic_plan.download_speed = Decimal("-10")
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            validate_speeds=True,
            validate_data_caps=False,
            validate_pricing=False,
            validate_time_restrictions=False,
            validate_qos=False,
        )

        result = validator.validate(request)

        assert result.overall_status == "failed"
        assert result.failed_checks > 0
        assert any(
            r.check_name == "speed_download_positive" and not r.passed
            for r in result.results
        )

    def test_asymmetric_speed_ratio_warning(self, basic_plan):
        """Test warning for very asymmetric upload/download ratio."""
        basic_plan.download_speed = Decimal("1000")
        basic_plan.upload_speed = Decimal("10")  # 100:1 ratio
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=True, validate_data_caps=False)

        result = validator.validate(request)

        # Should pass but with warnings
        assert result.warning_checks > 0
        assert any(
            r.check_name == "speed_ratio_warning" and r.severity == "warning"
            for r in result.results
        )

    def test_burst_speed_validation(self, basic_plan):
        """Test burst speed configuration validation."""
        basic_plan.burst_download_speed = Decimal("200")
        basic_plan.burst_upload_speed = Decimal("100")
        basic_plan.burst_duration_seconds = 60
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=True, validate_data_caps=False)

        result = validator.validate(request)

        assert result.overall_status in ["passed", "info"]
        assert any(
            r.check_name == "burst_speed_configured" and r.passed
            for r in result.results
        )

    def test_burst_speed_lower_than_normal_fails(self, basic_plan):
        """Test burst speed must be higher than normal speed."""
        basic_plan.burst_download_speed = Decimal("50")  # Lower than normal 100
        basic_plan.burst_duration_seconds = 60
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=True, validate_data_caps=False)

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "burst_speed_higher" and not r.passed
            for r in result.results
        )

    def test_burst_speed_without_duration_fails(self, basic_plan):
        """Test burst speed requires duration."""
        basic_plan.burst_download_speed = Decimal("200")
        basic_plan.burst_duration_seconds = None
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=True, validate_data_caps=False)

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "burst_duration_required" and not r.passed
            for r in result.results
        )


class TestPlanValidatorDataCapValidation:
    """Test data cap and throttle policy validation."""

    def test_unlimited_plan(self, basic_plan):
        """Test unlimited plan validation."""
        basic_plan.has_data_cap = False
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_data_caps=True)

        result = validator.validate(request)

        assert result.overall_status in ["passed", "info"]
        assert any(
            r.check_name == "data_cap_unlimited" and r.passed
            for r in result.results
        )

    def test_data_cap_without_amount_fails(self, basic_plan):
        """Test data cap enabled without amount fails."""
        basic_plan.has_data_cap = True
        basic_plan.data_cap_amount = None
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_data_caps=True)

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "data_cap_amount_positive" and not r.passed
            for r in result.results
        )

    def test_throttle_policy_requires_throttled_speed(self, basic_plan):
        """Test throttle policy requires throttled speeds."""
        basic_plan.has_data_cap = True
        basic_plan.data_cap_amount = Decimal("500")
        basic_plan.data_cap_unit = DataUnit.GB
        basic_plan.throttle_policy = ThrottlePolicy.THROTTLE
        basic_plan.throttled_download_speed = None
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_data_caps=True)

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "throttle_speed_required" and not r.passed
            for r in result.results
        )

    def test_throttled_speed_must_be_lower(self, basic_plan):
        """Test throttled speed must be lower than normal speed."""
        basic_plan.has_data_cap = True
        basic_plan.data_cap_amount = Decimal("500")
        basic_plan.data_cap_unit = DataUnit.GB
        basic_plan.throttle_policy = ThrottlePolicy.THROTTLE
        basic_plan.throttled_download_speed = Decimal("150")  # Higher than normal 100
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_data_caps=True)

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "throttle_speed_lower" and not r.passed
            for r in result.results
        )

    def test_valid_throttle_configuration(self, basic_plan):
        """Test valid throttle configuration."""
        basic_plan.has_data_cap = True
        basic_plan.data_cap_amount = Decimal("500")
        basic_plan.data_cap_unit = DataUnit.GB
        basic_plan.throttle_policy = ThrottlePolicy.THROTTLE
        basic_plan.throttled_download_speed = Decimal("10")
        basic_plan.throttled_upload_speed = Decimal("5")
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_data_caps=True)

        result = validator.validate(request)

        assert result.overall_status in ["passed", "info"]
        assert any(
            r.check_name == "throttle_configured" and r.passed
            for r in result.results
        )

    def test_overage_charge_requires_price(self, basic_plan):
        """Test overage charge policy requires price."""
        basic_plan.has_data_cap = True
        basic_plan.data_cap_amount = Decimal("500")
        basic_plan.data_cap_unit = DataUnit.GB
        basic_plan.throttle_policy = ThrottlePolicy.OVERAGE_CHARGE
        basic_plan.overage_price_per_unit = None
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_data_caps=True)

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "overage_price_required" and not r.passed
            for r in result.results
        )

    def test_valid_overage_configuration(self, basic_plan):
        """Test valid overage charge configuration."""
        basic_plan.has_data_cap = True
        basic_plan.data_cap_amount = Decimal("500")
        basic_plan.data_cap_unit = DataUnit.GB
        basic_plan.throttle_policy = ThrottlePolicy.OVERAGE_CHARGE
        basic_plan.overage_price_per_unit = Decimal("5.00")
        basic_plan.overage_unit = DataUnit.GB
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_data_caps=True)

        result = validator.validate(request)

        assert result.overall_status in ["passed", "info"]
        assert any(
            r.check_name == "overage_configured" and r.passed
            for r in result.results
        )

    def test_fup_requires_threshold(self, basic_plan):
        """Test FUP enabled requires threshold."""
        basic_plan.has_data_cap = True  # FUP validation only runs when data cap enabled
        basic_plan.data_cap_amount = Decimal("500")
        basic_plan.data_cap_unit = DataUnit.GB
        basic_plan.has_fup = True
        basic_plan.fup_threshold = None
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_data_caps=True)

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "fup_threshold_required" and not r.passed
            for r in result.results
        )

    def test_fup_threshold_below_data_cap(self, basic_plan):
        """Test FUP threshold must be below data cap."""
        basic_plan.has_data_cap = True
        basic_plan.data_cap_amount = Decimal("500")
        basic_plan.data_cap_unit = DataUnit.GB
        basic_plan.has_fup = True
        basic_plan.fup_threshold = Decimal("600")  # Above cap
        basic_plan.fup_threshold_unit = DataUnit.GB
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_data_caps=True)

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "fup_below_cap" and not r.passed
            for r in result.results
        )


class TestPlanValidatorPricingValidation:
    """Test pricing validation."""

    def test_valid_pricing(self, basic_plan):
        """Test valid pricing configuration."""
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_pricing=True)

        result = validator.validate(request)

        assert result.overall_status in ["passed", "info", "warning"]
        assert any(
            r.check_name == "price_configured" and r.passed
            for r in result.results
        )

    def test_negative_price_fails(self, basic_plan):
        """Test negative monthly price fails."""
        basic_plan.monthly_price = Decimal("-10.00")
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_pricing=True)

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "price_non_negative" and not r.passed
            for r in result.results
        )

    def test_zero_price_warning(self, basic_plan):
        """Test zero price triggers warning."""
        basic_plan.monthly_price = Decimal("0.00")
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_pricing=True)

        result = validator.validate(request)

        assert result.warning_checks > 0
        assert any(
            r.check_name == "price_zero_warning" and r.severity == "warning"
            for r in result.results
        )

    def test_price_per_mbps_calculation(self, basic_plan):
        """Test price per Mbps is calculated."""
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_pricing=True)

        result = validator.validate(request)

        assert any(
            r.check_name == "price_per_mbps" and r.passed
            for r in result.results
        )
        # Find the result and check details
        price_per_mbps_result = next(
            r for r in result.results if r.check_name == "price_per_mbps"
        )
        assert "price_per_mbps" in price_per_mbps_result.details
        # 50.00 / 100 Mbps = 0.50
        assert abs(price_per_mbps_result.details["price_per_mbps"] - 0.50) < 0.01

    def test_high_setup_fee_warning(self, basic_plan):
        """Test warning for very high setup fee."""
        basic_plan.setup_fee = Decimal("200.00")  # 4x monthly price
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_pricing=True)

        result = validator.validate(request)

        assert result.warning_checks > 0
        assert any(
            r.check_name == "setup_fee_high" and r.severity == "warning"
            for r in result.results
        )


class TestPlanValidatorTimeRestrictionsValidation:
    """Test time-based restrictions validation."""

    def test_no_time_restrictions(self, basic_plan):
        """Test plan without time restrictions."""
        basic_plan.has_time_restrictions = False
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            validate_speeds=False, validate_time_restrictions=True
        )

        result = validator.validate(request)

        assert result.overall_status in ["passed", "info"]
        assert any(
            r.check_name == "time_restrictions_disabled" and r.passed
            for r in result.results
        )

    def test_time_restrictions_require_times(self, basic_plan):
        """Test time restrictions require start and end times."""
        basic_plan.has_time_restrictions = True
        basic_plan.unrestricted_start_time = None
        basic_plan.unrestricted_end_time = None
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            validate_speeds=False, validate_time_restrictions=True
        )

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "time_range_required" and not r.passed
            for r in result.results
        )

    def test_valid_time_restrictions(self, basic_plan):
        """Test valid time restrictions configuration."""
        basic_plan.has_time_restrictions = True
        basic_plan.unrestricted_start_time = time(22, 0)  # 10 PM
        basic_plan.unrestricted_end_time = time(6, 0)  # 6 AM
        basic_plan.unrestricted_data_unlimited = True
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            validate_speeds=False, validate_time_restrictions=True
        )

        result = validator.validate(request)

        assert result.overall_status in ["passed", "info"]
        assert any(
            r.check_name == "time_range_configured" and r.passed
            for r in result.results
        )


class TestPlanValidatorQoSValidation:
    """Test QoS settings validation."""

    def test_valid_qos_priority(self, basic_plan):
        """Test valid QoS priority."""
        basic_plan.qos_priority = 50
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_qos=True)

        result = validator.validate(request)

        assert result.overall_status in ["passed", "info"]
        assert any(
            r.check_name == "qos_configured" and r.passed
            for r in result.results
        )

    def test_qos_priority_below_range_fails(self, basic_plan):
        """Test QoS priority below 0 fails."""
        basic_plan.qos_priority = -10
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_qos=True)

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "qos_priority_range" and not r.passed
            for r in result.results
        )

    def test_qos_priority_above_range_fails(self, basic_plan):
        """Test QoS priority above 100 fails."""
        basic_plan.qos_priority = 150
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_qos=True)

        result = validator.validate(request)

        assert result.failed_checks > 0
        assert any(
            r.check_name == "qos_priority_range" and not r.passed
            for r in result.results
        )

    def test_qos_priority_levels(self, basic_plan):
        """Test QoS priority level classification."""
        # Test high priority
        basic_plan.qos_priority = 80
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(validate_speeds=False, validate_qos=True)
        result = validator.validate(request)
        qos_result = next(r for r in result.results if r.check_name == "qos_configured")
        assert "high" in qos_result.message.lower()

        # Test medium priority
        basic_plan.qos_priority = 50
        validator = PlanValidator(basic_plan)
        result = validator.validate(request)
        qos_result = next(r for r in result.results if r.check_name == "qos_configured")
        assert "medium" in qos_result.message.lower()

        # Test low priority
        basic_plan.qos_priority = 20
        validator = PlanValidator(basic_plan)
        result = validator.validate(request)
        qos_result = next(r for r in result.results if r.check_name == "qos_configured")
        assert "low" in qos_result.message.lower()


class TestPlanValidatorUsageSimulation:
    """Test usage simulation calculations."""

    def test_basic_usage_simulation(self, basic_plan):
        """Test basic usage simulation."""
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            validate_speeds=False,
            validate_data_caps=False,
            test_download_usage_gb=Decimal("100"),
            test_upload_usage_gb=Decimal("50"),
            test_duration_hours=720,  # 30 days
            test_concurrent_users=1,
        )

        result = validator.validate(request)

        assert result.estimated_monthly_cost == basic_plan.monthly_price
        assert result.estimated_overage_cost == Decimal("0.00")
        assert not result.data_cap_exceeded
        assert not result.throttling_triggered
        assert result.average_download_speed_mbps == Decimal("100")
        assert result.average_upload_speed_mbps == Decimal("50")

    def test_data_cap_exceeded_simulation(self, basic_plan):
        """Test simulation with data cap exceeded."""
        basic_plan.has_data_cap = True
        basic_plan.data_cap_amount = Decimal("100")
        basic_plan.data_cap_unit = DataUnit.GB
        basic_plan.throttle_policy = ThrottlePolicy.THROTTLE
        basic_plan.throttled_download_speed = Decimal("10")

        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            test_download_usage_gb=Decimal("150"),  # Exceeds cap
            test_upload_usage_gb=Decimal("50"),
        )

        result = validator.validate(request)

        assert result.data_cap_exceeded
        assert result.throttling_triggered

    def test_overage_cost_calculation(self, basic_plan):
        """Test overage cost calculation."""
        basic_plan.has_data_cap = True
        basic_plan.data_cap_amount = Decimal("100")
        basic_plan.data_cap_unit = DataUnit.GB
        basic_plan.throttle_policy = ThrottlePolicy.OVERAGE_CHARGE
        basic_plan.overage_price_per_unit = Decimal("5.00")
        basic_plan.overage_unit = DataUnit.GB

        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            test_download_usage_gb=Decimal("120"),  # 20 GB overage
            test_upload_usage_gb=Decimal("30"),
        )

        result = validator.validate(request)

        assert result.data_cap_exceeded
        # 120 + 30 = 150 GB total, cap is 100 GB, so 50 GB overage
        # 50 GB * $5.00/GB = $250.00
        assert result.estimated_overage_cost == Decimal("250.00")

    def test_concurrent_users_impact(self, basic_plan):
        """Test concurrent users reduce available speed."""
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            test_download_usage_gb=Decimal("100"),
            test_upload_usage_gb=Decimal("50"),
            test_concurrent_users=4,
        )

        result = validator.validate(request)

        # Speed should be divided by number of users
        assert result.average_download_speed_mbps == Decimal("25")  # 100/4
        assert result.average_upload_speed_mbps == Decimal("12.5")  # 50/4

    def test_burst_speed_in_simulation(self, basic_plan):
        """Test burst speeds are considered in peak speeds."""
        basic_plan.burst_download_speed = Decimal("200")
        basic_plan.burst_upload_speed = Decimal("100")
        basic_plan.burst_duration_seconds = 60

        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            test_download_usage_gb=Decimal("100"),
            test_upload_usage_gb=Decimal("50"),
        )

        result = validator.validate(request)

        assert result.peak_download_speed_mbps == Decimal("200")
        assert result.peak_upload_speed_mbps == Decimal("100")


class TestPlanValidatorComprehensive:
    """Test comprehensive validation with all checks enabled."""

    def test_full_validation_valid_plan(self, basic_plan):
        """Test full validation on a valid plan."""
        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            validate_speeds=True,
            validate_data_caps=True,
            validate_pricing=True,
            validate_time_restrictions=True,
            validate_qos=True,
            test_download_usage_gb=Decimal("100"),
            test_upload_usage_gb=Decimal("50"),
            test_duration_hours=720,
            test_concurrent_users=1,
        )

        result = validator.validate(request)

        assert result.plan_id == basic_plan.id
        assert result.plan_code == basic_plan.plan_code
        assert result.overall_status in ["passed", "info"]
        assert result.failed_checks == 0
        assert result.total_checks > 0
        assert result.validated_at is not None

    def test_full_validation_invalid_plan(self, basic_plan):
        """Test full validation on an invalid plan."""
        # Make plan invalid
        basic_plan.download_speed = Decimal("-10")
        basic_plan.monthly_price = Decimal("-50")
        basic_plan.qos_priority = 150

        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            validate_speeds=True,
            validate_data_caps=True,
            validate_pricing=True,
            validate_time_restrictions=True,
            validate_qos=True,
        )

        result = validator.validate(request)

        assert result.overall_status == "failed"
        assert result.failed_checks >= 3  # At least 3 errors
        assert result.passed_checks >= 0

    def test_validation_summary_counts(self, basic_plan):
        """Test validation result counts are accurate."""
        # Add warnings
        basic_plan.monthly_price = Decimal("0.00")  # Zero price warning
        basic_plan.setup_fee = Decimal("200.00")  # High setup fee warning

        validator = PlanValidator(basic_plan)
        request = PlanValidationRequest(
            validate_speeds=True,
            validate_pricing=True,
            validate_qos=True,
        )

        result = validator.validate(request)

        # Verify counts add up
        assert result.total_checks == len(result.results)
        # Note: passed_checks counts non-error items (including warnings)
        assert result.warning_checks >= 2  # At least 2 warnings
        assert result.overall_status == "warning"  # Warnings but no errors
        assert result.failed_checks == 0  # No errors
