"""
Domain Aggregate Mappers.

Maps between domain aggregates (business logic) and database entities (persistence).
This maintains clean separation between domain and infrastructure layers.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from dotmac.platform.billing.core.entities import (
    InvoiceEntity,
    PaymentEntity,
)
from dotmac.platform.billing.core.models import Invoice as InvoiceModel
from dotmac.platform.billing.core.models import Payment as PaymentModel
from dotmac.platform.billing.subscriptions.models import Subscription as SubscriptionModel
from dotmac.platform.core import Money
from dotmac.platform.customer_management.models import (
    CommunicationChannel,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)
from dotmac.platform.customer_management.models import (
    Customer as CustomerEntity,
)

from .aggregates import Customer, Invoice, InvoiceLineItem, Payment, Subscription

# Note: CustomerModel Pydantic model will be created when needed
# For now, CustomerEntity (SQLAlchemy) is used


# ============================================================================
# Invoice Mapper
# ============================================================================


class InvoiceMapper:
    """Map between Invoice aggregate and InvoiceEntity/InvoiceModel."""

    @staticmethod
    def to_entity(invoice: Invoice) -> InvoiceEntity:
        """
        Convert Invoice aggregate to InvoiceEntity for persistence.

        Args:
            invoice: Invoice aggregate

        Returns:
            InvoiceEntity for database persistence
        """
        from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus

        status_value = (
            InvoiceStatus(invoice.status) if isinstance(invoice.status, str) else invoice.status
        )
        payment_status_value = (
            PaymentStatus(invoice.payment_status)
            if isinstance(invoice.payment_status, str)
            else invoice.payment_status
        )

        return InvoiceEntity(
            invoice_id=invoice.id,
            tenant_id=invoice.tenant_id,
            invoice_number=invoice.invoice_number,
            customer_id=invoice.customer_id,
            billing_email=invoice.billing_email,
            billing_address={},  # Would be populated from customer
            issue_date=invoice.issue_date,
            due_date=invoice.due_date,
            currency=invoice.subtotal.currency,
            # Convert to minor units (cents)
            subtotal=int(invoice.subtotal.amount * 100),
            tax_amount=int(invoice.tax_amount.amount * 100),
            discount_amount=int(invoice.discount_amount.amount * 100),
            total_amount=int(invoice.total_amount.amount * 100),
            remaining_balance=int(invoice.remaining_balance.amount * 100),
            status=status_value,
            payment_status=payment_status_value,
            subscription_id=invoice.subscription_id,
            notes=invoice.notes,
            paid_at=invoice.paid_at,
            voided_at=invoice.voided_at,
        )

    @staticmethod
    def to_aggregate(entity: InvoiceEntity) -> Invoice:
        """
        Convert InvoiceEntity to Invoice aggregate.

        Args:
            entity: Database entity

        Returns:
            Invoice aggregate with business logic
        """
        return Invoice(
            id=entity.invoice_id,
            tenant_id=entity.tenant_id or "",
            invoice_number=entity.invoice_number or "",
            customer_id=entity.customer_id,
            billing_email=entity.billing_email,
            issue_date=entity.issue_date,
            due_date=entity.due_date,
            subtotal=Money(
                amount=entity.subtotal / 100,
                currency=entity.currency,
            ),
            tax_amount=Money(
                amount=entity.tax_amount / 100,
                currency=entity.currency,
            ),
            discount_amount=Money(
                amount=entity.discount_amount / 100,
                currency=entity.currency,
            ),
            total_amount=Money(
                amount=entity.total_amount / 100,
                currency=entity.currency,
            ),
            remaining_balance=Money(
                amount=entity.remaining_balance / 100,
                currency=entity.currency,
            ),
            line_items_data=[],  # Would be loaded from line_items relationship
            status=entity.status.value if hasattr(entity.status, "value") else entity.status,
            payment_status=(
                entity.payment_status.value
                if hasattr(entity.payment_status, "value")
                else entity.payment_status
            ),
            subscription_id=entity.subscription_id,
            notes=entity.notes,
            paid_at=entity.paid_at,
            voided_at=entity.voided_at,
            version=1,  # Would track this in entity
        )

    @staticmethod
    def to_model(invoice: Invoice) -> InvoiceModel:
        """
        Convert Invoice aggregate to Pydantic InvoiceModel.

        Args:
            invoice: Invoice aggregate

        Returns:
            InvoiceModel for API responses
        """

        return InvoiceModel(
            tenant_id=invoice.tenant_id,
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            customer_id=invoice.customer_id,
            billing_email=invoice.billing_email,
            billing_address={},
            issue_date=invoice.issue_date,
            due_date=invoice.due_date,
            currency=invoice.subtotal.currency,
            subtotal=int(invoice.subtotal.amount * 100),
            tax_amount=int(invoice.tax_amount.amount * 100),
            discount_amount=int(invoice.discount_amount.amount * 100),
            total_amount=int(invoice.total_amount.amount * 100),
            remaining_balance=int(invoice.remaining_balance.amount * 100),
            status=invoice.status,
            payment_status=invoice.payment_status,
            created_by=None,
            total_credits_applied=0,
            credit_applications=[],
            notes=invoice.notes,
            internal_notes=None,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    @staticmethod
    def line_items_to_aggregate(
        line_items_data: list[dict[str, Any]], currency: str
    ) -> list[InvoiceLineItem]:
        """Convert line item data to InvoiceLineItem value objects."""
        return [
            InvoiceLineItem(
                description=item["description"],
                quantity=item["quantity"],
                unit_price=Money(amount=item["unit_price"], currency=currency),
                total_price=Money(amount=item["total_price"], currency=currency),
                product_id=item.get("product_id"),
            )
            for item in line_items_data
        ]


# ============================================================================
# Payment Mapper
# ============================================================================


class PaymentMapper:
    """Map between Payment aggregate and PaymentEntity/PaymentModel."""

    @staticmethod
    def to_entity(payment: Payment) -> PaymentEntity:
        """Convert Payment aggregate to PaymentEntity."""
        # Map payment_method string to PaymentMethodType enum
        from dotmac.platform.billing.core.enums import PaymentMethodType

        payment_method_map = {
            "card": PaymentMethodType.CARD,
            "bank_transfer": PaymentMethodType.WIRE_TRANSFER,
            "wire_transfer": PaymentMethodType.WIRE_TRANSFER,
            "cash": PaymentMethodType.CASH,
            "check": PaymentMethodType.CHECK,
        }
        payment_method_type = payment_method_map.get(payment.payment_method, PaymentMethodType.CARD)

        from dotmac.platform.billing.core.enums import PaymentStatus

        status_value = (
            PaymentStatus(payment.status) if isinstance(payment.status, str) else payment.status
        )

        return PaymentEntity(
            payment_id=payment.id,
            tenant_id=payment.tenant_id,
            customer_id=payment.customer_id,
            amount=int(payment.amount.amount * 100),
            currency=payment.amount.currency,
            payment_method_type=payment_method_type,
            provider=payment.payment_method,  # Use as provider for now
            status=status_value,
            processed_at=payment.processed_at,
            failure_reason=payment.error_message,
            provider_payment_id=payment.transaction_id,
            provider_fee=None,
        )

    @staticmethod
    def to_aggregate(entity: PaymentEntity) -> Payment:
        """Convert PaymentEntity to Payment aggregate."""
        # Map PaymentMethodType enum to string
        payment_method = (
            entity.payment_method_type.value
            if hasattr(entity.payment_method_type, "value")
            else str(entity.payment_method_type)
        )

        return Payment(
            id=entity.payment_id,
            tenant_id=entity.tenant_id or "",
            payment_id=entity.payment_id,
            customer_id=entity.customer_id,
            amount=Money(
                amount=entity.amount / 100,
                currency=entity.currency,
            ),
            payment_method=payment_method,
            status=entity.status.value if hasattr(entity.status, "value") else entity.status,
            invoice_id=None,  # Not in PaymentEntity directly
            subscription_id=None,  # Not in PaymentEntity directly
            transaction_id=entity.provider_payment_id,
            error_code=None,  # Not in PaymentEntity directly
            error_message=entity.failure_reason,
            processed_at=entity.processed_at,
            failed_at=None,  # Not in PaymentEntity directly
            version=1,
        )

    @staticmethod
    def to_model(payment: Payment) -> PaymentModel:
        """Convert Payment aggregate to PaymentModel."""
        from dotmac.platform.billing.core.enums import PaymentMethodType, PaymentStatus

        # Map payment_method string to enum
        payment_method_map = {
            "card": PaymentMethodType.CARD,
            "bank_transfer": PaymentMethodType.WIRE_TRANSFER,
            "wire_transfer": PaymentMethodType.WIRE_TRANSFER,
            "cash": PaymentMethodType.CASH,
            "check": PaymentMethodType.CHECK,
        }
        payment_method_type = payment_method_map.get(payment.payment_method, PaymentMethodType.CARD)

        # Map status string to enum
        status = (
            PaymentStatus(payment.status) if isinstance(payment.status, str) else payment.status
        )

        return PaymentModel(
            tenant_id=payment.tenant_id,
            payment_id=payment.id,
            customer_id=payment.customer_id,
            amount=int(payment.amount.amount * 100),
            currency=payment.amount.currency,
            payment_method_type=payment_method_type,
            payment_method_details={},
            status=status,
            provider=payment.payment_method,
            provider_fee=None,
            invoice_ids=[payment.invoice_id] if payment.invoice_id else [],
            failure_reason=payment.error_message,
            retry_count=0,
            refund_amount=None,
        )


# ============================================================================
# Subscription Mapper
# ============================================================================


class SubscriptionMapper:
    """Map between Subscription aggregate and SubscriptionModel."""

    # Note: SubscriptionEntity doesn't exist yet in core.entities
    # These methods will be implemented when entity is created

    # @staticmethod
    # def to_entity(subscription: Subscription) -> SubscriptionEntity:
    #     """Convert Subscription aggregate to SubscriptionEntity."""
    #     pass

    # @staticmethod
    # def to_aggregate(entity: SubscriptionEntity) -> Subscription:
    #     """Convert SubscriptionEntity to Subscription aggregate."""
    #     pass

    @staticmethod
    def to_model(subscription: Subscription) -> SubscriptionModel:
        """Convert Subscription aggregate to SubscriptionModel."""

        from dotmac.platform.billing.subscriptions.models import SubscriptionStatus

        # Map status string to enum
        status = (
            SubscriptionStatus(subscription.status)
            if isinstance(subscription.status, str)
            else subscription.status
        )

        return SubscriptionModel(
            tenant_id=subscription.tenant_id,
            subscription_id=subscription.id,
            customer_id=subscription.customer_id,
            plan_id=subscription.plan_id,
            status=status,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            updated_at=datetime.now(UTC),
            trial_end=None,
            canceled_at=None,
            ended_at=None,
            custom_price=None,
        )


# ============================================================================
# Customer Mapper
# ============================================================================


class CustomerMapper:
    """Map between Customer aggregate and CustomerEntity."""

    @staticmethod
    def to_entity(customer: Customer) -> CustomerEntity:
        """Convert Customer aggregate to CustomerEntity."""
        # Split name into first/last for required fields
        display_name = customer.name or (
            customer.email.split("@", 1)[0] if customer.email else "Customer"
        )
        name_parts = display_name.strip().split()
        first_name = name_parts[0] if name_parts else "Customer"
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else first_name

        status = (
            CustomerStatus(customer.status)
            if isinstance(customer.status, str)
            else customer.status
            if customer.status
            else CustomerStatus.ACTIVE
        )

        # Ensure we have UUID for primary key
        try:
            entity_id = UUID(customer.id)
        except (TypeError, ValueError):
            entity_id = uuid4()

        return CustomerEntity(
            id=entity_id,
            tenant_id=customer.tenant_id,
            customer_number=customer.customer_id,
            first_name=first_name,
            last_name=last_name or first_name,
            display_name=display_name,
            company_name=customer.company,
            status=status,
            customer_type=CustomerType.INDIVIDUAL,
            tier=CustomerTier.FREE,
            email=customer.email,
            email_verified=False,
            phone=customer.phone,
            phone_verified=False,
            preferred_channel=CommunicationChannel.EMAIL,
            preferred_language="en",
            timezone="UTC",
            opt_in_marketing=False,
            opt_in_updates=True,
            metadata_=customer.metadata or {},
            deleted_at=customer.deleted_at,
            is_deleted=customer.is_deleted,
        )

    @staticmethod
    def to_aggregate(entity: CustomerEntity) -> Customer:
        """Convert CustomerEntity to Customer aggregate."""
        # CustomerEntity uses first_name/last_name, not name
        name = getattr(entity, "display_name", None)
        if not name:
            first_name = getattr(entity, "first_name", "")
            last_name = getattr(entity, "last_name", "")
            name = f"{first_name} {last_name}".strip()

        status_value = entity.status.value if hasattr(entity.status, "value") else entity.status

        return Customer(
            id=str(entity.id),
            tenant_id=entity.tenant_id or "",
            customer_id=entity.customer_number,
            email=getattr(entity, "email", ""),
            name=name,
            company=getattr(entity, "company_name", None),
            phone=getattr(entity, "phone", None),
            status=status_value or "active",
            is_deleted=getattr(entity, "is_deleted", False),
            metadata=getattr(entity, "metadata_", {}) or {},
            deleted_at=getattr(entity, "deleted_at", None),
            version=1,
        )
