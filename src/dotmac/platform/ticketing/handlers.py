"""
Event handlers for ticketing events.

This module provides event handlers for ticket lifecycle events, handling
notifications, audit logging, and analytics updates.
"""

from typing import Final

import structlog

from dotmac.platform.audit.models import ActivitySeverity, ActivityType
from dotmac.platform.audit.service import AuditService
from dotmac.platform.communications.email_service import EmailMessage, EmailService
from dotmac.platform.events.decorators import subscribe
from dotmac.platform.events.models import Event

logger = structlog.get_logger(__name__)

# Initialize services
audit_service = AuditService()
email_service = EmailService()

RESOURCE_CREATED: Final[ActivityType] = ActivityType("resource.created")
RESOURCE_UPDATED: Final[ActivityType] = ActivityType("resource.updated")
ANALYTICS_EVENT: Final[ActivityType] = ActivityType("analytics.event")


# Ticket Creation Handlers


@subscribe("ticket.created")  # type: ignore[misc]  # Custom decorator is untyped
async def handle_ticket_created(event: Event) -> None:
    """
    Handle ticket created event.

    Actions:
    - Send notification email to target party
    - Create audit log entry
    - Update analytics metrics
    """
    ticket_id = event.payload.get("ticket_id")
    ticket_number = event.payload.get("ticket_number")
    subject = event.payload.get("subject")
    origin_type = event.payload.get("origin_type")
    target_type = event.payload.get("target_type")
    priority = event.payload.get("priority")
    customer_id = event.payload.get("customer_id")
    partner_id = event.payload.get("partner_id")
    origin_user_id = event.payload.get("origin_user_id")

    logger.info(
        "Handling ticket.created event",
        ticket_id=ticket_id,
        ticket_number=ticket_number,
        origin=origin_type,
        target=target_type,
        priority=priority,
        tenant_id=event.metadata.tenant_id,
    )

    # Send email notification to target party
    try:
        notification_message = EmailMessage(
            to=["support@example.com"],  # Configure based on target_type
            subject=f"New Support Ticket: {ticket_number}",
            text_body=f"""
A new support ticket has been created:

Ticket Number: {ticket_number}
Subject: {subject}
Priority: {priority}
From: {origin_type}

Please review and respond at your earliest convenience.
            """.strip(),
            html_body=f"""
<h2>New Support Ticket Created</h2>
<p><strong>Ticket Number:</strong> {ticket_number}</p>
<p><strong>Subject:</strong> {subject}</p>
<p><strong>Priority:</strong> {priority}</p>
<p><strong>From:</strong> {origin_type}</p>
<p>Please review and respond at your earliest convenience.</p>
            """.strip(),
        )

        await email_service.send_email(
            message=notification_message, tenant_id=event.metadata.tenant_id
        )
        logger.info("Ticket creation notification sent", ticket_number=ticket_number)
    except Exception as e:
        logger.error(
            "Failed to send ticket creation notification",
            ticket_number=ticket_number,
            error=str(e),
        )

    # Create audit log entry
    try:
        await audit_service.log_activity(
            activity_type=RESOURCE_CREATED,
            action="ticket.created",
            description=f"New ticket created: {ticket_number} - {subject}",
            tenant_id=event.metadata.tenant_id,
            user_id=origin_user_id,
            resource_type="ticket",
            resource_id=ticket_id,
            severity=ActivitySeverity.HIGH if priority == "urgent" else ActivitySeverity.MEDIUM,
            details={
                "ticket_number": ticket_number,
                "subject": subject,
                "priority": priority,
                "origin_type": origin_type,
                "target_type": target_type,
                "customer_id": customer_id,
                "partner_id": partner_id,
            },
        )
        logger.info("Ticket creation audit logged", ticket_number=ticket_number)
    except Exception as e:
        logger.error(
            "Failed to log ticket creation audit", ticket_number=ticket_number, error=str(e)
        )


