"""
CRM (Customer Relationship Management) Models.

Manages leads, quotes, and site surveys for the sales pipeline.
"""

from datetime import datetime, timezone

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = timezone.utc
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
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


class LeadStatus(str, Enum):
    """Lead lifecycle status."""

    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    SITE_SURVEY_SCHEDULED = "site_survey_scheduled"
    SITE_SURVEY_COMPLETED = "site_survey_completed"
    QUOTE_SENT = "quote_sent"
    NEGOTIATING = "negotiating"
    WON = "won"  # Converted to customer
    LOST = "lost"
    DISQUALIFIED = "disqualified"


class LeadSource(str, Enum):
    """How the lead was acquired."""

    WEBSITE = "website"
    REFERRAL = "referral"
    PARTNER = "partner"
    COLD_CALL = "cold_call"
    SOCIAL_MEDIA = "social_media"
    EVENT = "event"
    ADVERTISEMENT = "advertisement"
    WALK_IN = "walk_in"
    OTHER = "other"


class QuoteStatus(str, Enum):
    """Quote status."""

    DRAFT = "draft"
    SENT = "sent"
    VIEWED = "viewed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    REVISED = "revised"


class SiteSurveyStatus(str, Enum):
    """Site survey status."""

    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


class Serviceability(str, Enum):
    """Service availability at location."""

    SERVICEABLE = "serviceable"
    NOT_SERVICEABLE = "not_serviceable"
    PENDING_EXPANSION = "pending_expansion"
    REQUIRES_CONSTRUCTION = "requires_construction"


