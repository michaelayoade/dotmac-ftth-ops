"""
Pydantic schemas for Customer Management module.

Provides request/response validation models following project patterns.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from dotmac.platform.customer_management.models import (
    ActivityType,
    CommunicationChannel,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)


class ISPServiceInfo(BaseModel):  # BaseModel resolves to Any in isolation
    """ISP-specific service information."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    # Service address
    service_address_line1: str | None = Field(None, max_length=200)
    service_address_line2: str | None = Field(None, max_length=200)
    service_city: str | None = Field(None, max_length=100)
    service_state_province: str | None = Field(None, max_length=100)
    service_postal_code: str | None = Field(None, max_length=20)
    service_country: str | None = Field(None, pattern="^[A-Z]{2}$")
    service_coordinates: dict[str, Any] = Field(default_factory=dict, description="GPS: {lat, lon}")

    # Installation
    installation_status: str | None = Field(
        None,
        pattern="^(pending|scheduled|in_progress|completed|failed|canceled)$",
    )
    scheduled_installation_date: datetime | None = None
    installation_notes: str | None = None

    # Service details
    connection_type: str | None = Field(None, pattern="^(ftth|wireless|dsl|cable|fiber|hybrid)$")
    last_mile_technology: str | None = Field(None, max_length=50)
    service_plan_speed: str | None = Field(None, max_length=50)

    # Network assignments
    assigned_devices: dict[str, Any] = Field(default_factory=lambda: {})
    current_bandwidth_profile: str | None = Field(None, max_length=50)
    static_ip_assigned: str | None = Field(None, max_length=45)
    ipv6_prefix: str | None = Field(None, max_length=50)


