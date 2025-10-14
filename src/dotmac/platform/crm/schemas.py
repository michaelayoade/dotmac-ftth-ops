"""
CRM Schemas.

Pydantic models for CRM API request/response validation.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from dotmac.platform.crm.models import (
    LeadSource,
    LeadStatus,
    QuoteStatus,
    Serviceability,
    SiteSurveyStatus,
)


# Lead Schemas
class LeadCreateRequest(BaseModel):
    """Request schema for creating a lead."""

    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = Field(None, max_length=30)
    company_name: str | None = Field(None, max_length=200)
    service_address_line1: str = Field(..., min_length=1, max_length=200)
    service_address_line2: str | None = Field(None, max_length=200)
    service_city: str = Field(..., min_length=1, max_length=100)
    service_state_province: str = Field(..., min_length=1, max_length=100)
    service_postal_code: str = Field(..., min_length=1, max_length=20)
    service_country: str = Field("US", max_length=2)
    service_coordinates: dict[str, Any] = Field(default_factory=dict)
    source: LeadSource = LeadSource.WEBSITE
    interested_service_types: list[str] = Field(default_factory=list)
    desired_bandwidth: str | None = Field(None, max_length=50)
    estimated_monthly_budget: Decimal | None = None
    desired_installation_date: datetime | None = None
    assigned_to_id: UUID | None = None
    partner_id: UUID | None = None
    priority: int = Field(3, ge=1, le=5)
    metadata: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None


class LeadUpdateRequest(BaseModel):
    """Request schema for updating a lead."""

    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=30)
    company_name: str | None = Field(None, max_length=200)
    service_address_line1: str | None = Field(None, min_length=1, max_length=200)
    service_address_line2: str | None = Field(None, max_length=200)
    service_city: str | None = Field(None, min_length=1, max_length=100)
    service_state_province: str | None = Field(None, min_length=1, max_length=100)
    service_postal_code: str | None = Field(None, min_length=1, max_length=20)
    service_country: str | None = Field(None, max_length=2)
    service_coordinates: dict[str, Any] | None = None
    interested_service_types: list[str] | None = None
    desired_bandwidth: str | None = Field(None, max_length=50)
    estimated_monthly_budget: Decimal | None = None
    desired_installation_date: datetime | None = None
    assigned_to_id: UUID | None = None
    partner_id: UUID | None = None
    priority: int | None = Field(None, ge=1, le=5)
    metadata: dict[str, Any] | None = None
    notes: str | None = None


class LeadStatusUpdateRequest(BaseModel):
    """Request schema for updating lead status."""

    status: LeadStatus


class LeadDisqualifyRequest(BaseModel):
    """Request schema for disqualifying a lead."""

    reason: str = Field(..., min_length=1)


class LeadServiceabilityUpdateRequest(BaseModel):
    """Request schema for updating lead serviceability."""

    serviceability: Serviceability
    notes: str | None = None


class LeadResponse(BaseModel):
    """Response schema for lead."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    lead_number: str
    status: LeadStatus
    source: LeadSource
    priority: int
    first_name: str
    last_name: str
    email: str
    phone: str | None
    company_name: str | None
    service_address_line1: str
    service_address_line2: str | None
    service_city: str
    service_state_province: str
    service_postal_code: str
    service_country: str
    service_coordinates: dict[str, Any]
    is_serviceable: Serviceability | None
    serviceability_checked_at: datetime | None
    serviceability_notes: str | None
    interested_service_types: list[str]
    desired_bandwidth: str | None
    estimated_monthly_budget: Decimal | None
    desired_installation_date: datetime | None
    assigned_to_id: UUID | None
    partner_id: UUID | None
    qualified_at: datetime | None
    disqualified_at: datetime | None
    disqualification_reason: str | None
    converted_at: datetime | None
    converted_to_customer_id: UUID | None
    first_contact_date: datetime | None
    last_contact_date: datetime | None
    expected_close_date: datetime | None
    metadata: dict[str, Any]
    notes: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    created_by_id: UUID | None
    updated_by_id: UUID | None


