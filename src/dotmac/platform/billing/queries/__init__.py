"""
Billing Queries - Read Operations (CQRS Pattern)

Queries represent requests for data without side effects.
They are optimized for read performance and can use specialized read models.
"""

from .handlers import (
    InvoiceQueryHandler,
    PaymentQueryHandler,
    SubscriptionQueryHandler,
)
from .invoice_queries import (
    GetInvoiceQuery,
    GetInvoicesByCustomerQuery,
    GetInvoiceStatisticsQuery,
    GetOverdueInvoicesQuery,
    ListInvoicesQuery,
)
from .payment_queries import (
    GetPaymentQuery,
    GetPaymentsByCustomerQuery,
    GetPaymentsByInvoiceQuery,
    GetPaymentStatisticsQuery,
    ListPaymentsQuery,
)
from .subscription_queries import (
    GetActiveSubscriptionsQuery,
    GetExpiringSubscriptionsQuery,
    GetSubscriptionQuery,
    GetSubscriptionsByCustomerQuery,
    ListSubscriptionsQuery,
)

__all__ = [
    # Invoice Queries
    "GetInvoiceQuery",
    "ListInvoicesQuery",
    "GetInvoicesByCustomerQuery",
    "GetOverdueInvoicesQuery",
    "GetInvoiceStatisticsQuery",
    # Payment Queries
    "GetPaymentQuery",
    "ListPaymentsQuery",
    "GetPaymentsByCustomerQuery",
    "GetPaymentsByInvoiceQuery",
    "GetPaymentStatisticsQuery",
    # Subscription Queries
    "GetSubscriptionQuery",
    "ListSubscriptionsQuery",
    "GetSubscriptionsByCustomerQuery",
    "GetActiveSubscriptionsQuery",
    "GetExpiringSubscriptionsQuery",
    # Handlers
    "InvoiceQueryHandler",
    "PaymentQueryHandler",
    "SubscriptionQueryHandler",
]
