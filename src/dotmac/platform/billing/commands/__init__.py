"""
Billing Commands - Write Operations (CQRS Pattern)

Commands represent intentions to change state in the billing system.
They are responsible for validating business rules and triggering state changes.
"""

from .handlers import (
    InvoiceCommandHandler,
    PaymentCommandHandler,
    SubscriptionCommandHandler,
)
from .invoice_commands import (
    ApplyPaymentToInvoiceCommand,
    CreateInvoiceCommand,
    FinalizeInvoiceCommand,
    SendInvoiceCommand,
    UpdateInvoiceCommand,
    VoidInvoiceCommand,
)
from .payment_commands import (
    CancelPaymentCommand,
    CreatePaymentCommand,
    RefundPaymentCommand,
)
from .subscription_commands import (
    CancelSubscriptionCommand,
    CreateSubscriptionCommand,
    PauseSubscriptionCommand,
    ResumeSubscriptionCommand,
    UpdateSubscriptionCommand,
)

__all__ = [
    # Invoice Commands
    "CreateInvoiceCommand",
    "UpdateInvoiceCommand",
    "VoidInvoiceCommand",
    "FinalizeInvoiceCommand",
    "SendInvoiceCommand",
    "ApplyPaymentToInvoiceCommand",
    # Payment Commands
    "CreatePaymentCommand",
    "RefundPaymentCommand",
    "CancelPaymentCommand",
    # Subscription Commands
    "CreateSubscriptionCommand",
    "UpdateSubscriptionCommand",
    "CancelSubscriptionCommand",
    "PauseSubscriptionCommand",
    "ResumeSubscriptionCommand",
    # Handlers
    "InvoiceCommandHandler",
    "PaymentCommandHandler",
    "SubscriptionCommandHandler",
]