class Lead(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    Sales Lead.

    Represents a potential customer in the sales pipeline.
    Tracks lead qualification, site survey, and quote generation.
    """

    __tablename__ = "leads"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Lead Information
    lead_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Human-readable lead identifier",
    )
    status: Mapped[LeadStatus] = mapped_column(
        SQLEnum(LeadStatus, values_callable=lambda x: [e.value for e in x]),
        default=LeadStatus.NEW,
        nullable=False,
        index=True,
    )
    source: Mapped[LeadSource] = mapped_column(
        SQLEnum(LeadSource, values_callable=lambda x: [e.value for e in x]),
        default=LeadSource.WEBSITE,
        nullable=False,
        index=True,
    )
    priority: Mapped[int] = mapped_column(
        default=3,
        nullable=False,
        comment="1=High, 2=Medium, 3=Low",
    )

    # Contact Information
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Service Location
    service_address_line1: Mapped[str] = mapped_column(String(200), nullable=False)
    service_address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    service_city: Mapped[str] = mapped_column(String(100), nullable=False)
    service_state_province: Mapped[str] = mapped_column(String(100), nullable=False)
    service_postal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    service_country: Mapped[str] = mapped_column(
        String(2),
        default="US",
        nullable=False,
        comment="ISO 3166-1 alpha-2",
    )
    service_coordinates: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="GPS coordinates: {lat: float, lon: float}",
    )

    # Serviceability Check
    is_serviceable: Mapped[Serviceability | None] = mapped_column(
        SQLEnum(Serviceability, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
        comment="Service availability at location",
    )
    serviceability_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    serviceability_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Interest & Requirements
    interested_service_types: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="['residential_internet', 'iptv', 'voip']",
    )
    desired_bandwidth: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="e.g., '100/100 Mbps', '1 Gbps'",
    )
    estimated_monthly_budget: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    desired_installation_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Assignment
    assigned_to_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Sales representative",
    )

    # Partner Information (if lead came from partner)
    partner_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Qualification
    qualified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    disqualified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    disqualification_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Conversion
    converted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    converted_to_customer_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Sales Cycle Tracking
    first_contact_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_contact_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    expected_close_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Custom Fields
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    quotes = relationship("Quote", back_populates="lead", lazy="dynamic")
    site_surveys = relationship("SiteSurvey", back_populates="lead", lazy="dynamic")

    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "lead_number", name="uq_lead_tenant_number"),
        Index("ix_lead_status_priority", "tenant_id", "status", "priority"),
        Index("ix_lead_assigned", "assigned_to_id"),
        Index("ix_lead_partner", "partner_id"),
        Index("ix_lead_email", "email"),
    )

    def __repr__(self) -> str:
        return f"<Lead(id={self.id}, number={self.lead_number}, status={self.status})>"

    @property
    def full_name(self) -> str:
        """Get lead's full name."""
        return f"{self.first_name} {self.last_name}"

    @property
    def full_address(self) -> str:
        """Get full service address."""
        parts = [self.service_address_line1]
        if self.service_address_line2:
            parts.append(self.service_address_line2)
        parts.append(
            f"{self.service_city}, {self.service_state_province} {self.service_postal_code}"
        )
        return ", ".join(parts)


class Quote(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    Service Quote.

    Pricing quote for a lead including service plan, installation fees, and terms.
    """

    __tablename__ = "quotes"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Quote Information
    quote_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Human-readable quote identifier",
    )
    status: Mapped[QuoteStatus] = mapped_column(
        SQLEnum(QuoteStatus, values_callable=lambda x: [e.value for e in x]),
        default=QuoteStatus.DRAFT,
        nullable=False,
        index=True,
    )

    # Link to Lead
    lead_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Quote Details
    service_plan_name: Mapped[str] = mapped_column(String(200), nullable=False)
    bandwidth: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="e.g., '100/100 Mbps'",
    )
    monthly_recurring_charge: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    installation_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    equipment_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    activation_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    total_upfront_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="installation + equipment + activation",
    )

    # Contract Terms
    contract_term_months: Mapped[int] = mapped_column(
        default=12,
        nullable=False,
        comment="Contract length in months",
    )
    early_termination_fee: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    promo_discount_months: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Promotional discount duration",
    )
    promo_monthly_discount: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    # Validity
    valid_until: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="Quote expiration date",
    )

    # Delivery
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    viewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Acceptance/Rejection
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    rejected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # E-Signature
    signature_data: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="E-signature details: {signed_by, signed_at, ip_address, signature_image_url}",
    )

    # Line Items (detailed breakdown)
    line_items: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Itemized pricing",
    )

    # Custom Fields
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    lead = relationship("Lead", back_populates="quotes")

    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "quote_number", name="uq_quote_tenant_number"),
        Index("ix_quote_lead", "lead_id"),
        Index("ix_quote_status", "tenant_id", "status"),
        Index("ix_quote_valid_until", "valid_until"),
    )

    def __repr__(self) -> str:
        return f"<Quote(id={self.id}, number={self.quote_number}, status={self.status})>"

    @property
    def is_expired(self) -> bool:
        """Check if quote has expired."""
        return datetime.now(UTC) > self.valid_until

    @property
    def total_first_year_cost(self) -> Decimal:
        """Calculate total first year cost including upfront and recurring."""
        return self.total_upfront_cost + (self.monthly_recurring_charge * 12)


class SiteSurvey(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    Site Survey.

    Technical assessment of service location to determine feasibility and requirements.
    """

    __tablename__ = "site_surveys"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Survey Information
    survey_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    status: Mapped[SiteSurveyStatus] = mapped_column(
        SQLEnum(SiteSurveyStatus, values_callable=lambda x: [e.value for e in x]),
        default=SiteSurveyStatus.SCHEDULED,
        nullable=False,
        index=True,
    )

    # Link to Lead
    lead_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Scheduling
    scheduled_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    completed_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Assignment
    technician_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Technical Assessment
    serviceability: Mapped[Serviceability] = mapped_column(
        SQLEnum(Serviceability, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )
    nearest_fiber_distance_meters: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Distance from nearest fiber drop point",
    )
    requires_fiber_extension: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )
    fiber_extension_cost: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    # Network Details
    nearest_olt_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Nearest OLT device ID",
    )
    available_pon_ports: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Available PON ports at nearest OLT",
    )

    # Installation Requirements
    estimated_installation_time_hours: Mapped[int | None] = mapped_column(
        nullable=True,
    )
    special_equipment_required: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    installation_complexity: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="simple, moderate, complex",
    )

    # Site Photos
    photos: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Site photos: [{url, description, timestamp}]",
    )

    # Survey Results
    recommendations: Mapped[str | None] = mapped_column(Text, nullable=True)
    obstacles: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Obstacles or challenges identified",
    )

    # Custom Fields
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    lead = relationship("Lead", back_populates="site_surveys")

    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "survey_number", name="uq_survey_tenant_number"),
        Index("ix_survey_lead", "lead_id"),
        Index("ix_survey_status", "tenant_id", "status"),
        Index("ix_survey_scheduled", "scheduled_date"),
        Index("ix_survey_technician", "technician_id"),
    )

def __repr__(self) -> str:
    return f"<SiteSurvey(id={self.id}, number={self.survey_number}, status={self.status})>"


def _get_metadata(instance: Any) -> dict[str, Any]:
    """Helper to return metadata dict with safe default."""
    value = getattr(instance, "metadata_", None)
    return value if isinstance(value, dict) else {}


def _set_metadata(instance: Any, value: dict[str, Any] | None) -> None:
    """Helper to set metadata dict ensuring non-null default."""
    setattr(instance, "metadata_", value or {})


# SAFE ALIASES: Preserve legacy attribute without breaking SQLAlchemy metadata handling
Lead.metadata = property(_get_metadata, _set_metadata)  # type: ignore[attr-defined]
Quote.metadata = property(_get_metadata, _set_metadata)  # type: ignore[attr-defined]
SiteSurvey.metadata = property(_get_metadata, _set_metadata)  # type: ignore[attr-defined]
