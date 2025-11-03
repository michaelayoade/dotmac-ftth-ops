"""
Alarm Archival Service

Handles archiving of old cleared alarms to MinIO (S3-compatible) cold storage
before deletion for compliance, historical analysis, and data retention.
"""

import gzip
import json
from datetime import UTC, datetime
from io import BytesIO
from typing import Any
from uuid import UUID

import structlog
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..file_storage.minio_storage import MinIOStorage
from ..settings import settings
from .models import Alarm, AlarmSeverity, AlarmSource, AlarmStatus, CorrelationAction

logger = structlog.get_logger(__name__)


# =============================================================================
# Archival Schemas
# =============================================================================


class ArchivedAlarmData(BaseModel):  # BaseModel resolves to Any in isolation
    """Serializable alarm data for archival."""

    model_config = ConfigDict()

    # Primary identifiers
    id: UUID
    tenant_id: str
    alarm_id: str

    # Alarm classification
    severity: str
    status: str
    source: str

    # Alarm details
    alarm_type: str
    title: str
    description: str | None = None
    message: str | None = None

    # Affected resource
    resource_type: str | None = None
    resource_id: str | None = None
    resource_name: str | None = None

    # Customer impact
    customer_id: UUID | None = None
    customer_name: str | None = None
    subscriber_count: int = 0

    # Correlation
    correlation_id: UUID | None = None
    correlation_action: str
    parent_alarm_id: UUID | None = None
    is_root_cause: bool = False

    # Timing
    first_occurrence: datetime
    last_occurrence: datetime
    occurrence_count: int
    acknowledged_at: datetime | None = None
    cleared_at: datetime | None = None
    resolved_at: datetime | None = None

    # Assignment
    assigned_to: UUID | None = None
    assigned_by: UUID | None = None
    assigned_at: datetime | None = None

    # Additional data
    additional_info: dict[str, Any] = Field(default_factory=lambda: {})
    tags: list[str] = Field(default_factory=lambda: [])

    # Archival metadata
    archived_at: datetime
    archived_by: str = "system"

    @classmethod
    def from_alarm(cls, alarm: Alarm) -> "ArchivedAlarmData":
        """Convert Alarm model to archival data."""
        return cls(
            id=alarm.id,
            tenant_id=alarm.tenant_id,
            alarm_id=alarm.alarm_id,
            severity=(
                alarm.severity.value
                if isinstance(alarm.severity, AlarmSeverity)
                else alarm.severity
            ),
            status=alarm.status.value if isinstance(alarm.status, AlarmStatus) else alarm.status,
            source=alarm.source.value if isinstance(alarm.source, AlarmSource) else alarm.source,
            alarm_type=alarm.alarm_type,
            title=alarm.title,
            description=alarm.description,
            message=alarm.message,
            resource_type=alarm.resource_type,
            resource_id=alarm.resource_id,
            resource_name=alarm.resource_name,
            customer_id=alarm.customer_id,
            customer_name=alarm.customer_name,
            subscriber_count=int(alarm.subscriber_count or 0),
            correlation_id=alarm.correlation_id,
            correlation_action=(
                alarm.correlation_action.value
                if alarm.correlation_action
                and isinstance(alarm.correlation_action, CorrelationAction)
                else (alarm.correlation_action if alarm.correlation_action else "none")
            ),
            parent_alarm_id=alarm.parent_alarm_id,
            is_root_cause=alarm.is_root_cause if alarm.is_root_cause is not None else False,
            first_occurrence=alarm.first_occurrence,
            last_occurrence=alarm.last_occurrence,
            occurrence_count=int(alarm.occurrence_count or 0),
            acknowledged_at=alarm.acknowledged_at,
            cleared_at=alarm.cleared_at,
            resolved_at=alarm.resolved_at,
            assigned_to=alarm.assigned_to,
            assigned_by=alarm.assigned_by,
            assigned_at=alarm.assigned_at if hasattr(alarm, "assigned_at") else None,
            additional_info=alarm.additional_info if hasattr(alarm, "additional_info") else {},
            tags=list(alarm.tags) if (hasattr(alarm, "tags") and alarm.tags) else [],
            archived_at=datetime.now(UTC),
        )


class ArchivalManifest(BaseModel):  # BaseModel resolves to Any in isolation
    """Metadata for archived alarm batch."""

    model_config = ConfigDict()

    tenant_id: str
    archive_date: datetime
    alarm_count: int
    cutoff_date: datetime
    severity_breakdown: dict[str, int] = Field(default_factory=lambda: {})
    source_breakdown: dict[str, int] = Field(default_factory=lambda: {})
    total_size_bytes: int = 0
    compression_ratio: float = 0.0
    archive_path: str
    manifest_version: str = "1.0"


