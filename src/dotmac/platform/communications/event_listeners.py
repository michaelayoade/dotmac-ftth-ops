"""
Event listeners for communications module.

This module contains event handlers that react to events from other
modules (e.g., billing) and trigger appropriate communications.
"""

from datetime import UTC, datetime
from smtplib import SMTPException
from urllib.parse import urlencode

import structlog

from dotmac.platform.communications.branding_utils import (
    derive_brand_tokens,
    render_branded_email_html,
)
from dotmac.platform.communications.email_service import EmailMessage, EmailService
from dotmac.platform.db import get_async_session
from dotmac.platform.events import subscribe
from dotmac.platform.events.models import Event
from dotmac.platform.settings import settings
from dotmac.platform.tenant.schemas import TenantBrandingConfig
from dotmac.platform.tenant.service import TenantNotFoundError, TenantService

logger = structlog.get_logger(__name__)


def _build_exit_survey_url(survey_token: str, customer_id: str | None) -> str:
    """Construct fully-qualified survey URL with query parameters."""
    base_url = settings.urls.exit_survey_base_url or "https://survey.dotmac.com/exit"
    separator = "&" if "?" in base_url else "?"
    query = urlencode({"token": survey_token, "customer": customer_id or "unknown"})
    return f"{base_url}{separator}{query}"


def _email_html_message(recipient: str, subject: str, html_body: str) -> EmailMessage:
    """Create an EmailMessage with HTML content."""
    # EmailStr is a type annotation, not a constructor - just pass strings
    return EmailMessage(
        to=[recipient],  # Pydantic will validate as EmailStr
        subject=subject,
        html_body=html_body,
    )


