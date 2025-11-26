"""
Orchestration API Router

REST API endpoints for workflow orchestration.
"""

# mypy: disable-error-code="arg-type,union-attr,assignment"

import csv
import io
import json
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from ..auth.core import UserInfo, get_current_user
from ..auth.rbac_dependencies import require_any_permission, require_permissions
from ..db import get_async_session, get_db
from ..tenant import get_current_tenant_id
from .models import WorkflowStatus, WorkflowType
from .schemas import (
    ActivateServiceRequest,
    DeprovisionSubscriberRequest,
    ProvisionSubscriberRequest,
    ProvisionSubscriberResponse,
    SuspendServiceRequest,
    WorkflowListResponse,
    WorkflowResponse,
    WorkflowStatsResponse,
)
from .service import OrchestrationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orchestration", tags=["orchestration"])


def get_orchestration_service(
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> OrchestrationService:
    """Dependency to get orchestration service."""
    tenant_id = current_user.tenant_id

    if not tenant_id:
        tenant_id = getattr(request.state, "tenant_id", None)

    if not tenant_id:
        tenant_id = get_current_tenant_id()

    if not tenant_id:
        if current_user.is_platform_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Platform administrators must specify X-Target-Tenant-ID when invoking orchestration APIs.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required for orchestration operations.",
        )

    return OrchestrationService(db=db, tenant_id=tenant_id)


def _get_initiator_id(user: UserInfo) -> str | None:
    """Extract initiator identifier from UserInfo or fallback attributes."""
    user_id_value = getattr(user, "user_id", None)
    if user_id_value is not None:
        return str(user_id_value)
    fallback_id = getattr(user, "id", None)
    if fallback_id is not None:
        return str(fallback_id)
    return None


def _permission_matches(user_permission: str, required: str) -> bool:
    """Return True if user_permission grants the required permission."""

    if user_permission == "*" or user_permission == "admin":
        return True

    if user_permission.endswith(".*") or user_permission.endswith(":*"):
        prefix = user_permission[:-2]
        return required.startswith(prefix)

    return user_permission == required


def _has_permissions_local(user: UserInfo, permissions: tuple[str, ...], mode: str) -> bool:
    perms = set(user.permissions or [])

    if getattr(user, "is_platform_admin", False) is True or "*" in perms or "admin" in perms:
        return True

    if mode == "all":
        return all(
            any(_permission_matches(user_perm, required) for user_perm in perms)
            for required in permissions
        )

    return any(
        any(_permission_matches(user_perm, required) for user_perm in perms)
        for required in permissions
    )


def require_permissions_with_cache(*permissions: str) -> Callable[..., Awaitable[UserInfo]]:
    base_checker = cast(
        Callable[..., Awaitable[UserInfo]],
        require_permissions(*permissions),
    )

    async def dependency(
        current_user: UserInfo = Depends(get_current_user),
        db: AsyncSession = Depends(get_async_session),
    ) -> UserInfo:
        if _has_permissions_local(current_user, permissions, mode="all"):
            return current_user
        try:
            return await base_checker(current_user=current_user, db=db)
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            logger.warning(
                "Permission fallback check failed due to database error",
                exc_info=exc,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required: {list(permissions)}",
            )

    return dependency


def require_permission_with_cache(permission: str) -> Callable[..., Awaitable[UserInfo]]:
    return require_permissions_with_cache(permission)


def require_any_permission_with_cache(*permissions: str) -> Callable[..., Awaitable[UserInfo]]:
    base_checker = cast(
        Callable[..., Awaitable[UserInfo]],
        require_any_permission(*permissions),
    )

    async def dependency(
        current_user: UserInfo = Depends(get_current_user),
        db: AsyncSession = Depends(get_async_session),
    ) -> UserInfo:
        if _has_permissions_local(current_user, permissions, mode="any"):
            return current_user
        try:
            return await base_checker(current_user=current_user, db=db)
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            logger.warning(
                "Permission fallback check failed due to database error",
                exc_info=exc,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required: {list(permissions)}",
            )

    return dependency


# ============================================================================
# Subscriber Provisioning
# ============================================================================


