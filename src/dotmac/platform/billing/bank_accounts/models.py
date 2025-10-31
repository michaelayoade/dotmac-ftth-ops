"""
Bank account and manual payment models
"""

from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from dotmac.platform.billing.core.models import BillingBaseModel


class BankAccountStatus(str, Enum):
    """Bank account verification status"""

    PENDING = "pending"
    VERIFIED = "verified"
    FAILED = "failed"
    SUSPENDED = "suspended"


class AccountType(str, Enum):
    """Bank account types"""

    CHECKING = "checking"
    SAVINGS = "savings"
    BUSINESS = "business"
    MONEY_MARKET = "money_market"


class PaymentMethodType(str, Enum):
    """Payment method types for manual entries"""

    BANK_TRANSFER = "bank_transfer"
    WIRE_TRANSFER = "wire_transfer"
    ACH = "ach"
    CASH = "cash"
    CHECK = "check"
    MONEY_ORDER = "money_order"
    MOBILE_MONEY = "mobile_money"
    CRYPTO = "crypto"
    OTHER = "other"


class CompanyBankAccountBase(BaseModel):
    """Base model for company bank account"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    account_name: str = Field(..., min_length=1, max_length=200, description="Account holder name")
    account_nickname: str | None = Field(None, max_length=100, description="User-friendly name")

    bank_name: str = Field(..., min_length=1, max_length=200, description="Bank name")
    bank_address: str | None = Field(None, description="Bank address")
    bank_country: str = Field(..., min_length=2, max_length=2, description="ISO country code")

    account_type: AccountType = Field(AccountType.BUSINESS, description="Account type")
    currency: str = Field("USD", min_length=3, max_length=3, description="Currency code")

    routing_number: str | None = Field(None, max_length=50, description="ABA routing number")
    swift_code: str | None = Field(None, max_length=11, description="SWIFT/BIC code")
    iban: str | None = Field(None, max_length=34, description="IBAN")

    is_primary: bool = Field(False, description="Primary account for payouts")
    accepts_deposits: bool = Field(True, description="Can receive deposits")
    notes: str | None = Field(None, description="Internal notes")

    @field_validator("bank_country")
    @classmethod
    def validate_country(cls, v: str) -> str:
        """Validate country code"""
        if v and len(v) != 2:
            raise ValueError("Country must be 2-letter ISO code")
        return v.upper()

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        """Validate currency code"""
        return v.upper()


class CompanyBankAccountCreate(CompanyBankAccountBase):
    """Create company bank account request"""

    account_number: str = Field(..., min_length=4, description="Full account number")

    @field_validator("account_number")
    @classmethod
    def validate_account_number(cls, v: str) -> str:
        """Basic account number validation"""
        # Remove spaces and dashes
        cleaned = v.replace(" ", "").replace("-", "")
        if not cleaned.isdigit() and not cleaned.isalnum():
            raise ValueError("Account number contains invalid characters")
        return v


class CompanyBankAccountUpdate(BaseModel):
    """Update company bank account request"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    account_nickname: str | None = Field(None, max_length=100)
    bank_address: str | None = None
    is_primary: bool | None = None
    accepts_deposits: bool | None = None
    notes: str | None = None