@subscribe("ticket.message.added")  # type: ignore[misc]  # Custom decorator is untyped
async def handle_ticket_message_added(event: Event) -> None:
    """
    Handle ticket message added event.

    Actions:
    - Send notification email to other parties in the conversation
    - Create audit log entry
    """
    ticket_id = event.payload.get("ticket_id")
    ticket_number = event.payload.get("ticket_number")
    message_id = event.payload.get("message_id")
    sender_type = event.payload.get("sender_type")
    sender_user_id = event.payload.get("sender_user_id")
    customer_id = event.payload.get("customer_id")
    partner_id = event.payload.get("partner_id")

    logger.info(
        "Handling ticket.message.added event",
        ticket_id=ticket_id,
        ticket_number=ticket_number,
        message_id=message_id,
        sender=sender_type,
        tenant_id=event.metadata.tenant_id,
    )

    # Send notification to relevant parties
    try:
        recipient_email = "support@example.com"  # Configure based on sender/recipient
        notification_message = EmailMessage(
            to=[recipient_email],
            subject=f"New Message on Ticket {ticket_number}",
            text_body=f"""
A new message has been added to ticket {ticket_number}.

From: {sender_type}

Please log in to view and respond to the message.
            """.strip(),
            html_body=f"""
<h2>New Message on Ticket {ticket_number}</h2>
<p><strong>From:</strong> {sender_type}</p>
<p>Please log in to view and respond to the message.</p>
            """.strip(),
        )

        await email_service.send_email(
            message=notification_message, tenant_id=event.metadata.tenant_id
        )
        logger.info("Message notification sent", ticket_number=ticket_number)
    except Exception as e:
        logger.error(
            "Failed to send message notification", ticket_number=ticket_number, error=str(e)
        )

    # Create audit log entry
    try:
        await audit_service.log_activity(
            activity_type=RESOURCE_UPDATED,
            action="ticket.message.added",
            description=f"Message added to ticket {ticket_number}",
            tenant_id=event.metadata.tenant_id,
            user_id=sender_user_id,
            resource_type="ticket",
            resource_id=ticket_id,
            severity=ActivitySeverity.LOW,
            details={
                "ticket_number": ticket_number,
                "message_id": message_id,
                "sender_type": sender_type,
                "customer_id": customer_id,
                "partner_id": partner_id,
            },
        )
        logger.info("Message addition audit logged", ticket_number=ticket_number)
    except Exception as e:
        logger.error(
            "Failed to log message addition audit", ticket_number=ticket_number, error=str(e)
        )


@subscribe("ticket.status_changed")  # type: ignore[misc]  # Custom decorator is untyped
async def handle_ticket_status_changed(event: Event) -> None:
    """
    Handle ticket status changed event.

    Actions:
    - Send status update notification
    - Create audit log entry
    - Trigger SLA monitoring updates
    """
    ticket_id = event.payload.get("ticket_id")
    ticket_number = event.payload.get("ticket_number")
    old_status = event.payload.get("old_status")
    new_status = event.payload.get("new_status")
    customer_id = event.payload.get("customer_id")
    partner_id = event.payload.get("partner_id")

    logger.info(
        "Handling ticket.status_changed event",
        ticket_id=ticket_id,
        ticket_number=ticket_number,
        old_status=old_status,
        new_status=new_status,
        tenant_id=event.metadata.tenant_id,
    )

    # Send status update notification
    try:
        status_messages = {
            "resolved": "Your ticket has been resolved.",
            "closed": "Your ticket has been closed.",
            "in_progress": "Work has started on your ticket.",
            "waiting": "Your ticket is waiting for additional information.",
        }

        status_key = (new_status or "").lower()
        normalized_status = status_key.replace("_", " ").title() if status_key else "Unknown"
        notification_subject = f"Ticket {ticket_number} Status Update: {normalized_status}"
        status_message = status_messages.get(
            status_key,
            f"Ticket status changed to {normalized_status}",
        )

        notification_message = EmailMessage(
            to=["support@example.com"],
            subject=notification_subject,
            text_body=f"""
Ticket {ticket_number} status has been updated.

Previous Status: {old_status}
New Status: {normalized_status}

{status_message}
            """.strip(),
            html_body=f"""
<h2>Ticket Status Update</h2>
<p><strong>Ticket Number:</strong> {ticket_number}</p>
<p><strong>Previous Status:</strong> {old_status}</p>
<p><strong>New Status:</strong> {normalized_status}</p>
<p>{status_message}</p>
            """.strip(),
        )

        await email_service.send_email(
            message=notification_message, tenant_id=event.metadata.tenant_id
        )
        logger.info(
            "Status change notification sent",
            ticket_number=ticket_number,
            new_status=new_status,
        )
    except Exception as e:
        logger.error(
            "Failed to send status change notification",
            ticket_number=ticket_number,
            error=str(e),
        )

    # Create audit log entry
    try:
        severity = (
            ActivitySeverity.HIGH
            if new_status in ("resolved", "closed")
            else ActivitySeverity.MEDIUM
        )
        await audit_service.log_activity(
            activity_type=RESOURCE_UPDATED,
            action="ticket.status_changed",
            description=f"Ticket {ticket_number} status changed from {old_status} to {new_status}",
            tenant_id=event.metadata.tenant_id,
            user_id=event.payload.get("changed_by_user_id"),
            resource_type="ticket",
            resource_id=ticket_id,
            severity=severity,
            details={
                "ticket_number": ticket_number,
                "old_status": old_status,
                "new_status": new_status,
                "customer_id": customer_id,
                "partner_id": partner_id,
            },
        )
        logger.info("Status change audit logged", ticket_number=ticket_number)
    except Exception as e:
        logger.error("Failed to log status change audit", ticket_number=ticket_number, error=str(e))


