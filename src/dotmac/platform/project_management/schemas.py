"""
Project Management Pydantic Schemas

Request/response models for the Project Management API.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.project_management.models import (
    ProjectStatus,
    ProjectType,
    TaskPriority,
    TaskStatus,
    TaskType,
    TeamRole,
    TeamType,
)

# ============================================================================
# Team Schemas
# ============================================================================


class TeamBase(BaseModel):
    """Base team schema"""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    team_type: TeamType
    max_concurrent_projects: int | None = None
    max_concurrent_tasks: int | None = None
    service_areas: list[str] | None = None
    coverage_radius_km: float | None = None
    home_base_address: str | None = None
    working_hours_start: str | None = None  # "08:00"
    working_hours_end: str | None = None  # "17:00"
    working_days: list[int] | None = None  # [0,1,2,3,4] = Mon-Fri
    lead_technician_id: UUID | None = None
    tags: list[str] | None = None
    notes: str | None = None


class TeamCreate(TeamBase):
    """Create team request"""

    team_code: str = Field(..., min_length=1, max_length=50)


class TeamUpdate(BaseModel):
    """Update team request"""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    team_type: TeamType | None = None
    is_active: bool | None = None
    max_concurrent_projects: int | None = None
    max_concurrent_tasks: int | None = None
    service_areas: list[str] | None = None
    lead_technician_id: UUID | None = None
    notes: str | None = None


class TeamResponse(TeamBase):
    """Team response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    team_code: str
    is_active: bool
    projects_completed: int
    tasks_completed: int
    average_rating: float | None = None
    completion_rate: float | None = None
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Project Schemas
# ============================================================================


class ProjectBase(BaseModel):
    """Base project schema"""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    project_type: ProjectType
    priority: TaskPriority = TaskPriority.NORMAL
    customer_id: UUID | None = None
    order_id: str | None = None
    subscriber_id: str | None = None
    service_address: str | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    due_date: datetime | None = None
    estimated_duration_hours: float | None = None
    assigned_team_id: UUID | None = None
    sla_definition_id: UUID | None = None
    estimated_cost: float | None = None
    budget: float | None = None
    tags: list[str] | None = None
    notes: str | None = None


class ProjectCreate(ProjectBase):
    """Create project request"""

    pass


class ProjectUpdate(BaseModel):
    """Update project request"""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    status: ProjectStatus | None = None
    priority: TaskPriority | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    assigned_team_id: UUID | None = None
    completion_percent: int | None = Field(None, ge=0, le=100)
    actual_cost: float | None = None
    notes: str | None = None


class ProjectResponse(ProjectBase):
    """Project response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    project_number: str
    status: ProjectStatus
    completion_percent: int
    tasks_total: int
    tasks_completed: int
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    actual_cost: float | None = None
    sla_breached: bool
    created_at: datetime
    updated_at: datetime


class ProjectWithTasks(ProjectResponse):
    """Project with embedded tasks"""

    tasks: list["TaskResponse"] = []


# ============================================================================
# Task Schemas
# ============================================================================


class TaskBase(BaseModel):
    """Base task schema"""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    task_type: TaskType
    priority: TaskPriority = TaskPriority.NORMAL
    parent_task_id: UUID | None = None
    sequence_order: int = 0
    assigned_technician_id: UUID | None = None
    assigned_team_id: UUID | None = None
    service_address: str | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    estimated_duration_minutes: int | None = None
    sla_target_minutes: int | None = None
    required_skills: dict[str, Any] | None = None
    required_equipment: list[str] | None = None
    required_certifications: list[str] | None = None
    requires_customer_presence: bool = False
    tags: list[str] | None = None
    notes: str | None = None


class TaskCreate(TaskBase):
    """Create task request"""

    project_id: UUID


class TaskUpdate(BaseModel):
    """Update task request"""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assigned_technician_id: UUID | None = None
    assigned_team_id: UUID | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    completion_percent: int | None = Field(None, ge=0, le=100)
    blockers: dict[str, Any] | None = None
    notes: str | None = None
    customer_signature: str | None = None
    customer_feedback: str | None = None
    customer_rating: int | None = Field(None, ge=1, le=5)


class TaskResponse(TaskBase):
    """Task response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    project_id: UUID
    task_number: str
    status: TaskStatus
    completion_percent: int
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    actual_duration_minutes: int | None = None
    sla_breached: bool
    created_at: datetime
    updated_at: datetime


class TaskBulkCreate(BaseModel):
    """Bulk create tasks for a project"""

    project_id: UUID
    tasks: list[TaskCreate]


