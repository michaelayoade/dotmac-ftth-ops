"""
Ticketing event types and event emission helpers.

This module defines all ticketing-related events and provides
helper functions for emitting them through the event bus.
"""

from typing import TYPE_CHECKING, Any
from uuid import UUID

import structlog

from dotmac.platform.events import EventPriority, get_event_bus

if TYPE_CHECKING:
    from dotmac.platform.events import EventBus

logger = structlog.get_logger(__name__)


# ============================================================================
# Ticketing Event Types
# ============================================================================


class TicketingEvents:
    """Ticketing event type constants."""

    # Ticket lifecycle events
    TICKET_CREATED = "ticket.created"
    TICKET_UPDATED = "ticket.updated"
    TICKET_STATUS_CHANGED = "ticket.status_changed"
    TICKET_ASSIGNED = "ticket.assigned"
    TICKET_RESOLVED = "ticket.resolved"
    TICKET_CLOSED = "ticket.closed"
    TICKET_REOPENED = "ticket.reopened"

    # Message events
    TICKET_MESSAGE_ADDED = "ticket.message.added"

    # Escalation events
    TICKET_ESCALATED_TO_PARTNER = "ticket.escalated.to_partner"
    TICKET_ESCALATED_TO_PLATFORM = "ticket.escalated.to_platform"


# ============================================================================
# Event Emission Helpers
# ============================================================================


async def emit_ticket_created(
    ticket_id: str | UUID,
    ticket_number: str,
    subject: str,
    origin_type: str,
    target_type: str,
    priority: str,
    tenant_id: str,
    customer_id: str | UUID | None = None,
    partner_id: str | UUID | None = None,
    origin_user_id: str | UUID | None = None,
    event_bus: "EventBus | None" = None,
    **extra_data: Any,
) -> None:
    """
    Emit ticket.created event when a new ticket is created.

    Args:
        ticket_id: UUID of the created ticket
        ticket_number: Unique ticket number (e.g., "TCKT-12345")
        subject: Ticket subject line
        origin_type: Actor type who created the ticket (customer, tenant, partner, platform)
        target_type: Actor type the ticket is directed to
        priority: Ticket priority (low, normal, high, urgent)
        tenant_id: Tenant ID for multi-tenant isolation
        customer_id: Optional customer ID if customer is involved
        partner_id: Optional partner ID if partner is involved
        origin_user_id: Optional user ID who created the ticket
        event_bus: Optional event bus instance
        **extra_data: Additional event data
    """
    bus = event_bus or get_event_bus()

    event_data = {
        "ticket_id": str(ticket_id),
        "ticket_number": ticket_number,
        "subject": subject,
        "origin_type": origin_type,
        "target_type": target_type,
        "priority": priority,
        "customer_id": str(customer_id) if customer_id else None,
        "partner_id": str(partner_id) if partner_id else None,
        "origin_user_id": str(origin_user_id) if origin_user_id else None,
        **extra_data,
    }

    await bus.publish(
        event_type=TicketingEvents.TICKET_CREATED,
        payload=event_data,
        metadata={"tenant_id": tenant_id},
        priority=EventPriority.NORMAL,
    )

    logger.info(
        "ticket.created event emitted",
        ticket_id=str(ticket_id),
        ticket_number=ticket_number,
        origin=origin_type,
        target=target_type,
    )


async def emit_ticket_message_added(
    ticket_id: str | UUID,
    ticket_number: str,
    message_id: str | UUID,
    sender_type: str,
    sender_user_id: str | UUID | None,
    tenant_id: str,
    customer_id: str | UUID | None = None,
    partner_id: str | UUID | None = None,
    event_bus: "EventBus | None" = None,
    **extra_data: Any,
) -> None:
    """
    Emit ticket.message.added event when a new message is added to a ticket.

    Args:
        ticket_id: UUID of the ticket
        ticket_number: Unique ticket number
        message_id: UUID of the new message
        sender_type: Actor type who sent the message
        sender_user_id: Optional user ID who sent the message
        tenant_id: Tenant ID for multi-tenant isolation
        customer_id: Optional customer ID if involved
        partner_id: Optional partner ID if involved
        event_bus: Optional event bus instance
        **extra_data: Additional event data
    """
    bus = event_bus or get_event_bus()

    event_data = {
        "ticket_id": str(ticket_id),
        "ticket_number": ticket_number,
        "message_id": str(message_id),
        "sender_type": sender_type,
        "sender_user_id": str(sender_user_id) if sender_user_id else None,
        "customer_id": str(customer_id) if customer_id else None,
        "partner_id": str(partner_id) if partner_id else None,
        **extra_data,
    }

    await bus.publish(
        event_type=TicketingEvents.TICKET_MESSAGE_ADDED,
        payload=event_data,
        metadata={"tenant_id": tenant_id},
        priority=EventPriority.NORMAL,
    )

    logger.info(
        "ticket.message.added event emitted",
        ticket_id=str(ticket_id),
        message_id=str(message_id),
        sender=sender_type,
    )


