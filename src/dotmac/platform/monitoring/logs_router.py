"""
Logs API router.

Provides REST endpoints for application log retrieval and filtering.
"""

from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any, cast

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import ActivitySeverity, AuditActivity
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import CurrentUser, get_current_user
from dotmac.platform.db import get_session_dependency

logger = structlog.get_logger(__name__)


# ============================================================
# Models
# ============================================================


class LogLevel(str, Enum):
    """Log level enumeration."""

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class LogMetadata(BaseModel):  # BaseModel resolves to Any in isolation
    """Log entry metadata."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="allow",
    )

    request_id: str | None = Field(default=None, description="Request correlation ID")
    user_id: str | None = Field(default=None, description="User ID")
    tenant_id: str | None = Field(default=None, description="Tenant ID")
    duration: int | None = Field(default=None, description="Duration in milliseconds")
    ip: str | None = Field(default=None, description="Client IP address")


class LogEntry(BaseModel):  # BaseModel resolves to Any in isolation
    """Individual log entry."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    id: str = Field(description="Log entry ID")
    timestamp: datetime = Field(description="Log timestamp")
    level: LogLevel = Field(description="Log level")
    service: str = Field(description="Service name")
    message: str = Field(description="Log message")
    metadata: LogMetadata = Field(
        default_factory=lambda: LogMetadata(), description="Additional metadata"
    )


class LogsResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for log queries."""

    model_config = ConfigDict(validate_assignment=True)

    logs: list[LogEntry] = Field(default_factory=list, description="Log entries")
    total: int = Field(description="Total number of matching logs")
    page: int = Field(description="Current page number")
    page_size: int = Field(description="Number of logs per page")
    has_more: bool = Field(description="Whether more logs are available")


class LogStats(BaseModel):  # BaseModel resolves to Any in isolation
    """Log statistics."""

    model_config = ConfigDict()

    total: int = Field(description="Total log count")
    by_level: dict[str, int] = Field(default_factory=dict, description="Count by log level")
    by_service: dict[str, int] = Field(default_factory=dict, description="Count by service")
    time_range: dict[str, str] = Field(default_factory=dict, description="Time range of logs")


# ============================================================
# Router
# ============================================================

logs_router = APIRouter(prefix="/monitoring", tags=["Logs"])


# ============================================================
# Service Layer (Placeholder for now - will integrate with OpenTelemetry)
# ============================================================


class LogsService:
    """Service for fetching and filtering logs from audit activities."""

    def __init__(
        self,
        session: AsyncSession | Any | None = None,
        *,
        sample_logs: list[LogEntry] | None = None,
    ) -> None:
        self.logger = structlog.get_logger(__name__)
        self.session = session if session is not None else None
        # Provide deterministic sample data for environments without a database session.
        source_logs = sample_logs or _default_sample_logs()
        self._sample_logs = [log.model_copy(deep=True) for log in source_logs]

    def _use_database(self) -> bool:
        """Return True when we have a real session capable of executing queries."""
        return self.session is not None and hasattr(self.session, "execute")

    async def get_logs(
        self,
        current_user: UserInfo | None = None,
        level: LogLevel | None = None,
        service: str | None = None,
        search: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> LogsResponse:
        """Fetch logs from audit activities with filtering.

        Args:
            level: Filter by log level (maps to severity)
            service: Filter by service name (extracted from activity_type)
            search: Search in log messages
            start_time: Start of time range
            end_time: End of time range
            page: Page number (1-indexed)
            page_size: Number of logs per page

        Returns:
            LogsResponse with filtered logs from database
        """
        if self._use_database():
            if current_user is None:
                raise ValueError("current_user is required when querying logs from the database")
            return await self._get_logs_from_database(
                current_user=current_user,
                level=level,
                service=service,
                search=search,
                start_time=start_time,
                end_time=end_time,
                page=page,
                page_size=page_size,
            )

        return self._get_logs_from_sample(
            level=level,
            service=service,
            search=search,
            start_time=start_time,
            end_time=end_time,
            page=page,
            page_size=page_size,
        )

    async def get_log_stats(
        self,
        current_user: UserInfo | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> LogStats:
        """Get log statistics from audit activities."""
        if self._use_database():
            if current_user is None:
                raise ValueError(
                    "current_user is required when retrieving log statistics from the database"
                )
            return await self._get_log_stats_from_database(
                current_user=current_user,
                start_time=start_time,
                end_time=end_time,
            )

        return self._get_log_stats_from_sample(
            start_time=start_time,
            end_time=end_time,
        )

    async def get_available_services(self, current_user: UserInfo | None = None) -> list[str]:
        """Return list of available service names."""
        if self._use_database():
            if current_user is None:
                raise ValueError(
                    "current_user is required when retrieving log services from the database"
                )
            return await self._get_available_services_from_database(current_user=current_user)

        services = {log.service for log in self._sample_logs}
        return sorted(services)

    async def _get_logs_from_database(
        self,
        *,
        current_user: UserInfo,
        level: LogLevel | None,
        service: str | None,
        search: str | None,
        start_time: datetime | None,
        end_time: datetime | None,
        page: int,
        page_size: int,
    ) -> LogsResponse:
        session = cast(AsyncSession, self.session)
        try:
            # Build query
            query = select(AuditActivity)

            # SECURITY: Apply tenant isolation - only show logs for current user's tenant
            # unless user is a platform admin
            if not current_user.is_platform_admin:
                if not current_user.tenant_id:
                    # Non-admin users must have a tenant_id
                    self.logger.warning(
                        "User without tenant_id attempted to access logs",
                        user_id=current_user.user_id,
                    )
                    return LogsResponse(
                        logs=[],
                        total=0,
                        page=page,
                        page_size=page_size,
                        has_more=False,
                    )
                query = query.where(AuditActivity.tenant_id == current_user.tenant_id)

            # Apply filters
            if level:
                # Map log level to severity
                severity_map = {
                    LogLevel.DEBUG: ActivitySeverity.LOW,
                    LogLevel.INFO: ActivitySeverity.LOW,
                    LogLevel.WARNING: ActivitySeverity.MEDIUM,
                    LogLevel.ERROR: ActivitySeverity.HIGH,
                    LogLevel.CRITICAL: ActivitySeverity.CRITICAL,
                }
                severity = severity_map.get(level)
                if severity:
                    query = query.where(AuditActivity.severity == severity.value)

            if service:
                query = query.where(AuditActivity.activity_type.ilike(f"{service}.%"))

            if search:
                query = query.where(AuditActivity.description.ilike(f"%{search}%"))

            if start_time:
                query = query.where(AuditActivity.created_at >= start_time)

            if end_time:
                query = query.where(AuditActivity.created_at <= end_time)

            # Get total count with same tenant isolation
            count_query = select(func.count()).select_from(AuditActivity)

            # Apply tenant isolation to count query
            if not current_user.is_platform_admin and current_user.tenant_id:
                count_query = count_query.where(AuditActivity.tenant_id == current_user.tenant_id)

            if level or service or search or start_time or end_time:
                # Apply same filters for count
                count_query = select(func.count()).select_from(query.subquery())

            result = await session.execute(count_query)
            total = result.scalar() or 0

            # Apply pagination and ordering
            query = query.order_by(AuditActivity.created_at.desc())
            query = query.offset((page - 1) * page_size).limit(page_size)

            # Execute query
            result = await session.execute(query)
            activities_result = list(result.scalars().all())

            # Convert to LogEntry format
            logs: list[LogEntry] = []
            for activity_obj in activities_result:
                activity = cast(AuditActivity, activity_obj)
                # Handle None values before validation
                if not activity:
                    continue

                # Map severity to log level
                level_map = {
                    ActivitySeverity.LOW.value: LogLevel.INFO,
                    ActivitySeverity.MEDIUM.value: LogLevel.WARNING,
                    ActivitySeverity.HIGH.value: LogLevel.ERROR,
                    ActivitySeverity.CRITICAL.value: LogLevel.CRITICAL,
                }
                log_level = level_map.get(activity.severity, LogLevel.INFO)

                # Extract service from activity_type (e.g., "user.login" -> "user")
                service_name = (
                    activity.activity_type.split(".")[0]
                    if activity.activity_type and "." in activity.activity_type
                    else "platform"
                )

                log_entry = LogEntry(
                    id=str(activity.id),
                    timestamp=activity.created_at,
                    level=log_level,
                    service=service_name,
                    message=activity.description or activity.activity_type or "",
                    metadata=LogMetadata(
                        user_id=activity.user_id,
                        tenant_id=str(activity.tenant_id) if activity.tenant_id else None,
                        ip=activity.ip_address,  # Use the ip_address field directly
                    ),
                )
                logs.append(log_entry)

            return LogsResponse(
                logs=logs,
                total=total,
                page=page,
                page_size=page_size,
                has_more=(page * page_size) < total,
            )
        except Exception as e:
            self.logger.error("Failed to fetch logs", error=str(e), page=page, page_size=page_size)
            # Return empty response on error
            return LogsResponse(
                logs=[],
                total=0,
                page=page,
                page_size=page_size,
                has_more=False,
            )

    def _get_logs_from_sample(
        self,
        *,
        level: LogLevel | None,
        service: str | None,
        search: str | None,
        start_time: datetime | None,
        end_time: datetime | None,
        page: int,
        page_size: int,
    ) -> LogsResponse:
        logs = self._filter_sample_logs(
            level=level,
            service=service,
            search=search,
            start_time=start_time,
            end_time=end_time,
        )

        total = len(logs)
        start_index = max((page - 1) * page_size, 0)
        end_index = start_index + page_size
        paginated = logs[start_index:end_index]

        return LogsResponse(
            logs=[log.model_copy(deep=True) for log in paginated],
            total=total,
            page=page,
            page_size=page_size,
            has_more=end_index < total,
        )

    async def _get_log_stats_from_database(
        self,
        *,
        current_user: UserInfo,
        start_time: datetime | None,
        end_time: datetime | None,
    ) -> LogStats:
        session = cast(AsyncSession, self.session)
        try:
            filters = []

            if not current_user.is_platform_admin:
                if not current_user.tenant_id:
                    self.logger.warning(
                        "User without tenant_id attempted to access log stats",
                        user_id=current_user.user_id,
                    )
                    now = datetime.now(UTC)
                    return LogStats(
                        total=0,
                        by_level={},
                        by_service={},
                        time_range={
                            "start": (start_time or now).isoformat(),
                            "end": (end_time or now).isoformat(),
                        },
                    )
                filters.append(AuditActivity.tenant_id == current_user.tenant_id)

            if start_time:
                filters.append(AuditActivity.created_at >= start_time)
            if end_time:
                filters.append(AuditActivity.created_at <= end_time)

            stmt = select(
                AuditActivity.severity,
                AuditActivity.activity_type,
                AuditActivity.created_at,
            )
            for cond in filters:
                stmt = stmt.where(cond)

            result = await session.execute(stmt)
            rows = result.all()

            total = len(rows)
            by_level: dict[str, int] = {
                "DEBUG": 0,
                "INFO": 0,
                "WARNING": 0,
                "ERROR": 0,
                "CRITICAL": 0,
            }
            by_service: dict[str, int] = {}

            for severity, activity_type, _created_at in rows:
                level = {
                    ActivitySeverity.LOW.value: "INFO",
                    ActivitySeverity.MEDIUM.value: "WARNING",
                    ActivitySeverity.HIGH.value: "ERROR",
                    ActivitySeverity.CRITICAL.value: "CRITICAL",
                }.get(severity, "DEBUG")
                by_level[level] = by_level.get(level, 0) + 1

                service_name = (
                    activity_type.split(".")[0]
                    if activity_type and "." in activity_type
                    else (activity_type or "platform")
                )
                by_service[service_name] = by_service.get(service_name, 0) + 1

            if rows:
                timestamps = [row[2] for row in rows if row[2] is not None]
                start_bound = min(timestamps) if timestamps else datetime.now(UTC)
                end_bound = max(timestamps) if timestamps else datetime.now(UTC)
            else:
                now = datetime.now(UTC)
                start_bound = start_time or now
                end_bound = end_time or now

            # Trim zero entries for cleaner response
            by_level = {key: value for key, value in by_level.items() if value > 0}

            return LogStats(
                total=total,
                by_level=by_level,
                by_service=by_service,
                time_range={
                    "start": start_bound.isoformat(),
                    "end": end_bound.isoformat(),
                },
            )
        except Exception as e:
            self.logger.exception("Failed to fetch log stats", error=str(e))
            # Return empty stats on error
            now = datetime.now(UTC)
            return LogStats(
                total=0,
                by_level={},
                by_service={},
                time_range={
                    "start": (start_time or now).isoformat(),
                    "end": (end_time or now).isoformat(),
                },
            )

    def _get_log_stats_from_sample(
        self,
        *,
        start_time: datetime | None,
        end_time: datetime | None,
    ) -> LogStats:
        logs = self._filter_sample_logs(
            start_time=start_time,
            end_time=end_time,
        )

        total = len(logs)
        by_level: dict[str, int] = {}
        by_service: dict[str, int] = {}

        for log in logs:
            by_level[log.level.value] = by_level.get(log.level.value, 0) + 1
            by_service[log.service] = by_service.get(log.service, 0) + 1

        if logs:
            start = min(log.timestamp for log in logs)
            end = max(log.timestamp for log in logs)
        else:
            now = datetime.now(UTC)
            start = start_time or now
            end = end_time or now

        return LogStats(
            total=total,
            by_level=by_level,
            by_service=by_service,
            time_range={
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
        )

    async def _get_available_services_from_database(self, current_user: UserInfo) -> list[str]:
        session = cast(AsyncSession, self.session)
        try:
            # SECURITY: Apply tenant isolation - only show services for current user's tenant
            # unless user is a platform admin
            query = select(AuditActivity.activity_type).distinct()

            if not current_user.is_platform_admin:
                if not current_user.tenant_id:
                    # Non-admin users must have a tenant_id
                    self.logger.warning(
                        "User without tenant_id attempted to access available services",
                        user_id=current_user.user_id,
                    )
                    return []
                query = query.where(AuditActivity.tenant_id == current_user.tenant_id)

            result = await session.execute(query)
            activity_types = result.scalars().all()

            services = set()
            for activity_type in activity_types:
                if not activity_type:
                    continue
                service = activity_type.split(".")[0] if "." in activity_type else "platform"
                services.add(service)

            return sorted(services)
        except Exception as e:
            self.logger.error("Failed to fetch available services", error=str(e))
            return []

    def _filter_sample_logs(
        self,
        *,
        level: LogLevel | None = None,
        service: str | None = None,
        search: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> list[LogEntry]:
        logs = [log.model_copy(deep=True) for log in self._sample_logs]

        if level:
            logs = [log for log in logs if log.level == level]

        if service:
            service_name = service.casefold()
            logs = [log for log in logs if log.service.casefold() == service_name]

        if search:
            term = search.casefold()
            filtered: list[LogEntry] = []
            for log in logs:
                if term in log.message.casefold():
                    filtered.append(log)
                    continue

                metadata_values = [
                    log.service,
                    log.metadata.user_id or "",
                    log.metadata.tenant_id or "",
                    log.metadata.ip or "",
                ]
                if any(term in value.casefold() for value in metadata_values if value):
                    filtered.append(log)
            logs = filtered

        if start_time:
            logs = [log for log in logs if log.timestamp >= start_time]

        if end_time:
            logs = [log for log in logs if log.timestamp <= end_time]

        # Sort by timestamp descending to mimic database ordering
        logs.sort(key=lambda entry: entry.timestamp, reverse=True)
        return logs


_DEFAULT_LOG_SERVICE_SINGLETON: LogsService | None = None


def get_logs_service(session: AsyncSession | Any = Depends(get_session_dependency)) -> LogsService:
    """Get logs service instance with database session."""
    global _DEFAULT_LOG_SERVICE_SINGLETON

    if isinstance(session, AsyncSession) or hasattr(session, "execute"):
        return LogsService(session=session)

    if _DEFAULT_LOG_SERVICE_SINGLETON is None:
        _DEFAULT_LOG_SERVICE_SINGLETON = LogsService()
    return _DEFAULT_LOG_SERVICE_SINGLETON


# ============================================================
# Endpoints
# ============================================================


@logs_router.get("/logs", response_model=LogsResponse)
async def get_logs(
    level: LogLevel | None = Query(None, description="Filter by log level"),
    service: str | None = Query(None, description="Filter by service name"),
    search: str | None = Query(None, description="Search in log messages"),
    start_time: datetime | None = Query(None, description="Start of time range"),
    end_time: datetime | None = Query(None, description="End of time range"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(100, ge=1, le=1000, description="Logs per page"),
    current_user: CurrentUser = Depends(get_current_user),
    logs_service: LogsService = Depends(get_logs_service),
) -> LogsResponse:
    """
    Retrieve application logs with filtering and pagination.

    **Filters:**
    - level: Filter by log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    - service: Filter by service name
    - search: Search term in log messages
    - start_time: ISO 8601 datetime for start of range
    - end_time: ISO 8601 datetime for end of range

    **Pagination:**
    - page: Page number (starts at 1)
    - page_size: Number of logs per page (max 1000)

    **Note:** Returns audit activities from the database.
    """
    logger.info(
        "logs.query",
        user_id=current_user.user_id,
        level=level.value if level else None,
        service=service,
        search=search,
        page=page,
        page_size=page_size,
    )

    return await logs_service.get_logs(
        current_user=current_user,
        level=level,
        service=service,
        search=search,
        start_time=start_time,
        end_time=end_time,
        page=page,
        page_size=page_size,
    )


@logs_router.get("/logs/stats", response_model=LogStats)
async def get_log_statistics(
    start_time: datetime | None = Query(None, description="Start of time range"),
    end_time: datetime | None = Query(None, description="End of time range"),
    current_user: CurrentUser = Depends(get_current_user),
    logs_service: LogsService = Depends(get_logs_service),
) -> LogStats:
    """
    Get log statistics and aggregations.

    Returns counts by log level, service, and time range information.
    """
    logger.info(
        "logs.stats.query",
        user_id=current_user.user_id,
        start_time=start_time,
        end_time=end_time,
    )

    return await logs_service.get_log_stats(
        current_user=current_user,
        start_time=start_time,
        end_time=end_time,
    )


@logs_router.get("/logs/services", response_model=list[str])
async def get_available_services(
    current_user: CurrentUser = Depends(get_current_user),
    logs_service: LogsService = Depends(get_logs_service),
) -> list[str]:
    """Get list of available services from audit activities."""
    logger.info("logs.services.list", user_id=current_user.user_id)

    services = await logs_service.get_available_services(current_user=current_user)
    return services


def _default_sample_logs() -> list[LogEntry]:
    """Provide deterministic sample logs for tests and fallback scenarios."""
    now = datetime.now(UTC)
    return [
        LogEntry(
            id="sample-1",
            timestamp=now - timedelta(minutes=5),
            level=LogLevel.INFO,
            service="api-gateway",
            message="User login successful",
            metadata=LogMetadata(user_id="user-123", tenant_id="tenant-001", ip="10.0.0.1"),
        ),
        LogEntry(
            id="sample-2",
            timestamp=now - timedelta(minutes=15),
            level=LogLevel.ERROR,
            service="billing-service",
            message="Database timeout when processing invoice",
            metadata=LogMetadata(user_id="user-456", tenant_id="tenant-002", ip="10.0.0.2"),
        ),
        LogEntry(
            id="sample-3",
            timestamp=now - timedelta(hours=1),
            level=LogLevel.WARNING,
            service="analytics",
            message="Delayed event ingestion detected",
            metadata=LogMetadata(user_id="user-789", tenant_id="tenant-001", ip="10.0.0.3"),
        ),
        LogEntry(
            id="sample-4",
            timestamp=now - timedelta(hours=2),
            level=LogLevel.CRITICAL,
            service="api-gateway",
            message="Circuit breaker opened for upstream service",
            metadata=LogMetadata(user_id="user-321", tenant_id="tenant-003", ip="10.0.0.4"),
        ),
    ]
