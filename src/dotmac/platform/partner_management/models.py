"""
Partner Management Database Models.

Provides comprehensive partner relationship management with:
- Partner profiles and lifecycle tracking
- Partner user access control
- Partner-customer account assignments
- Commission tracking and payout management
- Referral lead tracking
"""

from datetime import UTC, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import (
    AuditMixin,
    Base,
    SoftDeleteMixin,
    TenantMixin,
    TimestampMixin,
)


class PartnerStatus(str, Enum):
    """Partner account status."""

    PENDING = "pending"  # Application pending approval
    ACTIVE = "active"  # Active partner
    SUSPENDED = "suspended"  # Temporarily suspended
    TERMINATED = "terminated"  # Partnership ended
    ARCHIVED = "archived"  # Historical record


class PartnerTier(str, Enum):
    """Partner tier levels for differentiated benefits."""

    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"
    DIRECT = "direct"  # Internal/direct sales (not a real partner)


class CommissionModel(str, Enum):
    """Commission calculation models."""

    REVENUE_SHARE = "revenue_share"  # Percentage of revenue
    FLAT_FEE = "flat_fee"  # Fixed amount per transaction
    TIERED = "tiered"  # Different rates based on volume
    HYBRID = "hybrid"  # Combination of models


class CommissionStatus(str, Enum):
    """Status of commission events."""

    PENDING = "pending"  # Accrued but not yet paid
    APPROVED = "approved"  # Approved for payout
    PAID = "paid"  # Paid out to partner
    CLAWBACK = "clawback"  # Reversed due to refund/chargeback
    CANCELLED = "cancelled"  # Cancelled before payout


class PayoutStatus(str, Enum):
    """Status of partner payouts."""

    PENDING = "pending"  # Not yet processed
    READY = "ready"  # Ready for payout
    PROCESSING = "processing"  # Being processed
    COMPLETED = "completed"  # Successfully paid
    FAILED = "failed"  # Payment failed
    CANCELLED = "cancelled"  # Cancelled before processing


class ReferralStatus(str, Enum):
    """Status of referral leads."""

    NEW = "new"  # New lead submitted
    CONTACTED = "contacted"  # Initial contact made
    QUALIFIED = "qualified"  # Qualified as potential customer
    CONVERTED = "converted"  # Converted to paying customer
    LOST = "lost"  # Lost opportunity
    INVALID = "invalid"  # Invalid/duplicate lead


class PartnerTenantAccessRole(str, Enum):
    """Access roles for partner-tenant relationships."""

    MSP_FULL = "msp_full"  # Full MSP access (billing, support, provisioning)
    MSP_BILLING = "msp_billing"  # Billing and revenue only
    MSP_SUPPORT = "msp_support"  # Support/ticketing only
    ENTERPRISE_HQ = "enterprise_hq"  # Enterprise HQ full access
    AUDITOR = "auditor"  # Read-only audit access
    RESELLER = "reseller"  # Reseller with limited provisioning
    DELEGATE = "delegate"  # Custom delegate role


