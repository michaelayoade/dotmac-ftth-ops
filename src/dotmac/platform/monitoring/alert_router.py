"""
Alert Management API Router.

Provides endpoints to:
1. Receive webhooks from Alertmanager
2. Configure alert channels dynamically
3. Test alert routing
4. View alert history
"""

from __future__ import annotations

import secrets
from datetime import datetime
from time import time
from typing import Annotated

import structlog
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.platform_admin import is_platform_admin
from dotmac.platform.core.caching import get_redis
from dotmac.platform.db import get_async_session
from dotmac.platform.monitoring.alert_webhook_router import (
    Alert,
    AlertChannel,
    AlertmanagerWebhook,
    ChannelType,
    cache_channels,
    get_alert_router,
)
from dotmac.platform.monitoring.models import MonitoringAlertChannel
from dotmac.platform.monitoring.plugins import get_plugin, register_builtin_plugins
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)

register_builtin_plugins()

router = APIRouter(prefix="/alerts", tags=["Alert Management"])

_local_rate_counters: dict[str, tuple[int, float]] = {}


def _parse_rate_limit_config(config: str) -> tuple[int, int]:
    try:
        # Support both "15/minute" and "15 per minute" formats
        if "/" in config:
            count_str, window_str = config.split("/", 1)
        elif " per " in config.lower():
            parts = config.lower().split(" per ", 1)
            count_str, window_str = parts[0], parts[1]
        else:
            # Try splitting by space for formats like "15 minute"
            parts = config.split(None, 1)
            if len(parts) == 2:
                count_str, window_str = parts
            else:
                return 120, 60
        max_requests = int(count_str.strip())
    except Exception:
        return 120, 60

    unit = window_str.strip().lower()
    if unit.startswith("per"):
        unit = unit[3:].strip()

    if unit in {"s", "sec", "second", "seconds"}:
        return max_requests, 1
    if unit in {"m", "min", "minute", "minutes"}:
        return max_requests, 60
    if unit in {"h", "hour", "hours"}:
        return max_requests, 3600
    if unit in {"d", "day", "days"}:
        return max_requests, 86400
    return max_requests, 60


def _enforce_alertmanager_rate_limit(request: Request) -> None:
    config = getattr(settings.observability, "alertmanager_rate_limit", "120/minute")
    max_requests, window_seconds = _parse_rate_limit_config(config)
    client_ip = request.client.host if request.client else "unknown"
    cache_key = f"alertmanager:webhook:{client_ip}"

    redis_client = None
    try:
        redis_client = get_redis()
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.debug("alertmanager.webhook.rate_limit.redis_unavailable", error=str(exc))

    if redis_client is not None:
        try:
            count = redis_client.incr(cache_key)
            if count == 1:
                redis_client.expire(cache_key, window_seconds)
            if count > max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Alertmanager webhook rate limit exceeded",
                )
            return
        except HTTPException:
            raise
        except Exception as exc:  # pragma: no cover - redis failure fallback
            logger.debug("alertmanager.webhook.rate_limit.redis_error", error=str(exc))

    now = time()
    count, expiry = _local_rate_counters.get(cache_key, (0, now + window_seconds))
    if expiry <= now:
        _local_rate_counters[cache_key] = (1, now + window_seconds)
        return

    count += 1
    if count > max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Alertmanager webhook rate limit exceeded",
        )
    _local_rate_counters[cache_key] = (count, expiry)


# ==========================================
# Persistence helpers
# ==========================================


def _channel_to_response(channel: AlertChannel) -> AlertChannelResponse:
    """Convert channel configuration to API response."""
    severities = [severity.value for severity in channel.severities] if channel.severities else None
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


def _get_alertmanager_secret() -> str | None:
    return getattr(settings.observability, "alertmanager_webhook_secret", None)


async def _authenticate_alertmanager_webhook(
    request: Request,
    token_header: str | None = Header(default=None, alias="X-Alertmanager-Token"),
    authorization: str | None = Header(default=None),
) -> None:
    """Validate shared secret for Alertmanager webhook requests."""
    _enforce_alertmanager_rate_limit(request)
    secret = _get_alertmanager_secret()
    if not secret:
        logger.error(
            "alertmanager.webhook.secret_missing",
            path=str(request.url),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Alertmanager webhook secret is not configured",
        )

    candidate = None
    if token_header:
        candidate = token_header.strip()
    elif authorization:
        if authorization.lower().startswith("bearer "):
            candidate = authorization[7:].strip()
    if candidate is None:
        candidate = request.query_params.get("token")

    if not candidate or not secrets.compare_digest(candidate, secret):
        logger.warning(
            "alertmanager.webhook.auth_failed",
            client=request.client.host if request.client else None,
            path=str(request.url),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Alertmanager webhook token",
        )


@router.post("/webhook", status_code=status.HTTP_202_ACCEPTED)
async def receive_alertmanager_webhook(
    payload: Annotated[AlertmanagerWebhook, Body(embed=False)],
    _: None = Depends(_authenticate_alertmanager_webhook),
) -> WebhookProcessingResult:
    """
    Receive webhook from Prometheus Alertmanager.

    This endpoint should be configured in Alertmanager as a webhook receiver.
    It will route alerts to configured channels based on severity, tenant, etc.

    Authentication: requires shared secret via `X-Alertmanager-Token` header,
    `Authorization: Bearer` token, or `token` query parameter.
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

    delete_result = await session.execute(
        delete(MonitoringAlertChannel).where(MonitoringAlertChannel.id == channel_id)
    )
    rowcount = (
        delete_result.rowcount
        if isinstance(delete_result, CursorResult)
        else getattr(delete_result, "rowcount", 0)
    )
    if not rowcount:
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
            "tenant_id": current_user.tenant_id or "system",
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
