"""
Authenticated WebSocket Handlers with Tenant Isolation.

Provides secure, multi-tenant WebSocket handlers for real-time communication.
"""

import asyncio
import json
import time
from collections import defaultdict
from uuid import UUID

import structlog
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import and_, select

from dotmac.platform.billing.dunning.models import DunningCampaign
from dotmac.platform.db import async_session_maker
from dotmac.platform.jobs.models import Job
from dotmac.platform.radius.models import RadAcct
from dotmac.platform.realtime.auth import (
    AuthenticatedWebSocketConnection,
    WebSocketAuthError,
    accept_websocket_with_auth,
    authorize_websocket_resource,
)
from dotmac.platform.redis_client import RedisClientType

logger = structlog.get_logger(__name__)

# Rate limiting for WebSocket control commands
# Structure: {user_id: [(timestamp, command_type), ...]}
_ws_control_command_history: defaultdict[str, list[tuple[float, str]]] = defaultdict(list)
# Max control commands per user per minute
_MAX_CONTROL_COMMANDS_PER_MINUTE = 30
_RATE_LIMIT_WINDOW_SECONDS = 60


def _check_control_command_rate_limit(user_id: str, command_type: str) -> tuple[bool, int]:
    """
    Check if user has exceeded rate limit for control commands.

    Args:
        user_id: User ID
        command_type: Type of control command (e.g., "pause_campaign", "cancel_job")

    Returns:
        Tuple of (is_allowed, current_count)
    """
    current_time = time.time()
    cutoff_time = current_time - _RATE_LIMIT_WINDOW_SECONDS

    # Clean up old entries
    if user_id in _ws_control_command_history:
        _ws_control_command_history[user_id] = [
            (ts, cmd) for ts, cmd in _ws_control_command_history[user_id] if ts > cutoff_time
        ]

    # Count recent commands
    recent_commands = _ws_control_command_history[user_id]
    current_count = len(recent_commands)

    # Check if limit exceeded
    if current_count >= _MAX_CONTROL_COMMANDS_PER_MINUTE:
        logger.warning(
            "websocket.rate_limit.exceeded",
            user_id=user_id,
            command_type=command_type,
            current_count=current_count,
            limit=_MAX_CONTROL_COMMANDS_PER_MINUTE,
        )
        return (False, current_count)

    # Add current command to history
    _ws_control_command_history[user_id].append((current_time, command_type))

    return (True, current_count + 1)


async def handle_sessions_ws_authenticated(websocket: WebSocket, redis: RedisClientType) -> None:
    """
    Authenticated WebSocket handler for RADIUS session updates.

    Features:
    - JWT token authentication
    - Tenant isolation
    - Real-time session event streaming
    - Bidirectional ping/pong

    Args:
        websocket: FastAPI WebSocket
        redis: Redis client for pub/sub
    """
    try:
        # Authenticate and accept connection
        user_info = await accept_websocket_with_auth(
            websocket,
            required_permissions=["sessions.read", "radius.sessions.read"],
        )

        # Create authenticated connection
        connection = AuthenticatedWebSocketConnection(websocket, user_info, redis)

        # Subscribe to tenant-specific session events
        channel = f"sessions:{user_info.tenant_id}"
        await connection.subscribe_to_channel(channel)

        logger.info(
            "websocket.sessions.connected",
            tenant_id=user_info.tenant_id,
            user_id=user_info.user_id,
            channel=channel,
        )

        # Start listening to Redis pub/sub
        listen_task = asyncio.create_task(_listen_to_redis_with_auth(connection, channel))

        try:
            # Handle client messages
            while True:
                data = await connection.receive_json()

                # Handle ping/pong
                if data.get("type") == "ping":
                    await connection.send_json({"type": "pong"})

                # Handle session queries
                elif data.get("type") == "query_session":
                    session_id = data.get("session_id")
                    if session_id:
                        # Query session from database with tenant isolation
                        async with async_session_maker() as db:
                            query = select(RadAcct).where(
                                and_(
                                    RadAcct.acctsessionid == session_id,
                                    RadAcct.tenant_id == user_info.tenant_id,
                                )
                            )
                            result = await db.execute(query)
                            session = result.scalar_one_or_none()

                            if session:
                                await connection.send_json(
                                    {
                                        "type": "session_info",
                                        "session_id": session_id,
                                        "username": session.username,
                                        "status": "active" if session.is_active else "inactive",
                                        "start_time": (
                                            session.acctstarttime.isoformat()
                                            if session.acctstarttime
                                            else None
                                        ),
                                        "stop_time": (
                                            session.acctstoptime.isoformat()
                                            if session.acctstoptime
                                            else None
                                        ),
                                        "nas_ip": session.nasipaddress,
                                        "input_bytes": session.acctinputoctets,
                                        "output_bytes": session.acctoutputoctets,
                                    }
                                )
                            else:
                                await connection.send_json(
                                    {
                                        "type": "error",
                                        "message": "Session not found or access denied",
                                        "session_id": session_id,
                                    }
                                )

        except WebSocketDisconnect:
            logger.info(
                "websocket.sessions.disconnected",
                tenant_id=user_info.tenant_id,
                user_id=user_info.user_id,
            )
        finally:
            listen_task.cancel()
            try:
                await listen_task
            except asyncio.CancelledError:
                pass
            await connection.close()

    except WebSocketAuthError as e:
        logger.warning("websocket.sessions.auth_failed", error=str(e))
        # Connection already closed by accept_websocket_with_auth
    except Exception as e:
        logger.error(
            "websocket.sessions.error",
            error=str(e),
            error_type=type(e).__name__,
        )
        try:
            await websocket.close()
        except Exception:
            pass


