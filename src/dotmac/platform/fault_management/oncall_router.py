"""
On-Call Schedule API Router

FastAPI router for on-call schedule and rotation management.
"""

from datetime import datetime
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.database import get_async_session
from dotmac.platform.fault_management.models import OnCallRotation, OnCallSchedule
from dotmac.platform.fault_management.oncall_schemas import (
    CurrentOnCallResponse,
    OnCallRotationCreate,
    OnCallRotationResponse,
    OnCallRotationUpdate,
    OnCallScheduleCreate,
    OnCallScheduleResponse,
    OnCallScheduleUpdate,
)
from dotmac.platform.fault_management.oncall_service import OnCallScheduleService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/oncall", tags=["On-Call Schedules"])


# ============================================================================
# On-Call Schedule Endpoints
# ============================================================================


@router.post(
    "/schedules",
    response_model=OnCallScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create on-call schedule",
)
async def create_oncall_schedule(
    schedule_data: OnCallScheduleCreate,
    user: UserInfo = Depends(require_permission("fault:oncall:manage")),
    db: AsyncSession = Depends(get_async_session),
) -> OnCallSchedule:
    """
    Create a new on-call schedule.

    Requires `fault:oncall:manage` permission.
    """
    service = OnCallScheduleService(db, user.tenant_id)

    schedule = await service.create_schedule(
        name=schedule_data.name,
        rotation_start=schedule_data.rotation_start,
        rotation_duration_hours=schedule_data.rotation_duration_hours,
        schedule_type=schedule_data.schedule_type.value,
        alarm_severities=schedule_data.alarm_severities,
        team_name=schedule_data.team_name,
        timezone=schedule_data.timezone,
        description=schedule_data.description,
        metadata=schedule_data.metadata,
    )

    await db.commit()

    logger.info(
        "oncall.schedule.created",
        tenant_id=user.tenant_id,
        schedule_id=str(schedule.id),
        name=schedule.name,
        user_id=user.user_id,
    )

    return schedule


@router.get(
    "/schedules",
    response_model=list[OnCallScheduleResponse],
    summary="List on-call schedules",
)
async def list_oncall_schedules(
    is_active: bool | None = Query(None, description="Filter by active status"),
    user: UserInfo = Depends(require_permission("fault:oncall:view")),
    db: AsyncSession = Depends(get_async_session),
) -> list[OnCallSchedule]:
    """
    List all on-call schedules for the tenant.

    Requires `fault:oncall:view` permission.
    """
    service = OnCallScheduleService(db, user.tenant_id)
    schedules = await service.list_schedules(is_active=is_active)

    logger.debug(
        "oncall.schedules.listed",
        tenant_id=user.tenant_id,
        count=len(schedules),
        is_active=is_active,
    )

    return schedules


@router.get(
    "/schedules/{schedule_id}",
    response_model=OnCallScheduleResponse,
    summary="Get on-call schedule",
)
async def get_oncall_schedule(
    schedule_id: UUID,
    user: UserInfo = Depends(require_permission("fault:oncall:view")),
    db: AsyncSession = Depends(get_async_session),
) -> OnCallSchedule:
    """
    Get on-call schedule by ID.

    Requires `fault:oncall:view` permission.
    """
    service = OnCallScheduleService(db, user.tenant_id)
    schedule = await service.get_schedule(schedule_id)

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"On-call schedule {schedule_id} not found",
        )

    return schedule


@router.patch(
    "/schedules/{schedule_id}",
    response_model=OnCallScheduleResponse,
    summary="Update on-call schedule",
)
async def update_oncall_schedule(
    schedule_id: UUID,
    update_data: OnCallScheduleUpdate,
    user: UserInfo = Depends(require_permission("fault:oncall:manage")),
    db: AsyncSession = Depends(get_async_session),
) -> OnCallSchedule:
    """
    Update on-call schedule.

    Requires `fault:oncall:manage` permission.
    """
    service = OnCallScheduleService(db, user.tenant_id)
    schedule = await service.get_schedule(schedule_id)

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"On-call schedule {schedule_id} not found",
        )

    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(schedule, field, value)

    # Update timestamp
    from datetime import UTC
    schedule.updated_at = datetime.now(UTC)

    await db.flush()
    await db.commit()

    logger.info(
        "oncall.schedule.updated",
        tenant_id=user.tenant_id,
        schedule_id=str(schedule_id),
        updated_fields=list(update_dict.keys()),
        user_id=user.user_id,
    )

    return schedule


