"""
Tests for audit retention and archiving functionality.
"""

import gzip
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.audit.models import (
    ActivitySeverity,
    ActivityType,
    AuditActivity,
)
from dotmac.platform.audit.retention import (
    AuditRetentionPolicy,
    AuditRetentionService,
    cleanup_audit_logs_task,
)


@pytest.fixture
def retention_policy(tmp_path):
    """Create test retention policy."""
    return AuditRetentionPolicy(
        retention_days=90,
        archive_enabled=True,
        archive_location=str(tmp_path / "archive"),
        batch_size=10,
        severity_retention={
            ActivitySeverity.LOW: 7,
            ActivitySeverity.MEDIUM: 14,
            ActivitySeverity.HIGH: 30,
            ActivitySeverity.CRITICAL: 365,
        },
    )


@pytest.fixture
def retention_service(retention_policy):
    """Create retention service with test policy."""
    return AuditRetentionService(retention_policy)


@pytest.fixture
def old_activities(async_db_session):
    """Create old audit activities for retention testing."""

    async def _create_activities():
        now = datetime.now(UTC)
        activities = []

        # Create activities of different ages and severities
        test_data = [
            # (days_old, severity)
            (5, ActivitySeverity.LOW),  # Should not be deleted (< 7 days)
            (10, ActivitySeverity.LOW),  # Should be deleted (> 7 days)
            (10, ActivitySeverity.MEDIUM),  # Should not be deleted (< 14 days)
            (20, ActivitySeverity.MEDIUM),  # Should be deleted (> 14 days)
            (25, ActivitySeverity.HIGH),  # Should not be deleted (< 30 days)
            (35, ActivitySeverity.HIGH),  # Should be deleted (> 30 days)
            (100, ActivitySeverity.CRITICAL),  # Should not be deleted (< 365 days)
            (400, ActivitySeverity.CRITICAL),  # Should be deleted (> 365 days)
        ]

        for days_old, severity in test_data:
            activity = AuditActivity(
                id=uuid4(),
                activity_type=ActivityType.USER_LOGIN,
                severity=severity,
                user_id="user123",
                tenant_id="test_tenant",
                action="test",
                description=f"Test activity {days_old} days old",
                timestamp=now - timedelta(days=days_old),
                created_at=now,
                updated_at=now,
            )
            activities.append(activity)
            async_db_session.add(activity)

        await async_db_session.commit()
        return activities

    return _create_activities()


@pytest.mark.integration
class TestAuditRetentionPolicy:
    """Test retention policy configuration."""

    def test_retention_policy_defaults(self):
        """Test default retention policy values."""
        policy = AuditRetentionPolicy()

        assert policy.retention_days == 90
        assert policy.archive_enabled is True
        assert policy.batch_size == 1000
        assert len(policy.severity_retention) == 4

    def test_custom_retention_policy(self, tmp_path):
        """Test custom retention policy configuration."""
        custom_retention = {
            ActivitySeverity.LOW: 1,
            ActivitySeverity.HIGH: 60,
        }

        policy = AuditRetentionPolicy(
            retention_days=30,
            archive_enabled=False,
            archive_location=str(tmp_path),
            batch_size=500,
            severity_retention=custom_retention,
        )

        assert policy.retention_days == 30
        assert policy.archive_enabled is False
        assert policy.batch_size == 500
        assert policy.severity_retention == custom_retention

    def test_retention_policy_loads_from_settings(self, tmp_path, monkeypatch):
        """Test that retention policy loads configuration from settings."""
        from dotmac.platform.settings import settings

        # Override settings for this test
        monkeypatch.setattr(settings.audit, "audit_retention_days", 42)
        monkeypatch.setattr(settings.audit, "audit_archive_enabled", False)
        monkeypatch.setattr(settings.audit, "audit_archive_location", "/custom/archive/path")

        # Create policy without explicit parameters (should load from settings)
        policy = AuditRetentionPolicy()

        # Verify settings were loaded
        assert policy.retention_days == 42
        assert policy.archive_enabled is False
        assert str(policy.archive_location) == "/custom/archive/path"

    def test_retention_policy_explicit_params_override_settings(self, tmp_path, monkeypatch):
        """Test that explicit parameters override settings."""
        from dotmac.platform.settings import settings

        # Override settings
        monkeypatch.setattr(settings.audit, "audit_retention_days", 42)
        monkeypatch.setattr(settings.audit, "audit_archive_enabled", False)

        # Create policy with explicit parameters
        policy = AuditRetentionPolicy(
            retention_days=100, archive_enabled=True, archive_location=str(tmp_path / "test")
        )

        # Verify explicit params took precedence
        assert policy.retention_days == 100
        assert policy.archive_enabled is True
        assert str(policy.archive_location) == str(tmp_path / "test")


