"""Ansible/AWX API Router"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.ansible.client import AWXClient
from dotmac.platform.ansible.schemas import (
    AWXHealthResponse,
    Job,
    JobLaunchRequest,
    JobLaunchResponse,
    JobTemplate,
)
from dotmac.platform.ansible.service import AWXService
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.tenant.dependencies import TenantAdminAccess
from dotmac.platform.tenant.oss_config import OSSService, get_service_config

router = APIRouter(prefix="/ansible", tags=["Ansible"])


async def get_awx_service(
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
) -> AWXService:
    """Get AWX service instance for the active tenant."""
    _, tenant = tenant_access
    try:
        config = await get_service_config(session, tenant.id, OSSService.ANSIBLE)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
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


@router.get(
    "/health",
    response_model=AWXHealthResponse,
    summary="AWX Health Check",
)
async def health_check(
    service: AWXService = Depends(get_awx_service),
    _: UserInfo = Depends(require_permission("isp.automation.read")),
) -> AWXHealthResponse:
    """Check AWX health"""
    return await service.health_check()


@router.get(
    "/job-templates",
    response_model=list[JobTemplate],
    summary="List Job Templates",
)
async def list_job_templates(
    service: AWXService = Depends(get_awx_service),
    _: UserInfo = Depends(require_permission("isp.automation.read")),
) -> list[JobTemplate]:
    """List job templates"""
    return await service.list_job_templates()


@router.get(
    "/job-templates/{template_id}",
    response_model=JobTemplate,
    summary="Get Job Template",
)
async def get_job_template(
    template_id: int,
    service: AWXService = Depends(get_awx_service),
    _: UserInfo = Depends(require_permission("isp.automation.read")),
) -> JobTemplate:
    """Get job template"""
    template = await service.get_job_template(template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job template {template_id} not found",
        )
    return template


@router.post(
    "/jobs/launch",
    response_model=JobLaunchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Launch Job",
)
async def launch_job(
    request: JobLaunchRequest,
    service: AWXService = Depends(get_awx_service),
    _: UserInfo = Depends(require_permission("isp.automation.execute")),
) -> JobLaunchResponse:
    """Launch job from template"""
    try:
        return await service.launch_job(request.template_id, request.extra_vars)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to launch job: {str(e)}",
        )


@router.get(
    "/jobs",
    response_model=list[Job],
    summary="List Jobs",
)
async def list_jobs(
    service: AWXService = Depends(get_awx_service),
    _: UserInfo = Depends(require_permission("isp.automation.read")),
) -> list[Job]:
    """List jobs"""
    return await service.list_jobs()


@router.get(
    "/jobs/{job_id}",
    response_model=Job,
    summary="Get Job",
)
async def get_job(
    job_id: int,
    service: AWXService = Depends(get_awx_service),
    _: UserInfo = Depends(require_permission("isp.automation.read")),
) -> Job:
    """Get job details"""
    job = await service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    return job


@router.post(
    "/jobs/{job_id}/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel Job",
)
async def cancel_job(
    job_id: int,
    service: AWXService = Depends(get_awx_service),
    _: UserInfo = Depends(require_permission("isp.automation.execute")),
) -> None:
    """Cancel running job"""
    cancelled = await service.cancel_job(job_id)
    if not cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to cancel job {job_id}",
        )
    return None
