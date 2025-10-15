"""
Event listeners for communications module.

This module contains event handlers that react to events from other
modules (e.g., billing) and trigger appropriate communications.
"""

from smtplib import SMTPException

import structlog

from dotmac.platform.communications.email_service import EmailMessage, EmailService
from dotmac.platform.events import subscribe
from dotmac.platform.events.models import Event

logger = structlog.get_logger(__name__)


def _email_html_message(recipient: str, subject: str, html_body: str) -> EmailMessage:
    """Create an EmailMessage with HTML content."""
    # EmailStr is a type annotation, not a constructor - just pass strings
    return EmailMessage(
        to=[recipient],  # Pydantic will validate as EmailStr
        subject=subject,
        html_body=html_body,
    )


# ============================================================================
# Invoice Event Handlers
# ============================================================================


@subscribe("invoice.created")  # type: ignore[misc]
async def send_invoice_created_email(event: Event) -> None:
    """
    Send email notification when an invoice is created.

    Args:
        event: Invoice created event
    """
    invoice_id = event.payload.get("invoice_id")
    customer_id = event.payload.get("customer_id")
    amount = event.payload.get("amount")
    currency = event.payload.get("currency", "USD")

    logger.info(
        "Processing invoice.created event",
        invoice_id=invoice_id,
        customer_id=customer_id,
        event_id=event.event_id,
    )

    try:
        email_service = EmailService()

        # Get customer email (in real implementation, fetch from customer service)
        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        message = _email_html_message(
            recipient=customer_email,
            subject=f"New Invoice #{invoice_id}",
            html_body=(
                f"""
                <h2>Invoice Created</h2>
                <p>A new invoice has been created for your account.</p>
                <p><strong>Invoice ID:</strong> {invoice_id}</p>
                <p><strong>Amount:</strong> {currency} {amount}</p>
                <p>Please review and process your payment.</p>
                """
            ),
        )

        await email_service.send_email(message)

        logger.info(
            "Invoice created email sent",
            invoice_id=invoice_id,
            customer_email=customer_email,
        )

    except (SMTPException, OSError, RuntimeError, ValueError) as e:
        logger.error(
            "Failed to send invoice created email",
            invoice_id=invoice_id,
            error=str(e),
            exc_info=True,
        )
        raise


@subscribe("invoice.paid")  # type: ignore[misc]
async def send_invoice_paid_email(event: Event) -> None:
    """
    Send email notification when an invoice is paid.

    Args:
        event: Invoice paid event
    """
    invoice_id = event.payload.get("invoice_id")
    customer_id = event.payload.get("customer_id")
    amount = event.payload.get("amount")
    payment_id = event.payload.get("payment_id")

    logger.info(
        "Processing invoice.paid event",
        invoice_id=invoice_id,
        payment_id=payment_id,
        event_id=event.event_id,
    )

    try:
        email_service = EmailService()

        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        message = _email_html_message(
            recipient=customer_email,
            subject=f"Payment Received for Invoice #{invoice_id}",
            html_body=(
                f"""
                <h2>Payment Confirmation</h2>
                <p>Thank you! We've received your payment.</p>
                <p><strong>Invoice ID:</strong> {invoice_id}</p>
                <p><strong>Payment ID:</strong> {payment_id}</p>
                <p><strong>Amount Paid:</strong> {amount}</p>
                """
            ),
        )

        await email_service.send_email(message)

        logger.info(
            "Invoice paid email sent",
            invoice_id=invoice_id,
            customer_email=customer_email,
        )

    except (SMTPException, OSError, RuntimeError, ValueError) as e:
        logger.error(
            "Failed to send invoice paid email",
            invoice_id=invoice_id,
            error=str(e),
            exc_info=True,
        )
        raise


