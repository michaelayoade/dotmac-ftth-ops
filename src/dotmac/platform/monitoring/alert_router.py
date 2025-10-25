"""
Alert Management API Router.

Provides endpoints to:
1. Receive webhooks from Alertmanager
2. Configure alert channels dynamically
3. Test alert routing
4. View alert history
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.platform_admin import is_platform_admin
from dotmac.platform.db import get_async_session
from dotmac.platform.monitoring.alert_webhook_router import (
    Alert,
    AlertChannel,
    AlertmanagerWebhook,
    ChannelType,
    cache_channels,
    get_alert_router,
)
from dotmac.platform.monitoring.plugins import get_plugin, register_builtin_plugins
from dotmac.platform.monitoring.models import MonitoringAlertChannel

logger = structlog.get_logger(__name__)

register_builtin_plugins()

router = APIRouter(prefix="/alerts", tags=["Alert Management"])


# ==========================================
# Persistence helpers
# ==========================================


def _channel_to_response(channel: AlertChannel) -> "AlertChannelResponse":
    """Convert channel configuration to API response."""
    severities = (
        [severity.value for severity in channel.severities] if channel.severities else None
    )
    return AlertChannelResponse(
        id=channel.id,
        name=channel.name,
        channel_type=channel.channel_type,
        enabled=channel.enabled,
        tenant_id=channel.tenant_id,
        severities=severities,
        alert_names=channel.alert_names,
        alert_categories=channel.alert_categories,
    )


def _model_to_channel(model: MonitoringAlertChannel) -> AlertChannel:
    """Rehydrate AlertChannel from database row."""
    payload = dict(model.config or {})
    # Ensure critical fields match the persisted row
    payload.update(
        {
            "id": model.id,
            "name": model.name,
            "channel_type": model.channel_type,
            "enabled": model.enabled,
            "tenant_id": model.tenant_id,
        }
    )
    return AlertChannel(**payload)


async def _fetch_all_channels(session: AsyncSession) -> list[AlertChannel]:
    result = await session.execute(select(MonitoringAlertChannel))
    models = result.scalars().all()
    return [_model_to_channel(model) for model in models]


async def _refresh_channel_state(session: AsyncSession) -> None:
    """
    Refresh in-memory and Redis caches with latest channel configuration.

    This should be invoked after any mutating operation.
    """
    channels = await _fetch_all_channels(session)
    router_instance = get_alert_router()
    router_instance.replace_channels(channels)
    cache_channels(list(router_instance.channels.values()))


async def _ensure_channel_state(session: AsyncSession) -> None:
    """
    Ensure the in-memory router has data, lazily loading from persistence when empty.
    """
    router_instance = get_alert_router()
    if router_instance.channels:
        return

    channels = await _fetch_all_channels(session)
    if channels:
        router_instance.replace_channels(channels)
        cache_channels(list(router_instance.channels.values()))


async def _get_channel_model_for_user(
    session: AsyncSession,
    channel_id: str,
    current_user: UserInfo,
) -> MonitoringAlertChannel:
    """Fetch channel ensuring the caller has permission to view it."""
    model = await session.get(MonitoringAlertChannel, channel_id)
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert channel {channel_id} not found",
        )

    if not is_platform_admin(current_user):
        if not current_user.tenant_id or model.tenant_id != current_user.tenant_id:
            logger.warning(
                "Unauthorized alert channel access attempt",
                channel_id=channel_id,
                user_id=current_user.user_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to access alert channel",
            )
    return model


# ==========================================
# Response Models
# ==========================================


class AlertChannelResponse(BaseModel):
    """Response model for alert channel."""

    id: str
    name: str
    channel_type: ChannelType
    enabled: bool
    tenant_id: str | None
    severities: list[str] | None
    alert_names: list[str] | None
    alert_categories: list[str] | None


class AlertRoutingResult(BaseModel):
    """Result of routing an alert."""

    alert_fingerprint: str
    channels_notified: int
    channels_failed: int
    results: dict[str, bool]


class WebhookProcessingResult(BaseModel):
    """Result of processing Alertmanager webhook."""

    alerts_processed: int
    total_channels_notified: int
    results: dict[str, dict[str, bool]]


# ==========================================
# Webhook Endpoint (for Alertmanager)
# ==========================================


@router.post("/webhook", status_code=status.HTTP_202_ACCEPTED)
async def receive_alertmanager_webhook(
    payload: AlertmanagerWebhook,
) -> WebhookProcessingResult:
    """
    Receive webhook from Prometheus Alertmanager.

    This endpoint should be configured in Alertmanager as a webhook receiver.
    It will route alerts to configured channels based on severity, tenant, etc.

    **No authentication required** - Alertmanager doesn't support auth headers.
    Consider using network-level security or API key in URL query param if needed.
    """
    logger.info(
        "Received Alertmanager webhook",
        num_alerts=len(payload.alerts),
        status=payload.status,
        receiver=payload.receiver,
    )

    # Get router and process alerts
    alert_router = get_alert_router()
    results = await alert_router.process_alertmanager_webhook(payload)

    # Calculate stats
    total_channels = sum(len(r) for r in results.values())
    alerts_processed = len(results)

    return WebhookProcessingResult(
        alerts_processed=alerts_processed,
        total_channels_notified=total_channels,
        results=results,
    )


# ==========================================
# Channel Management Endpoints
# ==========================================


@router.post("/channels", status_code=status.HTTP_201_CREATED)
async def create_alert_channel(
    channel: AlertChannel,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> AlertChannelResponse:
    """
    Create a new alert notification channel.

    Requires authentication. Only platform admins can create channels.
    """
    # Check platform admin permission
    if not is_platform_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrator access required to create alert channels",
        )

    # Validate via plugin registry
    plugin = get_plugin(channel.channel_type.value)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No alert plugin registered for channel type '{channel.channel_type.value}'",
        )
    try:
        plugin.validate(channel)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid channel configuration: {exc}",
        ) from exc

    # Prevent accidental overwrites
    existing = await session.get(MonitoringAlertChannel, channel.id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Alert channel {channel.id} already exists",
        )

    tenant_id = channel.tenant_id or current_user.tenant_id
    payload = channel.model_dump(mode="json")
    payload["tenant_id"] = tenant_id

    model = MonitoringAlertChannel(
        id=channel.id,
        name=channel.name,
        channel_type=channel.channel_type.value,
        enabled=channel.enabled,
        tenant_id=tenant_id,
        config=payload,
        created_by=current_user.user_id,
        updated_by=current_user.user_id,
    )

    session.add(model)
    await session.commit()

    await _refresh_channel_state(session)

    logger.info(
        "Alert channel created",
        channel_id=channel.id,
        channel_name=channel.name,
        created_by=current_user.username,
    )

    created_channel = _model_to_channel(model)
    return _channel_to_response(created_channel)


@router.get("/channels")
async def list_alert_channels(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> list[AlertChannelResponse]:
    """
    List all configured alert channels.

    Requires authentication.
    """
    await _ensure_channel_state(session)

    stmt = select(MonitoringAlertChannel)
    if not is_platform_admin(current_user):
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant context required to list alert channels",
            )
        stmt = stmt.where(MonitoringAlertChannel.tenant_id == current_user.tenant_id)

    result = await session.execute(stmt)
    models = result.scalars().all()
    channels = [_model_to_channel(model) for model in models]
    return [_channel_to_response(channel) for channel in channels]


@router.get("/channels/{channel_id}")
async def get_alert_channel(
    channel_id: str,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> AlertChannelResponse:
    """
    Get details of a specific alert channel.

    Requires authentication.
    """
    await _ensure_channel_state(session)

    model = await _get_channel_model_for_user(session, channel_id, current_user)
    channel = _model_to_channel(model)
    return _channel_to_response(channel)


@router.patch("/channels/{channel_id}")
async def update_alert_channel(
    channel_id: str,
    channel_update: AlertChannel,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> AlertChannelResponse:
    """
    Update an alert channel.

    Requires authentication. Only platform admins can update channels.
    """
    # Check platform admin permission
    if not is_platform_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrator access required to update alert channels",
        )

    model = await session.get(MonitoringAlertChannel, channel_id)
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert channel {channel_id} not found",
        )

    channel_update.id = channel_id

    plugin = get_plugin(channel_update.channel_type.value)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No alert plugin registered for channel type '{channel_update.channel_type.value}'",
        )
    try:
        plugin.validate(channel_update)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid channel configuration: {exc}",
        ) from exc

    tenant_id = channel_update.tenant_id or model.tenant_id or current_user.tenant_id
    payload = channel_update.model_dump(mode="json")
    payload["tenant_id"] = tenant_id

    model.name = channel_update.name
    model.channel_type = channel_update.channel_type.value
    model.enabled = channel_update.enabled
    model.tenant_id = tenant_id
    model.config = payload
    model.updated_by = current_user.user_id

    await session.commit()

    await _refresh_channel_state(session)

    logger.info(
        "Alert channel updated",
        channel_id=channel_id,
        updated_by=current_user.username,
    )

    updated_channel = _model_to_channel(model)
    return _channel_to_response(updated_channel)


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_channel(
    channel_id: str,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> None:
    """
    Delete an alert channel.

    Requires authentication. Only platform admins can delete channels.
    """
    # Check platform admin permission
    if not is_platform_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrator access required to delete alert channels",
        )

    deleted = await session.execute(
        delete(MonitoringAlertChannel).where(MonitoringAlertChannel.id == channel_id)
    )
    if deleted.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert channel {channel_id} not found",
        )

    await session.commit()
    await _refresh_channel_state(session)

    logger.info(
        "Alert channel deleted",
        channel_id=channel_id,
        deleted_by=current_user.username,
    )


# ==========================================
# Testing Endpoints
# ==========================================


class TestAlertRequest(BaseModel):
    """Request to send a test alert."""

    channel_id: str
    severity: str = "warning"
    message: str = "Test alert from DotMac monitoring"


@router.post("/test")
async def send_test_alert(
    request: TestAlertRequest,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> dict[str, bool]:
    """
    Send a test alert to a specific channel.

    Useful for testing webhook configurations.
    """
    if not is_platform_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrator access required to test alert channels",
        )

    model = await session.get(MonitoringAlertChannel, request.channel_id)
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert channel {request.channel_id} not found",
        )

    channel = _model_to_channel(model)

    await _ensure_channel_state(session)

    alert_router = get_alert_router()
    # Ensure latest channel in router cache
    alert_router.channels[channel.id] = channel

    # Create test alert
    test_alert = Alert(
        status="firing",
        labels={
            "alertname": "TestAlert",
            "severity": request.severity,
            "tenant_id": current_user.tenant_id,
            "instance": "test",
        },
        annotations={
            "summary": "Test Alert",
            "description": request.message,
        },
        startsAt=f"{datetime.utcnow().isoformat()}Z",
        fingerprint="test-alert",
    )

    # Send to channel
    result = await alert_router.send_to_channel(test_alert, channel)

    logger.info(
        "Test alert sent",
        channel_id=request.channel_id,
        result=result,
        tested_by=current_user.username,
    )

    return {channel.id: result}


# ==========================================
# Exports
# ==========================================

__all__ = ["router"]
