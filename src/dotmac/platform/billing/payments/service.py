"""Payment processing service with tenant support and idempotency."""

from collections.abc import Mapping
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
        self,
        tenant_id: str,
        payment_method_id: str,
        customer_id: str,
        idempotency_key: str | None,
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

        # SECURITY: Verify payment method belongs to the customer
        if payment_method.customer_id != customer_id:
            raise PaymentError(
                f"Payment method {payment_method_id} does not belong to customer {customer_id}"
            )

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
                # Check if payment plugin is required (production mode)
                if settings.billing.require_payment_plugin:
                    payment_entity.status = PaymentStatus.FAILED
                    payment_entity.failure_reason = f"Payment provider '{provider}' not configured"
                    payment_entity.processed_at = datetime.now(UTC)
                    logger.error(
                        f"Payment failed: provider '{provider}' not configured. "
                        f"Set billing.require_payment_plugin=False in development/testing only.",
                        payment_id=payment_entity.payment_id,
                    )
                else:
                    # Mock success for testing/development ONLY
                    payment_entity.status = PaymentStatus.SUCCEEDED
                    payment_entity.processed_at = datetime.now(UTC)
                    logger.warning(
                        f"Payment provider {provider} not configured, mocking success. "
                        "THIS SHOULD NEVER HAPPEN IN PRODUCTION!",
                        payment_id=payment_entity.payment_id,
                    )

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
            tenant_id, payment_method_id, customer_id, idempotency_key
        )
        if existing_payment:
            return self._payment_from_entity(existing_payment)

        # FIXED: Store invoice_ids in extra_data so they're available for retries
        # Without this, failed payments that succeed on retry never link to invoices
        extra_data = metadata or {}
        if invoice_ids:
            extra_data["invoice_ids"] = invoice_ids

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
            provider_payment_data={},
            extra_data=extra_data,
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

        return self._payment_from_entity(payment_entity)

    async def _validate_refund_request(
        self, tenant_id: str, payment_id: str, amount: int | None, idempotency_key: str | None
    ) -> tuple[PaymentEntity | None, PaymentEntity, int]:
        """Validate refund request and return existing refund if idempotency key exists."""
        # Get original payment
        original_payment = await self._get_payment_entity(tenant_id, payment_id)
        if not original_payment:
            raise PaymentNotFoundError(f"Payment {payment_id} not found")

        # Allow refunds on successful or partially refunded payments
        if original_payment.status not in (
            PaymentStatus.SUCCEEDED,
            PaymentStatus.PARTIALLY_REFUNDED,
        ):
            raise PaymentError(
                f"Can only refund successful or partially refunded payments. "
                f"Current status: {original_payment.status}"
            )

        # Calculate how much has already been refunded
        already_refunded = int(original_payment.refund_amount or 0)
        remaining_refundable = original_payment.amount - already_refunded

        # Determine refund amount - default to remaining balance, not original amount
        refund_amount = amount if amount is not None else remaining_refundable

        if refund_amount > remaining_refundable:
            raise PaymentError(
                f"Refund amount ({refund_amount}) exceeds remaining refundable amount "
                f"({remaining_refundable}). Original: {original_payment.amount}, "
                f"Already refunded: {already_refunded}"
            )

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
                # Check if payment plugin is required (production mode)
                if settings.billing.require_payment_plugin:
                    refund.status = PaymentStatus.FAILED
                    refund.failure_reason = (
                        f"Payment provider '{original_payment.provider}' not configured"
                    )
                    logger.error(
                        f"Refund failed: provider '{original_payment.provider}' not configured. "
                        f"Set billing.require_payment_plugin=False in development/testing only.",
                        refund_id=refund.payment_id,
                        original_payment_id=original_payment.payment_id,
                    )
                else:
                    # Mock success for testing/development ONLY
                    refund.status = PaymentStatus.REFUNDED
                    logger.warning(
                        f"Payment provider {original_payment.provider} not configured, mocking refund. "
                        "THIS SHOULD NEVER HAPPEN IN PRODUCTION!",
                        refund_id=refund.payment_id,
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

        # Update original payment refund tracking and status
        # Track total refunded amount
        current_refund_total = Decimal(original_payment.refund_amount or 0)
        new_refund_total = current_refund_total + Decimal(refund_amount)
        original_payment.refund_amount = new_refund_total

        # Update status based on total refunded
        if new_refund_total >= Decimal(original_payment.amount):
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
            return self._payment_from_entity(existing_refund)

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

        return self._payment_from_entity(refund)

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
            raise PaymentError("Maximum retry attempts reached")

        # Update retry count and schedule with exponential backoff (from settings)
        payment.retry_count += 1
        payment.next_retry_at = datetime.now(UTC) + timedelta(
            hours=settings.billing.payment_retry_exponential_base_hours**payment.retry_count
        )
        payment.status = PaymentStatus.PROCESSING

        await self.db.commit()

        # FIXED: Extract payment_method_id from payment_method_details for use in callbacks
        # PaymentEntity doesn't have a payment_method_id attribute directly
        payment_method_id = (
            payment.payment_method_details.get("payment_method_id")
            if payment.payment_method_details
            else None
        )

        # Attempt payment again
        try:
            if payment.provider in self.providers:
                if not isinstance(payment_method_id, str) or not payment_method_id:
                    raise PaymentError("Payment method identifier missing for retry")

                payment_method = await self._get_payment_method(tenant_id, payment_method_id)

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
                        # FIXED: Use payment_method_id (from payment_method_details)
                        await self._handle_payment_success(
                            payment,  # payment_entity positional
                            tenant_id,
                            payment.customer_id,
                            payment.amount,
                            payment.currency,
                            payment_method_id,  # From payment_method_details
                            payment.provider,
                            payment.extra_data.get("invoice_ids") if payment.extra_data else None,
                        )
                    else:
                        # FIXED: Use payment_method_id (from payment_method_details)
                        await self._handle_payment_failure(
                            payment,  # payment_entity positional
                            tenant_id,
                            payment.customer_id,
                            payment.amount,
                            payment.currency,
                            payment_method_id,  # From payment_method_details
                            payment.provider,
                        )
                else:
                    # CRITICAL FIX: Payment method was deleted during retry
                    # Set payment to FAILED to prevent stuck PROCESSING state
                    payment.status = PaymentStatus.FAILED
                    payment.failure_reason = (
                        f"Payment method {payment_method_id} no longer exists. "
                        "Cannot retry payment."
                    )
                    payment.processed_at = datetime.now(UTC)

                    logger.error(
                        "Payment retry failed: payment method deleted",
                        payment_id=payment.payment_id,
                        payment_method_id=payment_method_id,
                        tenant_id=tenant_id,
                    )

                    # Publish failure event so merchant can intervene
                    await self._handle_payment_failure(
                        payment,
                        tenant_id,
                        payment.customer_id,
                        payment.amount,
                        payment.currency,
                        payment_method_id,
                        payment.provider,
                    )
            else:
                # Check if payment plugin is required (production mode)
                if settings.billing.require_payment_plugin:
                    payment.status = PaymentStatus.FAILED
                    payment.failure_reason = f"Payment provider '{payment.provider}' not configured"
                    payment.processed_at = datetime.now(UTC)
                    logger.error(
                        f"Payment retry failed: provider '{payment.provider}' not configured. "
                        f"Set billing.require_payment_plugin=False in development/testing only.",
                        payment_id=payment.payment_id,
                    )
                    # FIXED: Use payment_method_id (from payment_method_details)
                    await self._handle_payment_failure(
                        payment,  # payment_entity positional
                        tenant_id,
                        payment.customer_id,
                        payment.amount,
                        payment.currency,
                        payment_method_id or "unknown",  # Guard against None
                        payment.provider,
                    )
                else:
                    # Mock success for testing/development ONLY
                    payment.status = PaymentStatus.SUCCEEDED
                    payment.processed_at = datetime.now(UTC)
                    logger.warning(
                        f"Payment provider {payment.provider} not configured, mocking success on retry. "
                        "THIS SHOULD NEVER HAPPEN IN PRODUCTION!",
                        payment_id=payment.payment_id,
                    )
                    # FIXED: Use payment_method_id (from payment_method_details)
                    await self._handle_payment_success(
                        payment,  # payment_entity positional
                        tenant_id,
                        payment.customer_id,
                        payment.amount,
                        payment.currency,
                        payment_method_id or "unknown",  # Guard against None
                        payment.provider,
                        payment.extra_data.get("invoice_ids") if payment.extra_data else None,
                    )

        except Exception as e:
            payment.status = PaymentStatus.FAILED
            payment.failure_reason = str(e)
            logger.error(f"Payment retry error: {e}")
            # FIXED: Use payment_method_id (from payment_method_details)
            await self._handle_payment_failure(
                payment,  # payment_entity positional
                tenant_id,
                payment.customer_id,
                payment.amount,
                payment.currency,
                payment_method_id or "unknown",  # Guard against None
                payment.provider,
            )

        await self.db.commit()
        await self.db.refresh(payment)

        return self._payment_from_entity(payment)

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
        return self._payment_from_entity(payment_entity)

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
            existing_provider_data = payment.provider_payment_data or {}
            existing_provider_data.update(provider_data)
            payment.provider_payment_data = existing_provider_data

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

        return self._payment_from_entity(payment)

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
        payment_amount = Decimal(payment.amount)
        current_refunded = (
            Decimal(payment.refund_amount) if payment.refund_amount is not None else Decimal("0")
        )
        total_refunded = current_refunded + refund_amount

        if total_refunded > payment_amount:
            raise PaymentError(
                f"Refund amount {total_refunded} exceeds payment amount {payment.amount}"
            )

        # Update payment record
        payment.refund_amount = total_refunded
        payment.updated_at = datetime.now(UTC)

        # Set status based on refund amount
        if total_refunded >= payment_amount:
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

        provider_data = payment.provider_payment_data or {}
        refunds_list = provider_data.setdefault("refunds", [])
        refunds_list.append(refund_data)
        payment.provider_payment_data = provider_data

        await self.db.commit()
        await self.db.refresh(payment)

        # Create refund transaction with the actual refund amount (not the total payment amount)
        await self._create_transaction(payment, TransactionType.REFUND, amount=int(refund_amount))

        logger.info(
            "Refund processed from webhook notification",
            payment_id=payment_id,
            refund_amount=str(refund_amount),
            total_refunded=str(total_refunded),
            status=payment.status.value,
            tenant_id=tenant_id,
        )

        return self._payment_from_entity(payment)

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

        return self._payment_from_entity(payment)

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
        # Convert amount to minor units (cents) - multiply by 100 instead of truncating
        if isinstance(amount, Decimal):
            # Multiply by 100 to convert dollars to cents, then convert to int
            amount_minor = int((amount * Decimal("100")).quantize(Decimal("1")))
        else:
            # Assume integer is already in minor units, but if it's a float, convert properly
            if isinstance(amount, float):
                amount_minor = int(Decimal(str(amount)) * Decimal("100"))
            else:
                amount_minor = int(amount)

        payment_entity = PaymentEntity(
            payment_id=str(uuid4()),
            tenant_id=tenant_id,
            customer_id=customer_id,
            amount=amount_minor,
            currency=currency.upper(),
            status=PaymentStatus.SUCCEEDED,  # Offline payments are pre-verified
            payment_method_type=payment_method_type,
            payment_method_details={
                "payment_method": payment_method,
                "reference_number": reference_number,
            },
            provider="offline",
            provider_payment_id=reference_number,
            provider_payment_data={},
            extra_data={
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
            payment_entity.extra_data["invoice_id"] = invoice_id

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

        return self._payment_from_entity(payment_entity)

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
        self,
        payment: PaymentEntity,
        transaction_type: TransactionType,
        amount: int | None = None,
    ) -> None:
        """Create transaction record for payment.

        Args:
            payment: Payment entity
            transaction_type: Type of transaction
            amount: Optional amount to record (defaults to payment.amount if not provided)
        """

        # Use provided amount or fall back to payment amount
        transaction_amount = abs(amount) if amount is not None else abs(payment.amount)

        transaction = TransactionEntity(
            tenant_id=payment.tenant_id,
            amount=transaction_amount,
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

        if not invoice_ids:
            return

        total_amount = abs(payment.amount)
        base_allocation = total_amount // len(invoice_ids)
        remainder = total_amount - base_allocation * len(invoice_ids)
        sign = 1 if payment.amount >= 0 else -1

        for index, invoice_id in enumerate(invoice_ids):
            allocation = base_allocation + (1 if index < remainder else 0)
            link = PaymentInvoiceEntity(
                payment_id=payment.payment_id,
                invoice_id=invoice_id,
                amount_applied=sign * allocation,
            )
            self.db.add(link)

        await self.db.commit()

    def _normalize_payment_entity(self, payment: PaymentEntity) -> PaymentEntity:
        """Ensure payment entity fields are normalized before Pydantic validation."""
        data = payment.provider_payment_data
        if not data:
            payment.provider_payment_data = {}
        elif not isinstance(data, dict):
            if isinstance(data, Mapping):
                payment.provider_payment_data = dict(data)
            else:
                payment.provider_payment_data = {}

        if payment.refund_amount is not None and not isinstance(payment.refund_amount, Decimal):
            payment.refund_amount = Decimal(str(payment.refund_amount))

        # Normalize payment_method_details - ensure it's a dict
        details = payment.payment_method_details
        if not details:
            payment.payment_method_details = {}
        elif not isinstance(details, dict):
            if isinstance(details, Mapping):
                payment.payment_method_details = dict(details)
            else:
                payment.payment_method_details = {}

        # Normalize payment_method_type - provide default if None
        # This handles cases where old data or test mocks don't have this field
        if payment.payment_method_type is None:
            # Default to 'card' for backward compatibility
            # In production, this should always be set by the caller
            payment.payment_method_type = PaymentMethodType.CARD

        return payment

    def _payment_from_entity(self, payment: PaymentEntity) -> Payment:
        """Convert a PaymentEntity to the Payment domain model with normalization."""
        normalized = self._normalize_payment_entity(payment)
        return Payment.model_validate(normalized)