async def _resolve_branding_for_event(event: Event) -> TenantBrandingConfig:
    """Return tenant-specific branding for an event, falling back to global defaults."""
    tenant_id = getattr(event.metadata, "tenant_id", None)

    if tenant_id:
        async for session in get_async_session():
            service = TenantService(session)
            try:
                response = await service.get_tenant_branding(tenant_id)
                return response.branding
            except TenantNotFoundError:
                logger.warning(
                    "Tenant not found while resolving branding for event",
                    tenant_id=tenant_id,
                    event_id=event.event_id,
                )
            except Exception as branding_error:  # pragma: no cover - defensive logging
                logger.error(
                    "Failed to load tenant branding, falling back to defaults",
                    tenant_id=tenant_id,
                    event_id=event.event_id,
                    error=str(branding_error),
                )
            break

    return TenantService.get_default_branding_config()


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
        branding = await _resolve_branding_for_event(event)
        product_name, _, _ = derive_brand_tokens(branding)

        # Get customer email (in real implementation, fetch from customer service)
        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        message = _email_html_message(
            recipient=customer_email,
            subject=f"{product_name} Invoice #{invoice_id}",
            html_body=render_branded_email_html(
                branding,
                f"""
                <h2>Invoice Created</h2>
                <p>A new invoice has been generated for your account.</p>
                <p><strong>Invoice ID:</strong> {invoice_id}</p>
                <p><strong>Amount:</strong> {currency} {amount}</p>
                <p>Please review and process your payment.</p>
                """,
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
        branding = await _resolve_branding_for_event(event)
        product_name, _, _ = derive_brand_tokens(branding)

        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        message = _email_html_message(
            recipient=customer_email,
            subject=f"{product_name} Payment Received for Invoice #{invoice_id}",
            html_body=render_branded_email_html(
                branding,
                f"""
                <h2>Payment Confirmation</h2>
                <p>Thank you! We've received your payment.</p>
                <p><strong>Invoice ID:</strong> {invoice_id}</p>
                <p><strong>Payment ID:</strong> {payment_id}</p>
                <p><strong>Amount Paid:</strong> {amount}</p>
                """,
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
        branding = await _resolve_branding_for_event(event)
        product_name, _, _ = derive_brand_tokens(branding)

        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        message = _email_html_message(
            recipient=customer_email,
            subject=f"{product_name} Invoice #{invoice_id} is Overdue",
            html_body=render_branded_email_html(
                branding,
                f"""
                <h2>Payment Reminder</h2>
                <p>This is a reminder that your invoice is now overdue.</p>
                <p><strong>Invoice ID:</strong> {invoice_id}</p>
                <p><strong>Amount Due:</strong> {amount}</p>
                <p><strong>Days Overdue:</strong> {days_overdue}</p>
                <p>Please make your payment as soon as possible to avoid service interruption.</p>
                """,
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
        branding = await _resolve_branding_for_event(event)
        product_name, _, _ = derive_brand_tokens(branding)

        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        message = _email_html_message(
            recipient=customer_email,
            subject=f"{product_name} Payment Failed - Invoice #{invoice_id}",
            html_body=render_branded_email_html(
                branding,
                f"""
                <h2>Payment Failed</h2>
                <p>We were unable to process your payment.</p>
                <p><strong>Invoice ID:</strong> {invoice_id}</p>
                <p><strong>Error:</strong> {error_message}</p>
                <p>Please update your payment method and try again.</p>
                """,
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
        branding = await _resolve_branding_for_event(event)
        product_name, _, _ = derive_brand_tokens(branding)

        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        message = _email_html_message(
            recipient=customer_email,
            subject=f"Welcome to {product_name}",
            html_body=render_branded_email_html(
                branding,
                f"""
                <h2>Subscription Activated</h2>
                <p>Thank you for subscribing!</p>
                <p><strong>Subscription ID:</strong> {subscription_id}</p>
                <p><strong>Plan:</strong> {plan_id}</p>
                <p>Your subscription is now active.</p>
                """,
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
        branding = await _resolve_branding_for_event(event)
        product_name, _, _ = derive_brand_tokens(branding)

        customer_email = event.payload.get("customer_email", f"customer-{customer_id}@example.com")

        reason_html = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""
        message = _email_html_message(
            recipient=customer_email,
            subject=f"{product_name} Subscription Cancelled",
            html_body=render_branded_email_html(
                branding,
                f"""
                <h2>Subscription Cancelled</h2>
                <p>Your subscription has been cancelled as requested.</p>
                <p><strong>Subscription ID:</strong> {subscription_id}</p>
                {reason_html}
                <p>We're sorry to see you go. You can resubscribe anytime.</p>
                """,
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
# Customer Event Handlers
# ============================================================================


@subscribe("customer.churned")  # type: ignore[misc]
async def send_exit_survey_email(event: Event) -> None:
    """
    Send exit survey email when a customer churns.

    This enhances customer experience during churn by collecting feedback
    that can be used to improve the product and reduce future churn.

    Args:
        event: Customer churned event
    """

    from dotmac.platform.communications.models import ExitSurveyResponse
    from dotmac.platform.db import get_session_dependency

    customer_id = event.payload.get("customer_id")
    customer_email = event.payload.get("customer_email")
    previous_status = event.payload.get("previous_status")
    new_status = event.payload.get("new_status")
    subscriptions_canceled = event.payload.get("subscriptions_canceled", 0)
    churned_at_str = event.payload.get("churned_at")

    logger.info(
        "Processing customer.churned event for exit survey",
        customer_id=customer_id,
        subscriptions_canceled=subscriptions_canceled,
        event_id=event.event_id,
    )

    # Skip if no email provided
    if not customer_email:
        logger.warning(
            "No customer email available for exit survey",
            customer_id=customer_id,
        )
        return

    try:
        # Parse churned_at timestamp
        churned_at = None
        if churned_at_str:
            try:
                churned_at = datetime.fromisoformat(churned_at_str.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                churned_at = datetime.now(UTC)

        # Generate unique survey link
        survey_token = event.event_id[:16]  # Use event ID prefix as token
        survey_url = _build_exit_survey_url(survey_token, customer_id)

        # Create survey response record in database
        async for db_session in get_session_dependency():
            try:
                survey_response = ExitSurveyResponse(
                    survey_token=survey_token,
                    customer_id=customer_id,
                    customer_email=customer_email,
                    churned_at=churned_at,
                    previous_status=previous_status,
                    subscriptions_canceled=subscriptions_canceled,
                    survey_sent_at=datetime.now(UTC),
                    metadata_={
                        "event_id": event.event_id,
                        "new_status": new_status,
                        "survey_url": survey_url,
                    },
                )

                db_session.add(survey_response)
                await db_session.commit()

                logger.info(
                    "Exit survey response record created",
                    survey_token=survey_token,
                    customer_id=customer_id,
                )
            except Exception as db_error:
                logger.error(
                    "Failed to create survey response record",
                    customer_id=customer_id,
                    error=str(db_error),
                )
                # Continue with email sending even if DB insert fails

            # Exit the async generator after first iteration
            break

        email_service = EmailService()
        branding = await _resolve_branding_for_event(event)
        product_name, company_name, support_email = derive_brand_tokens(branding)

        # Create personalized HTML email with exit survey
        message = _email_html_message(
            recipient=customer_email,
            subject=f"We Value Your Feedback - {product_name}",
            html_body=render_branded_email_html(
                branding,
                f"""
                <h2>We're Sorry to See You Go</h2>
                <p>Dear Valued Customer,</p>

                <p>We noticed that you recently canceled your subscription with us. While we're sorry to see you leave,
                we'd greatly appreciate your feedback to help us improve our service for future customers.</p>

                <p><strong>Your feedback matters!</strong> Please take 2 minutes to complete our exit survey.</p>

                <div style="text-align: center; margin: 20px 0;">
                    <a href="{survey_url}" style="display:inline-block;background-color:#2563eb;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;">Take the Exit Survey</a>
                </div>

                <div style="background-color:#f8fafc;padding:16px;border-radius:8px;margin:16px 0;">
                    <p><strong>The survey will help us understand:</strong></p>
                    <ul>
                        <li>Why you decided to leave</li>
                        <li>What we could have done better</li>
                        <li>What features or improvements would bring you back</li>
                        <li>Your overall experience with our service</li>
                    </ul>
                </div>

                <p><strong>Your responses are anonymous and confidential.</strong> We review all feedback carefully
                to continuously improve our product and service.</p>

                <p>If you have any immediate concerns or would like to discuss your experience,
                please don't hesitate to contact our support team at {support_email}.</p>

                <p><strong>Thinking of coming back?</strong> You're always welcome to reactivate your account
                anytime. We'd love to have you back!</p>

                <p>Thank you for being part of our community. We wish you all the best.</p>

                <p>Best regards,<br>
                <strong>The {company_name} Team</strong></p>

                <p style="font-size:12px;color:#94a3b8;">This email was sent because your account status changed to: {new_status}.<br>
                Customer ID: {customer_id}</p>
                """,
            ),
        )

        await email_service.send_email(message)

        logger.info(
            "Exit survey email sent successfully",
            customer_id=customer_id,
            customer_email=customer_email,
            survey_url=survey_url,
        )

    except (SMTPException, OSError, RuntimeError, ValueError) as e:
        logger.error(
            "Failed to send exit survey email",
            customer_id=customer_id,
            customer_email=customer_email,
            error=str(e),
            exc_info=True,
        )
        # Don't raise - we don't want to fail the churn process if email fails
        # Just log the error for monitoring


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
            "send_exit_survey_email",
        ],
    )


# Auto-initialize when module is imported
init_communications_event_listeners()
