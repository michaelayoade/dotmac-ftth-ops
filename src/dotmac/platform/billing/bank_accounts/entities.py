"""
Company bank account entities for receiving payments and payouts
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import AuditMixin, Base, TenantMixin, TimestampMixin


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
    MOBILE_MONEY = "mobile_money"  # For M-Pesa, etc.
    CRYPTO = "crypto"
    OTHER = "other"


class CompanyBankAccount(Base, TenantMixin, TimestampMixin, AuditMixin):  # type: ignore[misc]  # Mixin has type Any
    """Company bank accounts for receiving payments"""

    __tablename__ = "company_bank_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Account identification
    account_name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_nickname: Mapped[str | None] = mapped_column(String(100))  # User-friendly name

    # Bank information
    bank_name: Mapped[str] = mapped_column(String(200), nullable=False)
    bank_address: Mapped[str | None] = mapped_column(Text)
    bank_country: Mapped[str] = mapped_column(String(2), nullable=False)  # ISO country code

    # Account details (encrypted in production)
    account_number_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    account_number_last_four: Mapped[str] = mapped_column(String(4), nullable=False)
    routing_number: Mapped[str | None] = mapped_column(String(50))  # ABA routing number
    swift_code: Mapped[str | None] = mapped_column(String(11))  # SWIFT/BIC code
    iban: Mapped[str | None] = mapped_column(String(34))  # International Bank Account Number

    # Account type and currency
    account_type: Mapped[AccountType] = mapped_column(
        SQLEnum(AccountType), nullable=False, default=AccountType.BUSINESS
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    # Status and settings
    status: Mapped[BankAccountStatus] = mapped_column(
        SQLEnum(BankAccountStatus), nullable=False, default=BankAccountStatus.PENDING
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    accepts_deposits: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Verification
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_by: Mapped[str | None] = mapped_column(String(255))
    verification_notes: Mapped[str | None] = mapped_column(Text)

    # Additional info
    notes: Mapped[str | None] = mapped_column(Text)
    meta_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    # Relationships (temporarily disabled for compatibility)
    # manual_payments: Mapped[list["ManualPayment"]] = relationship(
    #     "ManualPayment",
    #     back_populates="bank_account",
    #     lazy="dynamic"
    # )

    # Indexes - merge with extend_existing
    __table_args__ = (
        Index("idx_company_bank_tenant", "tenant_id"),
        Index("idx_company_bank_primary", "tenant_id", "is_primary"),
        Index("idx_company_bank_status", "status"),
        {"extend_existing": True},
    )


class ManualPayment(Base, TenantMixin, TimestampMixin, AuditMixin):  # type: ignore[misc]  # Mixin has type Any
    """Manual payment records for cash and non-integrated bank payments"""

    __tablename__ = "manual_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Payment reference
    payment_reference: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    external_reference: Mapped[str | None] = mapped_column(
        String(255)
    )  # Bank ref, check number, etc.

    # Related entities (temporarily without foreign keys for compatibility)
    customer_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), nullable=False)
    invoice_id: Mapped[str | None] = mapped_column(String(255))
    bank_account_id: Mapped[int | None] = mapped_column(Integer)

    # Payment details
    payment_method: Mapped[PaymentMethodType] = mapped_column(
        SQLEnum(PaymentMethodType), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    # Dates
    payment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cleared_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Cash-specific fields
    cash_register_id: Mapped[str | None] = mapped_column(String(50))
    cashier_name: Mapped[str | None] = mapped_column(String(100))

    # Check-specific fields
    check_number: Mapped[str | None] = mapped_column(String(50))
    check_bank_name: Mapped[str | None] = mapped_column(String(200))

    # Bank transfer fields
    sender_name: Mapped[str | None] = mapped_column(String(200))
    sender_bank: Mapped[str | None] = mapped_column(String(200))
    sender_account_last_four: Mapped[str | None] = mapped_column(String(4))

    # Mobile money fields
    mobile_number: Mapped[str | None] = mapped_column(String(20))
    mobile_provider: Mapped[str | None] = mapped_column(String(50))

    # Status
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",  # pending, verified, reconciled, failed
    )
    reconciled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reconciled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reconciled_by: Mapped[str | None] = mapped_column(String(255))

    # Notes and attachments
    notes: Mapped[str | None] = mapped_column(Text)
    receipt_url: Mapped[str | None] = mapped_column(String(500))
    attachments: Mapped[list[str]] = mapped_column(JSON, default=list)

    # Audit
    recorded_by: Mapped[str] = mapped_column(String(255), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(255))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Metadata
    meta_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    # Relationships (temporarily disabled for compatibility)
    # customer: Mapped["Customer"] = relationship("Customer", back_populates="manual_payments")
    # invoice: Mapped["InvoiceEntity"] = relationship("InvoiceEntity", back_populates="manual_payments")
    # bank_account: Mapped["CompanyBankAccount"] = relationship(
    #     "CompanyBankAccount",
    #     back_populates="manual_payments"
    # )

    # Indexes with extend_existing
    __table_args__ = (
        Index("idx_manual_payment_tenant", "tenant_id"),
        Index("idx_manual_payment_customer", "customer_id"),
        Index("idx_manual_payment_invoice", "invoice_id"),
        Index("idx_manual_payment_date", "payment_date"),
        Index("idx_manual_payment_status", "status"),
        Index("idx_manual_payment_method", "payment_method"),
        {"extend_existing": True},
    )


class CashRegister(Base, TenantMixin, TimestampMixin):  # type: ignore[misc]  # Mixin has type Any
    """Cash registers/points for tracking cash payments"""

    __tablename__ = "cash_registers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Register identification
    register_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    register_name: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str | None] = mapped_column(String(200))

    # Current status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    current_float: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00)
    last_reconciled: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Settings
    requires_daily_reconciliation: Mapped[bool] = mapped_column(Boolean, default=True)
    max_cash_limit: Mapped[float | None] = mapped_column(Numeric(10, 2))

    # Metadata
    meta_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    # Indexes with extend_existing
    __table_args__ = (
        Index("idx_cash_register_tenant", "tenant_id"),
        Index("idx_cash_register_active", "is_active"),
        {"extend_existing": True},
    )


class CashReconciliation(Base, TenantMixin):  # type: ignore[misc]  # Mixin has type Any
    """
    Cash reconciliation records for cash registers.
    """

    __tablename__ = "cash_reconciliations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    register_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("cash_registers.register_id"), nullable=False
    )
    reconciliation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Amounts
    opening_float: Mapped[Decimal] = mapped_column(Numeric(19, 4), nullable=False)
    closing_float: Mapped[Decimal] = mapped_column(Numeric(19, 4), nullable=False)
    expected_cash: Mapped[Decimal] = mapped_column(Numeric(19, 4), nullable=False)
    actual_cash: Mapped[Decimal] = mapped_column(Numeric(19, 4), nullable=False)
    discrepancy: Mapped[Decimal] = mapped_column(Numeric(19, 4), nullable=False)

    # Details
    reconciled_by: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    shift_id: Mapped[str | None] = mapped_column(String(50))

    # Metadata
    meta_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class CashTransaction(Base, TenantMixin):  # type: ignore[misc]  # Mixin has type Any
    """
    Individual cash transactions for a register.
    """

    __tablename__ = "cash_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    register_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("cash_registers.register_id"), nullable=False
    )

    # Transaction details
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(19, 4), nullable=False)

    reference: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500))

    # Audit
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)

    # Metadata
    meta_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class PaymentReconciliation(Base, TenantMixin, TimestampMixin):  # type: ignore[misc]  # Mixin has type Any
    """Payment reconciliation records for matching bank statements"""

    __tablename__ = "payment_reconciliations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Period
    reconciliation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Bank account
    bank_account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("company_bank_accounts.id"), nullable=False
    )

    # Balances
    opening_balance: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    closing_balance: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    statement_balance: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Reconciliation details
    total_deposits: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00)
    total_withdrawals: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00)
    unreconciled_count: Mapped[int] = mapped_column(Integer, default=0)
    discrepancy_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00)

    # Status
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="in_progress",  # in_progress, completed, approved
    )

    # Approval
    completed_by: Mapped[str | None] = mapped_column(String(255))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[str | None] = mapped_column(String(255))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Notes and attachments
    notes: Mapped[str | None] = mapped_column(Text)
    statement_file_url: Mapped[str | None] = mapped_column(String(500))

    # Metadata
    reconciled_items: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    meta_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    # Indexes with extend_existing
    __table_args__ = (
        Index("idx_reconciliation_tenant", "tenant_id"),
        Index("idx_reconciliation_bank", "bank_account_id"),
        Index("idx_reconciliation_date", "reconciliation_date"),
        {"extend_existing": True},
    )
