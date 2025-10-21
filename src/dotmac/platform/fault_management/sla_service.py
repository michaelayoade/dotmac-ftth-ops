"""
SLA Monitoring Service

Real-time SLA tracking, breach detection, and compliance reporting.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmSeverity,
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
        service_type = data.service_type or data.service_level or "general"
        availability_target = data.availability_target
        response_target = data.response_time_target
        resolution_target = data.resolution_time_target
        definition = SLADefinition(
            tenant_id=self.tenant_id,
            name=data.name,
            description=data.description,
            service_type=service_type,
            service_level=data.service_level or data.service_type or service_type,
            availability_target=availability_target,
            measurement_period_days=data.measurement_period_days,
            response_time_target=response_target,
            resolution_time_target=resolution_target,
            max_latency_ms=data.max_latency_ms,
            max_packet_loss_percent=data.max_packet_loss_percent,
            min_bandwidth_mbps=data.min_bandwidth_mbps,
            response_time_critical=data.response_time_critical or response_target,
            response_time_major=data.response_time_major or response_target,
            response_time_minor=data.response_time_minor or response_target,
            resolution_time_critical=data.resolution_time_critical or resolution_target,
            resolution_time_major=data.resolution_time_major or resolution_target,
            resolution_time_minor=data.resolution_time_minor or resolution_target,
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
        if data.measurement_period_days is not None:
            definition.measurement_period_days = data.measurement_period_days
        if data.response_time_target is not None:
            definition.response_time_target = data.response_time_target
            definition.response_time_critical = data.response_time_target
            definition.response_time_major = data.response_time_target
            definition.response_time_minor = data.response_time_target
        if data.resolution_time_target is not None:
            definition.resolution_time_target = data.resolution_time_target
            definition.resolution_time_critical = data.resolution_time_target
            definition.resolution_time_major = data.resolution_time_target
            definition.resolution_time_minor = data.resolution_time_target
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
        result = await self.session.execute(
            select(SLADefinition).where(
                and_(
                    SLADefinition.id == data.sla_definition_id,
                    SLADefinition.tenant_id == self.tenant_id,
                )
            )
        )
        definition = result.scalar_one_or_none()
        if not definition:
            raise ValueError(f"SLA definition {data.sla_definition_id} not found")

        start_date = data.start_date
        end_date = data.end_date or start_date + timedelta(days=definition.measurement_period_days)

        instance = SLAInstance(
            tenant_id=self.tenant_id,
            sla_definition_id=data.sla_definition_id,
            customer_id=data.customer_id,
            customer_name=data.customer_name,
            service_id=data.service_id,
            service_name=data.service_name,
            subscription_id=data.subscription_id,
            status=SLAStatus.COMPLIANT,
            start_date=start_date,
            end_date=end_date,
            current_availability=100.0,
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

            # Record downtime when alarm has been cleared/resolved
            start_time = alarm.first_occurrence or alarm.last_occurrence
            end_time = alarm.cleared_at or alarm.resolved_at
            if start_time and end_time:
                downtime_minutes = int((end_time - start_time).total_seconds() / 60)
                if downtime_minutes > 0:
                    await self.record_downtime(
                        instance.id,
                        downtime_minutes=downtime_minutes,
                        is_planned=False,
                    )

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
        period_duration = instance.end_date - instance.start_date
        total_minutes = max(period_duration.total_seconds() / 60, 0)

        # Get SLA definition
        result = await self.session.execute(
            select(SLADefinition).where(SLADefinition.id == instance.sla_definition_id)
        )
        definition = result.scalar_one()

        # Calculate downtime to count
        downtime = instance.total_downtime
        if definition.exclude_maintenance:
            downtime = instance.unplanned_downtime

        # Calculate availability percentage
        if total_minutes > 0:
            uptime_minutes = max(total_minutes - downtime, 0)
            availability = (uptime_minutes / total_minutes) * 100
            instance.current_availability = max(0.0, min(100.0, round(availability, 4)))
        else:
            instance.current_availability = 100.0

    async def _check_availability_breach(self, instance: SLAInstance) -> None:
        """Check if availability target is breached"""
        result = await self.session.execute(
            select(SLADefinition).where(SLADefinition.id == instance.sla_definition_id)
        )
        definition = result.scalar_one()

        raw_target = definition.availability_target
        target = raw_target * 100 if raw_target <= 1 else raw_target
        actual = instance.current_availability

        difference = target - actual
        if difference <= 0:
            instance.status = SLAStatus.COMPLIANT
            return

        deviation_percent = ((difference) / target) * 100 if target else difference

        if difference < 0.5:
            instance.status = SLAStatus.AT_RISK
            return

        if difference >= 2:
            severity_label = "critical"
        else:
            severity_label = "high"

        instance.status = SLAStatus.BREACHED

        await self._create_breach(
            instance=instance,
            breach_type="availability",
            severity=severity_label,
            target_value=target,
            actual_value=actual,
            deviation_percent=deviation_percent,
        )

    async def _check_response_time(self, instance: SLAInstance, alarm: Alarm) -> None:
        """Check response time SLA"""
        if alarm.acknowledged_at is None:
            return

        result = await self.session.execute(
            select(SLADefinition).where(SLADefinition.id == instance.sla_definition_id)
        )
        definition = result.scalar_one()

        target_minutes = definition.response_time_target

        # Calculate actual response time
        response_time = alarm.acknowledged_at - alarm.first_occurrence
        actual_minutes = response_time.total_seconds() / 60

        # Check for breach
        if actual_minutes > target_minutes:
            deviation = ((actual_minutes - target_minutes) / target_minutes) * 100 if target_minutes else actual_minutes
            severity_label = {
                AlarmSeverity.CRITICAL: "critical",
                AlarmSeverity.MAJOR: "high",
                AlarmSeverity.MINOR: "medium",
            }.get(alarm.severity, "low")

            await self._create_breach(
                instance=instance,
                breach_type="response_time",
                severity=severity_label,
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

        target_minutes = definition.resolution_time_target

        # Calculate actual resolution time
        resolution_time = alarm.resolved_at - alarm.first_occurrence
        actual_minutes = resolution_time.total_seconds() / 60

        # Check for breach
        if actual_minutes > target_minutes:
            deviation = ((actual_minutes - target_minutes) / target_minutes) * 100 if target_minutes else actual_minutes
            severity_label = {
                AlarmSeverity.CRITICAL: "critical",
                AlarmSeverity.MAJOR: "high",
                AlarmSeverity.MINOR: "medium",
            }.get(alarm.severity, "low")

            await self._create_breach(
                instance=instance,
                breach_type="resolution_time",
                severity=severity_label,
                target_value=float(target_minutes),
                actual_value=actual_minutes,
                deviation_percent=deviation,
                alarm_id=alarm.id,
            )

    async def _has_active_breach(self, instance: SLAInstance, breach_type: str) -> bool:
        """Check if there is an unresolved breach for the instance."""
        result = await self.session.execute(
            select(SLABreach).where(
                and_(
                    SLABreach.tenant_id == self.tenant_id,
                    SLABreach.sla_instance_id == instance.id,
                    SLABreach.breach_type == breach_type,
                    SLABreach.resolved == False,  # noqa: E712
                )
            ).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def _create_breach(
        self,
        instance: SLAInstance,
        breach_type: str,
        severity: str,
        target_value: float,
        actual_value: float,
        deviation_percent: float,
        alarm_id: UUID | None = None,
    ) -> SLABreach:
        """Create SLA breach record"""
        if await self._has_active_breach(instance, breach_type):
            logger.debug(
                "sla.breach_existing",
                instance_id=instance.id,
                breach_type=breach_type,
            )
            result = await self.session.execute(
                select(SLABreach).where(
                    and_(
                        SLABreach.tenant_id == self.tenant_id,
                        SLABreach.sla_instance_id == instance.id,
                        SLABreach.breach_type == breach_type,
                        SLABreach.resolved == False,  # noqa: E712
                    )
                ).limit(1)
            )
            existing_breach = result.scalar_one()
            return existing_breach

        breach = SLABreach(
            tenant_id=self.tenant_id,
            sla_instance_id=instance.id,
            breach_type=breach_type,
            severity=severity,
            detected_at=datetime.now(UTC),
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
            severity=severity,
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
            filters.append(SLAInstance.start_date >= period_start)
        if period_end:
            filters.append(SLAInstance.end_date <= period_end)

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
                overall_compliance_rate=0.0,
                total_breaches=0,
                total_credits=0.0,
                compliance_by_service_type={},
                instances=[],
            )

        # Calculate statistics
        total = len(instances)
        compliant = sum(1 for i in instances if i.status == SLAStatus.COMPLIANT)
        at_risk = sum(1 for i in instances if i.status == SLAStatus.AT_RISK)
        breached = sum(1 for i in instances if i.status == SLAStatus.BREACHED)
        avg_availability = round(sum(i.current_availability for i in instances) / total, 4)
        overall_compliance_rate = round((compliant / total) * 100, 2) if total else 0.0
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
            st: round(sum(avails) / len(avails), 4) for st, avails in service_type_stats.items()
        }

        instance_responses = [SLAInstanceResponse.model_validate(i) for i in instances]

        return SLAComplianceReport(
            period_start=period_start or instances[0].start_date,
            period_end=period_end or instances[0].end_date,
            total_instances=total,
            compliant_instances=compliant,
            at_risk_instances=at_risk,
            breached_instances=breached,
            avg_availability=avg_availability,
            overall_compliance_rate=overall_compliance_rate,
            total_breaches=total_breaches,
            total_credits=total_credits,
            compliance_by_service_type=compliance_by_service_type,
            instances=instance_responses,
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
            select(SLABreach).where(and_(*filters)).order_by(SLABreach.detected_at.desc())
        )

        breaches = result.scalars().all()
        return [SLABreachResponse.model_validate(b) for b in breaches]
