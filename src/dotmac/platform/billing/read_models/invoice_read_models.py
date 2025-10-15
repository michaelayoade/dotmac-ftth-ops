"""
Invoice Read Models - Optimized for query performance

Read models are designed for specific query patterns and include
denormalized data to avoid joins and improve performance.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class InvoiceListItem(BaseModel):
    """
    Lightweight invoice model for list views.

    Includes only essential fields for displaying invoice lists.
    Optimized to avoid fetching full line items and nested data.
    """

    model_config = ConfigDict(from_attributes=True)

    invoice_id: str
    invoice_number: str
    customer_id: str
    customer_name: str = Field(..., description="Denormalized customer name")
    customer_email: str = Field(..., description="Denormalized customer email")

    # Amounts
    total_amount: int = Field(..., description="Total in minor units (cents)")
    remaining_balance: int = Field(..., description="Remaining balance in minor units")
    currency: str

    # Status
    status: str = Field(..., description="draft, open, paid, void, uncollectible")
    is_overdue: bool = Field(default=False, description="Computed overdue flag")

    # Dates
    created_at: datetime
    due_date: datetime
    paid_at: datetime | None = None

    # Quick stats (denormalized)
    line_item_count: int = Field(default=0, description="Number of line items")
    payment_count: int = Field(default=0, description="Number of payments")

    # Display helpers
    formatted_total: str = Field(..., description="Formatted amount (e.g., '$100.00')")
    formatted_balance: str = Field(..., description="Formatted balance")
    days_until_due: int | None = Field(None, description="Days until/since due date")


class InvoiceDetail(BaseModel):
    """
    Detailed invoice model for single invoice view.

    Includes all invoice data with related entities.
    """

    model_config = ConfigDict(from_attributes=True)

    invoice_id: str
    invoice_number: str
    tenant_id: str
    customer_id: str

    # Customer info (denormalized)
    customer_name: str
    customer_email: str
    billing_address: dict[str, str]

    # Line items
    line_items: list[dict[str, Any]] = Field(default_factory=lambda: [])

    # Amounts
    subtotal: int
    tax_amount: int
    discount_amount: int
    total_amount: int
    remaining_balance: int
    currency: str

    # Status and dates
    status: str
    created_at: datetime
    updated_at: datetime | None = None
    issue_date: datetime
    due_date: datetime
    finalized_at: datetime | None = None
    paid_at: datetime | None = None
    voided_at: datetime | None = None

    # Payments (denormalized summary)
    payments: list[dict[str, Any]] = Field(default_factory=lambda: [])
    total_paid: int = Field(default=0)

    # Notes
    notes: str | None = None
    internal_notes: str | None = None

    # Metadata
    subscription_id: str | None = None
    idempotency_key: str | None = None
    created_by: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=lambda: {})

    # Computed fields
    is_overdue: bool = Field(default=False)
    days_overdue: int | None = None
    payment_link: str | None = Field(None, description="Public payment link")


class InvoiceStatistics(BaseModel):
    """
    Aggregated invoice statistics.

    Used for dashboard metrics and reporting.
    """

    model_config = ConfigDict(from_attributes=True)

    # Count metrics
    total_count: int = Field(default=0, description="Total invoices")
    draft_count: int = Field(default=0)
    open_count: int = Field(default=0)
    paid_count: int = Field(default=0)
    void_count: int = Field(default=0)
    overdue_count: int = Field(default=0)

    # Amount metrics (all in minor units)
    total_amount: int = Field(default=0, description="Total invoiced amount")
    paid_amount: int = Field(default=0, description="Total paid amount")
    outstanding_amount: int = Field(default=0, description="Total unpaid amount")
    overdue_amount: int = Field(default=0, description="Total overdue amount")

    # Currency
    currency: str = Field(default="USD")

    # Averages
    average_invoice_amount: int = Field(default=0)
    average_payment_time_days: float | None = Field(None, description="Avg days to payment")

    # Trends
    period_start: datetime
    period_end: datetime
    previous_period_total: int | None = Field(None, description="For comparison")
    growth_rate: float | None = Field(None, description="Period over period growth")

    # Formatted values
    formatted_total: str = Field(default="$0.00")
    formatted_outstanding: str = Field(default="$0.00")


class CustomerInvoiceSummary(BaseModel):
    """
    Invoice summary for a specific customer.

    Denormalized view of customer's invoice history.
    """

    model_config = ConfigDict(from_attributes=True)

    customer_id: str
    customer_name: str
    customer_email: str

    # Invoice counts
    total_invoices: int = Field(default=0)
    paid_invoices: int = Field(default=0)
    unpaid_invoices: int = Field(default=0)
    overdue_invoices: int = Field(default=0)

    # Amounts
    lifetime_value: int = Field(default=0, description="Total paid amount")
    outstanding_balance: int = Field(default=0)
    overdue_balance: int = Field(default=0)
    currency: str = Field(default="USD")

    # Dates
    first_invoice_date: datetime | None = None
    last_invoice_date: datetime | None = None
    last_payment_date: datetime | None = None

    # Payment behavior
    average_days_to_pay: float | None = None
    on_time_payment_rate: float | None = Field(None, description="Percentage paid on time")
    payment_reliability_score: int | None = Field(None, ge=0, le=100)

    # Recent activity
    recent_invoices: list[InvoiceListItem] = Field(default_factory=lambda: [])


class OverdueInvoicesSummary(BaseModel):
    """Summary of overdue invoices for tenant"""

    model_config = ConfigDict()

    total_overdue: int = Field(default=0)
    total_amount_overdue: int = Field(default=0)
    currency: str = Field(default="USD")
    by_age: dict[str, int] = Field(
        default_factory=dict, description="Counts by age bucket: 1-30, 31-60, 61-90, 90+"
    )
    top_customers: list[dict[str, Any]] = Field(default_factory=lambda: [])