async def handle_job_ws_authenticated(
    websocket: WebSocket,
    job_id: str,
    redis: RedisClientType,
) -> None:
    """
    Authenticated WebSocket handler for job progress monitoring.

    Features:
    - JWT token authentication
    - Tenant isolation (validates job belongs to user's tenant)
    - Real-time job progress updates
    - Job control commands (pause, cancel)

    Args:
        websocket: FastAPI WebSocket
        job_id: Job ID to monitor
        redis: Redis client for pub/sub
    """
    try:
        # Authenticate and accept connection
        user_info = await accept_websocket_with_auth(
            websocket,
            required_permissions=["jobs.read"],
        )

        # Validate job belongs to user's tenant
        async with async_session_maker() as db:
            query = select(Job).where(
                and_(
                    Job.id == job_id,
                    Job.tenant_id == user_info.tenant_id,
                )
            )
            result = await db.execute(query)
            job = result.scalar_one_or_none()

            if not job:
                logger.warning(
                    "websocket.job.access_denied",
                    job_id=job_id,
                    tenant_id=user_info.tenant_id,
                    user_id=user_info.user_id,
                )
                await websocket.close(code=1008, reason="Job not found or access denied")
                return

        # Authorize access to this specific job
        await authorize_websocket_resource(
            user_info,
            resource_type="job",
            resource_id=job_id,
            required_permissions=["jobs.read"],
        )

        # Create authenticated connection
        connection = AuthenticatedWebSocketConnection(websocket, user_info, redis)

        # Subscribe to job-specific events with tenant prefix
        channel = f"{user_info.tenant_id}:job:{job_id}"
        await connection.subscribe_to_channel(channel)

        logger.info(
            "websocket.job.connected",
            tenant_id=user_info.tenant_id,
            user_id=user_info.user_id,
            job_id=job_id,
            channel=channel,
        )

        # Start listening to Redis pub/sub
        listen_task = asyncio.create_task(_listen_to_redis_with_auth(connection, channel))

        try:
            # Handle client messages
            while True:
                data = await connection.receive_json()

                # Handle ping/pong
                if data.get("type") == "ping":
                    await connection.send_json({"type": "pong"})

                # Handle job control commands
                elif data.get("type") == "cancel_job":
                    # Check rate limit
                    is_allowed, current_count = _check_control_command_rate_limit(
                        user_info.user_id, "cancel_job"
                    )
                    if not is_allowed:
                        await connection.send_json(
                            {
                                "type": "error",
                                "error": "rate_limit_exceeded",
                                "message": f"Rate limit exceeded: {current_count}/{_MAX_CONTROL_COMMANDS_PER_MINUTE} commands per minute",
                                "retry_after": _RATE_LIMIT_WINDOW_SECONDS,
                            }
                        )
                        continue

                    # Verify user has permission to cancel jobs
                    if "jobs.cancel" in user_info.permissions:
                        await connection.send_json(
                            {
                                "type": "cancel_requested",
                                "job_id": job_id,
                                "tenant_id": user_info.tenant_id,
                            }
                        )
                        # Publish cancel command to job control channel
                        # Background workers listen to this channel and execute the cancellation
                        await redis.publish(
                            f"{user_info.tenant_id}:job:control",
                            json.dumps(
                                {
                                    "action": "cancel",
                                    "job_id": job_id,
                                    "tenant_id": user_info.tenant_id,
                                    "user_id": user_info.user_id,
                                }
                            ),
                        )
                    else:
                        await connection.send_json(
                            {
                                "type": "error",
                                "message": "Insufficient permissions to cancel job",
                            }
                        )

                elif data.get("type") == "pause_job":
                    # Check rate limit
                    is_allowed, current_count = _check_control_command_rate_limit(
                        user_info.user_id, "pause_job"
                    )
                    if not is_allowed:
                        await connection.send_json(
                            {
                                "type": "error",
                                "error": "rate_limit_exceeded",
                                "message": f"Rate limit exceeded: {current_count}/{_MAX_CONTROL_COMMANDS_PER_MINUTE} commands per minute",
                                "retry_after": _RATE_LIMIT_WINDOW_SECONDS,
                            }
                        )
                        continue

                    if "jobs.pause" in user_info.permissions:
                        await connection.send_json(
                            {
                                "type": "pause_requested",
                                "job_id": job_id,
                                "tenant_id": user_info.tenant_id,
                            }
                        )
                        # Publish pause command to job control channel
                        # Background workers listen to this channel and pause job execution
                        await redis.publish(
                            f"{user_info.tenant_id}:job:control",
                            json.dumps(
                                {
                                    "action": "pause",
                                    "job_id": job_id,
                                    "tenant_id": user_info.tenant_id,
                                    "user_id": user_info.user_id,
                                }
                            ),
                        )
                    else:
                        await connection.send_json(
                            {
                                "type": "error",
                                "message": "Insufficient permissions to pause job",
                            }
                        )

        except WebSocketDisconnect:
            logger.info(
                "websocket.job.disconnected",
                tenant_id=user_info.tenant_id,
                user_id=user_info.user_id,
                job_id=job_id,
            )
        finally:
            listen_task.cancel()
            try:
                await listen_task
            except asyncio.CancelledError:
                pass
            await connection.close()

    except WebSocketAuthError as e:
        logger.warning("websocket.job.auth_failed", job_id=job_id, error=str(e))
    except Exception as e:
        logger.error(
            "websocket.job.error",
            job_id=job_id,
            error=str(e),
            error_type=type(e).__name__,
        )
        try:
            await websocket.close()
        except Exception:
            pass


