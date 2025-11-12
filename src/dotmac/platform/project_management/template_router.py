"""
Project Template Builder API Router

REST API endpoints for creating and managing project templates.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.token_with_rbac import get_current_user_with_rbac
from dotmac.platform.db import get_db
from dotmac.platform.project_management.template_schemas import (
    ProjectTemplateCloneRequest,
    ProjectTemplateCloneResponse,
    ProjectTemplateCreate,
    ProjectTemplateListResponse,
    ProjectTemplateResponse,
    ProjectTemplateUpdate,
    ProjectTemplateWithTasks,
    TaskTemplateCreate,
    TaskTemplateResponse,
    TaskTemplateUpdate,
    TemplatePreviewRequest,
    TemplatePreviewResponse,
)
from dotmac.platform.project_management.template_service import TemplateBuilderService
from dotmac.platform.user_management.models import User

router = APIRouter(prefix="/project-management/templates", tags=["project-templates"])


# ============================================================================
# Project Template Endpoints
# ============================================================================


@router.post("", response_model=ProjectTemplateWithTasks, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: ProjectTemplateCreate,
    current_user: User = Depends(get_current_user_with_rbac),
    session: AsyncSession = Depends(get_db),
) -> ProjectTemplateWithTasks:
    """
    Create a new project template with tasks.

    Example:
        POST /api/v1/project-management/templates
        {
            "template_code": "FIBER_INSTALL_V2",
            "name": "Fiber Installation Template v2",
            "project_type": "installation",
            "estimated_duration_hours": 8.0,
            "default_priority": "high",
            "required_team_type": "installation",
            "project_name_pattern": "Fiber Install - {customer_name}",
            "applies_to_service_types": ["fiber"],
            "tasks": [
                {
                    "name": "Site Survey",
                    "task_type": "site_survey",
                    "sequence_order": 1,
                    "estimated_duration_minutes": 60,
                    "required_skills": {"site_survey": true}
                },
                ...
            ]
        }
    """
    service = TemplateBuilderService(session, current_user.tenant_id)

    try:
        template = await service.create_template(data, created_by=str(current_user.id))
        return ProjectTemplateWithTasks.model_validate(template)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{template_id}", response_model=ProjectTemplateWithTasks)
async def get_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user_with_rbac),
    session: AsyncSession = Depends(get_db),
) -> ProjectTemplateWithTasks:
    """Get template by ID with all tasks"""
    service = TemplateBuilderService(session, current_user.tenant_id)
    template = await service.get_template(template_id, include_tasks=True)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )

    return ProjectTemplateWithTasks.model_validate(template)


@router.get("", response_model=ProjectTemplateListResponse)
async def list_templates(
    project_type: str | None = Query(None, description="Filter by project type"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    applies_to_order_type: str | None = Query(None, description="Filter by order type"),
    applies_to_service_type: str | None = Query(None, description="Filter by service type"),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user_with_rbac),
    session: AsyncSession = Depends(get_db),
) -> ProjectTemplateListResponse:
    """
    List project templates with filtering.

    Filters:
    - project_type: installation, maintenance, etc.
    - is_active: Show only active/inactive templates
    - applies_to_order_type: Show templates for specific order type
    - applies_to_service_type: Show templates for specific service type (fiber, wireless)
    """
    service = TemplateBuilderService(session, current_user.tenant_id)

    templates, total = await service.list_templates(
        project_type=project_type,
        is_active=is_active,
        applies_to_order_type=applies_to_order_type,
        applies_to_service_type=applies_to_service_type,
        limit=limit,
        offset=offset,
    )

    return ProjectTemplateListResponse(
        templates=[ProjectTemplateResponse.model_validate(t) for t in templates],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/{template_id}", response_model=ProjectTemplateResponse)
async def update_template(
    template_id: UUID,
    data: ProjectTemplateUpdate,
    current_user: User = Depends(get_current_user_with_rbac),
    session: AsyncSession = Depends(get_db),
) -> ProjectTemplateResponse:
    """Update template metadata (not tasks)"""
    service = TemplateBuilderService(session, current_user.tenant_id)

    template = await service.update_template(template_id, data, updated_by=str(current_user.id))

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )

    return ProjectTemplateResponse.model_validate(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user_with_rbac),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Soft delete template"""
    service = TemplateBuilderService(session, current_user.tenant_id)

    deleted = await service.delete_template(template_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )

    return None