# Quote Schemas
class QuoteCreateRequest(BaseModel):
    """Request schema for creating a quote."""

    lead_id: UUID
    service_plan_name: str = Field(..., min_length=1, max_length=200)
    bandwidth: str = Field(..., min_length=1, max_length=50)
    monthly_recurring_charge: Decimal = Field(..., gt=0)
    installation_fee: Decimal = Field(Decimal("0.00"), ge=0)
    equipment_fee: Decimal = Field(Decimal("0.00"), ge=0)
    activation_fee: Decimal = Field(Decimal("0.00"), ge=0)
    contract_term_months: int = Field(12, gt=0)
    early_termination_fee: Decimal | None = Field(None, ge=0)
    promo_discount_months: int | None = Field(None, gt=0)
    promo_monthly_discount: Decimal | None = Field(None, gt=0)
    valid_days: int = Field(30, gt=0, le=365)
    line_items: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None


class QuoteAcceptRequest(BaseModel):
    """Request schema for accepting a quote."""

    signature_data: dict[str, Any] = Field(
        ..., description="E-signature data (name, date, IP, etc.)"
    )


class QuoteRejectRequest(BaseModel):
    """Request schema for rejecting a quote."""

    rejection_reason: str = Field(..., min_length=1)


class QuoteResponse(BaseModel):
    """Response schema for quote."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    quote_number: str
    status: QuoteStatus
    lead_id: UUID
    service_plan_name: str
    bandwidth: str
    monthly_recurring_charge: Decimal
    installation_fee: Decimal
    equipment_fee: Decimal
    activation_fee: Decimal
    total_upfront_cost: Decimal
    contract_term_months: int
    early_termination_fee: Decimal | None
    promo_discount_months: int | None
    promo_monthly_discount: Decimal | None
    valid_until: datetime
    sent_at: datetime | None
    viewed_at: datetime | None
    accepted_at: datetime | None
    rejected_at: datetime | None
    rejection_reason: str | None
    signature_data: dict[str, Any]
    line_items: list[dict[str, Any]]
    metadata: dict[str, Any]
    notes: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    created_by_id: UUID | None
    updated_by_id: UUID | None


# Site Survey Schemas
class SiteSurveyScheduleRequest(BaseModel):
    """Request schema for scheduling a site survey."""

    lead_id: UUID
    scheduled_date: datetime
    technician_id: UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None


class SiteSurveyCompleteRequest(BaseModel):
    """Request schema for completing a site survey."""

    serviceability: Serviceability
    nearest_fiber_distance_meters: int | None = Field(None, ge=0)
    requires_fiber_extension: bool = False
    fiber_extension_cost: Decimal | None = Field(None, ge=0)
    nearest_olt_id: str | None = Field(None, max_length=100)
    available_pon_ports: int | None = Field(None, ge=0)
    estimated_installation_time_hours: int | None = Field(None, gt=0)
    special_equipment_required: list[str] = Field(default_factory=list)
    installation_complexity: str | None = Field(None, max_length=20)
    photos: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: str | None = None
    obstacles: str | None = None


class SiteSurveyResponse(BaseModel):
    """Response schema for site survey."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    survey_number: str
    status: SiteSurveyStatus
    lead_id: UUID
    scheduled_date: datetime
    completed_date: datetime | None
    technician_id: UUID | None
    serviceability: Serviceability | None
    nearest_fiber_distance_meters: int | None
    requires_fiber_extension: bool
    fiber_extension_cost: Decimal | None
    nearest_olt_id: str | None
    available_pon_ports: int | None
    estimated_installation_time_hours: int | None
    special_equipment_required: list[str]
    installation_complexity: str | None
    photos: list[dict[str, Any]]
    recommendations: str | None
    obstacles: str | None
    metadata: dict[str, Any]
    notes: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    created_by_id: UUID | None
    updated_by_id: UUID | None
