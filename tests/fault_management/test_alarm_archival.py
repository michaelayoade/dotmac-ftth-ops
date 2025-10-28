"""
Tests for Alarm Archival Service

Tests archiving old cleared alarms to MinIO cold storage.
"""

import gzip
import json
from datetime import timezone, datetime, timedelta
from io import BytesIO
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from dotmac.platform.fault_management.archival import (
    AlarmArchivalService,
    ArchivalManifest,
    ArchivedAlarmData,
)
from dotmac.platform.fault_management.models import Alarm, AlarmSeverity, AlarmSource, AlarmStatus
from dotmac.platform.fault_management.tasks import cleanup_old_cleared_alarms

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def tenant_id():
    """Test tenant ID."""
    return "test-tenant-123"


@pytest.fixture
def mock_minio_storage():
    """Mock MinIO storage client."""
    with patch("dotmac.platform.fault_management.archival.MinIOStorage") as mock:
        storage = Mock()
        storage.bucket = "dotmac-archives"
        storage.save_file = Mock(
            return_value="alarms/test-tenant-123/year=2025/month=01/day=15/alarms_20250115_120000.json.gz"
        )
        storage.get_file = Mock(return_value=b"test data")
        storage.list_files = Mock(return_value=[])
        mock.return_value = storage
        yield storage


@pytest.fixture
def sample_alarm(tenant_id):
    """Create a sample cleared alarm."""
    return Alarm(
        id=uuid4(),
        tenant_id=tenant_id,
        alarm_id=f"ALM-{uuid4()}",
        severity=AlarmSeverity.CRITICAL,
        status=AlarmStatus.CLEARED,
        source=AlarmSource.NETWORK_DEVICE,
        alarm_type="LINK_DOWN",
        title="Link Down on Port 1",
        description="Network link down detected",
        message="Interface GigabitEthernet0/1 is down",
        resource_type="device",
        resource_id="device-123",
        resource_name="OLT-CORE-01",
        customer_id=uuid4(),
        customer_name="Acme Corp",
        subscriber_count=50,
        first_occurrence=datetime.now(timezone.utc) - timedelta(days=100),
        last_occurrence=datetime.now(timezone.utc) - timedelta(days=95),
        occurrence_count=3,
        acknowledged_at=datetime.now(timezone.utc) - timedelta(days=94),
        cleared_at=datetime.now(timezone.utc) - timedelta(days=93),
        resolved_at=datetime.now(timezone.utc) - timedelta(days=93),
    )


# =============================================================================
# Archival Service Tests
# =============================================================================


@pytest.mark.integration
class TestArchivedAlarmData:
    """Test ArchivedAlarmData schema."""

    def test_from_alarm_conversion(self, sample_alarm):
        """Test converting Alarm model to archival data."""
        archived = ArchivedAlarmData.from_alarm(sample_alarm)

        assert archived.id == sample_alarm.id
        assert archived.tenant_id == sample_alarm.tenant_id
        assert archived.alarm_id == sample_alarm.alarm_id
        assert archived.severity == "critical"
        assert archived.status == "cleared"
        assert archived.source == "network_device"
        assert archived.alarm_type == sample_alarm.alarm_type
        assert archived.title == sample_alarm.title
        assert archived.archived_by == "system"
        assert isinstance(archived.archived_at, datetime)

    def test_archived_alarm_serialization(self, sample_alarm):
        """Test that archived alarm can be serialized to JSON."""
        archived = ArchivedAlarmData.from_alarm(sample_alarm)
        data = archived.model_dump(mode="json")

        # Should be JSON serializable
        json_str = json.dumps(data, default=str)
        assert json_str
        assert "critical" in json_str
        assert "LINK_DOWN" in json_str


