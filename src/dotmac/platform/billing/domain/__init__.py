"""
Billing Domain Layer - Domain-Driven Design Components.

This module contains domain aggregates, value objects, and business logic
for the billing bounded context, following DDD principles.
"""

from .aggregates import (
    Customer,
    Invoice,
    Payment,
    Subscription,
)
from .event_handlers import (
    register_billing_domain_event_handlers,
)
from .mappers import (
    CustomerMapper,
    InvoiceMapper,
    PaymentMapper,
    SubscriptionMapper,
)
from .repositories import (
    CustomerRepository,
    InvoiceRepository,
    PaymentRepository,
    SQLAlchemyCustomerRepository,
    SQLAlchemyInvoiceRepository,
    SQLAlchemyPaymentRepository,
)

__all__ = [
    # Aggregates
    "Invoice",
    "Payment",
    "Subscription",
    "Customer",
    # Mappers
    "InvoiceMapper",
    "PaymentMapper",
    "SubscriptionMapper",
    "CustomerMapper",
    # Event Handlers
    "register_billing_domain_event_handlers",
    # Repositories
    "SQLAlchemyInvoiceRepository",
    "SQLAlchemyPaymentRepository",
    "SQLAlchemyCustomerRepository",
    "InvoiceRepository",
    "PaymentRepository",
    "CustomerRepository",
]
