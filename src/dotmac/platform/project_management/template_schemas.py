"""
Project Template Builder Schemas

Pydantic models for template builder API endpoints.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# ============================================================================
# Task Template Schemas
# ============================================================================


class TaskTemplateBase(BaseModel):
    """Base task template schema"""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    task_type: str = Field(..., description="site_survey, splicing, testing, etc.")
    sequence_order: int = Field(..., ge=0, description="Order in which task should be executed")
    depends_on_sequence_orders: list[int] | None = Field(
        default=None, description="Sequence numbers this task depends on"
    )

    priority: str = Field(default="normal", description="low, normal, high, critical, emergency")
    estimated_duration_minutes: int | None = Field(None, ge=0)
    sla_target_minutes: int | None = Field(None, ge=0)

    required_skills: dict[str, Any] | None = Field(
        default=None, description="Skills required for this task"
    )
    required_equipment: list[str] | None = Field(default=None, description="Equipment needed")
    required_certifications: list[str] | None = Field(
        default=None, description="Certifications required"
    )
    requires_customer_presence: bool = Field(default=False)

    auto_assign_to_role: str | None = Field(
        None, description="Auto-assign to technician with this role"
    )
    auto_assign_to_skill: str | None = Field(
        None, description="Auto-assign to technician with this skill"
    )

    tags: list[str] | None = None
    custom_fields: dict[str, Any] | None = None
    notes: str | None = None


class TaskTemplateCreate(TaskTemplateBase):
    """Create task template"""

    pass


class TaskTemplateUpdate(BaseModel):
    """Update task template"""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    task_type: str | None = None
    sequence_order: int | None = Field(None, ge=0)
    depends_on_sequence_orders: list[int] | None = None

    priority: str | None = None
    estimated_duration_minutes: int | None = Field(None, ge=0)
    sla_target_minutes: int | None = Field(None, ge=0)

    required_skills: dict[str, Any] | None = None
    required_equipment: list[str] | None = None
    required_certifications: list[str] | None = None
    requires_customer_presence: bool | None = None

    auto_assign_to_role: str | None = None
    auto_assign_to_skill: str | None = None

    tags: list[str] | None = None
    custom_fields: dict[str, Any] | None = None
    notes: str | None = None


class TaskTemplateResponse(TaskTemplateBase):
    """Task template response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    template_id: UUID
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Project Template Schemas
# ============================================================================


class ProjectTemplateBase(BaseModel):
    """Base project template schema"""

    template_code: str = Field(
        ..., min_length=1, max_length=50, description="Unique template identifier"
    )
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    version: int = Field(default=1, ge=1)

    project_type: str = Field(..., description="installation, maintenance, upgrade, etc.")
    estimated_duration_hours: float | None = Field(None, ge=0)
    default_priority: str = Field(default="normal", description="Default priority for projects")

    required_team_type: str | None = Field(
        None, description="Team type required (e.g., 'installation')"
    )
    required_team_skills: dict[str, Any] | None = Field(
        None, description="Skills the assigned team must have"
    )

    is_active: bool = Field(default=True)
    is_default: bool = Field(default=False, description="Default template for this project type")

    project_name_pattern: str | None = Field(
        None,
        description="Name pattern with placeholders like '{customer_name}'",
        examples=["Fiber Installation - {customer_name}"],
    )
    project_description_pattern: str | None = Field(
        None, description="Description pattern with placeholders"
    )

    applies_to_order_types: list[str] | None = Field(
        None, description="Order types this template applies to", examples=[["new_tenant", "addon"]]
    )
    applies_to_service_types: list[str] | None = Field(
        None, description="Service types this template applies to", examples=[["fiber", "wireless"]]
    )

    tags: list[str] | None = None
    custom_fields: dict[str, Any] | None = None
    notes: str | None = None


class ProjectTemplateCreate(ProjectTemplateBase):
    """Create project template"""

    tasks: list[TaskTemplateCreate] = Field(
        default_factory=list, description="Task templates to create"
    )


class ProjectTemplateUpdate(BaseModel):
    """Update project template"""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None

    project_type: str | None = None
    estimated_duration_hours: float | None = Field(None, ge=0)
    default_priority: str | None = None

    required_team_type: str | None = None
    required_team_skills: dict[str, Any] | None = None

    is_active: bool | None = None
    is_default: bool | None = None

    project_name_pattern: str | None = None
    project_description_pattern: str | None = None

    applies_to_order_types: list[str] | None = None
    applies_to_service_types: list[str] | None = None

    tags: list[str] | None = None
    custom_fields: dict[str, Any] | None = None
    notes: str | None = None


class ProjectTemplateResponse(ProjectTemplateBase):
    """Project template response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class ProjectTemplateWithTasks(ProjectTemplateResponse):
    """Project template with embedded task templates"""

    tasks: list[TaskTemplateResponse] = Field(default_factory=list)


# ============================================================================
# List/Pagination Schemas
# ============================================================================


class ProjectTemplateListResponse(BaseModel):
    """Paginated project template list"""

    templates: list[ProjectTemplateResponse]
    total: int
    limit: int
    offset: int


class TaskTemplateListResponse(BaseModel):
    """Paginated task template list"""

    tasks: list[TaskTemplateResponse]
    total: int
    limit: int
    offset: int


# ============================================================================
# Template Cloning/Versioning
# ============================================================================


class ProjectTemplateCloneRequest(BaseModel):
    """Clone a template to create a new version"""

    new_template_code: str | None = Field(
        None, description="New template code, or keep the same and increment version"
    )
    new_name: str | None = Field(None, description="New template name")
    increment_version: bool = Field(default=True, description="Auto-increment version number")


class ProjectTemplateCloneResponse(BaseModel):
    """Response after cloning"""

    original_template_id: UUID
    new_template_id: UUID
    message: str


# ============================================================================
# Template Preview (what would be created from template)
# ============================================================================


class TemplatePreviewRequest(BaseModel):
    """Request to preview what would be created from a template"""

    customer_name: str | None = Field(default="Sample Customer")
    service_address: str | None = Field(default="123 Main St")
    order_number: str | None = Field(default="ORD-123")


class TemplatePreviewResponse(BaseModel):
    """Preview of project/tasks that would be created"""

    project_name: str
    project_description: str | None
    estimated_duration_hours: float | None
    task_count: int
    tasks_preview: list[dict[str, Any]] = Field(description="List of tasks with dependencies")
