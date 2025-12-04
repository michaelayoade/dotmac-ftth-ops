"""Automatic ticket assignment service with round-robin logic."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .availability_models import AgentAvailability, AgentStatus
from .models import Ticket, TicketStatus

logger = structlog.get_logger(__name__)


class TicketAssignmentService:
    """Service for automatic ticket assignment using round-robin with load balancing."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize assignment service.

        Args:
            session: Async SQLAlchemy session
        """
        self.session = session

    async def assign_ticket_automatically(
        self,
        ticket_id: UUID,
        tenant_id: str | None = None,
    ) -> UUID | None:
        """Assign a ticket to an available agent using round-robin with load balancing.

        Algorithm:
        1. Find all agents with status = 'available'
        2. Calculate current workload for each agent (open + in_progress tickets)
        3. Select agent with lowest workload
        4. If multiple agents have same workload, use round-robin (last_activity_at)

        Args:
            ticket_id: ID of the ticket to assign
            tenant_id: Optional tenant filter

        Returns:
            UUID of assigned agent, or None if no available agents
        """
        # Get available agents
        query = select(AgentAvailability).where(AgentAvailability.status == AgentStatus.AVAILABLE)

        if tenant_id:
            query = query.where(AgentAvailability.tenant_id == tenant_id)

        result = await self.session.execute(query)
        available_agents = result.scalars().all()

        if not available_agents:
            logger.warning(
                "assignment.no_agents_available",
                ticket_id=str(ticket_id),
                tenant_id=tenant_id,
            )
            return None

        # Calculate workload for each agent
        agent_workloads: list[tuple[UUID, int, datetime | None]] = []

        for agent in available_agents:
            # Count open and in-progress tickets
            workload_query = (
                select(func.count(Ticket.id))
                .where(Ticket.assigned_to_user_id == agent.user_id)
                .where(
                    Ticket.status.in_(
                        [
                            TicketStatus.OPEN,
                            TicketStatus.IN_PROGRESS,
                            TicketStatus.WAITING,
                        ]
                    )
                )
            )

            if tenant_id:
                workload_query = workload_query.where(Ticket.tenant_id == tenant_id)

            workload_result = await self.session.execute(workload_query)
            workload = workload_result.scalar() or 0

            agent_workloads.append(
                (agent.user_id, workload, agent.last_activity_at),
            )

        # Sort by workload (ascending), then by last_activity_at (ascending) for round-robin
        agent_workloads.sort(key=lambda item: (item[1], item[2] or datetime.min))

        selected_agent_id = agent_workloads[0][0]

        # Update the ticket assignment
        ticket_query = select(Ticket).where(Ticket.id == ticket_id)
        ticket_result = await self.session.execute(ticket_query)
        ticket = ticket_result.scalar_one_or_none()

        if not ticket:
            logger.error("assignment.ticket_not_found", ticket_id=str(ticket_id))
            return None

        ticket.assigned_to_user_id = selected_agent_id
        ticket.updated_at = datetime.utcnow()

        # Update agent's last_activity_at to ensure round-robin rotation
        agent_query = select(AgentAvailability).where(
            AgentAvailability.user_id == selected_agent_id
        )
        agent_result = await self.session.execute(agent_query)
        selected_agent: AgentAvailability | None = agent_result.scalar_one_or_none()

        if selected_agent:
            selected_agent.last_activity_at = datetime.utcnow()

        await self.session.commit()

        logger.info(
            "assignment.ticket_assigned",
            ticket_id=str(ticket_id),
            agent_id=str(selected_agent_id),
            workload=agent_workloads[0][1],
        )

        return selected_agent_id

    async def get_agent_workload(
        self,
        agent_id: UUID,
        tenant_id: str | None = None,
    ) -> int:
        """Get current workload (active tickets) for an agent.

        Args:
            agent_id: Agent user ID
            tenant_id: Optional tenant filter

        Returns:
            Number of active tickets
        """
        query = (
            select(func.count(Ticket.id))
            .where(Ticket.assigned_to_user_id == agent_id)
            .where(
                Ticket.status.in_(
                    [
                        TicketStatus.OPEN,
                        TicketStatus.IN_PROGRESS,
                        TicketStatus.WAITING,
                    ]
                )
            )
        )

        if tenant_id:
            query = query.where(Ticket.tenant_id == tenant_id)

        result = await self.session.execute(query)
        return result.scalar() or 0

    async def get_available_agent_count(self, tenant_id: str | None = None) -> int:
        """Get count of available agents.

        Args:
            tenant_id: Optional tenant filter

        Returns:
            Number of available agents
        """
        query = select(func.count(AgentAvailability.id)).where(
            AgentAvailability.status == AgentStatus.AVAILABLE
        )

        if tenant_id:
            query = query.where(AgentAvailability.tenant_id == tenant_id)

        result = await self.session.execute(query)
        return result.scalar() or 0


__all__ = ["TicketAssignmentService"]
