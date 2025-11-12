"""
Project Management Event Handlers

Handles events related to project lifecycle, including automatic project
# mypy: disable-error-code="arg-type,assignment"
creation from sales orders.
"""

from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import AsyncSessionLocal
from dotmac.platform.events.decorators import subscribe
from dotmac.platform.events.models import Event
from dotmac.platform.project_management.jinja_utils import render_template
from dotmac.platform.project_management.models import (
    Project,
    ProjectStatus,
    Team,
)
from dotmac.platform.project_management.schemas import ProjectCreate, TaskCreate
from dotmac.platform.project_management.service import ProjectManagementService
from dotmac.platform.project_management.templates import (
    ProjectTemplate,
    get_template_for_order,
)

logger = structlog.get_logger(__name__)


async def find_best_team(
    session: AsyncSession,
    tenant_id: str,
    required_team_type: str | None,
    service_address: str | None,
    required_skills: dict,
) -> UUID | None:
    """
    Find the best team for a project based on skills, location, and capacity.

    Selection criteria (in order of priority):
    1. Team type matches requirement
    2. Team has required skills
    3. Team services the area (if location provided)
    4. Team has available capacity
    5. Team with lowest current workload

    Args:
        session: Database session
        tenant_id: Tenant ID
        required_team_type: Required team type (e.g., "installation")
        service_address: Service location address
        required_skills: Dictionary of required skills

    Returns:
        Team ID or None if no suitable team found
    """
    query = select(Team).where(
        and_(
            Team.tenant_id == tenant_id,
            Team.is_active,
            Team.deleted_at is None,
        )
    )

    # Filter by team type if specified
    if required_team_type:
        from dotmac.platform.project_management.models import TeamType

        try:
            team_type_enum = TeamType(required_team_type)
            query = query.where(Team.team_type == team_type_enum)
        except ValueError:
            logger.warning(
                "Invalid team type specified",
                required_team_type=required_team_type,
            )

    result = await session.execute(query)
    teams = result.scalars().all()

    if not teams:
        logger.warning(
            "No teams found matching criteria",
            tenant_id=tenant_id,
            required_team_type=required_team_type,
        )
        return None

    # Score teams based on match criteria
    team_scores = []

    for team in teams:
        score = 0.0

        # Check if team has required skills (if team_skills is defined)
        if required_skills and team.team_skills:
            matching_skills = sum(
                1 for skill in required_skills.keys() if team.team_skills.get(skill, False)
            )
            skill_match_ratio = matching_skills / len(required_skills) if required_skills else 0
            score += skill_match_ratio * 50  # Skills worth up to 50 points

        # Check capacity (if max_concurrent_projects is set)
        if team.max_concurrent_projects:
            # Count active projects for this team
            active_projects_query = select(func.count(Project.id)).where(
                and_(
                    Project.assigned_team_id == team.id,
                    Project.status.in_(
                        [
                            ProjectStatus.PLANNED,
                            ProjectStatus.SCHEDULED,
                            ProjectStatus.IN_PROGRESS,
                        ]
                    ),
                    Project.deleted_at is None,
                )
            )
            result = await session.execute(active_projects_query)
            raw_project_count = cast(int | None, result.scalar())
            active_project_count = raw_project_count if raw_project_count is not None else 0

            if active_project_count < team.max_concurrent_projects:
                # Has capacity - calculate utilization score
                utilization = active_project_count / team.max_concurrent_projects
                capacity_score = (
                    1.0 - utilization
                ) * 30  # Low utilization = higher score (up to 30 points)
                score += capacity_score
            else:
                # Team at capacity - penalize heavily
                score -= 100

        # Bonus for high completion rate
        if team.completion_rate:
            score += team.completion_rate * 20  # Up to 20 points for 100% completion rate

        team_scores.append((team.id, score))

    # Sort by score (highest first)
    team_scores.sort(key=lambda x: x[1], reverse=True)

    if team_scores:
        best_team_id = team_scores[0][0]
        best_score = team_scores[0][1]

        logger.info(
            "Selected best team",
            team_id=str(best_team_id),
            score=best_score,
            total_candidates=len(team_scores),
        )

        return best_team_id

    return None


