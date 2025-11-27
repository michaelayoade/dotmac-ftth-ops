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
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import case, func, or_, select
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
from .models import Ticket, TicketActorType, TicketMessage, TicketPriority, TicketStatus
from .schemas import AgentPerformanceMetrics, TicketCreate, TicketMessageCreate, TicketUpdate

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
        priority: TicketPriority | None = None,
        search: str | None = None,
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

        if priority:
            query = query.where(Ticket.priority == priority)

        if search:
            term = f"%{search.lower()}%"
            query = query.where(
                or_(
                    func.lower(Ticket.subject).like(term),
                    func.lower(Ticket.ticket_number).like(term),
                )
            )

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

    async def get_ticket_counts(
        self,
        current_user: UserInfo,
        tenant_id: str | None,
    ) -> dict[str, int]:
        """Return ticket counts by status for the current actor/tenant."""
        await self._resolve_actor_context(current_user, tenant_id)

        stmt = select(
            func.count(Ticket.id).label("total"),
            func.sum(case((Ticket.status == TicketStatus.OPEN, 1), else_=0)).label("open"),
            func.sum(case((Ticket.status == TicketStatus.IN_PROGRESS, 1), else_=0)).label(
                "in_progress"
            ),
            func.sum(case((Ticket.status == TicketStatus.WAITING, 1), else_=0)).label("waiting"),
            func.sum(case((Ticket.status == TicketStatus.RESOLVED, 1), else_=0)).label("resolved"),
            func.sum(case((Ticket.status == TicketStatus.CLOSED, 1), else_=0)).label("closed"),
        )

        if tenant_id:
            stmt = stmt.where(Ticket.tenant_id == tenant_id)

        result = await self.session.execute(stmt)
        row = result.one()
        return {
            "total_tickets": row.total or 0,
            "open_tickets": row.open or 0,
            "in_progress_tickets": row.in_progress or 0,
            "waiting_tickets": row.waiting or 0,
            "resolved_tickets": row.resolved or 0,
            "closed_tickets": row.closed or 0,
        }

    async def get_ticket_metrics(
        self,
        current_user: UserInfo,
        tenant_id: str | None,
    ) -> dict[str, Any]:
        """Return dashboard-friendly ticket metrics grouped by status, priority, and type."""
        await self._resolve_actor_context(current_user, tenant_id)

        # Status and priority counts in a single query
        stmt = select(
            func.count(Ticket.id).label("total"),
            func.sum(case((Ticket.status == TicketStatus.OPEN, 1), else_=0)).label("open"),
            func.sum(case((Ticket.status == TicketStatus.IN_PROGRESS, 1), else_=0)).label(
                "in_progress"
            ),
            func.sum(case((Ticket.status == TicketStatus.WAITING, 1), else_=0)).label("waiting"),
            func.sum(case((Ticket.status == TicketStatus.RESOLVED, 1), else_=0)).label("resolved"),
            func.sum(case((Ticket.status == TicketStatus.CLOSED, 1), else_=0)).label("closed"),
            func.sum(case((Ticket.priority == TicketPriority.LOW, 1), else_=0)).label("low"),
            func.sum(case((Ticket.priority == TicketPriority.NORMAL, 1), else_=0)).label("normal"),
            func.sum(case((Ticket.priority == TicketPriority.HIGH, 1), else_=0)).label("high"),
            func.sum(case((Ticket.priority == TicketPriority.URGENT, 1), else_=0)).label("urgent"),
            func.sum(case((Ticket.sla_breached.is_(True), 1), else_=0)).label("sla_breached"),
        )

        if tenant_id:
            stmt = stmt.where(Ticket.tenant_id == tenant_id)

        result = await self.session.execute(stmt)
        row = result.one()

        # Group counts by type separately (handle NULL ticket_type)
        type_stmt = select(Ticket.ticket_type, func.count(Ticket.id)).group_by(Ticket.ticket_type)
        if tenant_id:
            type_stmt = type_stmt.where(Ticket.tenant_id == tenant_id)
        type_rows = await self.session.execute(type_stmt)
        by_type = {
            ticket_type.value if ticket_type else "unspecified": count
            for ticket_type, count in type_rows
            if count
        }

        return {
            "total": row.total or 0,
            "open": row.open or 0,
            "in_progress": row.in_progress or 0,
            "waiting": row.waiting or 0,
            "resolved": row.resolved or 0,
            "closed": row.closed or 0,
            "sla_breached": row.sla_breached or 0,
            "by_priority": {
                "low": row.low or 0,
                "normal": row.normal or 0,
                "high": row.high or 0,
                "urgent": row.urgent or 0,
            },
            "by_type": by_type,
        }

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
            # Fall back to role-based customer context when no DB record is linked
            if "customer" in (current_user.roles or []):
                return TicketActorContext(
                    actor_type=TicketActorType.CUSTOMER,
                    user_uuid=user_uuid,
                    tenant_id=tenant_scope,
                    partner_id=None,
                    customer_id=None,
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

    async def get_agent_performance(
        self,
        tenant_id: str | None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[AgentPerformanceMetrics]:
        """Get performance metrics for all agents (users with assigned tickets)."""
        from dotmac.platform.user_management.models import User

        # Base query to get all agents with assigned tickets
        query = (
            select(
                Ticket.assigned_to_user_id,
                func.count(Ticket.id).label("total_assigned"),
                func.sum(func.case((Ticket.status == TicketStatus.RESOLVED, 1), else_=0)).label(
                    "total_resolved"
                ),
                func.sum(func.case((Ticket.status == TicketStatus.OPEN, 1), else_=0)).label(
                    "total_open"
                ),
                func.sum(func.case((Ticket.status == TicketStatus.IN_PROGRESS, 1), else_=0)).label(
                    "total_in_progress"
                ),
                func.avg(Ticket.resolution_time_minutes).label("avg_resolution_time"),
                func.avg(
                    func.extract(
                        "epoch",
                        func.coalesce(Ticket.first_response_at, Ticket.updated_at)
                        - Ticket.created_at,
                    )
                    / 60
                ).label("avg_first_response_time"),
                func.sum(
                    func.case(
                        (Ticket.sla_breached.is_(False), 1),
                        else_=0,
                    )
                ).label("sla_met_count"),
                func.sum(func.case((Ticket.escalation_level > 0, 1), else_=0)).label(
                    "escalated_count"
                ),
            )
            .where(Ticket.assigned_to_user_id.isnot(None))
            .group_by(Ticket.assigned_to_user_id)
        )

        # Apply tenant filter if provided
        if tenant_id:
            query = query.where(Ticket.tenant_id == tenant_id)

        # Apply date filters if provided
        if start_date:
            query = query.where(Ticket.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.where(Ticket.created_at <= datetime.fromisoformat(end_date))

        result = await self.session.execute(query)
        rows = result.all()

        # Fetch user information for each agent
        metrics = []
        for row in rows:
            agent_id = row.assigned_to_user_id
            total_assigned = row.total_assigned or 0
            sla_met_count = row.sla_met_count or 0
            escalated_count = row.escalated_count or 0

            # Fetch user details
            user_query = select(User).where(User.id == agent_id)
            user_result = await self.session.execute(user_query)
            user = user_result.scalar_one_or_none()

            metrics.append(
                AgentPerformanceMetrics(
                    agent_id=agent_id,
                    agent_name=f"{user.first_name} {user.last_name}" if user else None,
                    agent_email=user.email if user else None,
                    total_assigned=total_assigned,
                    total_resolved=row.total_resolved or 0,
                    total_open=row.total_open or 0,
                    total_in_progress=row.total_in_progress or 0,
                    avg_resolution_time_minutes=row.avg_resolution_time,
                    avg_first_response_time_minutes=row.avg_first_response_time,
                    sla_compliance_rate=(
                        (sla_met_count / total_assigned * 100) if total_assigned > 0 else None
                    ),
                    escalation_rate=(
                        (escalated_count / total_assigned * 100) if total_assigned > 0 else None
                    ),
                )
            )

        return metrics

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
