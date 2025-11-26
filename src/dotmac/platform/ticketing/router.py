"""
Ticketing API endpoints.

Enables structured support ticket workflows across customers, tenant teams,
partners, and platform administrators.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import NoReturn
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.database import get_session
from dotmac.platform.tenant import get_current_tenant_id

from .assignment_service import TicketAssignmentService
from .dependencies import get_ticket_service
from .models import TicketStatus
from .schemas import (
    AgentPerformanceMetrics,
    TicketCountStats,
    TicketCreate,
    TicketDetail,
    TicketMessageCreate,
    TicketMessageResponse,
    TicketPriority,
    TicketStats,
    TicketSummary,
    TicketUpdate,
)
from .service import (
    TicketAccessDeniedError,
    TicketNotFoundError,
    TicketService,
    TicketValidationError,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/tickets", tags=["Ticketing"])


def _handle_ticket_error(exc: Exception) -> NoReturn:
    """Transform service exceptions into HTTP errors."""
    if isinstance(exc, TicketValidationError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if isinstance(exc, TicketAccessDeniedError):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if isinstance(exc, TicketNotFoundError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    raise HTTPException(
        status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ticketing operation failed"
    ) from exc


@router.post(
    "/",
    response_model=TicketDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a support ticket",
)
async def create_ticket(
    payload: TicketCreate,
    service: TicketService = Depends(get_ticket_service),
    current_user: UserInfo = Depends(get_current_user),
) -> TicketDetail:
    """Create a new ticket and persist the initial message."""
    tenant_id = get_current_tenant_id()
    try:
        ticket = await service.create_ticket(payload, current_user, tenant_id)
        return TicketDetail.model_validate(ticket, from_attributes=True)
    except Exception as exc:  # pragma: no cover - mapped below
        logger.warning("ticket.create.failed", error=str(exc))
        _handle_ticket_error(exc)


@router.get(
    "/",
    response_model=list[TicketSummary],
    summary="List tickets visible to the current actor",
)
async def list_tickets(
    status_filter: TicketStatus | None = Query(
        None,
        alias="status",
        description="Optional status filter (open, in_progress, waiting, resolved, closed).",
    ),
    priority: str | None = Query(
        None,
        description="Optional priority filter (low, normal, high, urgent). 'medium' is accepted as 'normal'.",
    ),
    search: str | None = Query(
        None,
        min_length=2,
        description="Search across ticket number or subject (case-insensitive).",
    ),
    service: TicketService = Depends(get_ticket_service),
    current_user: UserInfo = Depends(get_current_user),
) -> Sequence[TicketSummary]:
    """List tickets scoped to the current actor."""
    tenant_id = get_current_tenant_id()

    priority_filter: TicketPriority | None = None
    if priority:
        try:
            priority_filter = TicketPriority(priority)
        except ValueError:
            if priority.lower() == "medium":
                priority_filter = TicketPriority.NORMAL
            else:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="Invalid priority value. Expected one of: low, normal, high, urgent.",
                )

    search_value = search.strip() if search else None
    try:
        tickets = await service.list_tickets(
            current_user=current_user,
            tenant_id=tenant_id,
            status=status_filter,
            priority=priority_filter,
            search=search_value,
            include_messages=False,
        )
        return [TicketSummary.model_validate(ticket, from_attributes=True) for ticket in tickets]
    except Exception as exc:  # pragma: no cover
        logger.warning("ticket.list.failed", error=str(exc))
        _handle_ticket_error(exc)


@router.post(
    "/{ticket_id}/messages",
    response_model=TicketDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Append a message to a ticket",
)
async def add_ticket_message(
    ticket_id: UUID,
    payload: TicketMessageCreate,
    service: TicketService = Depends(get_ticket_service),
    current_user: UserInfo = Depends(get_current_user),
) -> TicketDetail:
    """Append a new message to an existing ticket."""
    tenant_id = get_current_tenant_id()
    try:
        ticket = await service.add_message(ticket_id, payload, current_user, tenant_id)
        return TicketDetail.model_validate(ticket, from_attributes=True)
    except Exception as exc:  # pragma: no cover
        logger.warning("ticket.message.failed", ticket_id=str(ticket_id), error=str(exc))
        _handle_ticket_error(exc)


@router.get(
    "/{ticket_id}/messages",
    response_model=list[TicketMessageResponse],
    summary="List messages for a ticket",
)
async def list_ticket_messages(
    ticket_id: UUID,
    service: TicketService = Depends(get_ticket_service),
    current_user: UserInfo = Depends(get_current_user),
) -> list[TicketMessageResponse]:
    """Return all messages for a ticket."""
    tenant_id = get_current_tenant_id()
    try:
        ticket = await service.get_ticket(ticket_id, current_user, tenant_id, include_messages=True)
        return [
            TicketMessageResponse.model_validate(m, from_attributes=True) for m in ticket.messages
        ]
    except Exception as exc:  # pragma: no cover
        logger.warning("ticket.messages.list.failed", ticket_id=str(ticket_id), error=str(exc))
        _handle_ticket_error(exc)


@router.get(
    "/stats",
    response_model=TicketCountStats,
    summary="Get ticket count statistics by status",
)
async def get_ticket_stats(
    service: TicketService = Depends(get_ticket_service),
    current_user: UserInfo = Depends(get_current_user),
) -> TicketCountStats:
    """Return counts of tickets by status for the current tenant/actor."""
    tenant_id = get_current_tenant_id()
    try:
        stats = await service.get_ticket_counts(current_user=current_user, tenant_id=tenant_id)
        return TicketCountStats.model_validate(stats)
    except Exception as exc:  # pragma: no cover
        logger.warning("ticket.stats.failed", error=str(exc))
        _handle_ticket_error(exc)


@router.get(
    "/metrics",
    response_model=TicketStats,
    summary="Get aggregated ticket metrics",
)
async def get_ticket_metrics(
    service: TicketService = Depends(get_ticket_service),
    current_user: UserInfo = Depends(get_current_user),
) -> TicketStats:
    """Aggregated counts grouped by status, priority, and type with SLA breaches."""
    tenant_id = get_current_tenant_id()
    try:
        metrics = await service.get_ticket_metrics(current_user=current_user, tenant_id=tenant_id)
        return TicketStats.model_validate(metrics)
    except Exception as exc:  # pragma: no cover
        logger.warning("ticket.metrics.failed", error=str(exc))
        _handle_ticket_error(exc)


@router.get(
    "/{ticket_id}",
    response_model=TicketDetail,
    summary="Retrieve ticket details",
)
async def get_ticket(
    ticket_id: UUID = Path(..., description="Ticket identifier"),
    service: TicketService = Depends(get_ticket_service),
    current_user: UserInfo = Depends(get_current_user),
) -> TicketDetail:
    """Fetch ticket details and threaded messages."""
    tenant_id = get_current_tenant_id()
    try:
        ticket = await service.get_ticket(ticket_id, current_user, tenant_id, include_messages=True)
        return TicketDetail.model_validate(ticket, from_attributes=True)
    except Exception as exc:  # pragma: no cover
        logger.warning("ticket.get.failed", ticket_id=str(ticket_id), error=str(exc))
        _handle_ticket_error(exc)


@router.patch(
    "/{ticket_id}",
    response_model=TicketDetail,
    summary="Update ticket metadata",
)
async def update_ticket(
    ticket_id: UUID,
    payload: TicketUpdate,
    service: TicketService = Depends(get_ticket_service),
    current_user: UserInfo = Depends(get_current_user),
) -> TicketDetail:
    """Update ticket status, priority, assignee, or metadata."""
    tenant_id = get_current_tenant_id()
    try:
        ticket = await service.update_ticket(ticket_id, payload, current_user, tenant_id)
        return TicketDetail.model_validate(ticket, from_attributes=True)
    except Exception as exc:  # pragma: no cover
        logger.warning("ticket.update.failed", ticket_id=str(ticket_id), error=str(exc))
        _handle_ticket_error(exc)


@router.get(
    "/agents/performance",
    response_model=list[AgentPerformanceMetrics],
    summary="Get agent performance metrics",
)
async def get_agent_performance(
    start_date: str | None = Query(None, description="Start date for metrics (ISO format)"),
    end_date: str | None = Query(None, description="End date for metrics (ISO format)"),
    service: TicketService = Depends(get_ticket_service),
    current_user: UserInfo = Depends(get_current_user),
) -> list[AgentPerformanceMetrics]:
    """Get performance metrics for all agents (assigned users)."""
    tenant_id = get_current_tenant_id()
    try:
        metrics = await service.get_agent_performance(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
        )
        return metrics
    except Exception as exc:  # pragma: no cover
        logger.warning("agent.performance.failed", error=str(exc))
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve agent performance metrics",
        ) from exc


@router.post(
    "/{ticket_id}/assign/auto",
    response_model=TicketDetail,
    summary="Automatically assign ticket to available agent",
)
async def auto_assign_ticket(
    ticket_id: UUID,
    session: AsyncSession = Depends(get_session),
    service: TicketService = Depends(get_ticket_service),
    current_user: UserInfo = Depends(get_current_user),
) -> TicketDetail:
    """Automatically assign a ticket using round-robin with load balancing."""
    tenant_id = get_current_tenant_id()
    try:
        # Verify ticket exists and user has access
        await service.get_ticket(ticket_id, current_user, tenant_id, include_messages=False)

        # Use assignment service to auto-assign
        assignment_service = TicketAssignmentService(session)
        assigned_agent_id = await assignment_service.assign_ticket_automatically(
            ticket_id=ticket_id,
            tenant_id=tenant_id,
        )

        if not assigned_agent_id:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No available agents to assign ticket",
            )

        # Fetch updated ticket with messages
        updated_ticket = await service.get_ticket(
            ticket_id, current_user, tenant_id, include_messages=True
        )
        return TicketDetail.model_validate(updated_ticket, from_attributes=True)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.warning("ticket.auto_assign.failed", ticket_id=str(ticket_id), error=str(exc))
        _handle_ticket_error(exc)


__all__ = ["router"]