@router.post(
    "/provision-subscriber",
    response_model=ProvisionSubscriberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision New Subscriber",
    description="""
    Atomically provision a new subscriber across all systems.

    This orchestrated workflow:
    1. Creates customer record (if needed)
    2. Creates subscriber record
    3. Creates RADIUS authentication account
    4. Allocates IP address from NetBox
    5. Activates ONU in VOLTHA
    6. Configures CPE in GenieACS
    7. Creates billing service record

    **Automatic Rollback:** If any step fails, all completed steps are
    automatically rolled back to maintain data consistency.

    **Benefits:**
    - Single API call instead of 6+ sequential calls
    - Atomic operation with rollback
    - Consistent error handling
    - Transaction management across systems
    """,
)
async def provision_subscriber(
    request: ProvisionSubscriberRequest,
    service: OrchestrationService = Depends(get_orchestration_service),
    current_user: UserInfo = Depends(
        require_permissions_with_cache("customers.create", "subscribers.create")
    ),
) -> ProvisionSubscriberResponse:
    """
    Provision new subscriber with automatic multi-system orchestration.

    **Required Permissions:** `customers.create`, `subscribers.create`
    """
    try:
        result = await service.provision_subscriber(
            request=request,
            initiator_id=_get_initiator_id(current_user),
            initiator_type="user",
        )
        return result

    except ValueError as e:
        logger.error(f"Validation error in provisioning: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Error provisioning subscriber: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to provision subscriber. Check logs for details.",
        )


@router.post(
    "/deprovision-subscriber",
    response_model=WorkflowResponse,
    summary="Deprovision Subscriber",
    description="""
    Atomically deprovision a subscriber across all systems.

    This removes the subscriber from:
    - Subscriber database
    - RADIUS authentication
    - NetBox IP allocations
    - VOLTHA ONU configuration
    - GenieACS CPE management
    - Billing services
    """,
)
async def deprovision_subscriber(
    request: DeprovisionSubscriberRequest,
    service: OrchestrationService = Depends(get_orchestration_service),
    current_user: UserInfo = Depends(require_permission_with_cache("subscribers.delete")),
) -> WorkflowResponse:
    """
    Deprovision subscriber with automatic multi-system cleanup.

    **Required Permissions:** `subscribers.delete`
    """
    try:
        result = await service.deprovision_subscriber(
            request=request,
            initiator_id=_get_initiator_id(current_user),
            initiator_type="user",
        )
        return result

    except ValueError as e:
        logger.error(f"Validation error in deprovisioning: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Error deprovisioning subscriber: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deprovision subscriber. Check logs for details.",
        )


@router.post(
    "/activate-service",
    response_model=WorkflowResponse,
    summary="Activate Service",
    description="Activate a pending subscriber service.",
)
async def activate_service(
    request: ActivateServiceRequest,
    service: OrchestrationService = Depends(get_orchestration_service),
    current_user: UserInfo = Depends(require_permission_with_cache("subscribers.update")),
) -> WorkflowResponse:
    """
    Activate subscriber service.

    **Required Permissions:** `subscribers.update`
    """
    try:
        result = await service.activate_service(
            request=request,
            initiator_id=_get_initiator_id(current_user),
            initiator_type="user",
        )
        return result

    except ValueError as e:
        logger.error(f"Validation error in service activation: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Error activating service: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate service. Check logs for details.",
        )


@router.post(
    "/suspend-service",
    response_model=WorkflowResponse,
    summary="Suspend Service",
    description="Suspend an active subscriber service.",
)
async def suspend_service(
    request: SuspendServiceRequest,
    service: OrchestrationService = Depends(get_orchestration_service),
    current_user: UserInfo = Depends(require_permission_with_cache("subscribers.update")),
) -> WorkflowResponse:
    """
    Suspend subscriber service.

    **Required Permissions:** `subscribers.update`
    """
    try:
        result = await service.suspend_service(
            request=request,
            initiator_id=_get_initiator_id(current_user),
            initiator_type="user",
        )
        return result

    except ValueError as e:
        logger.error(f"Validation error in service suspension: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Error suspending service: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to suspend service. Check logs for details.",
        )


# ============================================================================
# Workflow Management
# ============================================================================


