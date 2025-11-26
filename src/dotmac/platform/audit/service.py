"""
Audit service for tracking and retrieving activities across the platform.
"""

import math
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import Request
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    ActivitySeverity,
    ActivityType,
    AuditActivity,
    AuditActivityCreate,
    AuditActivityList,
    AuditActivityResponse,
    AuditFilterParams,
)

logger = structlog.get_logger(__name__)


class AuditService:
    """Service for audit activity tracking and retrieval."""

    def __init__(self, session: AsyncSession | None = None) -> None:
        self._session = session

    def _get_session(self) -> Any:
        """Get database session or session factory."""
        if self._session:
            # Return a context manager that yields the existing session
            from contextlib import asynccontextmanager

            @asynccontextmanager
            async def session_context() -> Any:
                yield self._session

            return session_context()
        else:
            # For service usage, create new session
            from ..db import AsyncSessionLocal

            return AsyncSessionLocal()

    async def log_activity(
        self,
        activity_type: ActivityType,
        action: str,
        description: str,
        *,
        user_id: str | None = None,
        tenant_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        severity: ActivitySeverity = ActivitySeverity.LOW,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
    ) -> AuditActivity:
        """Log an audit activity."""
        async with self._get_session() as session:
            activity_data = AuditActivityCreate(
                activity_type=activity_type,
                action=action,
                description=description,
                severity=severity,
                user_id=user_id,
                tenant_id=tenant_id,  # Let pydantic validator handle None
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
                ip_address=ip_address,
                user_agent=user_agent,
                request_id=request_id,
            )

            activity = AuditActivity(**activity_data.model_dump(exclude_none=True))
            session.add(activity)
            await session.commit()
            await session.refresh(activity)

            logger.info(
                "Audit activity logged",
                activity_type=activity_type,
                action=action,
                user_id=user_id,
                tenant_id=tenant_id,
                activity_id=str(activity.id),
            )

            return activity

    async def log_request_activity(
        self,
        request: Request,
        activity_type: ActivityType,
        action: str,
        description: str,
        **kwargs: Any,
    ) -> AuditActivity:
        """Log activity from a FastAPI request context."""
        # Extract request metadata
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        request_id = request.headers.get("x-request-id")

        # Extract user context if available
        # First try to get from request.state (set by middleware or dependencies)
        user_id = getattr(request.state, "user_id", None)
        tenant_id = getattr(request.state, "tenant_id", None)

        # Override with kwargs if provided
        if "user_id" in kwargs:
            user_id = kwargs.pop("user_id")
        if "tenant_id" in kwargs:
            tenant_id = kwargs.pop("tenant_id")

        return await self.log_activity(
            activity_type=activity_type,
            action=action,
            description=description,
            user_id=user_id,
            tenant_id=tenant_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            **kwargs,
        )

    def _build_user_tenant_conditions(
        self,
        filters: AuditFilterParams,
        for_user: str | None,
        for_tenant: str | None,
    ) -> list[Any]:
        """Build user and tenant filter conditions."""
        conditions = []

        if filters.user_id:
            conditions.append(AuditActivity.user_id == filters.user_id)
        elif for_user:
            conditions.append(AuditActivity.user_id == for_user)

        if filters.tenant_id:
            conditions.append(AuditActivity.tenant_id == filters.tenant_id)
        elif for_tenant:
            conditions.append(AuditActivity.tenant_id == for_tenant)

        return conditions

    def _build_attribute_conditions(self, filters: AuditFilterParams) -> list[Any]:
        """Build activity attribute filter conditions."""
        conditions = []

        if filters.activity_type:
            conditions.append(AuditActivity.activity_type == filters.activity_type)

        if filters.severity:
            conditions.append(AuditActivity.severity == filters.severity)

        if filters.resource_type:
            conditions.append(AuditActivity.resource_type == filters.resource_type)

        if filters.resource_id:
            conditions.append(AuditActivity.resource_id == filters.resource_id)

        return conditions

    def _build_date_conditions(self, filters: AuditFilterParams) -> list[Any]:
        """Build date range filter conditions."""
        conditions = []

        if filters.start_date:
            conditions.append(AuditActivity.timestamp >= filters.start_date)

        if filters.end_date:
            conditions.append(AuditActivity.timestamp <= filters.end_date)

        return conditions

    def _build_all_conditions(
        self,
        filters: AuditFilterParams,
        for_user: str | None,
        for_tenant: str | None,
    ) -> list[Any]:
        """Build all filter conditions."""
        conditions = []
        conditions.extend(self._build_user_tenant_conditions(filters, for_user, for_tenant))
        conditions.extend(self._build_attribute_conditions(filters))
        conditions.extend(self._build_date_conditions(filters))
        return conditions

    async def get_activities(
        self,
        filters: AuditFilterParams,
        *,
        for_user: str | None = None,
        for_tenant: str | None = None,
    ) -> AuditActivityList:
        """Get filtered and paginated audit activities."""
        async with self._get_session() as session:
            # Build base query
            query = select(AuditActivity)

            # Apply all filter conditions
            conditions = self._build_all_conditions(filters, for_user, for_tenant)
            if conditions:
                query = query.where(and_(*conditions))

            # Order by timestamp descending (most recent first)
            query = query.order_by(desc(AuditActivity.timestamp))

            # Get total count
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(count_query)
            total = total_result.scalar() or 0

            # Apply pagination
            offset = (filters.page - 1) * filters.per_page
            query = query.offset(offset).limit(filters.per_page)

            # Execute query
            result = await session.execute(query)
            activities = result.scalars().all()

            # Calculate pagination info
            has_next = offset + len(activities) < total
            has_prev = filters.page > 1
            total_pages = math.ceil(total / filters.per_page) if filters.per_page else 0

            return AuditActivityList(
                activities=[
                    AuditActivityResponse.model_validate(activity) for activity in activities
                ],
                total=total,
                page=filters.page,
                per_page=filters.per_page,
                total_pages=total_pages,
                has_next=has_next,
                has_prev=has_prev,
            )

    async def get_recent_activities(
        self,
        *,
        user_id: str | None = None,
        tenant_id: str | None = None,
        limit: int = 20,
        days: int = 30,
    ) -> list[AuditActivityResponse]:
        """Get recent activities for frontend dashboard."""
        since_date = datetime.now(UTC) - timedelta(days=days)

        filters = AuditFilterParams(
            user_id=user_id,
            tenant_id=tenant_id,
            start_date=since_date,
            per_page=limit,
            page=1,
        )

        result = await self.get_activities(filters)
        return result.activities

    async def get_activity_summary(
        self,
        *,
        user_id: str | None = None,
        tenant_id: str | None = None,
        days: int = 7,
    ) -> dict[str, Any]:
        """Get activity summary statistics."""
        async with self._get_session() as session:
            since_date = datetime.now(UTC) - timedelta(days=days)

            conditions = [AuditActivity.timestamp >= since_date]
            if user_id:
                conditions.append(AuditActivity.user_id == user_id)
            if tenant_id:
                conditions.append(AuditActivity.tenant_id == tenant_id)

            filter_clause = and_(*conditions)

            # Get total activities
            count_result = await session.execute(
                select(func.count()).select_from(
                    select(AuditActivity).where(filter_clause).subquery()
                )
            )
            total_activities = count_result.scalar() or 0

            # Get activities by type
            type_query = (
                select(AuditActivity.activity_type, func.count())
                .where(filter_clause)
                .group_by(AuditActivity.activity_type)
            )
            type_result = await session.execute(type_query)
            activities_by_type = {
                activity_type: count or 0 for activity_type, count in type_result.all()
            }

            # Get activities by severity
            severity_query = (
                select(AuditActivity.severity, func.count())
                .where(filter_clause)
                .group_by(AuditActivity.severity)
            )
            severity_result = await session.execute(severity_query)
            activities_by_severity = {
                severity: count or 0 for severity, count in severity_result.all()
            }

            # Top actors by activity volume (non-null user_id)
            user_query = (
                select(AuditActivity.user_id, func.count())
                .where(filter_clause, AuditActivity.user_id.is_not(None))
                .group_by(AuditActivity.user_id)
                .order_by(func.count().desc())
                .limit(10)
            )
            user_result = await session.execute(user_query)
            activities_by_user = [
                {"user_id": user, "count": count or 0} for user, count in user_result if user
            ]

            # Recent critical events for callouts
            critical_query = (
                select(AuditActivity)
                .where(filter_clause, AuditActivity.severity == ActivitySeverity.CRITICAL)
                .order_by(desc(AuditActivity.timestamp))
                .limit(20)
            )
            critical_result = await session.execute(critical_query)
            recent_critical = [
                AuditActivityResponse.model_validate(activity).model_dump()
                for activity in critical_result.scalars().all()
            ]

            # Daily timeline for charts
            timeline_query = (
                select(func.date(AuditActivity.timestamp).label("day"), func.count())
                .where(filter_clause)
                .group_by("day")
                .order_by("day")
            )
            timeline_result = await session.execute(timeline_query)
            timeline = [
                {
                    "date": day.isoformat() if hasattr(day, "isoformat") else str(day),
                    "count": count or 0,
                }
                for day, count in timeline_result
            ]

            return {
                "period_days": days,
                "since_date": since_date.isoformat(),
                "total_activities": total_activities,
                # Legacy keys (used by tests and some callers)
                "activities_by_type": activities_by_type,
                "activities_by_severity": activities_by_severity,
                # Frontend-friendly keys
                "by_type": {str(k): v for k, v in activities_by_type.items()},
                "by_severity": {str(k): v for k, v in activities_by_severity.items()},
                "by_user": activities_by_user,
                "recent_critical": recent_critical,
                "timeline": timeline,
            }

    async def list_activities_in_range(
        self,
        from_date: datetime,
        to_date: datetime,
        tenant_id: str | None = None,
        user_id: str | None = None,
    ) -> list[AuditActivity]:
        """Return activities between from_date and to_date."""
        async with self._get_session() as session:
            query = select(AuditActivity).where(
                and_(AuditActivity.timestamp >= from_date, AuditActivity.timestamp <= to_date)
            )
            if tenant_id:
                query = query.where(AuditActivity.tenant_id == tenant_id)
            if user_id:
                query = query.where(AuditActivity.user_id == user_id)
            query = query.order_by(desc(AuditActivity.timestamp))
            result = await session.execute(query)
            return list(result.scalars().all())


