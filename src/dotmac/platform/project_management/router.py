"""
Project Management API Router

REST API endpoints for project, task, and team management.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import (
    require_field_service_project_manage,
    require_field_service_project_read,
    require_field_service_task_manage,
    require_field_service_task_read,
    require_field_service_team_manage,
    require_field_service_team_read,
)
from dotmac.platform.db import get_async_session
from dotmac.platform.project_management.schemas import (
    DashboardMetrics,
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectSearchParams,
    ProjectUpdate,
    ProjectWithTasks,
    TaskCreate,
    TaskListResponse,
    TaskResponse,
    TaskSearchParams,
    TaskUpdate,
    TeamCreate,
    TeamListResponse,
    TeamMembershipListResponse,
    TeamResponse,
    TeamUpdate,
    TechnicianTeamMembershipResponse,
)
from dotmac.platform.project_management.service import ProjectManagementService

router = APIRouter(prefix="/project-management", tags=["project-management"])


def _require_tenant_id(user: UserInfo) -> str:
    """Ensure the request is scoped to a tenant."""
    tenant_id = user.effective_tenant_id
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant context is required for project-management operations.",
        )
    return tenant_id


# ============================================================================
# Project Endpoints
# ============================================================================


@router.get("/metrics", response_model=DashboardMetrics)
async def get_project_metrics(
    current_user: UserInfo = Depends(require_field_service_project_read),
    session: AsyncSession = Depends(get_async_session),
) -> DashboardMetrics:
    """Return aggregate project/task metrics for dashboards."""
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    return await service.get_dashboard_metrics()


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    current_user: UserInfo = Depends(require_field_service_project_manage),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectResponse:
    """
    Create a new project.

    Creates a multi-step project for field service operations.
    Automatically geocodes the service address if provided.

    Example:
        POST /api/v1/project-management/projects
        {
            "name": "Fiber Installation - Customer ABC",
            "project_type": "installation",
            "customer_id": "uuid",
            "service_address": "123 Main St, Lagos, Nigeria",
            "scheduled_start": "2025-11-10T08:00:00Z",
            "estimated_duration_hours": 8.0
        }
    """
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    project = await service.create_project(data, created_by=current_user.user_id)
    return ProjectResponse.model_validate(project)


@router.get("/projects/{project_id}", response_model=ProjectWithTasks)
async def get_project(
    project_id: UUID,
    include_tasks: bool = Query(default=False, description="Include project tasks"),
    current_user: UserInfo = Depends(require_field_service_project_read),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectWithTasks:
    """Get project by ID with optional tasks"""
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    project = await service.get_project(project_id, include_tasks=include_tasks)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    return ProjectWithTasks.model_validate(project)


@router.get("/projects", response_model=ProjectListResponse)
async def list_projects(
    status_filter: str | None = Query(None, alias="status"),
    project_type: str | None = Query(None),
    customer_id: UUID | None = None,
    assigned_team_id: UUID | None = None,
    sla_breached: bool | None = None,
    search: str | None = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: UserInfo = Depends(require_field_service_project_read),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectListResponse:
    """
    List projects with filtering and pagination.

    Filters:
    - status: planned, scheduled, in_progress, completed, etc.
    - project_type: installation, maintenance, upgrade, etc.
    - customer_id: Filter by customer
    - assigned_team_id: Filter by assigned team
    - sla_breached: Show only SLA breached projects
    - search: Search in name, description, project number
    """
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)

    search_params = ProjectSearchParams(
        status=status_filter,
        project_type=project_type,
        customer_id=customer_id,
        assigned_team_id=assigned_team_id,
        sla_breached=sla_breached,
        search_term=search,
    )

    projects, total = await service.list_projects(search_params, limit, offset)

    return ProjectListResponse(
        projects=[ProjectResponse.model_validate(p) for p in projects],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    current_user: UserInfo = Depends(require_field_service_project_manage),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectResponse:
    """Update project"""
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    project = await service.update_project(project_id, data, updated_by=current_user.user_id)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    return ProjectResponse.model_validate(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: UserInfo = Depends(require_field_service_project_manage),
    session: AsyncSession = Depends(get_async_session),
) -> None:
    """Delete project (soft delete)"""
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    deleted = await service.delete_project(project_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    return None


# ============================================================================
# Task Endpoints
# ============================================================================


@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    current_user: UserInfo = Depends(require_field_service_task_manage),
    session: AsyncSession = Depends(get_async_session),
) -> TaskResponse:
    """
    Create a new task within a project.

    Automatically geocodes the task location if service_address is provided,
    otherwise uses the project's location.

    Example:
        POST /api/v1/project-management/tasks
        {
            "project_id": "uuid",
            "name": "Fiber Splicing at DP-123",
            "task_type": "splicing",
            "priority": "high",
            "assigned_technician_id": "uuid",
            "estimated_duration_minutes": 60,
            "required_skills": {"fiber_splicing": true, "otdr": true}
        }
    """
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    task = await service.create_task(data, created_by=current_user.user_id)
    return TaskResponse.model_validate(task)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    current_user: UserInfo = Depends(require_field_service_task_read),
    session: AsyncSession = Depends(get_async_session),
) -> TaskResponse:
    """Get task by ID"""
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    task = await service.get_task(task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found",
        )

    return TaskResponse.model_validate(task)


@router.get("/tasks", response_model=TaskListResponse)
async def list_tasks(
    status_filter: str | None = Query(None, alias="status"),
    task_type: str | None = Query(None),
    project_id: UUID | None = None,
    assigned_technician_id: UUID | None = None,
    assigned_team_id: UUID | None = None,
    sla_breached: bool | None = None,
    limit: int = Query(default=100, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: UserInfo = Depends(require_field_service_task_read),
    session: AsyncSession = Depends(get_async_session),
) -> TaskListResponse:
    """
    List tasks with filtering and pagination.

    Filters:
    - status: pending, assigned, in_progress, completed, etc.
    - task_type: splicing, testing, installation, etc.
    - project_id: Filter by project
    - assigned_technician_id: Filter by technician
    - assigned_team_id: Filter by team
    - sla_breached: Show only SLA breached tasks
    """
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)

    search_params = TaskSearchParams(
        status=status_filter,
        task_type=task_type,
        project_id=project_id,
        assigned_technician_id=assigned_technician_id,
        assigned_team_id=assigned_team_id,
        sla_breached=sla_breached,
    )

    tasks, total = await service.list_tasks(search_params, limit, offset)

    return TaskListResponse(
        tasks=[TaskResponse.model_validate(t) for t in tasks],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    data: TaskUpdate,
    current_user: UserInfo = Depends(require_field_service_task_manage),
    session: AsyncSession = Depends(get_async_session),
) -> TaskResponse:
    """Update task"""
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    task = await service.update_task(task_id, data, updated_by=current_user.user_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found",
        )

    return TaskResponse.model_validate(task)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    current_user: UserInfo = Depends(require_field_service_task_manage),
    session: AsyncSession = Depends(get_async_session),
) -> None:
    """Delete task (soft delete)"""
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    deleted = await service.delete_task(task_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found",
        )

    return None


# ============================================================================
# Team Endpoints
# ============================================================================


@router.post("/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    data: TeamCreate,
    current_user: UserInfo = Depends(require_field_service_team_manage),
    session: AsyncSession = Depends(get_async_session),
) -> TeamResponse:
    """
    Create a new team.

    Example:
        POST /api/v1/project-management/teams
        {
            "team_code": "INSTALL-A",
            "name": "Installation Team Alpha",
            "team_type": "installation",
            "service_areas": ["lagos-mainland", "lagos-island"],
            "max_concurrent_projects": 5,
            "working_hours_start": "08:00",
            "working_hours_end": "17:00",
            "working_days": [0, 1, 2, 3, 4]
        }
    """
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    team = await service.create_team(data, created_by=current_user.user_id)
    return TeamResponse.model_validate(team)


@router.get("/teams/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: UUID,
    current_user: UserInfo = Depends(require_field_service_team_read),
    session: AsyncSession = Depends(get_async_session),
) -> TeamResponse:
    """Get team by ID"""
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    team = await service.get_team(team_id)

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team {team_id} not found",
        )

    return TeamResponse.model_validate(team)


@router.get("/teams", response_model=TeamListResponse)
async def list_teams(
    team_type: str | None = None,
    is_active: bool | None = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: UserInfo = Depends(require_field_service_team_read),
    session: AsyncSession = Depends(get_async_session),
) -> TeamListResponse:
    """
    List teams with filtering.

    Filters:
    - team_type: installation, maintenance, emergency, etc.
    - is_active: Filter by active status
    """
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    teams, total = await service.list_teams(team_type, is_active, limit, offset)

    return TeamListResponse(
        teams=[TeamResponse.model_validate(t) for t in teams],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/teams/members", response_model=TeamMembershipListResponse)
async def list_team_members(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: UserInfo = Depends(require_field_service_team_read),
    session: AsyncSession = Depends(get_async_session),
) -> TeamMembershipListResponse:
    """List technician-to-team memberships"""
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    memberships, total = await service.list_team_memberships(limit=limit, offset=offset)
    return TeamMembershipListResponse(
        memberships=[TechnicianTeamMembershipResponse.model_validate(m) for m in memberships],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/teams/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: UUID,
    data: TeamUpdate,
    current_user: UserInfo = Depends(require_field_service_team_manage),
    session: AsyncSession = Depends(get_async_session),
) -> TeamResponse:
    """Update team"""
    tenant_id = _require_tenant_id(current_user)
    service = ProjectManagementService(session, tenant_id)
    team = await service.update_team(team_id, data, updated_by=current_user.user_id)

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team {team_id} not found",
        )

    return TeamResponse.model_validate(team)
