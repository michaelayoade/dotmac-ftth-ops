"""
ISP Internet Service Plan Schemas

Pydantic models for API requests/responses and validation.
"""

from datetime import datetime, time
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import (
    BillingCycle,
    DataUnit,
    PlanStatus,
    PlanType,
    SpeedUnit,
    ThrottlePolicy,
)

# ============================================================================
# Request Models
# ============================================================================


class InternetServicePlanCreate(BaseModel):
    """Create internet service plan request."""

    model_config = ConfigDict(from_attributes=True)

    plan_code: str = Field(..., min_length=1, max_length=50, description="Unique plan code")
    name: str = Field(..., min_length=1, max_length=255, description="Plan name")
    description: str | None = Field(None, max_length=1000)
    plan_type: PlanType
    status: PlanStatus = PlanStatus.DRAFT

    # Speed configuration
    download_speed: Decimal = Field(..., gt=0, description="Download speed")
    upload_speed: Decimal = Field(..., gt=0, description="Upload speed")
    speed_unit: SpeedUnit = SpeedUnit.MBPS

    # Burst speeds
    burst_download_speed: Decimal | None = Field(None, gt=0)
    burst_upload_speed: Decimal | None = Field(None, gt=0)
    burst_duration_seconds: int | None = Field(None, ge=0, le=3600)

    # Data cap
    has_data_cap: bool = False
    data_cap_amount: Decimal | None = Field(None, gt=0)
    data_cap_unit: DataUnit | None = None
    throttle_policy: ThrottlePolicy = ThrottlePolicy.NO_THROTTLE

    # Throttled speeds
    throttled_download_speed: Decimal | None = Field(None, gt=0)
    throttled_upload_speed: Decimal | None = Field(None, gt=0)

    # Overage
    overage_price_per_unit: Decimal | None = Field(None, ge=0)
    overage_unit: DataUnit | None = None

    # FUP
    has_fup: bool = False
    fup_threshold: Decimal | None = Field(None, gt=0)
    fup_threshold_unit: DataUnit | None = None
    fup_throttle_speed: Decimal | None = Field(None, gt=0)

    # Time restrictions
    has_time_restrictions: bool = False
    unrestricted_start_time: time | None = None
    unrestricted_end_time: time | None = None
    unrestricted_data_unlimited: bool = False
    unrestricted_speed_multiplier: Decimal | None = Field(None, gt=0, le=10)

    # QoS
    qos_priority: int = Field(50, ge=0, le=100)
    traffic_shaping_enabled: bool = False

    # Pricing
    monthly_price: Decimal = Field(..., ge=0)
    setup_fee: Decimal = Field(Decimal("0.00"), ge=0)
    currency: str = Field("USD", min_length=3, max_length=3)
    billing_cycle: BillingCycle = BillingCycle.MONTHLY

    # Availability
    is_public: bool = True
    is_promotional: bool = False
    promotion_start_date: datetime | None = None
    promotion_end_date: datetime | None = None

    # Contract
    minimum_contract_months: int = Field(0, ge=0, le=60)
    early_termination_fee: Decimal = Field(Decimal("0.00"), ge=0)

    # Technical specs
    contention_ratio: str | None = Field(None, max_length=20)
    ipv4_included: bool = True
    ipv6_included: bool = True
    static_ip_included: bool = False
    static_ip_count: int = Field(0, ge=0, le=255)

    # Services
    router_included: bool = False
    installation_included: bool = False
    technical_support_level: str | None = Field(None, max_length=50)

    # Metadata
    tags: dict[str, Any] = Field(default_factory=dict)
    features: list[str] = Field(default_factory=list)
    restrictions: list[str] = Field(default_factory=list)

    @field_validator("plan_code")
    @classmethod
    def validate_plan_code(cls, v: str) -> str:
        """Validate and normalize plan code."""
        return v.upper().strip()

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        """Validate currency code."""
        return v.upper()


class InternetServicePlanUpdate(BaseModel):
    """Update internet service plan request."""

    model_config = ConfigDict(from_attributes=True)

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)
    status: PlanStatus | None = None

    download_speed: Decimal | None = Field(None, gt=0)
    upload_speed: Decimal | None = Field(None, gt=0)

    burst_download_speed: Decimal | None = Field(None, gt=0)
    burst_upload_speed: Decimal | None = Field(None, gt=0)
    burst_duration_seconds: int | None = Field(None, ge=0, le=3600)

    has_data_cap: bool | None = None
    data_cap_amount: Decimal | None = Field(None, gt=0)
    data_cap_unit: DataUnit | None = None
    throttle_policy: ThrottlePolicy | None = None

    throttled_download_speed: Decimal | None = Field(None, gt=0)
    throttled_upload_speed: Decimal | None = Field(None, gt=0)

    monthly_price: Decimal | None = Field(None, ge=0)
    setup_fee: Decimal | None = Field(None, ge=0)

    is_public: bool | None = None
    is_promotional: bool | None = None
    promotion_start_date: datetime | None = None
    promotion_end_date: datetime | None = None

    qos_priority: int | None = Field(None, ge=0, le=100)
    traffic_shaping_enabled: bool | None = None

    tags: dict[str, Any] | None = None
    features: list[str] | None = None
    restrictions: list[str] | None = None


# ============================================================================
# Response Models
# ============================================================================


