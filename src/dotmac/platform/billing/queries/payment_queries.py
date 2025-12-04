"""Payment Queries - Read operations for payments"""

from datetime import datetime

from pydantic import Field

from .invoice_queries import BaseQuery


class GetPaymentQuery(BaseQuery):
    """Get single payment by ID"""

    payment_id: str = Field(..., description="Payment identifier")
    include_invoice: bool = Field(default=True)


class ListPaymentsQuery(BaseQuery):
    """List payments with filtering"""

    customer_id: str | None = None
    invoice_id: str | None = None
    status: str | None = None
    created_after: datetime | None = None
    created_before: datetime | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)


class GetPaymentsByCustomerQuery(BaseQuery):
    """Get all payments for customer"""

    customer_id: str = Field(..., description="Customer identifier")
    limit: int = Field(default=100, ge=1, le=500)


class GetPaymentsByInvoiceQuery(BaseQuery):
    """Get all payments for invoice"""

    invoice_id: str = Field(..., description="Invoice identifier")


class GetPaymentStatisticsQuery(BaseQuery):
    """Get payment statistics for period"""

    start_date: datetime = Field(..., description="Period start")
    end_date: datetime = Field(..., description="Period end")
    group_by: str | None = Field(None, description="Group by field")
