"""Ansible/AWX Service Layer"""

from typing import Any

import structlog

from dotmac.platform.ansible.client import AWXClient
from dotmac.platform.ansible.schemas import (
    AWXHealthResponse,
    Job,
    JobLaunchResponse,
    JobTemplate,
)

logger = structlog.get_logger(__name__)


class AWXService:
    """Service for Ansible AWX automation"""

    def __init__(self, client: AWXClient | None = None):
        self.client = client or AWXClient()

    async def health_check(self) -> AWXHealthResponse:
        """Check AWX health"""
        try:
            is_healthy = await self.client.ping()
            if is_healthy:
                templates = await self.client.get_job_templates()
                return AWXHealthResponse(
                    healthy=True,
                    message="AWX is operational",
                    total_templates=len(templates),
                )
            else:
                return AWXHealthResponse(
                    healthy=False,
                    message="AWX is not accessible",
                )
        except Exception as e:
            logger.error("awx.health_check.error", error=str(e))
            return AWXHealthResponse(
                healthy=False,
                message=f"Health check failed: {str(e)}",
            )

    async def list_job_templates(self) -> list[JobTemplate]:
        """List all job templates"""
        templates_raw = await self.client.get_job_templates()
        return [JobTemplate(**t) for t in templates_raw]

    async def get_job_template(self, template_id: int) -> JobTemplate | None:
        """Get job template by ID"""
        template = await self.client.get_job_template(template_id)
        if not template:
            return None
        return JobTemplate(**template)

    async def launch_job(
        self, template_id: int, extra_vars: dict[str, Any] | None = None
    ) -> JobLaunchResponse:
        """Launch job template"""
        try:
            result = await self.client.launch_job_template(template_id, extra_vars)
            return JobLaunchResponse(
                job_id=result.get("id", 0),
                status=result.get("status", "pending"),
                message="Job launched successfully",
            )
        except Exception as e:
            logger.error("awx.launch_job.failed", template_id=template_id, error=str(e))
            raise

    async def list_jobs(self) -> list[Job]:
        """List all jobs"""
        jobs_raw = await self.client.get_jobs()
        return [Job(**j) for j in jobs_raw]

    async def get_job(self, job_id: int) -> Job | None:
        """Get job by ID"""
        job = await self.client.get_job(job_id)
        if not job:
            return None
        return Job(**job)

    async def cancel_job(self, job_id: int) -> bool:
        """Cancel job"""
        try:
            await self.client.cancel_job(job_id)
            return True
        except Exception as e:
            logger.error("awx.cancel_job.failed", job_id=job_id, error=str(e))
            return False