@pytest.mark.integration
class TestAlarmArchivalService:
    """Test AlarmArchivalService."""

    def test_generate_archive_path(self, mock_minio_storage, tenant_id):
        """Test archive path generation."""
        service = AlarmArchivalService(storage=mock_minio_storage)
        archive_date = datetime(2025, 1, 15, 12, 30, 45)

        path = service._generate_archive_path(tenant_id, archive_date)

        assert path.startswith(f"alarms/{tenant_id}/")
        assert "year=2025" in path
        assert "month=01" in path
        assert "day=15" in path
        assert path.endswith(".json.gz")
        assert "20250115_123045" in path

    def test_compress_alarms(self, mock_minio_storage):
        """Test alarm data compression."""
        service = AlarmArchivalService(storage=mock_minio_storage)

        alarms_data = [
            {"id": str(uuid4()), "title": "Test Alarm 1"},
            {"id": str(uuid4()), "title": "Test Alarm 2"},
        ]

        compressed = service._compress_alarms(alarms_data)

        # Verify it's compressed
        assert isinstance(compressed, bytes)
        assert len(compressed) > 0

        # Verify it can be decompressed
        with gzip.GzipFile(fileobj=BytesIO(compressed)) as gz:
            decompressed = json.loads(gz.read())

        assert len(decompressed) == 2
        assert decompressed[0]["title"] == "Test Alarm 1"

    @pytest.mark.asyncio
    async def test_archive_empty_alarms(self, mock_minio_storage, tenant_id, async_session):
        """Test archiving empty alarm list."""
        service = AlarmArchivalService(storage=mock_minio_storage)

        manifest = await service.archive_alarms(
            alarms=[],
            tenant_id=tenant_id,
            cutoff_date=datetime.now(timezone.utc),
            session=async_session,
        )

        assert manifest.alarm_count == 0
        assert manifest.archive_path == ""
        assert not mock_minio_storage.save_file.called

    @pytest.mark.asyncio
    async def test_archive_alarms_success(
        self, mock_minio_storage, tenant_id, sample_alarm, async_session
    ):
        """Test successful alarm archival."""
        service = AlarmArchivalService(storage=mock_minio_storage)
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=90)

        # Create multiple alarms
        alarms = [sample_alarm]
        for i in range(3):
            alarm = Alarm(
                id=uuid4(),
                tenant_id=tenant_id,
                alarm_id=f"ALM-TEST-{i}",
                severity=AlarmSeverity.MAJOR if i % 2 == 0 else AlarmSeverity.MINOR,
                status=AlarmStatus.CLEARED,
                source=AlarmSource.CPE if i % 2 == 0 else AlarmSource.MONITORING,
                alarm_type="TEST_ALARM",
                title=f"Test Alarm {i}",
                first_occurrence=datetime.now(timezone.utc) - timedelta(days=100),
                last_occurrence=datetime.now(timezone.utc) - timedelta(days=95),
                cleared_at=datetime.now(timezone.utc) - timedelta(days=93),
            )
            alarms.append(alarm)

        manifest = await service.archive_alarms(
            alarms=alarms,
            tenant_id=tenant_id,
            cutoff_date=cutoff_date,
            session=async_session,
        )

        # Verify manifest
        assert manifest.alarm_count == 4
        assert manifest.tenant_id == tenant_id
        assert manifest.cutoff_date == cutoff_date
        assert manifest.archive_path
        assert "alarms/" in manifest.archive_path

        # Verify severity breakdown
        assert "critical" in manifest.severity_breakdown
        assert "major" in manifest.severity_breakdown
        assert "minor" in manifest.severity_breakdown
        assert manifest.severity_breakdown["critical"] == 1
        assert manifest.severity_breakdown["major"] == 2
        assert manifest.severity_breakdown["minor"] == 1

        # Verify source breakdown
        assert "network_device" in manifest.source_breakdown
        assert "cpe" in manifest.source_breakdown
        assert "monitoring" in manifest.source_breakdown

        # Verify MinIO calls
        assert mock_minio_storage.save_file.call_count == 2  # Data + Manifest
        assert manifest.compression_ratio > 0

    @pytest.mark.asyncio
    async def test_archive_alarms_handles_storage_failure(
        self, mock_minio_storage, tenant_id, sample_alarm, async_session
    ):
        """Test handling of MinIO storage failure."""
        service = AlarmArchivalService(storage=mock_minio_storage)

        # Mock storage failure
        mock_minio_storage.save_file.side_effect = Exception("Storage error")

        with pytest.raises(Exception, match="Storage error"):
            await service.archive_alarms(
                alarms=[sample_alarm],
                tenant_id=tenant_id,
                cutoff_date=datetime.now(timezone.utc),
                session=async_session,
            )

    @pytest.mark.asyncio
    async def test_retrieve_archived_alarms(self, mock_minio_storage, tenant_id, sample_alarm):
        """Test retrieving archived alarms from MinIO."""
        service = AlarmArchivalService(storage=mock_minio_storage)

        # Create archived data
        archived_data = [ArchivedAlarmData.from_alarm(sample_alarm).model_dump(mode="json")]
        json_bytes = json.dumps(archived_data, default=str).encode("utf-8")

        # Compress it
        buffer = BytesIO()
        with gzip.GzipFile(fileobj=buffer, mode="wb") as gz:
            gz.write(json_bytes)
        compressed = buffer.getvalue()

        # Mock MinIO response
        mock_minio_storage.get_file.return_value = compressed

        # Retrieve
        alarms = await service.retrieve_archived_alarms(
            tenant_id=tenant_id,
            archive_path="alarms/test/archive.json.gz",
        )

        assert len(alarms) == 1
        assert alarms[0]["alarm_id"] == sample_alarm.alarm_id
        assert alarms[0]["title"] == sample_alarm.title
        mock_minio_storage.get_file.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_archives(self, mock_minio_storage, tenant_id):
        """Test listing available archives."""
        service = AlarmArchivalService(storage=mock_minio_storage)

        # Mock file listing
        from dotmac.platform.file_storage.minio_storage import FileInfo

        mock_files = [
            FileInfo(
                filename="alarms_20250115_120000.json.gz",
                path=f"alarms/{tenant_id}/year=2025/month=01/day=15/alarms_20250115_120000.json.gz",
                size=1024,
                content_type="application/gzip",
                modified_at=datetime.now(timezone.utc),
                tenant_id=tenant_id,
            ),
            FileInfo(
                filename="alarms_20250115_120000_manifest.json",
                path=f"alarms/{tenant_id}/year=2025/month=01/day=15/alarms_20250115_120000_manifest.json",
                size=512,
                content_type="application/json",
                modified_at=datetime.now(timezone.utc),
                tenant_id=tenant_id,
            ),
        ]
        mock_minio_storage.list_files.return_value = mock_files

        # List archives
        archives = await service.list_archives(tenant_id=tenant_id)

        # Should only return .json.gz files, not manifests
        assert len(archives) == 1
        assert archives[0].endswith(".json.gz")
        assert not archives[0].endswith("_manifest.json")