class CompanyBankAccountResponse(BillingBaseModel):  # type: ignore[misc]  # BillingBaseModel resolves to Any in isolation
    """Company bank account response"""

    id: int
    account_name: str
    account_nickname: str | None

    bank_name: str
    bank_address: str | None
    bank_country: str

    account_number_last_four: str
    account_type: AccountType
    currency: str

    routing_number: str | None
    swift_code: str | None
    iban: str | None

    status: BankAccountStatus
    is_primary: bool
    is_active: bool
    accepts_deposits: bool

    verified_at: datetime | None
    verification_notes: str | None = None
    created_at: datetime
    updated_at: datetime

    notes: str | None
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class ManualPaymentBase(BaseModel):
    """Base model for manual payment"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    customer_id: str = Field(..., description="Customer ID")
    invoice_id: str | None = Field(None, description="Related invoice ID")
    bank_account_id: int | None = Field(None, description="Deposit account")

    payment_method: PaymentMethodType = Field(..., description="Payment method")
    amount: Decimal = Field(..., description="Payment amount")
    currency: str = Field("USD", min_length=3, max_length=3)

    payment_date: datetime = Field(..., description="When payment was made")
    received_date: datetime | None = Field(None, description="When payment was received")

    external_reference: str | None = Field(None, max_length=255, description="External reference")
    notes: str | None = Field(None, description="Payment notes")

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, v: Any) -> Decimal:
        """Validate and normalize payment amount with decimal precision."""
        try:
            amount = v if isinstance(v, Decimal) else Decimal(str(v))
        except (InvalidOperation, ValueError, TypeError) as exc:
            raise ValueError("Amount must be a valid decimal number") from exc

        if amount <= Decimal("0"):
            raise ValueError("Amount must be positive")

        return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @field_validator("customer_id")
    @classmethod
    def validate_customer_id(cls, v: str) -> str:
        """Ensure customer_id is a valid UUID string."""
        try:
            UUID(str(v))
        except (ValueError, TypeError) as exc:
            raise ValueError("customer_id must be a valid UUID") from exc
        return str(v)


class CashPaymentCreate(ManualPaymentBase):
    """Create cash payment request"""

    payment_method: PaymentMethodType = Field(PaymentMethodType.CASH)
    cash_register_id: str | None = Field(None, description="Register ID")
    cashier_name: str | None = Field(None, max_length=100, description="Cashier name")


class CheckPaymentCreate(ManualPaymentBase):
    """Create check payment request"""

    payment_method: PaymentMethodType = Field(PaymentMethodType.CHECK)
    check_number: str = Field(..., max_length=50, description="Check number")
    check_bank_name: str | None = Field(None, max_length=200, description="Bank name on check")


class BankTransferCreate(ManualPaymentBase):
    """Create bank transfer request"""

    payment_method: PaymentMethodType = Field(PaymentMethodType.BANK_TRANSFER)
    sender_name: str | None = Field(None, max_length=200, description="Sender name")
    sender_bank: str | None = Field(None, max_length=200, description="Sender bank")
    sender_account_last_four: str | None = Field(
        None, max_length=4, description="Sender account last 4"
    )


class MobileMoneyCreate(ManualPaymentBase):
    """Create mobile money payment request"""

    payment_method: PaymentMethodType = Field(PaymentMethodType.MOBILE_MONEY)
    mobile_number: str = Field(..., max_length=20, description="Mobile number")
    mobile_provider: str = Field(..., max_length=50, description="Provider (M-Pesa, etc.)")


class ManualPaymentResponse(BillingBaseModel):  # type: ignore[misc]  # BillingBaseModel resolves to Any in isolation
    """Manual payment response"""

    id: int
    payment_reference: str
    external_reference: str | None

    customer_id: str
    invoice_id: str | None
    bank_account_id: int | None

    payment_method: PaymentMethodType
    amount: float
    currency: str

    payment_date: datetime
    received_date: datetime | None
    cleared_date: datetime | None

    # Method-specific fields
    cash_register_id: str | None
    cashier_name: str | None
    check_number: str | None
    check_bank_name: str | None
    sender_name: str | None
    sender_bank: str | None
    sender_account_last_four: str | None
    mobile_number: str | None
    mobile_provider: str | None

    status: str
    reconciled: bool
    reconciled_at: datetime | None
    reconciled_by: str | None

    notes: str | None
    receipt_url: str | None
    attachments: list[str] = Field(default_factory=lambda: [])

    recorded_by: str
    approved_by: str | None
    approved_at: datetime | None

    created_at: datetime
    updated_at: datetime
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class ReconcilePaymentRequest(BaseModel):
    """Request to reconcile a payment"""

    model_config = ConfigDict()

    payment_ids: list[int] = Field(..., description="Payment IDs to reconcile")
    reconciliation_notes: str | None = Field(None, description="Reconciliation notes")


class PaymentSearchFilters(BaseModel):
    """Filters for searching payments"""

    model_config = ConfigDict()

    customer_id: str | None = None
    invoice_id: str | None = None
    payment_method: PaymentMethodType | None = None
    status: str | None = None
    reconciled: bool | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    amount_min: float | None = None
    amount_max: float | None = None


class CashRegisterCreate(BaseModel):
    """Create cash register request"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    register_id: str = Field(..., min_length=1, max_length=50, description="Unique register ID")
    register_name: str = Field(..., min_length=1, max_length=100, description="Register name")
    location: str | None = Field(None, max_length=200, description="Physical location")
    initial_float: float = Field(0.00, ge=0, description="Initial float amount")
    requires_daily_reconciliation: bool = Field(True, description="Requires daily reconciliation")
    max_cash_limit: float | None = Field(None, ge=0, description="Maximum cash limit")


