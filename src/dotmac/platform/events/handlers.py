"""
Event handlers for common platform events.

This module provides example event handlers that demonstrate how to subscribe
to platform events and handle them appropriately.
"""

import structlog

from dotmac.platform.events.decorators import subscribe
from dotmac.platform.events.models import Event

logger = structlog.get_logger(__name__)


# Billing Events


@subscribe("billing.invoice.created")  # Custom decorator is untyped
async def handle_invoice_created(event: Event) -> None:
    """
    Handle invoice created event.

    Triggered when a new invoice is generated.
    Can trigger email notifications, webhooks, analytics updates.
    """
    invoice_id = event.payload.get("invoice_id")
    customer_id = event.payload.get("customer_id")
    amount = event.payload.get("amount")

    logger.info(
        "Invoice created",
        invoice_id=invoice_id,
        customer_id=customer_id,
        amount=amount,
        tenant_id=event.metadata.tenant_id,
    )

    # Example: Trigger email notification
    # await email_service.send_invoice_email(invoice_id)

    # Example: Trigger webhook
    # await webhook_service.trigger("invoice.created", event.payload)


@subscribe("billing.payment.succeeded")  # Custom decorator is untyped
async def handle_payment_succeeded(event: Event) -> None:
    """
    Handle successful payment event.

    Triggered when a payment is successfully processed.
    Updates invoice status, triggers receipts, analytics.
    """
    payment_id = event.payload.get("payment_id")
    invoice_id = event.payload.get("invoice_id")
    amount = event.payload.get("amount")

    logger.info(
        "Payment succeeded",
        payment_id=payment_id,
        invoice_id=invoice_id,
        amount=amount,
        tenant_id=event.metadata.tenant_id,
    )

    # Example: Update invoice status
    # await invoice_service.mark_as_paid(invoice_id)

    # Example: Generate receipt
    # await receipt_service.generate_receipt(payment_id)


@subscribe("billing.payment.failed")  # Custom decorator is untyped
async def handle_payment_failed(event: Event) -> None:
    """
    Handle failed payment event.

    Triggered when a payment fails.
    Sends notifications, updates invoice status, triggers retry logic.
    """
    payment_id = event.payload.get("payment_id")
    invoice_id = event.payload.get("invoice_id")
    error_message = event.payload.get("error")

    logger.warning(
        "Payment failed",
        payment_id=payment_id,
        invoice_id=invoice_id,
        error=error_message,
        tenant_id=event.metadata.tenant_id,
    )

    # Example: Send failure notification
    # await notification_service.send_payment_failure(invoice_id)

    # Example: Schedule retry
    # await payment_service.schedule_retry(payment_id)


@subscribe("billing.subscription.created")  # Custom decorator is untyped
async def handle_subscription_created(event: Event) -> None:
    """
    Handle subscription created event.

    Triggered when a new subscription is created.
    Sets up recurring billing, sends welcome emails.
    """
    subscription_id = event.payload.get("subscription_id")
    customer_id = event.payload.get("customer_id")
    plan_id = event.payload.get("plan_id")

    logger.info(
        "Subscription created",
        subscription_id=subscription_id,
        customer_id=customer_id,
        plan_id=plan_id,
        tenant_id=event.metadata.tenant_id,
    )


@subscribe("billing.subscription.cancelled")  # Custom decorator is untyped
async def handle_subscription_cancelled(event: Event) -> None:
    """
    Handle subscription cancellation event.

    Triggered when a subscription is cancelled.
    Stops recurring billing, sends cancellation confirmation.
    """
    subscription_id = event.payload.get("subscription_id")
    customer_id = event.payload.get("customer_id")
    cancellation_reason = event.payload.get("reason")

    logger.info(
        "Subscription cancelled",
        subscription_id=subscription_id,
        customer_id=customer_id,
        reason=cancellation_reason,
        tenant_id=event.metadata.tenant_id,
    )


# Customer Events


@subscribe("customer.created")  # Custom decorator is untyped
async def handle_customer_created(event: Event) -> None:
    """
    Handle customer created event.

    Triggered when a new customer is registered.
    Sets up onboarding, sends welcome emails.
    """
    customer_id = event.payload.get("customer_id")
    email = event.payload.get("email")

    logger.info(
        "Customer created",
        customer_id=customer_id,
        email=email,
        tenant_id=event.metadata.tenant_id,
    )

    # Example: Send welcome email
    # await email_service.send_welcome_email(customer_id)

    # Example: Trigger onboarding workflow
    # await onboarding_service.start_onboarding(customer_id)


@subscribe("customer.updated")  # Custom decorator is untyped
async def handle_customer_updated(event: Event) -> None:
    """
    Handle customer updated event.

    Triggered when customer information is modified.
    Updates related records, invalidates caches.
    """
    customer_id = event.payload.get("customer_id")
    updated_fields = event.payload.get("updated_fields", [])

    logger.info(
        "Customer updated",
        customer_id=customer_id,
        fields=updated_fields,
        tenant_id=event.metadata.tenant_id,
    )


# Auth Events


@subscribe("auth.user.login")  # Custom decorator is untyped
async def handle_user_login(event: Event) -> None:
    """
    Handle user login event.

    Triggered on successful user login.
    Updates last login time, tracks analytics.
    """
    user_id = event.payload.get("user_id")
    ip_address = event.payload.get("ip_address")

    logger.info(
        "User logged in",
        user_id=user_id,
        ip_address=ip_address,
        tenant_id=event.metadata.tenant_id,
    )

    # Example: Update last login
    # await user_service.update_last_login(user_id)

    # Example: Track login analytics
    # await analytics_service.track_login(user_id, ip_address)