# Helper functions for common audit scenarios


async def log_user_activity(
    user_id: str,
    activity_type: ActivityType,
    action: str,
    description: str,
    *,
    session: AsyncSession | None = None,
    **kwargs: Any,
) -> AuditActivity:
    """Helper to log user-specific activities."""
    service = AuditService(session=session)
    return await service.log_activity(
        activity_type=activity_type,
        action=action,
        description=description,
        user_id=user_id,
        **kwargs,
    )


async def log_api_activity(
    request: Request, action: str, description: str, **kwargs: Any
) -> AuditActivity:
    """Helper to log API request activities."""
    # Extract session from kwargs if provided
    session = kwargs.pop("session", None)
    service = AuditService(session=session)
    # Extract activity_type from kwargs if provided, otherwise use default
    activity_type = kwargs.pop("activity_type", ActivityType.API_REQUEST)
    return await service.log_request_activity(
        request=request,
        activity_type=activity_type,
        action=action,
        description=description,
        **kwargs,
    )


async def log_system_activity(
    activity_type: ActivityType, action: str, description: str, **kwargs: Any
) -> AuditActivity:
    """Helper to log system-level activities."""
    service = AuditService()
    return await service.log_activity(
        activity_type=activity_type,
        action=action,
        description=description,
        severity=ActivitySeverity.MEDIUM,
        **kwargs,
    )
