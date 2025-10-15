"""
SLA Monitoring Service

Real-time SLA tracking, breach detection, and compliance reporting.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmSeverity,
    MaintenanceWindow,
    SLABreach,
    SLADefinition,
    SLAInstance,
    SLAStatus,
)
from dotmac.platform.fault_management.schemas import (
    SLABreachResponse,
    SLAComplianceReport,
    SLADefinitionCreate,
    SLADefinitionResponse,
    SLADefinitionUpdate,
    SLAInstanceCreate,
    SLAInstanceResponse,
)

logger = structlog.get_logger(__name__)


class SLAMonitoringService:
    """Service for SLA monitoring and breach detection"""

    def __init__(self, session: AsyncSession, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id

    # SLA Definitions

    async def create_definition(
        self, data: SLADefinitionCreate, user_id: UUID | None = None
    ) -> SLADefinitionResponse:
        """Create SLA definition"""
        definition = SLADefinition(
            tenant_id=self.tenant_id,
            name=data.name,
            description=data.description,
            service_type=data.service_type,
            availability_target=data.availability_target,
            measurement_period_days=data.measurement_period_days,
            max_latency_ms=data.max_latency_ms,
            max_packet_loss_percent=data.max_packet_loss_percent,
            min_bandwidth_mbps=data.min_bandwidth_mbps,
            response_time_critical=data.response_time_critical,
            response_time_major=data.response_time_major,
            response_time_minor=data.response_time_minor,
            resolution_time_critical=data.resolution_time_critical,
            resolution_time_major=data.resolution_time_major,
            resolution_time_minor=data.resolution_time_minor,
            business_hours_only=data.business_hours_only,
            exclude_maintenance=data.exclude_maintenance,
            enabled=data.enabled,
        )

        self.session.add(definition)
        await self.session.commit()
        await self.session.refresh(definition)

        logger.info("sla_definition.created", definition_id=definition.id, name=definition.name)

        return SLADefinitionResponse.model_validate(definition)

    async def update_definition(
        self, definition_id: UUID, data: SLADefinitionUpdate
    ) -> SLADefinitionResponse | None:
        """Update SLA definition"""
        result = await self.session.execute(
            select(SLADefinition).where(
                and_(
                    SLADefinition.id == definition_id,
                    SLADefinition.tenant_id == self.tenant_id,
                )
            )
        )

        definition = result.scalar_one_or_none()
        if not definition:
            return None

        if data.name is not None:
            definition.name = data.name
        if data.description is not None:
            definition.description = data.description
        if data.availability_target is not None:
            definition.availability_target = data.availability_target
        if data.max_latency_ms is not None:
            definition.max_latency_ms = data.max_latency_ms
        if data.max_packet_loss_percent is not None:
            definition.max_packet_loss_percent = data.max_packet_loss_percent
        if data.min_bandwidth_mbps is not None:
            definition.min_bandwidth_mbps = data.min_bandwidth_mbps
        if data.enabled is not None:
            definition.enabled = data.enabled

        await self.session.commit()
        await self.session.refresh(definition)

        return SLADefinitionResponse.model_validate(definition)

    async def list_definitions(self) -> list[SLADefinitionResponse]:
        """List all SLA definitions"""
        result = await self.session.execute(
            select(SLADefinition).where(SLADefinition.tenant_id == self.tenant_id)
        )

        definitions = result.scalars().all()
        return [SLADefinitionResponse.model_validate(d) for d in definitions]

    # SLA Instances

    async def create_instance(
        self, data: SLAInstanceCreate, user_id: UUID | None = None
    ) -> SLAInstanceResponse:
        """Create SLA instance for customer/service"""
        instance = SLAInstance(
            tenant_id=self.tenant_id,
            sla_definition_id=data.sla_definition_id,
            customer_id=data.customer_id,
            service_id=data.service_id,
            subscription_id=data.subscription_id,
            status=SLAStatus.COMPLIANT,
            period_start=data.period_start,
            period_end=data.period_end,
        )

        self.session.add(instance)
        await self.session.commit()
        await self.session.refresh(instance)

        logger.info("sla_instance.created", instance_id=instance.id)

        return SLAInstanceResponse.model_validate(instance)

    async def get_instance(self, instance_id: UUID) -> SLAInstanceResponse | None:
        """Get SLA instance by ID"""
        result = await self.session.execute(
            select(SLAInstance).where(
                and_(
                    SLAInstance.id == instance_id,
                    SLAInstance.tenant_id == self.tenant_id,
                )
            )
        )

        instance = result.scalar_one_or_none()
        return SLAInstanceResponse.model_validate(instance) if instance else None

    async def list_instances(
        self,
        customer_id: UUID | None = None,
        service_id: UUID | None = None,
        status: SLAStatus | None = None,
    ) -> list[SLAInstanceResponse]:
        """List SLA instances with filters"""
        filters = [SLAInstance.tenant_id == self.tenant_id]

        if customer_id:
            filters.append(SLAInstance.customer_id == customer_id)
        if service_id:
            filters.append(SLAInstance.service_id == service_id)
        if status:
            filters.append(SLAInstance.status == status)

        result = await self.session.execute(select(SLAInstance).where(and_(*filters)))

        instances = result.scalars().all()
        return [SLAInstanceResponse.model_validate(i) for i in instances]

    # Monitoring and Breach Detection

    async def record_downtime(
        self,
        instance_id: UUID,
        downtime_minutes: int,
        is_planned: bool = False,
    ) -> None:
        """Record downtime for SLA instance"""
        result = await self.session.execute(
            select(SLAInstance).where(
                and_(
                    SLAInstance.id == instance_id,
                    SLAInstance.tenant_id == self.tenant_id,
                )
            )
        )

        instance = result.scalar_one_or_none()
        if not instance:
            return

        # Update downtime
        instance.total_downtime += downtime_minutes
        if is_planned:
            instance.planned_downtime += downtime_minutes
        else:
            instance.unplanned_downtime += downtime_minutes

        # Recalculate availability
        await self._calculate_availability(instance)

        # Check for breaches
        await self._check_availability_breach(instance)

        await self.session.commit()

        logger.info(
            "sla.downtime_recorded",
            instance_id=instance_id,
            downtime_minutes=downtime_minutes,
            is_planned=is_planned,
        )

    async def check_alarm_impact(self, alarm: Alarm) -> None:
        """Check if alarm impacts any SLA instances"""
        if not alarm.customer_id and not alarm.resource_id:
            return

        # Find affected SLA instances
        filters = [
            SLAInstance.tenant_id == self.tenant_id,
            SLAInstance.enabled == True,  # noqa: E712
        ]

        if alarm.customer_id:
            filters.append(SLAInstance.customer_id == alarm.customer_id)

        result = await self.session.execute(select(SLAInstance).where(and_(*filters)))

        instances = result.scalars().all()

        for instance in instances:
            # Check response time SLA
            await self._check_response_time(instance, alarm)

        await self.session.commit()

    async def check_alarm_resolution(self, alarm: Alarm) -> None:
        """Check if alarm resolution meets SLA"""
        if not alarm.resolved_at or not alarm.customer_id:
            return

        # Find affected SLA instances
        result = await self.session.execute(
            select(SLAInstance).where(
                and_(
                    SLAInstance.tenant_id == self.tenant_id,
                    SLAInstance.customer_id == alarm.customer_id,
                    SLAInstance.enabled == True,  # noqa: E712
                )
            )
        )

        instances = result.scalars().all()

        for instance in instances:
            await self._check_resolution_time(instance, alarm)

        await self.session.commit()

    async def _calculate_availability(self, instance: SLAInstance) -> None:
        """Calculate current availability for instance"""
        # Get total period minutes
        period_duration = instance.period_end - instance.period_start
        total_minutes = period_duration.total_seconds() / 60

        # Get SLA definition
        result = await self.session.execute(
            select(SLADefinition).where(SLADefinition.id == instance.sla_definition_id)
        )
        definition = result.scalar_one()

        # Calculate downtime to count
        downtime = instance.total_downtime
        if definition.exclude_maintenance:
            downtime = instance.unplanned_downtime

        # Calculate availability
        if total_minutes > 0:
            uptime_minutes = total_minutes - downtime
            instance.current_availability = max(0.0, uptime_minutes / total_minutes)
        else:
            instance.current_availability = 1.0

    async def _check_availability_breach(self, instance: SLAInstance) -> None:
        """Check if availability target is breached"""
        result = await self.session.execute(
            select(SLADefinition).where(SLADefinition.id == instance.sla_definition_id)
        )
        definition = result.scalar_one()

        target = definition.availability_target
        actual = instance.current_availability

        # Update status
        if actual < target:
            deviation = ((target - actual) / target) * 100

            if deviation > 10:  # >10% below target
                instance.status = SLAStatus.BREACHED
                severity = AlarmSeverity.CRITICAL
            elif deviation > 5:  # 5-10% below target
                instance.status = SLAStatus.AT_RISK
                severity = AlarmSeverity.MAJOR
            else:
                instance.status = SLAStatus.AT_RISK
                severity = AlarmSeverity.MINOR

            # Create breach record
            await self._create_breach(
                instance=instance,
                breach_type="availability",
                severity=severity,
                target_value=target,
                actual_value=actual,
                deviation_percent=deviation,
            )
        else:
            instance.status = SLAStatus.COMPLIANT

    async def _check_response_time(self, instance: SLAInstance, alarm: Alarm) -> None:
        """Check response time SLA"""
        if alarm.acknowledged_at is None:
            return

        result = await self.session.execute(
            select(SLADefinition).where(SLADefinition.id == instance.sla_definition_id)
        )
        definition = result.scalar_one()

        # Get target response time based on severity
        if alarm.severity == AlarmSeverity.CRITICAL:
            target_minutes = definition.response_time_critical
        elif alarm.severity == AlarmSeverity.MAJOR:
            target_minutes = definition.response_time_major
        else:
            target_minutes = definition.response_time_minor

        # Calculate actual response time
        response_time = alarm.acknowledged_at - alarm.first_occurrence
        actual_minutes = response_time.total_seconds() / 60

        # Check for breach
        if actual_minutes > target_minutes:
            deviation = ((actual_minutes - target_minutes) / target_minutes) * 100

            await self._create_breach(
                instance=instance,
                breach_type="response_time",
                severity=alarm.severity,
                target_value=float(target_minutes),
                actual_value=actual_minutes,
                deviation_percent=deviation,
                alarm_id=alarm.id,
            )

    async def _check_resolution_time(self, instance: SLAInstance, alarm: Alarm) -> None:
        """Check resolution time SLA"""
        if not alarm.resolved_at:
            return

        result = await self.session.execute(
            select(SLADefinition).where(SLADefinition.id == instance.sla_definition_id)
        )
        definition = result.scalar_one()

        # Get target resolution time
        if alarm.severity == AlarmSeverity.CRITICAL:
            target_minutes = definition.resolution_time_critical
        elif alarm.severity == AlarmSeverity.MAJOR:
            target_minutes = definition.resolution_time_major
        else:
            target_minutes = definition.resolution_time_minor

        # Calculate actual resolution time
        resolution_time = alarm.resolved_at - alarm.first_occurrence
        actual_minutes = resolution_time.total_seconds() / 60

        # Check for breach
        if actual_minutes > target_minutes:
            deviation = ((actual_minutes - target_minutes) / target_minutes) * 100

            await self._create_breach(
                instance=instance,
                breach_type="resolution_time",
                severity=alarm.severity,
                target_value=float(target_minutes),
                actual_value=actual_minutes,
                deviation_percent=deviation,
                alarm_id=alarm.id,
            )

    async def _create_breach(
        self,
        instance: SLAInstance,
        breach_type: str,
        severity: AlarmSeverity,
        target_value: float,
        actual_value: float,
        deviation_percent: float,
        alarm_id: UUID | None = None,
    ) -> SLABreach:
        """Create SLA breach record"""
        breach = SLABreach(
            tenant_id=self.tenant_id,
            sla_instance_id=instance.id,
            breach_type=breach_type,
            severity=severity,
            breach_start=datetime.now(UTC),
            target_value=target_value,
            actual_value=actual_value,
            deviation_percent=deviation_percent,
            alarm_id=alarm_id,
        )

        self.session.add(breach)
        instance.breach_count += 1
        instance.last_breach_at = datetime.now(UTC)

        logger.warning(
            "sla.breach_detected",
            instance_id=instance.id,
            breach_type=breach_type,
            severity=severity.value,
            deviation=f"{deviation_percent:.1f}%",
        )

        return breach

    # Reporting

    async def get_compliance_report(
        self,
        customer_id: UUID | None = None,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
    ) -> SLAComplianceReport:
        """Generate SLA compliance report"""
        filters = [SLAInstance.tenant_id == self.tenant_id]

        if customer_id:
            filters.append(SLAInstance.customer_id == customer_id)
        if period_start:
            filters.append(SLAInstance.period_start >= period_start)
        if period_end:
            filters.append(SLAInstance.period_end <= period_end)

        # Get instances
        result = await self.session.execute(select(SLAInstance).where(and_(*filters)))
        instances = list(result.scalars().all())

        if not instances:
            return SLAComplianceReport(
                period_start=period_start or datetime.now(UTC),
                period_end=period_end or datetime.now(UTC),
                total_instances=0,
                compliant_instances=0,
                at_risk_instances=0,
                breached_instances=0,
                avg_availability=0.0,
                total_breaches=0,
                total_credits=0.0,
                compliance_by_service_type={},
            )

        # Calculate statistics
        total = len(instances)
        compliant = sum(1 for i in instances if i.status == SLAStatus.COMPLIANT)
        at_risk = sum(1 for i in instances if i.status == SLAStatus.AT_RISK)
        breached = sum(1 for i in instances if i.status == SLAStatus.BREACHED)
        avg_availability = sum(i.current_availability for i in instances) / total
        total_breaches = sum(i.breach_count for i in instances)
        total_credits = sum(i.credit_amount for i in instances)

        # By service type
        service_type_stats: dict[str, list[float]] = {}
        for instance in instances:
            result = await self.session.execute(
                select(SLADefinition).where(SLADefinition.id == instance.sla_definition_id)
            )
            definition = result.scalar_one()
            service_type = definition.service_type

            if service_type not in service_type_stats:
                service_type_stats[service_type] = []
            service_type_stats[service_type].append(instance.current_availability)

        compliance_by_service_type = {
            st: sum(avails) / len(avails) for st, avails in service_type_stats.items()
        }

        return SLAComplianceReport(
            period_start=period_start or instances[0].period_start,
            period_end=period_end or instances[0].period_end,
            total_instances=total,
            compliant_instances=compliant,
            at_risk_instances=at_risk,
            breached_instances=breached,
            avg_availability=avg_availability,
            total_breaches=total_breaches,
            total_credits=total_credits,
            compliance_by_service_type=compliance_by_service_type,
        )

    async def list_breaches(
        self,
        instance_id: UUID | None = None,
        resolved: bool | None = None,
    ) -> list[SLABreachResponse]:
        """List SLA breaches"""
        filters = [SLABreach.tenant_id == self.tenant_id]

        if instance_id:
            filters.append(SLABreach.sla_instance_id == instance_id)
        if resolved is not None:
            filters.append(SLABreach.resolved == resolved)

        result = await self.session.execute(
            select(SLABreach).where(and_(*filters)).order_by(SLABreach.breach_start.desc())
        )

        breaches = result.scalars().all()
        return [SLABreachResponse.model_validate(b) for b in breaches]