@subscribe("auth.user.logout")  # Custom decorator is untyped
async def handle_user_logout(event: Event) -> None:
    """
    Handle user logout event.

    Triggered when user logs out.
    Invalidates sessions, cleans up tokens.
    """
    user_id = event.payload.get("user_id")
    session_id = event.payload.get("session_id")

    logger.info(
        "User logged out",
        user_id=user_id,
        session_id=session_id,
        tenant_id=event.metadata.tenant_id,
    )


@subscribe("auth.password.reset")  # Custom decorator is untyped
async def handle_password_reset(event: Event) -> None:
    """
    Handle password reset event.

    Triggered when password reset is requested.
    Sends reset email, creates reset tokens.
    """
    user_id = event.payload.get("user_id")
    email = event.payload.get("email")

    logger.info(
        "Password reset requested",
        user_id=user_id,
        email=email,
        tenant_id=event.metadata.tenant_id,
    )


# File Events


@subscribe("file.uploaded")  # Custom decorator is untyped
async def handle_file_uploaded(event: Event) -> None:
    """
    Handle file upload event.

    Triggered when a file is uploaded.
    Triggers virus scanning, indexing, thumbnail generation.
    """
    file_id = event.payload.get("file_id")
    file_name = event.payload.get("file_name")
    file_size = event.payload.get("file_size")

    logger.info(
        "File uploaded",
        file_id=file_id,
        file_name=file_name,
        file_size=file_size,
        tenant_id=event.metadata.tenant_id,
    )


@subscribe("file.deleted")  # Custom decorator is untyped
async def handle_file_deleted(event: Event) -> None:
    """
    Handle file deletion event.

    Triggered when a file is deleted.
    Cleans up storage, updates quotas.
    """
    file_id = event.payload.get("file_id")

    logger.info(
        "File deleted",
        file_id=file_id,
        tenant_id=event.metadata.tenant_id,
    )


# Webhook Events


@subscribe("webhook.triggered")  # Custom decorator is untyped
async def handle_webhook_triggered(event: Event) -> None:
    """
    Handle webhook triggered event.

    Triggered when a webhook is sent.
    Logs webhook delivery, tracks metrics.
    """
    webhook_id = event.payload.get("webhook_id")
    url = event.payload.get("url")
    event_type = event.payload.get("event_type")

    logger.info(
        "Webhook triggered",
        webhook_id=webhook_id,
        url=url,
        event_type=event_type,
        tenant_id=event.metadata.tenant_id,
    )


@subscribe("webhook.failed")  # Custom decorator is untyped
async def handle_webhook_failed(event: Event) -> None:
    """
    Handle webhook failure event.

    Triggered when webhook delivery fails.
    Schedules retries, sends alerts.
    """
    webhook_id = event.payload.get("webhook_id")
    url = event.payload.get("url")
    error = event.payload.get("error")

    logger.warning(
        "Webhook delivery failed",
        webhook_id=webhook_id,
        url=url,
        error=error,
        tenant_id=event.metadata.tenant_id,
    )


# System Events


@subscribe("system.health.degraded")  # Custom decorator is untyped
async def handle_system_degraded(event: Event) -> None:
    """
    Handle system degradation event.

    Triggered when system health degrades.
    Sends alerts, triggers failover procedures.
    """
    service = event.payload.get("service")
    metric = event.payload.get("metric")
    value = event.payload.get("value")

    logger.warning(
        "System health degraded",
        service=service,
        metric=metric,
        value=value,
    )


@subscribe("system.error")  # Custom decorator is untyped
async def handle_system_error(event: Event) -> None:
    """
    Handle system error event.

    Triggered on critical system errors.
    Sends alerts, logs to monitoring systems.
    """
    error_type = event.payload.get("error_type")
    error_message = event.payload.get("message")
    stack_trace = event.payload.get("stack_trace")

    logger.error(
        "System error",
        error_type=error_type,
        message=error_message,
        stack_trace=stack_trace,
    )


# Audit Events


@subscribe("audit.activity.recorded")  # Custom decorator is untyped
async def handle_audit_activity(event: Event) -> None:
    """
    Handle audit activity event.

    Triggered when an auditable action occurs.
    Stores in audit log, triggers compliance checks.
    """
    activity_type = event.payload.get("activity_type")
    resource_type = event.payload.get("resource_type")
    resource_id = event.payload.get("resource_id")
    user_id = event.payload.get("user_id")

    logger.info(
        "Audit activity recorded",
        activity_type=activity_type,
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=user_id,
        tenant_id=event.metadata.tenant_id,
    )


# Data Export Events


@subscribe("export.started")  # Custom decorator is untyped
async def handle_export_started(event: Event) -> None:
    """
    Handle export started event.

    Triggered when data export begins.
    Tracks export progress, sends notifications.
    """
    export_id = event.payload.get("export_id")
    export_type = event.payload.get("export_type")

    logger.info(
        "Export started",
        export_id=export_id,
        export_type=export_type,
        tenant_id=event.metadata.tenant_id,
    )


@subscribe("export.completed")  # Custom decorator is untyped
async def handle_export_completed(event: Event) -> None:
    """
    Handle export completed event.

    Triggered when data export finishes.
    Sends download links, cleans up temp files.
    """
    export_id = event.payload.get("export_id")
    file_url = event.payload.get("file_url")

    logger.info(
        "Export completed",
        export_id=export_id,
        file_url=file_url,
        tenant_id=event.metadata.tenant_id,
    )


# Helper function to initialize all handlers
def register_all_handlers() -> None:
    """
    Register all event handlers.

    Call this during application startup to ensure all handlers are subscribed.
    Handlers are automatically registered via @subscribe decorator, but calling
    this ensures the module is imported and decorators are executed.
    """
    logger.info("All event handlers registered")
