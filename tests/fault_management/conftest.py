"""
Test fixtures for fault management tests
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmRule,
    AlarmSeverity,
    AlarmSource,
    AlarmStatus,
    SLADefinition,
    SLAInstance,
    SLAStatus,
)


@pytest.fixture
def sample_alarm_data():
    """Sample alarm creation data"""
    return {
        "alarm_id": "test-alarm-001",
        "severity": AlarmSeverity.CRITICAL,
        "source": AlarmSource.NETWORK_DEVICE,
        "alarm_type": "device.down",
        "title": "Test Device Down",
        "description": "Test device is not responding",
        "resource_type": "device",
        "resource_id": "device-001",
        "resource_name": "Test Device",
        "subscriber_count": 10,
        "probable_cause": "Network connectivity issue",
        "recommended_action": "Check device connectivity",
    }


@pytest.fixture
async def sample_alarm(session: AsyncSession, test_tenant: str) -> Alarm:
    """Create sample alarm in database"""
    alarm = Alarm(
        tenant_id=test_tenant,
        alarm_id="test-alarm-001",
        severity=AlarmSeverity.CRITICAL,
        source=AlarmSource.NETWORK_DEVICE,
        status=AlarmStatus.ACTIVE,
        alarm_type="device.down",
        title="Test Device Down",
        description="Test device is not responding",
        resource_type="device",
        resource_id="device-001",
        resource_name="Test Device",
        subscriber_count=10,
        first_occurrence=datetime.now(UTC),
        last_occurrence=datetime.now(UTC),
        occurrence_count=1,
    )
    session.add(alarm)
    await session.commit()
    await session.refresh(alarm)
    return alarm


@pytest.fixture
async def sample_correlation_rule(session: AsyncSession, test_tenant: str) -> AlarmRule:
    """Create sample correlation rule"""
    rule = AlarmRule(
        tenant_id=test_tenant,
        name="OLT to ONT Correlation",
        rule_type="correlation",
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
    await session.refresh(rule)
    return rule


@pytest.fixture
async def sample_sla_definition(session: AsyncSession, test_tenant: str) -> SLADefinition:
    """Create sample SLA definition"""
    definition = SLADefinition(
        tenant_id=test_tenant,
        name="Enterprise SLA",
        description="99.9% uptime guarantee",
        service_level="enterprise",
        availability_target=99.9,
        response_time_target=60,
        resolution_time_target=240,
    )
    session.add(definition)
    await session.commit()
    await session.refresh(definition)
    return definition


@pytest.fixture
async def sample_sla_instance(
    session: AsyncSession,
    test_tenant: str,
    sample_sla_definition: SLADefinition,
) -> SLAInstance:
    """Create sample SLA instance"""
    customer_id = uuid4()

    instance = SLAInstance(
        tenant_id=test_tenant,
        sla_definition_id=sample_sla_definition.id,
        customer_id=customer_id,
        customer_name="Test Customer",
        service_id=uuid4(),
        service_name="Internet 100Mbps",
        status=SLAStatus.COMPLIANT,
        enabled=True,
        start_date=datetime.now(UTC),
        current_availability=99.95,
        total_downtime=0,
        unplanned_downtime=0,
        planned_downtime=0,
    )
    session.add(instance)
    await session.commit()
    await session.refresh(instance)
    return instance


@pytest.fixture
async def multiple_alarms(session: AsyncSession, test_tenant: str) -> list[Alarm]:
    """Create multiple alarms for testing queries"""
    alarms = [
        # Critical device alarm
        Alarm(
            tenant_id=test_tenant,
            alarm_id="alarm-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.NETWORK_DEVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="device.down",
            title="Device 1 Down",
            resource_type="device",
            resource_id="device-001",
            resource_name="Device 1",
            subscriber_count=50,
            first_occurrence=datetime.now(UTC) - timedelta(hours=2),
            last_occurrence=datetime.now(UTC) - timedelta(hours=2),
            occurrence_count=1,
        ),
        # Major service alarm
        Alarm(
            tenant_id=test_tenant,
            alarm_id="alarm-002",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.SERVICE,
            status=AlarmStatus.ACKNOWLEDGED,
            alarm_type="service.degraded",
            title="Service Degraded",
            resource_type="service",
            resource_id="service-001",
            resource_name="Service 1",
            subscriber_count=10,
            first_occurrence=datetime.now(UTC) - timedelta(hours=1),
            last_occurrence=datetime.now(UTC) - timedelta(hours=1),
            occurrence_count=1,
        ),
        # Minor monitoring alarm
        Alarm(
            tenant_id=test_tenant,
            alarm_id="alarm-003",
            severity=AlarmSeverity.MINOR,
            source=AlarmSource.MONITORING,
            status=AlarmStatus.ACTIVE,
            alarm_type="threshold.cpu",
            title="CPU High",
            resource_type="device",
            resource_id="device-002",
            resource_name="Device 2",
            subscriber_count=0,
            first_occurrence=datetime.now(UTC) - timedelta(minutes=30),
            last_occurrence=datetime.now(UTC) - timedelta(minutes=30),
            occurrence_count=1,
        ),
        # Cleared alarm
        Alarm(
            tenant_id=test_tenant,
            alarm_id="alarm-004",
            severity=AlarmSeverity.MAJOR,
            source=AlarmSource.CPE,
            status=AlarmStatus.CLEARED,
            alarm_type="cpe.offline",
            title="CPE Offline",
            resource_type="cpe",
            resource_id="cpe-001",
            resource_name="CPE 1",
            subscriber_count=1,
            first_occurrence=datetime.now(UTC) - timedelta(days=1),
            last_occurrence=datetime.now(UTC) - timedelta(days=1),
            cleared_at=datetime.now(UTC) - timedelta(hours=12),
            occurrence_count=1,
        ),
    ]

    for alarm in alarms:
        session.add(alarm)

    await session.commit()

    for alarm in alarms:
        await session.refresh(alarm)

    return alarms


@pytest.fixture
def test_tenant() -> str:
    """Test tenant ID"""
    return "test-tenant-001"