async def handle_campaign_ws_authenticated(
    websocket: WebSocket,
    campaign_id: str,
    redis: RedisClientType,
) -> None:
    """
    Authenticated WebSocket handler for firmware campaign monitoring.

    Features:
    - JWT token authentication
    - Tenant isolation (validates campaign belongs to user's tenant)
    - Real-time campaign progress updates
    - Campaign control commands (pause, resume, cancel)

    Args:
        websocket: FastAPI WebSocket
        campaign_id: Campaign ID to monitor
        redis: Redis client for pub/sub
    """
    try:
        # Authenticate and accept connection
        user_info = await accept_websocket_with_auth(
            websocket,
            required_permissions=["campaigns.read", "firmware.campaigns.read"],
        )

        # Validate campaign belongs to user's tenant
        try:
            campaign_uuid = UUID(campaign_id)
        except ValueError:
            logger.warning(
                "websocket.campaign.invalid_id",
                campaign_id=campaign_id,
                tenant_id=user_info.tenant_id,
                user_id=user_info.user_id,
            )
            await websocket.close(code=1008, reason="Invalid campaign ID format")
            return

        async with async_session_maker() as db:
            query = select(DunningCampaign).where(
                and_(
                    DunningCampaign.id == campaign_uuid,
                    DunningCampaign.tenant_id == user_info.tenant_id,
                )
            )
            result = await db.execute(query)
            campaign = result.scalar_one_or_none()

            if not campaign:
                logger.warning(
                    "websocket.campaign.access_denied",
                    campaign_id=campaign_id,
                    tenant_id=user_info.tenant_id,
                    user_id=user_info.user_id,
                )
                await websocket.close(code=1008, reason="Campaign not found or access denied")
                return

        # Authorize access to this specific campaign
        await authorize_websocket_resource(
            user_info,
            resource_type="campaign",
            resource_id=campaign_id,
            required_permissions=["campaigns.read", "firmware.campaigns.read"],
        )

        # Create authenticated connection
        connection = AuthenticatedWebSocketConnection(websocket, user_info, redis)

        # Subscribe to campaign-specific events with tenant prefix
        channel = f"{user_info.tenant_id}:campaign:{campaign_id}"
        await connection.subscribe_to_channel(channel)

        logger.info(
            "websocket.campaign.connected",
            tenant_id=user_info.tenant_id,
            user_id=user_info.user_id,
            campaign_id=campaign_id,
            channel=channel,
        )

        # Start listening to Redis pub/sub
        listen_task = asyncio.create_task(_listen_to_redis_with_auth(connection, channel))

        try:
            # Handle client messages
            while True:
                data = await connection.receive_json()

                # Handle ping/pong
                if data.get("type") == "ping":
                    await connection.send_json({"type": "pong"})

                # Handle campaign control commands
                elif data.get("type") == "pause_campaign":
                    # Check rate limit
                    is_allowed, current_count = _check_control_command_rate_limit(
                        user_info.user_id, "pause_campaign"
                    )
                    if not is_allowed:
                        await connection.send_json(
                            {
                                "type": "error",
                                "error": "rate_limit_exceeded",
                                "message": f"Rate limit exceeded: {current_count}/{_MAX_CONTROL_COMMANDS_PER_MINUTE} commands per minute",
                                "retry_after": _RATE_LIMIT_WINDOW_SECONDS,
                            }
                        )
                        continue

                    if "campaigns.pause" in user_info.permissions:
                        await connection.send_json(
                            {
                                "type": "pause_requested",
                                "campaign_id": campaign_id,
                                "tenant_id": user_info.tenant_id,
                            }
                        )
                        # Publish pause command to campaign control channel
                        # Background workers listen to this channel and pause campaign execution
                        await redis.publish(
                            f"{user_info.tenant_id}:campaign:control",
                            json.dumps(
                                {
                                    "action": "pause",
                                    "campaign_id": campaign_id,
                                    "tenant_id": user_info.tenant_id,
                                    "user_id": user_info.user_id,
                                }
                            ),
                        )
                    else:
                        await connection.send_json(
                            {
                                "type": "error",
                                "message": "Insufficient permissions to pause campaign",
                            }
                        )

                elif data.get("type") == "resume_campaign":
                    # Check rate limit
                    is_allowed, current_count = _check_control_command_rate_limit(
                        user_info.user_id, "resume_campaign"
                    )
                    if not is_allowed:
                        await connection.send_json(
                            {
                                "type": "error",
                                "error": "rate_limit_exceeded",
                                "message": f"Rate limit exceeded: {current_count}/{_MAX_CONTROL_COMMANDS_PER_MINUTE} commands per minute",
                                "retry_after": _RATE_LIMIT_WINDOW_SECONDS,
                            }
                        )
                        continue

                    if "campaigns.resume" in user_info.permissions:
                        await connection.send_json(
                            {
                                "type": "resume_requested",
                                "campaign_id": campaign_id,
                                "tenant_id": user_info.tenant_id,
                            }
                        )
                        await redis.publish(
                            f"{user_info.tenant_id}:campaign:control",
                            json.dumps(
                                {
                                    "action": "resume",
                                    "campaign_id": campaign_id,
                                    "tenant_id": user_info.tenant_id,
                                    "user_id": user_info.user_id,
                                }
                            ),
                        )
                    else:
                        await connection.send_json(
                            {
                                "type": "error",
                                "message": "Insufficient permissions to resume campaign",
                            }
                        )

                elif data.get("type") == "cancel_campaign":
                    # Check rate limit
                    is_allowed, current_count = _check_control_command_rate_limit(
                        user_info.user_id, "cancel_campaign"
                    )
                    if not is_allowed:
                        await connection.send_json(
                            {
                                "type": "error",
                                "error": "rate_limit_exceeded",
                                "message": f"Rate limit exceeded: {current_count}/{_MAX_CONTROL_COMMANDS_PER_MINUTE} commands per minute",
                                "retry_after": _RATE_LIMIT_WINDOW_SECONDS,
                            }
                        )
                        continue

                    if "campaigns.cancel" in user_info.permissions:
                        await connection.send_json(
                            {
                                "type": "cancel_requested",
                                "campaign_id": campaign_id,
                                "tenant_id": user_info.tenant_id,
                            }
                        )
                        await redis.publish(
                            f"{user_info.tenant_id}:campaign:control",
                            json.dumps(
                                {
                                    "action": "cancel",
                                    "campaign_id": campaign_id,
                                    "tenant_id": user_info.tenant_id,
                                    "user_id": user_info.user_id,
                                }
                            ),
                        )
                    else:
                        await connection.send_json(
                            {
                                "type": "error",
                                "message": "Insufficient permissions to cancel campaign",
                            }
                        )

        except WebSocketDisconnect:
            logger.info(
                "websocket.campaign.disconnected",
                tenant_id=user_info.tenant_id,
                user_id=user_info.user_id,
                campaign_id=campaign_id,
            )
        finally:
            listen_task.cancel()
            try:
                await listen_task
            except asyncio.CancelledError:
                pass
            await connection.close()

    except WebSocketAuthError as e:
        logger.warning(
            "websocket.campaign.auth_failed",
            campaign_id=campaign_id,
            error=str(e),
        )
    except Exception as e:
        logger.error(
            "websocket.campaign.error",
            campaign_id=campaign_id,
            error=str(e),
            error_type=type(e).__name__,
        )
        try:
            await websocket.close()
        except Exception:
            pass


