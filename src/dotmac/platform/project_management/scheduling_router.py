"""
Scheduling API Router

REST API endpoints for technician scheduling, task assignment, and availability management.
"""

from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.auth.token_with_rbac import get_current_user_with_rbac
from dotmac.platform.db import get_async_session
from dotmac.platform.field_service.models import Technician
from dotmac.platform.project_management.assignment_algorithms import (
    TaskAssignmentAlgorithm,
    assign_task_automatically,
)
from dotmac.platform.project_management.models import Task
from dotmac.platform.project_management.scheduling_models import (
    AssignmentStatus,
    TaskAssignment,
    TechnicianSchedule,
)
from dotmac.platform.project_management.scheduling_schemas import (
    AssignmentCandidateResponse,
    AvailabilityCheckRequest,
    AvailabilityCheckResponse,
    # Availability schemas
    TaskAssignmentAutoCreate,
    # Assignment schemas
    TaskAssignmentCreate,
    TaskAssignmentListResponse,
    TaskAssignmentReschedule,
    TaskAssignmentResponse,
    TaskAssignmentUpdate,
    # Schedule schemas
    TechnicianScheduleCreate,
    TechnicianScheduleListResponse,
    TechnicianScheduleResponse,
    TechnicianScheduleUpdate,
)
from dotmac.platform.tenant import get_current_tenant_id

router = APIRouter(prefix="/api/v1/scheduling", tags=["scheduling"])


# ============================================================================
# Technician Schedule Endpoints
# ============================================================================


