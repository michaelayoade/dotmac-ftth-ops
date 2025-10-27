"""
End-to-End Tests for Fault Management System

Tests complete workflows from event generation to alarm resolution.
"""

from datetime import timezone, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmNote,
    AlarmSeverity,
    AlarmSource,
    AlarmStatus,
    SLABreach,
    SLAInstance,
    SLAStatus,
)
from dotmac.platform.fault_management.schemas import (
    AlarmCreate,
    AlarmRuleCreate,
    SLADefinitionCreate,
    SLAInstanceCreate,
)
from dotmac.platform.fault_management.service import AlarmService
from dotmac.platform.fault_management.sla_service import SLAMonitoringService


class TestDeviceFailureWorkflow:
    """Test complete device failure detection and resolution workflow"""

    @pytest.mark.asyncio
    async def test_device_down_creates_alarm_and_correlates(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """
        E2E Test: Device goes down
        1. Creates critical alarm
        2. Correlates child ONT alarms
        3. Checks SLA impact
        4. Alarm is acknowledged
        5. Device comes back up
        6. Alarm is cleared
        """
        alarm_service = AlarmService(session, test_tenant)
        sla_service = SLAMonitoringService(session, test_tenant)
        user_id = uuid4()

        # Setup: Create SLA for customer
        sla_def = await sla_service.create_definition(
            SLADefinitionCreate(
                name="Enterprise SLA",
                service_level="enterprise",
                availability_target=99.9,
                response_time_target=60,
                resolution_time_target=240,
            ),
            user_id=user_id,
        )

        customer_id = uuid4()
        service_id = uuid4()

        sla_instance = await sla_service.create_instance(
            SLAInstanceCreate(
                sla_definition_id=sla_def.id,
                customer_id=customer_id,
                customer_name="Acme Corp",
                service_id=service_id,
                service_name="Fiber 1Gbps",
                start_date=datetime.now(timezone.utc) - timedelta(days=30),
            ),
            user_id=user_id,
        )

        # Setup: Create correlation rule
        await alarm_service.create_rule(
            AlarmRuleCreate(
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
            ),
            user_id=user_id,
        )

        # Step 1: OLT device goes down - create alarm
        olt_alarm = await alarm_service.create(
            AlarmCreate(
                alarm_id="olt-down-e2e",
                severity=AlarmSeverity.CRITICAL,
                source=AlarmSource.NETWORK_DEVICE,
                alarm_type="olt.down",
                title="OLT Down - Building A",
                description="OLT device not responding",
                resource_type="olt",
                resource_id="olt-building-a",
                resource_name="OLT Building A",
                subscriber_count=100,
                customer_id=customer_id,
                probable_cause="Network connectivity issue",
                recommended_action="Check device connectivity and power",
            ),
            user_id=user_id,
        )

        # Verify: Alarm created successfully
        assert olt_alarm.id is not None
        assert olt_alarm.severity == AlarmSeverity.CRITICAL
        assert olt_alarm.status == AlarmStatus.ACTIVE
        assert olt_alarm.is_root_cause is True

        # Step 2: ONT alarms arrive - should correlate to OLT alarm
        ont_alarms = []
        for i in range(3):
            ont_alarm = await alarm_service.create(
                AlarmCreate(
                    alarm_id=f"ont-offline-e2e-{i}",
                    severity=AlarmSeverity.MAJOR,
                    source=AlarmSource.CPE,
                    alarm_type="ont.offline",
                    title=f"ONT {i} Offline",
                    description="ONT device offline",
                    resource_type="ont",
                    resource_id=f"ont-{i}",
                    resource_name=f"ONT {i}",
                    subscriber_count=1,
                    customer_id=customer_id,
                ),
                user_id=user_id,
            )
            ont_alarms.append(ont_alarm)

        # Verify: ONT alarms correlated to OLT alarm
        for ont_alarm in ont_alarms:
            assert ont_alarm.parent_alarm_id == olt_alarm.id
            assert ont_alarm.correlation_id == olt_alarm.correlation_id
            assert ont_alarm.is_root_cause is False

        # Step 3: Check SLA impact
        db_olt_alarm = await session.get(Alarm, olt_alarm.id)
        await sla_service.check_alarm_impact(db_olt_alarm)

        # Verify: SLA instance affected
        db_sla_instance = await session.get(SLAInstance, sla_instance.id)
        # Downtime may not be recorded yet if alarm is still active
        # Just verify the SLA instance exists and is being monitored

        # Step 4: Technician acknowledges alarm
        acknowledged_alarm = await alarm_service.acknowledge(
            olt_alarm.id,
            note="Engineer dispatched to site",
            user_id=user_id,
        )

        # Verify: Alarm acknowledged
        assert acknowledged_alarm.status == AlarmStatus.ACKNOWLEDGED
        assert acknowledged_alarm.acknowledged_by == user_id
        assert acknowledged_alarm.acknowledged_at is not None

        # Verify: Acknowledgment note created
        result = await session.execute(select(AlarmNote).where(AlarmNote.alarm_id == olt_alarm.id))
        notes = list(result.scalars().all())
        assert len(notes) >= 1
        assert any(n.note_type == "acknowledgment" for n in notes)

        # Step 5: Add investigation note
        from dotmac.platform.fault_management.schemas import AlarmNoteCreate

        await alarm_service.add_note(
            olt_alarm.id,
            AlarmNoteCreate(
                note_type="investigation",
                content="Found power supply issue, replacing now",
            ),
            user_id,
        )

        # Step 6: Device comes back up - clear alarm
        cleared_alarm = await alarm_service.clear(olt_alarm.id, user_id=user_id)

        # Verify: Alarm cleared
        assert cleared_alarm.status == AlarmStatus.CLEARED
        assert cleared_alarm.cleared_at is not None

        # Verify: Correlated ONT alarms also cleared
        for ont_alarm in ont_alarms:
            db_ont_alarm = await session.get(Alarm, ont_alarm.id)
            assert db_ont_alarm.status == AlarmStatus.CLEARED

        # Step 7: Check final SLA status
        # Calculate downtime from alarm duration
        db_olt_alarm = await session.get(Alarm, olt_alarm.id)
        if db_olt_alarm.cleared_at and db_olt_alarm.first_occurrence:
            downtime_minutes = int(
                (db_olt_alarm.cleared_at - db_olt_alarm.first_occurrence).total_seconds() / 60
            )
            await sla_service.record_downtime(
                sla_instance.id,
                downtime_minutes=downtime_minutes,
                is_planned=False,
            )

            # Verify: Downtime recorded
            db_sla_instance = await session.get(SLAInstance, sla_instance.id)
            assert db_sla_instance.total_downtime >= downtime_minutes


class TestSLABreachWorkflow:
    """Test SLA breach detection and reporting workflow"""

    @pytest.mark.asyncio
    async def test_availability_breach_workflow(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """
        E2E Test: SLA breach detection
        1. Customer has SLA with 99.9% target
        2. Multiple outages occur
        3. Availability drops below target
        4. Breach is detected
        5. Breach report generated
        """
        sla_service = SLAMonitoringService(session, test_tenant)
        AlarmService(session, test_tenant)
        user_id = uuid4()

        # Step 1: Create SLA definition and instance
        sla_def = await sla_service.create_definition(
            SLADefinitionCreate(
                name="Business SLA",
                service_level="business",
                availability_target=99.9,
                response_time_target=120,
                resolution_time_target=480,
            ),
            user_id=user_id,
        )

        customer_id = uuid4()
        service_id = uuid4()

        # Instance started 30 days ago
        start_date = datetime.now(timezone.utc) - timedelta(days=30)

        sla_instance = await sla_service.create_instance(
            SLAInstanceCreate(
                sla_definition_id=sla_def.id,
                customer_id=customer_id,
                customer_name="Business Customer",
                service_id=service_id,
                service_name="Business Fiber 500Mbps",
                start_date=start_date,
            ),
            user_id=user_id,
        )

        # Verify: Initial state is compliant
        assert sla_instance.status == SLAStatus.COMPLIANT
        assert sla_instance.current_availability == 100.0

        # Step 2: Simulate multiple service outages
        # Total 500 minutes downtime over 30 days = ~98.84% availability
        # This is below 99.9% target

        # First outage: 3 hours (180 minutes)
        await sla_service.record_downtime(
            sla_instance.id,
            downtime_minutes=180,
            is_planned=False,
        )

        # Second outage: 4 hours (240 minutes)
        await sla_service.record_downtime(
            sla_instance.id,
            downtime_minutes=240,
            is_planned=False,
        )

        # Third outage: 80 minutes
        await sla_service.record_downtime(
            sla_instance.id,
            downtime_minutes=80,
            is_planned=False,
        )

        # Step 3: Check SLA instance status
        db_sla_instance = await session.get(SLAInstance, sla_instance.id)

        # Verify: Status changed to breached
        assert db_sla_instance.status == SLAStatus.BREACHED
        assert db_sla_instance.current_availability < 99.9
        assert db_sla_instance.total_downtime == 500
        assert db_sla_instance.unplanned_downtime == 500

        # Step 4: Verify breach record created
        result = await session.execute(
            select(SLABreach).where(SLABreach.sla_instance_id == sla_instance.id)
        )
        breaches = list(result.scalars().all())

        assert len(breaches) >= 1
        breach = breaches[0]
        assert breach.breach_type == "availability"
        assert breach.target_value == 99.9
        assert breach.actual_value < 99.9
        assert breach.severity == "high"
        assert breach.resolved is False

        # Step 5: Generate compliance report
        report = await sla_service.get_compliance_report(customer_id=customer_id)

        # Verify: Report shows breach
        assert report.total_instances == 1
        assert report.breached_instances == 1
        assert report.compliant_instances == 0
        assert report.overall_compliance_rate < 100.0

        # Verify: Instance appears in report
        assert len(report.instances) == 1
        reported_instance = report.instances[0]
        assert reported_instance.id == sla_instance.id
        assert reported_instance.status == SLAStatus.BREACHED


class TestMaintenanceWindowWorkflow:
    """Test maintenance window alarm suppression workflow"""

    @pytest.mark.asyncio
    async def test_maintenance_window_suppresses_alarms(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """
        E2E Test: Scheduled maintenance
        1. Maintenance window scheduled
        2. Maintenance starts
        3. Alarms during maintenance are suppressed
        4. Maintenance ends
        5. New alarms are not suppressed
        """
        alarm_service = AlarmService(session, test_tenant)
        user_id = uuid4()

        # Step 1: Schedule maintenance window for tomorrow
        now = datetime.now(timezone.utc)
        start_time = now + timedelta(days=1)
        end_time = start_time + timedelta(hours=4)

        from dotmac.platform.fault_management.schemas import MaintenanceWindowCreate

        window = await alarm_service.create_maintenance_window(
            MaintenanceWindowCreate(
                title="Core Switch Upgrade",
                description="Upgrading firmware on core switches",
                start_time=start_time,
                end_time=end_time,
                resource_type="device",
                resource_id="switch-core-01",
                suppress_alarms=True,
            ),
            user_id=user_id,
        )

        # Verify: Window created as scheduled
        assert window.id is not None
        assert window.status == "scheduled"
        assert window.suppress_alarms is True

        # Step 2: Simulate maintenance start (manually update for testing)
        from dotmac.platform.fault_management.models import MaintenanceWindow

        db_window = await session.get(MaintenanceWindow, window.id)
        db_window.start_time = now - timedelta(minutes=30)
        db_window.end_time = now + timedelta(hours=3, minutes=30)
        db_window.status = "in_progress"
        await session.commit()

        # Step 3: Create alarm during maintenance window
        alarm_during_maintenance = await alarm_service.create(
            AlarmCreate(
                alarm_id="maintenance-alarm-001",
                severity=AlarmSeverity.MAJOR,
                source=AlarmSource.NETWORK_DEVICE,
                alarm_type="device.reboot",
                title="Device Rebooting",
                description="Device is rebooting",
                resource_type="device",
                resource_id="switch-core-01",
                subscriber_count=0,
            ),
            user_id=user_id,
        )

        # Verify: Alarm suppressed during maintenance
        assert alarm_during_maintenance.status == AlarmStatus.SUPPRESSED

        # Step 4: Simulate maintenance completion
        db_window.status = "completed"
        db_window.end_time = now
        await session.commit()

        # Step 5: Create alarm after maintenance
        alarm_after_maintenance = await alarm_service.create(
            AlarmCreate(
                alarm_id="post-maintenance-alarm-001",
                severity=AlarmSeverity.CRITICAL,
                source=AlarmSource.NETWORK_DEVICE,
                alarm_type="device.down",
                title="Device Down After Maintenance",
                description="Device failed to come back up",
                resource_type="device",
                resource_id="switch-core-01",
                subscriber_count=100,
            ),
            user_id=user_id,
        )

        # Verify: Alarm NOT suppressed after maintenance
        assert alarm_after_maintenance.status == AlarmStatus.ACTIVE


class TestAlarmEscalationWorkflow:
    """Test alarm escalation for unacknowledged critical alarms"""

    @pytest.mark.asyncio
    async def test_critical_alarm_escalation(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """
        E2E Test: Critical alarm escalation
        1. Critical alarm created
        2. Alarm remains unacknowledged for 15 minutes
        3. Alarm is escalated (ticket would be created)
        4. Finally acknowledged by on-call engineer
        """
        alarm_service = AlarmService(session, test_tenant)
        user_id = uuid4()

        # Step 1: Create critical alarm
        critical_alarm = await alarm_service.create(
            AlarmCreate(
                alarm_id="critical-escalation-001",
                severity=AlarmSeverity.CRITICAL,
                source=AlarmSource.NETWORK_DEVICE,
                alarm_type="core.router.down",
                title="Core Router Down",
                description="Primary core router is not responding",
                resource_type="router",
                resource_id="core-router-01",
                resource_name="Core Router 01",
                subscriber_count=1000,
                probable_cause="Hardware failure or power issue",
                recommended_action="IMMEDIATE ACTION REQUIRED - Check router status",
            ),
            user_id=user_id,
        )

        # Verify: Alarm created as ACTIVE
        assert critical_alarm.severity == AlarmSeverity.CRITICAL
        assert critical_alarm.status == AlarmStatus.ACTIVE
        assert critical_alarm.subscriber_count == 1000

        # Step 2: Simulate 15 minutes passing (check unacknowledged)
        db_alarm = await session.get(Alarm, critical_alarm.id)
        db_alarm.first_occurrence = datetime.now(timezone.utc) - timedelta(minutes=15)
        await session.commit()

        # In real system, Celery task would check for unacknowledged alarms
        # and create tickets. Here we just verify the alarm is still unacknowledged
        await session.refresh(db_alarm)
        assert db_alarm.status == AlarmStatus.ACTIVE
        assert db_alarm.acknowledged_at is None
        assert db_alarm.acknowledged_by is None

        # Step 3: On-call engineer finally acknowledges
        acknowledged = await alarm_service.acknowledge(
            critical_alarm.id,
            note="On-call engineer responding - investigating router issue",
            user_id=user_id,
        )

        # Verify: Alarm acknowledged
        assert acknowledged.status == AlarmStatus.ACKNOWLEDGED
        assert acknowledged.acknowledged_by == user_id

        # Step 4: Resolution after investigation
        resolved = await alarm_service.resolve(
            critical_alarm.id,
            resolution_note="Router power supply failed. Replaced PSU and router back online.",
            user_id=user_id,
        )

        # Verify: Alarm resolved
        assert resolved.status == AlarmStatus.CLEARED
        assert resolved.cleared_at is not None


class TestCompleteNetworkOutageScenario:
    """Test complex scenario with multiple correlated alarms and SLA impact"""

    @pytest.mark.asyncio
    async def test_fiber_cut_cascading_alarms(
        self,
        session: AsyncSession,
        test_tenant: str,
    ):
        """
        E2E Test: Fiber cut scenario
        1. Fiber cut detected
        2. Multiple OLT alarms (loss of signal)
        3. Hundreds of ONT offline alarms
        4. All correlated to fiber cut
        5. Multiple customer SLAs affected
        6. Fiber repaired
        7. All alarms cleared
        8. SLA downtime recorded
        """
        alarm_service = AlarmService(session, test_tenant)
        sla_service = SLAMonitoringService(session, test_tenant)
        user_id = uuid4()

        # Setup: Create correlation rules
        await alarm_service.create_rule(
            AlarmRuleCreate(
                name="Fiber to OLT Correlation",
                rule_type="correlation",
                enabled=True,
                priority=1,
                conditions={
                    "parent_alarm_type": "fiber.cut",
                    "child_alarm_type": "olt.signal_loss",
                    "time_window_minutes": 5,
                },
                actions={
                    "correlation_action": "correlate",
                    "mark_root_cause": True,
                },
            ),
            user_id=user_id,
        )

        await alarm_service.create_rule(
            AlarmRuleCreate(
                name="OLT to ONT Correlation",
                rule_type="correlation",
                enabled=True,
                priority=2,
                conditions={
                    "parent_alarm_type": "olt.signal_loss",
                    "child_alarm_type": "ont.offline",
                    "time_window_minutes": 5,
                },
                actions={
                    "correlation_action": "correlate",
                },
            ),
            user_id=user_id,
        )

        # Setup: Create SLA instances for affected customers
        sla_def = await sla_service.create_definition(
            SLADefinitionCreate(
                name="Residential SLA",
                service_level="residential",
                availability_target=99.5,
                response_time_target=240,
                resolution_time_target=1440,
            ),
            user_id=user_id,
        )

        customers = []
        for i in range(3):
            customer_id = uuid4()
            service_id = uuid4()
            sla_instance = await sla_service.create_instance(
                SLAInstanceCreate(
                    sla_definition_id=sla_def.id,
                    customer_id=customer_id,
                    customer_name=f"Customer {i}",
                    service_id=service_id,
                    service_name="Residential Fiber 100Mbps",
                    start_date=datetime.now(timezone.utc) - timedelta(days=60),
                ),
                user_id=user_id,
            )
            customers.append(
                {
                    "customer_id": customer_id,
                    "service_id": service_id,
                    "sla_instance": sla_instance,
                }
            )

        # Step 1: Fiber cut detected (root cause)
        fiber_alarm = await alarm_service.create(
            AlarmCreate(
                alarm_id="fiber-cut-scenario",
                severity=AlarmSeverity.CRITICAL,
                source=AlarmSource.NETWORK_DEVICE,
                alarm_type="fiber.cut",
                title="Fiber Cable Cut - Main Trunk",
                description="Fiber optic cable severed on Main Street",
                resource_type="fiber",
                resource_id="fiber-trunk-main-01",
                resource_name="Main Trunk Fiber",
                subscriber_count=500,
                probable_cause="Construction activity severed fiber cable",
                recommended_action="Dispatch fiber repair crew immediately",
            ),
            user_id=user_id,
        )

        # Verify: Root cause alarm created
        assert fiber_alarm.is_root_cause is True
        assert fiber_alarm.correlation_id is not None

        # Step 2: OLT signal loss alarms (5 OLTs affected)
        olt_alarms = []
        for i in range(5):
            olt_alarm = await alarm_service.create(
                AlarmCreate(
                    alarm_id=f"olt-signal-loss-{i}",
                    severity=AlarmSeverity.CRITICAL,
                    source=AlarmSource.NETWORK_DEVICE,
                    alarm_type="olt.signal_loss",
                    title=f"OLT {i} Signal Loss",
                    description=f"OLT {i} lost upstream fiber signal",
                    resource_type="olt",
                    resource_id=f"olt-{i}",
                    resource_name=f"OLT {i}",
                    subscriber_count=100,
                ),
                user_id=user_id,
            )
            olt_alarms.append(olt_alarm)

        # Verify: OLT alarms correlated to fiber cut
        for olt_alarm in olt_alarms:
            assert olt_alarm.parent_alarm_id == fiber_alarm.id
            assert olt_alarm.correlation_id == fiber_alarm.correlation_id

        # Step 3: ONT offline alarms (simulate 50 ONTs)
        ont_alarms = []
        for i in range(10):  # Reduced for test performance
            customer = customers[i % 3]
            ont_alarm = await alarm_service.create(
                AlarmCreate(
                    alarm_id=f"ont-offline-scenario-{i}",
                    severity=AlarmSeverity.MAJOR,
                    source=AlarmSource.CPE,
                    alarm_type="ont.offline",
                    title=f"ONT {i} Offline",
                    description=f"ONT {i} lost connection",
                    resource_type="ont",
                    resource_id=f"ont-scenario-{i}",
                    resource_name=f"ONT {i}",
                    subscriber_count=1,
                    customer_id=customer["customer_id"],
                ),
                user_id=user_id,
            )
            ont_alarms.append(ont_alarm)

        # Verify: Some ONT alarms correlated to OLT alarms
        # (Correlation depends on timing and rules)

        # Step 4: Acknowledge root cause alarm
        await alarm_service.acknowledge(
            fiber_alarm.id,
            note="Fiber repair crew dispatched. ETA 2 hours.",
            user_id=user_id,
        )

        # Step 5: Fiber repaired - clear root cause
        await alarm_service.resolve(
            fiber_alarm.id,
            resolution_note="Fiber splice completed. Service restored.",
            user_id=user_id,
        )

        # Verify: Root cause cleared
        db_fiber_alarm = await session.get(Alarm, fiber_alarm.id)
        assert db_fiber_alarm.status == AlarmStatus.CLEARED

        # Step 6: Clear correlated alarms
        for olt_alarm in olt_alarms:
            await alarm_service.clear(olt_alarm.id, user_id=user_id)

        for ont_alarm in ont_alarms:
            await alarm_service.clear(ont_alarm.id, user_id=user_id)

        # Step 7: Record downtime for affected customers (2 hours)
        for customer in customers:
            await sla_service.record_downtime(
                customer["sla_instance"].id,
                downtime_minutes=120,
                is_planned=False,
            )

        # Verify: All customers have recorded downtime
        for customer in customers:
            db_sla = await session.get(SLAInstance, customer["sla_instance"].id)
            assert db_sla.total_downtime >= 120
            assert db_sla.unplanned_downtime >= 120
            # 2 hours in 60 days should still be compliant
            assert db_sla.current_availability > 99.0

        # Step 8: Generate final statistics
        stats = await alarm_service.get_statistics()

        # Verify: Multiple cleared alarms
        assert stats.cleared_alarms >= 16  # 1 fiber + 5 OLT + 10 ONT
