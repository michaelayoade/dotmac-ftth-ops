"""
FastAPI dependencies for ticketing services.
"""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import get_session_dependency

from .service import TicketService


async def get_ticket_service(
    session: AsyncSession = Depends(get_session_dependency),
) -> TicketService:
    """Resolve a TicketService instance scoped to the request session."""
    return TicketService(session)


__all__ = ["get_ticket_service"]
