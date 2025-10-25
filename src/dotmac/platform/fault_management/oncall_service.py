"""
On-Call Schedule Service

Service layer for managing on-call schedules and rotations.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmSeverity,
    OnCallRotation,
    OnCallSchedule,
)
from dotmac.platform.user_management.models import User

logger = structlog.get_logger(__name__)


class OnCallScheduleService:
    """
    Service for managing on-call schedules and determining current on-call users.
    """

    def __init__(self, session: AsyncSession, tenant_id: str):
        """
        Initialize on-call schedule service.

        Args:
            session: Database session
            tenant_id: Tenant identifier
        """
        self.session = session
        self.tenant_id = tenant_id

    async def get_current_oncall_users(
        self,
        alarm: Alarm | None = None,
        current_time: datetime | None = None,
    ) -> list[User]:
        """
        Get list of users currently on-call.

        Args:
            alarm: Optional alarm to filter by severity
            current_time: Time to check (defaults to now)

        Returns:
            List of users currently on-call
        """
        if current_time is None:
            current_time = datetime.now(UTC)

        # Build query for active rotations at current time
        rotation_query = (
            select(OnCallRotation)
            .where(
                and_(
                    OnCallRotation.tenant_id == self.tenant_id,
                    OnCallRotation.is_active == True,  # noqa: E712
                    OnCallRotation.start_time <= current_time,
                    OnCallRotation.end_time > current_time,
                )
            )
        )

        # If alarm provided, filter by severity
        if alarm and alarm.severity:
            # Get schedules that match alarm severity
            schedule_query = (
                select(OnCallSchedule.id)
                .where(
                    and_(
                        OnCallSchedule.tenant_id == self.tenant_id,
                        OnCallSchedule.is_active == True,  # noqa: E712
                        or_(
                            # Empty list means all severities
                            OnCallSchedule.alarm_severities == [],
                            # Or severity is in the list
                            OnCallSchedule.alarm_severities.contains([alarm.severity.value]),
                        ),
                    )
                )
            )

            # Filter rotations by schedule
            rotation_query = rotation_query.where(
                OnCallRotation.schedule_id.in_(schedule_query)
            )

        # Execute rotation query
        result = await self.session.execute(rotation_query)
        rotations = result.scalars().all()

        if not rotations:
            logger.debug(
                "oncall.no_rotations_found",
                tenant_id=self.tenant_id,
                current_time=current_time.isoformat(),
                alarm_severity=alarm.severity.value if alarm else None,
            )
            return []

        # Get unique user IDs
        user_ids = list(set(rotation.user_id for rotation in rotations))

        # Fetch users
        user_query = select(User).where(
            and_(
                User.id.in_(user_ids),
                User.is_active == True,  # noqa: E712
            )
        )

        result = await self.session.execute(user_query)
        users = list(result.scalars().all())

        logger.info(
            "oncall.users_retrieved",
            tenant_id=self.tenant_id,
            user_count=len(users),
            rotation_count=len(rotations),
            alarm_severity=alarm.severity.value if alarm else None,
        )

        return users

    async def create_schedule(
        self,
        name: str,
        rotation_start: datetime,
        rotation_duration_hours: int = 168,
        schedule_type: str = "weekly",
        alarm_severities: list[str] | None = None,
        team_name: str | None = None,
        timezone: str = "UTC",
        description: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> OnCallSchedule:
        """
        Create new on-call schedule.

        Args:
            name: Schedule name
            rotation_start: Start time for rotations
            rotation_duration_hours: Duration of each rotation in hours
            schedule_type: Type of schedule (daily, weekly, custom)
            alarm_severities: List of alarm severities to trigger for
            team_name: Team name for the schedule
            timezone: Timezone for the schedule
            description: Optional description
            metadata: Optional metadata

        Returns:
            Created schedule
        """
        from dotmac.platform.fault_management.models import OnCallScheduleType

        schedule = OnCallSchedule(
            tenant_id=self.tenant_id,
            name=name,
            description=description,
            schedule_type=OnCallScheduleType(schedule_type),
            rotation_start=rotation_start,
            rotation_duration_hours=rotation_duration_hours,
            alarm_severities=alarm_severities or [],
            team_name=team_name,
            timezone=timezone,
            metadata=metadata or {},
        )

        self.session.add(schedule)
        await self.session.flush()

        logger.info(
            "oncall.schedule_created",
            tenant_id=self.tenant_id,
            schedule_id=str(schedule.id),
            name=name,
        )

        return schedule

    async def create_rotation(
        self,
        schedule_id: UUID,
        user_id: UUID,
        start_time: datetime,
        end_time: datetime,
        is_override: bool = False,
        override_reason: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> OnCallRotation:
        """
        Create new on-call rotation assignment.

        Args:
            schedule_id: Schedule ID
            user_id: User ID
            start_time: Rotation start time
            end_time: Rotation end time
            is_override: Whether this is a manual override
            override_reason: Reason for override
            metadata: Optional metadata

        Returns:
            Created rotation
        """
        rotation = OnCallRotation(
            tenant_id=self.tenant_id,
            schedule_id=schedule_id,
            user_id=user_id,
            start_time=start_time,
            end_time=end_time,
            is_override=is_override,
            override_reason=override_reason,
            metadata=metadata or {},
        )

        self.session.add(rotation)
        await self.session.flush()

        logger.info(
            "oncall.rotation_created",
            tenant_id=self.tenant_id,
            rotation_id=str(rotation.id),
            schedule_id=str(schedule_id),
            user_id=str(user_id),
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
        )

        return rotation

    async def get_schedule(self, schedule_id: UUID) -> OnCallSchedule | None:
        """
        Get on-call schedule by ID.

        Args:
            schedule_id: Schedule ID

        Returns:
            Schedule or None if not found
        """
        result = await self.session.execute(
            select(OnCallSchedule).where(
                and_(
                    OnCallSchedule.id == schedule_id,
                    OnCallSchedule.tenant_id == self.tenant_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_schedules(
        self,
        is_active: bool | None = None,
    ) -> list[OnCallSchedule]:
        """
        List all on-call schedules for tenant.

        Args:
            is_active: Filter by active status

        Returns:
            List of schedules
        """
        query = select(OnCallSchedule).where(
            OnCallSchedule.tenant_id == self.tenant_id
        )

        if is_active is not None:
            query = query.where(OnCallSchedule.is_active == is_active)

        query = query.order_by(OnCallSchedule.name)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def list_rotations(
        self,
        schedule_id: UUID | None = None,
        user_id: UUID | None = None,
        start_after: datetime | None = None,
        end_before: datetime | None = None,
    ) -> list[OnCallRotation]:
        """
        List on-call rotations.

        Args:
            schedule_id: Filter by schedule
            user_id: Filter by user
            start_after: Filter by start time after
            end_before: Filter by end time before

        Returns:
            List of rotations
        """
        query = select(OnCallRotation).where(
            OnCallRotation.tenant_id == self.tenant_id
        )

        if schedule_id:
            query = query.where(OnCallRotation.schedule_id == schedule_id)

        if user_id:
            query = query.where(OnCallRotation.user_id == user_id)

        if start_after:
            query = query.where(OnCallRotation.start_time >= start_after)

        if end_before:
            query = query.where(OnCallRotation.end_time <= end_before)

        query = query.order_by(OnCallRotation.start_time.desc())

        result = await self.session.execute(query)
        return list(result.scalars().all())