@subscribe("ticket.assigned")  # type: ignore[misc]  # Custom decorator is untyped
async def handle_ticket_assigned(event: Event) -> None:
    """
    Handle ticket assigned event.

    Actions:
    - Send assignment notification to assignee
    - Create audit log entry
    """
    ticket_id = event.payload.get("ticket_id")
    ticket_number = event.payload.get("ticket_number")
    assigned_to_user_id = event.payload.get("assigned_to_user_id")
    assigned_by_user_id = event.payload.get("assigned_by_user_id")

    logger.info(
        "Handling ticket.assigned event",
        ticket_id=ticket_id,
        ticket_number=ticket_number,
        assigned_to=assigned_to_user_id,
        assigned_by=assigned_by_user_id,
        tenant_id=event.metadata.tenant_id,
    )

    # Send assignment notification
    try:
        notification_message = EmailMessage(
            to=["assignee@example.com"],  # Lookup assignee email from user_id
            subject=f"Ticket {ticket_number} Assigned to You",
            text_body=f"""
You have been assigned to ticket {ticket_number}.

Please review the ticket and respond at your earliest convenience.
            """.strip(),
            html_body=f"""
<h2>Ticket Assigned to You</h2>
<p><strong>Ticket Number:</strong> {ticket_number}</p>
<p>Please review the ticket and respond at your earliest convenience.</p>
            """.strip(),
        )

        await email_service.send_email(
            message=notification_message, tenant_id=event.metadata.tenant_id
        )
        logger.info("Assignment notification sent", ticket_number=ticket_number)
    except Exception as e:
        logger.error(
            "Failed to send assignment notification", ticket_number=ticket_number, error=str(e)
        )

    # Create audit log entry
    try:
        await audit_service.log_activity(
            activity_type=RESOURCE_UPDATED,
            action="ticket.assigned",
            description=f"Ticket {ticket_number} assigned to user",
            tenant_id=event.metadata.tenant_id,
            user_id=assigned_by_user_id,
            resource_type="ticket",
            resource_id=ticket_id,
            severity=ActivitySeverity.MEDIUM,
            details={
                "ticket_number": ticket_number,
                "assigned_to_user_id": assigned_to_user_id,
                "assigned_by_user_id": assigned_by_user_id,
            },
        )
        logger.info("Assignment audit logged", ticket_number=ticket_number)
    except Exception as e:
        logger.error("Failed to log assignment audit", ticket_number=ticket_number, error=str(e))


@subscribe("ticket.escalated.to_partner")  # type: ignore[misc]  # Custom decorator is untyped
async def handle_ticket_escalated_to_partner(event: Event) -> None:
    """
    Handle ticket escalated to partner event.

    Actions:
    - Send escalation notification to partner
    - Create audit log entry
    - Update SLA tracking
    """
    ticket_id = event.payload.get("ticket_id")
    ticket_number = event.payload.get("ticket_number")
    partner_id = event.payload.get("partner_id")
    escalated_by_user_id = event.payload.get("escalated_by_user_id")

    logger.info(
        "Handling ticket.escalated.to_partner event",
        ticket_id=ticket_id,
        ticket_number=ticket_number,
        partner_id=partner_id,
        tenant_id=event.metadata.tenant_id,
    )

    # Send escalation notification to partner
    try:
        notification_message = EmailMessage(
            to=["partner@example.com"],  # Lookup partner email from partner_id
            subject=f"ESCALATION: Ticket {ticket_number} Requires Partner Support",
            text_body=f"""
Ticket {ticket_number} has been escalated to your team for expert support.

This is a high-priority escalation that requires your immediate attention.

Please review the ticket details and respond as soon as possible.
            """.strip(),
            html_body=f"""
<h2 style="color: #d32f2f;">ESCALATION: Partner Support Required</h2>
<p><strong>Ticket Number:</strong> {ticket_number}</p>
<p>This ticket has been escalated to your team for expert support.</p>
<p><strong>This is a high-priority escalation that requires your immediate attention.</strong></p>
<p>Please review the ticket details and respond as soon as possible.</p>
            """.strip(),
        )

        await email_service.send_email(
            message=notification_message, tenant_id=event.metadata.tenant_id
        )
        logger.info(
            "Partner escalation notification sent",
            ticket_number=ticket_number,
            partner_id=partner_id,
        )
    except Exception as e:
        logger.error(
            "Failed to send partner escalation notification",
            ticket_number=ticket_number,
            error=str(e),
        )

    # Create audit log entry
    try:
        await audit_service.log_activity(
            activity_type=RESOURCE_UPDATED,
            action="ticket.escalated.to_partner",
            description=f"Ticket {ticket_number} escalated to partner",
            tenant_id=event.metadata.tenant_id,
            user_id=escalated_by_user_id,
            resource_type="ticket",
            resource_id=ticket_id,
            severity=ActivitySeverity.HIGH,
            details={
                "ticket_number": ticket_number,
                "partner_id": partner_id,
                "escalated_by_user_id": escalated_by_user_id,
            },
        )
        logger.info("Partner escalation audit logged", ticket_number=ticket_number)
    except Exception as e:
        logger.error(
            "Failed to log partner escalation audit", ticket_number=ticket_number, error=str(e)
        )


