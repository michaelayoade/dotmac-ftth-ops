"""
Notification Event Listeners.

Listens to domain events and creates notifications automatically.
"""

from uuid import UUID

import structlog
from sqlalchemy import select

from dotmac.platform.customer_management.models import Customer
from dotmac.platform.database import get_async_session
from dotmac.platform.events import Event, subscribe
from dotmac.platform.notifications.models import NotificationPriority, NotificationType
from dotmac.platform.notifications.service import NotificationService

logger = structlog.get_logger(__name__)


# Billing Event Listeners
@subscribe("billing.invoice.created")  # type: ignore[misc]
async def on_invoice_created(event: Event) -> None:
    """Send notification when invoice is created."""
    event_data = event.to_dict()
    try:
        async for session in get_async_session():
            notification_service = NotificationService(session)

            tenant_id = event_data["metadata"]["tenant_id"]
            customer_id = event_data["payload"]["customer_id"]
            invoice_number = event_data["payload"]["invoice_number"]
            amount = event_data["payload"]["amount"]
            currency = event_data["payload"]["currency"]

            # Get customer to find user_id
            stmt = select(Customer).where(
                Customer.tenant_id == tenant_id, Customer.id == UUID(customer_id)
            )
            result = await session.execute(stmt)
            customer = result.scalar_one_or_none()

            if customer and customer.user_id:
                await notification_service.create_notification(
                    tenant_id=tenant_id,
                    user_id=customer.user_id,
                    notification_type=NotificationType.INVOICE_GENERATED,
                    title=f"New Invoice #{invoice_number}",
                    message=f"A new invoice for {currency} {amount:.2f} has been generated for your account.",
                    priority=NotificationPriority.MEDIUM,
                    action_url=f"/dashboard/billing/invoices/{event_data['payload']['invoice_id']}",
                    action_label="View Invoice",
                    related_entity_type="invoice",
                    related_entity_id=event_data["payload"]["invoice_id"],
                    metadata={"invoice_number": invoice_number, "amount": amount},
                )
                await session.commit()
                logger.info("Invoice created notification sent", invoice_number=invoice_number)
    except Exception as e:
        logger.error("Failed to send invoice created notification", error=str(e))


@subscribe("billing.invoice.finalized")  # type: ignore[misc]
async def on_invoice_finalized(event: Event) -> None:
    """Send notification when invoice is finalized and ready for payment."""
    event_data = event.to_dict()
    try:
        async for session in get_async_session():
            notification_service = NotificationService(session)

            tenant_id = event_data["metadata"]["tenant_id"]
            customer_id = event_data["payload"]["customer_id"]
            invoice_number = event_data["payload"]["invoice_number"]
            amount = event_data["payload"]["amount"]
            due_date = event_data["payload"].get("due_date")

            stmt = select(Customer).where(
                Customer.tenant_id == tenant_id, Customer.id == UUID(customer_id)
            )
            result = await session.execute(stmt)
            customer = result.scalar_one_or_none()

            if customer and customer.user_id:
                due_message = f" Payment is due by {due_date}." if due_date else ""
                await notification_service.create_notification(
                    tenant_id=tenant_id,
                    user_id=customer.user_id,
                    notification_type=NotificationType.INVOICE_DUE,
                    title=f"Invoice #{invoice_number} Due",
                    message=f"Your invoice for {amount:.2f} is now due.{due_message}",
                    priority=NotificationPriority.HIGH,
                    action_url=f"/dashboard/billing/invoices/{event_data['payload']['invoice_id']}",
                    action_label="Pay Now",
                    related_entity_type="invoice",
                    related_entity_id=event_data["payload"]["invoice_id"],
                    metadata={"invoice_number": invoice_number, "due_date": due_date},
                )
                await session.commit()
                logger.info("Invoice due notification sent", invoice_number=invoice_number)
    except Exception as e:
        logger.error("Failed to send invoice due notification", error=str(e))


