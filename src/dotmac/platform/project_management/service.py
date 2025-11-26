"""
Project Management Service

Business logic for managing projects, tasks, teams, and assignments.
"""

from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.geo.auto_geocode import geocode_job_location
from dotmac.platform.project_management.models import (
    Project,
    ProjectStatus,
    Task,
    TaskStatus,
    Team,
    TechnicianTeamMembership,
)
from dotmac.platform.project_management.schemas import (
    DashboardMetrics,
    ProjectCreate,
    ProjectSearchParams,
    ProjectUpdate,
    TaskCreate,
    TaskSearchParams,
    TaskUpdate,
    TeamCreate,
    TeamUpdate,
)

logger = structlog.get_logger(__name__)


class ProjectManagementService:
    """Service for project management operations"""

    def __init__(self, session: AsyncSession, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id

    # ========================================================================
    # Project CRUD Operations
    # ========================================================================

    async def create_project(self, data: ProjectCreate, created_by: str | None = None) -> Project:
        """Create a new project"""
        # Generate project number
        project_number = await self._generate_project_number()

        project = Project(
            tenant_id=self.tenant_id,
            project_number=project_number,
            name=data.name,
            description=data.description,
            project_type=data.project_type,
            priority=data.priority,
            customer_id=data.customer_id,
            order_id=data.order_id,
            subscriber_id=data.subscriber_id,
            service_address=data.service_address,
            scheduled_start=data.scheduled_start,
            scheduled_end=data.scheduled_end,
            due_date=data.due_date,
            estimated_duration_hours=data.estimated_duration_hours,
            assigned_team_id=data.assigned_team_id,
            sla_definition_id=data.sla_definition_id,
            estimated_cost=data.estimated_cost,
            budget=data.budget,
            tags=data.tags,
            notes=data.notes,
            created_by=created_by,
        )

        # Auto-geocode service address if provided
        if data.service_address:
            try:
                coords = await geocode_job_location({"service_address": data.service_address})
                if coords:
                    project.location_lat = coords["lat"]
                    project.location_lng = coords["lon"]
                    project.service_coordinates = coords
            except Exception as e:
                logger.warning("Failed to geocode project address", error=str(e))

        self.session.add(project)
        await self.session.commit()
        await self.session.refresh(project)

        logger.info(
            "project.created",
            project_id=project.id,
            project_number=project_number,
            name=project.name,
        )

        return project

    async def get_project(self, project_id: UUID, include_tasks: bool = False) -> Project | None:
        """Get project by ID"""
        query = select(Project).where(
            and_(
                Project.id == project_id,
                Project.tenant_id == self.tenant_id,
                Project.deleted_at.is_(None),
            )
        )

        result = await self.session.execute(query)
        project = result.scalar_one_or_none()

        if project and include_tasks:
            # Load tasks
            tasks_query = (
                select(Task)
                .where(
                    and_(
                        Task.project_id == project_id,
                        Task.deleted_at.is_(None),
                    )
                )
                .order_by(Task.sequence_order)
            )

            tasks_result = await self.session.execute(tasks_query)
            project.tasks = list(tasks_result.scalars().all())

        return project

    async def list_projects(
        self,
        search_params: ProjectSearchParams | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Project], int]:
        """List projects with filtering"""
        query = select(Project).where(
            and_(
                Project.tenant_id == self.tenant_id,
                Project.deleted_at.is_(None),
            )
        )

        # Apply filters
        if search_params:
            if search_params.status:
                query = query.where(Project.status == search_params.status)
            if search_params.project_type:
                query = query.where(Project.project_type == search_params.project_type)
            if search_params.customer_id:
                query = query.where(Project.customer_id == search_params.customer_id)
            if search_params.assigned_team_id:
                query = query.where(Project.assigned_team_id == search_params.assigned_team_id)
            if search_params.sla_breached is not None:
                query = query.where(Project.sla_breached == search_params.sla_breached)
            if search_params.due_before:
                query = query.where(Project.due_date <= search_params.due_before)
            if search_params.due_after:
                query = query.where(Project.due_date >= search_params.due_after)
            if search_params.search_term:
                query = query.where(
                    or_(
                        Project.name.ilike(f"%{search_params.search_term}%"),
                        Project.description.ilike(f"%{search_params.search_term}%"),
                        Project.project_number.ilike(f"%{search_params.search_term}%"),
                    )
                )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        query = query.order_by(Project.created_at.desc()).offset(offset).limit(limit)

        result = await self.session.execute(query)
        projects = list(result.scalars().all())

        return projects, total

    async def update_project(
        self, project_id: UUID, data: ProjectUpdate, updated_by: str | None = None
    ) -> Project | None:
        """Update project"""
        project = await self.get_project(project_id)
        if not project:
            return None

        # Update fields
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(project, field, value)

        project.updated_by = updated_by
        project.updated_at = datetime.now(UTC)

        await self.session.commit()
        await self.session.refresh(project)

        logger.info("project.updated", project_id=project_id, fields=list(update_data.keys()))

        return project

    async def delete_project(self, project_id: UUID) -> bool:
        """Soft delete project"""
        project = await self.get_project(project_id)
        if not project:
            return False

        project.deleted_at = datetime.now(UTC)
        await self.session.commit()

        logger.info("project.deleted", project_id=project_id)
        return True

    # ========================================================================
    # Task CRUD Operations
    # ========================================================================

    async def create_task(self, data: TaskCreate, created_by: str | None = None) -> Task:
        """Create a new task"""
        # Verify project exists
        project = await self.get_project(data.project_id)
        if not project:
            raise ValueError(f"Project {data.project_id} not found")

        # Generate task number
        task_number = await self._generate_task_number(data.project_id)

        task = Task(
            tenant_id=self.tenant_id,
            project_id=data.project_id,
            task_number=task_number,
            name=data.name,
            description=data.description,
            task_type=data.task_type,
            priority=data.priority,
            parent_task_id=data.parent_task_id,
            sequence_order=data.sequence_order,
            assigned_technician_id=data.assigned_technician_id,
            assigned_team_id=data.assigned_team_id,
            service_address=data.service_address,
            scheduled_start=data.scheduled_start,
            scheduled_end=data.scheduled_end,
            estimated_duration_minutes=data.estimated_duration_minutes,
            sla_target_minutes=data.sla_target_minutes,
            required_skills=data.required_skills,
            required_equipment=data.required_equipment,
            required_certifications=data.required_certifications,
            requires_customer_presence=data.requires_customer_presence,
            tags=data.tags,
            notes=data.notes,
            created_by=created_by,
        )

        # Auto-geocode if address provided, fallback to project location
        if data.service_address:
            try:
                coords = await geocode_job_location({"service_address": data.service_address})
                if coords:
                    task.location_lat = coords["lat"]
                    task.location_lng = coords["lon"]
            except Exception as e:
                logger.warning("Failed to geocode task address", error=str(e))
        elif project.location_lat and project.location_lng:
            # Use project location
            task.location_lat = project.location_lat
            task.location_lng = project.location_lng

        self.session.add(task)

        # Update project task counts
        project.tasks_total += 1

        await self.session.commit()
        await self.session.refresh(task)

        logger.info(
            "task.created",
            task_id=task.id,
            task_number=task_number,
            project_id=data.project_id,
        )

        return task

    async def get_task(self, task_id: UUID) -> Task | None:
        """Get task by ID"""
        query = select(Task).where(
            and_(
                Task.id == task_id,
                Task.tenant_id == self.tenant_id,
                Task.deleted_at.is_(None),
            )
        )

        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_tasks(
        self,
        search_params: TaskSearchParams | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Task], int]:
        """List tasks with filtering"""
        query = select(Task).where(
            and_(
                Task.tenant_id == self.tenant_id,
                Task.deleted_at.is_(None),
            )
        )

        # Apply filters
        if search_params:
            if search_params.status:
                query = query.where(Task.status == search_params.status)
            if search_params.task_type:
                query = query.where(Task.task_type == search_params.task_type)
            if search_params.project_id:
                query = query.where(Task.project_id == search_params.project_id)
            if search_params.assigned_technician_id:
                query = query.where(
                    Task.assigned_technician_id == search_params.assigned_technician_id
                )
            if search_params.assigned_team_id:
                query = query.where(Task.assigned_team_id == search_params.assigned_team_id)
            if search_params.sla_breached is not None:
                query = query.where(Task.sla_breached == search_params.sla_breached)
            if search_params.scheduled_before:
                query = query.where(Task.scheduled_start <= search_params.scheduled_before)
            if search_params.scheduled_after:
                query = query.where(Task.scheduled_start >= search_params.scheduled_after)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        query = query.order_by(Task.sequence_order, Task.created_at).offset(offset).limit(limit)

        result = await self.session.execute(query)
        tasks = list(result.scalars().all())

        return tasks, total

    async def update_task(
        self, task_id: UUID, data: TaskUpdate, updated_by: str | None = None
    ) -> Task | None:
        """Update task"""
        task = await self.get_task(task_id)
        if not task:
            return None

        # Track status changes for project progress
        old_status = task.status

        # Update fields
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(task, field, value)

        task.updated_by = updated_by
        task.updated_at = datetime.now(UTC)

        # Calculate actual duration if task completed
        if task.status == TaskStatus.COMPLETED and task.actual_start and task.actual_end:
            duration = task.actual_end - task.actual_start
            task.actual_duration_minutes = int(duration.total_seconds() / 60)

        await self.session.commit()
        await self.session.refresh(task)

        # Update project progress if task status changed
        if old_status != task.status:
            await self._update_project_progress(task.project_id)

        logger.info("task.updated", task_id=task_id, fields=list(update_data.keys()))

        return task

    async def delete_task(self, task_id: UUID) -> bool:
        """Soft delete task"""
        task = await self.get_task(task_id)
        if not task:
            return False

        task.deleted_at = datetime.now(UTC)
        await self.session.commit()

        # Update project task counts
        await self._update_project_progress(task.project_id)

        logger.info("task.deleted", task_id=task_id)
        return True

    async def list_team_memberships(
        self, limit: int = 50, offset: int = 0
    ) -> tuple[list[TechnicianTeamMembership], int]:
        """List technician-team memberships"""
        base_filter = and_(
            TechnicianTeamMembership.tenant_id == self.tenant_id,
            TechnicianTeamMembership.is_active.is_(True),
        )

        query = (
            select(TechnicianTeamMembership)
            .where(base_filter)
            .order_by(TechnicianTeamMembership.created_at.desc())
        )
        count_query = select(func.count()).select_from(query.subquery())

        total = (await self.session.execute(count_query)).scalar() or 0
        memberships = (
            await self.session.execute(query.limit(limit).offset(offset))
        ).scalars().all()

        return list(memberships), total

    async def get_dashboard_metrics(self) -> DashboardMetrics:
        """Aggregate high-level project and task metrics for dashboards."""
        base_project_filter = and_(Project.tenant_id == self.tenant_id, Project.deleted_at.is_(None))
        base_task_filter = and_(Task.tenant_id == self.tenant_id, Task.deleted_at.is_(None))
        now = datetime.now(UTC)

        total_projects = (
            await self.session.execute(select(func.count()).select_from(Project).where(base_project_filter))
        ).scalar() or 0

        active_statuses = [
            ProjectStatus.PLANNED,
            ProjectStatus.SCHEDULED,
            ProjectStatus.IN_PROGRESS,
            ProjectStatus.BLOCKED,
            ProjectStatus.ON_HOLD,
        ]
        active_projects = (
            await self.session.execute(
                select(func.count()).where(and_(base_project_filter, Project.status.in_(active_statuses)))
            )
        ).scalar() or 0

        completed_projects = (
            await self.session.execute(
                select(func.count()).where(and_(base_project_filter, Project.status == ProjectStatus.COMPLETED))
            )
        ).scalar() or 0

        overdue_projects = (
            await self.session.execute(
                select(func.count()).where(
                    and_(
                        base_project_filter,
                        Project.due_date.is_not(None),
                        Project.due_date < now,
                        Project.status.notin_(
                            [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED, ProjectStatus.FAILED]
                        ),
                    )
                )
            )
        ).scalar() or 0

        total_tasks = (
            await self.session.execute(select(func.count()).select_from(Task).where(base_task_filter))
        ).scalar() or 0

        completed_tasks = (
            await self.session.execute(
                select(func.count()).where(and_(base_task_filter, Task.status == TaskStatus.COMPLETED))
            )
        ).scalar() or 0

        in_progress_tasks = (
            await self.session.execute(
                select(func.count()).where(and_(base_task_filter, Task.status == TaskStatus.IN_PROGRESS))
            )
        ).scalar() or 0

        overdue_tasks = (
            await self.session.execute(
                select(func.count()).where(
                    and_(
                        base_task_filter,
                        Task.scheduled_end.is_not(None),
                        Task.scheduled_end < now,
                        Task.status.notin_(
                            [
                                TaskStatus.COMPLETED,
                                TaskStatus.CANCELLED,
                                TaskStatus.FAILED,
                                TaskStatus.SKIPPED,
                            ]
                        ),
                    )
                )
            )
        ).scalar() or 0

        return DashboardMetrics(
            total_projects=total_projects,
            active_projects=active_projects,
            completed_projects=completed_projects,
            overdue_projects=overdue_projects,
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            in_progress_tasks=in_progress_tasks,
            overdue_tasks=overdue_tasks,
        )

    # ========================================================================
    # Team CRUD Operations
    # ========================================================================

    async def create_team(self, data: TeamCreate, created_by: str | None = None) -> Team:
        """Create a new team"""
        team = Team(
            tenant_id=self.tenant_id,
            team_code=data.team_code,
            name=data.name,
            description=data.description,
            team_type=data.team_type,
            max_concurrent_projects=data.max_concurrent_projects,
            max_concurrent_tasks=data.max_concurrent_tasks,
            service_areas=data.service_areas,
            coverage_radius_km=data.coverage_radius_km,
            home_base_address=data.home_base_address,
            working_hours_start=data.working_hours_start,
            working_hours_end=data.working_hours_end,
            working_days=data.working_days,
            lead_technician_id=data.lead_technician_id,
            tags=data.tags,
            notes=data.notes,
            created_by=created_by,
        )

        self.session.add(team)
        await self.session.commit()
        await self.session.refresh(team)

        logger.info("team.created", team_id=team.id, team_code=data.team_code, name=data.name)

        return team

    async def get_team(self, team_id: UUID) -> Team | None:
        """Get team by ID"""
        query = select(Team).where(
            and_(
                Team.id == team_id,
                Team.tenant_id == self.tenant_id,
                Team.deleted_at.is_(None),
            )
        )

        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_teams(
        self,
        team_type: str | None = None,
        is_active: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Team], int]:
        """List teams"""
        query = select(Team).where(
            and_(
                Team.tenant_id == self.tenant_id,
                Team.deleted_at.is_(None),
            )
        )

        if team_type:
            query = query.where(Team.team_type == team_type)
        if is_active is not None:
            query = query.where(Team.is_active == is_active)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        query = query.order_by(Team.name).offset(offset).limit(limit)

        result = await self.session.execute(query)
        teams = list(result.scalars().all())

        return teams, total

    async def update_team(
        self, team_id: UUID, data: TeamUpdate, updated_by: str | None = None
    ) -> Team | None:
        """Update team"""
        team = await self.get_team(team_id)
        if not team:
            return None

        # Update fields
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(team, field, value)

        team.updated_by = updated_by
        team.updated_at = datetime.now(UTC)

        await self.session.commit()
        await self.session.refresh(team)

        logger.info("team.updated", team_id=team_id, fields=list(update_data.keys()))

        return team

    # ========================================================================
    # Helper Methods
    # ========================================================================

    async def _generate_project_number(self) -> str:
        """Generate unique project number"""
        # Get count of projects for this tenant
        count_query = select(func.count()).where(Project.tenant_id == self.tenant_id)
        result = await self.session.execute(count_query)
        count = result.scalar() or 0

        # Format: PROJ-2025-001, PROJ-2025-002, etc.
        year = datetime.now().year
        return f"PROJ-{year}-{(count + 1):04d}"

    async def _generate_task_number(self, project_id: UUID) -> str:
        """Generate unique task number within project"""
        # Get count of tasks for this project
        count_query = select(func.count()).where(Task.project_id == project_id)
        result = await self.session.execute(count_query)
        count = result.scalar() or 0

        # Format: TASK-001, TASK-002, etc.
        return f"TASK-{(count + 1):03d}"

    async def _update_project_progress(self, project_id: UUID) -> None:
        """Update project progress based on task completion"""
        # Get all non-deleted tasks for project
        tasks_query = select(Task).where(
            and_(
                Task.project_id == project_id,
                Task.deleted_at.is_(None),
            )
        )

        tasks_result = await self.session.execute(tasks_query)
        tasks = list(tasks_result.scalars().all())

        if not tasks:
            return

        total_tasks = len(tasks)
        completed_tasks = sum(1 for task in tasks if task.status == TaskStatus.COMPLETED)

        # Calculate overall completion percentage
        completion_percent = int((completed_tasks / total_tasks) * 100)

        # Update project
        project = await self.get_project(project_id)
        if project:
            project.tasks_total = total_tasks
            project.tasks_completed = completed_tasks
            project.completion_percent = completion_percent

            # Auto-complete project if all tasks done
            if completed_tasks == total_tasks and total_tasks > 0:
                project.status = ProjectStatus.COMPLETED
                if not project.actual_end:
                    project.actual_end = datetime.now(UTC)

            await self.session.commit()
