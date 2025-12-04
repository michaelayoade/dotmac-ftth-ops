"""
Service layer coordinating tenant infrastructure provisioning jobs.
"""

from __future__ import annotations

from datetime import UTC, datetime

import structlog
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import (
    Tenant,
    TenantProvisioningJob,
    TenantProvisioningStatus,
    TenantStatus,
)
from .schemas import TenantProvisioningJobCreate

logger = structlog.get_logger(__name__)


class TenantProvisioningJobNotFoundError(Exception):
    """Raised when a provisioning job cannot be located."""


class TenantProvisioningConflictError(Exception):
    """Raised when a tenant already has an active provisioning job."""


class TenantProvisioningService:
    """Business logic for managing tenant provisioning jobs."""

    ACTIVE_STATUSES: tuple[TenantProvisioningStatus, ...] = (
        TenantProvisioningStatus.QUEUED,
        TenantProvisioningStatus.IN_PROGRESS,
    )

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_tenant(self, tenant_id: str) -> Tenant:
        stmt: Select[tuple[Tenant]] = select(Tenant).where(Tenant.id == tenant_id)
        result = await self.db.execute(stmt)
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise TenantProvisioningJobNotFoundError(f"Tenant {tenant_id} not found")
        return tenant

    async def _ensure_no_active_job(self, tenant_id: str) -> None:
        stmt = (
            select(TenantProvisioningJob)
            .where(
                TenantProvisioningJob.tenant_id == tenant_id,
                TenantProvisioningJob.status.in_(self.ACTIVE_STATUSES),
            )
            .limit(1)
        )
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            raise TenantProvisioningConflictError(
                f"Tenant {tenant_id} already has an active provisioning job ({existing.id})"
            )

    async def create_job(
        self,
        tenant_id: str,
        payload: TenantProvisioningJobCreate,
        requested_by: str | None = None,
    ) -> TenantProvisioningJob:
        """Create a new provisioning job and transition tenant state."""
        tenant = await self._get_tenant(tenant_id)
        await self._ensure_no_active_job(tenant_id)

        job = TenantProvisioningJob(
            tenant_id=tenant_id,
            deployment_mode=payload.deployment_mode,
            awx_template_id=payload.awx_template_id,
            extra_vars=payload.extra_vars or {},
            connection_profile=payload.connection_profile,
            created_by=requested_by,
            updated_by=requested_by,
        )
        self.db.add(job)
        await self.db.flush()

        # Transition tenant to provisioning state if not already there.
        if tenant.status not in (
            TenantStatus.PROVISIONING,
            TenantStatus.PROVISIONED,
        ):
            tenant.status = TenantStatus.PROVISIONING
            tenant.updated_by = requested_by
            metadata = dict(tenant.custom_metadata or {})
            metadata.setdefault("provisioning", {})
            metadata["provisioning"].update(
                {
                    "last_job_id": job.id,
                    "deployment_mode": payload.deployment_mode.value,
                    "requested_at": datetime.now(UTC).isoformat(),
                }
            )
            tenant.custom_metadata = metadata

        await self.db.commit()
        await self.db.refresh(job)
        await self.db.refresh(tenant)
        return job

    async def list_jobs(
        self,
        tenant_id: str,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[TenantProvisioningJob], int]:
        """Return paginated provisioning jobs for a tenant."""
        stmt = (
            select(TenantProvisioningJob)
            .where(TenantProvisioningJob.tenant_id == tenant_id)
            .order_by(TenantProvisioningJob.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt.options(selectinload(TenantProvisioningJob.tenant)))
        jobs = list(result.scalars())

        count_stmt = select(func.count()).select_from(
            select(TenantProvisioningJob.id)
            .where(TenantProvisioningJob.tenant_id == tenant_id)
            .subquery()
        )
        total = await self.db.scalar(count_stmt)
        return jobs, int(total or 0)

    async def get_job(self, tenant_id: str, job_id: str) -> TenantProvisioningJob:
        """Fetch a specific job for a tenant."""
        stmt = select(TenantProvisioningJob).where(
            TenantProvisioningJob.id == job_id, TenantProvisioningJob.tenant_id == tenant_id
        )
        result = await self.db.execute(stmt)
        job = result.scalar_one_or_none()
        if not job:
            raise TenantProvisioningJobNotFoundError(
                f"Provisioning job {job_id} not found for tenant {tenant_id}"
            )
        return job

    async def update_status(
        self,
        job_id: str,
        status: TenantProvisioningStatus,
        *,
        awx_job_id: int | None = None,
        error: str | None = None,
        requested_by: str | None = None,
    ) -> TenantProvisioningJob:
        """Update status metadata for a provisioning job."""
        stmt = select(TenantProvisioningJob).where(TenantProvisioningJob.id == job_id)
        result = await self.db.execute(stmt)
        job = result.scalar_one_or_none()
        if not job:
            raise TenantProvisioningJobNotFoundError(f"Provisioning job {job_id} not found")

        job.status = status
        if awx_job_id is not None:
            job.awx_job_id = awx_job_id
        if error:
            job.error_message = error
        job.updated_by = requested_by
        if status == TenantProvisioningStatus.IN_PROGRESS and job.started_at is None:
            job.started_at = datetime.now(UTC)
        if status in (TenantProvisioningStatus.SUCCEEDED, TenantProvisioningStatus.FAILED):
            job.finished_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def mark_cancelled(self, job_id: str, reason: str | None = None) -> TenantProvisioningJob:
        """Cancel an in-progress provisioning job."""
        job = await self.update_status(
            job_id,
            TenantProvisioningStatus.CANCELLED,
            error=reason,
        )
        return job

    async def record_acknowledgement(self, job_id: str) -> None:
        """Update the acknowledgement timestamp for streaming updates."""
        stmt = select(TenantProvisioningJob).where(TenantProvisioningJob.id == job_id)
        result = await self.db.execute(stmt)
        job = result.scalar_one_or_none()
        if not job:
            raise TenantProvisioningJobNotFoundError(f"Provisioning job {job_id} not found")
        job.last_acknowledged_at = datetime.now(UTC)
        await self.db.commit()


__all__ = [
    "TenantProvisioningService",
    "TenantProvisioningJobNotFoundError",
    "TenantProvisioningConflictError",
]
