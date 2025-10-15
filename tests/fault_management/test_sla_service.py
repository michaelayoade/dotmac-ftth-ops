"""
Tests for SLA Monitoring Service
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmSeverity,
    AlarmSource,
    AlarmStatus,
    SLABreach,
    SLADefinition,
    SLADowntime,
    SLAInstance,
    SLAStatus,
)
from dotmac.platform.fault_management.schemas import (
    SLADefinitionCreate,
    SLADefinitionUpdate,
    SLAInstanceCreate,
)
from dotmac.platform.fault_management.sla_service import SLAMonitoringService


class TestSLADefinitionManagement:
    """Test SLA definition CRUD operations"""

    @pytest.mark.asyncio
    async def test_create_sla_definition(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """Test creating SLA definition"""
        service = SLAMonitoringService(session, test_tenant)
        user_id = uuid4()

        definition_create = SLADefinitionCreate(
            name="Business SLA",
            description="99.5% uptime for business customers",
            service_level="business",
            availability_target=99.5,
            response_time_target=120,
            resolution_time_target=480,
        )

        definition = await service.create_definition(definition_create, user_id=user_id)

        assert definition.id is not None
        assert definition.name == "Business SLA"
        assert definition.availability_target == 99.5
        assert definition.response_time_target == 120
        assert definition.resolution_time_target == 480

    @pytest.mark.asyncio
    async def test_list_sla_definitions(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_definition: SLADefinition,
    ):
        """Test listing SLA definitions"""
        service = SLAMonitoringService(session, test_tenant)

        definitions = await service.list_definitions()

        assert len(definitions) >= 1
        assert any(d.id == sample_sla_definition.id for d in definitions)

    @pytest.mark.asyncio
    async def test_update_sla_definition(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_definition: SLADefinition,
    ):
        """Test updating SLA definition"""
        service = SLAMonitoringService(session, test_tenant)

        update_data = SLADefinitionUpdate(
            availability_target=99.95,
            response_time_target=30,
        )

        definition = await service.update_definition(
            sample_sla_definition.id,
            update_data,
        )

        assert definition.availability_target == 99.95
        assert definition.response_time_target == 30


class TestSLAInstanceManagement:
    """Test SLA instance CRUD operations"""

    @pytest.mark.asyncio
    async def test_create_sla_instance(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_definition: SLADefinition,
    ):
        """Test creating SLA instance for customer"""
        service = SLAMonitoringService(session, test_tenant)
        user_id = uuid4()
        customer_id = uuid4()
        service_id = uuid4()

        instance_create = SLAInstanceCreate(
            sla_definition_id=sample_sla_definition.id,
            customer_id=customer_id,
            customer_name="Acme Corp",
            service_id=service_id,
            service_name="Fiber 1Gbps",
            start_date=datetime.now(UTC),
        )

        instance = await service.create_instance(instance_create, user_id=user_id)

        assert instance.id is not None
        assert instance.customer_id == customer_id
        assert instance.customer_name == "Acme Corp"
        assert instance.status == SLAStatus.COMPLIANT
        assert instance.enabled is True
        assert instance.current_availability == 100.0

    @pytest.mark.asyncio
    async def test_get_sla_instance(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test getting SLA instance by ID"""
        service = SLAMonitoringService(session, test_tenant)

        instance = await service.get_instance(sample_sla_instance.id)

        assert instance is not None
        assert instance.id == sample_sla_instance.id

    @pytest.mark.asyncio
    async def test_list_sla_instances_all(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test listing all SLA instances"""
        service = SLAMonitoringService(session, test_tenant)

        instances = await service.list_instances()

        assert len(instances) >= 1
        assert any(i.id == sample_sla_instance.id for i in instances)

    @pytest.mark.asyncio
    async def test_list_sla_instances_by_customer(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test filtering SLA instances by customer"""
        service = SLAMonitoringService(session, test_tenant)

        instances = await service.list_instances(
            customer_id=sample_sla_instance.customer_id
        )

        assert len(instances) >= 1
        assert all(i.customer_id == sample_sla_instance.customer_id for i in instances)

    @pytest.mark.asyncio
    async def test_list_sla_instances_by_status(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test filtering SLA instances by status"""
        service = SLAMonitoringService(session, test_tenant)

        instances = await service.list_instances(status=SLAStatus.COMPLIANT)

        assert len(instances) >= 1
        assert all(i.status == SLAStatus.COMPLIANT for i in instances)


class TestDowntimeTracking:
    """Test downtime recording and tracking"""

    @pytest.mark.asyncio
    async def test_record_downtime_unplanned(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test recording unplanned downtime"""
        service = SLAMonitoringService(session, test_tenant)

        initial_downtime = sample_sla_instance.total_downtime

        await service.record_downtime(
            sample_sla_instance.id,
            downtime_minutes=30,
            is_planned=False,
        )

        # Refresh instance
        await session.refresh(sample_sla_instance)

        assert sample_sla_instance.total_downtime == initial_downtime + 30
        assert sample_sla_instance.unplanned_downtime == 30
        assert sample_sla_instance.current_availability < 100.0

    @pytest.mark.asyncio
    async def test_record_downtime_planned(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test recording planned downtime"""
        service = SLAMonitoringService(session, test_tenant)

        await service.record_downtime(
            sample_sla_instance.id,
            downtime_minutes=60,
            is_planned=True,
        )

        # Refresh instance
        await session.refresh(sample_sla_instance)

        assert sample_sla_instance.total_downtime == 60
        assert sample_sla_instance.planned_downtime == 60
        assert sample_sla_instance.unplanned_downtime == 0
        # Availability should still be 100% for planned downtime
        assert sample_sla_instance.current_availability == 100.0

    @pytest.mark.asyncio
    async def test_record_downtime_creates_record(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test that downtime recording creates SLADowntime record"""
        service = SLAMonitoringService(session, test_tenant)

        start_time = datetime.now(UTC)
        await service.record_downtime(
            sample_sla_instance.id,
            downtime_minutes=45,
            is_planned=False,
        )

        # Verify SLADowntime record exists
        result = await session.execute(
            select(SLADowntime).where(
                SLADowntime.sla_instance_id == sample_sla_instance.id
            )
        )
        downtime_records = list(result.scalars().all())

        assert len(downtime_records) == 1
        assert downtime_records[0].duration_minutes == 45
        assert downtime_records[0].is_planned is False


class TestAvailabilityCalculation:
    """Test SLA availability calculation"""

    @pytest.mark.asyncio
    async def test_calculate_availability_no_downtime(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test availability calculation with no downtime"""
        service = SLAMonitoringService(session, test_tenant)

        await service._calculate_availability(sample_sla_instance)

        assert sample_sla_instance.current_availability == 100.0

    @pytest.mark.asyncio
    async def test_calculate_availability_with_downtime(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_definition: SLADefinition,
    ):
        """Test availability calculation with downtime"""
        service = SLAMonitoringService(session, test_tenant)

        # Create instance that started 30 days ago
        start_date = datetime.now(UTC) - timedelta(days=30)
        instance = SLAInstance(
            tenant_id=test_tenant,
            sla_definition_id=sample_sla_definition.id,
            customer_id=uuid4(),
            customer_name="Test Customer",
            service_id=uuid4(),
            service_name="Test Service",
            status=SLAStatus.COMPLIANT,
            enabled=True,
            start_date=start_date,
            current_availability=100.0,
            total_downtime=0,
            unplanned_downtime=0,
            planned_downtime=0,
        )
        session.add(instance)
        await session.commit()
        await session.refresh(instance)

        # Record 1 hour of unplanned downtime (60 minutes)
        instance.unplanned_downtime = 60
        instance.total_downtime = 60

        await service._calculate_availability(instance)

        # 30 days = 43,200 minutes
        # 60 minutes downtime = 99.86% availability
        assert instance.current_availability < 100.0
        assert instance.current_availability > 99.5

    @pytest.mark.asyncio
    async def test_calculate_availability_excludes_planned(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_definition: SLADefinition,
    ):
        """Test that planned downtime doesn't affect availability"""
        service = SLAMonitoringService(session, test_tenant)

        # Create instance that started 7 days ago
        start_date = datetime.now(UTC) - timedelta(days=7)
        instance = SLAInstance(
            tenant_id=test_tenant,
            sla_definition_id=sample_sla_definition.id,
            customer_id=uuid4(),
            customer_name="Test Customer",
            service_id=uuid4(),
            service_name="Test Service",
            status=SLAStatus.COMPLIANT,
            enabled=True,
            start_date=start_date,
            current_availability=100.0,
            total_downtime=120,  # 2 hours total
            unplanned_downtime=0,  # But all planned
            planned_downtime=120,
        )
        session.add(instance)
        await session.commit()
        await session.refresh(instance)

        await service._calculate_availability(instance)

        # Should still be 100% since all downtime was planned
        assert instance.current_availability == 100.0


class TestBreachDetection:
    """Test SLA breach detection"""

    @pytest.mark.asyncio
    async def test_availability_breach_detected(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_definition: SLADefinition,
    ):
        """Test that availability breach is detected"""
        service = SLAMonitoringService(session, test_tenant)

        # Create instance with 99.9% target but only 99.0% availability
        start_date = datetime.now(UTC) - timedelta(days=30)
        instance = SLAInstance(
            tenant_id=test_tenant,
            sla_definition_id=sample_sla_definition.id,
            customer_id=uuid4(),
            customer_name="Test Customer",
            service_id=uuid4(),
            service_name="Test Service",
            status=SLAStatus.COMPLIANT,
            enabled=True,
            start_date=start_date,
            current_availability=99.0,  # Below target
            total_downtime=432,  # ~1% downtime
            unplanned_downtime=432,
            planned_downtime=0,
        )
        session.add(instance)
        await session.commit()
        await session.refresh(instance)

        await service._check_availability_breach(instance)

        # Should be marked as breached
        assert instance.status == SLAStatus.BREACHED

        # Should have breach record
        result = await session.execute(
            select(SLABreach).where(SLABreach.sla_instance_id == instance.id)
        )
        breaches = list(result.scalars().all())
        assert len(breaches) == 1
        assert breaches[0].breach_type == "availability"
        assert breaches[0].resolved is False

    @pytest.mark.asyncio
    async def test_no_breach_when_within_target(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test no breach when availability is within target"""
        service = SLAMonitoringService(session, test_tenant)

        # Instance has 99.95% availability, target is 99.9%
        sample_sla_instance.current_availability = 99.95

        await service._check_availability_breach(sample_sla_instance)

        # Should remain compliant
        assert sample_sla_instance.status == SLAStatus.COMPLIANT

        # Should have no breaches
        result = await session.execute(
            select(SLABreach).where(
                SLABreach.sla_instance_id == sample_sla_instance.id
            )
        )
        breaches = list(result.scalars().all())
        assert len(breaches) == 0

    @pytest.mark.asyncio
    async def test_breach_not_duplicated(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_definition: SLADefinition,
    ):
        """Test that breach is not created multiple times"""
        service = SLAMonitoringService(session, test_tenant)

        # Create instance with low availability
        start_date = datetime.now(UTC) - timedelta(days=7)
        instance = SLAInstance(
            tenant_id=test_tenant,
            sla_definition_id=sample_sla_definition.id,
            customer_id=uuid4(),
            customer_name="Test Customer",
            service_id=uuid4(),
            service_name="Test Service",
            status=SLAStatus.COMPLIANT,
            enabled=True,
            start_date=start_date,
            current_availability=98.0,
            total_downtime=200,
            unplanned_downtime=200,
            planned_downtime=0,
        )
        session.add(instance)
        await session.commit()
        await session.refresh(instance)

        # Check breach twice
        await service._check_availability_breach(instance)
        await service._check_availability_breach(instance)

        # Should only have one breach
        result = await session.execute(
            select(SLABreach).where(SLABreach.sla_instance_id == instance.id)
        )
        breaches = list(result.scalars().all())
        assert len(breaches) == 1


class TestAlarmImpact:
    """Test checking alarm impact on SLA"""

    @pytest.mark.asyncio
    async def test_alarm_impact_records_downtime(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test that service alarm records downtime"""
        service = SLAMonitoringService(session, test_tenant)

        # Create service outage alarm
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="service-outage-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.SERVICE,
            status=AlarmStatus.ACTIVE,
            alarm_type="service.outage",
            title="Service Outage",
            resource_type="service",
            resource_id=str(sample_sla_instance.service_id),
            customer_id=sample_sla_instance.customer_id,
            subscriber_count=1,
            first_occurrence=datetime.now(UTC) - timedelta(minutes=30),
            last_occurrence=datetime.now(UTC) - timedelta(minutes=30),
            cleared_at=datetime.now(UTC),  # Cleared now (30 min downtime)
            occurrence_count=1,
        )
        session.add(alarm)
        await session.commit()
        await session.refresh(alarm)

        await service.check_alarm_impact(alarm)

        # Should have recorded downtime
        await session.refresh(sample_sla_instance)
        assert sample_sla_instance.total_downtime >= 30

    @pytest.mark.asyncio
    async def test_alarm_impact_ignores_unrelated_alarm(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test that unrelated alarms don't affect SLA"""
        service = SLAMonitoringService(session, test_tenant)

        # Create alarm for different customer
        alarm = Alarm(
            tenant_id=test_tenant,
            alarm_id="other-alarm-001",
            severity=AlarmSeverity.CRITICAL,
            source=AlarmSource.SERVICE,
            status=AlarmStatus.CLEARED,
            alarm_type="service.outage",
            title="Other Service Outage",
            resource_type="service",
            resource_id="other-service",
            customer_id=uuid4(),  # Different customer
            subscriber_count=1,
            first_occurrence=datetime.now(UTC) - timedelta(hours=1),
            last_occurrence=datetime.now(UTC) - timedelta(hours=1),
            cleared_at=datetime.now(UTC),
            occurrence_count=1,
        )
        session.add(alarm)
        await session.commit()
        await session.refresh(alarm)

        initial_downtime = sample_sla_instance.total_downtime

        await service.check_alarm_impact(alarm)

        # Should not have affected this instance
        await session.refresh(sample_sla_instance)
        assert sample_sla_instance.total_downtime == initial_downtime


class TestComplianceReporting:
    """Test SLA compliance reporting"""

    @pytest.mark.asyncio
    async def test_get_compliance_report_all_customers(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test generating compliance report for all customers"""
        service = SLAMonitoringService(session, test_tenant)

        report = await service.get_compliance_report()

        assert report.total_instances >= 1
        assert report.compliant_instances >= 1
        assert report.overall_compliance_rate <= 100.0

    @pytest.mark.asyncio
    async def test_get_compliance_report_specific_customer(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_instance: SLAInstance,
    ):
        """Test generating compliance report for specific customer"""
        service = SLAMonitoringService(session, test_tenant)

        report = await service.get_compliance_report(
            customer_id=sample_sla_instance.customer_id
        )

        assert report.total_instances >= 1
        assert len(report.instances) >= 1
        assert all(
            i.customer_id == sample_sla_instance.customer_id for i in report.instances
        )

    @pytest.mark.asyncio
    async def test_list_breaches(
        self,
        session: AsyncSession,
        test_tenant: str,
        sample_sla_definition: SLADefinition,
    ):
        """Test listing SLA breaches"""
        service = SLAMonitoringService(session, test_tenant)

        # Create instance with breach
        instance = SLAInstance(
            tenant_id=test_tenant,
            sla_definition_id=sample_sla_definition.id,
            customer_id=uuid4(),
            customer_name="Test Customer",
            service_id=uuid4(),
            service_name="Test Service",
            status=SLAStatus.BREACHED,
            enabled=True,
            start_date=datetime.now(UTC) - timedelta(days=30),
            current_availability=98.0,
            total_downtime=864,
            unplanned_downtime=864,
            planned_downtime=0,
        )
        session.add(instance)
        await session.commit()
        await session.refresh(instance)

        # Create breach record
        breach = SLABreach(
            tenant_id=test_tenant,
            sla_instance_id=instance.id,
            breach_type="availability",
            detected_at=datetime.now(UTC),
            target_value=99.9,
            actual_value=98.0,
            severity="high",
            resolved=False,
        )
        session.add(breach)
        await session.commit()

        # List all breaches
        breaches = await service.list_breaches()
        assert len(breaches) >= 1

        # List unresolved breaches
        unresolved = await service.list_breaches(resolved=False)
        assert len(unresolved) >= 1
        assert all(not b.resolved for b in unresolved)
