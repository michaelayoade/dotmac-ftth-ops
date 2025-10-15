"""Payment processing service with tenant support and idempotency."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import uuid4

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import (
    PaymentEntity,
    PaymentInvoiceEntity,
    PaymentMethodEntity,
    TransactionEntity,
)
from dotmac.platform.billing.core.enums import (
    PaymentMethodStatus,
    PaymentMethodType,
    PaymentStatus,
    TransactionType,
)
from dotmac.platform.billing.core.exceptions import (
    PaymentError,
    PaymentMethodNotFoundError,
    PaymentNotFoundError,
)
from dotmac.platform.billing.core.models import Payment, PaymentMethod
from dotmac.platform.billing.payments.providers import PaymentProvider
from dotmac.platform.settings import settings
from dotmac.platform.webhooks.events import get_event_bus
from dotmac.platform.webhooks.models import WebhookEvent

logger = structlog.get_logger(__name__)


class PaymentService:
    """Payment processing service with tenant isolation"""

    def __init__(
        self,
        db_session: AsyncSession,
        payment_providers: dict[str, PaymentProvider] | None = None,
    ):
        self.db = db_session
        self.providers = payment_providers or {}

    async def _validate_payment_request(
        self, tenant_id: str, payment_method_id: str, idempotency_key: str | None
    ) -> tuple[PaymentEntity | None, Any]:
        """Validate payment request and return existing payment if idempotency key exists."""
        # Check for existing payment with same idempotency key
        existing_payment = None
        if idempotency_key:
            existing_payment = await self._get_payment_by_idempotency_key(
                tenant_id, idempotency_key
            )
            if existing_payment:
                return existing_payment, None

        # Get and validate payment method
        payment_method = await self._get_payment_method(tenant_id, payment_method_id)
        if not payment_method:
            raise PaymentMethodNotFoundError(f"Payment method {payment_method_id} not found")

        if payment_method.status != PaymentMethodStatus.ACTIVE:
            raise PaymentError(f"Payment method {payment_method_id} is not active")

        return None, payment_method

    async def _process_with_provider(
        self,
        payment_entity: PaymentEntity,
        provider: str,
        amount: int,
        currency: str,
        provider_payment_method_id: str,
    ) -> None:
        """Process payment with payment provider."""
        try:
            if provider in self.providers:
                provider_instance = self.providers[provider]
                result = await provider_instance.charge_payment_method(
                    amount=amount,
                    currency=currency,
                    payment_method_id=provider_payment_method_id,
                    metadata={"payment_id": payment_entity.payment_id},
                )

                # Update payment with provider response
                payment_entity.provider_payment_id = result.provider_payment_id
                payment_entity.provider_fee = result.provider_fee
                payment_entity.status = (
                    PaymentStatus.SUCCEEDED if result.success else PaymentStatus.FAILED
                )
                payment_entity.failure_reason = result.error_message if not result.success else None
                payment_entity.processed_at = datetime.now(UTC)
            else:
                # Mock success for testing
                payment_entity.status = PaymentStatus.SUCCEEDED
                payment_entity.processed_at = datetime.now(UTC)
                logger.warning(f"Payment provider {provider} not configured, mocking success")

        except Exception as e:
            payment_entity.status = PaymentStatus.FAILED
            payment_entity.failure_reason = str(e)
            payment_entity.processed_at = datetime.now(UTC)
            logger.error(f"Payment processing error: {e}")

    async def _handle_payment_success(
        self,
        payment_entity: PaymentEntity,
        tenant_id: str,
        customer_id: str,
        amount: int,
        currency: str,
        payment_method_id: str,
        provider: str,
        invoice_ids: list[str] | None,
    ) -> None:
        """Handle successful payment processing."""
        # Create transaction record
        await self._create_transaction(payment_entity, TransactionType.PAYMENT)

        # Link to invoices if provided
        if invoice_ids:
            await self._link_payment_to_invoices(payment_entity, invoice_ids)

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.PAYMENT_SUCCEEDED.value,
                event_data={
                    "payment_id": payment_entity.payment_id,
                    "customer_id": customer_id,
                    "amount": float(amount / 100),  # Convert to decimal
                    "currency": currency,
                    "payment_method_id": payment_method_id,
                    "provider": provider,
                    "provider_payment_id": payment_entity.provider_payment_id,
                    "invoice_ids": invoice_ids,
                    "processed_at": (
                        payment_entity.processed_at.isoformat()
                        if payment_entity.processed_at
                        else None
                    ),
                },
                tenant_id=tenant_id,
                db=self.db,
            )
        except Exception as e:
            logger.warning(f"Failed to publish payment.succeeded event: {e}")

    async def _handle_payment_failure(
        self,
        payment_entity: PaymentEntity,
        tenant_id: str,
        customer_id: str,
        amount: int,
        currency: str,
        payment_method_id: str,
        provider: str,
    ) -> None:
        """Handle failed payment processing."""
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.PAYMENT_FAILED.value,
                event_data={
                    "payment_id": payment_entity.payment_id,
                    "customer_id": customer_id,
                    "amount": float(amount / 100),
                    "currency": currency,
                    "payment_method_id": payment_method_id,
                    "provider": provider,
                    "failure_reason": payment_entity.failure_reason,
                    "processed_at": (
                        payment_entity.processed_at.isoformat()
                        if payment_entity.processed_at
                        else None
                    ),
                },
                tenant_id=tenant_id,
                db=self.db,
            )
        except Exception as e:
            logger.warning(f"Failed to publish payment.failed event: {e}")

    async def create_payment(
        self,
        tenant_id: str,
        amount: int,
        currency: str,
        customer_id: str,
        payment_method_id: str,
        provider: str = "stripe",
        idempotency_key: str | None = None,
        invoice_ids: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Payment:
        """Create and process a payment with idempotency"""

        # Validate request and check for existing payment
        existing_payment, payment_method = await self._validate_payment_request(
            tenant_id, payment_method_id, idempotency_key
        )
        if existing_payment:
            return Payment.model_validate(existing_payment)

        # Create payment record
        payment_entity = PaymentEntity(
            tenant_id=tenant_id,
            amount=amount,
            currency=currency,
            customer_id=customer_id,
            idempotency_key=idempotency_key,
            provider=provider,
            status=PaymentStatus.PENDING,
            payment_method_type=payment_method.type,
            payment_method_details={
                "payment_method_id": payment_method_id,
                "last_four": payment_method.last_four,
                "brand": payment_method.brand,
            },
            extra_data=metadata or {},
        )

        # Save to database first
        self.db.add(payment_entity)
        await self.db.commit()

        # Process with payment provider
        await self._process_with_provider(
            payment_entity, provider, amount, currency, payment_method.provider_payment_method_id
        )

        # Update payment record
        await self.db.commit()
        await self.db.refresh(payment_entity)

        # Handle success or failure
        if payment_entity.status == PaymentStatus.SUCCEEDED:
            await self._handle_payment_success(
                payment_entity,
                tenant_id,
                customer_id,
                amount,
                currency,
                payment_method_id,
                provider,
                invoice_ids,
            )
        elif payment_entity.status == PaymentStatus.FAILED:
            await self._handle_payment_failure(
                payment_entity,
                tenant_id,
                customer_id,
                amount,
                currency,
                payment_method_id,
                provider,
            )

        return Payment.model_validate(payment_entity)

    async def _validate_refund_request(
        self, tenant_id: str, payment_id: str, amount: int | None, idempotency_key: str | None
    ) -> tuple[PaymentEntity | None, PaymentEntity, int]:
        """Validate refund request and return existing refund if idempotency key exists."""
        # Get original payment
        original_payment = await self._get_payment_entity(tenant_id, payment_id)
        if not original_payment:
            raise PaymentNotFoundError(f"Payment {payment_id} not found")

        if original_payment.status != PaymentStatus.SUCCEEDED:
            raise PaymentError("Can only refund successful payments")

        # Determine refund amount
        refund_amount = amount or original_payment.amount

        if refund_amount > original_payment.amount:
            raise PaymentError("Refund amount cannot exceed original payment amount")

        # Check for existing refund with same idempotency key
        existing_refund = None
        if idempotency_key:
            existing_refund = await self._get_payment_by_idempotency_key(tenant_id, idempotency_key)

        return existing_refund, original_payment, refund_amount

    async def _process_refund_with_provider(
        self,
        refund: PaymentEntity,
        original_payment: PaymentEntity,
        refund_amount: int,
        reason: str | None,
    ) -> None:
        """Process refund with payment provider."""
        try:
            if original_payment.provider in self.providers:
                provider_instance = self.providers[original_payment.provider]
                provider_payment_id = original_payment.provider_payment_id
                if provider_payment_id is None:
                    raise PaymentError("Original payment lacks provider payment reference")
                result = await provider_instance.refund_payment(
                    provider_payment_id,
                    refund_amount,
                    reason,
                )

                refund.provider_payment_id = result.provider_refund_id
                refund.status = PaymentStatus.REFUNDED if result.success else PaymentStatus.FAILED
                refund.failure_reason = result.error_message if not result.success else None
            else:
                # Mock success for testing
                refund.status = PaymentStatus.REFUNDED
                logger.warning(
                    f"Payment provider {original_payment.provider} not configured, mocking refund"
                )

            refund.processed_at = datetime.now(UTC)

        except Exception as e:
            refund.status = PaymentStatus.FAILED
            refund.failure_reason = str(e)
            refund.processed_at = datetime.now(UTC)
            logger.error(f"Refund processing error: {e}")

    async def _handle_refund_success(
        self,
        refund: PaymentEntity,
        original_payment: PaymentEntity,
        payment_id: str,
        refund_amount: int,
        reason: str | None,
        tenant_id: str,
    ) -> None:
        """Handle successful refund processing."""
        # Create transaction record
        await self._create_transaction(refund, TransactionType.REFUND)

        # Update original payment status
        if refund_amount == original_payment.amount:
            original_payment.status = PaymentStatus.REFUNDED
        else:
            original_payment.status = PaymentStatus.PARTIALLY_REFUNDED
        await self.db.commit()

        # Publish webhook event
        try:
            await get_event_bus().publish(
                event_type=WebhookEvent.PAYMENT_REFUNDED.value,
                event_data={
                    "refund_id": refund.payment_id,
                    "original_payment_id": payment_id,
                    "customer_id": original_payment.customer_id,
                    "amount": float(abs(refund_amount) / 100),  # Convert to decimal
                    "currency": original_payment.currency,
                    "reason": reason,
                    "provider": original_payment.provider,
                    "provider_refund_id": refund.provider_payment_id,
                    "processed_at": (
                        refund.processed_at.isoformat() if refund.processed_at else None
                    ),
                    "refund_type": (
                        "full" if refund_amount == original_payment.amount else "partial"
                    ),
                },
                tenant_id=tenant_id,
                db=self.db,
            )
        except Exception as e:
            logger.warning(f"Failed to publish payment.refunded event: {e}")

    async def refund_payment(
        self,
        tenant_id: str,
        payment_id: str,
        amount: int | None = None,
        reason: str | None = None,
        idempotency_key: str | None = None,
    ) -> Payment:
        """Refund a payment with idempotency"""

        # Validate refund request
        existing_refund, original_payment, refund_amount = await self._validate_refund_request(
            tenant_id, payment_id, amount, idempotency_key
        )
        if existing_refund:
            return Payment.model_validate(existing_refund)

        # Create refund payment record
        refund = PaymentEntity(
            tenant_id=tenant_id,
            amount=-refund_amount,  # Negative amount for refund
            currency=original_payment.currency,
            customer_id=original_payment.customer_id,
            idempotency_key=idempotency_key,
            provider=original_payment.provider,
            status=PaymentStatus.PENDING,
            payment_method_type=original_payment.payment_method_type,
            payment_method_details=original_payment.payment_method_details,
            extra_data={
                "refund_reason": reason,
                "original_payment_id": payment_id,
            },
        )

        self.db.add(refund)
        await self.db.commit()

        # Process refund with provider
        await self._process_refund_with_provider(refund, original_payment, refund_amount, reason)

        await self.db.commit()
        await self.db.refresh(refund)

        # Handle successful refund
        if refund.status == PaymentStatus.REFUNDED:
            await self._handle_refund_success(
                refund, original_payment, payment_id, refund_amount, reason, tenant_id
            )

        return Payment.model_validate(refund)

    async def add_payment_method(
        self,
        tenant_id: str,
        customer_id: str,
        payment_method_type: PaymentMethodType,
        provider: str,
        provider_payment_method_id: str,
        display_name: str,
        last_four: str | None = None,
        brand: str | None = None,
        expiry_month: int | None = None,
        expiry_year: int | None = None,
        bank_name: str | None = None,
        account_type: str | None = None,
        set_as_default: bool = False,
    ) -> PaymentMethod:
        """Add a new payment method for customer"""

        # Create payment method entity
        payment_method = PaymentMethodEntity(
            tenant_id=tenant_id,
            customer_id=customer_id,
            type=payment_method_type,
            status=PaymentMethodStatus.ACTIVE,
            provider=provider,
            provider_payment_method_id=provider_payment_method_id,
            display_name=display_name,
            last_four=last_four,
            brand=brand,
            expiry_month=expiry_month,
            expiry_year=expiry_year,
            bank_name=bank_name,
            is_default=False,
            auto_pay_enabled=False,
            verified_at=(
                datetime.now(UTC) if payment_method_type == PaymentMethodType.CARD else None
            ),
        )

        # Set as default if requested or if it's the first payment method
        if set_as_default:
            await self._clear_default_payment_methods(tenant_id, customer_id)
            payment_method.is_default = True
        else:
            existing_count = await self._count_payment_methods(tenant_id, customer_id)
            if existing_count == 0:
                payment_method.is_default = True

        self.db.add(payment_method)
        await self.db.commit()
        await self.db.refresh(payment_method)

        return PaymentMethod.model_validate(payment_method)

    async def get_payment_method(
        self, tenant_id: str, payment_method_id: str
    ) -> PaymentMethod | None:
        """Get payment method by ID"""

        payment_method = await self._get_payment_method(tenant_id, payment_method_id)
        if payment_method:
            return PaymentMethod.model_validate(payment_method)
        return None

    async def list_payment_methods(
        self, tenant_id: str, customer_id: str, include_inactive: bool = False
    ) -> list[PaymentMethod]:
        """List customer payment methods"""

        query = select(PaymentMethodEntity).where(
            and_(
                PaymentMethodEntity.tenant_id == tenant_id,
                PaymentMethodEntity.customer_id == customer_id,
            )
        )

        if not include_inactive:
            query = query.where(
                PaymentMethodEntity.status.in_(
                    [PaymentMethodStatus.ACTIVE, PaymentMethodStatus.REQUIRES_VERIFICATION]
                )
            )

        query = query.order_by(
            PaymentMethodEntity.is_default.desc(), PaymentMethodEntity.created_at.desc()
        )

        result = await self.db.execute(query)
        payment_methods = result.scalars().all()

        return [PaymentMethod.model_validate(pm) for pm in payment_methods]

    async def set_default_payment_method(
        self, tenant_id: str, customer_id: str, payment_method_id: str
    ) -> PaymentMethod:
        """Set payment method as default for customer"""

        payment_method = await self._get_payment_method(tenant_id, payment_method_id)
        if not payment_method:
            raise PaymentMethodNotFoundError(f"Payment method {payment_method_id} not found")

        if payment_method.customer_id != customer_id:
            raise PaymentError("Payment method does not belong to customer")

        # Clear other defaults
        await self._clear_default_payment_methods(tenant_id, customer_id)

        # Set new default
        payment_method.is_default = True
        await self.db.commit()
        await self.db.refresh(payment_method)

        return PaymentMethod.model_validate(payment_method)

    async def delete_payment_method(self, tenant_id: str, payment_method_id: str) -> bool:
        """Soft delete a payment method"""

        payment_method = await self._get_payment_method(tenant_id, payment_method_id)
        if not payment_method:
            raise PaymentMethodNotFoundError(f"Payment method {payment_method_id} not found")

        # Soft delete
        payment_method.is_active = False
        payment_method.deleted_at = datetime.now(UTC)
        payment_method.status = PaymentMethodStatus.INACTIVE

        await self.db.commit()
        return True

    async def retry_failed_payment(self, tenant_id: str, payment_id: str) -> Payment:
        """Retry a failed payment"""

        payment = await self._get_payment_entity(tenant_id, payment_id)
        if not payment:
            raise PaymentNotFoundError(f"Payment {payment_id} not found")

        if payment.status != PaymentStatus.FAILED:
            raise PaymentError("Can only retry failed payments")

        # Check retry limit (from settings)
        if payment.retry_count >= settings.billing.payment_retry_attempts:
            raise PaymentError(
                f"Maximum retry attempts ({settings.billing.payment_retry_attempts}) reached"
            )

        # Update retry count and schedule with exponential backoff (from settings)
        payment.retry_count += 1
        payment.next_retry_at = datetime.now(UTC) + timedelta(
            hours=settings.billing.payment_retry_exponential_base_hours**payment.retry_count
        )
        payment.status = PaymentStatus.PROCESSING

        await self.db.commit()

        # Attempt payment again
        try:
            if payment.provider in self.providers:
                # Get payment method details
                payment_method_reference = payment.payment_method_details.get("payment_method_id")
                if not isinstance(payment_method_reference, str) or not payment_method_reference:
                    raise PaymentError("Payment method identifier missing for retry")

                payment_method = await self._get_payment_method(tenant_id, payment_method_reference)

                if payment_method:
                    provider_instance = self.providers[payment.provider]
                    result = await provider_instance.charge_payment_method(
                        amount=payment.amount,
                        currency=payment.currency,
                        payment_method_id=payment_method.provider_payment_method_id,
                        metadata={
                            "payment_id": payment.payment_id,
                            "retry_attempt": payment.retry_count,
                        },
                    )

                    payment.status = (
                        PaymentStatus.SUCCEEDED if result.success else PaymentStatus.FAILED
                    )
                    payment.failure_reason = result.error_message if not result.success else None
                    payment.processed_at = datetime.now(UTC)

                    if result.success:
                        payment.provider_payment_id = result.provider_payment_id
                        payment.provider_fee = result.provider_fee
                        await self._create_transaction(payment, TransactionType.PAYMENT)
            else:
                # Mock retry
                payment.status = PaymentStatus.SUCCEEDED
                payment.processed_at = datetime.now(UTC)

        except Exception as e:
            payment.status = PaymentStatus.FAILED
            payment.failure_reason = str(e)
            logger.error(f"Payment retry error: {e}")

        await self.db.commit()
        await self.db.refresh(payment)

        return Payment.model_validate(payment)

    async def get_payment(self, tenant_id: str, payment_id: str) -> Payment | None:
        """Get payment by ID with tenant isolation.

        This method is used by webhook handlers to retrieve payment records.

        Args:
            tenant_id: Tenant identifier
            payment_id: Payment identifier

        Returns:
            Payment object if found, None otherwise
        """
        payment_entity = await self._get_payment_entity(tenant_id, payment_id)
        if not payment_entity:
            return None
        return Payment.model_validate(payment_entity)

    async def update_payment_status(
        self,
        tenant_id: str,
        payment_id: str,
        new_status: PaymentStatus,
        provider_data: dict[str, Any] | None = None,
        error_message: str | None = None,
    ) -> Payment:
        """Update payment status from webhook notification.

        This method is called by webhook handlers when payment providers
        send status updates (success, failure, refund, etc.).

        Args:
            tenant_id: Tenant identifier
            payment_id: Payment identifier
            new_status: New payment status
            provider_data: Optional provider-specific data to store
            error_message: Optional error message for failed payments

        Returns:
            Updated Payment object

        Raises:
            PaymentNotFoundError: If payment not found
        """
        payment = await self._get_payment_entity(tenant_id, payment_id)
        if not payment:
            raise PaymentNotFoundError(f"Payment {payment_id} not found")

        old_status = payment.status
        payment.status = new_status
        payment.updated_at = datetime.now(UTC)

        # Set processed timestamp for terminal states
        if new_status in (PaymentStatus.SUCCEEDED, PaymentStatus.FAILED, PaymentStatus.REFUNDED):
            if not payment.processed_at:
                payment.processed_at = datetime.now(UTC)

        # Store provider-specific data
        if provider_data:
            if payment.provider_payment_data:
                payment.provider_payment_data.update(provider_data)
            else:
                payment.provider_payment_data = provider_data

        # Store error message for failures
        if error_message:
            payment.failure_reason = error_message

        await self.db.commit()
        await self.db.refresh(payment)

        # Log status change
        logger.info(
            "Payment status updated via webhook",
            payment_id=payment_id,
            old_status=old_status.value,
            new_status=new_status.value,
            tenant_id=tenant_id,
        )

        return Payment.model_validate(payment)

    async def process_refund_notification(
        self,
        tenant_id: str,
        payment_id: str,
        refund_amount: Decimal,
        provider_refund_id: str | None = None,
        reason: str | None = None,
    ) -> Payment:
        """Process refund notification from payment provider webhook.

        This is distinct from refund_payment which initiates refunds.
        This method updates our records when the provider notifies us
        of a refund (either initiated externally or via our system).

        Args:
            tenant_id: Tenant identifier
            payment_id: Payment identifier
            refund_amount: Amount refunded
            provider_refund_id: Provider's refund transaction ID
            reason: Reason for refund

        Returns:
            Updated Payment object

        Raises:
            PaymentNotFoundError: If payment not found
            PaymentError: If refund amount exceeds payment amount
        """
        payment = await self._get_payment_entity(tenant_id, payment_id)
        if not payment:
            raise PaymentNotFoundError(f"Payment {payment_id} not found")

        # Validate refund amount
        current_refunded = payment.refund_amount or Decimal("0")
        total_refunded = current_refunded + refund_amount

        if total_refunded > payment.amount:
            raise PaymentError(
                f"Refund amount {total_refunded} exceeds payment amount {payment.amount}"
            )

        # Update payment record
        payment.refund_amount = total_refunded
        payment.updated_at = datetime.now(UTC)

        # Set status based on refund amount
        if total_refunded >= payment.amount:
            payment.status = PaymentStatus.REFUNDED
            payment.refunded_at = datetime.now(UTC)
        elif total_refunded > 0:
            payment.status = PaymentStatus.PARTIALLY_REFUNDED

        # Store refund details in provider data
        refund_data = {
            "refund_amount": str(refund_amount),
            "refund_reason": reason or "Refund via provider",
            "refunded_at": datetime.now(UTC).isoformat(),
        }
        if provider_refund_id:
            refund_data["provider_refund_id"] = provider_refund_id

        if payment.provider_payment_data:
            if "refunds" not in payment.provider_payment_data:
                payment.provider_payment_data["refunds"] = []
            payment.provider_payment_data["refunds"].append(refund_data)
        else:
            payment.provider_payment_data = {"refunds": [refund_data]}

        await self.db.commit()
        await self.db.refresh(payment)

        # Create refund transaction
        await self._create_transaction(payment, TransactionType.REFUND)

        logger.info(
            "Refund processed from webhook notification",
            payment_id=payment_id,
            refund_amount=str(refund_amount),
            total_refunded=str(total_refunded),
            status=payment.status.value,
            tenant_id=tenant_id,
        )

        return Payment.model_validate(payment)

    async def cancel_payment(
        self, tenant_id: str, payment_id: str, cancellation_reason: str | None = None
    ) -> Payment:
        """
        Cancel a pending or processing payment.

        Args:
            tenant_id: Tenant identifier
            payment_id: Payment identifier
            cancellation_reason: Reason for cancellation

        Returns:
            Cancelled Payment object

        Raises:
            PaymentNotFoundError: If payment not found
            PaymentError: If payment cannot be cancelled (already succeeded/failed/refunded)
        """
        payment = await self._get_payment_entity(tenant_id, payment_id)
        if not payment:
            raise PaymentNotFoundError(f"Payment {payment_id} not found")

        # Only pending or processing payments can be cancelled
        if payment.status not in [PaymentStatus.PENDING, PaymentStatus.PROCESSING]:
            raise PaymentError(
                f"Cannot cancel payment in {payment.status} status. "
                f"Only pending or processing payments can be cancelled."
            )

        # Update payment status
        payment.status = PaymentStatus.CANCELLED
        payment.failure_reason = cancellation_reason or "Cancelled by user"
        payment.updated_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(payment)

        logger.info(
            "Payment cancelled",
            tenant_id=tenant_id,
            payment_id=payment_id,
            reason=cancellation_reason,
        )

        return Payment.model_validate(payment)

    async def record_offline_payment(
        self,
        tenant_id: str,
        customer_id: str,
        amount: Decimal,
        currency: str,
        payment_method: str,
        invoice_id: str | None = None,
        reference_number: str | None = None,
        notes: str | None = None,
        payment_date: datetime | None = None,
    ) -> Payment:
        """
        Record an offline payment (cash, check, bank transfer, etc.).

        Args:
            tenant_id: Tenant identifier
            customer_id: Customer identifier
            amount: Payment amount
            currency: Currency code (ISO 4217)
            payment_method: Payment method (cash, check, bank_transfer, etc.)
            invoice_id: Optional invoice to apply payment to
            reference_number: Check number, transaction ID, etc.
            notes: Additional notes about the payment
            payment_date: When payment was received (defaults to now)

        Returns:
            Created Payment object

        Raises:
            PaymentError: If payment creation fails
        """
        # Validate payment method for offline payments and map to enum
        payment_method_lower = payment_method.lower()
        payment_method_mapping = {
            "cash": PaymentMethodType.CASH,
            "check": PaymentMethodType.CHECK,
            "bank_transfer": PaymentMethodType.BANK_ACCOUNT,
            "wire_transfer": PaymentMethodType.WIRE_TRANSFER,
            "money_order": PaymentMethodType.CHECK,  # Treat money orders like checks
        }

        if payment_method_lower not in payment_method_mapping:
            raise PaymentError(
                f"Invalid offline payment method: {payment_method}. "
                f"Valid methods: {', '.join(payment_method_mapping.keys())}"
            )

        payment_method_type = payment_method_mapping[payment_method_lower]

        # Create payment entity
        payment_entity = PaymentEntity(
            payment_id=str(uuid4()),
            tenant_id=tenant_id,
            customer_id=customer_id,
            amount=amount,
            currency=currency.upper(),
            status=PaymentStatus.SUCCEEDED,  # Offline payments are pre-verified
            payment_method_type=payment_method_type,
            provider="offline",
            provider_payment_id=reference_number,
            metadata={
                "payment_method": payment_method,
                "reference_number": reference_number,
                "notes": notes,
                "recorded_at": datetime.now(UTC).isoformat(),
            },
            created_at=payment_date or datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        self.db.add(payment_entity)

        # If invoice_id provided, link the payment
        if invoice_id:
            # Note: This is a simplified version. In production, you'd want to:
            # 1. Verify the invoice exists and belongs to the customer
            # 2. Call invoice_service.apply_payment_to_invoice()
            # 3. Update invoice status if fully paid
            payment_entity.metadata["invoice_id"] = invoice_id

        await self.db.commit()
        await self.db.refresh(payment_entity)

        logger.info(
            "Offline payment recorded",
            tenant_id=tenant_id,
            payment_id=payment_entity.payment_id,
            customer_id=customer_id,
            amount=amount,
            payment_method=payment_method,
            reference=reference_number,
        )

        return Payment.model_validate(payment_entity)

    # ============================================================================
    # Private helper methods
    # ============================================================================

    async def _get_payment_entity(self, tenant_id: str, payment_id: str) -> PaymentEntity | None:
        """Get payment entity by ID with tenant isolation"""

        query = select(PaymentEntity).where(
            and_(
                PaymentEntity.tenant_id == tenant_id,
                PaymentEntity.payment_id == payment_id,
            )
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_payment_by_idempotency_key(
        self, tenant_id: str, idempotency_key: str
    ) -> PaymentEntity | None:
        """Get payment by idempotency key"""

        query = select(PaymentEntity).where(
            and_(
                PaymentEntity.tenant_id == tenant_id,
                PaymentEntity.idempotency_key == idempotency_key,
            )
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_payment_method(
        self, tenant_id: str, payment_method_id: str
    ) -> PaymentMethodEntity | None:
        """Get payment method by ID"""

        query = select(PaymentMethodEntity).where(
            and_(
                PaymentMethodEntity.tenant_id == tenant_id,
                PaymentMethodEntity.payment_method_id == payment_method_id,
                PaymentMethodEntity.is_active,
            )
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _count_payment_methods(self, tenant_id: str, customer_id: str) -> int:
        """Count active payment methods for customer"""

        query = select(PaymentMethodEntity).where(
            and_(
                PaymentMethodEntity.tenant_id == tenant_id,
                PaymentMethodEntity.customer_id == customer_id,
                PaymentMethodEntity.is_active,
            )
        )

        result = await self.db.execute(query)
        return len(result.scalars().all())

    async def _clear_default_payment_methods(self, tenant_id: str, customer_id: str) -> None:
        """Clear default flag from all customer payment methods"""

        query = select(PaymentMethodEntity).where(
            and_(
                PaymentMethodEntity.tenant_id == tenant_id,
                PaymentMethodEntity.customer_id == customer_id,
                PaymentMethodEntity.is_default,
            )
        )

        result = await self.db.execute(query)
        payment_methods = result.scalars().all()

        for pm in payment_methods:
            pm.is_default = False

        await self.db.commit()

    async def _create_transaction(
        self, payment: PaymentEntity, transaction_type: TransactionType
    ) -> None:
        """Create transaction record for payment"""

        transaction = TransactionEntity(
            tenant_id=payment.tenant_id,
            amount=abs(payment.amount),
            currency=payment.currency,
            transaction_type=transaction_type,
            description=f"{transaction_type.value.title()} - {payment.payment_id}",
            customer_id=payment.customer_id,
            payment_id=payment.payment_id,
            extra_data={"provider": payment.provider},
        )

        self.db.add(transaction)
        await self.db.commit()

    async def _link_payment_to_invoices(
        self, payment: PaymentEntity, invoice_ids: list[str]
    ) -> None:
        """Link payment to invoices"""

        amount_per_invoice = payment.amount // len(invoice_ids)

        for invoice_id in invoice_ids:
            link = PaymentInvoiceEntity(
                payment_id=payment.payment_id,
                invoice_id=invoice_id,
                amount_applied=amount_per_invoice,
            )
            self.db.add(link)

        await self.db.commit()
