"""
ISP Internet Plan Validator

Comprehensive validation and testing logic for internet service plans.
Tests plan configurations against various usage scenarios.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any

from .models import (
    DataUnit,
    InternetServicePlan,
    ThrottlePolicy,
)
from .schemas import PlanValidationRequest, PlanValidationResponse, ValidationResult


class PlanValidator:
    """Validates internet service plan configurations."""

    def __init__(self, plan: InternetServicePlan):
        self.plan = plan
        self.validation_results: list[ValidationResult] = []

    def validate(self, request: PlanValidationRequest) -> PlanValidationResponse:
        """
        Perform comprehensive validation of the plan.

        Tests:
        - Speed configuration consistency
        - Data cap logic and calculations
        - Pricing accuracy
        - Time-based restriction logic
        - QoS settings
        - Usage simulations
        """
        self.validation_results = []

        # Run validation checks
        if request.validate_speeds:
            self._validate_speeds()

        if request.validate_data_caps:
            self._validate_data_caps()

        if request.validate_pricing:
            self._validate_pricing()

        if request.validate_time_restrictions:
            self._validate_time_restrictions()

        if request.validate_qos:
            self._validate_qos()

        # Run usage simulation
        simulation_results = self._simulate_usage(
            download_gb=request.test_download_usage_gb,
            upload_gb=request.test_upload_usage_gb,
            duration_hours=request.test_duration_hours,
            concurrent_users=request.test_concurrent_users,
        )

        # Calculate summary
        total_checks = len(self.validation_results)
        passed_checks = sum(
            1 for r in self.validation_results if r.passed and r.severity != "warning"
        )
        failed_checks = sum(
            1 for r in self.validation_results if not r.passed and r.severity == "error"
        )
        warning_checks = sum(1 for r in self.validation_results if r.severity == "warning")

        overall_status = "passed"
        if failed_checks > 0:
            overall_status = "failed"
        elif warning_checks > 0:
            overall_status = "warning"

        return PlanValidationResponse(
            plan_id=self.plan.id,
            plan_code=self.plan.plan_code,
            overall_status=overall_status,
            total_checks=total_checks,
            passed_checks=passed_checks,
            failed_checks=failed_checks,
            warning_checks=warning_checks,
            results=self.validation_results,
            **simulation_results,
            validated_at=datetime.utcnow(),
        )

    def _add_result(
        self,
        check_name: str,
        passed: bool,
        severity: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Add a validation result."""
        self.validation_results.append(
            ValidationResult(
                check_name=check_name,
                passed=passed,
                severity=severity,
                message=message,
                details=details or {},
            )
        )

    def _validate_speeds(self) -> None:
        """Validate speed configuration."""
        # Check download speed
        if self.plan.download_speed <= 0:
            self._add_result(
                "speed_download_positive",
                False,
                "error",
                "Download speed must be positive",
                {"download_speed": float(self.plan.download_speed)},
            )
        else:
            self._add_result(
                "speed_download_positive",
                True,
                "info",
                f"Download speed: {self.plan.download_speed} {self.plan.speed_unit}",
                {"download_speed": float(self.plan.download_speed)},
            )

        # Check upload speed
        if self.plan.upload_speed <= 0:
            self._add_result(
                "speed_upload_positive",
                False,
                "error",
                "Upload speed must be positive",
                {"upload_speed": float(self.plan.upload_speed)},
            )
        else:
            self._add_result(
                "speed_upload_positive",
                True,
                "info",
                f"Upload speed: {self.plan.upload_speed} {self.plan.speed_unit}",
                {"upload_speed": float(self.plan.upload_speed)},
            )

        # Check upload/download ratio
        if self.plan.download_speed > 0 and self.plan.upload_speed > 0:
            ratio = self.plan.download_speed / self.plan.upload_speed
            if ratio > 20:
                self._add_result(
                    "speed_ratio_warning",
                    True,
                    "warning",
                    f"Download/upload ratio ({ratio:.1f}:1) is very asymmetric",
                    {"ratio": float(ratio)},
                )
            else:
                self._add_result(
                    "speed_ratio_check",
                    True,
                    "info",
                    f"Download/upload ratio: {ratio:.1f}:1",
                    {"ratio": float(ratio)},
                )

        # Validate burst speeds
        if self.plan.burst_download_speed:
            if self.plan.burst_download_speed <= self.plan.download_speed:
                self._add_result(
                    "burst_speed_higher",
                    False,
                    "error",
                    "Burst download speed must be higher than normal speed",
                    {
                        "burst": float(self.plan.burst_download_speed),
                        "normal": float(self.plan.download_speed),
                    },
                )
            elif not self.plan.burst_duration_seconds:
                self._add_result(
                    "burst_duration_required",
                    False,
                    "error",
                    "Burst duration must be specified when burst speed is enabled",
                )
            else:
                self._add_result(
                    "burst_speed_configured",
                    True,
                    "info",
                    f"Burst speed: {self.plan.burst_download_speed} {self.plan.speed_unit} for {self.plan.burst_duration_seconds}s",
                )

    def _validate_data_caps(self) -> None:
        """Validate data cap configuration."""
        if not self.plan.has_data_cap:
            self._add_result(
                "data_cap_unlimited",
                True,
                "info",
                "Plan has unlimited data",
            )
            return

        # Check data cap amount
        if not self.plan.data_cap_amount or self.plan.data_cap_amount <= 0:
            self._add_result(
                "data_cap_amount_positive",
                False,
                "error",
                "Data cap amount must be positive when data cap is enabled",
            )
            return

        # Check throttle policy consistency
        if self.plan.throttle_policy == ThrottlePolicy.THROTTLE:
            if not self.plan.throttled_download_speed:
                self._add_result(
                    "throttle_speed_required",
                    False,
                    "error",
                    "Throttled speeds must be specified when throttle policy is enabled",
                )
            elif self.plan.throttled_download_speed >= self.plan.download_speed:
                self._add_result(
                    "throttle_speed_lower",
                    False,
                    "error",
                    "Throttled speed should be lower than normal speed",
                    {
                        "throttled": float(self.plan.throttled_download_speed),
                        "normal": float(self.plan.download_speed),
                    },
                )
            else:
                self._add_result(
                    "throttle_configured",
                    True,
                    "info",
                    f"Throttle to {self.plan.throttled_download_speed} {self.plan.speed_unit} after {self.plan.data_cap_amount} {self.plan.data_cap_unit} cap",
                )

        elif self.plan.throttle_policy == ThrottlePolicy.OVERAGE_CHARGE:
            if not self.plan.overage_price_per_unit or self.plan.overage_price_per_unit <= 0:
                self._add_result(
                    "overage_price_required",
                    False,
                    "error",
                    "Overage price must be specified for overage charge policy",
                )
            else:
                self._add_result(
                    "overage_configured",
                    True,
                    "info",
                    f"Overage charges: {self.plan.overage_price_per_unit} per {self.plan.overage_unit}",
                )

        # Validate FUP
        if self.plan.has_fup:
            if not self.plan.fup_threshold or self.plan.fup_threshold <= 0:
                self._add_result(
                    "fup_threshold_required",
                    False,
                    "error",
                    "FUP threshold must be specified when FUP is enabled",
                )
            elif self.plan.has_data_cap and self.plan.fup_threshold >= (
                self.plan.data_cap_amount or 0
            ):
                self._add_result(
                    "fup_below_cap",
                    False,
                    "error",
                    "FUP threshold should be below data cap",
                )
            else:
                self._add_result(
                    "fup_configured",
                    True,
                    "info",
                    f"FUP triggers at {self.plan.fup_threshold} {self.plan.fup_threshold_unit}",
                )

    def _validate_pricing(self) -> None:
        """Validate pricing configuration."""
        if self.plan.monthly_price < 0:
            self._add_result(
                "price_non_negative",
                False,
                "error",
                "Monthly price cannot be negative",
                {"monthly_price": float(self.plan.monthly_price)},
            )
        elif self.plan.monthly_price == 0:
            self._add_result(
                "price_zero_warning",
                True,
                "warning",
                "Monthly price is zero - is this intentional?",
            )
        else:
            self._add_result(
                "price_configured",
                True,
                "info",
                f"Monthly price: {self.plan.monthly_price} {self.plan.currency}",
            )

        # Check price per Mbps
        speed_mbps = self.plan.get_speed_mbps(download=True)
        if speed_mbps > 0:
            price_per_mbps = self.plan.monthly_price / speed_mbps
            self._add_result(
                "price_per_mbps",
                True,
                "info",
                f"Price per Mbps: {price_per_mbps:.2f} {self.plan.currency}",
                {"price_per_mbps": float(price_per_mbps)},
            )

        # Check setup fee
        if self.plan.setup_fee > self.plan.monthly_price * 3:
            self._add_result(
                "setup_fee_high",
                True,
                "warning",
                "Setup fee is very high compared to monthly price",
                {
                    "setup_fee": float(self.plan.setup_fee),
                    "monthly_price": float(self.plan.monthly_price),
                },
            )

    def _validate_time_restrictions(self) -> None:
        """Validate time-based restrictions."""
        if not self.plan.has_time_restrictions:
            self._add_result(
                "time_restrictions_disabled",
                True,
                "info",
                "No time-based restrictions configured",
            )
            return

        if not self.plan.unrestricted_start_time or not self.plan.unrestricted_end_time:
            self._add_result(
                "time_range_required",
                False,
                "error",
                "Start and end times must be specified for time restrictions",
            )
            return

        # Check time range validity
        start = self.plan.unrestricted_start_time
        end = self.plan.unrestricted_end_time

        self._add_result(
            "time_range_configured",
            True,
            "info",
            f"Unrestricted period: {start} to {end}",
            {
                "start": str(start),
                "end": str(end),
                "unlimited_data": self.plan.unrestricted_data_unlimited,
            },
        )

    def _validate_qos(self) -> None:
        """Validate QoS settings."""
        if self.plan.qos_priority < 0 or self.plan.qos_priority > 100:
            self._add_result(
                "qos_priority_range",
                False,
                "error",
                "QoS priority must be between 0 and 100",
                {"qos_priority": self.plan.qos_priority},
            )
        else:
            priority_level = (
                "high"
                if self.plan.qos_priority >= 70
                else "medium"
                if self.plan.qos_priority >= 40
                else "low"
            )
            self._add_result(
                "qos_configured",
                True,
                "info",
                f"QoS priority: {self.plan.qos_priority} ({priority_level})",
                {"qos_priority": self.plan.qos_priority},
            )

    def _simulate_usage(
        self,
        download_gb: Decimal,
        upload_gb: Decimal,
        duration_hours: int,
        concurrent_users: int,
    ) -> dict[str, Any]:
        """
        Simulate usage scenario and calculate costs/performance.
        """
        total_usage_gb = download_gb + upload_gb

        # Calculate if data cap is exceeded
        data_cap_exceeded = False
        if self.plan.has_data_cap and self.plan.data_cap_amount:
            cap_gb = self.plan.get_data_cap_gb() or Decimal("999999")
            data_cap_exceeded = total_usage_gb > cap_gb

        # Calculate overage costs
        estimated_overage_cost = Decimal("0.00")
        if data_cap_exceeded and self.plan.throttle_policy == ThrottlePolicy.OVERAGE_CHARGE:
            if self.plan.overage_price_per_unit and self.plan.data_cap_amount:
                overage_gb = total_usage_gb - (self.plan.get_data_cap_gb() or Decimal("0"))
                # Convert to overage unit
                if self.plan.overage_unit == DataUnit.GB:
                    estimated_overage_cost = overage_gb * self.plan.overage_price_per_unit
                elif self.plan.overage_unit == DataUnit.TB:
                    estimated_overage_cost = (overage_gb / 1024) * self.plan.overage_price_per_unit

        # Calculate throttling
        throttling_triggered = (
            data_cap_exceeded and self.plan.throttle_policy == ThrottlePolicy.THROTTLE
        )

        # Estimate speeds
        average_download_speed = self.plan.get_speed_mbps(download=True)
        average_upload_speed = self.plan.get_speed_mbps(download=False)

        if throttling_triggered:
            # Assume throttling for half the month after cap
            average_download_speed = (
                average_download_speed + (self.plan.throttled_download_speed or Decimal("0"))
            ) / 2

        # Peak speeds with burst
        peak_download_speed = self.plan.burst_download_speed or self.plan.get_speed_mbps(
            download=True
        )
        peak_upload_speed = self.plan.burst_upload_speed or self.plan.get_speed_mbps(download=False)

        # Account for concurrent users
        if concurrent_users > 1:
            average_download_speed = average_download_speed / concurrent_users
            average_upload_speed = average_upload_speed / concurrent_users

        # Total cost
        estimated_monthly_cost = self.plan.monthly_price

        return {
            "estimated_monthly_cost": estimated_monthly_cost,
            "estimated_overage_cost": estimated_overage_cost,
            "data_cap_exceeded": data_cap_exceeded,
            "throttling_triggered": throttling_triggered,
            "average_download_speed_mbps": average_download_speed,
            "average_upload_speed_mbps": average_upload_speed,
            "peak_download_speed_mbps": peak_download_speed,
            "peak_upload_speed_mbps": peak_upload_speed,
        }