class InternetServicePlanResponse(BaseModel):
    """Internet service plan response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    plan_code: str
    name: str
    description: str | None
    plan_type: PlanType
    status: PlanStatus

    # Speeds
    download_speed: Decimal
    upload_speed: Decimal
    speed_unit: SpeedUnit

    burst_download_speed: Decimal | None
    burst_upload_speed: Decimal | None
    burst_duration_seconds: int | None

    # Data cap
    has_data_cap: bool
    data_cap_amount: Decimal | None
    data_cap_unit: DataUnit | None
    throttle_policy: ThrottlePolicy

    throttled_download_speed: Decimal | None
    throttled_upload_speed: Decimal | None

    overage_price_per_unit: Decimal | None
    overage_unit: DataUnit | None

    # FUP
    has_fup: bool
    fup_threshold: Decimal | None
    fup_threshold_unit: DataUnit | None
    fup_throttle_speed: Decimal | None

    # Time restrictions
    has_time_restrictions: bool
    unrestricted_start_time: time | None
    unrestricted_end_time: time | None
    unrestricted_data_unlimited: bool
    unrestricted_speed_multiplier: Decimal | None

    # QoS
    qos_priority: int
    traffic_shaping_enabled: bool

    # Pricing
    monthly_price: Decimal
    setup_fee: Decimal
    currency: str
    billing_cycle: BillingCycle

    # Availability
    is_public: bool
    is_promotional: bool
    promotion_start_date: datetime | None
    promotion_end_date: datetime | None

    # Contract
    minimum_contract_months: int
    early_termination_fee: Decimal

    # Technical
    contention_ratio: str | None
    ipv4_included: bool
    ipv6_included: bool
    static_ip_included: bool
    static_ip_count: int

    # Services
    router_included: bool
    installation_included: bool
    technical_support_level: str | None

    # Metadata
    tags: dict[str, Any]
    features: list[str]
    restrictions: list[str]

    # Validation
    last_validated_at: datetime | None
    validation_status: str | None
    validation_errors: list[str]

    # Timestamps
    created_at: datetime
    updated_at: datetime | None


class PlanValidationRequest(BaseModel):
    """Request to validate plan configuration."""

    model_config = ConfigDict()

    # Test scenarios
    test_download_usage_gb: Decimal = Field(
        default=Decimal("100"), gt=0, description="Download usage to simulate (GB)"
    )
    test_upload_usage_gb: Decimal = Field(
        default=Decimal("10"), gt=0, description="Upload usage to simulate (GB)"
    )
    test_duration_hours: int = Field(24, gt=0, le=720, description="Test duration (hours)")
    test_concurrent_users: int = Field(1, gt=0, le=1000, description="Concurrent users")

    # Validation checks
    validate_speeds: bool = Field(True, description="Validate speed configuration")
    validate_data_caps: bool = Field(True, description="Validate data cap logic")
    validate_pricing: bool = Field(True, description="Validate pricing calculation")
    validate_time_restrictions: bool = Field(True, description="Validate time-based rules")
    validate_qos: bool = Field(True, description="Validate QoS settings")


class ValidationResult(BaseModel):
    """Single validation check result."""

    model_config = ConfigDict()

    check_name: str
    passed: bool
    severity: str = Field(description="error, warning, info")
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class PlanValidationResponse(BaseModel):
    """Plan validation results."""

    model_config = ConfigDict()

    plan_id: UUID
    plan_code: str
    overall_status: str = Field(description="passed, failed, warning")
    total_checks: int
    passed_checks: int
    failed_checks: int
    warning_checks: int

    results: list[ValidationResult]

    # Simulated usage results
    estimated_monthly_cost: Decimal
    estimated_overage_cost: Decimal
    data_cap_exceeded: bool
    throttling_triggered: bool

    # Performance estimates
    average_download_speed_mbps: Decimal
    average_upload_speed_mbps: Decimal
    peak_download_speed_mbps: Decimal
    peak_upload_speed_mbps: Decimal

    validated_at: datetime


class PlanComparison(BaseModel):
    """Compare multiple plans."""

    model_config = ConfigDict()

    plans: list[InternetServicePlanResponse]
    comparison_matrix: dict[str, list[Any]] = Field(description="Feature comparison matrix")
    recommendations: list[str]


# ============================================================================
# Subscription Models
# ============================================================================


class PlanSubscriptionCreate(BaseModel):
    """Create plan subscription."""

    model_config = ConfigDict()

    plan_id: UUID
    customer_id: UUID
    subscriber_id: str = Field(
        ..., min_length=1, description="RADIUS subscriber ID (required for usage tracking)"
    )
    start_date: datetime = Field(default_factory=datetime.utcnow)

    # Custom overrides
    custom_download_speed: Decimal | None = Field(None, gt=0)
    custom_upload_speed: Decimal | None = Field(None, gt=0)
    custom_data_cap: Decimal | None = Field(None, gt=0)
    custom_monthly_price: Decimal | None = Field(None, ge=0)


class PlanSubscriptionResponse(BaseModel):
    """Plan subscription response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    plan_id: UUID
    customer_id: UUID
    subscriber_id: str | None
    subscription_id: UUID | None

    start_date: datetime
    end_date: datetime | None
    is_active: bool

    custom_download_speed: Decimal | None
    custom_upload_speed: Decimal | None
    custom_data_cap: Decimal | None
    custom_monthly_price: Decimal | None

    current_period_usage_gb: Decimal
    last_usage_reset: datetime | None

    is_suspended: bool
    suspension_reason: str | None

    created_at: datetime
    updated_at: datetime | None


class UsageUpdateRequest(BaseModel):
    """Update subscription usage."""

    model_config = ConfigDict()

    download_gb: Decimal = Field(..., ge=0)
    upload_gb: Decimal = Field(..., ge=0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
