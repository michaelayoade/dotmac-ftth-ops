"""
Event listeners for integrating with platform services.

This module demonstrates how to listen to events and trigger actions
across different platform modules (billing, notifications, analytics, etc.).
"""

import structlog

from dotmac.platform.events.decorators import subscribe
from dotmac.platform.events.models import Event

logger = structlog.get_logger(__name__)


# Analytics Integration Listeners


@subscribe("billing.invoice.created")
async def track_invoice_analytics(event: Event) -> None:
    """
    Track invoice creation in analytics.

    Updates MRR/ARR metrics, invoice counts, revenue forecasts.
    """
    invoice_data = event.payload
    tenant_id = event.metadata.tenant_id

    logger.debug(
        "Tracking invoice in analytics",
        invoice_id=invoice_data.get("invoice_id"),
        tenant_id=tenant_id,
    )

    # Example integration with analytics module
    # from dotmac.platform.analytics.service import analytics_service
    # await analytics_service.track_event(
    #     tenant_id=tenant_id,
    #     event_type="invoice_created",
    #     properties=invoice_data,
    # )


@subscribe("billing.payment.succeeded")
async def track_payment_analytics(event: Event) -> None:
    """
    Track successful payment in analytics.

    Updates revenue metrics, customer lifetime value, payment success rates.
    """
    payment_data = event.payload
    tenant_id = event.metadata.tenant_id

    logger.debug(
        "Tracking payment in analytics",
        payment_id=payment_data.get("payment_id"),
        amount=payment_data.get("amount"),
        tenant_id=tenant_id,
    )


@subscribe("customer.created")
async def track_customer_signup(event: Event) -> None:
    """
    Track customer signup in analytics.

    Updates acquisition metrics, conversion funnels, cohort analysis.
    """
    customer_data = event.payload
    tenant_id = event.metadata.tenant_id

    logger.debug(
        "Tracking customer signup",
        customer_id=customer_data.get("customer_id"),
        tenant_id=tenant_id,
    )


# Notification Integration Listeners


@subscribe("billing.invoice.created")
async def send_invoice_notification(event: Event) -> None:
    """
    Send invoice notification to customer.

    Sends email with invoice details and payment link.
    """
    invoice_id = event.payload.get("invoice_id")
    customer_email = event.payload.get("customer_email")

    logger.info(
        "Sending invoice notification",
        invoice_id=invoice_id,
        customer_email=customer_email,
        tenant_id=event.metadata.tenant_id,
    )

    # Example integration with communications module
    # from dotmac.platform.communications.email_service import email_service
    # await email_service.send_template_email(
    #     to=customer_email,
    #     template="invoice_created",
    #     context={
    #         "invoice_id": invoice_id,
    #         "amount": amount,
    #         "payment_link": f"/invoices/{invoice_id}/pay",
    #     },
    # )


@subscribe("billing.payment.succeeded")
async def send_payment_confirmation(event: Event) -> None:
    """
    Send payment confirmation email.

    Confirms successful payment and provides receipt.
    """
    payment_id = event.payload.get("payment_id")
    customer_email = event.payload.get("customer_email")

    logger.info(
        "Sending payment confirmation",
        payment_id=payment_id,
        customer_email=customer_email,
        tenant_id=event.metadata.tenant_id,
    )


@subscribe("billing.payment.failed")
async def send_payment_failure_notification(event: Event) -> None:
    """
    Send payment failure notification.

    Notifies customer of failed payment and next steps.
    """
    payment_id = event.payload.get("payment_id")
    customer_email = event.payload.get("customer_email")

    logger.info(
        "Sending payment failure notification",
        payment_id=payment_id,
        customer_email=customer_email,
        tenant_id=event.metadata.tenant_id,
    )


@subscribe("auth.password.reset")
async def send_password_reset_email(event: Event) -> None:
    """
    Send password reset email.

    Sends email with password reset link and instructions.
    """
    user_id = event.payload.get("user_id")
    email = event.payload.get("email")

    logger.info(
        "Sending password reset email",
        user_id=user_id,
        email=email,
        tenant_id=event.metadata.tenant_id,
    )


# Webhook Integration Listeners


