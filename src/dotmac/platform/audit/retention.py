"""
Audit log retention and archiving service.

Manages automatic cleanup and archiving of audit logs based on retention policies.
"""

import asyncio
import gzip
import json
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import structlog
from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_async_db
from .models import ActivitySeverity, AuditActivity


@dataclass
class AuditCleanupResult:
    """Structured cleanup result with helpful accessors."""

    total_deleted: int = 0
    total_archived: int = 0
    by_severity: dict[str, int] = field(default_factory=lambda: {})
    errors: list[str] = field(default_factory=lambda: [])

    def as_dict(self) -> dict[str, Any]:
        return {
            "total_deleted": self.total_deleted,
            "total_archived": self.total_archived,
            "by_severity": dict(self.by_severity),
            "errors": list(self.errors),
        }


@dataclass
class AuditRestoreResult:
    """Structured archive restoration result."""

    total_restored: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=lambda: [])

    def as_dict(self) -> dict[str, Any]:
        return {
            "total_restored": self.total_restored,
            "skipped": self.skipped,
            "errors": list(self.errors),
        }


@dataclass
class AuditDeletionInfo:
    """Summary describing pending deletions by severity."""

    count: int
    older_than: str

    def as_dict(self) -> dict[str, Any]:
        return {"count": self.count, "older_than": self.older_than}


@dataclass
class AuditRetentionStats:
    """Comprehensive statistics about current audit retention state."""

    total_records: int = 0
    by_severity: dict[str, int] = field(default_factory=lambda: {})
    oldest_record: str | None = None
    newest_record: str | None = None
    records_to_delete: dict[str, AuditDeletionInfo] = field(default_factory=lambda: {})

    def as_dict(self) -> dict[str, Any]:
        return {
            "total_records": self.total_records,
            "by_severity": dict(self.by_severity),
            "oldest_record": self.oldest_record,
            "newest_record": self.newest_record,
            "records_to_delete": {
                severity: info.as_dict() for severity, info in self.records_to_delete.items()
            },
        }


logger = structlog.get_logger(__name__)


class AuditRetentionPolicy:
    """Configuration for audit log retention.

    Loads configuration from settings by default, but allows override for testing.
    """

    def __init__(
        self,
        retention_days: int | None = None,
        archive_enabled: bool | None = None,
        archive_location: str | None = None,
        batch_size: int = 1000,
        severity_retention: Mapping[str, int] | None = None,
    ):
        """
        Initialize retention policy.

        If parameters are None, loads from settings.audit configuration.

        Args:
            retention_days: Default days to retain audit logs (None = load from settings)
            archive_enabled: Whether to archive before deletion (None = load from settings)
            archive_location: Where to store archived logs (None = load from settings)
            batch_size: Number of records to process at once
            severity_retention: Custom retention by severity level
        """
        # Load from settings if not explicitly provided
        from dotmac.platform.settings import settings

        self.retention_days = (
            retention_days if retention_days is not None else settings.audit.audit_retention_days
        )
        self.archive_enabled = (
            archive_enabled if archive_enabled is not None else settings.audit.audit_archive_enabled
        )
        archive_loc = (
            archive_location
            if archive_location is not None
            else settings.audit.audit_archive_location
        )
        self.archive_location = Path(archive_loc)
        self.batch_size = batch_size

        # Custom retention by severity (e.g., keep CRITICAL longer)
        default_retention: dict[str, int] = {
            ActivitySeverity.LOW.value: 30,
            ActivitySeverity.MEDIUM.value: 60,
            ActivitySeverity.HIGH.value: 90,
            ActivitySeverity.CRITICAL.value: 365,
        }
        self.severity_retention = dict(severity_retention or default_retention)