# Analytics Handlers


@subscribe("ticket.created")  # type: ignore[misc]  # Custom decorator is untyped
async def track_ticket_creation_analytics(event: Event) -> None:
    """Track ticket creation metrics for analytics."""
    ticket_id = event.payload.get("ticket_id")
    ticket_number = event.payload.get("ticket_number")
    origin_type = event.payload.get("origin_type")
    target_type = event.payload.get("target_type")
    priority = event.payload.get("priority")

    logger.debug(
        "Tracking ticket creation analytics",
        ticket_id=ticket_id,
        ticket_number=ticket_number,
        origin=origin_type,
        target=target_type,
        priority=priority,
    )

    # Create analytics audit log
    try:
        await audit_service.log_activity(
            activity_type=ANALYTICS_EVENT,
            action="ticket.created.analytics",
            description=f"Ticket creation tracked for analytics: {ticket_number}",
            tenant_id=event.metadata.tenant_id,
            user_id=event.payload.get("origin_user_id"),
            resource_type="ticket",
            resource_id=ticket_id,
            severity=ActivitySeverity.LOW,
            details={
                "ticket_number": ticket_number,
                "origin_type": origin_type,
                "target_type": target_type,
                "priority": priority,
                "metric_type": "ticket_creation",
                "timestamp": (
                    event.metadata.timestamp.isoformat()
                    if hasattr(event.metadata, "timestamp")
                    else None
                ),
            },
        )
        logger.debug("Ticket creation analytics tracked", ticket_number=ticket_number)
    except Exception as e:
        logger.error(
            "Failed to track ticket creation analytics",
            ticket_number=ticket_number,
            error=str(e),
        )


@subscribe("ticket.status_changed")  # type: ignore[misc]  # Custom decorator is untyped
async def track_ticket_resolution_analytics(event: Event) -> None:
    """Track ticket resolution metrics for analytics."""
    ticket_id = event.payload.get("ticket_id")
    ticket_number = event.payload.get("ticket_number")
    old_status = event.payload.get("old_status")
    new_status = event.payload.get("new_status")

    if new_status in ("resolved", "closed"):
        logger.debug(
            "Tracking ticket resolution analytics",
            ticket_id=ticket_id,
            ticket_number=ticket_number,
            old_status=old_status,
            new_status=new_status,
        )

        # Create analytics audit log for resolution
        try:
            await audit_service.log_activity(
                activity_type=ANALYTICS_EVENT,
                action="ticket.resolved.analytics",
                description=f"Ticket resolution tracked for analytics: {ticket_number}",
                tenant_id=event.metadata.tenant_id,
                user_id=event.payload.get("changed_by_user_id"),
                resource_type="ticket",
                resource_id=ticket_id,
                severity=ActivitySeverity.LOW,
                details={
                    "ticket_number": ticket_number,
                    "old_status": old_status,
                    "new_status": new_status,
                    "metric_type": "ticket_resolution",
                    "timestamp": (
                        event.metadata.timestamp.isoformat()
                        if hasattr(event.metadata, "timestamp")
                        else None
                    ),
                    # Note: time_to_resolution can be calculated by querying ticket created_at
                },
            )
            logger.debug("Ticket resolution analytics tracked", ticket_number=ticket_number)
        except Exception as e:
            logger.error(
                "Failed to track ticket resolution analytics",
                ticket_number=ticket_number,
                error=str(e),
            )


__all__ = [
    "handle_ticket_created",
    "handle_ticket_message_added",
    "handle_ticket_status_changed",
    "handle_ticket_assigned",
    "handle_ticket_escalated_to_partner",
    "track_ticket_creation_analytics",
    "track_ticket_resolution_analytics",
]
