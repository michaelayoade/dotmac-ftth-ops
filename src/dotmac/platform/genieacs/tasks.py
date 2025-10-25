"""
Celery tasks for GenieACS firmware upgrades and mass configuration.

Provides background workers for executing scheduled firmware upgrades
and mass configuration jobs.
"""

import asyncio
from collections.abc import Coroutine
from concurrent.futures import Future
from datetime import UTC, datetime
from typing import Any, cast

import redis.asyncio as aioredis
import structlog
from celery import Task
from sqlalchemy import select

from dotmac.platform.celery_app import celery_app
from dotmac.platform.db import _async_session_maker
from dotmac.platform.genieacs.client import GenieACSClient
from dotmac.platform.genieacs.models import (
    FirmwareUpgradeResult,
    FirmwareUpgradeSchedule,
    MassConfigJob,
    MassConfigResult,
)
from dotmac.platform.tenant.oss_config import OSSService, get_service_config
from dotmac.platform.redis_client import RedisClientType

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------


def _run_async[T](coro: Coroutine[Any, Any, T]) -> T:
    """Execute an async coroutine from a synchronous Celery task."""
    try:
        return asyncio.run(coro)
    except RuntimeError:
        # Fallback for contexts where an event loop is already running (tests).
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(coro)
            finally:
                loop.close()

        if loop.is_running():
            future: Future[T] = asyncio.run_coroutine_threadsafe(coro, loop)
            return future.result()
        return loop.run_until_complete(coro)


async def get_redis_client() -> RedisClientType:
    """Get Redis client for pub/sub.

    Uses centralized Redis URL from settings (Phase 1 implementation).
    """
    from dotmac.platform.settings import settings

    # Use Celery broker URL as default for background task pub/sub
    # This ensures consistency with task queue Redis instance
    redis_url = settings.celery.broker_url
    return cast(
        RedisClientType,
        aioredis.from_url(redis_url, decode_responses=True),
    )


async def publish_progress(
    redis: RedisClientType,
    channel: str,
    event_type: str,
    data: dict[str, Any],
) -> None:
    """Publish progress update to Redis channel."""
    import json

    message = {
        "event_type": event_type,
        "timestamp": datetime.now(UTC).isoformat(),
        **data,
    }
    await redis.publish(channel, json.dumps(message))


# ---------------------------------------------------------------------------
# Firmware Upgrade Tasks
# ---------------------------------------------------------------------------