@subscribe("invoice.overdue")  # type: ignore[misc]
async def send_invoice_overdue_reminder(event: Event) -> None:
    """
    Send reminder email when an invoice becomes overdue.

    Args:
        event: Invoice overdue event
    """
    invoice_id = event.payload.get("invoice_id")
    customer_id = event.payload.get("customer_id")
    amount = event.payload.get("amount")
    days_overdue = event.payload.get("days_overdue", 0)

    logger.info(
        "Processing invoice.overdue event",
        invoice_id=invoice_id,
        days_overdue=days_overdue,
        event_id=event.event_id,
    )

    try:
        email_service = EmailService()

        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        message = _email_html_message(
            recipient=customer_email,
            subject=f"Overdue Invoice Reminder - #{invoice_id}",
            html_body=(
                f"""
                <h2>Payment Reminder</h2>
                <p>This is a reminder that your invoice is now overdue.</p>
                <p><strong>Invoice ID:</strong> {invoice_id}</p>
                <p><strong>Amount Due:</strong> {amount}</p>
                <p><strong>Days Overdue:</strong> {days_overdue}</p>
                <p>Please make your payment as soon as possible to avoid service interruption.</p>
                """
            ),
        )

        await email_service.send_email(message)

        logger.info(
            "Invoice overdue email sent",
            invoice_id=invoice_id,
            customer_email=customer_email,
        )

    except (SMTPException, OSError, RuntimeError, ValueError) as e:
        logger.error(
            "Failed to send invoice overdue email",
            invoice_id=invoice_id,
            error=str(e),
            exc_info=True,
        )
        raise


# ============================================================================
# Payment Event Handlers
# ============================================================================


@subscribe("payment.failed")  # type: ignore[misc]
async def send_payment_failed_notification(event: Event) -> None:
    """
    Send notification when a payment fails.

    Args:
        event: Payment failed event
    """
    payment_id = event.payload.get("payment_id")
    invoice_id = event.payload.get("invoice_id")
    customer_id = event.payload.get("customer_id")
    error_message = event.payload.get("error_message", "Payment processing failed")

    logger.info(
        "Processing payment.failed event",
        payment_id=payment_id,
        invoice_id=invoice_id,
        event_id=event.event_id,
    )

    try:
        email_service = EmailService()

        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        message = _email_html_message(
            recipient=customer_email,
            subject=f"Payment Failed - Invoice #{invoice_id}",
            html_body=(
                f"""
                <h2>Payment Failed</h2>
                <p>We were unable to process your payment.</p>
                <p><strong>Invoice ID:</strong> {invoice_id}</p>
                <p><strong>Error:</strong> {error_message}</p>
                <p>Please update your payment method and try again.</p>
                """
            ),
        )

        await email_service.send_email(message)

        logger.info(
            "Payment failed email sent",
            payment_id=payment_id,
            customer_email=customer_email,
        )

    except (SMTPException, OSError, RuntimeError, ValueError) as e:
        logger.error(
            "Failed to send payment failed email",
            payment_id=payment_id,
            error=str(e),
            exc_info=True,
        )
        raise


# ============================================================================
# Subscription Event Handlers
# ============================================================================


@subscribe("subscription.created")  # type: ignore[misc]
async def send_subscription_welcome_email(event: Event) -> None:
    """
    Send welcome email when a subscription is created.

    Args:
        event: Subscription created event
    """
    subscription_id = event.payload.get("subscription_id")
    customer_id = event.payload.get("customer_id")
    plan_id = event.payload.get("plan_id")

    logger.info(
        "Processing subscription.created event",
        subscription_id=subscription_id,
        event_id=event.event_id,
    )

    try:
        email_service = EmailService()

        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        message = _email_html_message(
            recipient=customer_email,
            subject="Welcome to Your New Subscription!",
            html_body=(
                f"""
                <h2>Subscription Activated</h2>
                <p>Thank you for subscribing!</p>
                <p><strong>Subscription ID:</strong> {subscription_id}</p>
                <p><strong>Plan:</strong> {plan_id}</p>
                <p>Your subscription is now active.</p>
                """
            ),
        )

        await email_service.send_email(message)

        logger.info(
            "Subscription welcome email sent",
            subscription_id=subscription_id,
            customer_email=customer_email,
        )

    except (SMTPException, OSError, RuntimeError, ValueError) as e:
        logger.error(
            "Failed to send subscription welcome email",
            subscription_id=subscription_id,
            error=str(e),
            exc_info=True,
        )
        raise