@router.get(
    "/workflows",
    response_model=WorkflowListResponse,
    summary="List Workflows",
    description="List orchestration workflows with filtering and pagination.",
)
async def list_workflows(
    workflow_type: WorkflowType | None = Query(None, description="Filter by workflow type"),
    status_filter: WorkflowStatus | None = Query(
        None,
        alias="status",
        description="Filter by status",
    ),
    date_from: datetime | None = Query(
        None, description="Filter workflows created after this date"
    ),
    date_to: datetime | None = Query(None, description="Filter workflows created before this date"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    service: OrchestrationService = Depends(get_orchestration_service),
    current_user: UserInfo = Depends(
        require_any_permission_with_cache(
            "orchestration.read",
            "platform:orchestration.read",
            "subscribers.read",
            "customers.read",
            "admin",
        )
    ),
) -> WorkflowListResponse:
    """
    List orchestration workflows.

    **Required Permissions:** `orchestration.read`
    """
    try:
        result = await service.list_workflows(
            workflow_type=workflow_type,
            status=status_filter,
            limit=limit,
            offset=offset,
            date_from=date_from,
            date_to=date_to,
        )

        if isinstance(result, dict):
            raw_workflows = result.get("workflows", [])
            workflows = [
                WorkflowResponse.model_validate(item) if isinstance(item, dict) else item
                for item in raw_workflows
            ]
            total = result.get("total", len(workflows))
            limit_value = result.get("limit", limit)
            offset_value = result.get("offset", offset)
        else:
            workflows = [wf if isinstance(wf, WorkflowResponse) else wf for wf in list(result)]
            total = getattr(result, "total", len(workflows))
            limit_value = getattr(result, "limit", limit)
            offset_value = getattr(result, "offset", offset)

        return WorkflowListResponse(
            workflows=workflows,
            total=total,
            limit=limit_value,
            offset=offset_value,
        )
    except Exception as e:
        logger.exception(f"Error listing workflows: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list workflows",
        )


@router.get(
    "/workflows/{workflow_id}",
    response_model=WorkflowResponse,
    summary="Get Workflow",
    description="Get detailed workflow information including all steps.",
)
async def get_workflow(
    workflow_id: str,
    service: OrchestrationService = Depends(get_orchestration_service),
    current_user: UserInfo = Depends(
        require_any_permission_with_cache(
            "orchestration.read",
            "platform:orchestration.read",
            "subscribers.read",
            "customers.read",
            "admin",
        )
    ),
) -> WorkflowResponse:
    """
    Get workflow by ID.

    **Required Permissions:** `orchestration.read`
    """
    workflow = await service.get_workflow(workflow_id)

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow not found: {workflow_id}",
        )

    return workflow


