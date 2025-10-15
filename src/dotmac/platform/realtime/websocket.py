"""
WebSocket Handlers

Real-time bidirectional communication for sessions, jobs, and campaigns.
"""

import asyncio
import json
from typing import Any, cast

import structlog
from fastapi import WebSocket, WebSocketDisconnect
from redis.asyncio.client import PubSub

from dotmac.platform.redis_client import RedisClientType

logger = structlog.get_logger(__name__)


class WebSocketConnection:
    """Manages a single WebSocket connection."""

    def __init__(self, websocket: WebSocket, tenant_id: str, redis: RedisClientType):
        self.websocket = websocket
        self.tenant_id = tenant_id
        self.redis = redis
        self.pubsub: PubSub | None = None
        self.listen_task: asyncio.Task[None] | None = None

    async def accept(self) -> None:
        """Accept WebSocket connection."""
        await self.websocket.accept()
        logger.info("websocket.connected", tenant_id=self.tenant_id)

    async def send_json(self, data: dict[str, Any]) -> None:
        """Send JSON message to client."""
        try:
            await self.websocket.send_json(data)
        except Exception as e:
            logger.error(
                "websocket.send_failed",
                tenant_id=self.tenant_id,
                error=str(e),
            )

    async def receive_json(self) -> dict[str, Any]:
        """Receive JSON message from client."""
        data = await self.websocket.receive_json()
        if not isinstance(data, dict):
            raise TypeError("Expected JSON object from websocket")
        return cast(dict[str, Any], data)

    async def subscribe_to_channel(self, channel: str) -> None:
        """
        Subscribe to Redis pub/sub channel and forward messages to WebSocket.

        Args:
            channel: Redis channel name
        """
        self.pubsub = self.redis.pubsub()
        await self.pubsub.subscribe(channel)

        logger.info(
            "websocket.subscribed",
            tenant_id=self.tenant_id,
            channel=channel,
        )

        # Send subscription confirmation
        await self.send_json(
            {
                "type": "subscribed",
                "channel": channel,
                "timestamp": str(asyncio.get_event_loop().time()),
            }
        )

        # Start listening task
        self.listen_task = asyncio.create_task(self._listen_to_redis(channel))

    async def _listen_to_redis(self, channel: str) -> None:
        """Listen to Redis pub/sub and forward to WebSocket."""
        if self.pubsub is None:
            return

        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    try:
                        # Parse and forward event
                        event_data = json.loads(message["data"])
                        await self.send_json(event_data)
                    except json.JSONDecodeError:
                        logger.warning(
                            "websocket.invalid_json",
                            tenant_id=self.tenant_id,
                            channel=channel,
                        )
                        continue
        except asyncio.CancelledError:
            logger.info(
                "websocket.listen_cancelled",
                tenant_id=self.tenant_id,
                channel=channel,
            )
            raise
        except Exception as e:
            logger.error(
                "websocket.listen_error",
                tenant_id=self.tenant_id,
                channel=channel,
                error=str(e),
            )

    async def close(self) -> None:
        """Close WebSocket connection and cleanup."""
        if self.listen_task:
            self.listen_task.cancel()
            try:
                await self.listen_task
            except asyncio.CancelledError:
                pass

        if self.pubsub:
            await self.pubsub.close()

        try:
            await self.websocket.close()
        except Exception:
            pass

        logger.info("websocket.disconnected", tenant_id=self.tenant_id)


# =============================================================================
# WebSocket Handler Functions
# =============================================================================


async def handle_sessions_ws(websocket: WebSocket, tenant_id: str, redis: RedisClientType) -> None:
    """
    WebSocket handler for RADIUS session updates.

    Args:
        websocket: FastAPI WebSocket
        tenant_id: Tenant ID
        redis: Redis client
    """
    connection = WebSocketConnection(websocket, tenant_id, redis)
    await connection.accept()

    try:
        # Subscribe to session events
        channel = f"sessions:{tenant_id}"
        await connection.subscribe_to_channel(channel)

        # Keep connection alive and handle client messages
        while True:
            try:
                # Receive client messages (e.g., ping/pong)
                data = await connection.receive_json()

                # Handle client commands
                if data.get("type") == "ping":
                    await connection.send_json({"type": "pong"})

            except WebSocketDisconnect:
                logger.info(
                    "websocket.client_disconnected",
                    tenant_id=tenant_id,
                )
                break

    except Exception as e:
        logger.error(
            "websocket.error",
            tenant_id=tenant_id,
            error=str(e),
        )
    finally:
        await connection.close()