@subscribe("billing.payment.received")  # type: ignore[misc]
async def on_payment_received(event: Event) -> None:
    """Send notification when payment is received."""
    event_data = event.to_dict()
    try:
        async for session in get_async_session():
            notification_service = NotificationService(session)

            tenant_id = event_data["metadata"]["tenant_id"]
            customer_id = event_data["payload"]["customer_id"]
            amount = event_data["payload"]["amount"]
            currency = event_data["payload"].get("currency", "USD")
            payment_method = event_data["payload"].get("payment_method", "card")

            stmt = select(Customer).where(
                Customer.tenant_id == tenant_id, Customer.id == UUID(customer_id)
            )
            result = await session.execute(stmt)
            customer = result.scalar_one_or_none()

            if customer and customer.user_id:
                await notification_service.create_notification(
                    tenant_id=tenant_id,
                    user_id=customer.user_id,
                    notification_type=NotificationType.PAYMENT_RECEIVED,
                    title="Payment Received",
                    message=f"We've received your payment of {currency} {amount:.2f} via {payment_method}. Thank you!",
                    priority=NotificationPriority.MEDIUM,
                    action_url=f"/dashboard/billing/payments/{event_data['payload']['payment_id']}",
                    action_label="View Receipt",
                    related_entity_type="payment",
                    related_entity_id=event_data["payload"]["payment_id"],
                    metadata={"amount": amount, "payment_method": payment_method},
                )
                await session.commit()
                logger.info("Payment received notification sent", amount=amount)
    except Exception as e:
        logger.error("Failed to send payment received notification", error=str(e))


@subscribe("billing.payment.failed")  # type: ignore[misc]
async def on_payment_failed(event: Event) -> None:
    """Send notification when payment fails."""
    event_data = event.to_dict()
    try:
        async for session in get_async_session():
            notification_service = NotificationService(session)

            tenant_id = event_data["metadata"]["tenant_id"]
            customer_id = event_data["payload"]["customer_id"]
            amount = event_data["payload"]["amount"]
            error_message = event_data["payload"].get("error_message", "Payment declined")

            stmt = select(Customer).where(
                Customer.tenant_id == tenant_id, Customer.id == UUID(customer_id)
            )
            result = await session.execute(stmt)
            customer = result.scalar_one_or_none()

            if customer and customer.user_id:
                await notification_service.create_notification(
                    tenant_id=tenant_id,
                    user_id=customer.user_id,
                    notification_type=NotificationType.PAYMENT_FAILED,
                    title="Payment Failed",
                    message=f"Your payment of {amount:.2f} could not be processed. Reason: {error_message}. Please update your payment method.",
                    priority=NotificationPriority.URGENT,
                    action_url="/dashboard/billing/payment-methods",
                    action_label="Update Payment Method",
                    related_entity_type="payment",
                    related_entity_id=event_data["payload"]["payment_id"],
                    metadata={"error_message": error_message},
                )
                await session.commit()
                logger.info("Payment failed notification sent")
    except Exception as e:
        logger.error("Failed to send payment failed notification", error=str(e))


@subscribe("billing.subscription.renewed")  # type: ignore[misc]
async def on_subscription_renewed(event: Event) -> None:
    """Send notification when subscription is renewed."""
    event_data = event.to_dict()
    try:
        async for session in get_async_session():
            notification_service = NotificationService(session)

            tenant_id = event_data["metadata"]["tenant_id"]
            customer_id = event_data["payload"]["customer_id"]
            plan_name = event_data["payload"].get("plan_name", "Your subscription")
            next_billing_date = event_data["payload"].get("next_billing_date")

            stmt = select(Customer).where(
                Customer.tenant_id == tenant_id, Customer.id == UUID(customer_id)
            )
            result = await session.execute(stmt)
            customer = result.scalar_one_or_none()

            if customer and customer.user_id:
                await notification_service.create_notification(
                    tenant_id=tenant_id,
                    user_id=customer.user_id,
                    notification_type=NotificationType.SUBSCRIPTION_RENEWED,
                    title="Subscription Renewed",
                    message=f"{plan_name} has been renewed successfully. Next billing date: {next_billing_date}",
                    priority=NotificationPriority.LOW,
                    action_url=f"/dashboard/subscriptions/{event_data['payload']['subscription_id']}",
                    action_label="View Subscription",
                    related_entity_type="subscription",
                    related_entity_id=event_data["payload"]["subscription_id"],
                )
                await session.commit()
                logger.info("Subscription renewed notification sent")
    except Exception as e:
        logger.error("Failed to send subscription renewed notification", error=str(e))