# ============================================================================
# Team Membership Schemas
# ============================================================================


class TechnicianTeamMembershipCreate(BaseModel):
    """Add technician to team"""

    technician_id: UUID
    team_id: UUID
    role: TeamRole = TeamRole.MEMBER
    is_primary_team: bool = False
    notes: str | None = None


class TechnicianTeamMembershipUpdate(BaseModel):
    """Update team membership"""

    role: TeamRole | None = None
    is_primary_team: bool | None = None
    notes: str | None = None


class TechnicianTeamMembershipResponse(BaseModel):
    """Team membership response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    technician_id: UUID
    team_id: UUID
    role: TeamRole
    is_primary_team: bool
    is_active: bool
    joined_at: datetime
    left_at: datetime | None = None


# ============================================================================
# List/Pagination Schemas
# ============================================================================


class ProjectListResponse(BaseModel):
    """Paginated project list"""

    projects: list[ProjectResponse]
    total: int
    limit: int
    offset: int


class TaskListResponse(BaseModel):
    """Paginated task list"""

    tasks: list[TaskResponse]
    total: int
    limit: int
    offset: int


class TeamListResponse(BaseModel):
    """Paginated team list"""

    teams: list[TeamResponse]
    total: int
    limit: int
    offset: int


# ============================================================================
# Search/Filter Schemas
# ============================================================================


class ProjectSearchParams(BaseModel):
    """Project search parameters"""

    status: ProjectStatus | None = None
    project_type: ProjectType | None = None
    customer_id: UUID | None = None
    assigned_team_id: UUID | None = None
    sla_breached: bool | None = None
    due_before: datetime | None = None
    due_after: datetime | None = None
    search_term: str | None = None  # Search in name/description


class TaskSearchParams(BaseModel):
    """Task search parameters"""

    status: TaskStatus | None = None
    task_type: TaskType | None = None
    project_id: UUID | None = None
    assigned_technician_id: UUID | None = None
    assigned_team_id: UUID | None = None
    sla_breached: bool | None = None
    scheduled_before: datetime | None = None
    scheduled_after: datetime | None = None


# ============================================================================
# Analytics/Dashboard Schemas
# ============================================================================


class ProjectStats(BaseModel):
    """Project statistics"""

    total_projects: int
    active_projects: int
    completed_projects: int
    on_hold_projects: int
    overdue_projects: int
    sla_breached_count: int
    avg_completion_time_hours: float | None = None
    completion_rate: float | None = None


class TeamPerformanceStats(BaseModel):
    """Team performance statistics"""

    team_id: UUID
    team_name: str
    projects_completed: int
    tasks_completed: int
    average_rating: float | None = None
    completion_rate: float | None = None
    avg_response_time_minutes: int | None = None
    active_projects: int
    active_tasks: int


class TechnicianPerformanceStats(BaseModel):
    """Technician performance statistics (for tasks)"""

    technician_id: UUID
    technician_name: str
    tasks_completed: int
    tasks_in_progress: int
    average_task_duration_minutes: float | None = None
    on_time_completion_rate: float | None = None
    average_rating: float | None = None
    sla_compliance_rate: float | None = None


# ============================================================================
# Action Schemas
# ============================================================================


class ProjectStartRequest(BaseModel):
    """Start a project"""

    actual_start: datetime | None = None  # Default to now


class ProjectCompleteRequest(BaseModel):
    """Complete a project"""

    actual_end: datetime | None = None  # Default to now
    actual_cost: float | None = None
    notes: str | None = None


class TaskStartRequest(BaseModel):
    """Start a task"""

    actual_start: datetime | None = None  # Default to now


class TaskCompleteRequest(BaseModel):
    """Complete a task"""

    actual_end: datetime | None = None  # Default to now
    completion_percent: int = 100
    customer_signature: str | None = None
    customer_feedback: str | None = None
    customer_rating: int | None = Field(None, ge=1, le=5)
    photos: list[str] | None = None  # Photo URLs
    notes: str | None = None


class TaskAssignRequest(BaseModel):
    """Assign task to technician or team"""

    assigned_technician_id: UUID | None = None
    assigned_team_id: UUID | None = None


# Update forward references (Pydantic v1/v2 compatibility)
_rebuild = getattr(ProjectWithTasks, "model_rebuild", None)
if callable(_rebuild):
    _rebuild()
else:  # pragma: no cover - fallback for Pydantic v1
    _update_refs = getattr(ProjectWithTasks, "update_forward_refs", None)
    if callable(_update_refs):
        _update_refs()