@router.post(
    "/workflows/{workflow_id}/retry",
    response_model=WorkflowResponse,
    summary="Retry Workflow",
    description="Retry a failed workflow from the failed step.",
)
async def retry_workflow(
    workflow_id: str,
    service: OrchestrationService = Depends(get_orchestration_service),
    current_user: UserInfo = Depends(
        require_any_permission_with_cache("orchestration.update", "admin")
    ),
) -> WorkflowResponse:
    """
    Retry failed workflow.

    **Required Permissions:** `orchestration.update`
    """
    try:
        return await service.retry_workflow(workflow_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Error retrying workflow {workflow_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retry workflow",
        )


@router.post(
    "/workflows/{workflow_id}/cancel",
    response_model=WorkflowResponse,
    summary="Cancel Workflow",
    description="Cancel a running workflow and roll back completed steps.",
)
async def cancel_workflow(
    workflow_id: str,
    service: OrchestrationService = Depends(get_orchestration_service),
    _current_user: UserInfo = Depends(
        require_any_permission_with_cache("orchestration.update", "admin")
    ),
) -> WorkflowResponse:
    """
    Cancel running workflow.

    **Required Permissions:** `orchestration.update`
    """
    try:
        return await service.cancel_workflow(workflow_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Error cancelling workflow {workflow_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel workflow",
        )


@router.get(
    "/statistics",
    response_model=WorkflowStatsResponse,
    summary="Get Statistics",
    description="Get orchestration workflow statistics and metrics.",
)
async def get_statistics(
    service: OrchestrationService = Depends(get_orchestration_service),
    current_user: UserInfo = Depends(
        require_any_permission_with_cache(
            "orchestration.read",
            "platform:orchestration.read",
            "subscribers.read",
            "customers.read",
            "admin",
        )
    ),
) -> WorkflowStatsResponse:
    """
    Get workflow statistics.

    **Required Permissions:** `orchestration.read`
    """
    try:
        return await service.get_workflow_statistics()
    except Exception as e:
        logger.exception(f"Error getting workflow statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get statistics",
        )


# ============================================================================
# Export Endpoints
# ============================================================================


@router.get(
    "/export/csv",
    summary="Export Workflows CSV",
    description="""
    Export workflow data as CSV file.

    This endpoint allows exporting workflow history with filters for
    reporting and analysis purposes.
    """,
)
async def export_workflows_csv(
    workflow_type: WorkflowType | None = Query(None, description="Filter by workflow type"),
    status_filter: WorkflowStatus | None = Query(None, description="Filter by status"),
    date_from: datetime | None = Query(None, description="Start date filter"),
    date_to: datetime | None = Query(None, description="End date filter"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum records to export"),
    service: OrchestrationService = Depends(get_orchestration_service),
    _current_user: UserInfo = Depends(
        require_any_permission_with_cache(
            "orchestration.read",
            "platform:orchestration.read",
            "subscribers.read",
            "customers.read",
            "admin",
        )
    ),
) -> Response:
    """
    Export workflows to CSV format.

    **Required Permissions:** `orchestration.read`
    """
    try:
        # Fetch workflows with filters
        result = await service.list_workflows(
            workflow_type=workflow_type,
            status=status_filter,
            limit=limit,
            offset=0,
            date_from=date_from,
            date_to=date_to,
        )
        if isinstance(result, dict):
            workflows = [
                WorkflowResponse.model_validate(item) if isinstance(item, dict) else item
                for item in result.get("workflows", [])
            ]
        else:
            workflows = [wf if isinstance(wf, WorkflowResponse) else wf for wf in list(result)]

        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(
            [
                "Workflow ID",
                "Type",
                "Status",
                "Started At",
                "Completed At",
                "Duration (seconds)",
                "Retry Count",
                "Error Message",
                "Steps Completed",
                "Total Steps",
            ]
        )

        # Write data rows
        for workflow in workflows:
            duration = None
            if workflow.started_at and workflow.completed_at:
                duration = (workflow.completed_at - workflow.started_at).total_seconds()

            steps_completed = sum(1 for step in workflow.steps if step.status == "completed")
            total_steps = len(workflow.steps)

            writer.writerow(
                [
                    workflow.workflow_id,
                    workflow.workflow_type.value,
                    workflow.status.value,
                    workflow.started_at.isoformat() if workflow.started_at else "",
                    workflow.completed_at.isoformat() if workflow.completed_at else "",
                    f"{duration:.2f}" if duration else "",
                    workflow.retry_count,
                    workflow.error_message or "",
                    steps_completed,
                    total_steps,
                ]
            )

        # Create response with CSV content
        csv_content = output.getvalue()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"workflows_export_{timestamp}.csv"

        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except Exception as e:
        logger.exception(f"Error exporting workflows to CSV: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export workflows",
        )


@router.get(
    "/export/json",
    summary="Export Workflows JSON",
    description="""
    Export workflow data as JSON file with full details.

    This endpoint provides comprehensive workflow data including
    all steps, input/output data, and metadata for detailed analysis.
    """,
)
async def export_workflows_json(
    workflow_type: WorkflowType | None = Query(None, description="Filter by workflow type"),
    status_filter: WorkflowStatus | None = Query(None, description="Filter by status"),
    date_from: datetime | None = Query(None, description="Start date filter"),
    date_to: datetime | None = Query(None, description="End date filter"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum records to export"),
    include_steps: bool = Query(True, description="Include workflow step details"),
    include_data: bool = Query(False, description="Include input/output data"),
    service: OrchestrationService = Depends(get_orchestration_service),
    current_user: UserInfo = Depends(
        require_any_permission_with_cache(
            "orchestration.read",
            "platform:orchestration.read",
            "subscribers.read",
            "customers.read",
            "admin",
        )
    ),
) -> Response:
    """
    Export workflows to JSON format.

    **Required Permissions:** `orchestration.read`
    """
    try:
        # Fetch workflows with filters
        result = await service.list_workflows(
            workflow_type=workflow_type,
            status=status_filter,
            limit=limit,
            offset=0,
            date_from=date_from,
            date_to=date_to,
        )
        if isinstance(result, dict):
            workflows = [
                WorkflowResponse.model_validate(item) if isinstance(item, dict) else item
                for item in result.get("workflows", [])
            ]
        else:
            workflows = [wf if isinstance(wf, WorkflowResponse) else wf for wf in list(result)]

        # Get statistics for the export
        stats = await service.get_workflow_statistics()

        # Build export data structure
        export_data: dict[str, Any] = {
            "generated_at": datetime.now().isoformat(),
            "generated_by": current_user.email,
            "tenant_id": current_user.tenant_id,
            "filters": {
                "workflow_type": workflow_type.value if workflow_type else None,
                "status": status_filter.value if status_filter else None,
                "date_from": date_from.isoformat() if date_from else None,
                "date_to": date_to.isoformat() if date_to else None,
            },
            "summary": {
                "total_workflows": getattr(result, "total", len(workflows)),
                "exported_workflows": len(workflows),
                "success_rate": stats.success_rate,
                "average_duration_seconds": stats.average_duration_seconds,
            },
            "workflows": [],
        }

        # Process each workflow
        for workflow in workflows:
            workflow_data = {
                "workflow_id": workflow.workflow_id,
                "workflow_type": workflow.workflow_type.value,
                "status": workflow.status.value,
                "started_at": workflow.started_at.isoformat() if workflow.started_at else None,
                "completed_at": (
                    workflow.completed_at.isoformat() if workflow.completed_at else None
                ),
                "failed_at": workflow.failed_at.isoformat() if workflow.failed_at else None,
                "retry_count": workflow.retry_count,
                "error_message": workflow.error_message,
            }

            # Calculate duration
            if workflow.started_at and workflow.completed_at:
                duration = (workflow.completed_at - workflow.started_at).total_seconds()
                workflow_data["duration_seconds"] = duration

            # Include steps if requested
            if include_steps and workflow.steps:
                workflow_data["steps"] = [
                    {
                        "step_id": step.step_id,
                        "step_name": step.step_name,
                        "step_order": step.step_order,
                        "target_system": step.target_system,
                        "status": step.status.value,
                        "started_at": step.started_at.isoformat() if step.started_at else None,
                        "completed_at": (
                            step.completed_at.isoformat() if step.completed_at else None
                        ),
                        "failed_at": step.failed_at.isoformat() if step.failed_at else None,
                        "error_message": step.error_message,
                        "retry_count": step.retry_count,
                    }
                    for step in workflow.steps
                ]

                workflow_data["steps_summary"] = {
                    "total": len(workflow.steps),
                    "completed": sum(1 for s in workflow.steps if s.status == "completed"),
                    "failed": sum(1 for s in workflow.steps if s.status == "failed"),
                    "pending": sum(1 for s in workflow.steps if s.status == "pending"),
                }

            export_data["workflows"].append(workflow_data)

        # Create JSON response
        json_content = json.dumps(export_data, indent=2, default=str)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"workflows_export_{timestamp}.json"

        return Response(
            content=json_content,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except Exception as e:
        logger.exception(f"Error exporting workflows to JSON: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export workflows",
        )


@router.get(
    "/stats",
    response_model=WorkflowStatsResponse,
    summary="Get Workflow Statistics",
    description="""
    Get aggregated workflow statistics.

    This is an alias for /statistics endpoint for frontend compatibility.
    """,
)
async def get_stats(
    service: OrchestrationService = Depends(get_orchestration_service),
    _current_user: UserInfo = Depends(
        require_any_permission(
            "orchestration.read",
            "platform:orchestration.read",
            "subscribers.read",
            "customers.read",
            "admin",
        )
    ),
) -> WorkflowStatsResponse:
    """
    Get workflow statistics (alias endpoint).

    **Required Permissions:** `orchestration.read`
    """
    return await get_statistics(service=service)
