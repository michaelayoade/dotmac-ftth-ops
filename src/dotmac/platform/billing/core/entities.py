"""
Billing module SQLAlchemy entities with tenant support
"""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import (
    AuditMixin,
    Base,
    SoftDeleteMixin,
    TenantMixin,
    TimestampMixin,
)

from .enums import (
    BankAccountType,
    CreditApplicationType,
    CreditNoteStatus,
    CreditReason,
    CreditType,
    InvoiceStatus,
    PaymentMethodStatus,
    PaymentMethodType,
    PaymentStatus,
    ServiceStatus,
    ServiceType,
    TransactionType,
)

# ============================================================================
# Invoice Entities
# ============================================================================


class InvoiceEntity(Base, TenantMixin, TimestampMixin, AuditMixin):  # type: ignore[misc]  # Mixin has type Any
    """Invoice database entity"""

    __tablename__ = "invoices"

    invoice_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    invoice_number: Mapped[str | None] = mapped_column(String(50), index=True)

    # Idempotency
    idempotency_key: Mapped[str | None] = mapped_column(String(255), index=True)

    # Customer
    customer_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    billing_email: Mapped[str] = mapped_column(String(255), nullable=False)
    billing_address: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    # Invoice details
    issue_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    # Amounts in minor units
    subtotal: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    discount_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_amount: Mapped[int] = mapped_column(Integer, nullable=False)

    # Credits
    total_credits_applied: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    remaining_balance: Mapped[int] = mapped_column(Integer, nullable=False)
    credit_applications: Mapped[list[str]] = mapped_column(JSON, default=list)

    # Status
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=InvoiceStatus.DRAFT,
        index=True,
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=PaymentStatus.PENDING,
        index=True,
    )

    # References
    subscription_id: Mapped[str | None] = mapped_column(String(255), index=True)
    proforma_invoice_id: Mapped[str | None] = mapped_column(String(255))

    # Content
    notes: Mapped[str | None] = mapped_column(Text)
    internal_notes: Mapped[str | None] = mapped_column(Text)
    extra_data: Mapped[dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict)

    # Additional timestamps
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    # billing_contact relationship added when contacts module is integrated
    line_items: Mapped[list["InvoiceLineItemEntity"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )
    payments: Mapped[list["PaymentInvoiceEntity"]] = relationship(back_populates="invoice")

    # Indexes and constraints
    __table_args__: tuple[Any, ...] = (
        Index("idx_invoice_tenant_customer", "tenant_id", "customer_id"),
        Index("idx_invoice_tenant_status", "tenant_id", "status"),
        Index("idx_invoice_tenant_due_date", "tenant_id", "due_date"),
        UniqueConstraint("tenant_id", "idempotency_key", name="uq_invoice_idempotency"),
        UniqueConstraint("tenant_id", "invoice_number", name="uq_invoice_number_by_tenant"),
        {"extend_existing": True},
    )


class InvoiceLineItemEntity(Base):  # type: ignore[misc]  # Base has type Any
    """Invoice line item database entity"""

    __tablename__ = "invoice_line_items"
    __table_args__ = ({"extend_existing": True},)

    line_item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    invoice_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("invoices.invoice_id"), nullable=False
    )

    # Line item details
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[int] = mapped_column(Integer, nullable=False)
    total_price: Mapped[int] = mapped_column(Integer, nullable=False)

    # References
    product_id: Mapped[str | None] = mapped_column(String(255))
    subscription_id: Mapped[str | None] = mapped_column(String(255))

    # Tax and discount
    tax_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    discount_percentage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    discount_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Metadata
    extra_data: Mapped[dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict)

    # Relationships
    invoice: Mapped[InvoiceEntity] = relationship(back_populates="line_items")


# ============================================================================
# Payment Entities
# ============================================================================