@subscribe("subscription.cancelled")  # type: ignore[misc]
async def send_subscription_cancelled_email(event: Event) -> None:
    """
    Send confirmation email when a subscription is cancelled.

    Args:
        event: Subscription cancelled event
    """
    subscription_id = event.payload.get("subscription_id")
    customer_id = event.payload.get("customer_id")
    reason = event.payload.get("reason")

    logger.info(
        "Processing subscription.cancelled event",
        subscription_id=subscription_id,
        event_id=event.event_id,
    )

    try:
        email_service = EmailService()

        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        reason_html = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""
        message = _email_html_message(
            recipient=customer_email,
            subject="Subscription Cancelled",
            html_body=(
                f"""
                <h2>Subscription Cancelled</h2>
                <p>Your subscription has been cancelled as requested.</p>
                <p><strong>Subscription ID:</strong> {subscription_id}</p>
                {reason_html}
                <p>We're sorry to see you go. You can resubscribe anytime.</p>
                """
            ),
        )

        await email_service.send_email(message)

        logger.info(
            "Subscription cancelled email sent",
            subscription_id=subscription_id,
            customer_email=customer_email,
        )

    except (SMTPException, OSError, RuntimeError, ValueError) as e:
        logger.error(
            "Failed to send subscription cancelled email",
            subscription_id=subscription_id,
            error=str(e),
            exc_info=True,
        )
        raise


@subscribe("subscription.trial_ending")  # type: ignore[misc]
async def send_trial_ending_reminder(event: Event) -> None:
    """
    Send reminder email when subscription trial is ending soon.

    Args:
        event: Trial ending event
    """
    subscription_id = event.payload.get("subscription_id")
    customer_id = event.payload.get("customer_id")
    days_remaining = event.payload.get("days_remaining", 0)

    logger.info(
        "Processing subscription.trial_ending event",
        subscription_id=subscription_id,
        days_remaining=days_remaining,
        event_id=event.event_id,
    )

    try:
        email_service = EmailService()

        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        message = _email_html_message(
            recipient=customer_email,
            subject=f"Your Trial Ends in {days_remaining} Days",
            html_body=(
                f"""
                <h2>Trial Ending Soon</h2>
                <p>Your trial subscription will end in {days_remaining} days.</p>
                <p><strong>Subscription ID:</strong> {subscription_id}</p>
                <p>Please add a payment method to continue your subscription after the trial period.</p>
                """
            ),
        )

        await email_service.send_email(message)

        logger.info(
            "Trial ending email sent",
            subscription_id=subscription_id,
            customer_email=customer_email,
        )

    except (SMTPException, OSError, RuntimeError, ValueError) as e:
        logger.error(
            "Failed to send trial ending email",
            subscription_id=subscription_id,
            error=str(e),
            exc_info=True,
        )
        raise


# ============================================================================
# Initialization
# ============================================================================


def init_communications_event_listeners() -> None:
    """
    Initialize all communication event listeners.

    This function ensures all event handlers are registered with the event bus.
    It's called automatically when this module is imported.
    """
    logger.info(
        "Communications event listeners initialized",
        handlers=[
            "send_invoice_created_email",
            "send_invoice_paid_email",
            "send_invoice_overdue_reminder",
            "send_payment_failed_notification",
            "send_subscription_welcome_email",
            "send_subscription_cancelled_email",
            "send_trial_ending_reminder",
        ],
    )


# Auto-initialize when module is imported
init_communications_event_listeners()
