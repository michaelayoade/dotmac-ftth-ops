"""
Celery tasks orchestrating tenant provisioning via AWX/Ansible.
"""

from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from concurrent.futures import Future
from datetime import UTC, datetime
from typing import Any

import structlog
from celery import Task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.ansible.client import AWXClient
from dotmac.platform.ansible.service import AWXService
from dotmac.platform.celery_app import celery_app
from dotmac.platform.db import async_session_maker
from dotmac.platform.settings import settings

from .models import (
    Tenant,
    TenantProvisioningJob,
    TenantProvisioningStatus,
    TenantStatus,
)

logger = structlog.get_logger(__name__)


def _run_async[T](coro: Coroutine[Any, Any, T]) -> T:
    """Execute async coroutine inside synchronous Celery worker."""
    try:
        return asyncio.run(coro)
    except RuntimeError:
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


def _create_awx_service() -> AWXService:
    """Instantiate AWX service using platform OSS settings."""
    config = settings.oss.ansible
    client = AWXClient(
        base_url=config.url,
        username=config.username,
        password=config.password,
        token=config.api_token,
        verify_ssl=config.verify_ssl,
        timeout_seconds=config.timeout_seconds,
        max_retries=config.max_retries,
    )
    return AWXService(client=client)


async def _load_job(session: AsyncSession, job_id: str) -> TenantProvisioningJob | None:
    stmt = (
        select(TenantProvisioningJob)
        .where(TenantProvisioningJob.id == job_id)
        .options(selectinload(TenantProvisioningJob.tenant))
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


@celery_app.task(name="tenant_provisioning.execute", bind=True, max_retries=3)  # type: ignore[misc]
def execute_tenant_provisioning(self: Task, job_id: str) -> None:
    """Start tenant provisioning workflow."""
    _run_async(_execute_tenant_provisioning(job_id, self))


async def _execute_tenant_provisioning(job_id: str, task: Task | None = None) -> None:
    async with async_session_maker() as session:
        job = await _load_job(session, job_id)
        if not job:
            logger.warning("tenant_provisioning.job_missing", job_id=job_id)
            return

        if job.status not in (
            TenantProvisioningStatus.QUEUED,
            TenantProvisioningStatus.FAILED,
            TenantProvisioningStatus.TIMED_OUT,
        ):
            logger.info(
                "tenant_provisioning.job_already_running",
                job_id=job_id,
                status=job.status.value,
            )
            return

        if job.awx_template_id is None:
            job.status = TenantProvisioningStatus.FAILED
            job.error_message = "AWX template not configured for provisioning"
            job.finished_at = datetime.now(UTC)
            await session.commit()
            logger.error("tenant_provisioning.template_missing", job_id=job_id)
            return

        job.status = TenantProvisioningStatus.IN_PROGRESS
        job.started_at = datetime.now(UTC)
        job.retry_count += 1
        await session.commit()

        tenant: Tenant = job.tenant
        tenant.status = TenantStatus.PROVISIONING
        tenant.updated_at = datetime.now(UTC)

        service = _create_awx_service()

        extra_vars = dict(job.extra_vars or {})
        extra_vars.setdefault("tenant_id", job.tenant_id)
        extra_vars.setdefault("tenant_slug", tenant.slug)
        extra_vars.setdefault("deployment_mode", job.deployment_mode.value)
        if job.connection_profile:
            extra_vars.setdefault("connection_profile", job.connection_profile)

        try:
            response = await service.launch_job(job.awx_template_id, extra_vars)
            job.awx_job_id = response.job_id
            job.updated_at = datetime.now(UTC)
            await session.commit()

            # Schedule monitoring
            monitor_tenant_provisioning.apply_async(args=[job_id], countdown=30)
        except Exception as exc:  # noqa: BLE001
            job.status = TenantProvisioningStatus.FAILED
            job.error_message = f"Failed to launch AWX job: {exc}"
            job.finished_at = datetime.now(UTC)
            tenant.status = TenantStatus.FAILED_PROVISIONING
            await session.commit()
            logger.exception(
                "tenant_provisioning.launch_failed",
                job_id=job_id,
                tenant_id=job.tenant_id,
            )
            raise


@celery_app.task(name="tenant_provisioning.monitor", bind=True, max_retries=5)  # type: ignore[misc]
def monitor_tenant_provisioning(self: Task, job_id: str) -> None:
    """Poll AWX for job completion status."""
    _run_async(_monitor_tenant_provisioning(job_id, self))


async def _monitor_tenant_provisioning(job_id: str, task: Task | None = None) -> None:
    async with async_session_maker() as session:
        job = await _load_job(session, job_id)
        if not job:
            logger.warning("tenant_provisioning.job_missing", job_id=job_id)
            return

        if job.status != TenantProvisioningStatus.IN_PROGRESS or not job.awx_job_id:
            logger.info(
                "tenant_provisioning.monitor_skip",
                job_id=job_id,
                status=job.status.value,
                awx_job_id=job.awx_job_id,
            )
            return

        service = _create_awx_service()
        try:
            awx_job = await service.get_job(job.awx_job_id)
        except Exception as exc:  # noqa: BLE001
            logger.exception("tenant_provisioning.monitor_failed", job_id=job_id, error=str(exc))
            job.retry_count += 1
            await session.commit()
            monitor_tenant_provisioning.apply_async(args=[job_id], countdown=45)
            return

        if not awx_job:
            logger.warning("tenant_provisioning.awx_job_missing", job_id=job_id)
            job.status = TenantProvisioningStatus.FAILED
            job.error_message = "AWX job not found during monitoring"
            job.finished_at = datetime.now(UTC)
            job.tenant.status = TenantStatus.FAILED_PROVISIONING
            await session.commit()
            return

        awx_status = awx_job.status.lower()
        if awx_status in {"successful"}:
            job.status = TenantProvisioningStatus.SUCCEEDED
            job.finished_at = datetime.now(UTC)
            tenant = job.tenant
            tenant.status = TenantStatus.PROVISIONED
            tenant.updated_at = datetime.now(UTC)
            metadata = dict(tenant.custom_metadata or {})
            provisioning_meta = dict(metadata.get("provisioning", {}))
            provisioning_meta.update(
                {
                    "awx_job_id": job.awx_job_id,
                    "completed_at": datetime.now(UTC).isoformat(),
                    "status": awx_status,
                }
            )
            metadata["provisioning"] = provisioning_meta
            tenant.custom_metadata = metadata
            await session.commit()
            logger.info(
                "tenant_provisioning.completed",
                job_id=job_id,
                tenant_id=job.tenant_id,
                awx_job_id=job.awx_job_id,
            )
            return

        if awx_status in {"failed", "error", "canceled"}:
            job.status = TenantProvisioningStatus.FAILED
            job.finished_at = datetime.now(UTC)
            job.error_message = f"AWX job ended with status {awx_status}"
            job.tenant.status = TenantStatus.FAILED_PROVISIONING
            await session.commit()
            logger.error(
                "tenant_provisioning.failed",
                job_id=job_id,
                tenant_id=job.tenant_id,
                awx_status=awx_status,
            )
            return

        # Still running
        job.last_acknowledged_at = datetime.now(UTC)
        await session.commit()
        monitor_tenant_provisioning.apply_async(args=[job_id], countdown=30)


def enqueue_tenant_provisioning(job_id: str) -> None:
    """Helper for API/service layers to enqueue provisioning."""
    execute_tenant_provisioning.apply_async(args=[job_id])


__all__ = [
    "enqueue_tenant_provisioning",
    "execute_tenant_provisioning",
    "monitor_tenant_provisioning",
]