class Partner(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    Core partner model for SaaS vendors, agencies, and resellers.
    """

    __tablename__ = "partners"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Partner identification
    partner_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique partner identifier for business operations",
    )

    # Company Information
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    legal_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Partner Status and Tier
    status: Mapped[PartnerStatus] = mapped_column(
        SQLEnum(PartnerStatus),
        default=PartnerStatus.PENDING,
        nullable=False,
        index=True,
    )
    tier: Mapped[PartnerTier] = mapped_column(
        SQLEnum(PartnerTier),
        default=PartnerTier.BRONZE,
        nullable=False,
        index=True,
    )

    # Commission Configuration
    commission_model: Mapped[CommissionModel] = mapped_column(
        SQLEnum(CommissionModel),
        default=CommissionModel.REVENUE_SHARE,
        nullable=False,
    )
    default_commission_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
        comment="Default commission rate (e.g., 0.1500 for 15%)",
    )

    # Contact Information
    primary_email: Mapped[str] = mapped_column(String(255), nullable=False)
    billing_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    support_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Address Information
    address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state_province: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str | None] = mapped_column(
        String(2), nullable=True, comment="ISO 3166-1 alpha-2"
    )

    # Business & Tax Information
    tax_id: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="Tax identification number"
    )
    vat_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    business_registration: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # SLA Configuration
    sla_response_hours: Mapped[int | None] = mapped_column(
        nullable=True, comment="Expected response time in hours"
    )
    sla_uptime_percentage: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True, comment="Required uptime percentage"
    )

    # Partner Dates
    partnership_start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=True,
    )
    partnership_end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_review_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_review_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Metrics
    total_customers: Mapped[int] = mapped_column(default=0, nullable=False)
    total_revenue_generated: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("0.00"), nullable=False
    )
    total_commissions_earned: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("0.00"), nullable=False
    )
    total_commissions_paid: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("0.00"), nullable=False
    )
    total_referrals: Mapped[int] = mapped_column(default=0, nullable=False)
    converted_referrals: Mapped[int] = mapped_column(default=0, nullable=False)

    # Custom metadata
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )
    custom_fields: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # External references
    external_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    # Relationships
    users: Mapped[list["PartnerUser"]] = relationship(
        back_populates="partner", cascade="all, delete-orphan", lazy="dynamic"
    )
    accounts: Mapped[list["PartnerAccount"]] = relationship(
        back_populates="partner", lazy="dynamic"
    )
    commission_events: Mapped[list["PartnerCommissionEvent"]] = relationship(
        back_populates="partner", lazy="dynamic"
    )
    payouts: Mapped[list["PartnerPayout"]] = relationship(back_populates="partner", lazy="dynamic")
    referrals: Mapped[list["ReferralLead"]] = relationship(back_populates="partner", lazy="dynamic")

    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "partner_number", name="uq_tenant_partner_number"),
        UniqueConstraint("tenant_id", "company_name", name="uq_tenant_company_name"),
        Index("ix_partner_status_tier", "status", "tier"),
        Index("ix_partner_dates", "partnership_start_date", "partnership_end_date"),
    )

    @property
    def outstanding_commission_balance(self) -> Decimal:
        """Calculate outstanding commission balance."""
        return self.total_commissions_earned - self.total_commissions_paid

    @property
    def referral_conversion_rate(self) -> float:
        """Calculate referral conversion rate."""
        if self.total_referrals == 0:
            return 0.0
        return (self.converted_referrals / self.total_referrals) * 100


class PartnerUser(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):  # type: ignore[misc]
    """
    Users within partner organizations with access to partner portal.
    """

    __tablename__ = "partner_users"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    partner_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # User identification
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Role within partner organization
    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Role within partner org (e.g., account_manager, admin)",
    )
    is_primary_contact: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Auth system link (optional)
    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Link to auth user account for portal access",
    )

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    partner: Mapped["Partner"] = relationship(back_populates="users")

    __table_args__ = (
        UniqueConstraint("partner_id", "email", name="uq_partner_user_email"),
        Index("ix_partner_user_partner", "partner_id", "is_active"),
    )

    @property
    def full_name(self) -> str:
        """Get user's full name."""
        return f"{self.first_name} {self.last_name}"


class PartnerAccount(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Join table linking partners to customers they manage.
    """

    __tablename__ = "partner_accounts"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    partner_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    customer_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Engagement type
    engagement_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type of engagement (e.g., managed, referral, reseller)",
    )

    # Assignment dates
    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Commission override for this specific account
    custom_commission_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
        comment="Override partner's default commission rate for this account",
    )

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    # Relationships
    partner: Mapped["Partner"] = relationship(back_populates="accounts")

    __table_args__ = (
        UniqueConstraint("partner_id", "customer_id", name="uq_partner_customer"),
        Index("ix_partner_account_dates", "partner_id", "start_date", "end_date"),
        Index("ix_partner_account_active", "partner_id", "is_active"),
    )


class PartnerCommission(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Commission rules and schedules for partners.
    Defines how commissions are calculated for different scenarios.
    """

    __tablename__ = "partner_commission_rules"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    partner_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Rule identification
    rule_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Commission calculation
    commission_type: Mapped[CommissionModel] = mapped_column(
        SQLEnum(CommissionModel),
        nullable=False,
    )
    commission_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    flat_fee_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)

    # Tier configuration (for tiered model)
    tier_config: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Tier thresholds and rates for tiered commission",
    )

    # Applicability
    applies_to_products: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True, comment="List of product IDs this rule applies to"
    )
    applies_to_customers: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True, comment="List of customer IDs this rule applies to"
    )

    # Effective dates
    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("ix_commission_rule_partner_active", "partner_id", "is_active"),
        Index("ix_commission_rule_dates", "effective_from", "effective_to"),
    )