@router.post(
    "/technicians/{technician_id}/schedules",
    response_model=TechnicianScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_technician_schedule(
    technician_id: UUID,
    schedule: TechnicianScheduleCreate,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: dict = Depends(get_current_user_with_rbac),
) -> TechnicianSchedule:
    """
    Create a schedule for a technician.

    Creates a daily schedule defining shift times, breaks, and capacity.
    """
    # Verify technician exists and belongs to tenant
    result = await session.execute(
        select(Technician).where(
            and_(
                Technician.id == technician_id,
                Technician.tenant_id == tenant_id,
                Technician.is_active,
            )
        )
    )
    technician = result.scalar_one_or_none()
    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")

    # Check if schedule already exists for this date
    existing = await session.execute(
        select(TechnicianSchedule).where(
            and_(
                TechnicianSchedule.technician_id == technician_id,
                TechnicianSchedule.schedule_date == schedule.schedule_date,
                TechnicianSchedule.tenant_id == tenant_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Schedule already exists for this date"
        )

    # Create schedule
    from uuid import uuid4

    db_schedule = TechnicianSchedule(
        id=uuid4(),
        tenant_id=tenant_id,
        technician_id=technician_id,
        **schedule.model_dump(exclude={"technician_id"}),
        created_by=current_user.get("sub"),
    )

    session.add(db_schedule)
    await session.commit()
    await session.refresh(db_schedule)

    return db_schedule


@router.get(
    "/schedules",
    response_model=TechnicianScheduleListResponse,
)
async def list_schedules(
    technician_id: UUID | None = Query(None),
    start_date: date | None = Query(None, alias="dateFrom"),
    end_date: date | None = Query(None, alias="dateTo"),
    status: str | None = Query(None),
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
) -> TechnicianScheduleListResponse:
    """
    List schedules with optional technician/date/status filters.
    """
    query = select(TechnicianSchedule).where(TechnicianSchedule.tenant_id == tenant_id)

    if technician_id:
        query = query.where(TechnicianSchedule.technician_id == technician_id)
    if start_date:
        query = query.where(TechnicianSchedule.schedule_date >= start_date)
    if end_date:
        query = query.where(TechnicianSchedule.schedule_date <= end_date)
    if status:
        query = query.where(TechnicianSchedule.status == status)

    total = (await session.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    page = (offset // limit) + 1 if limit else 1

    result = await session.execute(query.order_by(TechnicianSchedule.schedule_date).limit(limit).offset(offset))
    schedules = list(result.scalars().all())

    return TechnicianScheduleListResponse(
        schedules=schedules,
        total=total,
        page=page,
        page_size=limit,
    )


@router.get(
    "/technicians/schedules",
    response_model=TechnicianScheduleListResponse,
)
async def list_schedules_alias(
    technician_id: UUID | None = Query(None),
    start_date: date | None = Query(None, alias="dateFrom"),
    end_date: date | None = Query(None, alias="dateTo"),
    status: str | None = Query(None),
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
) -> TechnicianScheduleListResponse:
    """Alias for list_schedules to support legacy path used by UI."""
    return await list_schedules(
        technician_id=technician_id,
        start_date=start_date,
        end_date=end_date,
        status=status,
        limit=limit,
        offset=offset,
        session=session,
        tenant_id=tenant_id,
    )


@router.get(
    "/technicians/{technician_id}/schedules",
    response_model=list[TechnicianScheduleResponse],
)
async def get_technician_schedules(
    technician_id: UUID,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
) -> list[TechnicianSchedule]:
    """
    Get schedules for a technician within a date range.
    """
    query = select(TechnicianSchedule).where(
        and_(
            TechnicianSchedule.technician_id == technician_id,
            TechnicianSchedule.tenant_id == tenant_id,
        )
    )

    if start_date:
        query = query.where(TechnicianSchedule.schedule_date >= start_date)
    if end_date:
        query = query.where(TechnicianSchedule.schedule_date <= end_date)

    query = query.order_by(TechnicianSchedule.schedule_date)

    result = await session.execute(query)
    return list(result.scalars().all())


@router.put(
    "/schedules/{schedule_id}",
    response_model=TechnicianScheduleResponse,
)
async def update_technician_schedule(
    schedule_id: UUID,
    schedule_update: TechnicianScheduleUpdate,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: dict = Depends(get_current_user_with_rbac),
) -> TechnicianSchedule:
    """
    Update a technician schedule.
    """
    result = await session.execute(
        select(TechnicianSchedule).where(
            and_(TechnicianSchedule.id == schedule_id, TechnicianSchedule.tenant_id == tenant_id)
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    # Update fields
    update_data = schedule_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(schedule, key, value)

    schedule.updated_by = current_user.get("sub")

    await session.commit()
    await session.refresh(schedule)

    return schedule


# ============================================================================
# Task Assignment Endpoints
# ============================================================================


@router.post(
    "/assignments",
    response_model=TaskAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_assignment(
    assignment: TaskAssignmentCreate,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: dict = Depends(get_current_user_with_rbac),
) -> TaskAssignment:
    """
    Manually assign a task to a technician.

    Creates a task assignment with specified schedule and technician.
    """
    # Verify task exists
    task_result = await session.execute(
        select(Task).where(and_(Task.id == assignment.task_id, Task.tenant_id == tenant_id))
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Verify technician exists
    tech_result = await session.execute(
        select(Technician).where(
            and_(
                Technician.id == assignment.technician_id,
                Technician.tenant_id == tenant_id,
                Technician.is_active,
            )
        )
    )
    technician = tech_result.scalar_one_or_none()
    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")

    # Check for scheduling conflicts
    conflicts = await session.execute(
        select(TaskAssignment).where(
            and_(
                TaskAssignment.technician_id == assignment.technician_id,
                TaskAssignment.tenant_id == tenant_id,
                TaskAssignment.status.in_(
                    [
                        AssignmentStatus.SCHEDULED,
                        AssignmentStatus.CONFIRMED,
                        AssignmentStatus.IN_PROGRESS,
                    ]
                ),
                or_(
                    and_(
                        TaskAssignment.scheduled_start <= assignment.scheduled_start,
                        TaskAssignment.scheduled_end > assignment.scheduled_start,
                    ),
                    and_(
                        TaskAssignment.scheduled_start < assignment.scheduled_end,
                        TaskAssignment.scheduled_end >= assignment.scheduled_end,
                    ),
                ),
            )
        )
    )
    if conflicts.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Technician has conflicting assignment at this time",
        )

    # Create assignment
    from uuid import uuid4

    db_assignment = TaskAssignment(
        id=uuid4(),
        tenant_id=tenant_id,
        **assignment.model_dump(),
        assignment_method="manual",
        created_by=current_user.get("sub"),
    )

    session.add(db_assignment)
    await session.commit()
    await session.refresh(db_assignment)

    return db_assignment


@router.post(
    "/assignments/auto-assign",
    response_model=TaskAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def auto_assign_task(
    auto_assignment: TaskAssignmentAutoCreate,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: dict = Depends(get_current_user_with_rbac),
) -> TaskAssignment:
    """
    Automatically assign a task to the best available technician.

    Uses the smart assignment algorithm to find and assign the optimal technician
    based on skills, location, availability, workload, and certifications.
    """
    # Verify task exists
    task_result = await session.execute(
        select(Task).where(and_(Task.id == auto_assignment.task_id, Task.tenant_id == tenant_id))
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Prepare location tuple if provided
    task_location = None
    if auto_assignment.task_location_lat and auto_assignment.task_location_lng:
        task_location = (auto_assignment.task_location_lat, auto_assignment.task_location_lng)

    # Use assignment algorithm
    assignment = await assign_task_automatically(
        session=session,
        tenant_id=tenant_id,
        task=task,
        scheduled_start=auto_assignment.scheduled_start,
        scheduled_end=auto_assignment.scheduled_end,
        required_skills=auto_assignment.required_skills,
        required_certifications=auto_assignment.required_certifications,
        task_location=task_location,
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No qualified technician available for this task",
        )

    # Set additional fields
    assignment.customer_confirmation_required = auto_assignment.customer_confirmation_required
    assignment.notes = auto_assignment.notes
    assignment.created_by = current_user.get("sub")

    await session.commit()
    await session.refresh(assignment)

    return assignment


@router.get(
    "/assignments/{assignment_id}/candidates",
    response_model=list[AssignmentCandidateResponse],
)
async def get_assignment_candidates(
    assignment_id: UUID,
    max_candidates: int = Query(default=10, ge=1, le=20),
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
) -> list[AssignmentCandidateResponse]:
    """
    Get ranked list of candidate technicians for a task assignment.

    Returns technicians sorted by assignment score (best first).
    """
    # Get assignment
    result = await session.execute(
        select(TaskAssignment)
        .where(and_(TaskAssignment.id == assignment_id, TaskAssignment.tenant_id == tenant_id))
        .options(selectinload(TaskAssignment.task))
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    # Get task location if available
    task_location = None
    if assignment.task_location_lat and assignment.task_location_lng:
        task_location = (assignment.task_location_lat, assignment.task_location_lng)

    # Use assignment algorithm to find candidates
    algorithm = TaskAssignmentAlgorithm(session, tenant_id)
    candidates = await algorithm.find_best_technician(
        task=assignment.task,
        scheduled_start=assignment.scheduled_start,
        scheduled_end=assignment.scheduled_end,
        task_location=task_location,
        max_candidates=max_candidates,
    )

    return [
        AssignmentCandidateResponse(
            technician_id=c.technician_id,
            technician_name=c.technician_name,
            total_score=c.total_score,
            skill_match_score=c.skill_match_score,
            location_score=c.location_score,
            availability_score=c.availability_score,
            workload_score=c.workload_score,
            certification_score=c.certification_score,
            distance_km=c.distance_km,
            travel_time_minutes=c.travel_time_minutes,
            current_workload=c.current_workload,
            missing_skills=c.missing_skills,
            missing_certifications=c.missing_certifications,
            is_qualified=c.is_qualified,
        )
        for c in candidates
    ]


@router.get(
    "/assignments",
    response_model=TaskAssignmentListResponse,
)
async def list_task_assignments(
    technician_id: UUID | None = Query(None),
    task_id: UUID | None = Query(None),
    status_filter: str | None = Query(None),
    start_date: datetime | None = Query(None, alias="dateFrom"),
    end_date: datetime | None = Query(None, alias="dateTo"),
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0),
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
) -> TaskAssignmentListResponse:
    """
    List task assignments with optional filtering.
    """
    query = select(TaskAssignment).where(TaskAssignment.tenant_id == tenant_id)

    if technician_id:
        query = query.where(TaskAssignment.technician_id == technician_id)
    if task_id:
        query = query.where(TaskAssignment.task_id == task_id)
    if status_filter:
        statuses = [s for s in status_filter.split(",") if s]
        if statuses:
          query = query.where(TaskAssignment.status.in_(statuses))
    if start_date:
        query = query.where(TaskAssignment.scheduled_start >= start_date)
    if end_date:
        query = query.where(TaskAssignment.scheduled_end <= end_date)

    total = (await session.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    page = (offset // limit) + 1 if limit else 1

    result = await session.execute(
        query.order_by(TaskAssignment.scheduled_start).limit(limit).offset(offset)
    )
    assignments = list(result.scalars().all())

    return TaskAssignmentListResponse(
        assignments=assignments,
        total=total,
        page=page,
        page_size=limit,
    )


@router.put(
    "/assignments/{assignment_id}",
    response_model=TaskAssignmentResponse,
)
async def update_task_assignment(
    assignment_id: UUID,
    assignment_update: TaskAssignmentUpdate,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: dict = Depends(get_current_user_with_rbac),
) -> TaskAssignment:
    """
    Update a task assignment.
    """
    result = await session.execute(
        select(TaskAssignment).where(
            and_(TaskAssignment.id == assignment_id, TaskAssignment.tenant_id == tenant_id)
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    # Update fields
    update_data = assignment_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(assignment, key, value)

    assignment.updated_by = current_user.get("sub")

    await session.commit()
    await session.refresh(assignment)

    return assignment


@router.post(
    "/assignments/{assignment_id}/reschedule",
    response_model=TaskAssignmentResponse,
)
async def reschedule_task_assignment(
    assignment_id: UUID,
    reschedule: TaskAssignmentReschedule,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: dict = Depends(get_current_user_with_rbac),
) -> TaskAssignment:
    """
    Reschedule a task assignment to a new time.
    """
    result = await session.execute(
        select(TaskAssignment).where(
            and_(TaskAssignment.id == assignment_id, TaskAssignment.tenant_id == tenant_id)
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    # Store original time if first reschedule
    if assignment.reschedule_count == 0:
        assignment.original_scheduled_start = assignment.scheduled_start

    # Update schedule
    assignment.scheduled_start = reschedule.new_scheduled_start
    assignment.scheduled_end = reschedule.new_scheduled_end
    assignment.reschedule_count += 1
    assignment.reschedule_reason = reschedule.reason
    assignment.status = AssignmentStatus.RESCHEDULED
    assignment.updated_by = current_user.get("sub")

    # TODO: Send notification if notify_customer is True

    await session.commit()
    await session.refresh(assignment)

    return assignment


@router.delete(
    "/assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def cancel_task_assignment(
    assignment_id: UUID,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: dict = Depends(get_current_user_with_rbac),
) -> None:
    """
    Cancel a task assignment.
    """
    result = await session.execute(
        select(TaskAssignment).where(
            and_(TaskAssignment.id == assignment_id, TaskAssignment.tenant_id == tenant_id)
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    assignment.status = AssignmentStatus.CANCELLED
    assignment.updated_by = current_user.get("sub")

    await session.commit()


# ============================================================================
# Availability Endpoints
# ============================================================================


@router.post(
    "/availability/check",
    response_model=list[AvailabilityCheckResponse],
)
async def check_availability(
    availability_check: AvailabilityCheckRequest,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
) -> list[AvailabilityCheckResponse]:
    """
    Check which technicians are available for a specific time period.

    Returns list of technicians with availability status and conflict information.
    """
    # Get technicians to check
    query = select(Technician).where(and_(Technician.tenant_id == tenant_id, Technician.is_active))

    if availability_check.technician_ids:
        query = query.where(Technician.id.in_(availability_check.technician_ids))

    result = await session.execute(query)
    technicians = result.scalars().all()

    availability_results = []

    for tech in technicians:
        # Check for conflicting assignments
        conflicts_query = select(TaskAssignment).where(
            and_(
                TaskAssignment.technician_id == tech.id,
                TaskAssignment.tenant_id == tenant_id,
                TaskAssignment.status.in_(
                    [
                        AssignmentStatus.SCHEDULED,
                        AssignmentStatus.CONFIRMED,
                        AssignmentStatus.IN_PROGRESS,
                    ]
                ),
                or_(
                    and_(
                        TaskAssignment.scheduled_start <= availability_check.start_datetime,
                        TaskAssignment.scheduled_end > availability_check.start_datetime,
                    ),
                    and_(
                        TaskAssignment.scheduled_start < availability_check.end_datetime,
                        TaskAssignment.scheduled_end >= availability_check.end_datetime,
                    ),
                ),
            )
        )
        conflicts_result = await session.execute(conflicts_query)
        conflicts = conflicts_result.scalars().all()

        # Check skills if required
        has_required_skills = True
        if availability_check.required_skills:
            for skill, required in availability_check.required_skills.items():
                if required and not tech.has_skill(skill):
                    has_required_skills = False
                    break

        # Calculate distance if location provided
        distance_km = None
        if availability_check.task_location:
            lat, lng = availability_check.task_location
            distance_km = tech.distance_from(lat, lng)

        # Count current assignments
        count_result = await session.execute(
            select(TaskAssignment).where(
                and_(
                    TaskAssignment.technician_id == tech.id,
                    TaskAssignment.tenant_id == tenant_id,
                    TaskAssignment.status.in_(
                        [
                            AssignmentStatus.SCHEDULED,
                            AssignmentStatus.CONFIRMED,
                            AssignmentStatus.IN_PROGRESS,
                        ]
                    ),
                )
            )
        )
        current_assignments = len(count_result.scalars().all())

        # Build conflict list
        conflict_reasons = []
        if conflicts:
            conflict_reasons.append(f"{len(conflicts)} conflicting assignment(s)")
        if not has_required_skills:
            conflict_reasons.append("Missing required skills")
        if tech.status != "available":
            conflict_reasons.append(f"Status: {tech.status}")

        availability_results.append(
            AvailabilityCheckResponse(
                technician_id=tech.id,
                technician_name=tech.full_name,
                is_available=len(conflicts) == 0 and tech.status == "available",
                has_required_skills=has_required_skills,
                current_assignments=current_assignments,
                distance_km=distance_km,
                conflicts=conflict_reasons,
            )
        )

    return availability_results
