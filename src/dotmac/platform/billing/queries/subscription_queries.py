"""Subscription Queries - Read operations for subscriptions"""

from pydantic import Field

from .invoice_queries import BaseQuery


class GetSubscriptionQuery(BaseQuery):
    """Get single subscription by ID"""

    subscription_id: str = Field(..., description="Subscription identifier")
    include_items: bool = Field(default=True)
    include_invoices: bool = Field(default=False)


class ListSubscriptionsQuery(BaseQuery):
    """List subscriptions with filtering"""

    customer_id: str | None = None
    status: str | None = None
    plan_id: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)


class GetSubscriptionsByCustomerQuery(BaseQuery):
    """Get all subscriptions for customer"""

    customer_id: str = Field(..., description="Customer identifier")
    status: str | None = None
    limit: int = Field(default=100, ge=1, le=500)


class GetActiveSubscriptionsQuery(BaseQuery):
    """Get all active subscriptions"""

    customer_id: str | None = None
    limit: int = Field(default=100, ge=1, le=500)


class GetExpiringSubscriptionsQuery(BaseQuery):
    """Get subscriptions expiring soon"""

    days_until_expiry: int = Field(default=30, ge=1, le=365)
    customer_id: str | None = None
    limit: int = Field(default=100, ge=1, le=500)