# Dunning Event Listeners
@subscribe("dunning.reminder.sent")  # type: ignore[misc]
async def on_dunning_reminder(event: Event) -> None:
    """Send notification for dunning reminder."""
    event_data = event.to_dict()
    try:
        async for session in get_async_session():
            notification_service = NotificationService(session)

            tenant_id = event_data["metadata"]["tenant_id"]
            customer_id = event_data["payload"]["customer_id"]
            invoice_number = event_data["payload"].get("invoice_number")
            amount_due = event_data["payload"].get("amount_due")
            days_overdue = event_data["payload"].get("days_overdue", 0)

            stmt = select(Customer).where(
                Customer.tenant_id == tenant_id, Customer.id == UUID(customer_id)
            )
            result = await session.execute(stmt)
            customer = result.scalar_one_or_none()

            if customer and customer.user_id:
                await notification_service.create_notification(
                    tenant_id=tenant_id,
                    user_id=customer.user_id,
                    notification_type=NotificationType.DUNNING_REMINDER,
                    title=f"Payment Reminder: Invoice #{invoice_number}",
                    message=f"Your invoice of {amount_due} is {days_overdue} days overdue. Please make payment to avoid service interruption.",
                    priority=NotificationPriority.HIGH,
                    action_url=f"/dashboard/billing/invoices/{event_data['payload']['invoice_id']}",
                    action_label="Pay Now",
                    related_entity_type="invoice",
                    related_entity_id=event_data["payload"]["invoice_id"],
                    metadata={"days_overdue": days_overdue},
                )
                await session.commit()
                logger.info("Dunning reminder notification sent", days_overdue=days_overdue)
    except Exception as e:
        logger.error("Failed to send dunning reminder notification", error=str(e))


@subscribe("dunning.suspension_warning")  # type: ignore[misc]
async def on_dunning_suspension_warning(event: Event) -> None:
    """Send notification for suspension warning."""
    event_data = event.to_dict()
    try:
        async for session in get_async_session():
            notification_service = NotificationService(session)

            tenant_id = event_data["metadata"]["tenant_id"]
            customer_id = event_data["payload"]["customer_id"]
            days_until_suspension = event_data["payload"].get("days_until_suspension", 3)
            amount_due = event_data["payload"].get("amount_due")

            stmt = select(Customer).where(
                Customer.tenant_id == tenant_id, Customer.id == UUID(customer_id)
            )
            result = await session.execute(stmt)
            customer = result.scalar_one_or_none()

            if customer and customer.user_id:
                await notification_service.create_notification(
                    tenant_id=tenant_id,
                    user_id=customer.user_id,
                    notification_type=NotificationType.DUNNING_SUSPENSION_WARNING,
                    title="⚠️ Service Suspension Warning",
                    message=f"Your service will be suspended in {days_until_suspension} days if payment of {amount_due} is not received. Please pay immediately to avoid interruption.",
                    priority=NotificationPriority.URGENT,
                    action_url="/dashboard/billing/pay",
                    action_label="Pay Now",
                    related_entity_type="dunning",
                    related_entity_id=event_data["payload"].get("dunning_id", ""),
                    metadata={"days_until_suspension": days_until_suspension},
                )
                await session.commit()
                logger.info("Suspension warning notification sent")
    except Exception as e:
        logger.error("Failed to send suspension warning notification", error=str(e))


