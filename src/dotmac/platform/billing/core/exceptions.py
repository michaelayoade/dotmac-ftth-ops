"""Billing module exceptions."""

from __future__ import annotations

from typing import Any

try:
    from ..core.exceptions import DotMacError  # type: ignore[attr-defined]  # May not be exported
except Exception:  # pragma: no cover - fallback when core module unavailable

    class DotMacError(Exception):  # type: ignore[no-redef]  # Fallback for isolated analysis
        """Fallback DotMacError definition used when core exceptions are unavailable."""


class BillingError(DotMacError):  # type: ignore[misc]  # DotMacError resolves to Any in isolation
    """Base exception for all billing-related errors."""

    message: str = "Billing error"

    def __init__(self, message: str | None = None, **context: Any) -> None:
        super().__init__(message or self.message, details=context or None)


class ValidationError(BillingError):
    """Validation error for billing operations."""


class InvoiceError(BillingError):
    """Base exception for invoice-related errors."""


class InvoiceNotFoundError(InvoiceError):
    """Invoice not found error."""


class InvalidInvoiceStatusError(InvoiceError):
    """Invalid invoice status for requested operation."""


class PaymentError(BillingError):
    """Base exception for payment-related errors."""


class PaymentNotFoundError(PaymentError):
    """Payment not found error."""


class PaymentMethodNotFoundError(PaymentError):
    """Payment method not found error."""


class PaymentProcessingError(PaymentError):
    """Error processing payment."""


class InsufficientFundsError(PaymentError):
    """Insufficient funds for payment."""


class CreditNoteError(BillingError):
    """Base exception for credit note-related errors."""


class CreditNoteNotFoundError(CreditNoteError):
    """Credit note not found error."""


class InvalidCreditNoteStatusError(CreditNoteError):
    """Invalid credit note status for requested operation."""


class InsufficientCreditError(CreditNoteError):
    """Insufficient credit amount available."""


class TaxError(BillingError):
    """Base exception for tax-related errors."""


class TaxCalculationError(TaxError):
    """Error calculating tax."""


class TaxRateNotFoundError(TaxError):
    """Tax rate not found for location."""


class CurrencyError(BillingError):
    """Base exception for currency-related errors."""


class CurrencyConversionError(CurrencyError):
    """Error converting between currencies."""


class UnsupportedCurrencyError(CurrencyError):
    """Currency not supported."""


class ConfigurationError(BillingError):
    """Billing configuration error."""


class IdempotencyError(BillingError):
    """Idempotency key conflict error."""


class SubscriptionError(BillingError):
    """Base exception for subscription-related errors."""


class SubscriptionNotFoundError(SubscriptionError):
    """Subscription not found error."""


class InvalidSubscriptionStatusError(SubscriptionError):
    """Invalid subscription status for requested operation."""