# =============================================================================
# Cleanup Task Tests
# =============================================================================


@pytest.mark.integration
class TestCleanupOldClearedAlarms:
    """Test cleanup_old_cleared_alarms Celery task."""

    @pytest.mark.asyncio
    async def test_cleanup_no_alarms(self, async_session):
        """Test cleanup with no alarms to archive."""
        result = cleanup_old_cleared_alarms(days=90)

        assert result["alarms_cleaned"] == 0
        assert result["alarms_archived"] == 0
        assert result["cutoff_days"] == 90

    @pytest.mark.asyncio
    async def test_cleanup_archives_and_deletes_old_alarms(
        self, async_session, tenant_id, mock_minio_storage
    ):
        """Test that old alarms are archived and deleted."""
        # Create old cleared alarms
        old_alarm = Alarm(
            id=uuid4(),
            tenant_id=tenant_id,
            alarm_id="ALM-OLD-001",
            severity=AlarmSeverity.CRITICAL,
            status=AlarmStatus.CLEARED,
            source=AlarmSource.NETWORK_DEVICE,
            alarm_type="LINK_DOWN",
            title="Old Cleared Alarm",
            first_occurrence=datetime.now(timezone.utc) - timedelta(days=100),
            last_occurrence=datetime.now(timezone.utc) - timedelta(days=95),
            cleared_at=datetime.now(timezone.utc) - timedelta(days=95),  # 95 days ago
        )

        async_session.add(old_alarm)
        await async_session.commit()

        # Run cleanup with mock storage
        with patch("dotmac.platform.fault_management.tasks.AlarmArchivalService") as mock_service:
            mock_instance = Mock()
            mock_instance.archive_alarms = AsyncMock(
                return_value=ArchivalManifest(
                    tenant_id=tenant_id,
                    archive_date=datetime.now(timezone.utc),
                    alarm_count=1,
                    cutoff_date=datetime.now(timezone.utc) - timedelta(days=90),
                    severity_breakdown={"critical": 1},
                    source_breakdown={"network_device": 1},
                    total_size_bytes=1024,
                    compression_ratio=0.3,
                    archive_path="alarms/test/archive.json.gz",
                )
            )
            mock_service.return_value = mock_instance

            result = cleanup_old_cleared_alarms(days=90)

        # Verify results
        assert result["alarms_archived"] == 1
        assert result["alarms_cleaned"] == 1
        assert result["cutoff_days"] == 90
        assert result["tenant_count"] == 1

        # Verify alarm was deleted from database
        result_alarm = await async_session.execute(select(Alarm).where(Alarm.id == old_alarm.id))
        assert result_alarm.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_cleanup_skips_recent_alarms(self, async_session, tenant_id):
        """Test that recent cleared alarms are not archived."""
        # Create recent cleared alarm (less than 90 days old)
        recent_alarm = Alarm(
            id=uuid4(),
            tenant_id=tenant_id,
            alarm_id="ALM-RECENT-001",
            severity=AlarmSeverity.MINOR,
            status=AlarmStatus.CLEARED,
            source=AlarmSource.CPE,
            alarm_type="POWER_FAIL",
            title="Recent Cleared Alarm",
            first_occurrence=datetime.now(timezone.utc) - timedelta(days=30),
            last_occurrence=datetime.now(timezone.utc) - timedelta(days=25),
            cleared_at=datetime.now(timezone.utc) - timedelta(days=25),  # Only 25 days ago
        )

        async_session.add(recent_alarm)
        await async_session.commit()

        # Run cleanup
        result = cleanup_old_cleared_alarms(days=90)

        # Should not archive recent alarms
        assert result["alarms_cleaned"] == 0
        assert result["alarms_archived"] == 0

        # Verify alarm still exists in database
        result_alarm = await async_session.execute(select(Alarm).where(Alarm.id == recent_alarm.id))
        assert result_alarm.scalar_one_or_none() is not None

    @pytest.mark.asyncio
    async def test_cleanup_skips_active_alarms(self, async_session, tenant_id):
        """Test that active alarms are not archived."""
        # Create old but still active alarm
        active_alarm = Alarm(
            id=uuid4(),
            tenant_id=tenant_id,
            alarm_id="ALM-ACTIVE-001",
            severity=AlarmSeverity.MAJOR,
            status=AlarmStatus.ACTIVE,  # Still active
            source=AlarmSource.SERVICE,
            alarm_type="SERVICE_DOWN",
            title="Active Alarm",
            first_occurrence=datetime.now(timezone.utc) - timedelta(days=100),
            last_occurrence=datetime.now(timezone.utc) - timedelta(days=1),
        )

        async_session.add(active_alarm)
        await async_session.commit()

        # Run cleanup
        result = cleanup_old_cleared_alarms(days=90)

        # Should not archive active alarms
        assert result["alarms_cleaned"] == 0
        assert result["alarms_archived"] == 0

        # Verify alarm still exists
        result_alarm = await async_session.execute(select(Alarm).where(Alarm.id == active_alarm.id))
        assert result_alarm.scalar_one_or_none() is not None


# =============================================================================
# Integration Tests
# =============================================================================


@pytest.mark.integration
class TestAlarmArchivalIntegration:
    """Integration tests for alarm archival."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_end_to_end_archival(self, async_session, tenant_id, sample_alarm):
        """Test complete archival workflow end-to-end."""
        # This test would require actual MinIO instance
        # Mark as integration test to skip in unit tests
        pytest.skip("Requires MinIO instance")

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_archive_retrieval_roundtrip(self, async_session, tenant_id, sample_alarm):
        """Test archiving and then retrieving alarms."""
        # This test would require actual MinIO instance
        pytest.skip("Requires MinIO instance")