class CashRegisterResponse(BaseModel):
    """Cash register response"""

    model_config = ConfigDict()

    id: int
    register_id: str
    register_name: str
    location: str | None

    is_active: bool
    current_float: float
    last_reconciled: datetime | None

    requires_daily_reconciliation: bool
    max_cash_limit: float | None

    created_at: datetime
    updated_at: datetime
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class CashTransactionCreate(BaseModel):
    """Create cash transaction for register"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    register_id: str = Field(..., description="Cash register ID")
    transaction_type: str = Field(..., description="Type: sale, refund, deposit, withdrawal")
    amount: float = Field(..., ge=0, description="Transaction amount")
    reference: str | None = Field(None, description="Transaction reference")
    description: str | None = Field(None, description="Transaction description")
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class CashTransactionResponse(BaseModel):
    """Cash transaction response"""

    model_config = ConfigDict()

    id: str
    register_id: str
    transaction_type: str
    amount: float
    reference: str | None
    description: str | None
    balance_after: float
    created_at: datetime
    created_by: str
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class CashRegisterReconciliationCreate(BaseModel):
    """Create cash register reconciliation request"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    actual_cash: float = Field(..., ge=0, description="Actual cash counted")
    reconciliation_date: datetime | None = Field(None, description="Reconciliation date")
    shift_id: str | None = Field(None, description="Shift identifier")
    notes: str | None = Field(None, description="Reconciliation notes")
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class CashRegisterReconciliationResponse(BaseModel):
    """Cash register reconciliation response"""

    model_config = ConfigDict()

    id: str
    register_id: str
    reconciliation_date: datetime
    opening_float: float
    closing_float: float
    expected_cash: float
    actual_cash: float
    discrepancy: float
    reconciled_by: str
    notes: str | None
    shift_id: str | None
    created_at: datetime
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class ReconciliationCreate(BaseModel):
    """Create reconciliation request"""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    bank_account_id: int = Field(..., description="Bank account ID")
    period_start: datetime = Field(..., description="Period start date")
    period_end: datetime = Field(..., description="Period end date")

    opening_balance: float = Field(..., description="Opening balance")
    closing_balance: float = Field(..., description="Expected closing balance")
    statement_balance: float = Field(..., description="Bank statement balance")

    notes: str | None = Field(None, description="Reconciliation notes")
    statement_file_url: str | None = Field(None, description="Bank statement file URL")


class ReconciliationResponse(BaseModel):
    """Reconciliation response"""

    model_config = ConfigDict()

    id: int
    reconciliation_date: datetime
    period_start: datetime
    period_end: datetime

    bank_account_id: int

    opening_balance: float
    closing_balance: float
    statement_balance: float

    total_deposits: float
    total_withdrawals: float
    unreconciled_count: int
    discrepancy_amount: float

    status: str

    completed_by: str | None
    completed_at: datetime | None
    approved_by: str | None
    approved_at: datetime | None

    notes: str | None
    statement_file_url: str | None

    reconciled_items: list[dict[str, Any]] = Field(default_factory=lambda: [])
    created_at: datetime
    updated_at: datetime


class BankAccountSummary(BaseModel):
    """Bank account summary with stats"""

    model_config = ConfigDict()

    account: CompanyBankAccountResponse
    total_deposits_mtd: float = Field(0.00, description="Month-to-date deposits")
    total_deposits_ytd: float = Field(0.00, description="Year-to-date deposits")
    pending_payments: int = Field(0, description="Number of pending payments")
    last_reconciliation: datetime | None = None
    current_balance: float | None = None  # If integrated with bank
