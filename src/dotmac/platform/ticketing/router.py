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

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.tenant import get_current_tenant_id

from .dependencies import get_ticket_service
from .models import TicketStatus
from .schemas import (
    TicketCreate,
    TicketDetail,
    TicketMessageCreate,
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

router = APIRouter(prefix="/api/v1/tickets", tags=["Ticketing"])


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
    service: TicketService = Depends(get_ticket_service),
    current_user: UserInfo = Depends(get_current_user),
) -> Sequence[TicketSummary]:
    """List tickets scoped to the current actor."""
    tenant_id = get_current_tenant_id()
    try:
        tickets = await service.list_tickets(
            current_user=current_user,
            tenant_id=tenant_id,
            status=status_filter,
            include_messages=False,
        )
        return [TicketSummary.model_validate(ticket, from_attributes=True) for ticket in tickets]
    except Exception as exc:  # pragma: no cover
        logger.warning("ticket.list.failed", error=str(exc))
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


__all__ = ["router"]