@subscribe("billing.invoice.created")
async def trigger_invoice_webhook(event: Event) -> None:
    """
    Trigger webhook for invoice creation.

    Sends webhook to configured endpoints for invoice.created event.
    """
    tenant_id = event.metadata.tenant_id
    invoice_data = event.payload

    logger.debug(
        "Triggering invoice webhook",
        invoice_id=invoice_data.get("invoice_id"),
        tenant_id=tenant_id,
    )

    # Example integration with webhooks module
    # from dotmac.platform.webhooks.service import webhook_service
    # await webhook_service.trigger_event(
    #     tenant_id=tenant_id,
    #     event_type="invoice.created",
    #     payload=invoice_data,
    # )


@subscribe("billing.payment.succeeded")
async def trigger_payment_webhook(event: Event) -> None:
    """
    Trigger webhook for successful payment.

    Sends webhook to configured endpoints for payment.succeeded event.
    """
    tenant_id = event.metadata.tenant_id
    payment_data = event.payload

    logger.debug(
        "Triggering payment webhook",
        payment_id=payment_data.get("payment_id"),
        tenant_id=tenant_id,
    )


@subscribe("customer.created")
async def trigger_customer_webhook(event: Event) -> None:
    """
    Trigger webhook for customer creation.

    Sends webhook to configured endpoints for customer.created event.
    """
    tenant_id = event.metadata.tenant_id
    customer_data = event.payload

    logger.debug(
        "Triggering customer webhook",
        customer_id=customer_data.get("customer_id"),
        tenant_id=tenant_id,
    )


# Audit Logging Listeners


@subscribe("billing.invoice.created")
async def audit_invoice_creation(event: Event) -> None:
    """
    Audit log invoice creation.

    Records invoice creation in audit trail for compliance.
    """
    invoice_id = event.payload.get("invoice_id")
    created_by = event.metadata.user_id
    tenant_id = event.metadata.tenant_id

    logger.debug(
        "Auditing invoice creation",
        invoice_id=invoice_id,
        created_by=created_by,
        tenant_id=tenant_id,
    )

    # Example integration with audit module
    # from dotmac.platform.audit.service import audit_service
    # await audit_service.log_activity(
    #     tenant_id=tenant_id,
    #     user_id=created_by,
    #     activity_type="invoice.created",
    #     resource_type="invoice",
    #     resource_id=invoice_id,
    #     metadata=event.payload,
    # )


@subscribe("auth.user.login")
async def audit_user_login(event: Event) -> None:
    """
    Audit log user login.

    Records login attempts and successful logins for security monitoring.
    """
    user_id = event.payload.get("user_id")
    ip_address = event.payload.get("ip_address")
    tenant_id = event.metadata.tenant_id

    logger.debug(
        "Auditing user login",
        user_id=user_id,
        ip_address=ip_address,
        tenant_id=tenant_id,
    )


@subscribe("customer.updated")
async def audit_customer_update(event: Event) -> None:
    """
    Audit log customer updates.

    Records customer data changes for compliance and data lineage.
    """
    customer_id = event.payload.get("customer_id")
    updated_fields = event.payload.get("updated_fields", [])
    updated_by = event.metadata.user_id
    tenant_id = event.metadata.tenant_id

    logger.debug(
        "Auditing customer update",
        customer_id=customer_id,
        fields=updated_fields,
        updated_by=updated_by,
        tenant_id=tenant_id,
    )


# File Processing Listeners


@subscribe("file.uploaded")
async def process_uploaded_file(event: Event) -> None:
    """
    Process uploaded file.

    Triggers virus scanning, thumbnail generation, metadata extraction.
    """
    file_id = event.payload.get("file_id")
    file_name = event.payload.get("file_name")
    mime_type = event.payload.get("mime_type")
    tenant_id = event.metadata.tenant_id

    logger.info(
        "Processing uploaded file",
        file_id=file_id,
        file_name=file_name,
        mime_type=mime_type,
        tenant_id=tenant_id,
    )

    # Example: Trigger virus scan
    # await virus_scanner.scan_file(file_id)

    # Example: Generate thumbnail if image
    # if mime_type.startswith("image/"):
    #     await thumbnail_service.generate_thumbnail(file_id)