class CustomerBase(BaseModel):  # BaseModel resolves to Any in isolation
    """Base customer schema with common fields."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
        from_attributes=True,
    )

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    middle_name: str | None = Field(None, max_length=100)
    display_name: str | None = Field(None, max_length=200)
    company_name: str | None = Field(None, max_length=200)

    email: EmailStr
    phone: str | None = Field(None, max_length=30)
    mobile: str | None = Field(None, max_length=30)

    customer_type: CustomerType = Field(default=CustomerType.INDIVIDUAL)
    tier: CustomerTier = Field(default=CustomerTier.FREE)

    # Address
    address_line1: str | None = Field(None, max_length=200)
    address_line2: str | None = Field(None, max_length=200)
    city: str | None = Field(None, max_length=100)
    state_province: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    country: str | None = Field(None, pattern="^[A-Z]{2}$", description="ISO 3166-1 alpha-2")

    # Preferences
    preferred_channel: CommunicationChannel = Field(default=CommunicationChannel.EMAIL)
    preferred_language: str = Field(default="en", max_length=10)
    timezone: str = Field(default="UTC", max_length=50)
    opt_in_marketing: bool = Field(default=False)
    opt_in_updates: bool = Field(default=True)

    # Business fields
    tax_id: str | None = Field(None, max_length=50)
    vat_number: str | None = Field(None, max_length=50)
    industry: str | None = Field(None, max_length=100)

    @field_validator("phone", "mobile")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v and not v.replace("+", "").replace("-", "").replace(" ", "").isdigit():
            raise ValueError("Phone number must contain only digits, +, -, and spaces")
        return v

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        # Preserve caller-provided casing while ensuring we return a plain string
        return str(v)


class CustomerCreate(CustomerBase):  # CustomerBase resolves to Any in isolation
    """Schema for creating a new customer."""

    external_id: str | None = Field(None, max_length=100)
    source_system: str | None = Field(None, max_length=50)
    tags: list[str] = Field(default_factory=lambda: [])
    metadata: dict[str, Any] = Field(default_factory=lambda: {})
    custom_fields: dict[str, Any] = Field(default_factory=lambda: {})

    # Optional assignment
    assigned_to: UUID | None = None
    segment_id: UUID | None = None

    # ISP-specific fields
    service_address_line1: str | None = Field(None, max_length=200)
    service_address_line2: str | None = Field(None, max_length=200)
    service_city: str | None = Field(None, max_length=100)
    service_state_province: str | None = Field(None, max_length=100)
    service_postal_code: str | None = Field(None, max_length=20)
    service_country: str | None = Field(None, pattern="^[A-Z]{2}$")
    service_coordinates: dict[str, Any] = Field(default_factory=lambda: {})
    installation_status: str | None = None
    scheduled_installation_date: datetime | None = None
    installation_technician_id: UUID | None = None
    installation_notes: str | None = None
    connection_type: str | None = None
    last_mile_technology: str | None = None
    service_plan_speed: str | None = None
    assigned_devices: dict[str, Any] = Field(default_factory=lambda: {})
    current_bandwidth_profile: str | None = None
    static_ip_assigned: str | None = None
    ipv6_prefix: str | None = None


class CustomerUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating customer information."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    # All fields optional for partial updates
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    middle_name: str | None = Field(None, max_length=100)
    display_name: str | None = Field(None, max_length=200)
    company_name: str | None = Field(None, max_length=200)

    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=30)
    mobile: str | None = Field(None, max_length=30)

    status: CustomerStatus | None = None
    customer_type: CustomerType | None = None
    tier: CustomerTier | None = None

    # Address
    address_line1: str | None = Field(None, max_length=200)
    address_line2: str | None = Field(None, max_length=200)
    city: str | None = Field(None, max_length=100)
    state_province: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    country: str | None = Field(None, pattern="^[A-Z]{2}$")

    # Preferences
    preferred_channel: CommunicationChannel | None = None
    preferred_language: str | None = Field(None, max_length=10)
    timezone: str | None = Field(None, max_length=50)
    opt_in_marketing: bool | None = None
    opt_in_updates: bool | None = None

    # Business fields
    tax_id: str | None = Field(None, max_length=50)
    vat_number: str | None = Field(None, max_length=50)
    industry: str | None = Field(None, max_length=100)
    employee_count: int | None = Field(None, ge=0)

    # Relationships
    assigned_to: UUID | None = None
    segment_id: UUID | None = None

    # Metadata
    metadata: dict[str, Any] | None = None
    custom_fields: dict[str, Any] | None = None
    tags: list[str] | None = None

    # ISP-specific fields
    service_address_line1: str | None = Field(None, max_length=200)
    service_address_line2: str | None = Field(None, max_length=200)
    service_city: str | None = Field(None, max_length=100)
    service_state_province: str | None = Field(None, max_length=100)
    service_postal_code: str | None = Field(None, max_length=20)
    service_country: str | None = Field(None, pattern="^[A-Z]{2}$")
    service_coordinates: dict[str, Any] | None = None
    installation_status: str | None = None
    scheduled_installation_date: datetime | None = None
    installation_technician_id: UUID | None = None
    installation_notes: str | None = None
    connection_type: str | None = None
    last_mile_technology: str | None = None
    service_plan_speed: str | None = None
    assigned_devices: dict[str, Any] | None = None
    current_bandwidth_profile: str | None = None
    static_ip_assigned: str | None = None
    ipv6_prefix: str | None = None


class CustomerResponse(CustomerBase):  # CustomerBase resolves to Any in isolation
    """Schema for customer response."""

    id: UUID
    customer_number: str
    status: CustomerStatus

    # Verification status
    email_verified: bool
    phone_verified: bool

    # Metrics
    lifetime_value: Decimal
    total_purchases: int
    average_order_value: Decimal
    last_purchase_date: datetime | None = None
    first_purchase_date: datetime | None = None

    # Scoring
    risk_score: int
    satisfaction_score: int | None = None
    net_promoter_score: int | None = None

    # Dates
    acquisition_date: datetime
    last_contact_date: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Relationships
    user_id: UUID | None = None
    assigned_to: UUID | None = None
    segment_id: UUID | None = None

    # Metadata
    tags: list[str]
    metadata: dict[str, Any]
    custom_fields: dict[str, Any]

    # ISP-specific fields
    service_address_line1: str | None = None
    service_address_line2: str | None = None
    service_city: str | None = None
    service_state_province: str | None = None
    service_postal_code: str | None = None
    service_country: str | None = None
    service_coordinates: dict[str, Any] = Field(default_factory=lambda: {})
    installation_status: str | None = None
    installation_date: datetime | None = None
    scheduled_installation_date: datetime | None = None
    installation_technician_id: UUID | None = None
    installation_notes: str | None = None
    connection_type: str | None = None
    last_mile_technology: str | None = None
    service_plan_speed: str | None = None
    assigned_devices: dict[str, Any] = Field(default_factory=lambda: {})
    current_bandwidth_profile: str | None = None
    static_ip_assigned: str | None = None
    ipv6_prefix: str | None = None
    avg_uptime_percent: Decimal | None = None
    last_outage_date: datetime | None = None
    total_outages: int = 0
    total_downtime_minutes: int = 0


class CustomerListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for customer list endpoint."""

    model_config = ConfigDict()

    customers: list[CustomerResponse]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    has_next: bool
    has_prev: bool


