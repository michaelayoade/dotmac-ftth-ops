"""
Billing Domain Event Handlers.

Handles domain events for cross-aggregate workflows and side effects.
These handlers implement eventual consistency between aggregates.
"""

from __future__ import annotations

import structlog

from dotmac.platform.core import (
    CustomerCreatedEvent,
    CustomerDeletedEvent,
    CustomerUpdatedEvent,
    InvoiceCreatedEvent,
    InvoiceOverdueEvent,
    InvoicePaymentReceivedEvent,
    InvoiceVoidedEvent,
    PaymentFailedEvent,
    PaymentProcessedEvent,
    PaymentRefundedEvent,
    SubscriptionCancelledEvent,
    SubscriptionCreatedEvent,
    SubscriptionRenewedEvent,
    SubscriptionUpgradedEvent,
    get_domain_event_dispatcher,
)

logger = structlog.get_logger(__name__)


def register_billing_domain_event_handlers() -> None:
    """
    Register all billing domain event handlers.

    Call this during application startup to set up event-driven workflows.
    """
    dispatcher = get_domain_event_dispatcher()

    # Invoice event handlers
    dispatcher.subscribe(InvoiceCreatedEvent)(handle_invoice_created)
    dispatcher.subscribe(InvoicePaymentReceivedEvent)(handle_invoice_payment_received)
    dispatcher.subscribe(InvoiceVoidedEvent)(handle_invoice_voided)
    dispatcher.subscribe(InvoiceOverdueEvent)(handle_invoice_overdue)

    # Payment event handlers
    dispatcher.subscribe(PaymentProcessedEvent)(handle_payment_processed)
    dispatcher.subscribe(PaymentFailedEvent)(handle_payment_failed)
    dispatcher.subscribe(PaymentRefundedEvent)(handle_payment_refunded)

    # Subscription event handlers
    dispatcher.subscribe(SubscriptionCreatedEvent)(handle_subscription_created)
    dispatcher.subscribe(SubscriptionRenewedEvent)(handle_subscription_renewed)
    dispatcher.subscribe(SubscriptionCancelledEvent)(handle_subscription_cancelled)
    dispatcher.subscribe(SubscriptionUpgradedEvent)(handle_subscription_upgraded)

    # Customer event handlers
    dispatcher.subscribe(CustomerCreatedEvent)(handle_customer_created)
    dispatcher.subscribe(CustomerUpdatedEvent)(handle_customer_updated)
    dispatcher.subscribe(CustomerDeletedEvent)(handle_customer_deleted)

    logger.info(
        "Billing domain event handlers registered",
        handler_count=15,
    )


# ============================================================================
# Invoice Event Handlers
# ============================================================================


async def handle_invoice_created(event: InvoiceCreatedEvent) -> None:
    """
    Handle invoice created event.

    Side effects:
    - Log invoice creation for analytics
    - Update customer invoice count
    - Trigger notification workflows
    """
    logger.info(
        "Invoice created",
        invoice_number=event.invoice_number,
        customer_id=event.customer_id,
        amount=event.amount,
        currency=event.currency,
        tenant_id=event.tenant_id,
    )

    # Example: Update customer statistics
    # customer_repo = get_customer_repository()
    # customer = await customer_repo.get(event.customer_id)
    # customer.increment_invoice_count()
    # await customer_repo.save(customer)


async def handle_invoice_payment_received(event: InvoicePaymentReceivedEvent) -> None:
    """
    Handle invoice payment received event.

    Side effects:
    - Update customer payment history
    - Send payment confirmation email
    - Update analytics/metrics
    """
    logger.info(
        "Invoice payment received",
        invoice_number=event.invoice_number,
        payment_id=event.payment_id,
        amount=event.amount,
        payment_method=event.payment_method,
        tenant_id=event.tenant_id,
    )

    # Example: Send confirmation email
    # email_service = get_email_service()
    # await email_service.send_payment_confirmation(
    #     invoice_number=event.invoice_number,
    #     amount=event.amount,
    # )


