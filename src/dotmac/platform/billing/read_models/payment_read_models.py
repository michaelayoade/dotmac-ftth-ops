"""Payment Read Models"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PaymentListItem(BaseModel):
    """Lightweight payment for lists"""

    model_config = ConfigDict(from_attributes=True)

    payment_id: str
    invoice_id: str | None
    customer_id: str
    customer_name: str
    amount: int
    currency: str
    status: str
    payment_method: str
    created_at: datetime
    formatted_amount: str


class PaymentDetail(BaseModel):
    """Detailed payment view"""

    model_config = ConfigDict(from_attributes=True)

    payment_id: str
    tenant_id: str
    invoice_id: str | None
    customer_id: str
    amount: int
    currency: str
    status: str
    payment_method_id: str
    payment_method: str
    provider: str
    external_payment_id: str | None
    created_at: datetime
    captured_at: datetime | None
    refunded_at: datetime | None
    refund_amount: int = Field(default=0)
    description: str | None
    failure_reason: str | None


class PaymentStatistics(BaseModel):
    """Payment statistics"""

    model_config = ConfigDict(from_attributes=True)

    total_count: int = Field(default=0)
    succeeded_count: int = Field(default=0)
    failed_count: int = Field(default=0)
    refunded_count: int = Field(default=0)
    total_amount: int = Field(default=0)
    refunded_amount: int = Field(default=0)
    currency: str = Field(default="USD")
    success_rate: float = Field(default=0.0)
    average_payment_amount: int = Field(default=0)
    period_start: datetime
    period_end: datetime