async def handle_job_ws(
    websocket: WebSocket, job_id: str, tenant_id: str, redis: RedisClientType
) -> None:
    """
    WebSocket handler for job progress updates.

    Args:
        websocket: FastAPI WebSocket
        job_id: Job ID to monitor
        tenant_id: Tenant ID
        redis: Redis client
    """
    connection = WebSocketConnection(websocket, tenant_id, redis)
    await connection.accept()

    try:
        # Subscribe to job-specific events
        channel = f"job:{job_id}"
        await connection.subscribe_to_channel(channel)

        # Keep connection alive
        while True:
            try:
                data = await connection.receive_json()

                # Handle client commands
                if data.get("type") == "ping":
                    await connection.send_json({"type": "pong"})

                elif data.get("type") == "cancel_job":
                    # Publish cancel command to job control channel
                    # Background workers listen to this channel and execute the cancellation
                    await connection.send_json(
                        {
                            "type": "cancel_requested",
                            "job_id": job_id,
                        }
                    )
                    await redis.publish(
                        f"{tenant_id}:job:control",
                        json.dumps(
                            {
                                "action": "cancel",
                                "job_id": job_id,
                                "tenant_id": tenant_id,
                                "user_id": "system",  # Non-authenticated WebSocket
                            }
                        ),
                    )
                    logger.info(
                        "websocket.job_cancel_requested",
                        job_id=job_id,
                        tenant_id=tenant_id,
                    )

            except WebSocketDisconnect:
                logger.info(
                    "websocket.client_disconnected",
                    tenant_id=tenant_id,
                    job_id=job_id,
                )
                break

    except Exception as e:
        logger.error(
            "websocket.error",
            tenant_id=tenant_id,
            job_id=job_id,
            error=str(e),
        )
    finally:
        await connection.close()


async def handle_campaign_ws(
    websocket: WebSocket, campaign_id: str, tenant_id: str, redis: RedisClientType
) -> None:
    """
    WebSocket handler for firmware campaign progress.

    Args:
        websocket: FastAPI WebSocket
        campaign_id: Campaign ID to monitor
        tenant_id: Tenant ID
        redis: Redis client
    """
    connection = WebSocketConnection(websocket, tenant_id, redis)
    await connection.accept()

    try:
        # Subscribe to campaign-specific events
        channel = f"campaign:{campaign_id}"
        await connection.subscribe_to_channel(channel)

        # Keep connection alive
        while True:
            try:
                data = await connection.receive_json()

                # Handle client commands
                if data.get("type") == "ping":
                    await connection.send_json({"type": "pong"})

                elif data.get("type") == "pause_campaign":
                    # Publish pause command to campaign control channel
                    # Background workers listen to this channel and pause campaign execution
                    await connection.send_json(
                        {
                            "type": "pause_requested",
                            "campaign_id": campaign_id,
                        }
                    )
                    await redis.publish(
                        f"{tenant_id}:campaign:control",
                        json.dumps(
                            {
                                "action": "pause",
                                "campaign_id": campaign_id,
                                "tenant_id": tenant_id,
                                "user_id": "system",  # Non-authenticated WebSocket
                            }
                        ),
                    )
                    logger.info(
                        "websocket.campaign_pause_requested",
                        campaign_id=campaign_id,
                        tenant_id=tenant_id,
                    )

                elif data.get("type") == "resume_campaign":
                    # Publish resume command to campaign control channel
                    # Background workers listen to this channel and resume campaign execution
                    await connection.send_json(
                        {
                            "type": "resume_requested",
                            "campaign_id": campaign_id,
                        }
                    )
                    await redis.publish(
                        f"{tenant_id}:campaign:control",
                        json.dumps(
                            {
                                "action": "resume",
                                "campaign_id": campaign_id,
                                "tenant_id": tenant_id,
                                "user_id": "system",  # Non-authenticated WebSocket
                            }
                        ),
                    )
                    logger.info(
                        "websocket.campaign_resume_requested",
                        campaign_id=campaign_id,
                        tenant_id=tenant_id,
                    )

            except WebSocketDisconnect:
                logger.info(
                    "websocket.client_disconnected",
                    tenant_id=tenant_id,
                    campaign_id=campaign_id,
                )
                break

    except Exception as e:
        logger.error(
            "websocket.error",
            tenant_id=tenant_id,
            campaign_id=campaign_id,
            error=str(e),
        )
    finally:
        await connection.close()
