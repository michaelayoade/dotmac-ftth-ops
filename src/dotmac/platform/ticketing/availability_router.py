"""Agent availability management API endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.database import get_session
from dotmac.platform.tenant import get_current_tenant_id

from .availability_models import AgentAvailability, AgentStatus

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/tickets/agents", tags=["Agent Availability"])


class AgentStatusUpdate(BaseModel):
    """Payload for updating agent status."""

    status: AgentStatus
    status_message: str | None = Field(None, max_length=500)


class AgentAvailabilityRead(BaseModel):
    """Agent availability response."""

    user_id: UUID
    tenant_id: str | None
    status: AgentStatus
    status_message: str | None
    last_activity_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get(
    "/availability",
    response_model=list[AgentAvailabilityRead],
    summary="List all agents and their availability status",
)
async def list_agent_availability(
    session: AsyncSession = Depends(get_session),
    current_user: UserInfo = Depends(get_current_user),
) -> list[AgentAvailabilityRead]:
    """Get availability status for all agents in the tenant."""
    tenant_id = get_current_tenant_id()

    query = select(AgentAvailability)
    if tenant_id:
        query = query.where(AgentAvailability.tenant_id == tenant_id)

    result = await session.execute(query)
    availabilities = result.scalars().all()

    return [AgentAvailabilityRead.model_validate(a, from_attributes=True) for a in availabilities]


@router.get(
    "/availability/me",
    response_model=AgentAvailabilityRead,
    summary="Get current user's availability status",
)
async def get_my_availability(
    session: AsyncSession = Depends(get_session),
    current_user: UserInfo = Depends(get_current_user),
) -> AgentAvailabilityRead:
    """Get the current user's availability status."""
    tenant_id = get_current_tenant_id()

    query = select(AgentAvailability).where(AgentAvailability.user_id == current_user.user_id)
    result = await session.execute(query)
    availability = result.scalar_one_or_none()

    if not availability:
        # Create default availability record
        availability = AgentAvailability(
            user_id=current_user.user_id,
            tenant_id=tenant_id,
            status=AgentStatus.AVAILABLE,
            last_activity_at=datetime.utcnow(),
        )
        session.add(availability)
        await session.commit()
        await session.refresh(availability)

    return AgentAvailabilityRead.model_validate(availability, from_attributes=True)


@router.patch(
    "/availability/me",
    response_model=AgentAvailabilityRead,
    summary="Update current user's availability status",
)
async def update_my_availability(
    payload: AgentStatusUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: UserInfo = Depends(get_current_user),
) -> AgentAvailabilityRead:
    """Update the current user's availability status."""
    tenant_id = get_current_tenant_id()

    query = select(AgentAvailability).where(AgentAvailability.user_id == current_user.user_id)
    result = await session.execute(query)
    availability = result.scalar_one_or_none()

    if not availability:
        # Create new availability record
        availability = AgentAvailability(
            user_id=current_user.user_id,
            tenant_id=tenant_id,
            status=payload.status,
            status_message=payload.status_message,
            last_activity_at=datetime.utcnow(),
        )
        session.add(availability)
    else:
        # Update existing record
        availability.status = payload.status
        availability.status_message = payload.status_message
        availability.last_activity_at = datetime.utcnow()
        availability.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(availability)

    logger.info(
        "agent.availability.updated",
        user_id=str(current_user.user_id),
        status=payload.status.value,
    )

    return AgentAvailabilityRead.model_validate(availability, from_attributes=True)


@router.get(
    "/availability/{user_id}",
    response_model=AgentAvailabilityRead,
    summary="Get specific agent's availability status",
)
async def get_agent_availability(
    user_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: UserInfo = Depends(get_current_user),
) -> AgentAvailabilityRead:
    """Get availability status for a specific agent."""
    query = select(AgentAvailability).where(AgentAvailability.user_id == user_id)
    result = await session.execute(query)
    availability = result.scalar_one_or_none()

    if not availability:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No availability record found for user {user_id}",
        )

    return AgentAvailabilityRead.model_validate(availability, from_attributes=True)


__all__ = ["router"]