async def handle_invoice_voided(event: InvoiceVoidedEvent) -> None:
    """
    Handle invoice voided event.

    Side effects:
    - Log void action for audit
    - Notify customer if invoice was sent
    - Update reporting/analytics
    """
    logger.info(
        "Invoice voided",
        invoice_number=event.invoice_number,
        reason=event.reason,
        tenant_id=event.tenant_id,
    )


async def handle_invoice_overdue(event: InvoiceOverdueEvent) -> None:
    """
    Handle invoice overdue event.

    Side effects:
    - Send overdue notification to customer
    - Update customer status if needed
    - Trigger dunning workflow
    """
    logger.warning(
        "Invoice overdue",
        invoice_number=event.invoice_number,
        days_overdue=event.days_overdue,
        amount_due=event.amount_due,
        tenant_id=event.tenant_id,
    )

    # Example: Send overdue notification
    # notification_service = get_notification_service()
    # await notification_service.send_overdue_notice(
    #     invoice_number=event.invoice_number,
    #     days_overdue=event.days_overdue,
    # )


# ============================================================================
# Payment Event Handlers
# ============================================================================


async def handle_payment_processed(event: PaymentProcessedEvent) -> None:
    """
    Handle payment processed event.

    Side effects:
    - Update customer payment statistics
    - Send payment receipt
    - Update fraud detection metrics
    """
    logger.info(
        "Payment processed successfully",
        payment_id=event.payment_id,
        amount=event.amount,
        currency=event.currency,
        payment_method=event.payment_method,
        customer_id=event.customer_id,
        tenant_id=event.tenant_id,
    )

    # Example: Send receipt
    # receipt_service = get_receipt_service()
    # await receipt_service.generate_and_send_receipt(
    #     payment_id=event.payment_id,
    #     customer_id=event.customer_id,
    # )


async def handle_payment_failed(event: PaymentFailedEvent) -> None:
    """
    Handle payment failed event.

    Side effects:
    - Send payment failure notification
    - Update retry strategy
    - Log for fraud analysis
    """
    logger.error(
        "Payment failed",
        payment_id=event.payment_id,
        error_code=event.error_code,
        error_message=event.error_message,
        customer_id=event.customer_id,
        tenant_id=event.tenant_id,
    )

    # Example: Notify customer of failure
    # notification_service = get_notification_service()
    # await notification_service.send_payment_failure_notice(
    #     payment_id=event.payment_id,
    #     error_message=event.error_message,
    # )


async def handle_payment_refunded(event: PaymentRefundedEvent) -> None:
    """
    Handle payment refunded event.

    Side effects:
    - Send refund confirmation
    - Update customer balance
    - Log for accounting
    """
    logger.info(
        "Payment refunded",
        payment_id=event.payment_id,
        refund_id=event.refund_id,
        amount=event.amount,
        reason=event.reason,
        tenant_id=event.tenant_id,
    )

    # Example: Send refund confirmation
    # email_service = get_email_service()
    # await email_service.send_refund_confirmation(
    #     refund_id=event.refund_id,
    #     amount=event.amount,
    # )


# ============================================================================
# Subscription Event Handlers
# ============================================================================


async def handle_subscription_created(event: SubscriptionCreatedEvent) -> None:
    """
    Handle subscription created event.

    Side effects:
    - Generate first invoice
    - Send welcome email
    - Update customer subscription count
    """
    logger.info(
        "Subscription created",
        subscription_id=event.subscription_id,
        customer_id=event.customer_id,
        plan_id=event.plan_id,
        tenant_id=event.tenant_id,
    )

    # Example: Generate first invoice
    # invoice_service = get_invoice_service()
    # await invoice_service.generate_subscription_invoice(
    #     subscription_id=event.subscription_id,
    #     customer_id=event.customer_id,
    # )


