"""
Deployment API Router

REST API endpoints for deployment orchestration.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth.core import UserInfo
from ..auth.rbac_dependencies import require_permissions
from ..dependencies import get_db
from ..settings import get_settings
from .models import (
    DeploymentBackend,
    DeploymentExecution,
    DeploymentHealth,
    DeploymentInstance,
    DeploymentState,
    DeploymentTemplate,
    DeploymentType,
)
from .registry import DeploymentRegistry
from .schemas import (
    DeploymentExecutionResponse,
    DeploymentHealthResponse,
    DeploymentInstanceResponse,
    DeploymentListResponse,
    DeploymentStatusResponse,
    DeploymentTemplateCreate,
    DeploymentTemplateResponse,
    DeploymentTemplateUpdate,
    DestroyRequest,
    OperationResponse,
    ProvisionRequest,
    ResumeRequest,
    ScaleRequest,
    ScheduledDeploymentRequest,
    ScheduledDeploymentResponse,
    SuspendRequest,
    UpgradeRequest,
)
from .service import DeploymentService

logger = logging.getLogger(__name__)

router = APIRouter()


def get_deployment_service(db: Session = Depends(get_db)) -> DeploymentService:
    """Get deployment service instance with adapter configurations from settings"""
    settings = get_settings()

    # Build adapter configs from settings
    adapter_configs: dict[DeploymentBackend, dict] = {}

    # AWX/Ansible adapter configuration
    if settings.oss.ansible.url:
        adapter_configs[DeploymentBackend.AWX_ANSIBLE] = {
            "awx_url": settings.oss.ansible.url,
            "awx_token": settings.oss.ansible.api_token,
            "awx_username": settings.oss.ansible.username,
            "awx_password": settings.oss.ansible.password,
            "verify_ssl": settings.oss.ansible.verify_ssl,
            "timeout_seconds": settings.oss.ansible.timeout_seconds,
            "max_retries": settings.oss.ansible.max_retries,
        }

    # Kubernetes adapter configuration
    # Note: Kubernetes config not yet in settings - will use adapter defaults
    # Future: Add to settings.deployment.kubernetes when needed

    # Docker Compose adapter configuration
    # Note: Docker Compose config not yet in settings - will use adapter defaults
    # Future: Add to settings.deployment.docker_compose when needed

    return DeploymentService(db, adapter_configs=adapter_configs)


# ============================================================================
# Template Endpoints
# ============================================================================


@router.get("/templates", response_model=list[DeploymentTemplateResponse])
async def list_templates(
    is_active: bool | None = Query(None),
    backend: DeploymentBackend | None = Query(None),
    deployment_type: DeploymentType | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.template.read")),
) -> list[DeploymentTemplate]:
    """List deployment templates"""
    registry = DeploymentRegistry(db)
    templates, total = registry.list_templates(is_active=is_active, skip=skip, limit=limit)
    return templates


@router.post(
    "/templates", response_model=DeploymentTemplateResponse, status_code=status.HTTP_201_CREATED
)
async def create_template(
    template: DeploymentTemplateCreate,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.template.create")),
) -> DeploymentTemplate:
    """Create deployment template"""
    from .models import DeploymentTemplate

    registry = DeploymentRegistry(db)

    # Check if template name already exists
    existing = registry.get_template_by_name(template.name)
    if existing:
        raise HTTPException(status_code=400, detail=f"Template '{template.name}' already exists")

    new_template = DeploymentTemplate(**template.dict())
    return registry.create_template(new_template)


@router.get("/templates/{template_id}", response_model=DeploymentTemplateResponse)
async def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.template.read")),
) -> DeploymentTemplate:
    """Get deployment template"""
    registry = DeploymentRegistry(db)
    template = registry.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found")
    return template


@router.patch("/templates/{template_id}", response_model=DeploymentTemplateResponse)
async def update_template(
    template_id: int,
    updates: DeploymentTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.template.update")),
) -> DeploymentTemplate:
    """Update deployment template"""
    registry = DeploymentRegistry(db)
    template = registry.update_template(template_id, **updates.dict(exclude_unset=True))
    if not template:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found")
    return template


# ============================================================================
# Instance Endpoints
# ============================================================================


@router.get("/instances", response_model=DeploymentListResponse)
async def list_instances(
    tenant_id: int | None = Query(None),
    state: DeploymentState | None = Query(None),
    environment: str | None = Query(None),
    region: str | None = Query(None),
    template_id: int | None = Query(None),
    health_status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.read")),
) -> DeploymentListResponse:
    """List deployment instances"""
    registry = DeploymentRegistry(db)

    instances, total = registry.list_instances(
        tenant_id=tenant_id,
        state=state,
        environment=environment,
        region=region,
        template_id=template_id,
        health_status=health_status,
        skip=skip,
        limit=limit,
    )

    return DeploymentListResponse(
        instances=instances,
        total=total,
        page=skip // limit + 1,
        page_size=limit,
        pages=(total + limit - 1) // limit,
    )


@router.get("/instances/{instance_id}", response_model=DeploymentInstanceResponse)
async def get_instance(
    instance_id: int,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.read")),
) -> DeploymentInstance:
    """Get deployment instance"""
    registry = DeploymentRegistry(db)
    instance = registry.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=404, detail=f"Instance {instance_id} not found")
    return instance


@router.get("/instances/{instance_id}/status", response_model=DeploymentStatusResponse)
async def get_instance_status(
    instance_id: int,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.read")),
) -> DeploymentStatusResponse:
    """Get deployment instance status"""
    registry = DeploymentRegistry(db)
    instance = registry.get_instance(instance_id)
    if instance is None:
        raise HTTPException(status_code=404, detail=f"Instance {instance_id} not found")

    # Calculate uptime
    uptime_seconds = None
    if instance.created_at:
        from datetime import datetime

        uptime_seconds = int((datetime.utcnow() - instance.created_at).total_seconds())

    return DeploymentStatusResponse(
        instance_id=instance.id,
        tenant_id=instance.tenant_id,
        environment=instance.environment,
        state=instance.state,
        health_status=instance.health_status,
        version=instance.version,
        endpoints=instance.endpoints,
        last_health_check=instance.last_health_check,
        uptime_seconds=uptime_seconds,
    )


# ============================================================================
# Operation Endpoints
# ============================================================================


@router.post("/provision", response_model=OperationResponse, status_code=status.HTTP_202_ACCEPTED)
async def provision_deployment(
    request: ProvisionRequest,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.create")),
    service: DeploymentService = Depends(get_deployment_service),
) -> OperationResponse:
    """Provision new deployment"""
    try:
        # Get tenant_id from current user
        tenant_id = current_user.tenant_id

        instance, execution = await service.provision_deployment(
            tenant_id=tenant_id, request=request, triggered_by=current_user.user_id
        )

        return OperationResponse(
            success=True,
            message=f"Deployment provisioning started for tenant {tenant_id}",
            instance_id=instance.id,
            execution_id=execution.id,
            state=instance.state,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error provisioning deployment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to provision deployment")


@router.post(
    "/instances/{instance_id}/upgrade",
    response_model=OperationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upgrade_deployment(
    instance_id: int,
    request: UpgradeRequest,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.upgrade")),
    service: DeploymentService = Depends(get_deployment_service),
) -> OperationResponse:
    """Upgrade deployment"""
    try:
        execution = await service.upgrade_deployment(
            instance_id=instance_id, request=request, triggered_by=current_user.user_id
        )

        registry = DeploymentRegistry(db)
        instance = registry.get_instance(instance_id)
        if instance is None:
            raise HTTPException(status_code=404, detail=f"Instance {instance_id} not found")

        return OperationResponse(
            success=True,
            message=f"Deployment upgrade to {request.to_version} started",
            instance_id=instance_id,
            execution_id=execution.id,
            state=instance.state,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error upgrading deployment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upgrade deployment")


@router.post(
    "/instances/{instance_id}/scale",
    response_model=OperationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def scale_deployment(
    instance_id: int,
    request: ScaleRequest,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.scale")),
    service: DeploymentService = Depends(get_deployment_service),
) -> OperationResponse:
    """Scale deployment resources"""
    try:
        execution = await service.scale_deployment(
            instance_id=instance_id, request=request, triggered_by=current_user.user_id
        )

        registry = DeploymentRegistry(db)
        instance = registry.get_instance(instance_id)
        if instance is None:
            raise HTTPException(status_code=404, detail=f"Instance {instance_id} not found")

        return OperationResponse(
            success=True,
            message="Deployment scaling started",
            instance_id=instance_id,
            execution_id=execution.id,
            state=instance.state,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error scaling deployment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to scale deployment")


@router.post(
    "/instances/{instance_id}/suspend",
    response_model=OperationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def suspend_deployment(
    instance_id: int,
    request: SuspendRequest,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.suspend")),
    service: DeploymentService = Depends(get_deployment_service),
) -> OperationResponse:
    """Suspend deployment"""
    try:
        execution = await service.suspend_deployment(
            instance_id=instance_id, reason=request.reason, triggered_by=current_user.user_id
        )

        registry = DeploymentRegistry(db)
        instance = registry.get_instance(instance_id)
        if instance is None:
            raise HTTPException(status_code=404, detail=f"Instance {instance_id} not found")

        return OperationResponse(
            success=True,
            message="Deployment suspension started",
            instance_id=instance_id,
            execution_id=execution.id,
            state=instance.state,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error suspending deployment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to suspend deployment")


@router.post(
    "/instances/{instance_id}/resume",
    response_model=OperationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def resume_deployment(
    instance_id: int,
    request: ResumeRequest,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.resume")),
    service: DeploymentService = Depends(get_deployment_service),
) -> OperationResponse:
    """Resume suspended deployment"""
    try:
        execution = await service.resume_deployment(
            instance_id=instance_id, reason=request.reason, triggered_by=current_user.user_id
        )

        registry = DeploymentRegistry(db)
        instance = registry.get_instance(instance_id)
        if instance is None:
            raise HTTPException(status_code=404, detail=f"Instance {instance_id} not found")

        return OperationResponse(
            success=True,
            message="Deployment resume started",
            instance_id=instance_id,
            execution_id=execution.id,
            state=instance.state,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error resuming deployment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to resume deployment")


@router.delete(
    "/instances/{instance_id}",
    response_model=OperationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def destroy_deployment(
    instance_id: int,
    request: DestroyRequest,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.destroy")),
    service: DeploymentService = Depends(get_deployment_service),
) -> OperationResponse:
    """Destroy deployment"""
    try:
        execution = await service.destroy_deployment(
            instance_id=instance_id,
            reason=request.reason,
            backup_data=request.backup_data,
            triggered_by=current_user.user_id,
        )

        registry = DeploymentRegistry(db)
        instance = registry.get_instance(instance_id)
        if instance is None:
            raise HTTPException(status_code=404, detail=f"Instance {instance_id} not found")

        return OperationResponse(
            success=True,
            message="Deployment destruction started",
            instance_id=instance_id,
            execution_id=execution.id,
            state=instance.state,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error destroying deployment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to destroy deployment")


# ============================================================================
# Execution History
# ============================================================================


@router.get("/instances/{instance_id}/executions", response_model=list[DeploymentExecutionResponse])
async def list_executions(
    instance_id: int,
    operation: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.read")),
) -> list[DeploymentExecution]:
    """List execution history for instance"""
    registry = DeploymentRegistry(db)
    executions, total = registry.list_executions(
        instance_id=instance_id, operation=operation, skip=skip, limit=limit
    )
    return executions


@router.get("/executions/{execution_id}", response_model=DeploymentExecutionResponse)
async def get_execution(
    execution_id: int,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.read")),
) -> DeploymentExecution:
    """Get execution details"""
    registry = DeploymentRegistry(db)
    execution = registry.get_execution(execution_id)
    if execution is None:
        raise HTTPException(status_code=404, detail=f"Execution {execution_id} not found")
    return execution


# ============================================================================
# Health Monitoring
# ============================================================================


@router.get("/instances/{instance_id}/health", response_model=list[DeploymentHealthResponse])
async def list_health_records(
    instance_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.read")),
) -> list[DeploymentHealth]:
    """List health check history"""
    registry = DeploymentRegistry(db)
    records, total = registry.list_health_records(instance_id=instance_id, skip=skip, limit=limit)
    return records


@router.post("/instances/{instance_id}/health-check", response_model=DeploymentHealthResponse)
async def trigger_health_check(
    instance_id: int,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.instance.health_check")),
    service: DeploymentService = Depends(get_deployment_service),
) -> DeploymentHealth:
    """Trigger manual health check"""
    try:
        health = await service.check_health(instance_id)
        return health
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error checking health: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Health check failed")


# ============================================================================
# Statistics
# ============================================================================


@router.get("/stats")
async def get_deployment_stats(
    tenant_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.stats.read")),
) -> dict[str, Any]:
    """Get deployment statistics"""
    registry = DeploymentRegistry(db)
    return registry.get_deployment_stats(tenant_id=tenant_id)


@router.get("/stats/templates")
async def get_template_usage_stats(
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.stats.read")),
) -> dict[str, Any]:
    """Get template usage statistics"""
    registry = DeploymentRegistry(db)
    return registry.get_template_usage_stats()


@router.get("/stats/resources")
async def get_resource_allocation(
    tenant_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.stats.read")),
) -> dict[str, Any]:
    """Get resource allocation statistics"""
    registry = DeploymentRegistry(db)
    return registry.get_resource_allocation(tenant_id=tenant_id)


# ============================================================================
# Scheduled Deployments
# ============================================================================


@router.post(
    "/schedule", response_model=ScheduledDeploymentResponse, status_code=status.HTTP_201_CREATED
)
async def schedule_deployment(
    request: ScheduledDeploymentRequest,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(require_permissions("deployment.schedule.create")),
    service: DeploymentService = Depends(get_deployment_service),
) -> ScheduledDeploymentResponse:
    """
    Schedule a deployment operation for future execution.

    Supports both one-time and recurring schedules:

    **One-time Schedule:**
    - Set `scheduled_at` to future timestamp
    - Omit `cron_expression` and `interval_seconds`

    **Recurring Schedule:**
    - Set `scheduled_at` to first execution time
    - Provide either `cron_expression` OR `interval_seconds` (not both)

    **Operation Types:**
    - `provision`: Create new deployment (requires `provision_request`)
    - `upgrade`: Upgrade existing deployment (requires `instance_id` and `upgrade_request`)
    - `scale`: Scale resources (requires `instance_id` and `scale_request`)
    - `suspend`: Suspend deployment (requires `instance_id`)
    - `resume`: Resume deployment (requires `instance_id`)
    - `destroy`: Destroy deployment (requires `instance_id`)

    Example:
    ```json
    {
        "operation": "upgrade",
        "instance_id": 123,
        "scheduled_at": "2024-12-01T02:00:00Z",
        "upgrade_request": {
            "to_version": "2.0.0",
            "rollback_on_failure": true
        },
        "cron_expression": "0 2 * * 0"
    }
    ```
    """
    try:
        # Get tenant_id from current user
        if not hasattr(current_user, "tenant_id") or not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current user must be associated with a tenant",
            )

        tenant_id = int(current_user.tenant_id)

        result = await service.schedule_deployment(
            tenant_id=tenant_id,
            operation=request.operation,
            scheduled_at=request.scheduled_at,
            provision_request=request.provision_request,
            upgrade_request=request.upgrade_request,
            scale_request=request.scale_request,
            instance_id=request.instance_id,
            triggered_by=current_user.user_id if hasattr(current_user, "user_id") else None,
            cron_expression=request.cron_expression,
            interval_seconds=request.interval_seconds,
            metadata=request.metadata,
        )

        return ScheduledDeploymentResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error scheduling deployment: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to schedule deployment: {str(e)}",
        )
