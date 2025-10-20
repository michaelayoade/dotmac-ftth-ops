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
from pydantic import BaseModel

from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.platform_admin import is_platform_admin
from dotmac.platform.monitoring.alert_webhook_router import (
    AlertChannel,
    AlertmanagerWebhook,
    ChannelType,
    get_alert_router,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/alerts", tags=["Alert Management"])


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

    alert_router = get_alert_router()
    alert_router.add_channel(channel)

    logger.info(
        "Alert channel created",
        channel_id=channel.id,
        channel_name=channel.name,
        created_by=current_user.username,
    )

    return AlertChannelResponse(
        id=channel.id,
        name=channel.name,
        channel_type=channel.channel_type,
        enabled=channel.enabled,
        tenant_id=channel.tenant_id,
        severities=[s.value for s in channel.severities] if channel.severities else None,
        alert_names=channel.alert_names,
        alert_categories=channel.alert_categories,
    )


@router.get("/channels")
async def list_alert_channels(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> list[AlertChannelResponse]:
    """
    List all configured alert channels.

    Requires authentication.
    """
    alert_router = get_alert_router()

    return [
        AlertChannelResponse(
            id=channel.id,
            name=channel.name,
            channel_type=channel.channel_type,
            enabled=channel.enabled,
            tenant_id=channel.tenant_id,
            severities=[s.value for s in channel.severities] if channel.severities else None,
            alert_names=channel.alert_names,
            alert_categories=channel.alert_categories,
        )
        for channel in alert_router.channels.values()
    ]


@router.get("/channels/{channel_id}")
async def get_alert_channel(
    channel_id: str,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> AlertChannelResponse:
    """
    Get details of a specific alert channel.

    Requires authentication.
    """
    alert_router = get_alert_router()

    if channel_id not in alert_router.channels:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert channel {channel_id} not found",
        )

    channel = alert_router.channels[channel_id]

    return AlertChannelResponse(
        id=channel.id,
        name=channel.name,
        channel_type=channel.channel_type,
        enabled=channel.enabled,
        tenant_id=channel.tenant_id,
        severities=[s.value for s in channel.severities] if channel.severities else None,
        alert_names=channel.alert_names,
        alert_categories=channel.alert_categories,
    )


@router.patch("/channels/{channel_id}")
async def update_alert_channel(
    channel_id: str,
    channel_update: AlertChannel,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
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

    alert_router = get_alert_router()

    if channel_id not in alert_router.channels:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert channel {channel_id} not found",
        )

    # Update channel
    channel_update.id = channel_id  # Ensure ID matches
    alert_router.add_channel(channel_update)

    logger.info(
        "Alert channel updated",
        channel_id=channel_id,
        updated_by=current_user.username,
    )

    return AlertChannelResponse(
        id=channel_update.id,
        name=channel_update.name,
        channel_type=channel_update.channel_type,
        enabled=channel_update.enabled,
        tenant_id=channel_update.tenant_id,
        severities=[s.value for s in channel_update.severities] if channel_update.severities else None,
        alert_names=channel_update.alert_names,
        alert_categories=channel_update.alert_categories,
    )


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_channel(
    channel_id: str,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
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

    alert_router = get_alert_router()

    if channel_id not in alert_router.channels:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert channel {channel_id} not found",
        )

    alert_router.remove_channel(channel_id)

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
) -> dict[str, bool]:
    """
    Send a test alert to a specific channel.

    Useful for testing webhook configurations.
    """
    alert_router = get_alert_router()

    if request.channel_id not in alert_router.channels:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert channel {request.channel_id} not found",
        )

    channel = alert_router.channels[request.channel_id]

    # Create test alert
    from dotmac.platform.monitoring.alert_webhook_router import Alert

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