class PaymentEntity(Base, TenantMixin, TimestampMixin):  # type: ignore[misc]  # Mixin has type Any
    """Payment database entity"""

    __tablename__ = "payments"

    payment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )

    # Idempotency
    idempotency_key: Mapped[str | None] = mapped_column(String(255), index=True)

    # Payment details
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    customer_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Status
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=PaymentStatus.PENDING,
        index=True,
    )

    # Payment method
    payment_method_type: Mapped[PaymentMethodType] = mapped_column(
        Enum(PaymentMethodType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    payment_method_details: Mapped[dict[str, Any]] = mapped_column(
        MutableDict.as_mutable(JSON), default=dict
    )

    # Provider info
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_payment_id: Mapped[str | None] = mapped_column(String(255), index=True)
    provider_fee: Mapped[int | None] = mapped_column(Integer)
    provider_payment_data: Mapped[dict[str, Any]] = mapped_column(
        MutableDict.as_mutable(JSON), default=dict
    )

    # Failure handling
    failure_reason: Mapped[str | None] = mapped_column(String(500))
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Additional timestamp
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Metadata
    extra_data: Mapped[dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    refund_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    # Relationships
    invoices: Mapped[list["PaymentInvoiceEntity"]] = relationship(back_populates="payment")

    # Indexes and constraints
    __table_args__: tuple[Any, ...] = (
        Index("idx_payment_tenant_customer", "tenant_id", "customer_id"),
        Index("idx_payment_tenant_status", "tenant_id", "status"),
        UniqueConstraint("tenant_id", "idempotency_key", name="uq_payment_idempotency"),
        {"extend_existing": True},
    )


class PaymentInvoiceEntity(Base):  # type: ignore[misc]  # Base has type Any
    """Payment-Invoice association table"""

    __tablename__ = "payment_invoices"
    __table_args__ = ({"extend_existing": True},)

    payment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("payments.payment_id"), primary_key=True
    )
    invoice_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("invoices.invoice_id"), primary_key=True
    )
    amount_applied: Mapped[int] = mapped_column(Integer, nullable=False)
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    # Relationships
    payment: Mapped[PaymentEntity] = relationship(back_populates="invoices")
    invoice: Mapped[InvoiceEntity] = relationship(back_populates="payments")


class PaymentMethodEntity(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):  # type: ignore[misc]  # Mixin has type Any
    """Payment method database entity"""

    __tablename__ = "payment_methods"

    payment_method_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    customer_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Payment method details
    type: Mapped[PaymentMethodType] = mapped_column(
        Enum(PaymentMethodType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    status: Mapped[PaymentMethodStatus] = mapped_column(
        Enum(PaymentMethodStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=PaymentMethodStatus.ACTIVE,
    )

    # Provider info
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_payment_method_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Display info
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_four: Mapped[str | None] = mapped_column(String(4))
    brand: Mapped[str | None] = mapped_column(String(50))
    expiry_month: Mapped[int | None] = mapped_column(Integer)
    expiry_year: Mapped[int | None] = mapped_column(Integer)

    # Bank account specific
    bank_name: Mapped[str | None] = mapped_column(String(100))
    account_type: Mapped[BankAccountType | None] = mapped_column(
        Enum(BankAccountType, values_callable=lambda x: [e.value for e in x])
    )
    routing_number_last_four: Mapped[str | None] = mapped_column(String(4))

    # Settings
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auto_pay_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Verification
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Metadata
    extra_data: Mapped[dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict)

    # Indexes
    __table_args__: tuple[Any, ...] = (
        Index("idx_payment_method_tenant_customer", "tenant_id", "customer_id"),
        {"extend_existing": True},
    )


# ============================================================================
# Transaction Entity
# ============================================================================


class TransactionEntity(Base, TenantMixin):  # type: ignore[misc]  # Mixin has type Any
    """Transaction ledger database entity"""

    __tablename__ = "transactions"

    transaction_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )

    # Transaction details
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)

    # References
    customer_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    invoice_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), index=True)
    payment_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), index=True)
    credit_note_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), index=True)

    # Timestamp
    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True
    )

    # Metadata
    extra_data: Mapped[dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict)

    # Indexes
    __table_args__: tuple[Any, ...] = (
        Index("idx_transaction_tenant_customer", "tenant_id", "customer_id"),
        Index("idx_transaction_tenant_date", "tenant_id", "transaction_date"),
        {"extend_existing": True},
    )


# ============================================================================
# Credit Note Entities
# ============================================================================


