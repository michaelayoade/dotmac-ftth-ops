"""
Tests for Alarm Service
"""

from datetime import timezone, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmNote,
    AlarmRule,
    AlarmSeverity,
    AlarmSource,
    AlarmStatus,
    MaintenanceWindow,
)
from dotmac.platform.fault_management.schemas import (
    AlarmCreate,
    AlarmNoteCreate,
    AlarmQueryParams,
    AlarmRuleCreate,
    AlarmRuleUpdate,
    AlarmUpdate,
    MaintenanceWindowCreate,
)
from dotmac.platform.fault_management.service import AlarmService


class TestAlarmServiceCreation:
    """Test alarm creation functionality"""

    @pytest.mark.asyncio
    async def test_create_alarm_basic(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_alarm_data: dict,
    ):
        """Test creating a basic alarm"""
        service = AlarmService(session, test_tenant)
        user_id = uuid4()

        alarm_create = AlarmCreate(**sample_alarm_data)
        alarm_response = await service.create(alarm_create, user_id=user_id)

        assert alarm_response.id is not None
        assert alarm_response.tenant_id == test_tenant
        assert alarm_response.severity == AlarmSeverity.CRITICAL
        assert alarm_response.status == AlarmStatus.ACTIVE
        assert alarm_response.alarm_id == "test-alarm-001"
        assert alarm_response.title == "Test Device Down"
        assert alarm_response.subscriber_count == 10

        # Verify in database
        result = await session.execute(select(Alarm).where(Alarm.id == alarm_response.id))
        alarm = result.scalar_one()
        assert alarm is not None
        assert alarm.tenant_id == test_tenant

    @pytest.mark.asyncio
    async def test_create_alarm_duplicate_updates_count(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_alarm_data: dict,
    ):
        """Test that duplicate alarms update occurrence count"""
        service = AlarmService(session, test_tenant)

        # Create first alarm
        alarm_create = AlarmCreate(**sample_alarm_data)
        alarm1 = await service.create(alarm_create)

        # Create duplicate with same alarm_id
        alarm2 = await service.create(alarm_create)

        # Should return same alarm with updated count
        assert alarm1.id == alarm2.id
        assert alarm2.occurrence_count == 2
        assert alarm2.last_occurrence > alarm1.last_occurrence

    @pytest.mark.asyncio
    async def test_create_alarm_with_customer_info(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_alarm_data: dict,
    ):
        """Test creating alarm with customer information"""
        service = AlarmService(session, test_tenant)
        customer_id = uuid4()

        alarm_data = {
            **sample_alarm_data,
            "customer_id": customer_id,
            "customer_name": "Test Customer",
        }

        alarm_create = AlarmCreate(**alarm_data)
        alarm_response = await service.create(alarm_create)

        assert alarm_response.customer_id == customer_id
        assert alarm_response.customer_name == "Test Customer"

    @pytest.mark.asyncio
    async def test_create_alarm_during_maintenance_suppressed(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_alarm_data: dict,
    ):
        """Test alarm created during maintenance window is suppressed"""
        service = AlarmService(session, test_tenant)

        # Create maintenance window
        now = datetime.now(timezone.utc)
        maintenance = MaintenanceWindow(
            tenant_id=test_tenant,
            title="Test Maintenance",
            description="Testing",
            start_time=now - timedelta(hours=1),
            end_time=now + timedelta(hours=1),
            status="in_progress",
            affected_resources={"device": ["device-001"]},
            suppress_alarms=True,
        )
        session.add(maintenance)
        await session.commit()

        # Create alarm for resource in maintenance
        alarm_create = AlarmCreate(**sample_alarm_data)
        alarm_response = await service.create(alarm_create)

        # Should be marked as suppressed
        assert alarm_response.status == AlarmStatus.SUPPRESSED


