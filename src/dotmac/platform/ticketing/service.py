"""
Domain service layer for ticketing workflows.

Encapsulates validation, actor resolution, and authorization rules so the FastAPI
router can remain thin and declarative.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.auth.core import UserInfo, ensure_uuid
from dotmac.platform.auth.platform_admin import is_platform_admin
from dotmac.platform.customer_management.models import Customer
from dotmac.platform.partner_management.models import Partner, PartnerStatus, PartnerUser

from .events import (
    emit_ticket_assigned,
    emit_ticket_created,
    emit_ticket_escalated_to_partner,
    emit_ticket_message_added,
    emit_ticket_status_changed,
)
from .models import Ticket, TicketActorType, TicketMessage, TicketStatus
from .schemas import TicketCreate, TicketMessageCreate, TicketUpdate

logger = structlog.get_logger(__name__)


class TicketingError(Exception):
    """Base ticketing service error."""


class TicketValidationError(TicketingError):
    """Raised when ticket input fails validation."""


class TicketNotFoundError(TicketingError):
    """Raised when ticket lookup fails."""


class TicketAccessDeniedError(TicketingError):
    """Raised when caller is not permitted to interact with a ticket."""


@dataclass(slots=True)
class TicketActorContext:
    """Resolved context describing the actor interacting with tickets."""

    actor_type: TicketActorType
    user_uuid: UUID | None
    tenant_id: str | None
    partner_id: UUID | None
    customer_id: UUID | None
    is_platform_admin: bool = False


ALLOWED_TARGETS: dict[TicketActorType, set[TicketActorType]] = {
    TicketActorType.CUSTOMER: {TicketActorType.TENANT},
    TicketActorType.TENANT: {TicketActorType.PARTNER, TicketActorType.PLATFORM},
    TicketActorType.PARTNER: {TicketActorType.PLATFORM, TicketActorType.TENANT},
    TicketActorType.PLATFORM: {TicketActorType.TENANT, TicketActorType.PARTNER},
}


class TicketService:
    """Business logic for ticketing workflows."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize ticket service.

        Args:
            session: Async SQLAlchemy session for database operations
        """
        self.session = session
        self._log = logging.getLogger(__name__)

    async def create_ticket(
        self,
        data: TicketCreate,
        current_user: UserInfo,
        tenant_id: str | None,
    ) -> Ticket:
        """Create a new ticket and persist initial message."""
        context = await self._resolve_actor_context(current_user, tenant_id)
        self._validate_target(context.actor_type, data.target_type)

        # Determine tenant scope
        tenant_scope = data.tenant_id or context.tenant_id or current_user.tenant_id
        if not tenant_scope and data.target_type in {
            TicketActorType.TENANT,
            TicketActorType.PARTNER,
        }:
            raise TicketValidationError(
                "Tenant context is required when targeting tenant or partner audiences."
            )

        # Ensure tenant_scope is set for database operations
        if tenant_scope is None:
            raise TicketValidationError("Tenant context is required to create a ticket.")

        partner_id = await self._resolve_partner_id(context, data.partner_id, tenant_scope, data)
        customer_id = await self._resolve_customer_id(context)

        ticket = Ticket(
            ticket_number=self._generate_ticket_number(),
            subject=data.subject.strip(),
            status=TicketStatus.OPEN,
            priority=data.priority,
            origin_type=context.actor_type,
            target_type=data.target_type,
            origin_user_id=context.user_uuid,
            tenant_id=tenant_scope,
            partner_id=partner_id,
            customer_id=customer_id,
            context=data.metadata or {},
            # ISP-specific fields
            ticket_type=data.ticket_type,
            service_address=data.service_address,
            affected_services=list(data.affected_services) if data.affected_services else [],
            device_serial_numbers=(
                list(data.device_serial_numbers) if data.device_serial_numbers else []
            ),
        )
        ticket.created_by = current_user.user_id
        ticket.last_response_at = datetime.now(UTC)

        initial_message = TicketMessage(
            ticket=ticket,
            sender_type=context.actor_type,
            sender_user_id=context.user_uuid,
            tenant_id=tenant_scope,
            partner_id=partner_id if context.actor_type == TicketActorType.PARTNER else None,
            customer_id=customer_id if context.actor_type == TicketActorType.CUSTOMER else None,
            body=data.message.strip(),
            attachments=list(data.attachments or []),
        )
        initial_message.created_by = current_user.user_id
        ticket.messages.append(initial_message)

        self.session.add(ticket)
        await self.session.flush()
        await self.session.commit()

        logger.info(
            "ticket.created",
            ticket_id=str(ticket.id),
            ticket_number=ticket.ticket_number,
            origin=context.actor_type,
            target=data.target_type,
            tenant_id=tenant_scope,
            partner_id=str(partner_id) if partner_id else None,
        )

        # Emit ticket created event
        await emit_ticket_created(
            ticket_id=ticket.id,
            ticket_number=ticket.ticket_number,
            subject=ticket.subject,
            origin_type=ticket.origin_type.value,
            target_type=ticket.target_type.value,
            priority=ticket.priority.value,
            tenant_id=tenant_scope,
            customer_id=customer_id,
            partner_id=partner_id,
            origin_user_id=context.user_uuid,
        )

        # Emit escalation event if escalating to partner
        if data.target_type == TicketActorType.PARTNER and partner_id:
            await emit_ticket_escalated_to_partner(
                ticket_id=ticket.id,
                ticket_number=ticket.ticket_number,
                partner_id=partner_id,
                tenant_id=tenant_scope,
                escalated_by_user_id=context.user_uuid,
            )

        return await self.get_ticket(ticket.id, current_user, tenant_scope, include_messages=True)

    async def list_tickets(
        self,
        current_user: UserInfo,
        tenant_id: str | None,
        status: TicketStatus | None = None,
        include_messages: bool = False,
    ) -> list[Ticket]:
        """List tickets visible to the current actor."""
        context = await self._resolve_actor_context(current_user, tenant_id)

        query = select(Ticket)
        if include_messages:
            query = query.options(selectinload(Ticket.messages))

        if not context.is_platform_admin:
            if context.actor_type == TicketActorType.CUSTOMER:
                if not context.customer_id:
                    return []
                query = query.where(Ticket.customer_id == context.customer_id)
            elif context.actor_type == TicketActorType.PARTNER:
                if not context.partner_id:
                    return []
                query = query.where(Ticket.partner_id == context.partner_id)
            else:
                scope = context.tenant_id or tenant_id or current_user.tenant_id
                if scope:
                    query = query.where(Ticket.tenant_id == scope)
        else:
            scoped_tenant = tenant_id or context.tenant_id
            if scoped_tenant:
                query = query.where(Ticket.tenant_id == scoped_tenant)

        if status:
            query = query.where(Ticket.status == status)

        query = query.order_by(Ticket.created_at.desc())

        result = await self.session.execute(query)
        tickets = list(result.scalars().unique().all())
        return tickets

    async def get_ticket(
        self,
        ticket_id: UUID | str,
        current_user: UserInfo,
        tenant_id: str | None,
        *,
        include_messages: bool = True,
    ) -> Ticket:
        """Fetch a ticket, ensuring the actor has access."""
        context = await self._resolve_actor_context(current_user, tenant_id)
        ticket_uuid = ensure_uuid(ticket_id)

        query = select(Ticket).where(Ticket.id == ticket_uuid)
        if include_messages:
            query = query.options(selectinload(Ticket.messages))

        result = await self.session.execute(query)
        ticket = result.scalar_one_or_none()
        if not ticket:
            raise TicketNotFoundError(f"Ticket {ticket_uuid} not found")

        self._ensure_access(context, ticket)
        return ticket

    async def add_message(
        self,
        ticket_id: UUID | str,
        data: TicketMessageCreate,
        current_user: UserInfo,
        tenant_id: str | None,
    ) -> Ticket:
        """Append a message to an existing ticket."""
        ticket = await self.get_ticket(ticket_id, current_user, tenant_id, include_messages=True)
        context = await self._resolve_actor_context(current_user, tenant_id)

        message = TicketMessage(
            ticket=ticket,
            sender_type=context.actor_type,
            sender_user_id=context.user_uuid,
            tenant_id=ticket.tenant_id,
            partner_id=(
                context.partner_id if context.actor_type == TicketActorType.PARTNER else None
            ),
            customer_id=(
                context.customer_id if context.actor_type == TicketActorType.CUSTOMER else None
            ),
            body=data.message.strip(),
            attachments=list(data.attachments or []),
        )
        message.created_by = current_user.user_id
        ticket.messages.append(message)

        old_status = ticket.status
        ticket.last_response_at = datetime.now(UTC)
        if data.new_status:
            ticket.status = data.new_status
        ticket.updated_by = current_user.user_id

        await self.session.flush()
        await self.session.commit()

        logger.info(
            "ticket.message.appended",
            ticket_id=str(ticket.id),
            sender=context.actor_type,
            user_id=current_user.user_id,
            new_status=data.new_status.value if data.new_status else None,
        )

        # Emit message added event
        await emit_ticket_message_added(
            ticket_id=ticket.id,
            ticket_number=ticket.ticket_number,
            message_id=message.id,
            sender_type=context.actor_type.value,
            sender_user_id=context.user_uuid,
            tenant_id=ticket.tenant_id,
            customer_id=ticket.customer_id,
            partner_id=ticket.partner_id,
        )

        # Emit status changed event if status was updated
        if data.new_status and data.new_status != old_status:
            await emit_ticket_status_changed(
                ticket_id=ticket.id,
                ticket_number=ticket.ticket_number,
                old_status=old_status.value,
                new_status=data.new_status.value,
                changed_by_user_id=context.user_uuid,
                tenant_id=ticket.tenant_id,
                customer_id=ticket.customer_id,
                partner_id=ticket.partner_id,
            )

        # Reload with messages to ensure consistent ordering/state
        return await self.get_ticket(ticket.id, current_user, tenant_id, include_messages=True)

    async def update_ticket(
        self,
        ticket_id: UUID | str,
        data: TicketUpdate,
        current_user: UserInfo,
        tenant_id: str | None,
    ) -> Ticket:
        """Update ticket metadata such as status, priority, or assignment."""
        ticket = await self.get_ticket(ticket_id, current_user, tenant_id, include_messages=True)
        context = await self._resolve_actor_context(current_user, tenant_id)

        if context.actor_type == TicketActorType.CUSTOMER:
            raise TicketAccessDeniedError("Customers cannot update ticket metadata.")

        updated = False
        old_status = ticket.status
        old_assigned = ticket.assigned_to_user_id

        # Standard fields (allowed for all non-customer actors)
        if data.status and data.status != ticket.status:
            ticket.status = data.status
            updated = True

        if data.priority and data.priority != ticket.priority:
            ticket.priority = data.priority
            updated = True

        if (
            data.assigned_to_user_id is not None
            and data.assigned_to_user_id != ticket.assigned_to_user_id
        ):
            ticket.assigned_to_user_id = data.assigned_to_user_id
            updated = True

        if data.metadata:
            ticket.context.update(data.metadata)
            updated = True

        # ISP-specific fields
        # Role-based validation: Only tenant/platform actors can update operational metadata
        # Partners can view but not modify service details
        can_update_service_metadata = context.actor_type in {
            TicketActorType.TENANT,
            TicketActorType.PLATFORM,
        }

        if data.ticket_type is not None and data.ticket_type != ticket.ticket_type:
            if not can_update_service_metadata:
                raise TicketAccessDeniedError(
                    "Only tenant and platform actors can update ticket type."
                )
            ticket.ticket_type = data.ticket_type
            updated = True

        if data.service_address is not None and data.service_address != ticket.service_address:
            if not can_update_service_metadata:
                raise TicketAccessDeniedError(
                    "Only tenant and platform actors can update service address."
                )
            ticket.service_address = data.service_address
            updated = True

        if data.affected_services is not None:
            # Replace entire list (not merge)
            if not can_update_service_metadata:
                raise TicketAccessDeniedError(
                    "Only tenant and platform actors can update affected services."
                )
            ticket.affected_services = list(data.affected_services)
            updated = True

        if data.device_serial_numbers is not None:
            # Replace entire list (not merge)
            if not can_update_service_metadata:
                raise TicketAccessDeniedError(
                    "Only tenant and platform actors can update device serial numbers."
                )
            ticket.device_serial_numbers = list(data.device_serial_numbers)
            updated = True

        # Escalation fields (allowed for all non-customer actors)
        if data.escalation_level is not None and data.escalation_level != ticket.escalation_level:
            ticket.escalation_level = data.escalation_level
            if data.escalation_level > 0 and not ticket.escalated_at:
                ticket.escalated_at = datetime.now(UTC)
            updated = True

        if (
            data.escalated_to_user_id is not None
            and data.escalated_to_user_id != ticket.escalated_to_user_id
        ):
            ticket.escalated_to_user_id = data.escalated_to_user_id
            if not ticket.escalated_at:
                ticket.escalated_at = datetime.now(UTC)
            updated = True

        if updated:
            ticket.updated_by = current_user.user_id
            await self.session.flush()
            await self.session.commit()
            logger.info(
                "ticket.updated",
                ticket_id=str(ticket.id),
                status=ticket.status.value,
                priority=ticket.priority.value,
                assigned_to=str(ticket.assigned_to_user_id) if ticket.assigned_to_user_id else None,
            )

            # Emit status changed event
            if data.status and data.status != old_status:
                await emit_ticket_status_changed(
                    ticket_id=ticket.id,
                    ticket_number=ticket.ticket_number,
                    old_status=old_status.value,
                    new_status=ticket.status.value,
                    changed_by_user_id=context.user_uuid,
                    tenant_id=ticket.tenant_id,
                    customer_id=ticket.customer_id,
                    partner_id=ticket.partner_id,
                )

            # Emit assignment event
            if data.assigned_to_user_id is not None and data.assigned_to_user_id != old_assigned:
                await emit_ticket_assigned(
                    ticket_id=ticket.id,
                    ticket_number=ticket.ticket_number,
                    assigned_to_user_id=data.assigned_to_user_id,
                    assigned_by_user_id=context.user_uuid,
                    tenant_id=ticket.tenant_id,
                )

        return await self.get_ticket(ticket.id, current_user, tenant_id, include_messages=True)

    async def _resolve_actor_context(
        self,
        current_user: UserInfo,
        tenant_id: str | None,
    ) -> TicketActorContext:
        """Determine which actor is interacting with the ticketing system."""
        user_uuid = None
        if current_user.user_id:
            try:
                user_uuid = ensure_uuid(current_user.user_id)
            except ValueError:
                logger.warning("Invalid user_id on current_user", user_id=current_user.user_id)

        tenant_scope = tenant_id or current_user.tenant_id
        if is_platform_admin(current_user):
            return TicketActorContext(
                actor_type=TicketActorType.PLATFORM,
                user_uuid=user_uuid,
                tenant_id=tenant_scope,
                partner_id=None,
                customer_id=None,
                is_platform_admin=True,
            )

        # Partner users take precedence over customers
        if user_uuid:
            partner_user = await self._fetch_partner_user(user_uuid, tenant_scope)
            if partner_user:
                return TicketActorContext(
                    actor_type=TicketActorType.PARTNER,
                    user_uuid=user_uuid,
                    tenant_id=partner_user.tenant_id or tenant_scope,
                    partner_id=partner_user.partner_id,
                    customer_id=None,
                )

            customer = await self._fetch_customer(user_uuid, tenant_scope)
            if customer:
                return TicketActorContext(
                    actor_type=TicketActorType.CUSTOMER,
                    user_uuid=user_uuid,
                    tenant_id=customer.tenant_id or tenant_scope,
                    partner_id=None,
                    customer_id=customer.id,
                )

        return TicketActorContext(
            actor_type=TicketActorType.TENANT,
            user_uuid=user_uuid,
            tenant_id=tenant_scope,
            partner_id=None,
            customer_id=None,
        )

    async def _resolve_partner_id(
        self,
        context: TicketActorContext,
        partner_id: UUID | None,
        tenant_scope: str | None,
        payload: TicketCreate,
    ) -> UUID | None:
        """Determine and validate the partner context for a ticket."""
        if context.actor_type == TicketActorType.PARTNER:
            return context.partner_id

        if payload.target_type != TicketActorType.PARTNER:
            return partner_id

        if not partner_id:
            raise TicketValidationError("partner_id is required when targeting a partner.")

        partner = await self._fetch_partner(partner_id)
        if not partner:
            raise TicketValidationError("Partner not found or inactive.")
        if partner.status != PartnerStatus.ACTIVE:
            raise TicketValidationError("Partner must be active to receive tickets.")
        if tenant_scope and partner.tenant_id and partner.tenant_id != tenant_scope:
            raise TicketValidationError("Partner does not belong to the specified tenant context.")

        result_id: UUID = partner.id
        return result_id

    async def _resolve_customer_id(self, context: TicketActorContext) -> UUID | None:
        """Determine associated customer if the actor is a customer."""
        if context.actor_type == TicketActorType.CUSTOMER:
            if not context.customer_id:
                raise TicketValidationError(
                    "Customer context missing for customer-originated ticket."
                )
            return context.customer_id
        return None

    def _validate_target(self, origin: TicketActorType, target: TicketActorType) -> None:
        """Ensure origin/target combinations are supported."""
        allowed_targets = ALLOWED_TARGETS.get(origin, set())
        if target not in allowed_targets:
            raise TicketValidationError(
                f"{origin.value.title()} actors cannot open tickets targeting {target.value}."
            )

    def _ensure_access(self, context: TicketActorContext, ticket: Ticket) -> None:
        """Assert that the current actor can access the ticket."""
        if context.is_platform_admin:
            return

        if context.actor_type == TicketActorType.CUSTOMER:
            if ticket.customer_id != context.customer_id:
                raise TicketAccessDeniedError("Customer does not have access to this ticket.")
            return

        if context.actor_type == TicketActorType.PARTNER:
            if ticket.partner_id != context.partner_id:
                raise TicketAccessDeniedError("Partner does not have access to this ticket.")
            return

        # Tenant actor
        tenant_scope = context.tenant_id
        if tenant_scope and ticket.tenant_id and ticket.tenant_id != tenant_scope:
            raise TicketAccessDeniedError("Ticket belongs to a different tenant.")

    async def _fetch_partner_user(
        self,
        user_uuid: UUID,
        tenant_scope: str | None,
    ) -> PartnerUser | None:
        query = select(PartnerUser).where(
            PartnerUser.user_id == user_uuid,
            PartnerUser.is_active.is_(True),
            PartnerUser.deleted_at.is_(None),
        )
        if tenant_scope:
            query = query.where(PartnerUser.tenant_id == tenant_scope)

        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def _fetch_customer(
        self,
        user_uuid: UUID,
        tenant_scope: str | None,
    ) -> Customer | None:
        query = select(Customer).where(
            Customer.user_id == user_uuid,
            Customer.deleted_at.is_(None),
        )
        if tenant_scope:
            query = query.where(Customer.tenant_id == tenant_scope)

        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def _fetch_partner(self, partner_id: UUID) -> Partner | None:
        query = select(Partner).where(
            Partner.id == partner_id,
            Partner.deleted_at.is_(None),
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    def _generate_ticket_number() -> str:
        """Generate a globally unique, human-readable ticket identifier."""
        return f"TCK-{uuid.uuid4().hex[:12].upper()}"


__all__ = [
    "TicketService",
    "TicketingError",
    "TicketValidationError",
    "TicketAccessDeniedError",
    "TicketNotFoundError",
    "TicketActorContext",
]