class CreditNoteEntity(Base, TenantMixin, TimestampMixin, AuditMixin):  # type: ignore[misc]  # Mixin has type Any
    """Credit note database entity"""

    __tablename__ = "credit_notes"

    credit_note_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    credit_note_number: Mapped[str | None] = mapped_column(String(50), unique=True, index=True)

    # Idempotency
    idempotency_key: Mapped[str | None] = mapped_column(String(255), index=True)

    # Customer and reference
    customer_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    invoice_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), index=True)

    # Credit note details
    issue_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    # Amounts in minor units
    subtotal: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_amount: Mapped[int] = mapped_column(Integer, nullable=False)

    # Credit note type and reason
    credit_type: Mapped[CreditType] = mapped_column(
        Enum(CreditType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    reason: Mapped[CreditReason] = mapped_column(
        Enum(CreditReason, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    reason_description: Mapped[str | None] = mapped_column(String(500))

    # Status
    status: Mapped[CreditNoteStatus] = mapped_column(
        Enum(CreditNoteStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=CreditNoteStatus.DRAFT,
        index=True,
    )

    # Application
    auto_apply_to_invoice: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    remaining_credit_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Content
    notes: Mapped[str | None] = mapped_column(Text)
    internal_notes: Mapped[str | None] = mapped_column(Text)
    extra_data: Mapped[dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict)

    # Additional timestamp
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    line_items: Mapped[list["CreditNoteLineItemEntity"]] = relationship(
        back_populates="credit_note", cascade="all, delete-orphan"
    )
    applications: Mapped[list["CreditApplicationEntity"]] = relationship(
        back_populates="credit_note"
    )

    # Indexes and constraints
    __table_args__: tuple[Any, ...] = (
        Index("idx_credit_note_tenant_customer", "tenant_id", "customer_id"),
        Index("idx_credit_note_tenant_status", "tenant_id", "status"),
        UniqueConstraint("tenant_id", "idempotency_key", name="uq_credit_note_idempotency"),
        {"extend_existing": True},
    )


class CreditNoteLineItemEntity(Base):  # type: ignore[misc]  # Base has type Any
    """Credit note line item database entity"""

    __tablename__ = "credit_note_line_items"
    __table_args__: tuple[Any, ...] = (
        Index("idx_credit_note_line_item_credit_note", "credit_note_id"),
        {"extend_existing": True},
    )

    line_item_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    credit_note_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("credit_notes.credit_note_id"), nullable=False
    )

    # Line item details
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[int] = mapped_column(Integer, nullable=False)
    total_price: Mapped[int] = mapped_column(Integer, nullable=False)

    # References
    original_invoice_line_item_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False))
    product_id: Mapped[str | None] = mapped_column(String(255))

    # Tax
    tax_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Metadata
    extra_data: Mapped[dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict)

    # Relationships
    credit_note: Mapped[CreditNoteEntity] = relationship(back_populates="line_items")


class CreditApplicationEntity(Base, TenantMixin):  # type: ignore[misc]  # Mixin has type Any
    """Credit application database entity"""

    __tablename__ = "credit_applications"

    application_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    credit_note_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("credit_notes.credit_note_id"), nullable=False
    )

    # Application target
    applied_to_type: Mapped[CreditApplicationType] = mapped_column(
        Enum(CreditApplicationType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    applied_to_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Application details
    applied_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    application_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    # Reference
    applied_by: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500))

    # Metadata
    extra_data: Mapped[dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict)

    # Relationships
    credit_note: Mapped[CreditNoteEntity] = relationship(back_populates="applications")

    # Indexes
    __table_args__: tuple[Any, ...] = (
        Index("idx_credit_application_tenant_target", "tenant_id", "applied_to_id"),
        {"extend_existing": True},
    )


class CustomerCreditEntity(Base, TenantMixin, TimestampMixin):  # type: ignore[misc]  # Mixin has type Any
    """Customer credit balance database entity"""

    __tablename__ = "customer_credits"
    __table_args__: tuple[Any, ...] = (
        Index("idx_customer_credit_tenant", "tenant_id", "customer_id"),
        {"extend_existing": True},
    )

    customer_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(255), primary_key=True)

    # Credit balance
    total_credit_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    # Credit sources
    credit_notes: Mapped[list[str]] = mapped_column(JSON, default=list)

    # Settings
    auto_apply_to_new_invoices: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Metadata
    extra_data: Mapped[dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict)

    # Composite primary key handled in __table_args__


# ============================================================================
# Service Entities
# ============================================================================


class ServiceEntity(Base, TenantMixin, TimestampMixin, AuditMixin, SoftDeleteMixin):  # type: ignore[misc]  # Mixin has type Any
    """Service database entity for tracking subscriber services"""

    __tablename__ = "services"

    service_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )

    # References
    customer_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    subscriber_id: Mapped[str | None] = mapped_column(String(255), index=True)
    subscription_id: Mapped[str | None] = mapped_column(String(255), index=True)
    plan_id: Mapped[str | None] = mapped_column(String(255), index=True)

    # Service details
    service_type: Mapped[ServiceType] = mapped_column(
        Enum(ServiceType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ServiceType.BROADBAND,
    )
    service_name: Mapped[str] = mapped_column(String(255), nullable=False)
    service_description: Mapped[str | None] = mapped_column(Text)

    # Status
    status: Mapped[ServiceStatus] = mapped_column(
        Enum(ServiceStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ServiceStatus.PENDING,
        index=True,
    )

    # Lifecycle timestamps
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    terminated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Suspension details
    suspension_reason: Mapped[str | None] = mapped_column(Text)
    suspend_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Termination details
    termination_reason: Mapped[str | None] = mapped_column(Text)

    # Service configuration (flexible JSON for service-specific data)
    bandwidth_mbps: Mapped[int | None] = mapped_column(Integer)
    service_metadata: Mapped[dict[str, Any]] = mapped_column(
        MutableDict.as_mutable(JSON), default=dict
    )

    # Pricing
    monthly_price: Mapped[int | None] = mapped_column(Integer, comment="Price in minor units")
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    # Notes
    notes: Mapped[str | None] = mapped_column(Text)
    internal_notes: Mapped[str | None] = mapped_column(Text)

    # Indexes and constraints
    __table_args__: tuple[Any, ...] = (
        Index("idx_service_tenant_customer", "tenant_id", "customer_id"),
        Index("idx_service_tenant_subscriber", "tenant_id", "subscriber_id"),
        Index("idx_service_tenant_status", "tenant_id", "status"),
        Index("idx_service_tenant_type", "tenant_id", "service_type"),
        {"extend_existing": True},
    )