class TestAlarmServiceQueries:
    """Test alarm query functionality"""

    @pytest.mark.asyncio
    async def test_get_alarm_by_id(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_alarm: Alarm,
    ):
        """Test getting alarm by ID"""
        service = AlarmService(session, test_tenant)

        alarm = await service.get(sample_alarm.id)

        assert alarm is not None
        assert alarm.id == sample_alarm.id
        assert alarm.alarm_id == sample_alarm.alarm_id

    @pytest.mark.asyncio
    async def test_get_nonexistent_alarm(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test getting non-existent alarm returns None"""
        service = AlarmService(session, test_tenant)

        alarm = await service.get(uuid4())

        assert alarm is None

    @pytest.mark.asyncio
    async def test_query_alarms_all(
        self,
        session: AsyncSession,
        test_tenant: str,
        multiple_alarms: list[Alarm],
    ):
        """Test querying all alarms"""
        service = AlarmService(session, test_tenant)

        params = AlarmQueryParams(limit=100, offset=0)
        alarms = await service.query(params)

        assert len(alarms) == 4
        # Should be ordered by first_occurrence DESC
        assert alarms[0].alarm_id == "alarm-003"  # Most recent

    @pytest.mark.asyncio
    async def test_query_alarms_by_severity(
        self,
        session: AsyncSession,
        test_tenant: str,
        multiple_alarms: list[Alarm],
    ):
        """Test filtering alarms by severity"""
        service = AlarmService(session, test_tenant)

        params = AlarmQueryParams(
            severity=[AlarmSeverity.CRITICAL],
            limit=100,
            offset=0,
        )
        alarms = await service.query(params)

        assert len(alarms) == 1
        assert alarms[0].severity == AlarmSeverity.CRITICAL

    @pytest.mark.asyncio
    async def test_query_alarms_by_status(
        self,
        session: AsyncSession,
        test_tenant: str,
        multiple_alarms: list[Alarm],
    ):
        """Test filtering alarms by status"""
        service = AlarmService(session, test_tenant)

        params = AlarmQueryParams(
            status=[AlarmStatus.ACTIVE],
            limit=100,
            offset=0,
        )
        alarms = await service.query(params)

        assert len(alarms) == 2
        assert all(a.status == AlarmStatus.ACTIVE for a in alarms)

    @pytest.mark.asyncio
    async def test_query_alarms_by_resource(
        self,
        session: AsyncSession,
        test_tenant: str,
        multiple_alarms: list[Alarm],
    ):
        """Test filtering alarms by resource"""
        service = AlarmService(session, test_tenant)

        params = AlarmQueryParams(
            resource_type="device",
            resource_id="device-001",
            limit=100,
            offset=0,
        )
        alarms = await service.query(params)

        assert len(alarms) == 1
        assert alarms[0].resource_id == "device-001"

    @pytest.mark.asyncio
    async def test_query_alarms_pagination(
        self,
        session: AsyncSession,
        test_tenant: str,
        multiple_alarms: list[Alarm],
    ):
        """Test alarm query pagination"""
        service = AlarmService(session, test_tenant)

        # First page
        params = AlarmQueryParams(limit=2, offset=0)
        page1 = await service.query(params)
        assert len(page1) == 2

        # Second page
        params = AlarmQueryParams(limit=2, offset=2)
        page2 = await service.query(params)
        assert len(page2) == 2

        # Different alarms
        assert page1[0].id != page2[0].id


class TestAlarmServiceUpdates:
    """Test alarm update functionality"""

    @pytest.mark.asyncio
    async def test_acknowledge_alarm(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_alarm: Alarm,
    ):
        """Test acknowledging an alarm"""
        service = AlarmService(session, test_tenant)
        user_id = uuid4()

        alarm = await service.acknowledge(
            sample_alarm.id,
            note="Investigating the issue",
            user_id=user_id,
        )

        assert alarm.status == AlarmStatus.ACKNOWLEDGED
        assert alarm.assigned_to == user_id
        assert alarm.acknowledged_at is not None

        # Verify note was added
        result = await session.execute(
            select(AlarmNote).where(AlarmNote.alarm_id == sample_alarm.id)
        )
        notes = list(result.scalars().all())
        assert len(notes) == 1
        assert notes[0].note == "Investigating the issue"
        assert notes[0].created_by == user_id

    @pytest.mark.asyncio
    async def test_clear_alarm(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_alarm: Alarm,
    ):
        """Test clearing an alarm"""
        service = AlarmService(session, test_tenant)
        user_id = uuid4()

        alarm = await service.clear(sample_alarm.id, user_id=user_id)

        assert alarm.status == AlarmStatus.CLEARED
        assert alarm.cleared_at is not None
        # Note: cleared_by field doesn't exist in the model

    @pytest.mark.asyncio
    async def test_clear_alarm_clears_correlated_children(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_alarm: Alarm,
    ):
        """Test clearing parent alarm also clears correlated children"""
        service = AlarmService(session, test_tenant)

        # Create child alarm
        child_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="child-alarm-001",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.CPE,
            status=AlarmStatus.ACTIVE,
            alarm_type="ont.offline",
            title="ONT Offline",
            resource_type="ont",
            resource_id="ont-001",
            parent_alarm_id=sample_alarm.id,
            correlation_id=sample_alarm.correlation_id,
            first_occurrence=datetime.now(timezone.utc),
            last_occurrence=datetime.now(timezone.utc),
            occurrence_count=1,
        )
        session.add(child_alarm)
        await session.commit()

        # Clear parent
        await service.clear(sample_alarm.id)

        # Verify child is also cleared
        await session.refresh(child_alarm)
        assert child_alarm.status == AlarmStatus.CLEARED

    @pytest.mark.asyncio
    async def test_resolve_alarm(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_alarm: Alarm,
    ):
        """Test resolving an alarm"""
        service = AlarmService(session, test_tenant)
        user_id = uuid4()

        alarm = await service.resolve(
            sample_alarm.id,
            resolution_note="Issue fixed by rebooting device",
            user_id=user_id,
        )

        assert alarm.status == AlarmStatus.CLEARED
        assert alarm.resolved_at is not None

        # Verify resolution note was added
        result = await session.execute(
            select(AlarmNote).where(AlarmNote.alarm_id == sample_alarm.id)
        )
        notes = list(result.scalars().all())
        assert len(notes) == 1
        assert "Issue fixed" in notes[0].note

    @pytest.mark.asyncio
    async def test_update_alarm_fields(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_alarm: Alarm,
    ):
        """Test updating alarm fields"""
        service = AlarmService(session, test_tenant)
        user_id = uuid4()

        update_data = AlarmUpdate(
            severity=AlarmSeverity.MAJOR,
            probable_cause="Network congestion detected",
        )

        alarm = await service.update(sample_alarm.id, update_data, user_id=user_id)

        assert alarm.severity == AlarmSeverity.MAJOR
        assert alarm.probable_cause == "Network congestion detected"

    @pytest.mark.asyncio
    async def test_add_alarm_note(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_alarm: Alarm,
    ):
        """Test adding note to alarm"""
        service = AlarmService(session, test_tenant)
        user_id = uuid4()

        note_create = AlarmNoteCreate(
            note="Checked logs, found network issue",
        )

        await service.add_note(sample_alarm.id, note_create, user_id)

        # Verify note exists
        result = await session.execute(
            select(AlarmNote).where(AlarmNote.alarm_id == sample_alarm.id)
        )
        notes = list(result.scalars().all())
        assert len(notes) == 1
        assert notes[0].note == "Checked logs, found network issue"
        assert notes[0].created_by == user_id


class TestAlarmServiceStatistics:
    """Test alarm statistics functionality"""

    @pytest.mark.asyncio
    async def test_get_statistics_all_time(
        self,
        session: AsyncSession,
        test_tenant: str,
        multiple_alarms: list[Alarm],
    ):
        """Test getting alarm statistics for all time"""
        service = AlarmService(session, test_tenant)

        stats = await service.get_statistics()

        assert stats.total_alarms == 4
        assert stats.active_alarms == 2
        assert stats.acknowledged_alarms == 1
        assert stats.alarms_by_status.get("cleared", 0) == 1

        # Check severity breakdown
        assert stats.alarms_by_severity.get("critical", 0) == 1
        assert stats.alarms_by_severity.get("major", 0) == 2
        assert stats.alarms_by_severity.get("minor", 0) == 1

        # Check source breakdown
        assert stats.alarms_by_source.get("network_device", 0) == 1
        assert stats.alarms_by_source.get("service", 0) == 1
        assert stats.alarms_by_source.get("monitoring", 0) == 1
        assert stats.alarms_by_source.get("cpe", 0) == 1

    @pytest.mark.asyncio
    async def test_get_statistics_date_range(
        self,
        session: AsyncSession,
        test_tenant: str,
        multiple_alarms: list[Alarm],
    ):
        """Test getting alarm statistics for date range"""
        service = AlarmService(session, test_tenant)

        # Last hour only (should get 1-2 alarms depending on timing)
        from_date = datetime.now(timezone.utc) - timedelta(hours=1)
        to_date = datetime.now(timezone.utc)

        stats = await service.get_statistics(from_date, to_date)

        # At least one alarm in the last hour (minor monitoring alarm at 30min ago)
        assert stats.total_alarms >= 1
        assert stats.total_alarms <= 2


class TestAlarmRuleManagement:
    """Test alarm rule CRUD operations"""

    @pytest.mark.asyncio
    async def test_create_correlation_rule(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test creating correlation rule"""
        service = AlarmService(session, test_tenant)
        user_id = uuid4()

        rule_create = AlarmRuleCreate(
            name="Test Correlation Rule",
            rule_type="correlation",
            enabled=True,
            priority=1,
            conditions={
                "parent_alarm_type": "olt.down",
                "child_alarm_type": "ont.offline",
            },
            actions={
                "correlation_action": "correlate",
            },
        )

        rule = await service.create_rule(rule_create, user_id=user_id)

        assert rule.id is not None
        assert rule.name == "Test Correlation Rule"
        assert rule.rule_type == "correlation"
        assert rule.enabled is True

    @pytest.mark.asyncio
    async def test_list_rules(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_correlation_rule: AlarmRule,
    ):
        """Test listing alarm rules"""
        service = AlarmService(session, test_tenant)

        rules = await service.list_rules()

        assert len(rules) >= 1
        assert any(r.id == sample_correlation_rule.id for r in rules)

    @pytest.mark.asyncio
    async def test_update_rule(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_correlation_rule: AlarmRule,
    ):
        """Test updating alarm rule"""
        service = AlarmService(session, test_tenant)
        user_id = uuid4()

        update_data = AlarmRuleUpdate(
            enabled=False,
            priority=5,
        )

        rule = await service.update_rule(
            sample_correlation_rule.id,
            update_data,
            user_id=user_id,
        )

        assert rule.enabled is False
        assert rule.priority == 5

    @pytest.mark.asyncio
    async def test_delete_rule(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_correlation_rule: AlarmRule,
    ):
        """Test deleting alarm rule"""
        service = AlarmService(session, test_tenant)

        deleted = await service.delete_rule(sample_correlation_rule.id)

        assert deleted is True

        # Verify rule is gone
        result = await session.execute(
            select(AlarmRule).where(AlarmRule.id == sample_correlation_rule.id)
        )
        assert result.scalar_one_or_none() is None


class TestMaintenanceWindowManagement:
    """Test maintenance window CRUD operations"""

    @pytest.mark.asyncio
    async def test_create_maintenance_window(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test creating maintenance window"""
        service = AlarmService(session, test_tenant)
        user_id = uuid4()

        now = datetime.now(timezone.utc)
        window_create = MaintenanceWindowCreate(
            title="Network Upgrade",
            description="Upgrading core switches",
            start_time=now + timedelta(days=1),
            end_time=now + timedelta(days=1, hours=4),
            resource_type="device",
            resource_id="switch-001",
            suppress_alarms=True,
        )

        window = await service.create_maintenance_window(window_create, user_id=user_id)

        assert window.id is not None
        assert window.title == "Network Upgrade"
        assert window.status == "scheduled"
        assert window.suppress_alarms is True

    @pytest.mark.asyncio
    async def test_update_maintenance_window(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test updating maintenance window"""
        service = AlarmService(session, test_tenant)

        # Create window first
        now = datetime.now(timezone.utc)
        window_create = MaintenanceWindowCreate(
            title="Test Maintenance",
            start_time=now + timedelta(days=1),
            end_time=now + timedelta(days=1, hours=2),
        )
        window = await service.create_maintenance_window(window_create)

        # Update it
        from dotmac.platform.fault_management.schemas import MaintenanceWindowUpdate

        update_data = MaintenanceWindowUpdate(
            status="cancelled",
        )

        updated = await service.update_maintenance_window(window.id, update_data)

        assert updated.status == "cancelled"
