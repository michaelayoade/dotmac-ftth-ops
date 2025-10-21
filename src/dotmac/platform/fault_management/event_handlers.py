"""
Fault Management Event Handlers

Handlers for network events that create alarms and check SLA impact.
"""

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.events.core import Event, event_bus
from dotmac.platform.fault_management.models import AlarmSeverity, AlarmSource
from dotmac.platform.fault_management.schemas import AlarmCreate
from dotmac.platform.fault_management.service import AlarmService
from dotmac.platform.fault_management.sla_service import SLAMonitoringService

logger = structlog.get_logger(__name__)


# =============================================================================
# Device Events
# =============================================================================


@event_bus.subscribe("device.down")  # type: ignore[misc]
async def handle_device_down(event: Event, session: AsyncSession) -> None:
    """Handle device down event - create critical alarm"""
    data = event.data
    tenant_id = event.tenant_id or "default"

    service = AlarmService(session, tenant_id)

    alarm_data = AlarmCreate(
        alarm_id=f"device-down-{data['device_id']}",
        severity=AlarmSeverity.CRITICAL,
        source=AlarmSource.NETWORK_DEVICE,
        alarm_type="device.down",
        title=f"Device Down: {data['device_name']}",
        description=f"Network device {data['device_name']} is not responding",
        resource_type="device",
        resource_id=str(data["device_id"]),
        resource_name=data["device_name"],
        subscriber_count=data.get("affected_subscribers", 0),
        metadata=data,
        probable_cause="Network connectivity issue, device failure, or power outage",
        recommended_action="Check device status, connectivity, and power supply",
    )

    alarm = await service.create(alarm_data)

    logger.info(
        "event.device_down.alarm_created",
        device_id=data["device_id"],
        alarm_id=alarm.id,
    )

    # Check SLA impact
    sla_service = SLAMonitoringService(session, tenant_id)
    await sla_service.check_alarm_impact(await session.get(type(alarm), alarm.id))


@event_bus.subscribe("device.up")  # type: ignore[misc]
async def handle_device_up(event: Event, session: AsyncSession) -> None:
    """Handle device up event - clear related alarms"""
    data = event.data
    tenant_id = event.tenant_id or "default"

    service = AlarmService(session, tenant_id)

    # Find and clear related alarms
    from sqlalchemy import and_, select

    from dotmac.platform.fault_management.models import Alarm, AlarmStatus

    result = await session.execute(
        select(Alarm).where(
            and_(
                Alarm.tenant_id == tenant_id,
                Alarm.resource_type == "device",
                Alarm.resource_id == str(data["device_id"]),
                Alarm.status.in_([AlarmStatus.ACTIVE, AlarmStatus.ACKNOWLEDGED]),
            )
        )
    )

    alarms = result.scalars().all()

    for alarm in alarms:
        await service.clear(alarm.id)

    logger.info(
        "event.device_up.alarms_cleared",
        device_id=data["device_id"],
        count=len(alarms),
    )


@event_bus.subscribe("device.degraded")  # type: ignore[misc]
async def handle_device_degraded(event: Event, session: AsyncSession) -> None:
    """Handle device degraded event - create major alarm"""
    data = event.data
    tenant_id = event.tenant_id or "default"

    service = AlarmService(session, tenant_id)

    alarm_data = AlarmCreate(
        alarm_id=f"device-degraded-{data['device_id']}",
        severity=AlarmSeverity.MAJOR,
        source=AlarmSource.NETWORK_DEVICE,
        alarm_type="device.degraded",
        title=f"Device Degraded: {data['device_name']}",
        description=f"Network device {data['device_name']} is experiencing performance issues",
        resource_type="device",
        resource_id=str(data["device_id"]),
        resource_name=data["device_name"],
        subscriber_count=data.get("affected_subscribers", 0),
        metadata=data,
        probable_cause=data.get("probable_cause", "Performance degradation detected"),
        recommended_action="Investigate device performance metrics and logs",
    )

    await service.create(alarm_data)


# =============================================================================
# Service Events
# =============================================================================


@event_bus.subscribe("service.outage")  # type: ignore[misc]
async def handle_service_outage(event: Event, session: AsyncSession) -> None:
    """Handle service outage - create critical alarm and check SLA"""
    data = event.data
    tenant_id = event.tenant_id or "default"

    service = AlarmService(session, tenant_id)

    alarm_data = AlarmCreate(
        alarm_id=f"service-outage-{data['service_id']}",
        severity=AlarmSeverity.CRITICAL,
        source=AlarmSource.SERVICE,
        alarm_type="service.outage",
        title=f"Service Outage: {data['service_name']}",
        description=f"Service {data['service_name']} is experiencing complete outage",
        resource_type="service",
        resource_id=str(data["service_id"]),
        resource_name=data["service_name"],
        customer_id=data.get("customer_id"),
        customer_name=data.get("customer_name"),
        subscriber_count=data.get("subscriber_count", 0),
        metadata=data,
    )

    alarm = await service.create(alarm_data)

    # Check SLA and record downtime
    if data.get("customer_id"):
        sla_service = SLAMonitoringService(session, tenant_id)
        await sla_service.check_alarm_impact(await session.get(type(alarm), alarm.id))

    logger.warning(
        "event.service_outage.alarm_created",
        service_id=data["service_id"],
        customer_id=data.get("customer_id"),
    )


