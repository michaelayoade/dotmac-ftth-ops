"""
Billing event types and event emission helpers.

This module defines all billing-related events and provides
helper functions for emitting them through the event bus.
"""

from typing import TYPE_CHECKING, Any, Optional

import structlog

from dotmac.platform.events import EventPriority, get_event_bus

if TYPE_CHECKING:
    from dotmac.platform.events import EventBus

logger = structlog.get_logger(__name__)


# ============================================================================
# Billing Event Types
# ============================================================================


class BillingEvents:
    """Billing event type constants."""

    # Invoice events
    INVOICE_CREATED = "invoice.created"
    INVOICE_UPDATED = "invoice.updated"
    INVOICE_SENT = "invoice.sent"
    INVOICE_PAID = "invoice.paid"
    INVOICE_OVERDUE = "invoice.overdue"
    INVOICE_VOID = "invoice.void"
    INVOICE_FAILED = "invoice.failed"

    # Payment events
    PAYMENT_CREATED = "payment.created"
    PAYMENT_SUCCEEDED = "payment.succeeded"
    PAYMENT_FAILED = "payment.failed"
    PAYMENT_REFUNDED = "payment.refunded"

    # Subscription events
    SUBSCRIPTION_CREATED = "subscription.created"
    SUBSCRIPTION_UPDATED = "subscription.updated"
    SUBSCRIPTION_CANCELLED = "subscription.cancelled"
    SUBSCRIPTION_RENEWED = "subscription.renewed"
    SUBSCRIPTION_TRIAL_ENDING = "subscription.trial_ending"
    SUBSCRIPTION_TRIAL_ENDED = "subscription.trial_ended"

    # Customer events
    CUSTOMER_CREATED = "customer.created"
    CUSTOMER_UPDATED = "customer.updated"
    CUSTOMER_DELETED = "customer.deleted"

    # Product/Catalog events
    PRODUCT_CREATED = "product.created"
    PRODUCT_UPDATED = "product.updated"
    PRODUCT_DELETED = "product.deleted"

    # Credit note events
    CREDIT_NOTE_CREATED = "credit_note.created"
    CREDIT_NOTE_ISSUED = "credit_note.issued"


# ============================================================================
# Event Emission Helpers
# ============================================================================


async def emit_invoice_created(
    invoice_id: str,
    customer_id: str,
    amount: float,
    currency: str,
    tenant_id: str | None = None,
    user_id: str | None = None,
    event_bus: Optional["EventBus | None"] = None,
    **extra_data: Any,
) -> None:
    """
    Emit invoice created event.

    Args:
        invoice_id: Invoice ID
        customer_id: Customer ID
        amount: Invoice amount
        currency: Currency code
        tenant_id: Tenant ID
        user_id: User who created the invoice
        event_bus: Event bus instance (injected, optional - will use global if not provided)
        **extra_data: Additional event data
    """
    if event_bus is None:
        event_bus = get_event_bus()

    await event_bus.publish(
        event_type=BillingEvents.INVOICE_CREATED,
        payload={
            "invoice_id": invoice_id,
            "customer_id": customer_id,
            "amount": amount,
            "currency": currency,
            **extra_data,
        },
        metadata={
            "tenant_id": tenant_id,
            "user_id": user_id,
            "source": "billing",
        },
        priority=EventPriority.HIGH,
    )

    logger.info(
        "Invoice created event emitted",
        invoice_id=invoice_id,
        customer_id=customer_id,
        amount=amount,
    )


