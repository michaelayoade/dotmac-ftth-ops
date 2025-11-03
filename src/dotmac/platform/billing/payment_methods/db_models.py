"""
SQLAlchemy ORM Models for Payment Methods

This module defines the database models for tenant payment methods,
mapping to the billing_payment_methods table created in migration 25eed1ceec2d.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import Base
from dotmac.platform.db.types import JSONBCompat

from .models import PaymentMethodType


class BillingPaymentMethodTable(Base):
    """
    SQLAlchemy ORM model for tenant payment methods.

    Maps to the billing_payment_methods table for storing payment method
    information including credit cards, bank accounts, and digital wallets.

    Multi-tenant isolated via tenant_id.
    """

    __tablename__ = "billing_payment_methods"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Multi-tenant isolation
    tenant_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Payment method identification
    payment_method_type: Mapped[PaymentMethodType] = mapped_column(
        Enum(PaymentMethodType, name="payment_method_type"),
        nullable=False,
    )

    # External provider reference (Stripe payment method ID)
    provider_payment_method_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Stripe PaymentMethod ID (pm_xxx)",
    )

    # Customer reference (Stripe customer ID)
    provider_customer_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        comment="Stripe Customer ID (cus_xxx)",
    )

    # Display information
    display_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="User-friendly name (e.g., 'Visa ending in 4242')",
    )

    # Default payment method flag
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    # AutoPay flag
    auto_pay_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Enable automatic payments for invoices using this payment method",
    )

    # Verification status for bank accounts
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Always true for cards, must be verified for bank accounts",
    )

    # Card/Bank account details (last 4 digits, expiry, etc.)
    details: Mapped[dict[str, Any]] = mapped_column(
        JSONBCompat,
        nullable=False,
        default=dict,
        comment="Payment method details (last4, exp_month, exp_year, brand, etc.)",
    )

    # Additional metadata
    metadata_: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata",
        JSONBCompat,
        nullable=True,
        default=None,
        comment="Additional metadata for tracking and integration",
    )

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    deleted_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Indexes for multi-tenant queries
    __table_args__ = (
        Index(
            "ix_billing_payment_methods_tenant_default",
            "tenant_id",
            "is_default",
            postgresql_where=(is_deleted == False),  # noqa: E712
        ),
        Index(
            "ix_billing_payment_methods_tenant_active",
            "tenant_id",
            "is_deleted",
        ),
        Index(
            "ix_billing_payment_methods_provider",
            "provider_payment_method_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<BillingPaymentMethod("
            f"id={self.id}, "
            f"tenant_id={self.tenant_id}, "
            f"type={self.payment_method_type.value}, "
            f"display_name={self.display_name}, "
            f"is_default={self.is_default}"
            f")>"
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert ORM model to dictionary for Pydantic schema conversion."""
        return {
            "id": str(self.id),
            "tenant_id": self.tenant_id,
            "payment_method_type": self.payment_method_type,
            "provider_payment_method_id": self.provider_payment_method_id,
            "provider_customer_id": self.provider_customer_id,
            "display_name": self.display_name,
            "is_default": self.is_default,
            "is_verified": self.is_verified,
            "details": self.details,
            "metadata": self.metadata_,
            "is_deleted": self.is_deleted,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "deleted_reason": self.deleted_reason,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