# Ticketing Event Listeners
@subscribe("ticket.created")  # type: ignore[misc]
async def on_ticket_created(event: Event) -> None:
    """Send notification when ticket is created."""
    event_data = event.to_dict()
    try:
        async for session in get_async_session():
            notification_service = NotificationService(session)

            tenant_id = event_data["metadata"]["tenant_id"]
            customer_id = event_data["payload"].get("customer_id")
            ticket_number = event_data["payload"]["ticket_number"]
            subject = event_data["payload"]["subject"]
            event_data["payload"].get("created_by_id")

            if customer_id:
                stmt = select(Customer).where(
                    Customer.tenant_id == tenant_id, Customer.id == UUID(customer_id)
                )
                result = await session.execute(stmt)
                customer = result.scalar_one_or_none()

                if customer and customer.user_id:
                    await notification_service.create_notification(
                        tenant_id=tenant_id,
                        user_id=customer.user_id,
                        notification_type=NotificationType.TICKET_CREATED,
                        title=f"Support Ticket Created #{ticket_number}",
                        message=f"Your support ticket '{subject}' has been created. We'll respond shortly.",
                        priority=NotificationPriority.MEDIUM,
                        action_url=f"/dashboard/support/tickets/{event_data['payload']['ticket_id']}",
                        action_label="View Ticket",
                        related_entity_type="ticket",
                        related_entity_id=event_data["payload"]["ticket_id"],
                    )
                    await session.commit()
                    logger.info("Ticket created notification sent", ticket_number=ticket_number)
    except Exception as e:
        logger.error("Failed to send ticket created notification", error=str(e))


@subscribe("ticket.assigned")  # type: ignore[misc]
async def on_ticket_assigned(event: Event) -> None:
    """Send notification when ticket is assigned to a user."""
    event_data = event.to_dict()
    try:
        async for session in get_async_session():
            notification_service = NotificationService(session)

            tenant_id = event_data["metadata"]["tenant_id"]
            assigned_to_id = event_data["payload"].get("assigned_to_id")
            ticket_number = event_data["payload"]["ticket_number"]
            subject = event_data["payload"]["subject"]

            if assigned_to_id:
                await notification_service.create_notification(
                    tenant_id=tenant_id,
                    user_id=UUID(assigned_to_id),
                    notification_type=NotificationType.TICKET_ASSIGNED,
                    title=f"Ticket Assigned: #{ticket_number}",
                    message=f"You've been assigned ticket '{subject}'.",
                    priority=NotificationPriority.HIGH,
                    action_url=f"/dashboard/support/tickets/{event_data['payload']['ticket_id']}",
                    action_label="View Ticket",
                    related_entity_type="ticket",
                    related_entity_id=event_data["payload"]["ticket_id"],
                )
                await session.commit()
                logger.info("Ticket assigned notification sent", ticket_number=ticket_number)
    except Exception as e:
        logger.error("Failed to send ticket assigned notification", error=str(e))


@subscribe("ticket.resolved")  # type: ignore[misc]
async def on_ticket_resolved(event: Event) -> None:
    """Send notification when ticket is resolved."""
    event_data = event.to_dict()
    try:
        async for session in get_async_session():
            notification_service = NotificationService(session)

            tenant_id = event_data["metadata"]["tenant_id"]
            customer_id = event_data["payload"].get("customer_id")
            ticket_number = event_data["payload"]["ticket_number"]
            subject = event_data["payload"]["subject"]

            if customer_id:
                stmt = select(Customer).where(
                    Customer.tenant_id == tenant_id, Customer.id == UUID(customer_id)
                )
                result = await session.execute(stmt)
                customer = result.scalar_one_or_none()

                if customer and customer.user_id:
                    await notification_service.create_notification(
                        tenant_id=tenant_id,
                        user_id=customer.user_id,
                        notification_type=NotificationType.TICKET_RESOLVED,
                        title=f"Ticket Resolved #{ticket_number}",
                        message=f"Your support ticket '{subject}' has been resolved.",
                        priority=NotificationPriority.MEDIUM,
                        action_url=f"/dashboard/support/tickets/{event_data['payload']['ticket_id']}",
                        action_label="View Resolution",
                        related_entity_type="ticket",
                        related_entity_id=event_data["payload"]["ticket_id"],
                    )
                    await session.commit()
                    logger.info("Ticket resolved notification sent", ticket_number=ticket_number)
    except Exception as e:
        logger.error("Failed to send ticket resolved notification", error=str(e))


logger.info("Notification event listeners registered")
