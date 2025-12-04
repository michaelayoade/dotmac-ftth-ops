"""
Celery tasks for GenieACS firmware upgrades and mass configuration.

Provides background workers for executing scheduled firmware upgrades
# mypy: disable-error-code="arg-type,assignment"
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

from dotmac.platform import db as db_module
from dotmac.platform.celery_app import celery_app
from dotmac.platform.genieacs.client import GenieACSClient
from dotmac.platform.genieacs.metrics import (
    set_firmware_upgrade_schedule_status,
    set_mass_config_job_status,
)
from dotmac.platform.genieacs.models import (
    FirmwareUpgradeResult,
    FirmwareUpgradeSchedule,
    MassConfigJob,
    MassConfigResult,
)
from dotmac.platform.redis_client import RedisClientType
from dotmac.platform.tenant.oss_config import OSSService, get_service_config

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
    return aioredis.from_url(redis_url, decode_responses=True)


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
    async with db_module.async_session_maker() as session:
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
        set_firmware_upgrade_schedule_status(
            schedule.tenant_id, schedule.schedule_id, "running", 1.0
        )

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

            # Load existing results to support replay scenarios
            existing_result_rows = await session.execute(
                select(FirmwareUpgradeResult).where(
                    FirmwareUpgradeResult.schedule_id == schedule_id
                )
            )
            result_map = {
                existing.device_id: existing for existing in existing_result_rows.scalars()
            }

            results: list[FirmwareUpgradeResult] = []
            for device in devices:
                device_id = device.get("_id", "")
                if not device_id:
                    continue

                if device_id in result_map:
                    result_obj = result_map[device_id]
                    result_obj.status = "pending"
                    result_obj.error_message = None
                    result_obj.started_at = None
                    result_obj.completed_at = None
                else:
                    result_obj = FirmwareUpgradeResult(
                        schedule_id=schedule_id,
                        device_id=device_id,
                        status="pending",
                    )
                    session.add(result_obj)
                results.append(result_obj)

            await session.commit()

            # Publish start event
            total_devices = len(results)

            await publish_progress(
                redis,
                channel,
                "upgrade_started",
                {
                    "schedule_id": schedule_id,
                    "total_devices": total_devices,
                },
            )

            # Process devices with concurrency limit
            completed = 0
            failed = 0
            batch_size = schedule.max_concurrent

            for i in range(0, total_devices, batch_size):
                batch = results[i : i + batch_size]

                for result_obj in batch:
                    device_id = cast(str, result_obj.device_id)
                    try:
                        # Update result status
                        result_obj.status = "in_progress"
                        result_obj.started_at = datetime.now(UTC)
                        await session.commit()

                        # Trigger firmware download
                        await client.add_task(
                            device_id=device_id,
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
                                "device_id": device_id,
                                "status": "success",
                                "completed": completed,
                                "total": total_devices,
                            },
                        )

                        logger.info(
                            "firmware_upgrade.device_success",
                            schedule_id=schedule_id,
                            device_id=device_id,
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
                                "device_id": device_id,
                                "status": "failed",
                                "error": str(e),
                                "completed": completed,
                                "failed": failed,
                                "total": total_devices,
                            },
                        )

                        logger.error(
                            "firmware_upgrade.device_failed",
                            schedule_id=schedule_id,
                            device_id=device_id,
                            error=str(e),
                        )

                    await session.commit()

            # Update schedule as completed
            schedule.status = "completed"
            schedule.completed_at = datetime.now(UTC)
            await session.commit()
            set_firmware_upgrade_schedule_status(
                schedule.tenant_id, schedule.schedule_id, "completed", 1.0
            )

            # Publish completion event
            await publish_progress(
                redis,
                channel,
                "upgrade_completed",
                {
                    "schedule_id": schedule_id,
                    "total": total_devices,
                    "completed": completed,
                    "failed": failed,
                },
            )

            logger.info(
                "firmware_upgrade.completed",
                schedule_id=schedule_id,
                total=total_devices,
                completed=completed,
                failed=failed,
            )

            return {
                "schedule_id": schedule_id,
                "total_devices": total_devices,
                "completed": completed,
                "failed": failed,
                "status": "completed",
            }

        except Exception as e:
            # Update schedule as failed
            schedule.status = "failed"
            schedule.completed_at = datetime.now(UTC)
            await session.commit()
            set_firmware_upgrade_schedule_status(
                schedule.tenant_id, schedule.schedule_id, "failed", 1.0
            )

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
    async with db_module.async_session_maker() as session:
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
        job.completed_devices = 0
        job.failed_devices = 0
        job.pending_devices = 0
        await session.commit()
        set_mass_config_job_status(job.tenant_id, job.job_id, "running", 1.0)

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

            existing_result_rows = await session.execute(
                select(MassConfigResult).where(MassConfigResult.job_id == job_id)
            )
            result_map = {
                existing.device_id: existing for existing in existing_result_rows.scalars()
            }

            results: list[MassConfigResult] = []
            for device in devices:
                device_id = device.get("_id", "")
                if not device_id:
                    continue

                if device_id in result_map:
                    result_obj = result_map[device_id]
                    result_obj.status = "pending"
                    result_obj.error_message = None
                    result_obj.parameters_changed = {}
                    result_obj.started_at = None
                    result_obj.completed_at = None
                else:
                    result_obj = MassConfigResult(
                        job_id=job_id,
                        device_id=device_id,
                        status="pending",
                    )
                    session.add(result_obj)
                results.append(result_obj)

            await session.commit()
            total_devices = len(results)
            job.total_devices = total_devices
            job.pending_devices = total_devices
            await session.commit()

            # Publish start event
            await publish_progress(
                redis,
                channel,
                "config_started",
                {
                    "job_id": job_id,
                    "total_devices": total_devices,
                },
            )

            # Build parameters to set from config_changes
            config_changes = job.config_changes

            # Process devices with concurrency limit
            completed = 0
            failed = 0
            batch_size = job.max_concurrent

            for i in range(0, total_devices, batch_size):
                batch = results[i : i + batch_size]

                for result_obj in batch:
                    device_id = cast(str, result_obj.device_id)
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
                                device_id=device_id,
                                parameters=params_to_set,
                            )

                        # Update result as success
                        result_obj.status = "success"
                        result_obj.parameters_changed = params_to_set
                        result_obj.completed_at = datetime.now(UTC)
                        completed += 1
                        job.completed_devices = completed
                        job.pending_devices = total_devices - completed - failed

                        # Publish device progress
                        await publish_progress(
                            redis,
                            channel,
                            "device_configured",
                            {
                                "device_id": device_id,
                                "status": "success",
                                "parameters_changed": params_to_set,
                                "completed": completed,
                                "total": total_devices,
                            },
                        )

                        logger.info(
                            "mass_config.device_success",
                            job_id=job_id,
                            device_id=device_id,
                        )

                    except Exception as e:
                        # Update result as failed
                        result_obj.status = "failed"
                        result_obj.error_message = str(e)
                        result_obj.completed_at = datetime.now(UTC)
                        failed += 1
                        job.failed_devices = failed
                        job.pending_devices = total_devices - completed - failed

                        # Publish device failure
                        await publish_progress(
                            redis,
                            channel,
                            "device_config_failed",
                            {
                                "device_id": device_id,
                                "status": "failed",
                                "error": str(e),
                                "completed": completed,
                                "failed": failed,
                                "total": total_devices,
                            },
                        )

                        logger.error(
                            "mass_config.device_failed",
                            job_id=job_id,
                            device_id=device_id,
                            error=str(e),
                        )

                    await session.commit()

            # Update job as completed
            job.status = "completed"
            job.pending_devices = max(0, total_devices - completed - failed)
            job.completed_at = datetime.now(UTC)
            await session.commit()
            set_mass_config_job_status(job.tenant_id, job.job_id, "completed", 1.0)

            # Publish completion event
            await publish_progress(
                redis,
                channel,
                "config_completed",
                {
                    "job_id": job_id,
                    "total": total_devices,
                    "completed": completed,
                    "failed": failed,
                },
            )

            logger.info(
                "mass_config.completed",
                job_id=job_id,
                total=total_devices,
                completed=completed,
                failed=failed,
            )

            return {
                "job_id": job_id,
                "total_devices": total_devices,
                "completed": completed,
                "failed": failed,
                "status": "completed",
            }

        except Exception as e:
            # Update job as failed
            job.status = "failed"
            total_devices_value = cast(int, getattr(job, "total_devices", 0))
            completed_value = cast(int, getattr(job, "completed_devices", 0))
            failed_value = cast(int, getattr(job, "failed_devices", 0))
            remaining = max(0, total_devices_value - completed_value - failed_value)
            job.pending_devices = remaining
            job.completed_at = datetime.now(UTC)
            await session.commit()
            set_mass_config_job_status(job.tenant_id, job.job_id, "failed", 1.0)

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
    async with db_module.async_session_maker() as session:
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
            schedule.status = "queued"
            schedule.started_at = None
            schedule.completed_at = None
            set_firmware_upgrade_schedule_status(
                schedule.tenant_id, schedule.schedule_id, "queued", 1.0
            )

            # Trigger execution task
            execute_firmware_upgrade.delay(schedule.schedule_id)

            logger.info(
                "scheduled_upgrade.triggered",
                schedule_id=schedule.schedule_id,
                name=schedule.name,
            )

            triggered += 1

        if triggered:
            await session.commit()

        return {"triggered": triggered, "timestamp": now.isoformat()}


@celery_app.task(name="genieacs.replay_pending_operations")  # type: ignore[misc]
def replay_pending_operations() -> dict[str, Any]:
    """Replay any in-flight GenieACS operations after worker restarts."""
    return _run_async(_replay_pending_operations_async())


async def _replay_pending_operations_async() -> dict[str, Any]:
    """Async implementation for replaying firmware upgrades and mass config jobs."""
    async with db_module.async_session_maker() as session:
        firmware_requeued = 0
        mass_config_requeued = 0

        # Reload queued or running firmware schedules
        firmware_result = await session.execute(
            select(FirmwareUpgradeSchedule).where(
                FirmwareUpgradeSchedule.status.in_(("queued", "running")),
                FirmwareUpgradeSchedule.completed_at.is_(None),
            )
        )
        schedules = firmware_result.scalars().all()

        for schedule in schedules:
            if schedule.status == "running":
                logger.info(
                    "firmware_upgrade.replay_reset",
                    schedule_id=schedule.schedule_id,
                    tenant_id=schedule.tenant_id,
                )
            schedule.status = "queued"
            schedule.started_at = None
            schedule.completed_at = None
            set_firmware_upgrade_schedule_status(
                schedule.tenant_id, schedule.schedule_id, "queued", 1.0
            )
            execute_firmware_upgrade.delay(schedule.schedule_id)
            firmware_requeued += 1

        # Reload queued or running mass configuration jobs
        job_result = await session.execute(
            select(MassConfigJob).where(
                MassConfigJob.status.in_(("queued", "running")),
                MassConfigJob.completed_at.is_(None),
                MassConfigJob.dry_run != "true",
            )
        )
        jobs = job_result.scalars().all()

        for job in jobs:
            if job.status == "running":
                logger.info(
                    "mass_config.replay_reset",
                    job_id=job.job_id,
                    tenant_id=job.tenant_id,
                )
            job.status = "queued"
            job.started_at = None
            job.completed_at = None
            job.completed_devices = 0
            job.failed_devices = 0
            job.pending_devices = cast(int, getattr(job, "total_devices", 0))
            set_mass_config_job_status(job.tenant_id, job.job_id, "queued", 1.0)
            execute_mass_config.delay(job.job_id)
            mass_config_requeued += 1

        if firmware_requeued or mass_config_requeued:
            await session.commit()
        else:
            await session.rollback()

        logger.info(
            "genieacs.replay.summary",
            firmware_requeued=firmware_requeued,
            mass_config_requeued=mass_config_requeued,
        )

        return {
            "firmware_requeued": firmware_requeued,
            "mass_config_requeued": mass_config_requeued,
        }