async def handle_subscription_renewed(event: SubscriptionRenewedEvent) -> None:
    """
    Handle subscription renewed event.

    Side effects:
    - Generate renewal invoice
    - Send renewal confirmation
    - Update subscription metrics
    """
    logger.info(
        "Subscription renewed",
        subscription_id=event.subscription_id,
        renewal_date=event.renewal_date,
        next_billing_date=event.next_billing_date,
        tenant_id=event.tenant_id,
    )

    # Example: Generate renewal invoice
    # invoice_service = get_invoice_service()
    # await invoice_service.generate_renewal_invoice(
    #     subscription_id=event.subscription_id,
    #     next_billing_date=event.next_billing_date,
    # )


async def handle_subscription_cancelled(event: SubscriptionCancelledEvent) -> None:
    """
    Handle subscription cancelled event.

    Side effects:
    - Send cancellation confirmation
    - Update customer status
    - Trigger offboarding workflow
    """
    logger.info(
        "Subscription cancelled",
        subscription_id=event.subscription_id,
        cancelled_at=event.cancelled_at,
        end_of_service_date=event.end_of_service_date,
        reason=event.cancellation_reason,
        tenant_id=event.tenant_id,
    )

    # Example: Send cancellation confirmation
    # email_service = get_email_service()
    # await email_service.send_cancellation_confirmation(
    #     subscription_id=event.subscription_id,
    #     end_of_service_date=event.end_of_service_date,
    # )


async def handle_subscription_upgraded(event: SubscriptionUpgradedEvent) -> None:
    """
    Handle subscription upgraded event.

    Side effects:
    - Calculate proration
    - Generate upgrade invoice
    - Send upgrade confirmation
    """
    logger.info(
        "Subscription upgraded",
        subscription_id=event.subscription_id,
        old_plan_id=event.old_plan_id,
        new_plan_id=event.new_plan_id,
        effective_date=event.effective_date,
        tenant_id=event.tenant_id,
    )

    # Example: Calculate and charge proration
    # proration_service = get_proration_service()
    # proration_amount = await proration_service.calculate_upgrade_proration(
    #     subscription_id=event.subscription_id,
    #     old_plan_id=event.old_plan_id,
    #     new_plan_id=event.new_plan_id,
    # )


# ============================================================================
# Customer Event Handlers
# ============================================================================


async def handle_customer_created(event: CustomerCreatedEvent) -> None:
    """
    Handle customer created event.

    Side effects:
    - Send welcome email
    - Initialize customer analytics
    - Set up default preferences
    """
    logger.info(
        "Customer created",
        customer_id=event.customer_id,
        email=event.email,
        name=event.name,
        tenant_id=event.tenant_id,
    )

    # Example: Send welcome email
    # email_service = get_email_service()
    # await email_service.send_welcome_email(
    #     customer_id=event.customer_id,
    #     email=event.email,
    #     name=event.name,
    # )


async def handle_customer_updated(event: CustomerUpdatedEvent) -> None:
    """
    Handle customer updated event.

    Side effects:
    - Log changes for audit
    - Update search index
    - Notify related services
    """
    logger.info(
        "Customer updated",
        customer_id=event.customer_id,
        updated_fields=event.updated_fields,
        tenant_id=event.tenant_id,
    )


async def handle_customer_deleted(event: CustomerDeletedEvent) -> None:
    """
    Handle customer deleted event.

    Side effects:
    - Cancel active subscriptions
    - Archive customer data
    - Update reporting
    """
    logger.info(
        "Customer deleted",
        customer_id=event.customer_id,
        deletion_reason=event.deletion_reason,
        tenant_id=event.tenant_id,
    )

    # Example: Cancel active subscriptions
    # subscription_service = get_subscription_service()
    # await subscription_service.cancel_customer_subscriptions(
    #     customer_id=event.customer_id,
    #     reason="Customer deleted",
    # )
