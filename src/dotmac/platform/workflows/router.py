"""
Workflow API Router

REST API endpoints for workflow management and execution.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.rbac_dependencies import require_permission
from ..db import get_async_db
from .builtin_workflows import get_all_builtin_workflows
from .models import WorkflowStatus
from .schemas import (
    WorkflowCreate,
    WorkflowExecuteRequest,
    WorkflowExecutionListResponse,
    WorkflowExecutionResponse,
    WorkflowListResponse,
    WorkflowResponse,
    WorkflowStatsResponse,
    WorkflowUpdate,
)
from .service import WorkflowService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["Workflows"])


def get_workflow_service(db: AsyncSession = Depends(get_async_db)) -> WorkflowService:
    """Dependency to get workflow service instance"""
    return WorkflowService(db)


# Workflow Template Endpoints


@router.post(
    "/",
    response_model=WorkflowResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("workflows:create"))],
)
async def create_workflow(
    workflow_data: WorkflowCreate,
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowResponse:
    """
    Create a new workflow template.

    Required permission: workflows:create
    """
    try:
        workflow = await service.create_workflow(
            name=workflow_data.name,
            definition=workflow_data.definition,
            description=workflow_data.description,
            version=workflow_data.version,
            tags=workflow_data.tags,
        )
        return WorkflowResponse.model_validate(workflow)
    except Exception as e:
        logger.error(f"Error creating workflow: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create workflow: {str(e)}",
        )


@router.get(
    "/",
    response_model=WorkflowListResponse,
    dependencies=[Depends(require_permission("workflows:read"))],
)
async def list_workflows(
    is_active: bool | None = Query(None, description="Filter by active status"),
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowListResponse:
    """
    List all workflow templates.

    Required permission: workflows:read
    """
    workflows = await service.list_workflows(is_active=is_active)
    return WorkflowListResponse(
        workflows=[WorkflowResponse.model_validate(w) for w in workflows],
        total=len(workflows),
    )


@router.get(
    "/builtin",
    response_model=list[dict],
    dependencies=[Depends(require_permission("workflows:read"))],
)
async def list_builtin_workflows() -> list[dict]:
    """
    List all built-in workflow definitions.

    Required permission: workflows:read
    """
    return get_all_builtin_workflows()


# NOTE: Specific routes like /executions and /stats must come BEFORE /{workflow_id}
# to prevent FastAPI from matching them as parameterized routes


@router.get(
    "/executions",
    response_model=WorkflowExecutionListResponse,
    dependencies=[Depends(require_permission("workflows:read"))],
)
async def list_executions(
    workflow_id: int | None = Query(None, description="Filter by workflow ID"),
    status_filter: WorkflowStatus | None = Query(
        None, alias="status", description="Filter by status"
    ),
    tenant_id: str | None = Query(None, description="Filter by tenant ID"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowExecutionListResponse:
    """
    List workflow executions with filtering.

    Required permission: workflows:read
    """
    executions = await service.list_executions(
        workflow_id=workflow_id,
        status=status_filter,
        tenant_id=tenant_id,
        limit=limit,
        offset=offset,
    )
    return WorkflowExecutionListResponse(
        executions=[WorkflowExecutionResponse.model_validate(e) for e in executions],
        total=len(executions),
    )


@router.get(
    "/stats",
    response_model=WorkflowStatsResponse,
    dependencies=[Depends(require_permission("workflows:read"))],
)
async def get_workflow_stats(
    workflow_id: int | None = Query(None, description="Filter by workflow ID"),
    tenant_id: str | None = Query(None, description="Filter by tenant ID"),
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowStatsResponse:
    """
    Get workflow execution statistics.

    Required permission: workflows:read
    """
    stats = await service.get_execution_stats(
        workflow_id=workflow_id,
        tenant_id=tenant_id,
    )
    return WorkflowStatsResponse(**stats)


@router.get(
    "/{workflow_id}",
    response_model=WorkflowResponse,
    dependencies=[Depends(require_permission("workflows:read"))],
)
async def get_workflow(
    workflow_id: int,
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowResponse:
    """
    Get a workflow template by ID.

    Required permission: workflows:read
    """
    workflow = await service.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )
    return WorkflowResponse.model_validate(workflow)


@router.patch(
    "/{workflow_id}",
    response_model=WorkflowResponse,
    dependencies=[Depends(require_permission("workflows:update"))],
)
async def update_workflow(
    workflow_id: int,
    workflow_data: WorkflowUpdate,
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowResponse:
    """
    Update a workflow template.

    Required permission: workflows:update
    """
    try:
        workflow = await service.update_workflow(
            workflow_id=workflow_id,
            definition=workflow_data.definition,
            description=workflow_data.description,
            is_active=workflow_data.is_active,
            tags=workflow_data.tags,
        )
        return WorkflowResponse.model_validate(workflow)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error updating workflow {workflow_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update workflow: {str(e)}",
        )


@router.delete(
    "/{workflow_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("workflows:delete"))],
)
async def delete_workflow(
    workflow_id: int,
    service: WorkflowService = Depends(get_workflow_service),
) -> None:
    """
    Delete a workflow template.

    Required permission: workflows:delete
    """
    try:
        await service.delete_workflow(workflow_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# Workflow Execution Endpoints


@router.post(
    "/execute",
    response_model=WorkflowExecutionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_permission("workflows:execute"))],
)
async def execute_workflow(
    request: WorkflowExecuteRequest,
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowExecutionResponse:
    """
    Execute a workflow by name.

    Required permission: workflows:execute
    """
    try:
        execution = await service.execute_workflow(
            workflow_name=request.workflow_name,
            context=request.context,
            trigger_type=request.trigger_type,
            trigger_source=request.trigger_source,
            tenant_id=request.tenant_id,
        )
        return WorkflowExecutionResponse.model_validate(execution)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error executing workflow {request.workflow_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Workflow execution failed: {str(e)}",
        )


@router.post(
    "/{workflow_id}/execute",
    response_model=WorkflowExecutionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_permission("workflows:execute"))],
)
async def execute_workflow_by_id(
    workflow_id: int,
    context: dict,
    trigger_type: str = "manual",
    trigger_source: str | None = None,
    tenant_id: str | None = None,
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowExecutionResponse:
    """
    Execute a workflow by ID.

    Required permission: workflows:execute
    """
    try:
        execution = await service.execute_workflow_by_id(
            workflow_id=workflow_id,
            context=context,
            trigger_type=trigger_type,
            trigger_source=trigger_source,
            tenant_id=tenant_id,
        )
        return WorkflowExecutionResponse.model_validate(execution)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error executing workflow {workflow_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Workflow execution failed: {str(e)}",
        )


@router.get(
    "/executions/{execution_id}",
    response_model=WorkflowExecutionResponse,
    dependencies=[Depends(require_permission("workflows:read"))],
)
async def get_execution(
    execution_id: int,
    include_steps: bool = Query(False, description="Include step details"),
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowExecutionResponse:
    """
    Get a workflow execution by ID.

    Required permission: workflows:read
    """
    execution = await service.get_execution(execution_id, include_steps=include_steps)
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execution {execution_id} not found",
        )
    return WorkflowExecutionResponse.model_validate(execution)


@router.post(
    "/executions/{execution_id}/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("workflows:execute"))],
)
async def cancel_execution(
    execution_id: int,
    service: WorkflowService = Depends(get_workflow_service),
) -> None:
    """
    Cancel a running workflow execution.

    Required permission: workflows:execute
    """
    try:
        await service.cancel_execution(execution_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# Statistics Endpoints


@router.get(
    "/{workflow_id}/stats",
    response_model=WorkflowStatsResponse,
    dependencies=[Depends(require_permission("workflows:read"))],
)
async def get_workflow_stats_by_id(
    workflow_id: int,
    tenant_id: int | None = Query(None, description="Filter by tenant ID"),
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowStatsResponse:
    """
    Get execution statistics for a specific workflow.

    Required permission: workflows:read
    """
    # Verify workflow exists
    workflow = await service.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    stats = await service.get_execution_stats(
        workflow_id=workflow_id,
        tenant_id=tenant_id,
    )
    return WorkflowStatsResponse(**stats)
