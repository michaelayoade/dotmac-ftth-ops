"""
Billing Read Models - Optimized views for queries (CQRS Pattern)

Read models are denormalized, optimized representations of data
specifically designed for query performance.
"""

from .invoice_read_models import (
    CustomerInvoiceSummary,
    InvoiceDetail,
    InvoiceListItem,
    InvoiceStatistics,
)
from .payment_read_models import (
    PaymentDetail,
    PaymentListItem,
    PaymentStatistics,
)
from .subscription_read_models import (
    SubscriptionDetail,
    SubscriptionListItem,
    SubscriptionStatistics,
)

__all__ = [
    # Invoice Read Models
    "InvoiceListItem",
    "InvoiceDetail",
    "InvoiceStatistics",
    "CustomerInvoiceSummary",
    # Payment Read Models
    "PaymentListItem",
    "PaymentDetail",
    "PaymentStatistics",
    # Subscription Read Models
    "SubscriptionListItem",
    "SubscriptionDetail",
    "SubscriptionStatistics",
]