async def emit_invoice_paid(
    invoice_id: str,
    customer_id: str,
    amount: float,
    payment_id: str,
    tenant_id: str | None = None,
    event_bus: Optional["EventBus | None"] = None,
    **extra_data: Any,
) -> None:
    """
    Emit invoice paid event.

    Args:
        invoice_id: Invoice ID
        customer_id: Customer ID
        amount: Amount paid
        payment_id: Payment ID
        tenant_id: Tenant ID
        event_bus: Event bus instance (injected, optional)
        **extra_data: Additional event data
    """
    if event_bus is None:
        event_bus = get_event_bus()

    await event_bus.publish(
        event_type=BillingEvents.INVOICE_PAID,
        payload={
            "invoice_id": invoice_id,
            "customer_id": customer_id,
            "amount": amount,
            "payment_id": payment_id,
            **extra_data,
        },
        metadata={
            "tenant_id": tenant_id,
            "source": "billing",
        },
        priority=EventPriority.HIGH,
    )

    logger.info(
        "Invoice paid event emitted",
        invoice_id=invoice_id,
        payment_id=payment_id,
    )


async def emit_payment_failed(
    payment_id: str,
    invoice_id: str,
    customer_id: str,
    amount: float,
    error_message: str,
    tenant_id: str | None = None,
    event_bus: Optional["EventBus | None"] = None,
    **extra_data: Any,
) -> None:
    """
    Emit payment failed event.

    Args:
        payment_id: Payment ID
        invoice_id: Invoice ID
        customer_id: Customer ID
        amount: Payment amount
        error_message: Error message
        tenant_id: Tenant ID
        event_bus: Event bus instance (injected, optional)
        **extra_data: Additional event data
    """
    if event_bus is None:
        event_bus = get_event_bus()

    await event_bus.publish(
        event_type=BillingEvents.PAYMENT_FAILED,
        payload={
            "payment_id": payment_id,
            "invoice_id": invoice_id,
            "customer_id": customer_id,
            "amount": amount,
            "error_message": error_message,
            **extra_data,
        },
        metadata={
            "tenant_id": tenant_id,
            "source": "billing",
        },
        priority=EventPriority.CRITICAL,
    )

    logger.warning(
        "Payment failed event emitted",
        payment_id=payment_id,
        invoice_id=invoice_id,
        error=error_message,
    )


async def emit_subscription_created(
    subscription_id: str,
    customer_id: str,
    plan_id: str,
    tenant_id: str | None = None,
    user_id: str | None = None,
    event_bus: Optional["EventBus | None"] = None,
    **extra_data: Any,
) -> None:
    """
    Emit subscription created event.

    Args:
        subscription_id: Subscription ID
        customer_id: Customer ID
        plan_id: Subscription plan ID
        tenant_id: Tenant ID
        user_id: User who created the subscription
        event_bus: Event bus instance (injected, optional)
        **extra_data: Additional event data
    """
    if event_bus is None:
        event_bus = get_event_bus()

    await event_bus.publish(
        event_type=BillingEvents.SUBSCRIPTION_CREATED,
        payload={
            "subscription_id": subscription_id,
            "customer_id": customer_id,
            "plan_id": plan_id,
            **extra_data,
        },
        metadata={
            "tenant_id": tenant_id,
            "user_id": user_id,
            "source": "billing",
        },
        priority=EventPriority.HIGH,
    )

    logger.info(
        "Subscription created event emitted",
        subscription_id=subscription_id,
        customer_id=customer_id,
    )


async def emit_subscription_cancelled(
    subscription_id: str,
    customer_id: str,
    reason: str | None = None,
    tenant_id: str | None = None,
    event_bus: Optional["EventBus | None"] = None,
    **extra_data: Any,
) -> None:
    """
    Emit subscription cancelled event.

    Args:
        subscription_id: Subscription ID
        customer_id: Customer ID
        reason: Cancellation reason
        tenant_id: Tenant ID
        event_bus: Event bus instance (injected, optional)
        **extra_data: Additional event data
    """
    if event_bus is None:
        event_bus = get_event_bus()

    await event_bus.publish(
        event_type=BillingEvents.SUBSCRIPTION_CANCELLED,
        payload={
            "subscription_id": subscription_id,
            "customer_id": customer_id,
            "reason": reason,
            **extra_data,
        },
        metadata={
            "tenant_id": tenant_id,
            "source": "billing",
        },
        priority=EventPriority.HIGH,
    )

    logger.info(
        "Subscription cancelled event emitted",
        subscription_id=subscription_id,
        reason=reason,
    )