@event_bus.subscribe("service.restored")  # type: ignore[misc]
async def handle_service_restored(event: Event, session: AsyncSession) -> None:
    """Handle service restored - clear alarms"""
    data = event.data
    tenant_id = event.tenant_id or "default"

    service = AlarmService(session, tenant_id)

    from sqlalchemy import and_, select

    from dotmac.platform.fault_management.models import Alarm, AlarmStatus

    result = await session.execute(
        select(Alarm).where(
            and_(
                Alarm.tenant_id == tenant_id,
                Alarm.resource_type == "service",
                Alarm.resource_id == str(data["service_id"]),
                Alarm.status.in_([AlarmStatus.ACTIVE, AlarmStatus.ACKNOWLEDGED]),
            )
        )
    )

    alarms = result.scalars().all()

    for alarm in alarms:
        await service.clear(alarm.id)


# =============================================================================
# CPE Events
# =============================================================================


@event_bus.subscribe("cpe.offline")  # type: ignore[misc]
async def handle_cpe_offline(event: Event, session: AsyncSession) -> None:
    """Handle CPE offline - create alarm"""
    data = event.data
    tenant_id = event.tenant_id or "default"

    service = AlarmService(session, tenant_id)

    alarm_data = AlarmCreate(
        alarm_id=f"cpe-offline-{data['device_id']}",
        severity=AlarmSeverity.MAJOR,
        source=AlarmSource.CPE,
        alarm_type="cpe.offline",
        title=f"CPE Offline: {data['device_id']}",
        description="Customer premises equipment is offline",
        resource_type="cpe",
        resource_id=str(data["device_id"]),
        customer_id=data.get("customer_id"),
        customer_name=data.get("customer_name"),
        subscriber_count=1,
        metadata=data,
        probable_cause="Device power off, network issue, or equipment failure",
        recommended_action="Contact customer or schedule technician visit",
    )

    await service.create(alarm_data)


@event_bus.subscribe("cpe.signal_loss")  # type: ignore[misc]
async def handle_cpe_signal_loss(event: Event, session: AsyncSession) -> None:
    """Handle CPE signal loss - create alarm with correlation"""
    data = event.data
    tenant_id = event.tenant_id or "default"

    service = AlarmService(session, tenant_id)

    alarm_data = AlarmCreate(
        alarm_id=f"cpe-signal-loss-{data['device_id']}",
        severity=AlarmSeverity.MAJOR,
        source=AlarmSource.CPE,
        alarm_type="signal.loss",
        title=f"Signal Loss: {data['device_id']}",
        description="CPE has lost optical signal",
        resource_type="cpe",
        resource_id=str(data["device_id"]),
        customer_id=data.get("customer_id"),
        subscriber_count=1,
        metadata=data,
        probable_cause="Fiber cut, OLT issue, or ONT failure",
        recommended_action="Check fiber connectivity and OLT status",
    )

    await service.create(alarm_data)


# =============================================================================
# Monitoring Events
# =============================================================================


@event_bus.subscribe("monitoring.threshold_exceeded")  # type: ignore[misc]
async def handle_threshold_exceeded(event: Event, session: AsyncSession) -> None:
    """Handle monitoring threshold exceeded - create alarm"""
    data = event.data
    tenant_id = event.tenant_id or "default"

    service = AlarmService(session, tenant_id)

    # Map metric to severity
    metric = data["metric"]
    severity_map = {
        "cpu": AlarmSeverity.MAJOR,
        "memory": AlarmSeverity.MAJOR,
        "disk": AlarmSeverity.MINOR,
        "bandwidth": AlarmSeverity.MAJOR,
        "latency": AlarmSeverity.MAJOR,
        "packet_loss": AlarmSeverity.MAJOR,
    }
    severity = severity_map.get(metric, AlarmSeverity.WARNING)

    alarm_data = AlarmCreate(
        alarm_id=f"threshold-{metric}-{data['resource_id']}",
        severity=severity,
        source=AlarmSource.MONITORING,
        alarm_type=f"threshold.{metric}",
        title=f"Threshold Exceeded: {metric.upper()}",
        description=f"{metric} threshold exceeded on {data['resource_name']}",
        resource_type=data["resource_type"],
        resource_id=data["resource_id"],
        resource_name=data["resource_name"],
        metadata=data,
    )

    await service.create(alarm_data)


@event_bus.subscribe("monitoring.check_recovered")  # type: ignore[misc]
async def handle_check_recovered(event: Event, session: AsyncSession) -> None:
    """Handle monitoring check recovered - clear alarms"""
    data = event.data
    tenant_id = event.tenant_id or "default"

    service = AlarmService(session, tenant_id)

    from sqlalchemy import and_, select

    from dotmac.platform.fault_management.models import Alarm, AlarmStatus

    result = await session.execute(
        select(Alarm).where(
            and_(
                Alarm.tenant_id == tenant_id,
                Alarm.alarm_type == data["check_type"],
                Alarm.resource_id == data["resource_id"],
                Alarm.status.in_([AlarmStatus.ACTIVE, AlarmStatus.ACKNOWLEDGED]),
            )
        )
    )

    alarms = result.scalars().all()

    for alarm in alarms:
        await service.clear(alarm.id)


# =============================================================================
# SLA Events
# =============================================================================


@event_bus.subscribe("alarm.resolved")  # type: ignore[misc]
async def handle_alarm_resolved(event: Event, session: AsyncSession) -> None:
    """Handle alarm resolved - check resolution time SLA"""
    data = event.data
    tenant_id = event.tenant_id or "default"

    alarm_id = data["alarm_id"]

    from dotmac.platform.fault_management.models import Alarm

    alarm = await session.get(Alarm, alarm_id)

    if alarm and alarm.customer_id:
        sla_service = SLAMonitoringService(session, tenant_id)
        await sla_service.check_alarm_resolution(alarm)


logger.info("fault_management.event_handlers.registered")
