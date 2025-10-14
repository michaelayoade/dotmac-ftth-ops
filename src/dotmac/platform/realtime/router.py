"""
Real-Time API Router

FastAPI endpoints for SSE streams and WebSocket connections.
"""

from fastapi import APIRouter, Depends, WebSocket
from redis.asyncio import Redis

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.realtime.sse import (
    create_alert_stream,
    create_onu_status_stream,
    create_subscriber_stream,
    create_ticket_stream,
)
from dotmac.platform.realtime.websocket import (
    handle_campaign_ws,
    handle_job_ws,
    handle_sessions_ws,
)

router = APIRouter(prefix="/api/v1/realtime", tags=["realtime"])


# =============================================================================
# Dependency: Get Redis Client
# =============================================================================


async def get_redis_client() -> Redis:
    """
    Get Redis client for pub/sub.

    TODO: Inject actual Redis client from app state or dependency.
    For now, create a connection using default settings.
    """
    # This should be replaced with proper dependency injection
    # from app.state.redis or a Redis connection pool
    redis = Redis(
        host="localhost",
        port=6379,
        password="change-me-in-production",
        decode_responses=False,
    )
    try:
        yield redis
    finally:
        await redis.close()


# =============================================================================
# SSE Endpoints (Server-Sent Events)
# =============================================================================


@router.get(
    "/onu-status",
    summary="Stream ONU Status Updates",
    description="Server-Sent Events stream for real-time ONU status changes",
)
async def stream_onu_status(
    redis: Redis = Depends(get_redis_client),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    Stream ONU status events via SSE.

    Events include:
    - ONU online/offline transitions
    - Signal quality degradation
    - Device provisioning/deprovisioning

    The connection stays open and pushes events as they occur.
    """
    return await create_onu_status_stream(redis, current_user.tenant_id)


@router.get(
    "/alerts",
    summary="Stream Network Alerts",
    description="Server-Sent Events stream for network and system alerts",
)
async def stream_alerts(
    redis: Redis = Depends(get_redis_client),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    Stream alert events via SSE.

    Events include:
    - Signal degradation alerts
    - Device offline alerts
    - Critical system alerts

    The connection stays open and pushes events as they occur.
    """
    return await create_alert_stream(redis, current_user.tenant_id)


@router.get(
    "/tickets",
    summary="Stream Ticket Updates",
    description="Server-Sent Events stream for ticket lifecycle events",
)
async def stream_tickets(
    redis: Redis = Depends(get_redis_client),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    Stream ticket events via SSE.

    Events include:
    - New ticket created
    - Ticket assigned
    - Ticket updated
    - Ticket resolved

    The connection stays open and pushes events as they occur.
    """
    return await create_ticket_stream(redis, current_user.tenant_id)


@router.get(
    "/subscribers",
    summary="Stream Subscriber Events",
    description="Server-Sent Events stream for subscriber lifecycle events",
)
async def stream_subscribers(
    redis: Redis = Depends(get_redis_client),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    Stream subscriber lifecycle events via SSE.

    Events include:
    - Subscriber created
    - Subscriber activated
    - Subscriber suspended
    - Subscriber terminated

    The connection stays open and pushes events as they occur.
    """
    return await create_subscriber_stream(redis, current_user.tenant_id)


# =============================================================================
# WebSocket Endpoints
# =============================================================================


@router.websocket("/ws/sessions")
async def websocket_sessions(
    websocket: WebSocket,
    redis: Redis = Depends(get_redis_client),
):
    """
    WebSocket endpoint for RADIUS session updates.

    Streams real-time session events:
    - Session started (user login)
    - Session updated (interim accounting)
    - Session stopped (user logout)

    Authentication is handled via query parameters or initial message.
    """
    # TODO: Extract tenant_id from WebSocket auth
    # For now, accept connection and handle auth in handler
    tenant_id = "default"  # Replace with actual tenant extraction
    await handle_sessions_ws(websocket, tenant_id, redis)


@router.websocket("/ws/jobs/{job_id}")
async def websocket_job_progress(
    websocket: WebSocket,
    job_id: str,
    redis: Redis = Depends(get_redis_client),
):
    """
    WebSocket endpoint for job progress monitoring.

    Streams real-time job updates:
    - Job created
    - Progress updates
    - Job completed/failed

    Supports bidirectional communication for job control (pause, cancel).
    """
    # TODO: Extract tenant_id from WebSocket auth
    tenant_id = "default"  # Replace with actual tenant extraction
    await handle_job_ws(websocket, job_id, tenant_id, redis)


@router.websocket("/ws/campaigns/{campaign_id}")
async def websocket_campaign_progress(
    websocket: WebSocket,
    campaign_id: str,
    redis: Redis = Depends(get_redis_client),
):
    """
    WebSocket endpoint for firmware campaign monitoring.

    Streams real-time campaign updates:
    - Campaign started
    - Device-by-device progress
    - Campaign completed

    Supports bidirectional communication for campaign control (pause, resume).
    """
    # TODO: Extract tenant_id from WebSocket auth
    tenant_id = "default"  # Replace with actual tenant extraction
    await handle_campaign_ws(websocket, campaign_id, tenant_id, redis)
