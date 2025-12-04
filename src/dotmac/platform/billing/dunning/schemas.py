"""
Pydantic schemas for Dunning & Collections module.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.billing.dunning.models import (
    DunningActionType,
    DunningExecutionStatus,
)


class DunningActionConfig(BaseModel):
    """Configuration for a single dunning action."""

    model_config = ConfigDict(str_strip_whitespace=True)

    type: DunningActionType
    delay_days: int = Field(ge=0, description="Days to wait before executing this action")
    template: str | None = Field(None, description="Template name for email/SMS")
    webhook_url: str | None = Field(None, description="Webhook URL if action type is webhook")
    custom_config: dict[str, Any] = Field(default_factory=dict, description="Custom configuration")


class DunningExclusionRules(BaseModel):
    """Rules for excluding subscriptions from dunning."""

    model_config = ConfigDict()

    min_lifetime_value: float | None = Field(
        default=None, ge=0, description="Exclude customers above this LTV"
    )
    customer_tiers: list[str] = Field(default_factory=list, description="Exclude these tiers")
    customer_tags: list[str] = Field(
        default_factory=list, description="Exclude customers with these tags"
    )


class DunningCampaignCreate(BaseModel):
    """Schema for creating a dunning campaign."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    trigger_after_days: int = Field(ge=0, description="Days past due before triggering")
    max_retries: int = Field(default=3, ge=0, le=10)
    retry_interval_days: int = Field(default=3, ge=1, le=30)
    actions: list[DunningActionConfig] = Field(min_length=1, description="Action sequence")
    exclusion_rules: DunningExclusionRules = Field(default=DunningExclusionRules())
    priority: int = Field(default=0, ge=0, le=100)
    is_active: bool = Field(default=True)


class DunningCampaignUpdate(BaseModel):
    """Schema for updating a dunning campaign."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    trigger_after_days: int | None = Field(None, ge=0)
    max_retries: int | None = Field(None, ge=0, le=10)
    retry_interval_days: int | None = Field(None, ge=1, le=30)
    actions: list[DunningActionConfig] | None = None
    exclusion_rules: DunningExclusionRules | None = None
    priority: int | None = Field(None, ge=0, le=100)
    is_active: bool | None = None


class DunningCampaignResponse(BaseModel):
    """Response schema for dunning campaign."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    name: str
    description: str | None
    trigger_after_days: int
    max_retries: int
    retry_interval_days: int
    actions: list[dict[str, Any]]
    exclusion_rules: dict[str, Any]
    is_active: bool
    priority: int

    # Statistics
    total_executions: int
    successful_executions: int
    total_recovered_amount: int

    # Timestamps
    created_at: datetime
    updated_at: datetime


class DunningExecutionResponse(BaseModel):
    """Response schema for dunning execution."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    tenant_id: str
    campaign_id: UUID
    subscription_id: str
    customer_id: UUID
    invoice_id: str | None

    # Status
    status: DunningExecutionStatus
    current_step: int
    total_steps: int
    retry_count: int

    # Timing
    started_at: datetime
    next_action_at: datetime | None
    completed_at: datetime | None

    # Amounts (in cents)
    outstanding_amount: int
    recovered_amount: int

    # Execution log
    execution_log: list[dict[str, Any]]

    # Cancellation
    canceled_reason: str | None
    canceled_by_user_id: UUID | None

    # Metadata
    metadata: dict[str, Any] = Field(alias="metadata", validation_alias="metadata_")

    # Timestamps
    created_at: datetime
    updated_at: datetime


class DunningExecutionListResponse(BaseModel):
    """Response for dunning execution list endpoint."""

    model_config = ConfigDict()

    executions: list[DunningExecutionResponse]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    has_next: bool
    has_prev: bool


class DunningCancelRequest(BaseModel):
    """Request to cancel a dunning execution."""

    model_config = ConfigDict(str_strip_whitespace=True)

    reason: str = Field(min_length=1, max_length=500, description="Cancellation reason")


class DunningActionLogResponse(BaseModel):
    """Response schema for dunning action log."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    execution_id: UUID
    action_type: DunningActionType
    action_config: dict[str, Any]
    step_number: int
    executed_at: datetime
    status: str
    result: dict[str, Any]
    error_message: str | None
    external_id: str | None


class DunningExecutionStart(BaseModel):
    """Request to start a new dunning execution."""

    model_config = ConfigDict(str_strip_whitespace=True)

    campaign_id: UUID
    subscription_id: str = Field(min_length=1, max_length=50)
    customer_id: UUID
    invoice_id: str | None = Field(None, max_length=50)
    outstanding_amount: int = Field(gt=0, description="Amount owed in cents")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class DunningCampaignStats(BaseModel):
    """Statistics for a specific campaign."""

    model_config = ConfigDict()

    campaign_id: UUID
    campaign_name: str
    total_executions: int
    active_executions: int
    completed_executions: int
    successful_executions: int
    failed_executions: int
    canceled_executions: int
    total_recovered_amount: int  # in cents
    total_outstanding_amount: int  # in cents
    success_rate: float  # percentage
    recovery_rate: float  # percentage
    average_recovery_amount: float  # currency in cents
    average_completion_time_hours: float


class DunningStats(BaseModel):
    """Dunning campaign statistics."""

    model_config = ConfigDict()

    total_campaigns: int
    active_campaigns: int
    total_executions: int
    active_executions: int
    completed_executions: int
    successful_recoveries: int
    failed_executions: int
    canceled_executions: int
    total_recovered_amount: int  # in cents
    average_recovery_amount: float  # in cents
    average_recovery_rate: float  # percentage
    average_completion_time_hours: float


__all__ = [
    "DunningActionConfig",
    "DunningExclusionRules",
    "DunningCampaignCreate",
    "DunningCampaignUpdate",
    "DunningCampaignResponse",
    "DunningExecutionStart",
    "DunningExecutionResponse",
    "DunningExecutionListResponse",
    "DunningCancelRequest",
    "DunningActionLogResponse",
    "DunningCampaignStats",
    "DunningStats",
]