# =============================================================================
# Alarm Archival Service
# =============================================================================


class AlarmArchivalService:
    """Service for archiving old cleared alarms to MinIO cold storage."""

    def __init__(
        self,
        storage: MinIOStorage | None = None,
        bucket: str | None = None,
    ):
        """
        Initialize archival service.

        Args:
            storage: MinIO storage client (will create if not provided)
            bucket: Override default bucket name
        """
        self.storage = storage or MinIOStorage(bucket=bucket or "dotmac-archives")

        # Ensure bucket exists (storage client handles this)
        logger.info(
            "alarm_archival.initialized",
            bucket=self.storage.bucket,
        )

    def _generate_archive_path(self, tenant_id: str, archive_date: datetime) -> str:
        """
        Generate S3 path for archived alarms.

        Format: alarms/{tenant_id}/year={YYYY}/month={MM}/day={DD}/alarms_{timestamp}.json.gz

        Args:
            tenant_id: Tenant identifier
            archive_date: Date of archive creation

        Returns:
            S3 object path
        """
        return (
            f"alarms/{tenant_id}/"
            f"year={archive_date.year}/"
            f"month={archive_date.month:02d}/"
            f"day={archive_date.day:02d}/"
            f"alarms_{archive_date.strftime('%Y%m%d_%H%M%S')}.json.gz"
        )

    def _compress_alarms(self, alarms_data: list[dict[str, Any]]) -> bytes:
        """
        Compress alarm data using gzip.

        Args:
            alarms_data: List of alarm dictionaries

        Returns:
            Compressed bytes
        """
        json_bytes = json.dumps(alarms_data, indent=2, default=str).encode("utf-8")

        # Use compression level from settings
        compression_level = settings.fault_management.archive_compression_level

        buffer = BytesIO()
        with gzip.GzipFile(fileobj=buffer, mode="wb", compresslevel=compression_level) as gz:
            gz.write(json_bytes)

        compressed = buffer.getvalue()

        logger.info(
            "alarm_archival.compression_stats",
            original_size=len(json_bytes),
            compressed_size=len(compressed),
            compression_ratio=round(len(compressed) / len(json_bytes), 2),
            compression_level=compression_level,
        )

        return compressed

    async def archive_alarms(
        self,
        alarms: list[Alarm],
        tenant_id: str,
        cutoff_date: datetime,
        session: AsyncSession,
    ) -> ArchivalManifest:
        """
        Archive a batch of alarms to MinIO cold storage.

        Args:
            alarms: List of Alarm objects to archive
            tenant_id: Tenant identifier
            cutoff_date: Cutoff date for alarm selection
            session: Database session (not used but kept for consistency)

        Returns:
            ArchivalManifest with archival metadata

        Raises:
            Exception: If archival fails
        """
        if not alarms:
            logger.info("alarm_archival.skip_empty", tenant_id=tenant_id)
            return ArchivalManifest(
                tenant_id=tenant_id,
                archive_date=datetime.now(UTC),
                alarm_count=0,
                cutoff_date=cutoff_date,
                archive_path="",
            )

        archive_date = datetime.now(UTC)

        # Convert alarms to serializable format
        archived_data = [
            ArchivedAlarmData.from_alarm(alarm).model_dump(mode="json") for alarm in alarms
        ]

        # Calculate statistics
        severity_breakdown: dict[str, int] = {}
        source_breakdown: dict[str, int] = {}

        for alarm in alarms:
            severity = (
                alarm.severity.value
                if isinstance(alarm.severity, AlarmSeverity)
                else alarm.severity
            )
            source = alarm.source.value if isinstance(alarm.source, AlarmSource) else alarm.source

            severity_breakdown[severity] = severity_breakdown.get(severity, 0) + 1
            source_breakdown[source] = source_breakdown.get(source, 0) + 1

        # Compress alarm data
        compressed_data = self._compress_alarms(archived_data)

        # Generate archive path
        archive_path = self._generate_archive_path(tenant_id, archive_date)

        # Upload to MinIO
        try:
            file_obj = BytesIO(compressed_data)
            object_name = self.storage.save_file(
                file_path=archive_path,
                content=file_obj,
                tenant_id=tenant_id,
                content_type="application/gzip",
            )

            logger.info(
                "alarm_archival.upload_complete",
                tenant_id=tenant_id,
                alarm_count=len(alarms),
                archive_path=object_name,
                size_bytes=len(compressed_data),
            )
        except Exception as e:
            logger.error(
                "alarm_archival.upload_failed",
                tenant_id=tenant_id,
                alarm_count=len(alarms),
                error=str(e),
                exc_info=True,
            )
            raise

        # Create manifest
        original_size = sum(len(json.dumps(d, default=str)) for d in archived_data)
        manifest = ArchivalManifest(
            tenant_id=tenant_id,
            archive_date=archive_date,
            alarm_count=len(alarms),
            cutoff_date=cutoff_date,
            severity_breakdown=severity_breakdown,
            source_breakdown=source_breakdown,
            total_size_bytes=len(compressed_data),
            compression_ratio=(
                round(len(compressed_data) / original_size, 2) if original_size > 0 else 0.0
            ),
            archive_path=archive_path,
        )

        # Save manifest to MinIO
        manifest_path = archive_path.replace(".json.gz", "_manifest.json")
        manifest_bytes = BytesIO(manifest.model_dump_json(indent=2).encode("utf-8"))

        self.storage.save_file(
            file_path=manifest_path,
            content=manifest_bytes,
            tenant_id=tenant_id,
            content_type="application/json",
        )

        logger.info(
            "alarm_archival.complete",
            tenant_id=tenant_id,
            alarm_count=len(alarms),
            archive_path=archive_path,
            manifest_path=manifest_path,
            severity_breakdown=severity_breakdown,
            source_breakdown=source_breakdown,
        )

        return manifest

    async def retrieve_archived_alarms(
        self,
        tenant_id: str,
        archive_path: str,
    ) -> list[dict[str, Any]]:
        """
        Retrieve and decompress archived alarms from MinIO.

        Args:
            tenant_id: Tenant identifier
            archive_path: S3 path to archived alarms

        Returns:
            List of alarm dictionaries

        Raises:
            Exception: If retrieval or decompression fails
        """
        try:
            # Download from MinIO
            file_data = self.storage.get_file(archive_path, tenant_id)

            # Decompress
            with gzip.GzipFile(fileobj=BytesIO(file_data)) as gz:
                json_data = gz.read()

            alarms_raw = json.loads(json_data)
            if not isinstance(alarms_raw, list):
                raise ValueError("Archived alarms payload is not a list")

            alarms_data: list[dict[str, Any]] = []
            for item in alarms_raw:
                if not isinstance(item, dict):
                    raise ValueError("Archived alarm entry is not a dictionary")
                alarms_data.append(item)

            logger.info(
                "alarm_archival.retrieve_complete",
                tenant_id=tenant_id,
                archive_path=archive_path,
                alarm_count=len(alarms_data),
            )

            return alarms_data

        except Exception as e:
            logger.error(
                "alarm_archival.retrieve_failed",
                tenant_id=tenant_id,
                archive_path=archive_path,
                error=str(e),
                exc_info=True,
            )
            raise

    async def list_archives(
        self,
        tenant_id: str,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> list[str]:
        """
        List available alarm archives for a tenant.

        Args:
            tenant_id: Tenant identifier
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            List of archive paths
        """
        prefix = f"alarms/{tenant_id}/"

        try:
            files = self.storage.list_files(prefix, tenant_id)

            # Filter for actual archive files (not manifests)
            archives = [
                f.path
                for f in files
                if f.path.endswith(".json.gz") and not f.path.endswith("_manifest.json")
            ]

            # Apply date filtering if provided
            if start_date or end_date:
                filtered_archives = []
                for archive_path in archives:
                    # Extract timestamp from filename: alarms_YYYYMMDD_HHMMSS.json.gz
                    filename = archive_path.split("/")[-1]
                    if filename.startswith("alarms_") and len(filename) > 22:
                        try:
                            # Parse timestamp: alarms_20240101_120000.json.gz
                            timestamp_str = filename[7:22]  # YYYYMMDD_HHMMSS
                            archive_date = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")

                            # Check date range
                            if start_date and archive_date < start_date:
                                continue
                            if end_date and archive_date > end_date:
                                continue

                            filtered_archives.append(archive_path)
                        except (ValueError, IndexError):
                            # If we can't parse the date, include it to be safe
                            filtered_archives.append(archive_path)
                    else:
                        # Include files with unexpected format
                        filtered_archives.append(archive_path)

                archives = filtered_archives

            logger.info(
                "alarm_archival.list_complete",
                tenant_id=tenant_id,
                archive_count=len(archives),
            )

            return archives

        except Exception as e:
            logger.error(
                "alarm_archival.list_failed",
                tenant_id=tenant_id,
                error=str(e),
                exc_info=True,
            )
            raise