@router.delete(
    "/schedules/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete on-call schedule",
)
async def delete_oncall_schedule(
    schedule_id: UUID,
    user: UserInfo = Depends(require_permission("fault:oncall:manage")),
    db: AsyncSession = Depends(get_async_session),
) -> None:
    """
    Delete on-call schedule.

    Requires `fault:oncall:manage` permission.
    """
    service = OnCallScheduleService(db, user.tenant_id)
    schedule = await service.get_schedule(schedule_id)

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"On-call schedule {schedule_id} not found",
        )

    await db.delete(schedule)
    await db.commit()

    logger.info(
        "oncall.schedule.deleted",
        tenant_id=user.tenant_id,
        schedule_id=str(schedule_id),
        user_id=user.user_id,
    )


# ============================================================================
# On-Call Rotation Endpoints
# ============================================================================


@router.post(
    "/rotations",
    response_model=OnCallRotationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create on-call rotation",
)
async def create_oncall_rotation(
    rotation_data: OnCallRotationCreate,
    user: UserInfo = Depends(require_permission("fault:oncall:manage")),
    db: AsyncSession = Depends(get_async_session),
) -> OnCallRotation:
    """
    Create a new on-call rotation assignment.

    Requires `fault:oncall:manage` permission.
    """
    service = OnCallScheduleService(db, user.tenant_id)

    # Verify schedule exists
    schedule = await service.get_schedule(rotation_data.schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"On-call schedule {rotation_data.schedule_id} not found",
        )

    rotation = await service.create_rotation(
        schedule_id=rotation_data.schedule_id,
        user_id=rotation_data.user_id,
        start_time=rotation_data.start_time,
        end_time=rotation_data.end_time,
        is_override=rotation_data.is_override,
        override_reason=rotation_data.override_reason,
        metadata=rotation_data.metadata,
    )

    await db.commit()

    logger.info(
        "oncall.rotation.created",
        tenant_id=user.tenant_id,
        rotation_id=str(rotation.id),
        schedule_id=str(rotation_data.schedule_id),
        assigned_user_id=str(rotation_data.user_id),
        user_id=user.user_id,
    )

    return rotation


@router.get(
    "/rotations",
    response_model=list[OnCallRotationResponse],
    summary="List on-call rotations",
)
async def list_oncall_rotations(
    schedule_id: UUID | None = Query(None, description="Filter by schedule"),
    user_id: UUID | None = Query(None, description="Filter by user"),
    start_after: datetime | None = Query(None, description="Filter by start time after"),
    end_before: datetime | None = Query(None, description="Filter by end time before"),
    user: UserInfo = Depends(require_permission("fault:oncall:view")),
    db: AsyncSession = Depends(get_async_session),
) -> list[OnCallRotation]:
    """
    List on-call rotations.

    Requires `fault:oncall:view` permission.
    """
    service = OnCallScheduleService(db, user.tenant_id)
    rotations = await service.list_rotations(
        schedule_id=schedule_id,
        user_id=user_id,
        start_after=start_after,
        end_before=end_before,
    )

    logger.debug(
        "oncall.rotations.listed",
        tenant_id=user.tenant_id,
        count=len(rotations),
        schedule_id=str(schedule_id) if schedule_id else None,
    )

    return rotations


@router.get(
    "/current",
    response_model=list[CurrentOnCallResponse],
    summary="Get current on-call users",
)
async def get_current_oncall(
    user: UserInfo = Depends(require_permission("fault:oncall:view")),
    db: AsyncSession = Depends(get_async_session),
) -> list[dict]:
    """
    Get list of users currently on-call.

    Requires `fault:oncall:view` permission.
    """
    from sqlalchemy import and_, select

    service = OnCallScheduleService(db, user.tenant_id)
    oncall_users = await service.get_current_oncall_users()

    # Build response with rotation and schedule details
    current_time = datetime.now()

    rotation_query = (
        select(OnCallRotation, OnCallSchedule)
        .join(OnCallSchedule, OnCallRotation.schedule_id == OnCallSchedule.id)
        .where(
            and_(
                OnCallRotation.tenant_id == user.tenant_id,
                OnCallRotation.is_active == True,  # noqa: E712
                OnCallRotation.start_time <= current_time,
                OnCallRotation.end_time > current_time,
            )
        )
    )

    result = await db.execute(rotation_query)
    rotation_schedule_pairs = result.all()

    # Build response
    response = []
    for rotation, schedule in rotation_schedule_pairs:
        # Find matching user
        matching_user = next((u for u in oncall_users if u.id == rotation.user_id), None)
        if matching_user:
            response.append({
                "user_id": rotation.user_id,
                "user_email": matching_user.email,
                "user_name": f"{matching_user.first_name} {matching_user.last_name}",
                "schedule_id": schedule.id,
                "schedule_name": schedule.name,
                "rotation_id": rotation.id,
                "start_time": rotation.start_time,
                "end_time": rotation.end_time,
                "is_override": rotation.is_override,
            })

    logger.debug(
        "oncall.current.retrieved",
        tenant_id=user.tenant_id,
        count=len(response),
    )

    return response