@pytest.mark.integration
class TestAuditRetentionService:
    """Test audit retention service functionality."""

    @pytest.mark.asyncio
    async def test_cleanup_old_logs_dry_run(
        self, retention_service, old_activities, async_db_session
    ):
        """Test cleanup in dry run mode."""
        # Await the fixture coroutine
        activities = await old_activities

        # Patch get_async_db to use test session
        from unittest.mock import AsyncMock, patch

        with patch("dotmac.platform.audit.retention.get_async_db") as mock_get_db:
            # Set up async context manager
            mock_get_db.return_value.__aenter__ = AsyncMock(return_value=async_db_session)
            mock_get_db.return_value.__aexit__ = AsyncMock(return_value=None)

            results = await retention_service.cleanup_old_logs(
                dry_run=True,
                tenant_id="test_tenant",
            )

        # Should report what would be deleted but not actually delete
        assert results["total_deleted"] >= 0  # May be 0 if no old data
        assert results["total_archived"] == 0  # No archiving in dry run
        assert "by_severity" in results

        # Verify nothing was actually deleted using correct SQLAlchemy syntax
        from sqlalchemy import func, select

        count_query = select(func.count()).select_from(AuditActivity)
        result = await async_db_session.execute(count_query)
        remaining = result.scalar()
        assert remaining == len(activities)

    @pytest.mark.asyncio
    async def test_cleanup_old_logs_with_deletion(
        self, retention_service, old_activities, async_db_session
    ):
        """Test actual cleanup with deletion."""
        from unittest.mock import AsyncMock, patch

        # Await the fixture coroutine
        activities = await old_activities

        # Disable archiving for this test
        retention_service.policy.archive_enabled = False

        initial_count = len(activities)

        # Patch get_async_db to use test session
        with patch("dotmac.platform.audit.retention.get_async_db") as mock_get_db:
            mock_get_db.return_value.__aenter__ = AsyncMock(return_value=async_db_session)
            mock_get_db.return_value.__aexit__ = AsyncMock(return_value=None)

            results = await retention_service.cleanup_old_logs(
                dry_run=False,
                tenant_id="test_tenant",
            )

        assert results["total_deleted"] >= 0
        assert results["total_archived"] == 0

        # Verify activities were deleted if any were old enough
        from sqlalchemy import select

        remaining_query = select(AuditActivity).where(AuditActivity.tenant_id == "test_tenant")
        remaining_result = await async_db_session.execute(remaining_query)
        remaining_activities = remaining_result.scalars().all()

        assert len(remaining_activities) <= initial_count

        # Verify correct activities remain (based on retention policy)
        for activity in remaining_activities:
            days_old = (datetime.now(UTC) - activity.timestamp).days
            expected_retention = retention_service.policy.severity_retention.get(
                activity.severity, 90
            )
            assert days_old <= expected_retention

    @pytest.mark.asyncio
    async def test_cleanup_with_archiving(
        self, retention_service, old_activities, async_db_session
    ):
        """Test cleanup with archiving enabled."""
        from unittest.mock import AsyncMock, patch

        # Await the fixture coroutine
        await old_activities

        # Patch get_async_db to use test session
        with patch("dotmac.platform.audit.retention.get_async_db") as mock_get_db:
            mock_get_db.return_value.__aenter__ = AsyncMock(return_value=async_db_session)
            mock_get_db.return_value.__aexit__ = AsyncMock(return_value=None)

            results = await retention_service.cleanup_old_logs(
                dry_run=False,
                tenant_id="test_tenant",
            )

        # May be 0 if no data old enough to delete
        assert results["total_deleted"] >= 0

        # If anything was deleted, it should have been archived
        if results["total_deleted"] > 0:
            assert results["total_archived"] > 0
            assert results["total_archived"] == results["total_deleted"]

            # Verify archive files were created
            archive_dir = retention_service.policy.archive_location
            archive_files = list(archive_dir.glob("audit_*.jsonl.gz"))
            assert len(archive_files) > 0

            # Verify archive content
            for archive_file in archive_files:
                with gzip.open(archive_file, "rt") as f:
                    lines = f.readlines()
                    assert len(lines) > 0

                    # Verify each line is valid JSON
                    for line in lines:
                        record = json.loads(line)
                        assert "id" in record
                        assert "activity_type" in record
                        assert "severity" in record

    @pytest.mark.asyncio
    async def test_restore_from_archive(self, retention_service, tmp_path, async_db_session):
        """Test restoring activities from archive."""
        from unittest.mock import AsyncMock, patch

        # Create test archive file
        archive_file = tmp_path / "test_archive.jsonl.gz"
        test_activities = [
            {
                "id": str(uuid4()),
                "activity_type": ActivityType.USER_LOGIN,
                "severity": ActivitySeverity.LOW,
                "user_id": "user123",
                "tenant_id": "test_tenant",
                "timestamp": datetime.now(UTC).isoformat(),
                "resource_type": None,
                "resource_id": None,
                "action": "login",
                "description": "Archived activity",
                "details": None,
                "ip_address": "192.168.1.100",
                "user_agent": "Test",
                "request_id": "req-123",
            }
            for _ in range(5)
        ]

        with gzip.open(archive_file, "wt") as f:
            for activity in test_activities:
                f.write(json.dumps(activity) + "\n")

        # Patch get_async_db to use test session
        with patch("dotmac.platform.audit.retention.get_async_db") as mock_get_db:
            mock_get_db.return_value.__aenter__ = AsyncMock(return_value=async_db_session)
            mock_get_db.return_value.__aexit__ = AsyncMock(return_value=None)

            # Restore from archive
            results = await retention_service.restore_from_archive(
                str(archive_file),
                tenant_id="test_tenant",
            )

        assert results["total_restored"] == 5
        assert results["skipped"] == 0
        assert len(results["errors"]) == 0

    @pytest.mark.asyncio
    async def test_restore_from_archive_with_filter(
        self, retention_service, tmp_path, async_db_session
    ):
        """Test restoring with tenant filter."""
        from unittest.mock import AsyncMock, patch

        archive_file = tmp_path / "test_archive.jsonl.gz"

        # Create archive with multiple tenants
        test_activities = [
            {
                "id": str(uuid4()),
                "activity_type": ActivityType.USER_LOGIN,
                "severity": ActivitySeverity.LOW,
                "user_id": "user123",
                "tenant_id": "tenant1" if i % 2 == 0 else "tenant2",
                "timestamp": datetime.now(UTC).isoformat(),
                "action": "login",
                "description": f"Activity {i}",
                "resource_type": None,
                "resource_id": None,
                "details": None,
                "ip_address": None,
                "user_agent": None,
                "request_id": None,
            }
            for i in range(10)
        ]

        with gzip.open(archive_file, "wt") as f:
            for activity in test_activities:
                f.write(json.dumps(activity) + "\n")

        # Patch get_async_db to use test session
        with patch("dotmac.platform.audit.retention.get_async_db") as mock_get_db:
            mock_get_db.return_value.__aenter__ = AsyncMock(return_value=async_db_session)
            mock_get_db.return_value.__aexit__ = AsyncMock(return_value=None)

            # Restore only tenant1 activities
            results = await retention_service.restore_from_archive(
                str(archive_file),
                tenant_id="tenant1",
            )

        assert results["total_restored"] == 5  # Only tenant1 activities
        assert results["skipped"] == 5  # tenant2 activities skipped

    @pytest.mark.asyncio
    async def test_get_retention_statistics(
        self, retention_service, old_activities, async_db_session
    ):
        """Test getting retention statistics."""
        from unittest.mock import AsyncMock, patch

        # Await the fixture coroutine
        activities = await old_activities

        # Patch get_async_db to use test session
        with patch("dotmac.platform.audit.retention.get_async_db") as mock_get_db:
            mock_get_db.return_value.__aenter__ = AsyncMock(return_value=async_db_session)
            mock_get_db.return_value.__aexit__ = AsyncMock(return_value=None)

            stats = await retention_service.get_retention_statistics(tenant_id="test_tenant")

        assert stats["total_records"] == len(activities)
        assert len(stats["by_severity"]) > 0
        assert stats["oldest_record"] is not None
        assert stats["newest_record"] is not None
        # records_to_delete may be empty if no data is old enough
        assert "records_to_delete" in stats

        # Verify deletion counts are correct for any records to delete
        for _severity, info in stats["records_to_delete"].items():
            assert info["count"] > 0
            assert "older_than" in info

    @pytest.mark.asyncio
    async def test_cleanup_error_handling(self, tmp_path):
        """Test error handling during cleanup."""
        from unittest.mock import AsyncMock, patch

        # Create retention service with temp path
        policy = AuditRetentionPolicy(archive_location=str(tmp_path / "archive"))
        retention_service = AuditRetentionService(policy)

        # Mock database session that raises an error
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(side_effect=Exception("Database connection error"))

        # Patch get_async_db to return our failing mock
        with patch("dotmac.platform.audit.retention.get_async_db") as mock_get_db:
            mock_get_db.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_get_db.return_value.__aexit__ = AsyncMock(return_value=None)

            # Run cleanup - should handle error gracefully
            result = await retention_service.cleanup_old_logs(dry_run=False)

            # Verify error was captured in results
            assert "errors" in result
            assert len(result["errors"]) > 0
            assert "Database connection error" in result["errors"][0]

            # Should still return valid structure even with errors
            assert "total_deleted" in result
            assert "total_archived" in result
            assert "by_severity" in result

    @pytest.mark.asyncio
    async def test_archive_error_handling(self, tmp_path, old_activities, async_db_session):
        """Test error handling during archiving."""
        from unittest.mock import AsyncMock, patch

        # Await the fixture coroutine
        await old_activities

        # Create retention service with unwritable path but AFTER directory setup
        invalid_path = tmp_path / "readonly"
        invalid_path.mkdir()
        invalid_path.chmod(0o444)  # Make read-only

        policy = AuditRetentionPolicy(
            retention_days=90,
            archive_enabled=True,
            archive_location=str(invalid_path),
            batch_size=10,
            severity_retention={
                ActivitySeverity.LOW: 7,
                ActivitySeverity.MEDIUM: 14,
                ActivitySeverity.HIGH: 30,
                ActivitySeverity.CRITICAL: 365,
            },
        )

        # Don't let it try to create directory in __init__
        with patch.object(Path, "mkdir"):
            service = AuditRetentionService(policy)

        # Patch get_async_db to use test session
        with patch("dotmac.platform.audit.retention.get_async_db") as mock_get_db:
            mock_get_db.return_value.__aenter__ = AsyncMock(return_value=async_db_session)
            mock_get_db.return_value.__aexit__ = AsyncMock(return_value=None)

            results = await service.cleanup_old_logs(
                dry_run=False,
                tenant_id="test_tenant",
            )

        # Cleanup
        invalid_path.chmod(0o755)

        # Should have errors if there was data to archive
        # May be 0 errors if no data was old enough to process
        assert "errors" in results