@subscribe("file.uploaded")
async def index_uploaded_file(event: Event) -> None:
    """
    Index uploaded file for search.

    Extracts text content and indexes file for full-text search.
    """
    file_id = event.payload.get("file_id")
    file_name = event.payload.get("file_name")
    tenant_id = event.metadata.tenant_id

    logger.debug(
        "Indexing uploaded file",
        file_id=file_id,
        file_name=file_name,
        tenant_id=tenant_id,
    )

    # Example integration with search module
    # from dotmac.platform.search.service import search_service
    # await search_service.index_file(
    #     tenant_id=tenant_id,
    #     file_id=file_id,
    #     file_name=file_name,
    # )


# Cache Invalidation Listeners


@subscribe("customer.updated")
async def invalidate_customer_cache(event: Event) -> None:
    """
    Invalidate customer cache on update.

    Ensures cached customer data is refreshed after updates.
    """
    customer_id = event.payload.get("customer_id")
    tenant_id = event.metadata.tenant_id

    logger.debug(
        "Invalidating customer cache",
        customer_id=customer_id,
        tenant_id=tenant_id,
    )

    # Example cache invalidation
    # from dotmac.platform.core.caching import get_redis
    # redis = get_redis()
    # cache_key = f"customer:{tenant_id}:{customer_id}"
    # redis.delete(cache_key)


@subscribe("billing.invoice.updated")
async def invalidate_invoice_cache(event: Event) -> None:
    """
    Invalidate invoice cache on update.

    Ensures cached invoice data is refreshed after updates.
    """
    invoice_id = event.payload.get("invoice_id")
    tenant_id = event.metadata.tenant_id

    logger.debug(
        "Invalidating invoice cache",
        invoice_id=invoice_id,
        tenant_id=tenant_id,
    )


# Metrics Collection Listeners


@subscribe("*")
async def collect_event_metrics(event: Event) -> None:
    """
    Collect metrics for all events.

    Wildcard listener that tracks event volumes, latencies, error rates.
    """
    logger.debug(
        "Collecting event metrics",
        event_type=event.event_type,
        event_id=event.event_id,
        priority=event.priority,
        tenant_id=event.metadata.tenant_id,
    )

    # Example: Increment event counter
    # from prometheus_client import Counter
    # event_counter = Counter("platform_events_total", "Total events", ["event_type", "tenant_id"])
    # event_counter.labels(
    #     event_type=event.event_type,
    #     tenant_id=event.metadata.tenant_id or "unknown"
    # ).inc()


# Error Handling Listeners


@subscribe("system.error")
async def alert_on_system_error(event: Event) -> None:
    """
    Send alerts on system errors.

    Notifies operations team of critical system errors.
    """
    error_type = event.payload.get("error_type")
    error_message = event.payload.get("message")
    severity = event.payload.get("severity", "error")

    logger.error(
        "System error alert",
        error_type=error_type,
        message=error_message,
        severity=severity,
    )

    # Example: Send to PagerDuty, Slack, etc.
    # if severity == "critical":
    #     await alerting_service.send_alert(
    #         title=f"System Error: {error_type}",
    #         message=error_message,
    #         severity=severity,
    #     )


@subscribe("webhook.failed")
async def retry_failed_webhook(event: Event) -> None:
    """
    Retry failed webhook delivery.

    Implements exponential backoff retry logic for failed webhooks.
    """
    webhook_id = event.payload.get("webhook_id")
    retry_count = event.retry_count
    max_retries = event.max_retries

    logger.warning(
        "Retrying failed webhook",
        webhook_id=webhook_id,
        retry_count=retry_count,
        max_retries=max_retries,
        tenant_id=event.metadata.tenant_id,
    )

    # Example: Schedule retry with backoff
    # if event.is_retryable:
    #     delay = 2 ** retry_count  # Exponential backoff
    #     await webhook_service.schedule_retry(webhook_id, delay)


def register_all_listeners() -> None:
    """
    Register all event listeners.

    Call this during application startup to ensure all listeners are subscribed.
    Listeners are automatically registered via @subscribe decorator, but calling
    this ensures the module is imported and decorators are executed.
    """
    logger.info("All event listeners registered")
