"""
Background workers for WebSocket control commands.

These workers listen to Redis pub/sub channels and execute control commands
for jobs and campaigns (cancel, pause, resume).
"""

import asyncio
import json

import structlog
from redis.asyncio.client import PubSub
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.dunning.service import DunningService
from dotmac.platform.db import get_async_session_context
from dotmac.platform.jobs.service import JobService
from dotmac.platform.redis_client import RedisClientManager, RedisClientType

logger = structlog.get_logger(__name__)


class JobControlWorker:
    """
    Background worker that listens to job control commands via Redis pub/sub.

    Supported commands:
    - cancel: Cancel a running or pending job
    - pause: Pause a running job
    - resume: Resume a paused job
    """

    def __init__(self, redis_client: RedisClientType, session: AsyncSession):
        """
        Initialize the job control worker.

        Args:
            redis_client: Redis client for pub/sub
            session: Database session for job operations
        """
        self.redis = redis_client
        self.session = session
        self.job_service = JobService(session, redis_client)
        self.running = False
        self.pubsub: PubSub | None = None

    async def start(self, tenant_pattern: str = "*") -> None:
        """
        Start listening for job control commands.

        Args:
            tenant_pattern: Pattern for tenant IDs to listen to (default: all tenants)
        """
        self.running = True
        self.pubsub = self.redis.pubsub()

        # Subscribe to job control channel with pattern matching
        pattern = f"{tenant_pattern}:job:control"
        await self.pubsub.psubscribe(pattern)

        logger.info(
            "job_control_worker.started",
            pattern=pattern,
        )

        try:
            await self._listen()
        except Exception as e:
            logger.error(
                "job_control_worker.error",
                error=str(e),
                error_type=type(e).__name__,
            )
            raise
        finally:
            await self.stop()

    async def stop(self) -> None:
        """Stop the worker and cleanup resources."""
        self.running = False
        if self.pubsub:
            await self.pubsub.unsubscribe()
            await self.pubsub.close()

        logger.info("job_control_worker.stopped")

    async def _listen(self) -> None:
        """Listen for messages on the subscribed channels."""
        if not self.pubsub:
            raise RuntimeError("PubSub not initialized")

        async for message in self.pubsub.listen():
            if not self.running:
                break

            if message["type"] == "pmessage":
                await self._handle_message(
                    channel=message["channel"].decode(),
                    data=message["data"].decode(),
                )

    async def _handle_message(self, channel: str, data: str) -> None:
        """
        Handle a control message.

        Args:
            channel: Redis channel name
            data: JSON-encoded message data
        """
        try:
            command = json.loads(data)
            action = command.get("action")
            job_id = command.get("job_id")
            tenant_id = command.get("tenant_id")
            user_id = command.get("user_id")

            if not all([action, job_id, tenant_id]):
                logger.warning(
                    "job_control_worker.invalid_message",
                    channel=channel,
                    data=data,
                )
                return

            logger.info(
                "job_control_worker.command_received",
                action=action,
                job_id=job_id,
                tenant_id=tenant_id,
                user_id=user_id,
            )

            # Execute the command
            if action == "cancel":
                await self._cancel_job(job_id, tenant_id, user_id)
            elif action == "pause":
                await self._pause_job(job_id, tenant_id, user_id)
            elif action == "resume":
                await self._resume_job(job_id, tenant_id, user_id)
            else:
                logger.warning(
                    "job_control_worker.unknown_action",
                    action=action,
                    job_id=job_id,
                )

        except json.JSONDecodeError as e:
            logger.error(
                "job_control_worker.json_decode_error",
                channel=channel,
                data=data,
                error=str(e),
            )
        except Exception as e:
            logger.error(
                "job_control_worker.command_error",
                channel=channel,
                error=str(e),
                error_type=type(e).__name__,
            )

    async def _cancel_job(self, job_id: str, tenant_id: str, user_id: str) -> None:
        """
        Cancel a job.

        Args:
            job_id: Job ID to cancel
            tenant_id: Tenant ID
            user_id: User who requested the cancellation
        """
        try:
            job = await self.job_service.cancel_job(
                job_id=job_id,
                tenant_id=tenant_id,
                cancelled_by=user_id,
            )

            if job:
                logger.info(
                    "job_control_worker.job_cancelled",
                    job_id=job_id,
                    tenant_id=tenant_id,
                    user_id=user_id,
                )

                # Publish success notification
                await self.redis.publish(
                    f"{tenant_id}:job:updates",
                    json.dumps(
                        {
                            "type": "job_cancelled",
                            "job_id": job_id,
                            "status": job.status,
                            "cancelled_by": user_id,
                        }
                    ),
                )
            else:
                logger.warning(
                    "job_control_worker.job_not_found",
                    job_id=job_id,
                    tenant_id=tenant_id,
                )

        except Exception as e:
            logger.error(
                "job_control_worker.cancel_failed",
                job_id=job_id,
                tenant_id=tenant_id,
                error=str(e),
            )

    async def _pause_job(self, job_id: str, tenant_id: str, user_id: str) -> None:
        """
        Pause a job.

        Args:
            job_id: Job ID to pause
            tenant_id: Tenant ID
            user_id: User who requested the pause
        """
        # Note: This is a placeholder - actual pause logic depends on job executor
        logger.info(
            "job_control_worker.job_pause_requested",
            job_id=job_id,
            tenant_id=tenant_id,
            user_id=user_id,
        )

        # Publish pause notification to job executor
        await self.redis.publish(
            f"{tenant_id}:job:executor",
            json.dumps(
                {
                    "type": "pause",
                    "job_id": job_id,
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                }
            ),
        )

    async def _resume_job(self, job_id: str, tenant_id: str, user_id: str) -> None:
        """
        Resume a job.

        Args:
            job_id: Job ID to resume
            tenant_id: Tenant ID
            user_id: User who requested the resume
        """
        # Note: This is a placeholder - actual resume logic depends on job executor
        logger.info(
            "job_control_worker.job_resume_requested",
            job_id=job_id,
            tenant_id=tenant_id,
            user_id=user_id,
        )

        # Publish resume notification to job executor
        await self.redis.publish(
            f"{tenant_id}:job:executor",
            json.dumps(
                {
                    "type": "resume",
                    "job_id": job_id,
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                }
            ),
        )


