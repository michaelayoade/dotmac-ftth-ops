"""
Billing module enumerations
"""

from enum import Enum


class BillingCycle(str, Enum):
    """Billing cycle periods"""

    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMI_ANNUAL = "semi_annual"
    ANNUAL = "annual"
    CUSTOM = "custom"


class InvoiceStatus(str, Enum):
    """Invoice status states"""

    DRAFT = "draft"
    OPEN = "open"
    PAID = "paid"
    VOID = "void"
    OVERDUE = "overdue"
    PARTIALLY_PAID = "partially_paid"


class PaymentStatus(str, Enum):
    """Payment status states"""

    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"
    CANCELLED = "cancelled"


class PaymentMethodType(str, Enum):
    """Payment method types"""

    CARD = "card"
    BANK_ACCOUNT = "bank_account"
    DIGITAL_WALLET = "digital_wallet"
    CRYPTO = "crypto"
    CHECK = "check"
    WIRE_TRANSFER = "wire_transfer"
    CASH = "cash"


class TransactionType(str, Enum):
    """Financial transaction types"""

    CHARGE = "charge"  # Money owed by customer
    PAYMENT = "payment"  # Money received from customer
    REFUND = "refund"  # Money returned to customer
    CREDIT = "credit"  # Credit applied to customer
    ADJUSTMENT = "adjustment"  # Manual adjustment
    FEE = "fee"  # Processing or service fee
    WRITE_OFF = "write_off"  # Bad debt write-off
    TAX = "tax"  # Tax transaction


class CreditNoteStatus(str, Enum):
    """Credit note status states"""

    DRAFT = "draft"
    ISSUED = "issued"
    APPLIED = "applied"  # Fully applied to invoice/customer account
    VOIDED = "voided"
    PARTIALLY_APPLIED = "partially_applied"


class CreditType(str, Enum):
    """Credit note types"""

    REFUND = "refund"  # Full or partial refund
    ADJUSTMENT = "adjustment"  # Price adjustment/correction
    WRITE_OFF = "write_off"  # Bad debt write-off
    DISCOUNT = "discount"  # Retrospective discount
    ERROR_CORRECTION = "error_correction"  # Billing error fix
    OVERPAYMENT = "overpayment"  # Customer overpaid
    GOODWILL = "goodwill"  # Customer satisfaction credit


class CreditReason(str, Enum):
    """Credit note reason codes"""

    CUSTOMER_REQUEST = "customer_request"
    BILLING_ERROR = "billing_error"
    PRODUCT_DEFECT = "product_defect"
    SERVICE_ISSUE = "service_issue"
    DUPLICATE_CHARGE = "duplicate_charge"
    CANCELLATION = "cancellation"
    GOODWILL = "goodwill"
    OVERPAYMENT_REFUND = "overpayment_refund"
    PRICE_ADJUSTMENT = "price_adjustment"
    TAX_ADJUSTMENT = "tax_adjustment"
    ORDER_CHANGE = "order_change"
    OTHER = "other"


class CreditApplicationType(str, Enum):
    """Credit application target types"""

    INVOICE = "invoice"  # Applied to specific invoice
    CUSTOMER_ACCOUNT = "customer_account"  # Applied to customer account balance
    REFUND = "refund"  # Refunded to payment method


class TaxType(str, Enum):
    """Tax types"""

    SALES_TAX = "sales_tax"
    VAT = "vat"
    GST = "gst"
    HST = "hst"
    PST = "pst"
    USE_TAX = "use_tax"
    CUSTOM = "custom"


class PaymentMethodStatus(str, Enum):
    """Payment method status states"""

    ACTIVE = "active"
    INACTIVE = "inactive"
    EXPIRED = "expired"
    REQUIRES_VERIFICATION = "requires_verification"
    VERIFICATION_FAILED = "verification_failed"


class BankAccountType(str, Enum):
    """Bank account types"""

    CHECKING = "checking"
    SAVINGS = "savings"
    BUSINESS_CHECKING = "business_checking"
    BUSINESS_SAVINGS = "business_savings"


class VerificationStatus(str, Enum):
    """Verification status states"""

    PENDING = "pending"
    VERIFIED = "verified"
    FAILED = "failed"
    EXPIRED = "expired"


class RefundMethodType(str, Enum):
    """Refund method types"""

    ORIGINAL_PAYMENT = "original_payment"  # Refund to original payment method
    BANK_ACCOUNT = "bank_account"  # ACH refund to bank account
    CARD = "card"  # Refund to different card
    STORE_CREDIT = "store_credit"  # Keep as customer account credit
    CHECK = "check"  # Mail check refund


class WebhookEvent(str, Enum):
    """Webhook event types"""

    INVOICE_CREATED = "invoice.created"
    INVOICE_SENT = "invoice.sent"
    INVOICE_PAID = "invoice.paid"
    INVOICE_VOIDED = "invoice.voided"
    INVOICE_OVERDUE = "invoice.overdue"

    PAYMENT_SUCCEEDED = "payment.succeeded"
    PAYMENT_FAILED = "payment.failed"
    PAYMENT_REFUNDED = "payment.refunded"

    CREDIT_NOTE_CREATED = "credit_note.created"
    CREDIT_NOTE_ISSUED = "credit_note.issued"
    CREDIT_NOTE_APPLIED = "credit_note.applied"
    CREDIT_NOTE_VOIDED = "credit_note.voided"

    CUSTOMER_CREDIT_UPDATED = "customer.credit_updated"


class WebhookAuthType(str, Enum):
    """Webhook authentication types"""

    NONE = "none"
    SIGNATURE = "signature"  # HMAC signature
    BEARER_TOKEN = "bearer_token"  # nosec B105 - enum value, not hardcoded password
    BASIC_AUTH = "basic_auth"
    API_KEY = "api_key"


class DunningAction(str, Enum):
    """Dunning action types"""

    EMAIL = "email"
    SMS = "sms"
    SUSPEND_SERVICE = "suspend_service"
    CANCEL_SERVICE = "cancel_service"
    COLLECTION_AGENCY = "collection_agency"


class ServiceStatus(str, Enum):
    """Service status states"""

    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"


class ServiceType(str, Enum):
    """Service type categories"""

    BROADBAND = "broadband"
    VOICE = "voice"
    VIDEO = "video"
    BUNDLE = "bundle"
    ADDON = "addon"
    CUSTOM = "custom"