async def emit_ticket_status_changed(
    ticket_id: str | UUID,
    ticket_number: str,
    old_status: str,
    new_status: str,
    changed_by_user_id: str | UUID | None,
    tenant_id: str,
    customer_id: str | UUID | None = None,
    partner_id: str | UUID | None = None,
    event_bus: "EventBus | None" = None,
    **extra_data: Any,
) -> None:
    """
    Emit ticket.status_changed event when ticket status is updated.

    Args:
        ticket_id: UUID of the ticket
        ticket_number: Unique ticket number
        old_status: Previous ticket status
        new_status: New ticket status
        changed_by_user_id: User ID who changed the status
        tenant_id: Tenant ID for multi-tenant isolation
        customer_id: Optional customer ID if involved
        partner_id: Optional partner ID if involved
        event_bus: Optional event bus instance
        **extra_data: Additional event data
    """
    bus = event_bus or get_event_bus()

    event_data = {
        "ticket_id": str(ticket_id),
        "ticket_number": ticket_number,
        "old_status": old_status,
        "new_status": new_status,
        "changed_by_user_id": str(changed_by_user_id) if changed_by_user_id else None,
        "customer_id": str(customer_id) if customer_id else None,
        "partner_id": str(partner_id) if partner_id else None,
        **extra_data,
    }

    await bus.publish(
        event_type=TicketingEvents.TICKET_STATUS_CHANGED,
        payload=event_data,
        metadata={"tenant_id": tenant_id},
        priority=(
            EventPriority.HIGH if new_status in ("resolved", "closed") else EventPriority.NORMAL
        ),
    )

    logger.info(
        "ticket.status_changed event emitted",
        ticket_id=str(ticket_id),
        old_status=old_status,
        new_status=new_status,
    )


async def emit_ticket_assigned(
    ticket_id: str | UUID,
    ticket_number: str,
    assigned_to_user_id: str | UUID,
    assigned_by_user_id: str | UUID | None,
    tenant_id: str,
    event_bus: "EventBus | None" = None,
    **extra_data: Any,
) -> None:
    """
    Emit ticket.assigned event when a ticket is assigned to a user.

    Args:
        ticket_id: UUID of the ticket
        ticket_number: Unique ticket number
        assigned_to_user_id: User ID the ticket is assigned to
        assigned_by_user_id: User ID who made the assignment
        tenant_id: Tenant ID for multi-tenant isolation
        event_bus: Optional event bus instance
        **extra_data: Additional event data
    """
    bus = event_bus or get_event_bus()

    event_data = {
        "ticket_id": str(ticket_id),
        "ticket_number": ticket_number,
        "assigned_to_user_id": str(assigned_to_user_id),
        "assigned_by_user_id": str(assigned_by_user_id) if assigned_by_user_id else None,
        **extra_data,
    }

    await bus.publish(
        event_type=TicketingEvents.TICKET_ASSIGNED,
        payload=event_data,
        metadata={"tenant_id": tenant_id},
        priority=EventPriority.NORMAL,
    )

    logger.info(
        "ticket.assigned event emitted",
        ticket_id=str(ticket_id),
        assigned_to=str(assigned_to_user_id),
    )


async def emit_ticket_escalated_to_partner(
    ticket_id: str | UUID,
    ticket_number: str,
    partner_id: str | UUID,
    tenant_id: str,
    escalated_by_user_id: str | UUID | None = None,
    event_bus: "EventBus | None" = None,
    **extra_data: Any,
) -> None:
    """
    Emit ticket.escalated.to_partner event when a ticket is escalated to a partner.

    Args:
        ticket_id: UUID of the ticket
        ticket_number: Unique ticket number
        partner_id: Partner ID the ticket is escalated to
        tenant_id: Tenant ID for multi-tenant isolation
        escalated_by_user_id: User ID who escalated the ticket
        event_bus: Optional event bus instance
        **extra_data: Additional event data
    """
    bus = event_bus or get_event_bus()

    event_data = {
        "ticket_id": str(ticket_id),
        "ticket_number": ticket_number,
        "partner_id": str(partner_id),
        "escalated_by_user_id": str(escalated_by_user_id) if escalated_by_user_id else None,
        **extra_data,
    }

    await bus.publish(
        event_type=TicketingEvents.TICKET_ESCALATED_TO_PARTNER,
        payload=event_data,
        metadata={"tenant_id": tenant_id},
        priority=EventPriority.HIGH,
    )

    logger.info(
        "ticket.escalated.to_partner event emitted",
        ticket_id=str(ticket_id),
        partner_id=str(partner_id),
    )


__all__ = [
    "TicketingEvents",
    "emit_ticket_created",
    "emit_ticket_message_added",
    "emit_ticket_status_changed",
    "emit_ticket_assigned",
    "emit_ticket_escalated_to_partner",
]
