"""
Pydantic schemas for Partner Management module.

Provides request/response validation models following project patterns.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)

from dotmac.platform.partner_management.models import (
    CommissionModel,
    CommissionStatus,
    PartnerStatus,
    PartnerTier,
    PayoutStatus,
    ReferralStatus,
)

# ============================================================================
# Partner Schemas
# ============================================================================


class PartnerBase(BaseModel):  # BaseModel resolves to Any in isolation
    """Base partner schema with common fields."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
        from_attributes=True,
    )

    company_name: str = Field(min_length=1, max_length=255)
    legal_name: str | None = Field(None, max_length=255)
    website: str | None = Field(None, max_length=255)
    description: str | None = None

    tier: PartnerTier = Field(default=PartnerTier.BRONZE)
    commission_model: CommissionModel = Field(default=CommissionModel.REVENUE_SHARE)
    default_commission_rate: Decimal | None = Field(
        None,
        ge=Decimal("0"),
        le=Decimal("1"),
        description="Commission rate (0-1, e.g., 0.15 for 15%)",
    )

    # Contact information
    primary_email: EmailStr
    billing_email: EmailStr | None = None
    support_email: EmailStr | None = None
    phone: str | None = Field(None, max_length=30)

    # Address
    address_line1: str | None = Field(None, max_length=200)
    address_line2: str | None = Field(None, max_length=200)
    city: str | None = Field(None, max_length=100)
    state_province: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    country: str | None = Field(None, pattern="^[A-Z]{2}$", description="ISO 3166-1 alpha-2")

    # Business information
    tax_id: str | None = Field(None, max_length=50)
    vat_number: str | None = Field(None, max_length=50)
    business_registration: str | None = Field(None, max_length=100)

    # SLA
    sla_response_hours: int | None = Field(None, ge=0)
    sla_uptime_percentage: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))

    @field_validator("primary_email", "billing_email", "support_email")
    @classmethod
    def normalize_email(cls, v: EmailStr | None) -> str | None:
        if v:
            return v.lower()
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v and not v.replace("+", "").replace("-", "").replace(" ", "").isdigit():
            raise ValueError("Phone number must contain only digits, +, -, and spaces")
        return v


class PartnerCreate(PartnerBase):  # PartnerBase resolves to Any in isolation
    """Schema for creating a new partner."""

    external_id: str | None = Field(None, max_length=100)
    metadata: dict[str, Any] = Field(default_factory=lambda: {})
    custom_fields: dict[str, Any] = Field(default_factory=lambda: {})


class PartnerUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating partner information."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    # All fields optional for partial updates
    company_name: str | None = Field(None, min_length=1, max_length=255)
    legal_name: str | None = Field(None, max_length=255)
    website: str | None = Field(None, max_length=255)
    description: str | None = None

    status: PartnerStatus | None = None
    tier: PartnerTier | None = None
    commission_model: CommissionModel | None = None
    default_commission_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("1"))

    # Contact information
    primary_email: EmailStr | None = None
    billing_email: EmailStr | None = None
    support_email: EmailStr | None = None
    phone: str | None = Field(None, max_length=30)

    # Address
    address_line1: str | None = Field(None, max_length=200)
    address_line2: str | None = Field(None, max_length=200)
    city: str | None = Field(None, max_length=100)
    state_province: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    country: str | None = Field(None, pattern="^[A-Z]{2}$")

    # Business information
    tax_id: str | None = Field(None, max_length=50)
    vat_number: str | None = Field(None, max_length=50)
    business_registration: str | None = Field(None, max_length=100)

    # SLA
    sla_response_hours: int | None = Field(None, ge=0)
    sla_uptime_percentage: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))

    # Dates
    partnership_end_date: datetime | None = None
    last_review_date: datetime | None = None
    next_review_date: datetime | None = None

    # Metadata
    metadata: dict[str, Any] | None = None
    custom_fields: dict[str, Any] | None = None


class PartnerResponse(PartnerBase):  # PartnerBase resolves to Any in isolation
    """Schema for partner response."""

    id: UUID
    partner_number: str
    status: PartnerStatus

    # Dates
    partnership_start_date: datetime | None = None
    partnership_end_date: datetime | None = None
    last_review_date: datetime | None = None
    next_review_date: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Metrics
    total_customers: int
    total_revenue_generated: Decimal
    total_commissions_earned: Decimal
    total_commissions_paid: Decimal
    total_referrals: int
    converted_referrals: int

    # Metadata
    metadata: dict[str, Any]
    custom_fields: dict[str, Any]


class PartnerListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for partner list endpoint."""

    model_config = ConfigDict()

    partners: list[PartnerResponse]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


# ============================================================================
# Partner User Schemas
# ============================================================================


class PartnerUserBase(BaseModel):  # BaseModel resolves to Any in isolation
    """Base partner user schema."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
        from_attributes=True,
    )

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = Field(None, max_length=30)
    role: str = Field(min_length=1, max_length=50, description="Role within partner organization")
    is_primary_contact: bool = Field(default=False)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return v.lower()


class PartnerUserCreate(PartnerUserBase):  # PartnerUserBase resolves to Any in isolation
    """Schema for creating a partner user."""

    partner_id: UUID
    user_id: UUID | None = Field(None, description="Link to auth user account")


class PartnerUserUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating partner user."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=30)
    role: str | None = Field(None, min_length=1, max_length=50)
    is_primary_contact: bool | None = None
    is_active: bool | None = None


class PartnerUserResponse(PartnerUserBase):  # PartnerUserBase resolves to Any in isolation
    """Schema for partner user response."""

    id: UUID
    partner_id: UUID
    user_id: UUID | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Partner Account Schemas
# ============================================================================


class PartnerAccountBase(BaseModel):  # BaseModel resolves to Any in isolation
    """Base partner account schema."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
        from_attributes=True,
    )

    partner_id: UUID
    customer_id: UUID
    engagement_type: str = Field(min_length=1, max_length=50)
    custom_commission_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("1"))
    notes: str | None = None


class PartnerAccountCreate(PartnerAccountBase):  # PartnerAccountBase resolves to Any in isolation
    """Schema for creating partner account assignment."""

    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class PartnerAccountUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating partner account."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    engagement_type: str | None = Field(None, min_length=1, max_length=50)
    custom_commission_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("1"))
    is_active: bool | None = None
    end_date: datetime | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None


class PartnerAccountResponse(PartnerAccountBase):  # PartnerAccountBase resolves to Any in isolation
    """Schema for partner account response."""

    id: UUID
    start_date: datetime
    end_date: datetime | None = None
    is_active: bool
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class PartnerAccountListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """List response for partner customer accounts."""

    model_config = ConfigDict()

    accounts: list[PartnerAccountResponse]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


# ============================================================================
# Commission Event Schemas
# ============================================================================


class PartnerCommissionEventBase(BaseModel):  # BaseModel resolves to Any in isolation
    """Base commission event schema."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
        from_attributes=True,
        populate_by_name=True,
    )

    partner_id: UUID
    commission_amount: Decimal = Field(ge=Decimal("0"))
    currency: str = Field(default="USD", min_length=3, max_length=3, description="ISO 4217 code")
    event_type: str = Field(min_length=1, max_length=50)


class PartnerCommissionEventCreate(
    PartnerCommissionEventBase
):  # PartnerCommissionEventBase resolves to Any in isolation
    """Schema for creating commission event."""

    invoice_id: UUID | None = None
    customer_id: UUID | None = None
    base_amount: Decimal | None = Field(None, ge=Decimal("0"))
    commission_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("1"))
    notes: str | None = None
    metadata_: dict[str, Any] = Field(default_factory=dict, alias="metadata")


class PartnerCommissionEventUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating commission event."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    status: CommissionStatus | None = None
    payout_id: UUID | None = None
    notes: str | None = None


class PartnerCommissionEventResponse(
    PartnerCommissionEventBase
):  # PartnerCommissionEventBase resolves to Any in isolation
    """Schema for commission event response."""

    id: UUID
    invoice_id: UUID | None = None
    customer_id: UUID | None = None
    base_amount: Decimal | None = None
    commission_rate: Decimal | None = None
    status: CommissionStatus
    event_date: datetime
    payout_id: UUID | None = None
    paid_at: datetime | None = None
    notes: str | None = None
    metadata_: dict[str, Any] = Field(serialization_alias="metadata")
    created_at: datetime
    updated_at: datetime


class PartnerCommissionEventListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for commission event list."""

    model_config = ConfigDict()

    events: list[PartnerCommissionEventResponse]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


# ============================================================================
# Commission Rule Schemas
# ============================================================================


class PartnerCommissionRuleBase(BaseModel):  # BaseModel resolves to Any in isolation
    """Base commission rule schema."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
        from_attributes=True,
    )

    rule_name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    commission_type: CommissionModel
    commission_rate: Decimal | None = Field(
        None,
        ge=Decimal("0"),
        le=Decimal("1"),
        description="Commission rate (0-1, e.g., 0.15 for 15%)",
    )
    flat_fee_amount: Decimal | None = Field(None, ge=Decimal("0"))
    tier_config: dict[str, Any] = Field(
        default_factory=dict,
        description="Tier configuration for tiered commission model",
    )
    applies_to_products: list[str] | None = Field(
        None,
        description="List of product IDs this rule applies to (empty = all products)",
    )
    applies_to_customers: list[str] | None = Field(
        None,
        description="List of customer IDs this rule applies to (empty = all customers)",
    )
    effective_from: datetime
    effective_to: datetime | None = None
    is_active: bool = True
    priority: int = Field(
        default=1,
        ge=1,
        description="Priority for rule evaluation (lower number = higher priority)",
    )


class PartnerCommissionRuleCreate(
    PartnerCommissionRuleBase
):  # PartnerCommissionRuleBase resolves to Any in isolation
    """Schema for creating commission rule."""

    partner_id: UUID


class PartnerCommissionRuleUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating commission rule."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    rule_name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    commission_type: CommissionModel | None = None
    commission_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("1"))
    flat_fee_amount: Decimal | None = Field(None, ge=Decimal("0"))
    tier_config: dict[str, Any] | None = None
    applies_to_products: list[str] | None = None
    applies_to_customers: list[str] | None = None
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    is_active: bool | None = None
    priority: int | None = Field(None, ge=1)


class PartnerCommissionRuleResponse(
    PartnerCommissionRuleBase
):  # PartnerCommissionRuleBase resolves to Any in isolation
    """Schema for commission rule response."""

    id: UUID
    partner_id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime


class PartnerCommissionRuleListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for commission rule list."""

    model_config = ConfigDict()

    rules: list[PartnerCommissionRuleResponse]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


# ============================================================================
# Referral Lead Schemas
# ============================================================================


class ReferralLeadBase(BaseModel):  # BaseModel resolves to Any in isolation
    """Base referral lead schema."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
        from_attributes=True,
    )

    partner_id: UUID
    company_name: str | None = Field(None, max_length=255)
    contact_name: str = Field(min_length=1, max_length=255)
    contact_email: EmailStr
    contact_phone: str | None = Field(None, max_length=30)
    estimated_value: Decimal | None = Field(None, ge=Decimal("0"))
    notes: str | None = None

    @field_validator("contact_email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return v.lower()


class ReferralLeadCreate(ReferralLeadBase):  # ReferralLeadBase resolves to Any in isolation
    """Schema for creating referral lead."""

    source: str | None = Field(None, max_length=100, description="Referral source/campaign")
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class ReferralLeadUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating referral lead."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    company_name: str | None = Field(None, max_length=255)
    contact_name: str | None = Field(None, min_length=1, max_length=255)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(None, max_length=30)
    estimated_value: Decimal | None = Field(None, ge=Decimal("0"))
    status: ReferralStatus | None = None
    notes: str | None = None
    converted_customer_id: UUID | None = None
    conversion_date: datetime | None = None
    actual_value: Decimal | None = Field(None, ge=Decimal("0"))
    first_contact_date: datetime | None = None
    qualified_date: datetime | None = None
    metadata: dict[str, Any] | None = None


class ReferralLeadResponse(ReferralLeadBase):  # ReferralLeadBase resolves to Any in isolation
    """Schema for referral lead response."""

    id: UUID
    status: ReferralStatus
    submitted_date: datetime
    converted_customer_id: UUID | None = None
    conversion_date: datetime | None = None
    actual_value: Decimal | None = None
    first_contact_date: datetime | None = None
    qualified_date: datetime | None = None
    source: str | None = None
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ReferralLeadListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for referral lead list."""

    model_config = ConfigDict()

    referrals: list[ReferralLeadResponse]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


# ============================================================================
# Summary/Analytics Schemas
# ============================================================================


class PartnerSummary(BaseModel):  # BaseModel resolves to Any in isolation
    """Partner performance summary."""

    model_config = ConfigDict()

    partner_id: UUID
    partner_name: str
    status: PartnerStatus
    tier: PartnerTier

    # Counts
    active_customers: int
    total_referrals: int
    converted_referrals: int

    # Financial
    total_revenue: Decimal
    pending_commissions: Decimal
    paid_commissions: Decimal
    outstanding_balance: Decimal

    # Rates
    conversion_rate: float = Field(ge=0, le=100, description="Referral conversion percentage")
    average_deal_value: Decimal


class PartnerPayoutSummary(BaseModel):  # BaseModel resolves to Any in isolation
    """Payout summary for a partner."""

    model_config = ConfigDict()

    partner_id: UUID
    period_start: datetime
    period_end: datetime
    currency: str

    # Amounts
    total_commission_events: int
    total_commission_amount: Decimal
    adjustments: Decimal = Field(default=Decimal("0"))
    net_payout_amount: Decimal

    # Status
    status: PayoutStatus
    payout_date: datetime | None = None

    # Event breakdown
    events: list[PartnerCommissionEventResponse] = Field(default_factory=lambda: [])


class PartnerPayoutResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Detailed partner payout record response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    partner_id: UUID
    total_amount: Decimal
    currency: str
    commission_count: int
    payment_reference: str | None = None
    payment_method: str
    status: PayoutStatus
    payout_date: datetime
    completed_at: datetime | None = None
    period_start: datetime
    period_end: datetime
    notes: str | None = None
    failure_reason: str | None = None
    created_at: datetime
    updated_at: datetime


class PartnerPayoutListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """List response for partner payouts."""

    model_config = ConfigDict()

    payouts: list[PartnerPayoutResponse]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class PayoutSummary(BaseModel):  # BaseModel resolves to Any in isolation
    """Lightweight payout summary for dashboards."""

    model_config = ConfigDict()

    payout_id: UUID
    partner_id: UUID
    total_amount: Decimal
    currency: str
    commission_count: int
    payout_date: datetime
    status: PayoutStatus
    payment_reference: str | None = None


class PartnerRevenueMetrics(BaseModel):  # BaseModel resolves to Any in isolation
    """Partner revenue metrics for a specific time period."""

    model_config = ConfigDict(from_attributes=True)

    partner_id: UUID
    period_start: datetime
    period_end: datetime
    total_commissions: Decimal
    total_commission_count: int
    total_payouts: Decimal
    pending_amount: Decimal
    currency: str = "USD"


class PartnerRevenueDashboard(BaseModel):  # BaseModel resolves to Any in isolation
    """Aggregated partner revenue dashboard metrics."""

    model_config = ConfigDict()

    partner_id: UUID
    company_name: str
    tier: PartnerTier

    # Lifetime metrics
    total_revenue_generated: Decimal = Field(default=Decimal("0.00"))
    total_commissions_earned: Decimal = Field(default=Decimal("0.00"))
    total_commissions_paid: Decimal = Field(default=Decimal("0.00"))
    outstanding_balance: Decimal = Field(default=Decimal("0.00"))

    # Current period
    current_month_revenue: Decimal = Field(default=Decimal("0.00"))
    current_month_commissions: Decimal = Field(default=Decimal("0.00"))
    current_month_payouts: Decimal = Field(default=Decimal("0.00"))

    # Referral metrics
    total_referrals: int = 0
    converted_referrals: int = 0
    conversion_rate: float = 0.0
    active_referrals: int = 0

    # Customers
    total_customers: int = 0
    active_customers: int = 0

    # Activity
    recent_commissions: list[PartnerCommissionEventResponse] = Field(default_factory=lambda: [])
    recent_payouts: list[PartnerPayoutResponse] = Field(default_factory=lambda: [])
    pending_commission_events: int = 0
    next_payout_date: datetime | None = None


class PartnerStatementResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Monthly partner statement derived from payout data."""

    model_config = ConfigDict()

    id: UUID
    payout_id: UUID | None = None
    period_start: datetime
    period_end: datetime
    issued_at: datetime
    revenue_total: Decimal = Field(default=Decimal("0.00"))
    commission_total: Decimal = Field(default=Decimal("0.00"))
    adjustments_total: Decimal = Field(default=Decimal("0.00"))
    status: PayoutStatus
    download_url: str | None = None
