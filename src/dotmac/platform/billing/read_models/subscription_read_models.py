"""Subscription Read Models"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SubscriptionListItem(BaseModel):
    """Lightweight subscription for lists"""

    model_config = ConfigDict(from_attributes=True)

    subscription_id: str
    customer_id: str
    customer_name: str
    plan_id: str
    plan_name: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool
    monthly_amount: int
    currency: str
    created_at: datetime


class SubscriptionDetail(BaseModel):
    """Detailed subscription view"""

    model_config = ConfigDict(from_attributes=True)

    subscription_id: str
    tenant_id: str
    customer_id: str
    plan_id: str
    status: str
    quantity: int
    billing_cycle_anchor: datetime
    current_period_start: datetime
    current_period_end: datetime
    trial_start: datetime | None
    trial_end: datetime | None
    cancel_at_period_end: bool
    cancelled_at: datetime | None
    ended_at: datetime | None
    created_at: datetime
    items: list[dict[str, Any]] = Field(default_factory=lambda: [])
    latest_invoice_id: str | None


class SubscriptionStatistics(BaseModel):
    """Subscription statistics"""

    model_config = ConfigDict(from_attributes=True)

    total_count: int = Field(default=0)
    active_count: int = Field(default=0)
    cancelled_count: int = Field(default=0)
    trial_count: int = Field(default=0)
    mrr: int = Field(default=0, description="Monthly Recurring Revenue")
    arr: int = Field(default=0, description="Annual Recurring Revenue")
    churn_rate: float = Field(default=0.0)
    growth_rate: float = Field(default=0.0)
    currency: str = Field(default="USD")
    period_start: datetime
    period_end: datetime
