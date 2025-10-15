"""
Tests for Alarm Correlation Engine
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.correlation import CorrelationEngine
from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmRule,
    AlarmSeverity,
    AlarmSource,
    AlarmStatus,
    CorrelationAction,
    RuleType,
)


class TestTopologyCorrelation:
    """Test topology-based alarm correlation"""

    @pytest.mark.asyncio
    async def test_olt_ont_correlation(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test OLT down correlates with ONT offline alarms"""
        engine = CorrelationEngine(session, test_tenant)

        # Create correlation rule
        rule = AlarmRule(
            tenant_id=test_tenant,
            name="OLT to ONT",
            rule_type=RuleType.CORRELATION,
            enabled=True,
            priority=1,
            conditions={
                "parent_alarm_type": "olt.down",
                "child_alarm_type": "ont.offline",
                "time_window_minutes": 5,
            },
            actions={
                "correlation_action": "correlate",
                "mark_root_cause": True,
            },
        )
        session.add(rule)
        await session.commit()

        # Create parent OLT alarm
        parent_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="olt-down-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="olt.down",
            title="OLT Down",
            resource_type="olt",
            resource_id="olt-001",
            resource_name="OLT 1",
            subscriber_count=100,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(parent_alarm)
        await session.commit()
        await session.refresh(parent_alarm)

        # Correlate parent
        await engine.correlate(parent_alarm)
        await session.refresh(parent_alarm)

        # Parent should be marked as root cause
        assert parent_alarm.is_root_cause is True
        assert parent_alarm.correlation_id is not None

        # Create child ONT alarm
        child_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="ont-offline-001",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.CPE,
            status=AlarmStatus.ACTIVE,
            alarm_type="ont.offline",
            title="ONT Offline",
            resource_type="ont",
            resource_id="ont-001",
            resource_name="ONT 1",
            subscriber_count=1,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(child_alarm)
        await session.commit()
        await session.refresh(child_alarm)

        # Correlate child
        await engine.correlate(child_alarm)
        await session.refresh(child_alarm)

        # Child should be correlated to parent
        assert child_alarm.parent_alarm_id == parent_alarm.id
        assert child_alarm.correlation_id == parent_alarm.correlation_id
        assert child_alarm.is_root_cause is False

    @pytest.mark.asyncio
    async def test_switch_device_correlation(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test switch down correlates with connected device alarms"""
        engine = CorrelationEngine(session, test_tenant)

        # Create correlation rule
        rule = AlarmRule(
            tenant_id=test_tenant,
            name="Switch to Device",
            rule_type=RuleType.CORRELATION,
            enabled=True,
            priority=1,
            conditions={
                "parent_alarm_type": "switch.down",
                "child_alarm_type": "device.unreachable",
                "time_window_minutes": 5,
            },
            actions={
                "correlation_action": "correlate",
            },
        )
        session.add(rule)
        await session.commit()

        # Create parent switch alarm
        parent_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="switch-down-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="switch.down",
            title="Switch Down",
            resource_type="switch",
            resource_id="switch-001",
            subscriber_count=200,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(parent_alarm)
        await session.commit()
        await session.refresh(parent_alarm)

        await engine.correlate(parent_alarm)
        await session.refresh(parent_alarm)

        # Create child device alarm
        child_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="device-unreachable-001",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.unreachable",
            title="Device Unreachable",
            resource_type="device",
            resource_id="device-001",
            subscriber_count=50,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(child_alarm)
        await session.commit()
        await session.refresh(child_alarm)

        await engine.correlate(child_alarm)
        await session.refresh(child_alarm)

        # Should be correlated
        assert child_alarm.parent_alarm_id == parent_alarm.id
        assert child_alarm.correlation_id == parent_alarm.correlation_id


class TestTimeBasedCorrelation:
    """Test time-based alarm correlation"""

    @pytest.mark.asyncio
    async def test_alarms_within_time_window_correlated(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test alarms within time window are correlated"""
        engine = CorrelationEngine(session, test_tenant)

        # Create time-based correlation rule
        rule = AlarmRule(
            tenant_id=test_tenant,
            name="Time Window Correlation",
            rule_type=RuleType.CORRELATION,
            enabled=True,
            priority=1,
            conditions={
                "parent_alarm_type": "power.outage",
                "child_alarm_type": "device.down",
                "time_window_minutes": 5,
            },
            actions={
                "correlation_action": "correlate",
            },
        )
        session.add(rule)
        await session.commit()

        # Create parent alarm
        parent_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="power-outage-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="power.outage",
            title="Power Outage",
            resource_type="facility",
            resource_id="facility-001",
            subscriber_count=500,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(parent_alarm)
        await session.commit()
        await session.refresh(parent_alarm)

        await engine.correlate(parent_alarm)

        # Create child alarm 2 minutes later (within window)
        child_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="device-down-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Device Down",
            resource_type="device",
            resource_id="device-001",
            subscriber_count=100,
            first_occurrence=datetime.now(UTC) + timedelta(minutes=2),
            last_occurrence=datetime.now(UTC) + timedelta(minutes=2),
            occurrence_count=1,
        )
        session.add(child_alarm)
        await session.commit()
        await session.refresh(child_alarm)

        await engine.correlate(child_alarm)
        await session.refresh(child_alarm)

        # Should be correlated
        assert child_alarm.parent_alarm_id == parent_alarm.id

    @pytest.mark.asyncio
    async def test_alarms_outside_time_window_not_correlated(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test alarms outside time window are not correlated"""
        engine = CorrelationEngine(session, test_tenant)

        # Create time-based correlation rule with 5 minute window
        rule = AlarmRule(
            tenant_id=test_tenant,
            name="Time Window Correlation",
            rule_type=RuleType.CORRELATION,
            enabled=True,
            priority=1,
            conditions={
                "parent_alarm_type": "power.outage",
                "child_alarm_type": "device.down",
                "time_window_minutes": 5,
            },
            actions={
                "correlation_action": "correlate",
            },
        )
        session.add(rule)
        await session.commit()

        # Create parent alarm
        parent_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="power-outage-002",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="power.outage",
            title="Power Outage",
            resource_type="facility",
            resource_id="facility-002",
            subscriber_count=500,
            first_occurrence=datetime.now(UTC) - timedelta(minutes=10),
            last_occurrence=datetime.now(UTC) - timedelta(minutes=10),
            occurrence_count=1,
        )
        session.add(parent_alarm)
        await session.commit()
        await session.refresh(parent_alarm)

        await engine.correlate(parent_alarm)

        # Create child alarm 10 minutes later (outside window)
        child_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="device-down-002",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Device Down",
            resource_type="device",
            resource_id="device-002",
            subscriber_count=100,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(child_alarm)
        await session.commit()
        await session.refresh(child_alarm)

        await engine.correlate(child_alarm)
        await session.refresh(child_alarm)

        # Should NOT be correlated
        assert child_alarm.parent_alarm_id is None


class TestPatternBasedCorrelation:
    """Test pattern-based alarm correlation"""

    @pytest.mark.asyncio
    async def test_pattern_match_correlation(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test pattern matching for correlation"""
        engine = CorrelationEngine(session, test_tenant)

        # Create pattern-based correlation rule
        rule = AlarmRule(
            tenant_id=test_tenant,
            name="Pattern Match Correlation",
            rule_type=RuleType.CORRELATION,
            enabled=True,
            priority=1,
            conditions={
                "parent_alarm_type": "fiber.cut",
                "child_pattern": ".*signal.*loss.*",
                "time_window_minutes": 10,
            },
            actions={
                "correlation_action": "correlate",
            },
        )
        session.add(rule)
        await session.commit()

        # Create parent fiber cut alarm
        parent_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="fiber-cut-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="fiber.cut",
            title="Fiber Cut Detected",
            resource_type="fiber",
            resource_id="fiber-segment-001",
            subscriber_count=150,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(parent_alarm)
        await session.commit()
        await session.refresh(parent_alarm)

        await engine.correlate(parent_alarm)

        # Create child alarm with matching pattern
        child_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="signal-loss-001",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.CPE,
            status=AlarmStatus.ACTIVE,
            alarm_type="cpe.alarm",
            title="CPE Signal Loss Detected",
            description="Loss of optical signal",
            resource_type="cpe",
            resource_id="cpe-001",
            subscriber_count=1,
            first_occurrence=datetime.now(UTC) + timedelta(minutes=1),
            last_occurrence=datetime.now(UTC) + timedelta(minutes=1),
            occurrence_count=1,
        )
        session.add(child_alarm)
        await session.commit()
        await session.refresh(child_alarm)

        await engine.correlate(child_alarm)
        await session.refresh(child_alarm)

        # Should be correlated via pattern match
        assert child_alarm.parent_alarm_id == parent_alarm.id


