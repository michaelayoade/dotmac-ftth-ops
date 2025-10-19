"""
Licensing Pydantic Schemas.

Request/response schemas for licensing API endpoints.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from .models import (
    ActivationStatus,
    ActivationType,
    AuditScope,
    AuditStatus,
    AuditType,
    LicenseModel,
    LicenseStatus,
    LicenseType,
    OrderStatus,
    PaymentStatus,
    ViolationStatus,
)


# Feature & Restriction Schemas
class LicenseFeature(BaseModel):
    """License feature schema."""

    feature_id: str
    feature_name: str
    enabled: bool = True
    limit_value: int | None = None
    limit_type: Literal["COUNT", "SIZE", "DURATION", "BANDWIDTH"] | None = None
    expires_at: datetime | None = None


class LicenseRestriction(BaseModel):
    """License restriction schema."""

    restriction_type: Literal[
        "GEOGRAPHIC", "DOMAIN", "IP_RANGE", "MAC_ADDRESS", "HARDWARE_ID", "TIME_BASED"
    ]
    values: list[str] = Field(default_factory=list)
    operator: Literal["ALLOW", "DENY"] = "ALLOW"


class ActivationLocation(BaseModel):
    """Activation location schema."""

    country: str
    region: str | None = None
    city: str | None = None
    timezone: str
    coordinates: dict[str, float] | None = None


class UsageMetrics(BaseModel):
    """Usage metrics schema."""

    total_runtime_hours: float = 0.0
    feature_usage: dict[str, int] = Field(default_factory=dict)
    api_calls_count: int = 0
    data_processed_mb: float = 0.0
    last_used_at: datetime | None = None
    peak_concurrent_users: int | None = None


# License Schemas
class LicenseBase(BaseModel):
    """Base license schema."""

    product_id: str
    product_name: str
    product_version: str
    license_type: LicenseType
    license_model: LicenseModel
    customer_id: str | None = None
    reseller_id: str | None = None
    issued_to: str
    max_activations: int = 1
    features: list[LicenseFeature] = Field(default_factory=list)
    restrictions: list[LicenseRestriction] = Field(default_factory=list)
    expiry_date: datetime | None = None
    maintenance_expiry: datetime | None = None
    auto_renewal: bool = False
    trial_period_days: int | None = None
    grace_period_days: int = 30
    metadata: dict[str, Any] = Field(default_factory=dict)


class LicenseCreate(LicenseBase):
    """License creation schema."""

    pass


class LicenseUpdate(BaseModel):
    """License update schema."""

    product_name: str | None = None
    product_version: str | None = None
    max_activations: int | None = None
    features: list[LicenseFeature] | None = None
    restrictions: list[LicenseRestriction] | None = None
    expiry_date: datetime | None = None
    maintenance_expiry: datetime | None = None
    status: LicenseStatus | None = None
    auto_renewal: bool | None = None
    metadata: dict[str, Any] | None = None


class LicenseResponse(LicenseBase):
    """License response schema."""

    id: str
    license_key: str
    current_activations: int
    issued_date: datetime
    activation_date: datetime | None
    status: LicenseStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LicenseRenewal(BaseModel):
    """License renewal schema."""

    duration_months: int = Field(ge=1, le=60)
    extend_maintenance: bool = False
    upgrade_features: list[LicenseFeature] | None = None


class LicenseTransfer(BaseModel):
    """License transfer schema."""

    new_customer_id: str | None = None
    new_issued_to: str
    transfer_reason: str
    deactivate_existing: bool = True


# Activation Schemas
class ActivationBase(BaseModel):
    """Base activation schema."""

    device_fingerprint: str
    machine_name: str | None = None
    hardware_id: str | None = None
    mac_address: str | None = None
    ip_address: str | None = None
    operating_system: str | None = None
    user_agent: str | None = None
    application_version: str
    activation_type: ActivationType = ActivationType.ONLINE
    location: ActivationLocation | None = None


class ActivationCreate(ActivationBase):
    """Activation creation schema."""

    license_key: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ActivationResponse(ActivationBase):
    """Activation response schema."""

    id: str
    license_id: str
    activation_token: str
    status: ActivationStatus
    activated_at: datetime
    last_heartbeat: datetime | None
    deactivated_at: datetime | None
    deactivation_reason: str | None
    usage_metrics: UsageMetrics | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ActivationValidation(BaseModel):
    """Activation validation request."""

    activation_token: str


class ActivationValidationResponse(BaseModel):
    """Activation validation response."""

    valid: bool
    activation: ActivationResponse | None = None
    license: LicenseResponse | None = None


class ActivationHeartbeat(BaseModel):
    """Activation heartbeat schema."""

    activation_token: str
    metrics: UsageMetrics | None = None


class OfflineActivationRequest(BaseModel):
    """Offline activation request schema."""

    license_key: str
    device_fingerprint: str


class OfflineActivationResponse(BaseModel):
    """Offline activation response schema."""

    request_code: str
    instructions: str


class OfflineActivationProcess(BaseModel):
    """Offline activation processing schema."""

    request_code: str
    response_code: str


# License Template Schemas
class TemplateFeature(BaseModel):
    """Template feature schema."""

    feature_id: str
    feature_name: str
    included: bool = True
    default_limit: int | None = None
    configurable: bool = True
    required: bool = False


class TemplateRestriction(BaseModel):
    """Template restriction schema."""

    restriction_type: Literal[
        "GEOGRAPHIC", "DOMAIN", "IP_RANGE", "MAC_ADDRESS", "HARDWARE_ID", "TIME_BASED"
    ]
    operator: Literal["ALLOW", "DENY"] = "ALLOW"
    configurable: bool = True
    default_values: list[str] | None = None


class VolumeDiscount(BaseModel):
    """Volume discount schema."""

    min_quantity: int = Field(ge=1)
    max_quantity: int | None = None
    discount_percentage: float = Field(ge=0, le=100)
    discount_amount: float | None = None


class LicensePricing(BaseModel):
    """License pricing schema."""

    base_price: float = Field(ge=0)
    currency: str = "USD"
    billing_cycle: Literal["MONTHLY", "QUARTERLY", "ANNUALLY", "ONE_TIME"] = "ANNUALLY"
    per_seat_price: float | None = None
    volume_discounts: list[VolumeDiscount] | None = None
    maintenance_percentage: float | None = None


class LicenseTemplateBase(BaseModel):
    """Base license template schema."""

    template_name: str
    product_id: str
    description: str | None = None
    license_type: LicenseType
    license_model: LicenseModel
    default_duration: int = 365
    max_activations: int = 1
    features: list[TemplateFeature] = Field(default_factory=list)
    restrictions: list[TemplateRestriction] = Field(default_factory=list)
    pricing: LicensePricing
    auto_renewal_enabled: bool = True
    trial_allowed: bool = False
    trial_duration_days: int = 30
    grace_period_days: int = 30


class LicenseTemplateCreate(LicenseTemplateBase):
    """License template creation schema."""

    pass


class LicenseTemplateUpdate(BaseModel):
    """License template update schema."""

    template_name: str | None = None
    description: str | None = None
    default_duration: int | None = None
    max_activations: int | None = None
    features: list[TemplateFeature] | None = None
    restrictions: list[TemplateRestriction] | None = None
    pricing: LicensePricing | None = None
    auto_renewal_enabled: bool | None = None
    trial_allowed: bool | None = None
    trial_duration_days: int | None = None
    grace_period_days: int | None = None
    active: bool | None = None


class LicenseTemplateResponse(LicenseTemplateBase):
    """License template response schema."""

    id: str
    active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# License Order Schemas
class LicenseOrderBase(BaseModel):
    """Base license order schema."""

    template_id: str
    quantity: int = Field(ge=1)
    customer_id: str | None = None
    reseller_id: str | None = None
    custom_features: list[LicenseFeature] | None = None
    custom_restrictions: list[LicenseRestriction] | None = None
    duration_override: int | None = None
    pricing_override: LicensePricing | None = None
    special_instructions: str | None = None
    fulfillment_method: Literal["AUTO", "MANUAL", "BATCH"] = "AUTO"


class LicenseOrderCreate(LicenseOrderBase):
    """License order creation schema."""

    pass


class LicenseOrderResponse(LicenseOrderBase):
    """License order response schema."""

    id: str
    order_number: str
    status: OrderStatus
    total_amount: float
    discount_applied: float | None
    payment_status: PaymentStatus
    invoice_id: str | None
    subscription_id: str | None
    generated_licenses: list[str] | None
    created_at: datetime
    fulfilled_at: datetime | None
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderApproval(BaseModel):
    """Order approval schema."""

    approval_notes: str | None = None


class OrderCancellation(BaseModel):
    """Order cancellation schema."""

    reason: str


# Compliance Schemas
class AuditFinding(BaseModel):
    """Audit finding schema."""

    finding_type: Literal[
        "OVER_DEPLOYMENT",
        "UNLICENSED_SOFTWARE",
        "EXPIRED_LICENSE",
        "FEATURE_MISUSE",
        "DOCUMENTATION_MISSING",
    ]
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    description: str
    evidence: list[str] = Field(default_factory=list)
    affected_licenses: list[str] = Field(default_factory=list)
    impact_assessment: str
    recommended_action: str


class ComplianceAuditBase(BaseModel):
    """Base compliance audit schema."""

    audit_type: AuditType
    customer_id: str | None = None
    product_ids: list[str]
    audit_scope: AuditScope
    audit_date: datetime
    special_instructions: str | None = None


class ComplianceAuditCreate(ComplianceAuditBase):
    """Compliance audit creation schema."""

    pass


class ComplianceAuditResponse(ComplianceAuditBase):
    """Compliance audit response schema."""

    id: str
    status: AuditStatus
    auditor_id: str
    findings: list[AuditFinding] = Field(default_factory=list)
    violations: list[str] = Field(default_factory=list)
    compliance_score: float
    recommendations: list[str] = Field(default_factory=list)
    follow_up_required: bool
    follow_up_date: datetime | None
    report_url: str | None
    created_at: datetime
    completed_at: datetime | None
    updated_at: datetime

    class Config:
        from_attributes = True


class AuditFindingsSubmission(BaseModel):
    """Audit findings submission schema."""

    findings: list[AuditFinding]


class ComplianceViolationBase(BaseModel):
    """Base compliance violation schema."""

    violation_type: Literal[
        "UNAUTHORIZED_USE",
        "OVER_DEPLOYMENT",
        "FEATURE_ABUSE",
        "TRANSFER_VIOLATION",
        "REVERSE_ENGINEERING",
    ]
    severity: Literal["MINOR", "MAJOR", "CRITICAL"]
    license_id: str
    description: str
    evidence: list[str] = Field(default_factory=list)
    financial_impact: float | None = None
    resolution_required: bool = True
    resolution_deadline: datetime | None = None


class ComplianceViolationResponse(ComplianceViolationBase):
    """Compliance violation response schema."""

    id: str
    detected_at: datetime
    status: ViolationStatus
    resolution_notes: str | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ViolationResolution(BaseModel):
    """Violation resolution schema."""

    resolution_action: str
    resolution_notes: str
    evidence: list[str] | None = None


# Analytics & Reporting Schemas
class LicenseSummary(BaseModel):
    """License summary schema."""

    total_licenses: int
    active_licenses: int
    expired_licenses: int
    suspended_licenses: int


class ActivationSummary(BaseModel):
    """Activation summary schema."""

    total_activations: int
    active_activations: int
    peak_concurrent_activations: int
    average_utilization: float


class FeatureUsageStat(BaseModel):
    """Feature usage statistics."""

    feature_name: str
    total_usage: int
    unique_users: int
    peak_usage: int


class LicenseUsageReport(BaseModel):
    """License usage report schema."""

    report_id: str
    customer_id: str | None
    product_id: str | None
    report_period: dict[str, str]
    license_summary: LicenseSummary
    activation_summary: ActivationSummary
    feature_usage: list[FeatureUsageStat]
    compliance_status: Literal["COMPLIANT", "NON_COMPLIANT", "REQUIRES_REVIEW"]
    recommendations: list[str]
    generated_at: datetime


class ReportRequest(BaseModel):
    """Report generation request."""

    customer_id: str | None = None
    product_id: str | None = None
    start_date: str
    end_date: str
    report_format: Literal["JSON", "PDF", "CSV"] = "JSON"
    include_details: bool = False


class ReportResponse(BaseModel):
    """Report generation response."""

    report_id: str
    download_url: str | None = None
    report_data: LicenseUsageReport | None = None


class UtilizationStats(BaseModel):
    """License utilization statistics."""

    total_licenses: int
    utilized_licenses: int
    utilization_percentage: float
    peak_utilization: int
    underutilized_licenses: list[dict[str, Any]] = Field(default_factory=list)


class ComplianceStatus(BaseModel):
    """Compliance status schema."""

    overall_score: float
    license_compliance: float
    feature_compliance: float
    activation_compliance: float
    violations: list[ComplianceViolationResponse] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class ExpiryAlert(BaseModel):
    """License expiry alert schema."""

    license_id: str
    customer_name: str
    product_name: str
    expiry_date: datetime
    days_remaining: int
    auto_renewal_enabled: bool


# Security Schemas
class LicenseValidationRequest(BaseModel):
    """License validation request."""

    license_key: str


class LicenseValidationResponse(BaseModel):
    """License validation response."""

    valid: bool
    license: LicenseResponse | None = None
    validation_details: dict[str, Any] = Field(default_factory=dict)


class IntegrityCheckRequest(BaseModel):
    """Integrity check request."""

    license_key: str
    signature: str | None = None


class IntegrityCheckResponse(BaseModel):
    """Integrity check response."""

    integrity_check: bool
    tampering_detected: bool


class EmergencyCodeRequest(BaseModel):
    """Emergency code request."""

    license_key: str
    reason: str


class EmergencyCodeResponse(BaseModel):
    """Emergency code response."""

    emergency_code: str
    valid_until: datetime


class DeviceBlacklist(BaseModel):
    """Device blacklist schema."""

    device_fingerprint: str
    reason: str


class SuspiciousActivityReport(BaseModel):
    """Suspicious activity report schema."""

    license_key: str | None = None
    activation_token: str | None = None
    activity_type: Literal[
        "MULTIPLE_ACTIVATIONS", "UNUSUAL_LOCATION", "TAMPERING_ATTEMPT", "API_ABUSE"
    ]
    description: str
    evidence: dict[str, Any] | None = None


class SuspiciousActivityResponse(BaseModel):
    """Suspicious activity response schema."""

    incident_id: str