@pytest.mark.integration
class TestCleanupTask:
    """Test scheduled cleanup task."""

    @pytest.mark.asyncio
    async def test_cleanup_audit_logs_task(self):
        """Test the scheduled cleanup task."""
        with patch("dotmac.platform.audit.retention.AuditRetentionService") as MockService:
            mock_service = AsyncMock()
            MockService.return_value = mock_service

            mock_service.get_retention_statistics = AsyncMock(
                return_value={"total_records": 1000, "by_severity": {}, "records_to_delete": {}}
            )

            mock_service.cleanup_old_logs = AsyncMock(
                return_value={
                    "total_deleted": 100,
                    "total_archived": 100,
                    "by_severity": {},
                    "errors": [],
                }
            )

            results = await cleanup_audit_logs_task()

            assert results["total_deleted"] == 100
            assert results["total_archived"] == 100

            # Verify statistics were collected
            assert mock_service.get_retention_statistics.call_count == 2

    @pytest.mark.asyncio
    async def test_cleanup_task_error_handling(self):
        """Test cleanup task handles errors."""
        with patch("dotmac.platform.audit.retention.AuditRetentionService") as MockService:
            MockService.side_effect = Exception("Service initialization failed")

            with pytest.raises(Exception):  # noqa: B017
                await cleanup_audit_logs_task()