class CampaignControlWorker:
    """
    Background worker that listens to campaign control commands via Redis pub/sub.

    Supported commands:
    - pause: Pause a running campaign
    - resume: Resume a paused campaign
    - cancel: Cancel a campaign
    """

    def __init__(self, redis_client: RedisClientType, session: AsyncSession):
        """
        Initialize the campaign control worker.

        Args:
            redis_client: Redis client for pub/sub
            session: Database session for campaign operations
        """
        self.redis = redis_client
        self.session = session
        self.dunning_service = DunningService(session)
        self.running = False
        self.pubsub: PubSub | None = None

    async def start(self, tenant_pattern: str = "*") -> None:
        """
        Start listening for campaign control commands.

        Args:
            tenant_pattern: Pattern for tenant IDs to listen to (default: all tenants)
        """
        self.running = True
        self.pubsub = self.redis.pubsub()

        # Subscribe to campaign control channel with pattern matching
        pattern = f"{tenant_pattern}:campaign:control"
        await self.pubsub.psubscribe(pattern)

        logger.info(
            "campaign_control_worker.started",
            pattern=pattern,
        )

        try:
            await self._listen()
        except Exception as e:
            logger.error(
                "campaign_control_worker.error",
                error=str(e),
                error_type=type(e).__name__,
            )
            raise
        finally:
            await self.stop()

    async def stop(self) -> None:
        """Stop the worker and cleanup resources."""
        self.running = False
        if self.pubsub:
            await self.pubsub.unsubscribe()
            await self.pubsub.close()

        logger.info("campaign_control_worker.stopped")

    async def _listen(self) -> None:
        """Listen for messages on the subscribed channels."""
        if not self.pubsub:
            raise RuntimeError("PubSub not initialized")

        async for message in self.pubsub.listen():
            if not self.running:
                break

            if message["type"] == "pmessage":
                await self._handle_message(
                    channel=message["channel"].decode(),
                    data=message["data"].decode(),
                )

    async def _handle_message(self, channel: str, data: str) -> None:
        """
        Handle a control message.

        Args:
            channel: Redis channel name
            data: JSON-encoded message data
        """
        try:
            command = json.loads(data)
            action = command.get("action")
            campaign_id = command.get("campaign_id")
            tenant_id = command.get("tenant_id")
            user_id = command.get("user_id")

            if not all([action, campaign_id, tenant_id]):
                logger.warning(
                    "campaign_control_worker.invalid_message",
                    channel=channel,
                    data=data,
                )
                return

            logger.info(
                "campaign_control_worker.command_received",
                action=action,
                campaign_id=campaign_id,
                tenant_id=tenant_id,
                user_id=user_id,
            )

            # Execute the command
            if action == "pause":
                await self._pause_campaign(campaign_id, tenant_id, user_id)
            elif action == "resume":
                await self._resume_campaign(campaign_id, tenant_id, user_id)
            elif action == "cancel":
                await self._cancel_campaign(campaign_id, tenant_id, user_id)
            else:
                logger.warning(
                    "campaign_control_worker.unknown_action",
                    action=action,
                    campaign_id=campaign_id,
                )

        except json.JSONDecodeError as e:
            logger.error(
                "campaign_control_worker.json_decode_error",
                channel=channel,
                data=data,
                error=str(e),
            )
        except Exception as e:
            logger.error(
                "campaign_control_worker.command_error",
                channel=channel,
                error=str(e),
                error_type=type(e).__name__,
            )

    async def _pause_campaign(self, campaign_id: str, tenant_id: str, user_id: str) -> None:
        """
        Pause a campaign by setting is_active = False.

        Args:
            campaign_id: Campaign ID to pause
            tenant_id: Tenant ID
            user_id: User who requested the pause
        """
        try:
            from uuid import UUID

            from dotmac.platform.billing.dunning.schemas import DunningCampaignUpdate

            # Update campaign to inactive
            campaign = await self.dunning_service.update_campaign(
                campaign_id=UUID(campaign_id),
                tenant_id=tenant_id,
                data=DunningCampaignUpdate(is_active=False),
                updated_by_user_id=UUID(user_id) if user_id != "system" else None,
            )

            await self.session.commit()

            logger.info(
                "campaign_control_worker.campaign_paused",
                campaign_id=campaign_id,
                tenant_id=tenant_id,
                user_id=user_id,
            )

            # Publish success notification
            await self.redis.publish(
                f"{tenant_id}:campaign:updates",
                json.dumps(
                    {
                        "type": "campaign_paused",
                        "campaign_id": campaign_id,
                        "is_active": campaign.is_active,
                        "paused_by": user_id,
                    }
                ),
            )

        except Exception as e:
            logger.error(
                "campaign_control_worker.pause_failed",
                campaign_id=campaign_id,
                tenant_id=tenant_id,
                error=str(e),
            )
            await self.session.rollback()

    async def _resume_campaign(self, campaign_id: str, tenant_id: str, user_id: str) -> None:
        """
        Resume a campaign by setting is_active = True.

        Args:
            campaign_id: Campaign ID to resume
            tenant_id: Tenant ID
            user_id: User who requested the resume
        """
        try:
            from uuid import UUID

            from dotmac.platform.billing.dunning.schemas import DunningCampaignUpdate

            # Update campaign to active
            campaign = await self.dunning_service.update_campaign(
                campaign_id=UUID(campaign_id),
                tenant_id=tenant_id,
                data=DunningCampaignUpdate(is_active=True),
                updated_by_user_id=UUID(user_id) if user_id != "system" else None,
            )

            await self.session.commit()

            logger.info(
                "campaign_control_worker.campaign_resumed",
                campaign_id=campaign_id,
                tenant_id=tenant_id,
                user_id=user_id,
            )

            # Publish success notification
            await self.redis.publish(
                f"{tenant_id}:campaign:updates",
                json.dumps(
                    {
                        "type": "campaign_resumed",
                        "campaign_id": campaign_id,
                        "is_active": campaign.is_active,
                        "resumed_by": user_id,
                    }
                ),
            )

        except Exception as e:
            logger.error(
                "campaign_control_worker.resume_failed",
                campaign_id=campaign_id,
                tenant_id=tenant_id,
                error=str(e),
            )
            await self.session.rollback()

    async def _cancel_campaign(self, campaign_id: str, tenant_id: str, user_id: str) -> None:
        """
        Cancel a campaign by setting is_active = False and marking as cancelled.

        Args:
            campaign_id: Campaign ID to cancel
            tenant_id: Tenant ID
            user_id: User who requested the cancellation
        """
        try:
            from uuid import UUID

            from dotmac.platform.billing.dunning.schemas import DunningCampaignUpdate

            # Update campaign to inactive (permanent cancellation)
            campaign = await self.dunning_service.update_campaign(
                campaign_id=UUID(campaign_id),
                tenant_id=tenant_id,
                data=DunningCampaignUpdate(is_active=False),
                updated_by_user_id=UUID(user_id) if user_id != "system" else None,
            )

            await self.session.commit()

            logger.info(
                "campaign_control_worker.campaign_cancelled",
                campaign_id=campaign_id,
                tenant_id=tenant_id,
                user_id=user_id,
            )

            # Publish success notification
            await self.redis.publish(
                f"{tenant_id}:campaign:updates",
                json.dumps(
                    {
                        "type": "campaign_cancelled",
                        "campaign_id": campaign_id,
                        "is_active": campaign.is_active,
                        "cancelled_by": user_id,
                    }
                ),
            )

        except Exception as e:
            logger.error(
                "campaign_control_worker.cancel_failed",
                campaign_id=campaign_id,
                tenant_id=tenant_id,
                error=str(e),
            )
            await self.session.rollback()


async def start_control_workers() -> None:
    """
    Start both job and campaign control workers.

    This function should be called from the main application startup
    to begin listening for control commands.
    """
    # Get Redis client
    redis_manager = RedisClientManager()
    redis_client = await redis_manager.get_client()

    async with get_async_session_context() as session:
        job_worker = JobControlWorker(redis_client, session)
        campaign_worker = CampaignControlWorker(redis_client, session)

        try:
            await asyncio.gather(
                job_worker.start(),
                campaign_worker.start(),
            )
        except KeyboardInterrupt:
            logger.info("control_workers.shutting_down")
            await job_worker.stop()
            await campaign_worker.stop()
        except Exception as e:
            logger.error(
                "control_workers.error",
                error=str(e),
                error_type=type(e).__name__,
            )
            raise


if __name__ == "__main__":
    """Run the control workers as a standalone process."""
    # Setup logging
    import logging
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        stream=sys.stdout,
    )

    # Run the workers
    asyncio.run(start_control_workers())
