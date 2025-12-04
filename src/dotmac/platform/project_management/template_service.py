"""
Project Template Builder Service

Business logic for creating and managing project templates.
"""
# mypy: disable-error-code="arg-type,assignment"

from datetime import UTC, datetime
from uuid import UUID, uuid4

import structlog
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.project_management.jinja_utils import render_template
from dotmac.platform.project_management.template_models import ProjectTemplate, TaskTemplate
from dotmac.platform.project_management.template_schemas import (
    ProjectTemplateCreate,
    ProjectTemplateUpdate,
    TaskTemplateCreate,
    TaskTemplateUpdate,
    TemplatePreviewRequest,
)

logger = structlog.get_logger(__name__)


class TemplateBuilderService:
    """Service for managing project templates"""

    def __init__(self, session: AsyncSession, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id

    # ========================================================================
    # Project Template Management
    # ========================================================================

    async def create_template(
        self,
        data: ProjectTemplateCreate,
        created_by: str | None = None,
    ) -> ProjectTemplate:
        """
        Create a new project template with tasks.

        Args:
            data: Template creation data
            created_by: User ID creating the template

        Returns:
            Created ProjectTemplate
        """
        # Check if template_code already exists for this tenant/version
        existing = await self.session.execute(
            select(ProjectTemplate).where(
                and_(
                    ProjectTemplate.tenant_id == self.tenant_id,
                    ProjectTemplate.template_code == data.template_code,
                    ProjectTemplate.version == data.version,
                    ProjectTemplate.deleted_at is None,
                )
            )
        )

        if existing.scalar_one_or_none():
            raise ValueError(f"Template {data.template_code} version {data.version} already exists")

        # Create project template
        template = ProjectTemplate(
            id=uuid4(),
            tenant_id=self.tenant_id,
            template_code=data.template_code,
            name=data.name,
            description=data.description,
            version=data.version,
            project_type=data.project_type,
            estimated_duration_hours=data.estimated_duration_hours,
            default_priority=data.default_priority,
            required_team_type=data.required_team_type,
            required_team_skills=data.required_team_skills,
            is_active=data.is_active,
            is_default=data.is_default,
            project_name_pattern=data.project_name_pattern,
            project_description_pattern=data.project_description_pattern,
            applies_to_order_types=data.applies_to_order_types,
            applies_to_service_types=data.applies_to_service_types,
            tags=data.tags,
            custom_fields=data.custom_fields,
            notes=data.notes,
            created_by=created_by,
            updated_by=created_by,
        )

        self.session.add(template)
        await self.session.flush()

        # Create task templates
        for task_data in data.tasks:
            await self._create_task_template(template.id, task_data, created_by)

        await self.session.commit()
        await self.session.refresh(template)

        logger.info(
            "Created project template",
            template_id=str(template.id),
            template_code=template.template_code,
            tasks_count=len(data.tasks),
        )

        return template

    async def _create_task_template(
        self,
        template_id: UUID,
        data: TaskTemplateCreate,
        created_by: str | None = None,
    ) -> TaskTemplate:
        """Create a task template"""

        task = TaskTemplate(
            id=uuid4(),
            tenant_id=self.tenant_id,
            template_id=template_id,
            name=data.name,
            description=data.description,
            task_type=data.task_type,
            sequence_order=data.sequence_order,
            depends_on_sequence_orders=data.depends_on_sequence_orders,
            priority=data.priority,
            estimated_duration_minutes=data.estimated_duration_minutes,
            sla_target_minutes=data.sla_target_minutes,
            required_skills=data.required_skills,
            required_equipment=data.required_equipment,
            required_certifications=data.required_certifications,
            requires_customer_presence=data.requires_customer_presence,
            auto_assign_to_role=data.auto_assign_to_role,
            auto_assign_to_skill=data.auto_assign_to_skill,
            tags=data.tags,
            custom_fields=data.custom_fields,
            notes=data.notes,
            created_by=created_by,
            updated_by=created_by,
        )

        self.session.add(task)
        return task

    async def get_template(
        self,
        template_id: UUID,
        include_tasks: bool = True,
    ) -> ProjectTemplate | None:
        """Get template by ID"""

        query = select(ProjectTemplate).where(
            and_(
                ProjectTemplate.id == template_id,
                ProjectTemplate.tenant_id == self.tenant_id,
                ProjectTemplate.deleted_at is None,
            )
        )

        if include_tasks:
            query = query.options(selectinload(ProjectTemplate.tasks))

        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_templates(
        self,
        project_type: str | None = None,
        is_active: bool | None = None,
        applies_to_order_type: str | None = None,
        applies_to_service_type: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ProjectTemplate], int]:
        """List templates with filtering"""

        # Build query
        conditions = [
            ProjectTemplate.tenant_id == self.tenant_id,
            ProjectTemplate.deleted_at is None,
        ]

        if project_type:
            conditions.append(ProjectTemplate.project_type == project_type)

        if is_active is not None:
            conditions.append(ProjectTemplate.is_active == is_active)

        if applies_to_order_type:
            conditions.append(
                ProjectTemplate.applies_to_order_types.contains([applies_to_order_type])
            )

        if applies_to_service_type:
            conditions.append(
                ProjectTemplate.applies_to_service_types.contains([applies_to_service_type])
            )

        # Count total
        count_query = select(func.count(ProjectTemplate.id)).where(and_(*conditions))
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Get templates
        query = (
            select(ProjectTemplate)
            .where(and_(*conditions))
            .order_by(ProjectTemplate.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(query)
        templates = result.scalars().all()

        return list(templates), total

    async def update_template(
        self,
        template_id: UUID,
        data: ProjectTemplateUpdate,
        updated_by: str | None = None,
    ) -> ProjectTemplate | None:
        """Update template"""

        template = await self.get_template(template_id, include_tasks=False)

        if not template:
            return None

        # Update fields
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(template, field, value)

        template.updated_by = updated_by
        template.updated_at = datetime.now(UTC)

        await self.session.commit()
        await self.session.refresh(template)

        logger.info(
            "Updated project template",
            template_id=str(template.id),
            template_code=template.template_code,
        )

        return template

    async def delete_template(self, template_id: UUID) -> bool:
        """Soft delete template"""

        template = await self.get_template(template_id, include_tasks=False)

        if not template:
            return False

        template.deleted_at = datetime.now(UTC)
        await self.session.commit()

        logger.info(
            "Deleted project template",
            template_id=str(template.id),
            template_code=template.template_code,
        )

        return True

    async def clone_template(
        self,
        template_id: UUID,
        new_template_code: str | None = None,
        new_name: str | None = None,
        increment_version: bool = True,
        created_by: str | None = None,
    ) -> ProjectTemplate | None:
        """
        Clone a template to create a new version.

        Args:
            template_id: Template to clone
            new_template_code: New template code (or keep same and increment version)
            new_name: New name for template
            increment_version: Auto-increment version number
            created_by: User creating the clone

        Returns:
            New ProjectTemplate
        """
        original = await self.get_template(template_id, include_tasks=True)

        if not original:
            return None

        # Determine new template code and version
        template_code = new_template_code or original.template_code
        version = original.version + 1 if increment_version else original.version

        # Create new template
        new_template = ProjectTemplate(
            id=uuid4(),
            tenant_id=self.tenant_id,
            template_code=template_code,
            name=new_name or f"{original.name} (Copy)",
            description=original.description,
            version=version,
            project_type=original.project_type,
            estimated_duration_hours=original.estimated_duration_hours,
            default_priority=original.default_priority,
            required_team_type=original.required_team_type,
            required_team_skills=original.required_team_skills,
            is_active=False,  # Clone starts inactive
            is_default=False,
            project_name_pattern=original.project_name_pattern,
            project_description_pattern=original.project_description_pattern,
            applies_to_order_types=original.applies_to_order_types,
            applies_to_service_types=original.applies_to_service_types,
            tags=original.tags,
            custom_fields=original.custom_fields,
            notes=f"Cloned from template {original.template_code} v{original.version}",
            created_by=created_by,
            updated_by=created_by,
        )

        self.session.add(new_template)
        await self.session.flush()

        # Clone tasks
        for task in original.tasks:
            if task.deleted_at is None:
                cloned_task = TaskTemplate(
                    id=uuid4(),
                    tenant_id=self.tenant_id,
                    template_id=new_template.id,
                    name=task.name,
                    description=task.description,
                    task_type=task.task_type,
                    sequence_order=task.sequence_order,
                    depends_on_sequence_orders=task.depends_on_sequence_orders,
                    priority=task.priority,
                    estimated_duration_minutes=task.estimated_duration_minutes,
                    sla_target_minutes=task.sla_target_minutes,
                    required_skills=task.required_skills,
                    required_equipment=task.required_equipment,
                    required_certifications=task.required_certifications,
                    requires_customer_presence=task.requires_customer_presence,
                    auto_assign_to_role=task.auto_assign_to_role,
                    auto_assign_to_skill=task.auto_assign_to_skill,
                    tags=task.tags,
                    custom_fields=task.custom_fields,
                    notes=task.notes,
                    created_by=created_by,
                    updated_by=created_by,
                )
                self.session.add(cloned_task)

        await self.session.commit()
        await self.session.refresh(new_template)

        logger.info(
            "Cloned project template",
            original_id=str(template_id),
            new_id=str(new_template.id),
            new_code=template_code,
            new_version=version,
        )

        return new_template

    # ========================================================================
    # Task Template Management
    # ========================================================================

    async def add_task_to_template(
        self,
        template_id: UUID,
        data: TaskTemplateCreate,
        created_by: str | None = None,
    ) -> TaskTemplate | None:
        """Add a new task to an existing template"""

        # Verify template exists
        template = await self.get_template(template_id, include_tasks=False)

        if not template:
            return None

        task = await self._create_task_template(template_id, data, created_by)
        await self.session.commit()
        await self.session.refresh(task)

        logger.info(
            "Added task to template",
            template_id=str(template_id),
            task_id=str(task.id),
        )

        return task

    async def update_task_template(
        self,
        task_id: UUID,
        data: TaskTemplateUpdate,
        updated_by: str | None = None,
    ) -> TaskTemplate | None:
        """Update a task template"""

        query = select(TaskTemplate).where(
            and_(
                TaskTemplate.id == task_id,
                TaskTemplate.tenant_id == self.tenant_id,
                TaskTemplate.deleted_at is None,
            )
        )

        result = await self.session.execute(query)
        task = result.scalar_one_or_none()

        if not task:
            return None

        # Update fields
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(task, field, value)

        task.updated_by = updated_by
        task.updated_at = datetime.now(UTC)

        await self.session.commit()
        await self.session.refresh(task)

        logger.info(
            "Updated task template",
            task_id=str(task.id),
        )

        return task

    async def delete_task_template(self, task_id: UUID) -> bool:
        """Soft delete task template"""

        query = select(TaskTemplate).where(
            and_(
                TaskTemplate.id == task_id,
                TaskTemplate.tenant_id == self.tenant_id,
                TaskTemplate.deleted_at is None,
            )
        )

        result = await self.session.execute(query)
        task = result.scalar_one_or_none()

        if not task:
            return False

        task.deleted_at = datetime.now(UTC)
        await self.session.commit()

        logger.info(
            "Deleted task template",
            task_id=str(task.id),
        )

        return True

    # ========================================================================
    # Template Preview
    # ========================================================================

    async def preview_template(
        self,
        template_id: UUID,
        preview_data: TemplatePreviewRequest,
    ) -> dict | None:
        """
        Preview what would be created from this template.

        Shows how the project name/description would be formatted
        and lists all tasks that would be created.
        """
        template = await self.get_template(template_id, include_tasks=True)

        if not template:
            return None

        # Render project name/description with Jinja2
        context = {
            "customer_name": preview_data.customer_name,
            "service_address": preview_data.service_address,
            "order_number": preview_data.order_number,
        }

        project_name = render_template(
            template.project_name_pattern,
            context,
            default=template.project_name_pattern or "Untitled Project",
        )

        project_description = render_template(
            template.project_description_pattern,
            context,
            default=template.project_description_pattern or "",
        )

        # Build task preview
        tasks_preview = []
        for task in sorted(template.tasks, key=lambda t: t.sequence_order):
            if task.deleted_at is None:
                dependency_names = []
                if task.depends_on_sequence_orders:
                    for dep_order in task.depends_on_sequence_orders:
                        dep_task = next(
                            (t for t in template.tasks if t.sequence_order == dep_order), None
                        )
                        if dep_task:
                            dependency_names.append(dep_task.name)

                tasks_preview.append(
                    {
                        "sequence": task.sequence_order,
                        "name": task.name,
                        "type": task.task_type,
                        "estimated_duration_minutes": task.estimated_duration_minutes,
                        "required_skills": list(task.required_skills.keys())
                        if task.required_skills
                        else [],
                        "required_equipment": task.required_equipment or [],
                        "depends_on": dependency_names,
                        "requires_customer_presence": task.requires_customer_presence,
                    }
                )

        return {
            "project_name": project_name,
            "project_description": project_description,
            "estimated_duration_hours": template.estimated_duration_hours,
            "task_count": len(tasks_preview),
            "tasks_preview": tasks_preview,
        }
