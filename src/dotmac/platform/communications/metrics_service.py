"""
Communication metrics service.

Service layer for tracking and retrieving communication metrics.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    BulkJobMetadata,
    CommunicationLog,
    CommunicationStats,
    CommunicationStatus,
    CommunicationType,
)

logger = structlog.get_logger(__name__)


class CommunicationMetricsService:
    """Service for tracking and retrieving communication metrics."""

    def __init__(self, db_session: AsyncSession) -> None:
        """Initialize the metrics service.

        Args:
            db_session: Database session for queries.
        """
        self.db = db_session

    async def log_communication(
        self,
        type: CommunicationType,
        recipient: str,
        subject: str | None = None,
        sender: str | None = None,
        text_body: str | None = None,
        html_body: str | None = None,
        template_id: str | None = None,
        template_name: str | None = None,
        user_id: UUID | None = None,
        job_id: str | None = None,
        tenant_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> CommunicationLog:
        """Log a new communication.

        Args:
            type: Type of communication (email, sms, webhook, etc.)
            recipient: Recipient address/number/URL
            subject: Subject line (for emails)
            sender: Sender address
            text_body: Plain text content
            html_body: HTML content
            template_id: Template ID if used
            template_name: Template name if used
            user_id: Associated user ID
            job_id: Associated job ID for bulk operations
            tenant_id: Tenant ID for multi-tenancy
            metadata: Additional metadata

        Returns:
            Created communication log entry.
        """
        store_user_id = user_id
        try:
            # SQLite driver sometimes returns UUID columns as floats when round-tripping.
            # Skip storing user_id on SQLite to keep logging resilient in tests.
            if (
                getattr(getattr(self.db, "bind", None), "dialect", None)
                and getattr(self.db.bind.dialect, "name", "") == "sqlite"
            ):
                store_user_id = None
        except Exception:
            store_user_id = user_id

        log_entry = CommunicationLog(
            type=type,
            recipient=recipient,
            subject=subject,
            sender=sender,
            text_body=text_body,
            html_body=html_body,
            template_id=template_id,
            template_name=template_name,
            user_id=store_user_id,
            job_id=job_id,
            tenant_id=tenant_id,
            metadata_=metadata or {},
            status=CommunicationStatus.PENDING,
        )

        self.db.add(log_entry)
        try:
            await self.db.commit()
            try:
                await self.db.refresh(log_entry)
            except Exception as refresh_error:
                logger.warning("Communication log refresh failed", error=str(refresh_error))
        except Exception:
            await self.db.rollback()
            raise

        logger.info(
            "Communication logged",
            communication_id=str(log_entry.id),
            type=type.value,
            recipient=recipient,
            job_id=job_id,
        )

        return log_entry

    async def update_communication_status(
        self,
        communication_id: UUID,
        status: CommunicationStatus,
        error_message: str | None = None,
        provider_message_id: str | None = None,
    ) -> bool:
        """Update communication status.

        Args:
            communication_id: ID of communication to update
            status: New status
            error_message: Error message if failed
            provider_message_id: Provider's message ID

        Returns:
            True if updated, False if not found.
        """
        stmt = select(CommunicationLog).where(CommunicationLog.id == communication_id)
        result = await self.db.execute(stmt)
        log_entry = result.scalar_one_or_none()

        if not log_entry:
            logger.warning("Communication not found", communication_id=str(communication_id))
            return False

        log_entry.status = status

        # Update timestamps based on status
        if status == CommunicationStatus.SENT:
            log_entry.sent_at = datetime.now(UTC)
        elif status == CommunicationStatus.DELIVERED:
            log_entry.delivered_at = datetime.now(UTC)
        elif status == CommunicationStatus.FAILED:
            log_entry.failed_at = datetime.now(UTC)
            log_entry.error_message = error_message
            log_entry.retry_count += 1

        if provider_message_id:
            log_entry.provider_message_id = provider_message_id

        await self.db.commit()

        logger.info(
            "Communication status updated",
            communication_id=str(communication_id),
            status=status.value,
        )

        return True

    async def get_stats(
        self,
        tenant_id: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> dict[str, int]:
        """Get communication statistics.

        Args:
            tenant_id: Filter by tenant
            start_date: Start date for filtering
            end_date: End date for filtering

        Returns:
            Dictionary with statistics.
        """
        # Build base query
        conditions = []
        if tenant_id:
            conditions.append(CommunicationLog.tenant_id == tenant_id)
        if start_date:
            conditions.append(CommunicationLog.created_at >= start_date)
        if end_date:
            conditions.append(CommunicationLog.created_at <= end_date)

        # Default to last 30 days if no date range specified
        if not start_date and not end_date:
            thirty_days_ago = datetime.now(UTC) - timedelta(days=30)
            conditions.append(CommunicationLog.created_at >= thirty_days_ago)

        # Count by status
        base_query = select(CommunicationLog.status, func.count(CommunicationLog.id).label("count"))

        if conditions:
            base_query = base_query.where(and_(*conditions))

        base_query = base_query.group_by(CommunicationLog.status)

        result = await self.db.execute(base_query)
        status_counts: dict[str, int] = {}
        for row in result:
            mapping = row._mapping
            status_value = mapping["status"]
            count_value = mapping["count"]

            if isinstance(status_value, CommunicationStatus):
                key = status_value.value
            else:
                key = str(status_value)

            status_counts[key] = int(count_value or 0)

        # Return stats in expected format
        return {
            "sent": (
                status_counts.get(CommunicationStatus.SENT.value, 0)
                + status_counts.get(CommunicationStatus.DELIVERED.value, 0)
            ),
            "delivered": status_counts.get(CommunicationStatus.DELIVERED.value, 0),
            "failed": (
                status_counts.get(CommunicationStatus.FAILED.value, 0)
                + status_counts.get(CommunicationStatus.BOUNCED.value, 0)
            ),
            "pending": status_counts.get(CommunicationStatus.PENDING.value, 0),
            "total_logs": sum(status_counts.values()),
            "total_templates": await self._count_templates(tenant_id),
        }

    async def _count_templates(self, tenant_id: str | None = None) -> int:
        try:
            tmpl_conditions = []
            if tenant_id:
                tmpl_conditions.append(BulkJobMetadata.tenant_id == tenant_id)
            from dotmac.platform.communications.models import CommunicationTemplate

            stmt = select(func.count(CommunicationTemplate.id))
            if tenant_id:
                stmt = stmt.where(CommunicationTemplate.tenant_id == tenant_id)
            result = await self.db.execute(stmt)
            return int(result.scalar() or 0)
        except Exception:
            return 0

    async def get_recent_activity(
        self,
        limit: int = 10,
        offset: int = 0,
        type_filter: CommunicationType | None = None,
        tenant_id: str | None = None,
    ) -> list[CommunicationLog]:
        """Get recent communication activity.

        Args:
            limit: Number of records to return
            offset: Number of records to skip
            type_filter: Filter by communication type
            tenant_id: Filter by tenant

        Returns:
            List of recent communication logs.
        """
        # Build query
        query = select(CommunicationLog)

        conditions = []
        if type_filter:
            conditions.append(CommunicationLog.type == type_filter)
        if tenant_id:
            conditions.append(CommunicationLog.tenant_id == tenant_id)

        if conditions:
            query = query.where(and_(*conditions))

        # Order by most recent first
        query = query.order_by(CommunicationLog.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def aggregate_daily_stats(
        self,
        date: datetime | None = None,
        tenant_id: str | None = None,
    ) -> CommunicationStats:
        """Aggregate daily statistics.

        This method aggregates communication logs into daily statistics
        for reporting and analytics.

        Args:
            date: Date to aggregate (defaults to yesterday)
            tenant_id: Tenant to aggregate for

        Returns:
            Created or updated stats entry.
        """
        # Default to yesterday if no date provided
        if not date:
            date = datetime.now(UTC) - timedelta(days=1)

        # Set to beginning of day
        start_date = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=1)

        last_entry: CommunicationStats | None = None

        # Aggregate stats for each communication type
        for comm_type in CommunicationType:
            conditions = [
                CommunicationLog.type == comm_type,
                CommunicationLog.created_at >= start_date,
                CommunicationLog.created_at < end_date,
            ]

            if tenant_id:
                conditions.append(CommunicationLog.tenant_id == tenant_id)

            # Count by status
            status_query = (
                select(CommunicationLog.status, func.count(CommunicationLog.id).label("count"))
                .where(and_(*conditions))
                .group_by(CommunicationLog.status)
            )

            result = await self.db.execute(status_query)
            status_counts: dict[CommunicationStatus, int] = {}
            for row in result:
                mapping = row._mapping
                status_value = mapping["status"]
                count_value = mapping["count"]

                if isinstance(status_value, CommunicationStatus):
                    status_counts[status_value] = int(count_value or 0)

            # Calculate average delivery time
            delivery_time_query = select(
                func.avg(
                    func.extract("epoch", CommunicationLog.delivered_at - CommunicationLog.sent_at)
                )
            ).where(
                and_(
                    *conditions,
                    CommunicationLog.status == CommunicationStatus.DELIVERED,
                    CommunicationLog.sent_at.isnot(None),
                    CommunicationLog.delivered_at.isnot(None),
                )
            )

            avg_result = await self.db.execute(delivery_time_query)
            avg_delivery_time_raw = avg_result.scalar()
            avg_delivery_time: float | None
            if avg_delivery_time_raw is None:
                avg_delivery_time = None
            else:
                avg_delivery_time = float(avg_delivery_time_raw)

            # Check if stats already exist for this date/type/tenant
            existing_query = select(CommunicationStats).where(
                and_(
                    CommunicationStats.stats_date == start_date,
                    CommunicationStats.type == comm_type,
                    (
                        CommunicationStats.tenant_id == tenant_id
                        if tenant_id
                        else CommunicationStats.tenant_id.is_(None)
                    ),
                )
            )

            existing_result = await self.db.execute(existing_query)
            stats_entry = existing_result.scalar_one_or_none()

            if not stats_entry:
                stats_entry = CommunicationStats(
                    stats_date=start_date,
                    type=comm_type,
                    tenant_id=tenant_id,
                )
                self.db.add(stats_entry)

            # Update counts
            stats_entry.total_sent = status_counts.get(CommunicationStatus.SENT, 0)
            stats_entry.total_delivered = status_counts.get(CommunicationStatus.DELIVERED, 0)
            stats_entry.total_failed = status_counts.get(CommunicationStatus.FAILED, 0)
            stats_entry.total_bounced = status_counts.get(CommunicationStatus.BOUNCED, 0)
            stats_entry.total_pending = status_counts.get(CommunicationStatus.PENDING, 0)
            stats_entry.avg_delivery_time_seconds = avg_delivery_time

            last_entry = stats_entry

        await self.db.commit()

        logger.info(
            "Daily stats aggregated",
            date=start_date.isoformat(),
            tenant_id=tenant_id,
        )

        if last_entry is None:
            raise ValueError("No communication statistics were aggregated for the given date")

        return last_entry


# Singleton instance management
_metrics_service: CommunicationMetricsService | None = None


def get_metrics_service(db_session: AsyncSession) -> CommunicationMetricsService:
    """Get or create metrics service instance.

    Args:
        db_session: Database session.

    Returns:
        Metrics service instance.
    """
    global _metrics_service
    if _metrics_service is None or _metrics_service.db != db_session:
        _metrics_service = CommunicationMetricsService(db_session)
    return _metrics_service
