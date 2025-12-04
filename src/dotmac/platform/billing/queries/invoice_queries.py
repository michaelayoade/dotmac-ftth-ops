"""
Invoice Queries - Read operations for invoices

Queries are simple DTOs that specify what data is needed.
They don't contain business logic, just parameters for data retrieval.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BaseQuery(BaseModel):
    """Base query with common fields"""

    model_config = ConfigDict(
        frozen=True,  # Queries are immutable
        str_strip_whitespace=True,
    )

    tenant_id: str = Field(..., description="Tenant identifier for isolation")
    user_id: str | None = Field(None, description="User making the query")


class GetInvoiceQuery(BaseQuery):
    """
    Query to get a single invoice by ID.

    Returns complete invoice with all line items.
    """

    invoice_id: str = Field(..., description="Invoice identifier")
    include_line_items: bool = Field(default=True, description="Include line items")
    include_payments: bool = Field(default=True, description="Include payment history")


class ListInvoicesQuery(BaseQuery):
    """
    Query to list invoices with filtering and pagination.

    Optimized for fast retrieval using read models.
    """

    # Filters
    customer_id: str | None = Field(None, description="Filter by customer")
    status: str | None = Field(None, description="Filter by status (draft, open, paid, void)")
    subscription_id: str | None = Field(None, description="Filter by subscription")
    created_after: datetime | None = Field(None, description="Filter by creation date")
    created_before: datetime | None = Field(None, description="Filter by creation date")
    due_after: datetime | None = Field(None, description="Filter by due date")
    due_before: datetime | None = Field(None, description="Filter by due date")

    # Pagination
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=50, ge=1, le=100, description="Items per page")

    # Sorting
    sort_by: str = Field(default="created_at", description="Sort field")
    sort_order: str = Field(default="desc", description="Sort order (asc/desc)")

    # Includes
    include_line_items: bool = Field(default=False, description="Include line items")
    include_totals: bool = Field(default=True, description="Include summary totals")


class GetInvoicesByCustomerQuery(BaseQuery):
    """
    Query to get all invoices for a specific customer.

    Returns invoices ordered by creation date.
    """

    customer_id: str = Field(..., description="Customer identifier")
    status: str | None = Field(None, description="Filter by status")
    limit: int = Field(default=100, ge=1, le=500, description="Maximum results")
    include_line_items: bool = Field(default=False, description="Include line items")


class GetOverdueInvoicesQuery(BaseQuery):
    """
    Query to get all overdue invoices.

    Returns invoices past due date with unpaid balance.
    """

    customer_id: str | None = Field(None, description="Filter by customer")
    days_overdue: int | None = Field(None, ge=1, description="Minimum days overdue")
    sort_by: str = Field(default="due_date", description="Sort field")
    limit: int = Field(default=100, ge=1, le=500, description="Maximum results")


class GetInvoiceStatisticsQuery(BaseQuery):
    """
    Query to get invoice statistics for a time period.

    Returns aggregated metrics: total invoices, total amount, paid/unpaid counts.
    """

    start_date: datetime = Field(..., description="Period start date")
    end_date: datetime = Field(..., description="Period end date")
    customer_id: str | None = Field(None, description="Filter by customer")
    group_by: str | None = Field(None, description="Group by field (status, customer, month)")


class GetInvoicesByStatusQuery(BaseQuery):
    """Query to get invoices by status"""

    status: str = Field(..., description="Invoice status")
    limit: int = Field(default=100, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class GetDraftInvoicesQuery(BaseQuery):
    """Query to get all draft invoices for tenant"""

    created_after: datetime | None = None
    limit: int = Field(default=100, ge=1, le=500)


class GetUnpaidInvoicesQuery(BaseQuery):
    """
    Query to get all unpaid invoices.

    Includes partially paid invoices with remaining balance.
    """

    customer_id: str | None = None
    include_partially_paid: bool = Field(default=True)
    limit: int = Field(default=100, ge=1, le=500)


class SearchInvoicesQuery(BaseQuery):
    """
    Query to search invoices by various criteria.

    Full-text search across invoice number, customer email, notes.
    """

    search_term: str = Field(..., min_length=2, description="Search term")
    search_fields: list[str] = Field(
        default=["invoice_number", "billing_email", "notes"],
        description="Fields to search",
    )
    limit: int = Field(default=50, ge=1, le=200)


class GetInvoiceTimelineQuery(BaseQuery):
    """
    Query to get invoice event timeline.

    Returns chronological history: created, sent, paid, voided, etc.
    """

    invoice_id: str = Field(..., description="Invoice identifier")
    include_payment_events: bool = Field(default=True)
    include_email_events: bool = Field(default=True)
