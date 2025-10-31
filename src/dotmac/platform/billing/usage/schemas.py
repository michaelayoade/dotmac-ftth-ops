"""
Pydantic schemas for usage billing API.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import BilledStatus, UsageType


class UsageRecordCreate(BaseModel):
    """Schema for creating a usage record with unit prices expressed in major currency units."""

    model_config = ConfigDict(str_strip_whitespace=True)

    subscription_id: str = Field(min_length=1, max_length=50)
    customer_id: UUID
    usage_type: UsageType
    quantity: Decimal = Field(decimal_places=6)
    unit: str = Field(min_length=1, max_length=20)
    unit_price: Decimal = Field(
        ge=0,
        decimal_places=6,
        description="Price per unit in major currency units (e.g., dollars); not cents.",
    )
    period_start: datetime
    period_end: datetime
    source_system: str = Field(min_length=1, max_length=50)
    source_record_id: str | None = Field(None, max_length=100)
    description: str | None = None
    device_id: str | None = Field(None, max_length=100)
    service_location: str | None = Field(None, max_length=500)


class UsageRecordBulkCreate(BaseModel):
    """Schema for bulk creating usage records."""

    model_config = ConfigDict()

    records: list[UsageRecordCreate] = Field(min_length=1, max_length=1000)


class UsageRecordUpdate(BaseModel):
    """Schema for updating a usage record."""

    model_config = ConfigDict()

    quantity: Decimal | None = Field(None, decimal_places=6)
    unit_price: Decimal | None = Field(None, ge=0, decimal_places=6)
    billed_status: BilledStatus | None = None
    invoice_id: str | None = None
    description: str | None = None


class UsageRecordResponse(BaseModel):
    """Response schema for usage record."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    subscription_id: str
    customer_id: UUID
    usage_type: UsageType
    quantity: Decimal
    unit: str
    unit_price: Decimal
    total_amount: int  # in cents
    currency: str
    period_start: datetime
    period_end: datetime
    billed_status: BilledStatus
    invoice_id: str | None
    billed_at: datetime | None
    source_system: str
    source_record_id: str | None
    description: str | None
    device_id: str | None
    service_location: str | None
    created_at: datetime
    updated_at: datetime


class UsageAggregateResponse(BaseModel):
    """Response schema for usage aggregate."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    subscription_id: str | None
    customer_id: UUID | None
    usage_type: UsageType
    period_start: datetime
    period_end: datetime
    period_type: str
    total_quantity: Decimal
    total_amount: int  # in cents
    record_count: int
    min_quantity: Decimal | None
    max_quantity: Decimal | None


class UsageSummary(BaseModel):
    """Summary of usage for a period."""

    model_config = ConfigDict()

    usage_type: UsageType
    total_quantity: Decimal
    total_amount: int  # in cents
    currency: str = Field(..., min_length=3, max_length=3, description="Currency code (ISO 4217)")
    record_count: int
    period_start: datetime
    period_end: datetime


class UsageStats(BaseModel):
    """Usage statistics for analytics."""

    model_config = ConfigDict()

    total_records: int
    total_amount: int  # in cents
    pending_amount: int  # in cents
    billed_amount: int  # in cents
    by_type: dict[str, UsageSummary]
    period_start: datetime
    period_end: datetime


class UsageReportRequest(BaseModel):
    """Request schema for generating a usage report."""

    model_config = ConfigDict()

    subscription_id: str | None = Field(default=None, max_length=50)
    customer_id: UUID | None = None
    period_start: datetime
    period_end: datetime
    usage_types: list[UsageType] | None = Field(
        default=None, description="Optional list of usage types to include. Defaults to all types."
    )


class UsageReport(BaseModel):
    """Aggregated usage report response."""

    model_config = ConfigDict()

    tenant_id: str
    subscription_id: str | None
    customer_id: UUID | None
    period_start: datetime
    period_end: datetime
    total_quantity: Decimal
    total_amount: int  # in cents
    currency: str = Field(..., min_length=3, max_length=3)
    usage_by_type: dict[UsageType, UsageSummary]


__all__ = [
    "UsageRecordCreate",
    "UsageRecordBulkCreate",
    "UsageRecordUpdate",
    "UsageRecordResponse",
    "UsageAggregateResponse",
    "UsageSummary",
    "UsageStats",
    "UsageReportRequest",
    "UsageReport",
]
