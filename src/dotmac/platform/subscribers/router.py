"""Subscriber API router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_async_session
from dotmac.platform.subscribers.schemas import (
    SubscriberCreate,
    SubscriberListResponse,
    SubscriberResponse,
    SubscriberUpdate,
)
from dotmac.platform.subscribers.service import SubscriberService
from dotmac.platform.tenant import get_current_tenant_id

router = APIRouter(prefix="/subscribers", tags=["Subscribers"])


def get_subscriber_service(
    db: AsyncSession = Depends(get_async_session),
    tenant_id: str | None = Depends(get_current_tenant_id),
) -> SubscriberService:
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required",
        )
    return SubscriberService(db, tenant_id)


@router.get("", response_model=SubscriberListResponse)
async def list_subscribers(
    service: SubscriberService = Depends(get_subscriber_service),
    _: object = Depends(require_permission("subscribers.read")),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> SubscriberListResponse:
    return await service.list_subscribers(limit=limit, offset=offset)


@router.get("/{subscriber_id}", response_model=SubscriberResponse)
async def get_subscriber(
    subscriber_id: str,
    service: SubscriberService = Depends(get_subscriber_service),
    _: object = Depends(require_permission("subscribers.read")),
) -> SubscriberResponse:
    result = await service.get_subscriber(subscriber_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscriber not found")
    return result


@router.post("", response_model=SubscriberResponse, status_code=status.HTTP_201_CREATED)
async def create_subscriber(
    payload: SubscriberCreate,
    service: SubscriberService = Depends(get_subscriber_service),
    _: object = Depends(require_permission("subscribers.create")),
) -> SubscriberResponse:
    try:
        return await service.create_subscriber(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.put("/{subscriber_id}", response_model=SubscriberResponse)
async def update_subscriber(
    subscriber_id: str,
    payload: SubscriberUpdate,
    service: SubscriberService = Depends(get_subscriber_service),
    _: object = Depends(require_permission("subscribers.update")),
) -> SubscriberResponse:
    try:
        result = await service.update_subscriber(subscriber_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscriber not found")
    return result


@router.delete("/{subscriber_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subscriber(
    subscriber_id: str,
    service: SubscriberService = Depends(get_subscriber_service),
    _: object = Depends(require_permission("subscribers.delete")),
) -> None:
    deleted = await service.delete_subscriber(subscriber_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscriber not found")