@router.post("/{template_id}/clone", response_model=ProjectTemplateCloneResponse)
async def clone_template(
    template_id: UUID,
    data: ProjectTemplateCloneRequest,
    current_user: User = Depends(get_current_user_with_rbac),
    session: AsyncSession = Depends(get_db),
) -> ProjectTemplateCloneResponse:
    """
    Clone a template to create a new version.

    Useful for versioning templates or creating variants.

    Example:
        POST /api/v1/project-management/templates/{id}/clone
        {
            "increment_version": true,
            "new_name": "Fiber Installation Template v3"
        }
    """
    service = TemplateBuilderService(session, current_user.tenant_id)

    new_template = await service.clone_template(
        template_id=template_id,
        new_template_code=data.new_template_code,
        new_name=data.new_name,
        increment_version=data.increment_version,
        created_by=str(current_user.id),
    )

    if not new_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )

    return ProjectTemplateCloneResponse(
        original_template_id=template_id,
        new_template_id=new_template.id,
        message=f"Template cloned successfully as {new_template.template_code} v{new_template.version}",
    )


@router.post("/{template_id}/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    template_id: UUID,
    data: TemplatePreviewRequest,
    current_user: User = Depends(get_current_user_with_rbac),
    session: AsyncSession = Depends(get_db),
) -> TemplatePreviewResponse:
    """
    Preview what would be created from this template.

    Shows formatted project name/description and all tasks that would be generated.

    Example:
        POST /api/v1/project-management/templates/{id}/preview
        {
            "customer_name": "Acme Corporation",
            "service_address": "123 Main St, Lagos",
            "order_number": "ORD-2025-001"
        }
    """
    service = TemplateBuilderService(session, current_user.tenant_id)

    preview = await service.preview_template(template_id, data)

    if not preview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )

    return TemplatePreviewResponse(**preview)


# ============================================================================
# Task Template Endpoints
# ============================================================================


@router.post(
    "/{template_id}/tasks", response_model=TaskTemplateResponse, status_code=status.HTTP_201_CREATED
)
async def add_task_to_template(
    template_id: UUID,
    data: TaskTemplateCreate,
    current_user: User = Depends(get_current_user_with_rbac),
    session: AsyncSession = Depends(get_db),
) -> TaskTemplateResponse:
    """
    Add a new task to an existing template.

    Example:
        POST /api/v1/project-management/templates/{id}/tasks
        {
            "name": "Final Inspection",
            "task_type": "inspection",
            "sequence_order": 11,
            "estimated_duration_minutes": 30,
            "depends_on_sequence_orders": [10]
        }
    """
    service = TemplateBuilderService(session, current_user.tenant_id)

    task = await service.add_task_to_template(template_id, data, created_by=str(current_user.id))

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )

    return TaskTemplateResponse.model_validate(task)


@router.patch("/tasks/{task_id}", response_model=TaskTemplateResponse)
async def update_task_template(
    task_id: UUID,
    data: TaskTemplateUpdate,
    current_user: User = Depends(get_current_user_with_rbac),
    session: AsyncSession = Depends(get_db),
) -> TaskTemplateResponse:
    """Update a task template"""
    service = TemplateBuilderService(session, current_user.tenant_id)

    task = await service.update_task_template(task_id, data, updated_by=str(current_user.id))

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task template {task_id} not found",
        )

    return TaskTemplateResponse.model_validate(task)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_template(
    task_id: UUID,
    current_user: User = Depends(get_current_user_with_rbac),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete a task template"""
    service = TemplateBuilderService(session, current_user.tenant_id)

    deleted = await service.delete_task_template(task_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task template {task_id} not found",
        )

    return None