class AuditRetentionService:
    """Service for managing audit log retention and archiving."""

    def __init__(self, policy: AuditRetentionPolicy | None = None) -> None:
        """Initialize retention service with policy."""
        self.policy = policy or AuditRetentionPolicy()

        # Ensure archive directory exists
        if self.policy.archive_enabled:
            self.policy.archive_location.mkdir(parents=True, exist_ok=True)

    async def cleanup_old_logs(
        self,
        dry_run: bool = False,
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Clean up old audit logs based on retention policy.

        Args:
            dry_run: If True, don't actually delete, just report what would be deleted
            tenant_id: Optionally limit to specific tenant

        Returns:
            Summary of cleanup operation
        """
        async with get_async_db() as session:
            results = AuditCleanupResult()

            # Process each severity level with its retention period
            for severity, retention_days in self.policy.severity_retention.items():
                cutoff_date = datetime.now(UTC) - timedelta(days=retention_days)
                severity_key = str(severity)

                try:
                    # Build query for old records
                    query = select(AuditActivity).where(
                        and_(
                            AuditActivity.severity == severity,
                            AuditActivity.timestamp < cutoff_date,
                        )
                    )

                    if tenant_id:
                        query = query.where(AuditActivity.tenant_id == tenant_id)

                    # Count records to be processed
                    count_query = select(func.count()).select_from(query.subquery())
                    count_result = await session.execute(count_query)
                    total_count = int(count_result.scalar_one())

                    if total_count == 0:
                        continue

                    logger.info(
                        "Processing audit logs for cleanup",
                        severity=severity,
                        retention_days=retention_days,
                        records_found=total_count,
                        dry_run=dry_run,
                    )

                    if not dry_run:
                        # Archive if enabled
                        if self.policy.archive_enabled:
                            archived_count = await self._archive_logs(
                                session, query, severity_key, cutoff_date
                            )
                            results.total_archived += archived_count

                        # Delete old records
                        delete_query = delete(AuditActivity).where(
                            and_(
                                AuditActivity.severity == severity,
                                AuditActivity.timestamp < cutoff_date,
                            )
                        )
                        if tenant_id:
                            delete_query = delete_query.where(AuditActivity.tenant_id == tenant_id)

                        result = await session.execute(delete_query)
                        # Result.rowcount is available after execute() for DML statements
                        deleted_count = int(getattr(result, "rowcount", 0) or 0)
                        await session.commit()

                        results.total_deleted += deleted_count
                        results.by_severity[severity_key] = deleted_count

                        logger.info(
                            "Cleaned up audit logs",
                            severity=severity,
                            deleted_count=deleted_count,
                            archived=self.policy.archive_enabled,
                        )
                    else:
                        results.by_severity[severity_key] = total_count
                        results.total_deleted += total_count

                except Exception as e:
                    error_msg = f"Error processing {severity} logs: {str(e)}"
                    logger.error(error_msg, exc_info=True)
                    results.errors.append(error_msg)

            return results.as_dict()

    async def _archive_logs(
        self,
        session: AsyncSession,
        query: Any,
        severity: str,
        cutoff_date: datetime,
    ) -> int:
        """
        Archive audit logs before deletion.

        SECURITY WARNING FOR PRODUCTION:
        This current implementation writes plaintext archives to local filesystem,
        which does NOT meet security requirements for production audit logs:

        MISSING SECURITY CONTROLS:
        1. Encryption: No encryption at rest (should use SSE-KMS or equivalent)
        2. Integrity: No cryptographic signatures/hashes to prevent tampering
        3. Immutability: No WORM (Write Once Read Many) policies
        4. Access Control: Only filesystem permissions (insufficient for compliance)
        5. Audit Trail: No access logging for archived data

        PRODUCTION DEPLOYMENT REQUIREMENTS:
        - Move to object storage (S3, GCS, Azure Blob) with server-side encryption
        - Enable versioning and object lock (WORM) on the bucket
        - Use KMS for encryption key management
        - Implement integrity hashing (SHA-256) for each archive
        - Restrict access via IAM/service accounts with least privilege
        - Enable access logging on the archive bucket
        - Consider using AWS S3 Glacier/GCS Archive for long-term retention

        See docs/AUDIT_ARCHIVING.md for implementation guide.

        Args:
            session: Database session
            query: Query for records to archive
            severity: Severity level being archived
            cutoff_date: Date before which records are archived

        Returns:
            Number of records archived
        """
        from dotmac.platform.settings import settings

        # SECURITY: Warn if using local storage in production
        if settings.DEPLOYMENT_MODE in ("multi_tenant", "hybrid"):
            logger.warning(
                "audit_archive_insecure_storage",
                message="Audit logs are being archived to local filesystem without encryption. "
                "This is NOT suitable for production. Configure object storage with encryption.",
                deployment_mode=settings.DEPLOYMENT_MODE,
                archive_location=str(self.policy.archive_location),
            )

        archived_count = 0

        # Create archive file name
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        archive_file = self.policy.archive_location / f"audit_{severity}_{timestamp}.jsonl.gz"

        try:
            import hashlib

            # Process in batches
            offset = 0
            ordered_query = query.order_by(AuditActivity.timestamp.asc(), AuditActivity.id.asc())

            # SECURITY: Calculate SHA-256 hash for integrity verification
            hash_obj = hashlib.sha256()

            with gzip.open(archive_file, "wt", encoding="utf-8") as f:
                while True:
                    batch_query = ordered_query.offset(offset).limit(self.policy.batch_size)
                    result = await session.execute(batch_query)
                    records = result.scalars().all()

                    if not records:
                        break

                    for record in records:
                        # Convert to dict for archiving
                        record_dict = {
                            "id": str(record.id),
                            "activity_type": record.activity_type,
                            "severity": record.severity,
                            "user_id": record.user_id,
                            "tenant_id": record.tenant_id,
                            "timestamp": record.timestamp.isoformat(),
                            "resource_type": record.resource_type,
                            "resource_id": record.resource_id,
                            "action": record.action,
                            "description": record.description,
                            "details": record.details,
                            "ip_address": record.ip_address,
                            "user_agent": record.user_agent,
                            "request_id": record.request_id,
                        }

                        # Write as JSON lines
                        json_line = json.dumps(record_dict) + "\n"
                        f.write(json_line)

                        # Update hash for integrity verification
                        hash_obj.update(json_line.encode("utf-8"))
                        archived_count += 1

                    offset += self.policy.batch_size

            # SECURITY: Write integrity hash to companion file
            hash_value = hash_obj.hexdigest()
            hash_file = archive_file.with_suffix(".sha256")
            hash_file.write_text(f"{hash_value}  {archive_file.name}\n")

            logger.info(
                "Archived audit logs with integrity hash",
                severity=severity,
                archive_file=str(archive_file),
                hash_file=str(hash_file),
                sha256=hash_value,
                archived_count=archived_count,
            )

        except Exception as e:
            logger.error(
                "Failed to archive audit logs",
                severity=severity,
                error=str(e),
                exc_info=True,
            )
            # Remove partial archive file
            if archive_file.exists():
                archive_file.unlink()
            raise

        return archived_count

    async def restore_from_archive(
        self,
        archive_file: str,
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Restore audit logs from archive file.

        Args:
            archive_file: Path to archive file
            tenant_id: Optionally filter to specific tenant

        Returns:
            Summary of restoration
        """
        file_path = Path(archive_file)
        if not file_path.exists():
            raise FileNotFoundError(f"Archive file not found: {archive_file}")

        results = AuditRestoreResult()

        async with get_async_db() as session:
            try:
                with gzip.open(file_path, "rt", encoding="utf-8") as f:
                    batch = []

                    for line in f:
                        try:
                            record_dict = json.loads(line)

                            # Filter by tenant if specified
                            if tenant_id and record_dict.get("tenant_id") != tenant_id:
                                results.skipped += 1
                                continue

                            # Convert back to model
                            from uuid import UUID

                            activity = AuditActivity(
                                id=(
                                    UUID(record_dict["id"])
                                    if isinstance(record_dict["id"], str)
                                    else record_dict["id"]
                                ),
                                activity_type=record_dict["activity_type"],
                                severity=record_dict["severity"],
                                user_id=record_dict["user_id"],
                                tenant_id=record_dict["tenant_id"],
                                timestamp=datetime.fromisoformat(record_dict["timestamp"]),
                                resource_type=record_dict["resource_type"],
                                resource_id=record_dict["resource_id"],
                                action=record_dict["action"],
                                description=record_dict["description"],
                                details=record_dict["details"],
                                ip_address=record_dict["ip_address"],
                                user_agent=record_dict["user_agent"],
                                request_id=record_dict["request_id"],
                            )

                            batch.append(activity)

                            # Insert in batches
                            if len(batch) >= self.policy.batch_size:
                                session.add_all(batch)
                                await session.commit()
                                results.total_restored += len(batch)
                                batch = []

                        except Exception as e:
                            error_msg = f"Error restoring record: {str(e)}"
                            logger.error(error_msg, record=line[:100])
                            results.errors.append(error_msg)

                    # Insert remaining batch
                    if batch:
                        session.add_all(batch)
                        await session.commit()
                        results.total_restored += len(batch)

                logger.info(
                    "Restored audit logs from archive",
                    archive_file=archive_file,
                    total_restored=results.total_restored,
                    skipped=results.skipped,
                )

            except Exception as e:
                error_msg = f"Failed to restore from archive: {str(e)}"
                logger.error(error_msg, exc_info=True)
                results.errors.append(error_msg)

        return results.as_dict()

    async def get_retention_statistics(
        self,
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Get statistics about audit logs and retention.

        Args:
            tenant_id: Optionally filter to specific tenant

        Returns:
            Statistics about current audit logs
        """
        async with get_async_db() as session:
            stats = AuditRetentionStats()

            # Get total count
            count_query = select(func.count()).select_from(AuditActivity)
            if tenant_id:
                count_query = count_query.where(AuditActivity.tenant_id == tenant_id)

            count_result = await session.execute(count_query)
            stats.total_records = int(count_result.scalar_one())

            # Get count by severity
            severity_query = select(AuditActivity.severity, func.count()).group_by(
                AuditActivity.severity
            )
            if tenant_id:
                severity_query = severity_query.where(AuditActivity.tenant_id == tenant_id)

            severity_result = await session.execute(severity_query)
            stats.by_severity = {str(row[0]): int(row[1]) for row in severity_result.all()}

            # Get date range
            date_query = select(
                func.min(AuditActivity.timestamp),
                func.max(AuditActivity.timestamp),
            )
            if tenant_id:
                date_query = date_query.where(AuditActivity.tenant_id == tenant_id)

            date_result = await session.execute(date_query)
            oldest, newest = date_result.one()

            if oldest:
                stats.oldest_record = oldest.isoformat()
            if newest:
                stats.newest_record = newest.isoformat()

            # Calculate records to be deleted
            for severity, retention_days in self.policy.severity_retention.items():
                cutoff_date = datetime.now(UTC) - timedelta(days=retention_days)

                delete_count_query = (
                    select(func.count())
                    .select_from(AuditActivity)
                    .where(
                        and_(
                            AuditActivity.severity == severity,
                            AuditActivity.timestamp < cutoff_date,
                        )
                    )
                )
                if tenant_id:
                    delete_count_query = delete_count_query.where(
                        AuditActivity.tenant_id == tenant_id
                    )

                delete_count_result = await session.execute(delete_count_query)
                count_to_delete = int(delete_count_result.scalar_one())

                if count_to_delete > 0:
                    stats.records_to_delete[str(severity)] = AuditDeletionInfo(
                        count=count_to_delete,
                        older_than=cutoff_date.isoformat(),
                    )

            return stats.as_dict()


# Scheduled task for automatic cleanup
async def cleanup_audit_logs_task() -> Any:
    """
    Scheduled task to run audit log cleanup.

    This should be scheduled to run daily via cron or task scheduler.
    """
    try:
        # Load policy from current settings.audit configuration
        policy = AuditRetentionPolicy()

        service = AuditRetentionService(policy)

        # Get statistics before cleanup
        stats_before = await service.get_retention_statistics()
        logger.info("Audit retention statistics before cleanup", stats=stats_before)

        # Perform cleanup
        results = await service.cleanup_old_logs()
        logger.info("Audit log cleanup completed", results=results)

        # Get statistics after cleanup
        stats_after = await service.get_retention_statistics()
        logger.info("Audit retention statistics after cleanup", stats=stats_after)

        return results

    except Exception as e:
        logger.error("Failed to run audit log cleanup", error=str(e), exc_info=True)
        raise


if __name__ == "__main__":
    # Manual run of cleanup task
    asyncio.run(cleanup_audit_logs_task())