class CustomerSearchParams(BaseModel):  # BaseModel resolves to Any in isolation
    """Parameters for searching customers."""

    model_config = ConfigDict()

    query: str | None = Field(None, description="Search query")
    status: CustomerStatus | None = None
    customer_type: CustomerType | None = None
    tier: CustomerTier | None = None
    country: str | None = Field(None, pattern="^[A-Z]{2}$")
    assigned_to: UUID | None = None
    segment_id: UUID | None = None
    tags: list[str] | None = None

    # Date filters
    created_after: datetime | None = None
    created_before: datetime | None = None
    last_purchase_after: datetime | None = None
    last_purchase_before: datetime | None = None

    # Value filters
    min_lifetime_value: Decimal | None = Field(None, ge=0)
    max_lifetime_value: Decimal | None = Field(None, ge=0)

    # ISP-specific filters
    installation_status: str | None = None
    connection_type: str | None = None
    service_city: str | None = None
    service_state_province: str | None = None
    service_country: str | None = Field(None, pattern="^[A-Z]{2}$")

    # Network parameter filters
    static_ip_assigned: str | None = Field(None, description="Search by static IPv4 address")
    ipv6_prefix: str | None = Field(None, description="Search by IPv6 prefix")
    current_bandwidth_profile: str | None = Field(
        None, description="Search by bandwidth/QoS profile"
    )
    last_mile_technology: str | None = Field(
        None, description="Search by technology (gpon, xgs-pon, etc)"
    )
    device_serial: str | None = Field(
        None, description="Search by device serial number (ONU, CPE, router)"
    )

    # Pagination
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: str = Field(default="created_at")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")


class CustomerActivityCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for creating customer activity."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    activity_type: ActivityType
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=lambda: {})
    ip_address: str | None = Field(None, max_length=45)
    user_agent: str | None = Field(None, max_length=500)


class CustomerActivityResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response schema for customer activity."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    activity_type: ActivityType
    title: str
    description: str | None = None
    metadata: dict[str, Any]
    performed_by: UUID | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime


class CustomerNoteCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for creating customer note."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    subject: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    is_internal: bool = Field(default=True)


class CustomerNoteResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response schema for customer note."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    subject: str
    content: str
    is_internal: bool
    created_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class CustomerSegmentCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for creating customer segment."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )

    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    criteria: dict[str, Any] = Field(default_factory=lambda: {})
    is_dynamic: bool = Field(default=False)
    priority: int = Field(default=0, ge=0)


class CustomerSegmentResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response schema for customer segment."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    criteria: dict[str, Any]
    is_dynamic: bool
    priority: int
    member_count: int
    last_calculated: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CustomerSegmentSummary(BaseModel):  # BaseModel resolves to Any in isolation
    """Summary of a customer segment for metrics."""

    model_config = ConfigDict()

    name: str
    count: int


class CustomerMetrics(BaseModel):  # BaseModel resolves to Any in isolation
    """Customer metrics and analytics."""

    model_config = ConfigDict()

    total_customers: int
    active_customers: int
    new_customers_this_month: int
    churn_rate: float
    average_lifetime_value: Decimal
    total_revenue: Decimal

    # By status
    customers_by_status: dict[str, int]

    # By tier
    customers_by_tier: dict[str, int]

    # By type
    customers_by_type: dict[str, int]

    # Top segments
    top_segments: list[CustomerSegmentSummary]