async def _listen_to_redis_with_auth(
    connection: AuthenticatedWebSocketConnection,
    channel: str,
) -> None:
    """
    Listen to Redis pub/sub and forward messages to authenticated WebSocket.

    Ensures all messages respect tenant isolation.

    Args:
        connection: Authenticated WebSocket connection
        channel: Redis channel to listen to
    """
    if not connection.pubsub:
        return

    try:
        async for message in connection.pubsub.listen():
            if connection.is_closed:
                break

            if message["type"] == "message":
                try:
                    # Parse event data
                    event_data = json.loads(message["data"])

                    # Validate tenant isolation
                    event_tenant_id = event_data.get("tenant_id")
                    if event_tenant_id and event_tenant_id != connection.tenant_id:
                        logger.error(
                            "websocket.tenant_isolation.violated_in_pubsub",
                            connection_tenant_id=connection.tenant_id,
                            event_tenant_id=event_tenant_id,
                            channel=channel,
                        )
                        continue  # Skip this message

                    # Forward to WebSocket
                    await connection.send_json(event_data)

                except json.JSONDecodeError:
                    logger.warning(
                        "websocket.invalid_json",
                        tenant_id=connection.tenant_id,
                        channel=channel,
                    )
                    continue
                except Exception as e:
                    logger.error(
                        "websocket.forward_failed",
                        tenant_id=connection.tenant_id,
                        channel=channel,
                        error=str(e),
                    )
                    continue

    except asyncio.CancelledError:
        logger.info(
            "websocket.listen_cancelled",
            tenant_id=connection.tenant_id,
            channel=channel,
        )
        raise
    except Exception as e:
        logger.error(
            "websocket.listen_error",
            tenant_id=connection.tenant_id,
            channel=channel,
            error=str(e),
        )
