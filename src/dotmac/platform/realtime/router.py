"""
Real-Time API Router

FastAPI endpoints for SSE streams and WebSocket connections.
"""

from fastapi import APIRouter, Depends, Request, WebSocket
from sse_starlette.sse import EventSourceResponse

from dotmac.platform.auth.core import (
    TokenType,
    UserInfo,
    _claims_to_user_info,
    _verify_token_with_fallback,
)
from dotmac.platform.auth.dependencies import get_current_user_optional
from dotmac.platform.realtime.sse import (
    create_alert_stream,
    create_onu_status_stream,
    create_radius_session_stream,
    create_subscriber_stream,
    create_ticket_stream,
)
from dotmac.platform.realtime.websocket_authenticated import (
    handle_campaign_ws_authenticated,
    handle_job_ws_authenticated,
    handle_sessions_ws_authenticated,
)
from dotmac.platform.redis_client import RedisClientType, get_redis_client

router = APIRouter(prefix="/realtime", tags=["Real-Time"])


# =============================================================================
# Note: Redis client dependency is now imported from redis_client module
# =============================================================================


# =============================================================================
# SSE Endpoints (Server-Sent Events)
# =============================================================================


@router.get(
    "/onu-status",
    summary="Stream ONU Status Updates",
    description="Server-Sent Events stream for real-time ONU status changes",
)
async def stream_onu_status(
    redis: RedisClientType = Depends(get_redis_client),
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> EventSourceResponse:
    """
    Stream ONU status events via SSE.

    Events include:
    - ONU online/offline transitions
    - Signal quality degradation
    - Device provisioning/deprovisioning

    The connection stays open and pushes events as they occur.
    """
    tenant_id = current_user.tenant_id if current_user else None
    response: EventSourceResponse = await create_onu_status_stream(redis, tenant_id)
    return response


@router.get(
    "/alerts",
    summary="Stream Network Alerts",
    description="Server-Sent Events stream for network and system alerts",
)
async def stream_alerts(
    redis: RedisClientType = Depends(get_redis_client),
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> EventSourceResponse:
    """
    Stream alert events via SSE.

    Events include:
    - Signal degradation alerts
    - Device offline alerts
    - Critical system alerts

    The connection stays open and pushes events as they occur.
    """
    tenant_id = current_user.tenant_id if current_user else None
    response: EventSourceResponse = await create_alert_stream(redis, tenant_id)
    return response


@router.get(
    "/tickets",
    summary="Stream Ticket Updates",
    description="Server-Sent Events stream for ticket lifecycle events",
)
async def stream_tickets(
    redis: RedisClientType = Depends(get_redis_client),
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> EventSourceResponse:
    """
    Stream ticket events via SSE.

    Events include:
    - New ticket created
    - Ticket assigned
    - Ticket updated
    - Ticket resolved

    The connection stays open and pushes events as they occur.
    """
    tenant_id = current_user.tenant_id if current_user else None
    response: EventSourceResponse = await create_ticket_stream(redis, tenant_id)
    return response


@router.get(
    "/subscribers",
    summary="Stream Subscriber Events",
    description="Server-Sent Events stream for subscriber lifecycle events",
)
async def stream_subscribers(
    request: Request,
    redis: RedisClientType = Depends(get_redis_client),
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> EventSourceResponse:
    """
    Stream subscriber lifecycle events via SSE.

    Events include:
    - Subscriber created
    - Subscriber activated
    - Subscriber suspended
    - Subscriber terminated

    The connection stays open and pushes events as they occur.
    """
    if current_user is None:
        auth_header = request.headers.get("Authorization", "")
        token = None
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(None, 1)[1]
        if token:
            claims = await _verify_token_with_fallback(token, TokenType.ACCESS)
            current_user = _claims_to_user_info(claims)

    response: EventSourceResponse = await create_subscriber_stream(
        redis, current_user.tenant_id if current_user else None
    )
    return response


@router.get(
    "/radius-sessions",
    summary="Stream RADIUS Session Events",
    description="Server-Sent Events stream for real-time RADIUS session tracking",
)
async def stream_radius_sessions(
    request: Request,
    redis: RedisClientType = Depends(get_redis_client),
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> EventSourceResponse:
    """
    Stream RADIUS session events via SSE.

    Events include:
    - Session start (user authentication)
    - Session stop (user disconnect)
    - Session interim-update (accounting updates)
    - Session timeout warnings
    - Bandwidth profile changes
    - CoA/DM events (disconnect, authorize)

    The connection stays open and pushes events as they occur.
    This is ideal for building real-time session monitoring dashboards.

    Example event payload:
    {
        "event_type": "session_start",
        "username": "user@example.com",
        "session_id": "abc123",
        "nas_ip": "10.0.0.1",
        "framed_ip": "100.64.1.100",
        "timestamp": "2025-01-15T10:30:00Z"
    }
    """
    if current_user is None:
        auth_header = request.headers.get("Authorization", "")
        token = None
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(None, 1)[1]
        if token:
            claims = await _verify_token_with_fallback(token, TokenType.ACCESS)
            current_user = _claims_to_user_info(claims)

    response: EventSourceResponse = await create_radius_session_stream(
        redis, current_user.tenant_id if current_user else None
    )
    return response


# =============================================================================
# WebSocket Endpoints
# =============================================================================


@router.websocket("/ws/sessions")
async def websocket_sessions(
    websocket: WebSocket,
    redis: RedisClientType = Depends(get_redis_client),
) -> None:
    """
    Authenticated WebSocket endpoint for RADIUS session updates.

    Streams real-time session events:
    - Session started (user login)
    - Session updated (interim accounting)
    - Session stopped (user logout)

    Authentication:
    - JWT token via Authorization header: Authorization: Bearer <jwt_token>
    - JWT token via HttpOnly cookie: access_token=<jwt_token>

    Required Permissions:
    - sessions.read OR radius.sessions.read

    Tenant Isolation:
    - Each connection is automatically scoped to the authenticated user's tenant
    - Users can only receive events for their own tenant

    Example:
        wscat -H "Authorization: Bearer <jwt_token>" \\
          -c ws://localhost:8000/api/v1/realtime/ws/sessions
    """
    await handle_sessions_ws_authenticated(websocket, redis)


@router.websocket("/ws/jobs/{job_id}")
async def websocket_job_progress(
    websocket: WebSocket,
    job_id: str,
    redis: RedisClientType = Depends(get_redis_client),
) -> None:
    """
    Authenticated WebSocket endpoint for job progress monitoring.

    Streams real-time job updates:
    - Job created
    - Progress updates
    - Job completed/failed

    Supports bidirectional communication for job control (pause, cancel).

    Authentication:
    - JWT token via Authorization header: Authorization: Bearer <jwt_token>
    - JWT token via HttpOnly cookie: access_token=<jwt_token>

    Required Permissions:
    - jobs.read (required for monitoring)
    - jobs.pause (required for pausing jobs)
    - jobs.cancel (required for cancelling jobs)

    Tenant Isolation:
    - Validates that the job belongs to the authenticated user's tenant
    - Prevents cross-tenant job monitoring

    Client Commands:
    - {"type": "ping"} - Keep-alive ping
    - {"type": "pause_job"} - Pause job execution
    - {"type": "cancel_job"} - Cancel job execution

    Example:
        wscat -H "Authorization: Bearer <jwt_token>" \\
          -c ws://localhost:8000/api/v1/realtime/ws/jobs/123
    """
    await handle_job_ws_authenticated(websocket, job_id, redis)


@router.websocket("/ws/campaigns/{campaign_id}")
async def websocket_campaign_progress(
    websocket: WebSocket,
    campaign_id: str,
    redis: RedisClientType = Depends(get_redis_client),
) -> None:
    """
    Authenticated WebSocket endpoint for firmware campaign monitoring.

    Streams real-time campaign updates:
    - Campaign started
    - Device-by-device progress
    - Campaign completed

    Supports bidirectional communication for campaign control (pause, resume, cancel).

    Authentication:
    - JWT token via Authorization header: Authorization: Bearer <jwt_token>
    - JWT token via HttpOnly cookie: access_token=<jwt_token>

    Required Permissions:
    - campaigns.read OR firmware.campaigns.read (required for monitoring)
    - campaigns.pause (required for pausing campaigns)
    - campaigns.resume (required for resuming campaigns)
    - campaigns.cancel (required for cancelling campaigns)

    Tenant Isolation:
    - Validates that the campaign belongs to the authenticated user's tenant
    - Prevents cross-tenant campaign monitoring

    Client Commands:
    - {"type": "ping"} - Keep-alive ping
    - {"type": "pause_campaign"} - Pause campaign execution
    - {"type": "resume_campaign"} - Resume paused campaign
    - {"type": "cancel_campaign"} - Cancel campaign execution

    Example:
        wscat -H "Authorization: Bearer <jwt_token>" \\
          -c ws://localhost:8000/api/v1/realtime/ws/campaigns/456
    """
    await handle_campaign_ws_authenticated(websocket, campaign_id, redis)