class PartnerCommissionEvent(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Individual commission events tracking earnings.
    Created when invoices are finalized or other commission-triggering events occur.
    """

    __tablename__ = "partner_commission_events"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    partner_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Source reference
    invoice_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("invoices.invoice_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Invoice that triggered this commission",
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Commission details
    commission_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, comment="Commission amount earned"
    )
    currency: Mapped[str] = mapped_column(
        String(3), default="USD", nullable=False, comment="ISO 4217 currency code"
    )

    # Calculation details
    base_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 2), nullable=True, comment="Base amount used for calculation"
    )
    commission_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 4), nullable=True, comment="Rate applied"
    )

    # Status
    status: Mapped[CommissionStatus] = mapped_column(
        SQLEnum(CommissionStatus),
        default=CommissionStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Event details
    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type of event (e.g., invoice_paid, clawback)",
    )
    event_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Payout tracking
    payout_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("partner_payouts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Reference to payout batch",
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    # Relationships
    partner: Mapped["Partner"] = relationship(back_populates="commission_events")
    payout: Mapped["PartnerPayout"] = relationship(back_populates="commission_events")

    __table_args__ = (
        Index("ix_commission_event_partner_status", "partner_id", "status"),
        Index("ix_commission_event_dates", "event_date", "paid_at"),
        Index("ix_commission_event_payout", "payout_id", "status"),
    )


class PartnerPayout(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Payout batches aggregating multiple commission events.

    Tracks partner disbursements to ensure reconciliation between earned and paid commissions.
    """

    __tablename__ = "partner_payouts"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    partner_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Financial details
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False,
        comment="Total payout amount for the batch",
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        default="USD",
        nullable=False,
        comment="ISO 4217 currency code",
    )
    commission_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of commission events included in payout",
    )

    # Disbursement details
    payment_reference: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="External payment reference (e.g., Stripe transfer ID)",
    )
    payment_method: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="manual",
        comment="Method used to issue payout",
    )
    status: Mapped[PayoutStatus] = mapped_column(
        SQLEnum(PayoutStatus),
        default=PayoutStatus.PENDING,
        nullable=False,
        index=True,
    )
    payout_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="Date payout was initiated",
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When payout completed successfully",
    )

    # Period coverage
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="Start of earnings period covered by payout",
    )
    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="End of earnings period covered by payout",
    )

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    partner: Mapped["Partner"] = relationship(back_populates="payouts")
    commission_events: Mapped[list["PartnerCommissionEvent"]] = relationship(
        back_populates="payout"
    )

    __table_args__ = (
        Index("ix_partner_payouts_partner_status", "partner_id", "status"),
        Index("ix_partner_payouts_dates", "payout_date", "period_start", "period_end"),
    )