@celery_app.task(  # type: ignore[misc]  # Celery decorator is untyped
    name="genieacs.execute_firmware_upgrade",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def execute_firmware_upgrade(self: Task, schedule_id: str) -> dict[str, Any]:
    """
    Execute firmware upgrade schedule.

    This task processes all devices in the schedule, respecting
    the max_concurrent limit and publishing progress updates.

    Args:
        self: Celery task instance
        schedule_id: Firmware upgrade schedule ID

    Returns:
        dict: Execution summary with counts
    """
    return _run_async(_execute_firmware_upgrade_async(schedule_id, self))


async def _execute_firmware_upgrade_async(schedule_id: str, task: Task) -> dict[str, Any]:
    """Async implementation of firmware upgrade execution."""
    async with _async_session_maker() as session:
        # Get schedule
        result = await session.execute(
            select(FirmwareUpgradeSchedule).where(
                FirmwareUpgradeSchedule.schedule_id == schedule_id
            )
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise ValueError(f"Firmware upgrade schedule {schedule_id} not found")

        # Update schedule status
        schedule.status = "running"
        schedule.started_at = datetime.now(UTC)
        await session.commit()

        logger.info(
            "firmware_upgrade.started",
            schedule_id=schedule_id,
            name=schedule.name,
        )

        # Get Redis for progress updates
        redis = await get_redis_client()
        channel = f"firmware_upgrade:{schedule_id}"

        try:
            # Get GenieACS client with tenant-specific configuration
            config = await get_service_config(
                session,
                schedule.tenant_id,
                OSSService.GENIEACS,
            )
            client = GenieACSClient(
                base_url=config.url,
                username=config.username,
                password=config.password,
                tenant_id=schedule.tenant_id,
                verify_ssl=config.verify_ssl,
                timeout_seconds=config.timeout_seconds,
                max_retries=config.max_retries,
            )

            # Query devices
            devices = await client.get_devices(query=schedule.device_filter)

            # Create results for each device
            results = []
            for device in devices:
                device_id = device.get("_id", "")
                result_obj = FirmwareUpgradeResult(
                    schedule_id=schedule_id,
                    device_id=device_id,
                    status="pending",
                )
                session.add(result_obj)
                results.append(result_obj)

            await session.commit()

            # Publish start event
            await publish_progress(
                redis,
                channel,
                "upgrade_started",
                {
                    "schedule_id": schedule_id,
                    "total_devices": len(devices),
                },
            )

            # Process devices with concurrency limit
            completed = 0
            failed = 0
            batch_size = schedule.max_concurrent

            for i in range(0, len(results), batch_size):
                batch = results[i : i + batch_size]

                for result_obj in batch:
                    try:
                        # Update result status
                        result_obj.status = "in_progress"
                        result_obj.started_at = datetime.now(UTC)
                        await session.commit()

                        # Trigger firmware download
                        await client.add_task(
                            device_id=result_obj.device_id,
                            task_name="download",
                            file_name=schedule.firmware_file,
                            file_type=schedule.file_type,
                        )

                        # Update result as success
                        result_obj.status = "success"
                        result_obj.completed_at = datetime.now(UTC)
                        completed += 1

                        # Publish device progress
                        await publish_progress(
                            redis,
                            channel,
                            "device_completed",
                            {
                                "device_id": result_obj.device_id,
                                "status": "success",
                                "completed": completed,
                                "total": len(devices),
                            },
                        )

                        logger.info(
                            "firmware_upgrade.device_success",
                            schedule_id=schedule_id,
                            device_id=result_obj.device_id,
                        )

                    except Exception as e:
                        # Update result as failed
                        result_obj.status = "failed"
                        result_obj.error_message = str(e)
                        result_obj.completed_at = datetime.now(UTC)
                        failed += 1

                        # Publish device failure
                        await publish_progress(
                            redis,
                            channel,
                            "device_failed",
                            {
                                "device_id": result_obj.device_id,
                                "status": "failed",
                                "error": str(e),
                                "completed": completed,
                                "failed": failed,
                                "total": len(devices),
                            },
                        )

                        logger.error(
                            "firmware_upgrade.device_failed",
                            schedule_id=schedule_id,
                            device_id=result_obj.device_id,
                            error=str(e),
                        )

                    await session.commit()

            # Update schedule as completed
            schedule.status = "completed"
            schedule.completed_at = datetime.now(UTC)
            await session.commit()

            # Publish completion event
            await publish_progress(
                redis,
                channel,
                "upgrade_completed",
                {
                    "schedule_id": schedule_id,
                    "total": len(devices),
                    "completed": completed,
                    "failed": failed,
                },
            )

            logger.info(
                "firmware_upgrade.completed",
                schedule_id=schedule_id,
                total=len(devices),
                completed=completed,
                failed=failed,
            )

            return {
                "schedule_id": schedule_id,
                "total_devices": len(devices),
                "completed": completed,
                "failed": failed,
                "status": "completed",
            }

        except Exception as e:
            # Update schedule as failed
            schedule.status = "failed"
            schedule.completed_at = datetime.now(UTC)
            await session.commit()

            # Publish failure event
            await publish_progress(
                redis,
                channel,
                "upgrade_failed",
                {
                    "schedule_id": schedule_id,
                    "error": str(e),
                },
            )

            logger.error(
                "firmware_upgrade.failed",
                schedule_id=schedule_id,
                error=str(e),
            )

            # Retry task
            raise task.retry(exc=e)

        finally:
            await redis.close()


# ---------------------------------------------------------------------------
# Mass Configuration Tasks
# ---------------------------------------------------------------------------


@celery_app.task(  # type: ignore[misc]  # Celery decorator is untyped
    name="genieacs.execute_mass_config",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def execute_mass_config(self: Task, job_id: str) -> dict[str, Any]:
    """
    Execute mass configuration job.

    This task processes all devices in the job, applying configuration
    changes and publishing progress updates.

    Args:
        self: Celery task instance
        job_id: Mass configuration job ID

    Returns:
        dict: Execution summary with counts
    """
    return _run_async(_execute_mass_config_async(job_id, self))


async def _execute_mass_config_async(job_id: str, task: Task) -> dict[str, Any]:
    """Async implementation of mass configuration execution."""
    async with _async_session_maker() as session:
        # Get job
        result = await session.execute(select(MassConfigJob).where(MassConfigJob.job_id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise ValueError(f"Mass configuration job {job_id} not found")

        if job.dry_run == "true":
            raise ValueError("Cannot execute dry-run job")

        # Update job status
        job.status = "running"
        job.started_at = datetime.now(UTC)
        await session.commit()

        logger.info(
            "mass_config.started",
            job_id=job_id,
            name=job.name,
        )

        # Get Redis for progress updates
        redis = await get_redis_client()
        channel = f"mass_config:{job_id}"

        try:
            # Get GenieACS client with tenant-specific configuration
            config = await get_service_config(
                session,
                job.tenant_id,
                OSSService.GENIEACS,
            )
            client = GenieACSClient(
                base_url=config.url,
                username=config.username,
                password=config.password,
                tenant_id=job.tenant_id,
                verify_ssl=config.verify_ssl,
                timeout_seconds=config.timeout_seconds,
                max_retries=config.max_retries,
            )

            # Query devices
            devices = await client.get_devices(query=job.device_filter)

            # Create results for each device
            results = []
            for device in devices:
                device_id = device.get("_id", "")
                result_obj = MassConfigResult(
                    job_id=job_id,
                    device_id=device_id,
                    status="pending",
                )
                session.add(result_obj)
                results.append(result_obj)

            await session.commit()

            # Publish start event
            await publish_progress(
                redis,
                channel,
                "config_started",
                {
                    "job_id": job_id,
                    "total_devices": len(devices),
                },
            )

            # Build parameters to set from config_changes
            config_changes = job.config_changes

            # Process devices with concurrency limit
            completed = 0
            failed = 0
            batch_size = job.max_concurrent

            for i in range(0, len(results), batch_size):
                batch = results[i : i + batch_size]

                for result_obj in batch:
                    try:
                        # Update result status
                        result_obj.status = "in_progress"
                        result_obj.started_at = datetime.now(UTC)
                        await session.commit()

                        # Build TR-069 parameters from config_changes
                        params_to_set: dict[str, Any] = {}

                        # WiFi configuration
                        if "wifi" in config_changes and config_changes["wifi"]:
                            wifi = config_changes["wifi"]
                            if wifi.get("ssid"):
                                params_to_set[
                                    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID"
                                ] = wifi["ssid"]
                            if wifi.get("password"):
                                params_to_set[
                                    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase"
                                ] = wifi["password"]

                        # LAN configuration
                        if "lan" in config_changes and config_changes["lan"]:
                            lan = config_changes["lan"]
                            if lan.get("dhcp_enabled") is not None:
                                params_to_set[
                                    "InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.DHCPServerEnable"
                                ] = lan["dhcp_enabled"]

                        # WAN configuration
                        if "wan" in config_changes and config_changes["wan"]:
                            wan = config_changes["wan"]
                            if wan.get("vlan_id"):
                                params_to_set[
                                    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_CUSTOM_VLANTag"
                                ] = wan["vlan_id"]

                        # Custom parameters
                        if "custom_parameters" in config_changes:
                            params_to_set.update(config_changes["custom_parameters"])

                        # Set parameters
                        if params_to_set:
                            await client.set_parameter_values(
                                device_id=result_obj.device_id,
                                parameters=params_to_set,
                            )

                        # Update result as success
                        result_obj.status = "success"
                        result_obj.parameters_changed = params_to_set
                        result_obj.completed_at = datetime.now(UTC)
                        completed += 1

                        # Update job counters
                        job.completed_devices = completed

                        # Publish device progress
                        await publish_progress(
                            redis,
                            channel,
                            "device_configured",
                            {
                                "device_id": result_obj.device_id,
                                "status": "success",
                                "parameters_changed": params_to_set,
                                "completed": completed,
                                "total": len(devices),
                            },
                        )

                        logger.info(
                            "mass_config.device_success",
                            job_id=job_id,
                            device_id=result_obj.device_id,
                        )

                    except Exception as e:
                        # Update result as failed
                        result_obj.status = "failed"
                        result_obj.error_message = str(e)
                        result_obj.completed_at = datetime.now(UTC)
                        failed += 1

                        # Update job counters
                        job.failed_devices = failed

                        # Publish device failure
                        await publish_progress(
                            redis,
                            channel,
                            "device_config_failed",
                            {
                                "device_id": result_obj.device_id,
                                "status": "failed",
                                "error": str(e),
                                "completed": completed,
                                "failed": failed,
                                "total": len(devices),
                            },
                        )

                        logger.error(
                            "mass_config.device_failed",
                            job_id=job_id,
                            device_id=result_obj.device_id,
                            error=str(e),
                        )

                    await session.commit()

            # Update job as completed
            job.status = "completed"
            job.pending_devices = 0
            job.completed_at = datetime.now(UTC)
            await session.commit()

            # Publish completion event
            await publish_progress(
                redis,
                channel,
                "config_completed",
                {
                    "job_id": job_id,
                    "total": len(devices),
                    "completed": completed,
                    "failed": failed,
                },
            )

            logger.info(
                "mass_config.completed",
                job_id=job_id,
                total=len(devices),
                completed=completed,
                failed=failed,
            )

            return {
                "job_id": job_id,
                "total_devices": len(devices),
                "completed": completed,
                "failed": failed,
                "status": "completed",
            }

        except Exception as e:
            # Update job as failed
            job.status = "failed"
            job.completed_at = datetime.now(UTC)
            await session.commit()

            # Publish failure event
            await publish_progress(
                redis,
                channel,
                "config_failed",
                {
                    "job_id": job_id,
                    "error": str(e),
                },
            )

            logger.error(
                "mass_config.failed",
                job_id=job_id,
                error=str(e),
            )

            # Retry task
            raise task.retry(exc=e)

        finally:
            await redis.close()


# ---------------------------------------------------------------------------
# Scheduled Task Executor
# ---------------------------------------------------------------------------


@celery_app.task(name="genieacs.check_scheduled_upgrades")  # type: ignore[misc]  # Celery decorator is untyped
def check_scheduled_upgrades() -> dict[str, Any]:
    """
    Check for firmware upgrades that are due to run.

    This task runs periodically (e.g., every minute) to check for
    scheduled firmware upgrades that are due to execute.

    Returns:
        dict: Number of schedules triggered
    """
    return _run_async(_check_scheduled_upgrades_async())


async def _check_scheduled_upgrades_async() -> dict[str, Any]:
    """Async implementation of scheduled upgrade checker."""
    async with _async_session_maker() as session:
        # Find schedules that are due
        now = datetime.now(UTC)

        result = await session.execute(
            select(FirmwareUpgradeSchedule).where(
                FirmwareUpgradeSchedule.status == "pending",
                FirmwareUpgradeSchedule.scheduled_at <= now,
            )
        )

        schedules = result.scalars().all()

        triggered = 0
        for schedule in schedules:
            # Trigger execution task
            execute_firmware_upgrade.delay(schedule.schedule_id)

            logger.info(
                "scheduled_upgrade.triggered",
                schedule_id=schedule.schedule_id,
                name=schedule.name,
            )

            triggered += 1

        return {"triggered": triggered, "timestamp": now.isoformat()}
