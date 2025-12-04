"""
Receipt data models
"""

from datetime import datetime
from typing import Any
from uuid import uuid4

from pydantic import ConfigDict, Field

from dotmac.platform.billing.core.models import BillingBaseModel
from dotmac.platform.core.pydantic import AppBaseModel


class ReceiptLineItem(AppBaseModel):  # type: ignore[misc]  # AppBaseModel resolves to Any in isolation
    """Receipt line item"""

    line_item_id: str = Field(default_factory=lambda: str(uuid4()))
    description: str = Field(..., min_length=1, max_length=500)
    quantity: int = Field(1, ge=1)
    unit_price: int = Field(..., description="Unit price in minor units")
    total_price: int = Field(..., description="Total price in minor units")

    # Tax information
    tax_rate: float = Field(0.0, ge=0, le=100)
    tax_amount: int = Field(0)

    # Product reference
    product_id: str | None = None
    sku: str | None = None

    # Metadata
    extra_data: dict[str, Any] = Field(default_factory=lambda: {})


class Receipt(BillingBaseModel):  # type: ignore[misc]  # BillingBaseModel resolves to Any in isolation
    """Receipt for payments and transactions"""

    receipt_id: str = Field(default_factory=lambda: str(uuid4()))
    receipt_number: str = Field(..., description="Human-readable receipt number")

    # References
    payment_id: str | None = Field(None, description="Associated payment")
    invoice_id: str | None = Field(None, description="Associated invoice")
    customer_id: str = Field(..., description="Customer ID")

    # Receipt details
    issue_date: datetime = Field(default_factory=datetime.utcnow)
    currency: str = Field("USD", min_length=3, max_length=3)

    # Amounts in minor units
    subtotal: int = Field(..., ge=0)
    tax_amount: int = Field(0, ge=0)
    total_amount: int = Field(..., ge=0)

    # Payment information
    payment_method: str = Field(..., description="Payment method used")
    payment_status: str = Field(..., description="Payment status")

    # Line items
    line_items: list[ReceiptLineItem] = Field(min_length=1)

    # Customer information
    customer_name: str = Field(..., min_length=1)
    customer_email: str = Field(..., description="Customer email")
    billing_address: dict[str, str] = Field(default_factory=lambda: {})

    # Content
    notes: str | None = Field(None, max_length=1000)

    # Receipt generation
    pdf_url: str | None = Field(None, description="URL to PDF receipt")
    html_content: str | None = Field(None, description="HTML receipt content")

    # Delivery
    sent_at: datetime | None = Field(None, description="When receipt was sent")
    delivery_method: str | None = Field(None, description="How receipt was delivered")

    # Metadata
    extra_data: dict[str, Any] = Field(default_factory=lambda: {})

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "receipt_id": "rec_1234567890",
                "receipt_number": "REC-2024-000001",
                "customer_id": "cust_123",
                "customer_name": "John Doe",
                "customer_email": "john@example.com",
                "payment_id": "pay_123",
                "invoice_id": "inv_123",
                "currency": "USD",
                "subtotal": 10000,
                "tax_amount": 800,
                "total_amount": 10800,
                "payment_method": "credit_card",
                "payment_status": "completed",
                "line_items": [
                    {
                        "description": "Product License",
                        "quantity": 1,
                        "unit_price": 10000,
                        "total_price": 10000,
                        "tax_rate": 8.0,
                        "tax_amount": 800,
                    }
                ],
            }
        }
    )