class ReferralLead(Base, TimestampMixin, TenantMixin, SoftDeleteMixin):  # type: ignore[misc]
    """
    Referral leads submitted by partners before customer conversion.
    """

    __tablename__ = "partner_referrals"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    partner_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Lead information
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Referral details
    estimated_value: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 2), nullable=True, comment="Estimated deal value"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Status tracking
    status: Mapped[ReferralStatus] = mapped_column(
        SQLEnum(ReferralStatus),
        default=ReferralStatus.NEW,
        nullable=False,
        index=True,
    )

    # Conversion tracking
    converted_customer_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        comment="Customer ID if converted",
    )
    conversion_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_value: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 2), nullable=True, comment="Actual deal value after conversion"
    )

    # Timeline
    submitted_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    first_contact_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    qualified_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    converted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="When referral was converted to customer"
    )

    # Metadata
    source: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="Referral source/campaign"
    )
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )

    # Relationships
    partner: Mapped["Partner"] = relationship(back_populates="referrals")

    __table_args__ = (
        Index("ix_referral_partner_status", "partner_id", "status"),
        Index("ix_referral_dates", "submitted_date", "conversion_date"),
        Index("ix_referral_email", "contact_email"),
    )


class PartnerTenantLink(Base, TimestampMixin, AuditMixin):  # type: ignore[misc]
    """
    Join table linking partners to managed tenant accounts.

    Enables MSPs and enterprise HQs to manage multiple ISP tenants
    with scoped permissions.
    """

    __tablename__ = "partner_tenant_links"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # The partner organization (MSP/enterprise HQ)
    partner_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Partner organization managing the tenant",
    )

    # The managed tenant (ISP operator)
    managed_tenant_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant being managed by the partner",
    )

    # Foreign key to owning tenant (the partner's tenant)
    partner_tenant_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The partner's own tenant (not the managed tenant)",
    )

    # Access role and permissions
    access_role: Mapped[PartnerTenantAccessRole] = mapped_column(
        SQLEnum(PartnerTenantAccessRole),
        nullable=False,
        index=True,
        comment="Defines scope of partner access to tenant",
    )

    # Custom permissions override (JSON)
    custom_permissions: Mapped[dict[str, bool]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Custom permission overrides for granular control",
    )

    # Relationship metadata
    relationship_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type: msp_managed, enterprise_subsidiary, reseller_channel, audit_only",
    )

    # Engagement dates
    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="NULL = ongoing relationship",
    )

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    # Notifications configuration
    notify_on_sla_breach: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    notify_on_billing_threshold: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    billing_alert_threshold: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 2),
        nullable=True,
        comment="Alert when AR exceeds this amount",
    )

    # Service Level Agreement
    sla_response_hours: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Partner's committed response time for this tenant",
    )

    sla_uptime_target: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
        comment="Partner's uptime commitment (e.g., 99.95)",
    )

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        nullable=False,
    )

    # Relationships
    partner: Mapped["Partner"] = relationship(
        "Partner",
        foreign_keys=[partner_id],
        backref="managed_tenant_links",
    )

    # Table constraints
    __table_args__ = (
        UniqueConstraint(
            "partner_id",
            "managed_tenant_id",
            name="uq_partner_managed_tenant",
        ),
        Index("ix_partner_tenant_active", "partner_id", "is_active"),
        Index("ix_managed_tenant_active", "managed_tenant_id", "is_active"),
        Index("ix_partner_tenant_role", "partner_id", "access_role"),
        Index("ix_partner_tenant_dates", "start_date", "end_date"),
    )

    @property
    def is_expired(self) -> bool:
        """Check if the link has expired."""
        if not self.end_date:
            return False
        # Handle both timezone-aware and naive datetimes (SQLite returns naive)
        end_date = (
            self.end_date.replace(tzinfo=UTC) if self.end_date.tzinfo is None else self.end_date
        )
        return datetime.now(UTC) > end_date

    @property
    def is_valid(self) -> bool:
        """Check if link is active and not expired."""
        return self.is_active and not self.is_expired