@subscribe("order.completed")  # type: ignore[misc]
async def handle_order_completed_create_project(event: Event) -> None:
    """
    Handle order completion event and automatically create project with tasks.

    When an order is completed for fiber/wireless installation, automatically:
    1. Determine the appropriate project template
    2. Create a project
    3. Generate tasks from the template
    4. Auto-assign to the best available team

    This handler runs in addition to the installation ticket handler.
    """
    order_id = event.payload.get("order_id")
    tenant_id = event.payload.get("tenant_id") or event.metadata.tenant_id
    order_type = event.payload.get("order_type")
    service_type = event.payload.get("service_type")

    logger.info(
        "Handling order.completed event for project creation",
        order_id=order_id,
        tenant_id=tenant_id,
        order_type=order_type,
        service_type=service_type,
    )

    if tenant_id is None:
        logger.error("Order event missing tenant_id; cannot create project", order_id=order_id)
        return

    # Check database templates first, fall back to hardcoded templates
    db_template: Any | None = None
    fallback_template: ProjectTemplate | None = None

    try:
        from dotmac.platform.project_management.template_service import TemplateBuilderService

        async with AsyncSessionLocal() as session:
            template_service = TemplateBuilderService(session, tenant_id)

            templates, _ = await template_service.list_templates(
                is_active=True,
                applies_to_order_type=order_type,
                applies_to_service_type=service_type,
                limit=1,
            )

            if templates:
                db_template = templates[0]
                db_template = await template_service.get_template(
                    db_template.id, include_tasks=True
                )
                if db_template:
                    logger.info(
                        "Using database template",
                        template_id=str(db_template.id),
                        template_code=db_template.template_code,
                    )
    except Exception as e:
        logger.warning(
            "Failed to load database template, falling back to hardcoded",
            error=str(e),
        )

    # Fall back to hardcoded templates if no database template found
    if not db_template:
        fallback_template = get_template_for_order(order_type or "", service_type or "")

    if not db_template and not fallback_template:
        logger.debug(
            "No project template found for order",
            order_id=order_id,
            order_type=order_type,
            service_type=service_type,
        )
        return

    # Fetch order details
    try:
        from dotmac.platform.sales.models import Order

        async with AsyncSessionLocal() as session:
            order_query = select(Order).where(Order.id == order_id)
            result = await session.execute(order_query)
            order = result.scalar_one_or_none()

            if not order:
                logger.error("Order not found", order_id=order_id)
                return

            customer_name = order.company_name or order.customer_name or "Customer"
            service_address = getattr(order, "service_address", None) or order.customer_email

            # Get customer_id if available
            customer_id = getattr(order, "customer_id", None)

            # Format template strings - handle both database and hardcoded templates
            if db_template:
                project_name_pattern = (
                    db_template.project_name_pattern or f"Project for {customer_name}"
                )
                project_description_pattern = db_template.project_description_pattern
                estimated_duration = db_template.estimated_duration_hours
                priority = db_template.default_priority
                required_team_type = db_template.required_team_type
                template_tasks = list(db_template.tasks or [])
            else:
                # fallback_template must be present
                if fallback_template is None:
                    logger.error("Fallback template unexpectedly missing")
                    return
                project_name_pattern = fallback_template.name_pattern
                project_description_pattern = fallback_template.description_pattern
                estimated_duration = fallback_template.estimated_duration_hours
                priority = fallback_template.priority
                required_team_type = fallback_template.required_team_type
                template_tasks = list(fallback_template.tasks or [])

            # Render project name/description with Jinja2
            context = {
                "customer_name": customer_name,
                "order_number": order.order_number,
                "service_address": service_address or "TBD",
            }

            project_name = render_template(
                project_name_pattern,
                context,
                default=f"Project - {customer_name}",
            )

            project_description = render_template(
                project_description_pattern,
                context,
                default="",
            )

            # Find best team for assignment
            # Collect all required skills from template tasks
            all_required_skills: dict[str, bool] = {}
            for task in template_tasks:
                task_skills = task.required_skills if hasattr(task, "required_skills") else {}
                if task_skills:
                    all_required_skills.update(task_skills)

            best_team_id = await find_best_team(
                session=session,
                tenant_id=tenant_id,
                required_team_type=required_team_type,
                service_address=service_address,
                required_skills=all_required_skills,
            )

            # Calculate scheduled start (default to tomorrow at 8 AM)
            scheduled_start = datetime.now(UTC).replace(
                hour=8, minute=0, second=0, microsecond=0
            ) + timedelta(days=1)
            scheduled_end = scheduled_start + timedelta(hours=estimated_duration or 8.0)

            # Create project using service
            project_service = ProjectManagementService(session, tenant_id)

            # Get project type
            if db_template:
                proj_type = db_template.project_type
            else:
                if fallback_template is None:
                    logger.error("Fallback template unexpectedly missing")
                    return
                proj_type = fallback_template.project_type

            template_note = ""
            if db_template is not None and hasattr(db_template, "template_code"):
                template_note = f" using template {db_template.template_code}"

            project_data = ProjectCreate(
                name=project_name,
                description=project_description,
                project_type=proj_type,
                priority=priority,
                customer_id=customer_id,
                order_id=str(order_id),
                service_address=service_address,
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_end,
                estimated_duration_hours=estimated_duration,
                assigned_team_id=best_team_id,
                notes=f"Auto-generated from order {order.order_number}{template_note}",
                tags=["auto_generated", "from_order", order_type or "unknown"],
            )

            project = await project_service.create_project(
                project_data,
                created_by="system",
            )

            logger.info(
                "Created project from order",
                project_id=str(project.id),
                project_number=project.project_number,
                order_id=order_id,
                team_id=str(best_team_id) if best_team_id else None,
            )

            # Create tasks from template
            task_id_map: dict[int, UUID] = {}  # Map template sequence_order to actual task IDs

            for task_template in sorted(template_tasks, key=lambda t: t.sequence_order):
                # Handle both database and hardcoded task templates
                if db_template:
                    # Database template task
                    t_name = task_template.name
                    t_description = task_template.description
                    t_type = task_template.task_type
                    t_priority = task_template.priority
                    t_sequence = task_template.sequence_order
                    t_duration = task_template.estimated_duration_minutes
                    t_skills = task_template.required_skills or {}
                    t_equipment = task_template.required_equipment or []
                    t_certs = task_template.required_certifications or []
                    t_customer = task_template.requires_customer_presence
                    t_depends_raw = getattr(task_template, "depends_on_sequence_orders", None)
                    t_depends = list(t_depends_raw or [])
                else:
                    # Hardcoded template task
                    t_name = task_template.name
                    t_description = task_template.description
                    t_type = task_template.task_type
                    t_priority = task_template.priority
                    t_sequence = task_template.sequence_order
                    t_duration = task_template.estimated_duration_minutes
                    t_skills = task_template.required_skills or {}
                    t_equipment = task_template.required_equipment or []
                    t_certs = task_template.required_certifications or []
                    t_customer = task_template.requires_customer_presence
                    t_depends = list(task_template.depends_on_task_order or [])

                # Map depends_on_task_order to actual task IDs
                depends_on_tasks: list[UUID] = []
                for dep_order in t_depends:
                    if dep_order in task_id_map:
                        depends_on_tasks.append(task_id_map[dep_order])

                task_data = TaskCreate(
                    project_id=project.id,
                    name=t_name,
                    description=t_description,
                    task_type=t_type,
                    priority=t_priority,
                    sequence_order=t_sequence,
                    assigned_team_id=best_team_id,
                    service_address=service_address if t_customer else None,
                    estimated_duration_minutes=t_duration,
                    required_skills=t_skills,
                    required_equipment=t_equipment,
                    required_certifications=t_certs,
                    requires_customer_presence=t_customer,
                )

                task = await project_service.create_task(task_data, created_by="system")

                # Store mapping for dependency resolution
                task_id_map[t_sequence] = task.id

                # Update depends_on_tasks if there are dependencies
                if depends_on_tasks:
                    task.depends_on_tasks = list(depends_on_tasks)
                    await session.commit()

                logger.debug(
                    "Created task from template",
                    task_id=str(task.id),
                    task_number=task.task_number,
                    sequence=t_sequence,
                    dependencies=len(depends_on_tasks),
                )

            logger.info(
                "Project creation complete",
                project_id=str(project.id),
                tasks_created=len(template_tasks),
                order_id=order_id,
            )

    except Exception as e:
        logger.error(
            "Failed to create project from order",
            order_id=order_id,
            error=str(e),
            exc_info=True,
        )
        raise
