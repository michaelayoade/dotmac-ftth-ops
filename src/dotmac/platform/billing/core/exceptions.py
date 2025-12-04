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

    default_message: str = "Billing error"

    def __init__(
        self,
        message: str = "",
        error_code: str | None = None,
        details: dict[str, Any] | None = None,
        status_code: int = 400,
    ) -> None:
        # Use default_message if no message provided
        actual_message = message if message else self.default_message
        # Call parent with message as positional arg, rest as keyword args
        super().__init__(actual_message, error_code, details, status_code)


class ValidationError(BillingError):
    """Validation error for billing operations."""

    default_message: str = "Validation error"


class InvoiceError(BillingError):
    """Base exception for invoice-related errors."""

    default_message: str = "Invoice error"


class InvoiceNotFoundError(InvoiceError):
    """Invoice not found error."""

    default_message: str = "Invoice not found"


class InvalidInvoiceStatusError(InvoiceError):
    """Invalid invoice status for requested operation."""

    default_message: str = "Invalid invoice status"


class PaymentError(BillingError):
    """Base exception for payment-related errors."""

    default_message: str = "Payment error"


class PaymentNotFoundError(PaymentError):
    """Payment not found error."""

    default_message: str = "Payment not found"


class PaymentMethodNotFoundError(PaymentError):
    """Payment method not found error."""

    default_message: str = "Payment method not found"


class PaymentProcessingError(PaymentError):
    """Error processing payment."""

    default_message: str = "Payment processing error"


class InsufficientFundsError(PaymentError):
    """Insufficient funds for payment."""

    default_message: str = "Insufficient funds"


class CreditNoteError(BillingError):
    """Base exception for credit note-related errors."""

    default_message: str = "Credit note error"


class CreditNoteNotFoundError(CreditNoteError):
    """Credit note not found error."""

    default_message: str = "Credit note not found"


class InvalidCreditNoteStatusError(CreditNoteError):
    """Invalid credit note status for requested operation."""

    default_message: str = "Invalid credit note status"


class InsufficientCreditError(CreditNoteError):
    """Insufficient credit amount available."""

    default_message: str = "Insufficient credit"


class TaxError(BillingError):
    """Base exception for tax-related errors."""

    default_message: str = "Tax error"


class TaxCalculationError(TaxError):
    """Error calculating tax."""

    default_message: str = "Tax calculation error"


class TaxRateNotFoundError(TaxError):
    """Tax rate not found for location."""

    default_message: str = "Tax rate not found"


class CurrencyError(BillingError):
    """Base exception for currency-related errors."""

    default_message: str = "Currency error"


class CurrencyConversionError(CurrencyError):
    """Error converting between currencies."""

    default_message: str = "Currency conversion error"


class UnsupportedCurrencyError(CurrencyError):
    """Currency not supported."""

    default_message: str = "Unsupported currency"


class ConfigurationError(BillingError):
    """Billing configuration error."""

    default_message: str = "Configuration error"


class IdempotencyError(BillingError):
    """Idempotency key conflict error."""

    default_message: str = "Idempotency key conflict"


class SubscriptionError(BillingError):
    """Base exception for subscription-related errors."""

    default_message: str = "Subscription error"


class SubscriptionNotFoundError(SubscriptionError):
    """Subscription not found error."""

    default_message: str = "Subscription not found"


class InvalidSubscriptionStatusError(SubscriptionError):
    """Invalid subscription status for requested operation."""

    default_message: str = "Invalid subscription status"