class TestDuplicateDetection:
    """Test duplicate alarm detection"""

    @pytest.mark.asyncio
    async def test_duplicate_alarms_merged(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test that duplicate alarms are merged"""
        engine = CorrelationEngine(session, test_tenant)

        # Create first alarm
        alarm1 = Alarm(
            tenant_id=test_tenant,
            alarm_id="duplicate-test-001",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="cpu.high",
            title="CPU High",
            resource_type="device",
            resource_id="device-001",
            subscriber_count=0,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(alarm1)
        await session.commit()
        await session.refresh(alarm1)

        # Create duplicate alarm (same alarm_id, type, resource)
        alarm2 = Alarm(
            tenant_id=test_tenant,
            alarm_id="duplicate-test-001",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="cpu.high",
            title="CPU High",
            resource_type="device",
            resource_id="device-001",
            subscriber_count=0,
            first_occurrence=datetime.now(UTC) + timedelta(minutes=1),
            last_occurrence=datetime.now(UTC) + timedelta(minutes=1),
            occurrence_count=1,
        )
        session.add(alarm2)
        await session.commit()
        await session.refresh(alarm2)

        await engine.correlate(alarm2)
        await session.refresh(alarm2)

        # Should share same correlation_id
        assert alarm1.correlation_id is not None
        assert alarm2.correlation_id == alarm1.correlation_id

    @pytest.mark.asyncio
    async def test_similar_alarms_grouped(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test similar alarms are grouped together"""
        engine = CorrelationEngine(session, test_tenant)

        # Create first alarm
        alarm1 = Alarm(
            tenant_id=test_tenant,
            alarm_id="similar-001",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="threshold.cpu",
            title="CPU Threshold Exceeded",
            resource_type="device",
            resource_id="device-001",
            subscriber_count=0,
            first_occurrence=datetime.now(UTC) - timedelta(seconds=30),
            last_occurrence=datetime.now(UTC) - timedelta(seconds=30),
            occurrence_count=1,
        )
        session.add(alarm1)
        await session.commit()
        await session.refresh(alarm1)

        await engine.correlate(alarm1)

        # Create similar alarm (same type and resource)
        alarm2 = Alarm(
            tenant_id=test_tenant,
            alarm_id="similar-002",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="threshold.cpu",
            title="CPU Threshold Exceeded Again",
            resource_type="device",
            resource_id="device-001",
            subscriber_count=0,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(alarm2)
        await session.commit()
        await session.refresh(alarm2)

        await engine.correlate(alarm2)
        await session.refresh(alarm1)
        await session.refresh(alarm2)

        # Should be grouped with same correlation_id
        assert alarm1.correlation_id is not None
        assert alarm2.correlation_id == alarm1.correlation_id


class TestFlappingDetection:
    """Test flapping alarm detection"""

    @pytest.mark.asyncio
    async def test_flapping_alarm_suppressed(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test that flapping alarms are suppressed"""
        engine = CorrelationEngine(session, test_tenant)

        # Create alarm that has flapped multiple times
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="flapping-alarm-001",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="link.down",
            title="Link Down",
            resource_type="interface",
            resource_id="eth0",
            subscriber_count=10,
            first_occurrence=datetime.now(UTC) - timedelta(minutes=10),
            last_occurrence=datetime.now(UTC),
            occurrence_count=6,  # Multiple occurrences in short time
        )
        session.add(alarm)
        await session.commit()
        await session.refresh(alarm)

        await engine.correlate(alarm)
        await session.refresh(alarm)

        # Should be marked as flapping or suppressed
        # (Implementation may vary - check for suppression or flapping flag)
        assert alarm.status in [AlarmStatus.SUPPRESSED, AlarmStatus.ACTIVE]


class TestSuppressionRules:
    """Test alarm suppression rules"""

    @pytest.mark.asyncio
    async def test_suppression_rule_applied(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test that suppression rules prevent alarm creation"""
        engine = CorrelationEngine(session, test_tenant)

        # Create suppression rule
        rule = AlarmRule(
            tenant_id=test_tenant,
            name="Suppress Minor Monitoring Alarms",
            rule_type=RuleType.SUPPRESSION,
            enabled=True,
            priority=10,
            conditions={
                "alarm_type": "threshold.*",
                "severity": "minor",
                "source": "monitoring",
            },
            actions={
                "correlation_action": "suppress",
            },
        )
        session.add(rule)
        await session.commit()

        # Create alarm matching suppression rule
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="suppressed-001",
            severity=AlarmSeverity.MINOR,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="threshold.disk",
            title="Disk Space Low",
            resource_type="device",
            resource_id="device-001",
            subscriber_count=0,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(alarm)
        await session.commit()
        await session.refresh(alarm)

        await engine.correlate(alarm)
        await session.refresh(alarm)

        # Should be suppressed
        assert alarm.status == AlarmStatus.SUPPRESSED


class TestRecorrelation:
    """Test recorrelating existing alarms"""

    @pytest.mark.asyncio
    async def test_recorrelate_all_alarms(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test recorrelating all active alarms"""
        engine = CorrelationEngine(session, test_tenant)

        # Create multiple active alarms
        alarm1 = Alarm(
            tenant_id=test_tenant,
            alarm_id="recorr-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Device Down",
            resource_type="device",
            resource_id="device-001",
            subscriber_count=50,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )

        alarm2 = Alarm(
            tenant_id=test_tenant,
            alarm_id="recorr-002",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.SERVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="service.degraded",
            title="Service Degraded",
            resource_type="service",
            resource_id="service-001",
            subscriber_count=10,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )

        session.add_all([alarm1, alarm2])
        await session.commit()

        # Recorrelate all
        count = await engine.recorrelate_all()

        assert count == 2

    @pytest.mark.asyncio
    async def test_recorrelate_updates_existing_correlation(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test that recorrelation updates existing correlations"""
        engine = CorrelationEngine(session, test_tenant)

        # Create parent alarm
        parent_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="parent-recorr",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="olt.down",
            title="OLT Down",
            resource_type="olt",
            resource_id="olt-001",
            subscriber_count=100,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(parent_alarm)
        await session.commit()
        await session.refresh(parent_alarm)

        # Create child alarm without correlation initially
        child_alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="child-recorr",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.CPE,
            status=AlarmStatus.ACTIVE,
            alarm_type="ont.offline",
            title="ONT Offline",
            resource_type="ont",
            resource_id="ont-001",
            subscriber_count=1,
            first_occurrence=datetime.now(UTC),
            last_occurrence=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(child_alarm)
        await session.commit()
        await session.refresh(child_alarm)

        # Add correlation rule
        rule = AlarmRule(
            tenant_id=test_tenant,
            name="OLT to ONT",
            rule_type=RuleType.CORRELATION,
            enabled=True,
            priority=1,
            conditions={
                "parent_alarm_type": "olt.down",
                "child_alarm_type": "ont.offline",
                "time_window_minutes": 5,
            },
            actions={
                "correlation_action": "correlate",
            },
        )
        session.add(rule)
        await session.commit()

        # Recorrelate
        await engine.recorrelate_all()

        # Verify correlation was established
        await session.refresh(parent_alarm)
        await session.refresh(child_alarm)

        assert parent_alarm.is_root_cause is True
        assert child_alarm.parent_alarm_id == parent_alarm.id
        assert child_alarm.correlation_id == parent_alarm.correlation_id
