"""
Alarm Service Layer

Business logic for alarm management, correlation, and ticket integration.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.correlation import CorrelationEngine
from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmNote,
    AlarmRule,
    AlarmStatus,
    MaintenanceWindow,
)
from dotmac.platform.fault_management.schemas import (
    AlarmCreate,
    AlarmNoteCreate,
    AlarmQueryParams,
    AlarmResponse,
    AlarmRuleCreate,
    AlarmRuleResponse,
    AlarmRuleUpdate,
    AlarmStatistics,
    AlarmUpdate,
    MaintenanceWindowCreate,
    MaintenanceWindowResponse,
    MaintenanceWindowUpdate,
)

logger = structlog.get_logger(__name__)


class AlarmService:
    """Service for alarm management operations"""

    def __init__(self, session: AsyncSession, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id
        self.correlation_engine = CorrelationEngine(session, tenant_id)

    async def create(self, data: AlarmCreate, user_id: UUID | None = None) -> AlarmResponse:
        """
        Create new alarm with automatic correlation.

        Args:
            data: Alarm creation data
            user_id: User creating the alarm

        Returns:
            Created alarm
        """
        # Check if in maintenance window
        in_maintenance = await self._is_in_maintenance_window(
            resource_type=data.resource_type, resource_id=data.resource_id
        )

        # Create alarm
        alarm = Alarm(
            tenant_id=self.tenant_id,
            alarm_id=data.alarm_id,
            severity=data.severity,
            source=data.source,
            alarm_type=data.alarm_type,
            title=data.title,
            description=data.description,
            message=data.message,
            resource_type=data.resource_type,
            resource_id=data.resource_id,
            resource_name=data.resource_name,
            customer_id=data.customer_id,
            customer_name=data.customer_name,
            subscriber_count=data.subscriber_count,
            tags=data.tags,
            alarm_metadata=data.metadata,
            probable_cause=data.probable_cause,
            recommended_action=data.recommended_action,
            status=AlarmStatus.SUPPRESSED if in_maintenance else AlarmStatus.ACTIVE,
        )

        self.session.add(alarm)
        await self.session.flush()

        # Run correlation if not in maintenance
        if not in_maintenance:
            await self.correlation_engine.correlate(alarm)

        await self.session.commit()
        await self.session.refresh(alarm)

        logger.info(
            "alarm.created",
            alarm_id=alarm.id,
            external_id=alarm.alarm_id,
            severity=alarm.severity.value,
            in_maintenance=in_maintenance,
        )

        return AlarmResponse.model_validate(alarm)

    async def get(self, alarm_id: UUID) -> AlarmResponse | None:
        """Get alarm by ID"""
        result = await self.session.execute(
            select(Alarm).where(and_(Alarm.id == alarm_id, Alarm.tenant_id == self.tenant_id))
        )

        alarm = result.scalar_one_or_none()
        return AlarmResponse.model_validate(alarm) if alarm else None

    async def update(
        self, alarm_id: UUID, data: AlarmUpdate, user_id: UUID | None = None
    ) -> AlarmResponse | None:
        """Update alarm"""
        result = await self.session.execute(
            select(Alarm).where(and_(Alarm.id == alarm_id, Alarm.tenant_id == self.tenant_id))
        )

        alarm = result.scalar_one_or_none()
        if not alarm:
            return None

        # Update fields
        if data.severity is not None:
            alarm.severity = data.severity
        if data.status is not None:
            alarm.status = data.status
        if data.assigned_to is not None:
            alarm.assigned_to = data.assigned_to
            alarm.assigned_at = datetime.now(UTC)
        if data.probable_cause is not None:
            alarm.probable_cause = data.probable_cause
        if data.recommended_action is not None:
            alarm.recommended_action = data.recommended_action
        if data.tags is not None:
            alarm.tags = data.tags

        await self.session.commit()
        await self.session.refresh(alarm)

        logger.info("alarm.updated", alarm_id=alarm_id, user_id=user_id)

        return AlarmResponse.model_validate(alarm)

    async def acknowledge(
        self, alarm_id: UUID, note: str | None, user_id: UUID
    ) -> AlarmResponse | None:
        """Acknowledge alarm"""
        result = await self.session.execute(
            select(Alarm).where(and_(Alarm.id == alarm_id, Alarm.tenant_id == self.tenant_id))
        )

        alarm = result.scalar_one_or_none()
        if not alarm:
            return None

        alarm.status = AlarmStatus.ACKNOWLEDGED
        alarm.acknowledged_at = datetime.now(UTC)
        alarm.assigned_to = user_id

        if note:
            alarm_note = AlarmNote(
                tenant_id=self.tenant_id,
                alarm_id=alarm_id,
                note=note,
                created_by=user_id,
            )
            self.session.add(alarm_note)

        await self.session.commit()
        await self.session.refresh(alarm)

        logger.info("alarm.acknowledged", alarm_id=alarm_id, user_id=user_id)

        return AlarmResponse.model_validate(alarm)

    async def clear(self, alarm_id: UUID, user_id: UUID | None = None) -> AlarmResponse | None:
        """Clear alarm and correlated children"""
        await self.correlation_engine.clear_correlation(alarm_id)

        result = await self.session.execute(
            select(Alarm).where(and_(Alarm.id == alarm_id, Alarm.tenant_id == self.tenant_id))
        )

        alarm = result.scalar_one_or_none()
        if not alarm:
            return None

        logger.info("alarm.cleared", alarm_id=alarm_id, user_id=user_id)

        await self.session.refresh(alarm)
        return AlarmResponse.model_validate(alarm)

    async def resolve(
        self, alarm_id: UUID, resolution_note: str, user_id: UUID
    ) -> AlarmResponse | None:
        """Resolve alarm"""
        result = await self.session.execute(
            select(Alarm).where(and_(Alarm.id == alarm_id, Alarm.tenant_id == self.tenant_id))
        )

        alarm = result.scalar_one_or_none()
        if not alarm:
            return None

        alarm.status = AlarmStatus.RESOLVED
        alarm.resolved_at = datetime.now(UTC)

        # Add resolution note
        note = AlarmNote(
            tenant_id=self.tenant_id,
            alarm_id=alarm_id,
            note=f"Resolved: {resolution_note}",
            created_by=user_id,
        )
        self.session.add(note)

        await self.session.commit()
        await self.session.refresh(alarm)

        logger.info("alarm.resolved", alarm_id=alarm_id, user_id=user_id)

        return AlarmResponse.model_validate(alarm)

    async def query(self, params: AlarmQueryParams) -> list[AlarmResponse]:
        """Query alarms with filters"""
        filters = [Alarm.tenant_id == self.tenant_id]

        if params.severity:
            filters.append(Alarm.severity.in_(params.severity))
        if params.status:
            filters.append(Alarm.status.in_(params.status))
        if params.source:
            filters.append(Alarm.source.in_(params.source))
        if params.alarm_type:
            filters.append(Alarm.alarm_type == params.alarm_type)
        if params.resource_type:
            filters.append(Alarm.resource_type == params.resource_type)
        if params.resource_id:
            filters.append(Alarm.resource_id == params.resource_id)
        if params.customer_id:
            filters.append(Alarm.customer_id == params.customer_id)
        if params.assigned_to:
            filters.append(Alarm.assigned_to == params.assigned_to)
        if params.is_root_cause is not None:
            filters.append(Alarm.is_root_cause == params.is_root_cause)
        if params.from_date:
            filters.append(Alarm.first_occurrence >= params.from_date)
        if params.to_date:
            filters.append(Alarm.first_occurrence <= params.to_date)

        result = await self.session.execute(
            select(Alarm)
            .where(and_(*filters))
            .order_by(Alarm.first_occurrence.desc())
            .limit(params.limit)
            .offset(params.offset)
        )

        alarms = result.scalars().all()
        return [AlarmResponse.model_validate(alarm) for alarm in alarms]

    async def get_statistics(
        self, from_date: datetime | None = None, to_date: datetime | None = None
    ) -> AlarmStatistics:
        """Get alarm statistics"""
        filters = [Alarm.tenant_id == self.tenant_id]

        if from_date:
            filters.append(Alarm.first_occurrence >= from_date)
        if to_date:
            filters.append(Alarm.first_occurrence <= to_date)

        # Total alarms
        result = await self.session.execute(select(func.count(Alarm.id)).where(and_(*filters)))
        total = result.scalar() or 0

        # Active alarms
        result = await self.session.execute(
            select(func.count(Alarm.id)).where(and_(*filters, Alarm.status == AlarmStatus.ACTIVE))
        )
        active = result.scalar() or 0

        # By severity
        result = await self.session.execute(
            select(Alarm.severity, func.count(Alarm.id))
            .where(and_(*filters))
            .group_by(Alarm.severity)
        )
        severity_counts = {str(sev.value): count for sev, count in result}

        # By source
        result = await self.session.execute(
            select(Alarm.source, func.count(Alarm.id)).where(and_(*filters)).group_by(Alarm.source)
        )
        source_counts = {str(src.value): count for src, count in result}

        # By status
        result = await self.session.execute(
            select(Alarm.status, func.count(Alarm.id)).where(and_(*filters)).group_by(Alarm.status)
        )
        status_counts = {str(st.value): count for st, count in result}

        # With tickets
        result = await self.session.execute(
            select(func.count(Alarm.id)).where(and_(*filters, Alarm.ticket_id.isnot(None)))
        )
        with_tickets = result.scalar() or 0

        # Average resolution time
        result = await self.session.execute(
            select(
                func.avg(
                    func.extract(
                        "epoch",
                        Alarm.resolved_at - Alarm.first_occurrence,
                    )
                )
            ).where(
                and_(
                    *filters,
                    Alarm.status == AlarmStatus.RESOLVED,
                    Alarm.resolved_at.isnot(None),
                )
            )
        )
        avg_resolution_seconds = result.scalar()
        avg_resolution_minutes = (
            float(avg_resolution_seconds) / 60 if avg_resolution_seconds else None
        )

        return AlarmStatistics(
            total_alarms=total,
            active_alarms=active,
            critical_alarms=severity_counts.get("critical", 0),
            major_alarms=severity_counts.get("major", 0),
            minor_alarms=severity_counts.get("minor", 0),
            acknowledged_alarms=status_counts.get("acknowledged", 0),
            unacknowledged_alarms=active - status_counts.get("acknowledged", 0),
            with_tickets=with_tickets,
            without_tickets=total - with_tickets,
            avg_resolution_time_minutes=avg_resolution_minutes,
            alarms_by_severity=severity_counts,
            alarms_by_source=source_counts,
            alarms_by_status=status_counts,
        )

    async def add_note(self, alarm_id: UUID, data: AlarmNoteCreate, user_id: UUID) -> None:
        """Add note to alarm"""
        note = AlarmNote(
            tenant_id=self.tenant_id,
            alarm_id=alarm_id,
            note=data.note,
            created_by=user_id,
        )
        self.session.add(note)
        await self.session.commit()

        logger.info("alarm.note_added", alarm_id=alarm_id, user_id=user_id)

    async def create_ticket_from_alarm(
        self,
        alarm_id: UUID,
        priority: str | None,
        additional_notes: str | None,
        assign_to_user_id: UUID | None,
        user_id: UUID,
    ) -> dict[str, Any]:
        """
        Manually create a support ticket from an alarm.

        Args:
            alarm_id: ID of the alarm to create ticket from
            priority: Ticket priority (low, normal, high, critical)
            additional_notes: Additional context for the ticket
            assign_to_user_id: User to assign ticket to
            user_id: User creating the ticket

        Returns:
            Dictionary with ticket creation details

        Raises:
            ValueError: If alarm not found or already has a ticket
        """
        from dotmac.platform.auth.core import UserInfo
        from dotmac.platform.ticketing.models import TicketActorType, TicketPriority, TicketType
        from dotmac.platform.ticketing.schemas import TicketCreate
        from dotmac.platform.ticketing.service import TicketService

        # Get alarm
        result = await self.session.execute(
            select(Alarm).where(and_(Alarm.id == alarm_id, Alarm.tenant_id == self.tenant_id))
        )
        alarm = result.scalar_one_or_none()
        if not alarm:
            raise ValueError(f"Alarm {alarm_id} not found")

        # Check if alarm already has a ticket
        if alarm.ticket_id:
            raise ValueError(
                f"Alarm {alarm_id} already has ticket {alarm.ticket_id}. "
                "Please update the existing ticket instead."
            )

        # Map alarm priority to ticket priority
        priority_mapping = {
            "critical": TicketPriority.CRITICAL,
            "major": TicketPriority.HIGH,
            "minor": TicketPriority.NORMAL,
            "warning": TicketPriority.LOW,
            "info": TicketPriority.LOW,
        }

        # Use provided priority or map from alarm severity
        if priority:
            ticket_priority = TicketPriority(priority)
        else:
            ticket_priority = priority_mapping.get(alarm.severity.value, TicketPriority.NORMAL)

        # Build ticket subject and message
        subject = f"[ALARM] {alarm.title}"

        message_parts = [
            "**Alarm Details:**",
            f"- **ID:** {alarm.alarm_id}",
            f"- **Severity:** {alarm.severity.value.upper()}",
            f"- **Source:** {alarm.source.value}",
            f"- **Type:** {alarm.alarm_type}",
            f"- **Status:** {alarm.status.value}",
            "",
            "**Description:**",
            alarm.description or "No description provided",
        ]

        if alarm.resource_type and alarm.resource_id:
            message_parts.extend(
                [
                    "",
                    "**Affected Resource:**",
                    f"- **Type:** {alarm.resource_type}",
                    f"- **ID:** {alarm.resource_id}",
                    f"- **Name:** {alarm.resource_name or 'N/A'}",
                ]
            )

        if alarm.customer_id:
            message_parts.extend(
                [
                    "",
                    "**Customer Impact:**",
                    f"- **Customer:** {alarm.customer_name or alarm.customer_id}",
                    f"- **Affected Subscribers:** {alarm.subscriber_count}",
                ]
            )

        if alarm.probable_cause:
            message_parts.extend(
                [
                    "",
                    "**Probable Cause:**",
                    alarm.probable_cause,
                ]
            )

        if alarm.recommended_action:
            message_parts.extend(
                [
                    "",
                    "**Recommended Action:**",
                    alarm.recommended_action,
                ]
            )

        if additional_notes:
            message_parts.extend(
                [
                    "",
                    "**Additional Notes:**",
                    additional_notes,
                ]
            )

        message_parts.extend(
            [
                "",
                "**Timing:**",
                f"- **First Occurrence:** {alarm.first_occurrence.isoformat()}",
                f"- **Last Occurrence:** {alarm.last_occurrence.isoformat()}",
                f"- **Occurrence Count:** {alarm.occurrence_count}",
            ]
        )

        message = "\n".join(message_parts)

        # Determine ticket type based on alarm type
        ticket_type = TicketType.FAULT
        if "outage" in alarm.alarm_type.lower():
            ticket_type = TicketType.OUTAGE
        elif "maintenance" in alarm.alarm_type.lower():
            ticket_type = TicketType.MAINTENANCE

        # Create ticket payload
        ticket_data = TicketCreate(
            subject=subject,
            message=message,
            target_type=TicketActorType.TENANT,
            priority=ticket_priority,
            metadata={
                "alarm_id": str(alarm.id),
                "external_alarm_id": alarm.alarm_id,
                "alarm_severity": alarm.severity.value,
                "alarm_source": alarm.source.value,
                "alarm_type": alarm.alarm_type,
                "resource_type": alarm.resource_type,
                "resource_id": alarm.resource_id,
                "created_from_alarm": True,
            },
            ticket_type=ticket_type,
            affected_services=[alarm.resource_type] if alarm.resource_type else [],
        )

        # Create ticket using ticket service
        ticket_service = TicketService(self.session)
        user_info = UserInfo(
            user_id=user_id,
            email="",  # Will be filled by ticket service
            role="",  # Will be filled by ticket service
        )

        ticket = await ticket_service.create_ticket(
            ticket_data,
            user_info,
            self.tenant_id,
        )

        # Update alarm with ticket reference
        alarm.ticket_id = ticket.id
        await self.session.commit()

        logger.info(
            "alarm.ticket_created",
            alarm_id=alarm_id,
            ticket_id=ticket.id,
            ticket_number=ticket.ticket_number,
            user_id=user_id,
        )

        return {
            "alarm_id": str(alarm.id),
            "ticket_id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
            "message": f"Ticket {ticket.ticket_number} created successfully from alarm",
        }

    # Alarm Rules

    async def create_rule(
        self, data: AlarmRuleCreate, user_id: UUID | None = None
    ) -> AlarmRuleResponse:
        """Create alarm rule"""
        rule = AlarmRule(
            tenant_id=self.tenant_id,
            name=data.name,
            description=data.description,
            rule_type=data.rule_type,
            enabled=data.enabled,
            priority=data.priority,
            conditions=data.conditions,
            actions=data.actions,
            time_window=data.time_window,
        )

        self.session.add(rule)
        await self.session.commit()
        await self.session.refresh(rule)

        logger.info("alarm_rule.created", rule_id=rule.id, name=rule.name)

        return AlarmRuleResponse.model_validate(rule)

    async def update_rule(
        self, rule_id: UUID, data: AlarmRuleUpdate, user_id: UUID | None = None
    ) -> AlarmRuleResponse | None:
        """Update alarm rule"""
        result = await self.session.execute(
            select(AlarmRule).where(
                and_(AlarmRule.id == rule_id, AlarmRule.tenant_id == self.tenant_id)
            )
        )

        rule = result.scalar_one_or_none()
        if not rule:
            return None

        if data.name is not None:
            rule.name = data.name
        if data.description is not None:
            rule.description = data.description
        if data.enabled is not None:
            rule.enabled = data.enabled
        if data.priority is not None:
            rule.priority = data.priority
        if data.conditions is not None:
            rule.conditions = data.conditions
        if data.actions is not None:
            rule.actions = data.actions
        if data.time_window is not None:
            rule.time_window = data.time_window

        await self.session.commit()
        await self.session.refresh(rule)

        logger.info("alarm_rule.updated", rule_id=rule_id)

        return AlarmRuleResponse.model_validate(rule)

    async def delete_rule(self, rule_id: UUID) -> bool:
        """Delete alarm rule"""
        result = await self.session.execute(
            select(AlarmRule).where(
                and_(AlarmRule.id == rule_id, AlarmRule.tenant_id == self.tenant_id)
            )
        )

        rule = result.scalar_one_or_none()
        if not rule:
            return False

        await self.session.delete(rule)
        await self.session.commit()

        logger.info("alarm_rule.deleted", rule_id=rule_id)

        return True

    async def list_rules(self) -> list[AlarmRuleResponse]:
        """List all alarm rules"""
        result = await self.session.execute(
            select(AlarmRule)
            .where(AlarmRule.tenant_id == self.tenant_id)
            .order_by(AlarmRule.priority)
        )

        rules = result.scalars().all()
        return [AlarmRuleResponse.model_validate(rule) for rule in rules]

    # Maintenance Windows

    async def create_maintenance_window(
        self, data: MaintenanceWindowCreate, user_id: UUID | None = None
    ) -> MaintenanceWindowResponse:
        """Create maintenance window"""
        window = MaintenanceWindow(
            tenant_id=self.tenant_id,
            title=data.title,
            description=data.description,
            start_time=data.start_time,
            end_time=data.end_time,
            timezone=data.timezone,
            affected_services=data.affected_services,
            affected_customers=data.affected_customers,
            affected_resources=data.affected_resources,
            suppress_alarms=data.suppress_alarms,
            notify_customers=data.notify_customers,
        )

        self.session.add(window)
        await self.session.commit()
        await self.session.refresh(window)

        logger.info("maintenance_window.created", window_id=window.id)

        return MaintenanceWindowResponse.model_validate(window)

    async def update_maintenance_window(
        self, window_id: UUID, data: MaintenanceWindowUpdate
    ) -> MaintenanceWindowResponse | None:
        """Update maintenance window"""
        result = await self.session.execute(
            select(MaintenanceWindow).where(
                and_(
                    MaintenanceWindow.id == window_id,
                    MaintenanceWindow.tenant_id == self.tenant_id,
                )
            )
        )

        window = result.scalar_one_or_none()
        if not window:
            return None

        if data.title is not None:
            window.title = data.title
        if data.description is not None:
            window.description = data.description
        if data.start_time is not None:
            window.start_time = data.start_time
        if data.end_time is not None:
            window.end_time = data.end_time
        if data.status is not None:
            window.status = data.status
        if data.suppress_alarms is not None:
            window.suppress_alarms = data.suppress_alarms

        await self.session.commit()
        await self.session.refresh(window)

        return MaintenanceWindowResponse.model_validate(window)

    async def _is_in_maintenance_window(
        self, resource_type: str | None, resource_id: str | None
    ) -> bool:
        """Check if resource is in active maintenance window"""
        if not resource_type or not resource_id:
            return False

        now = datetime.now(UTC)

        result = await self.session.execute(
            select(MaintenanceWindow).where(
                and_(
                    MaintenanceWindow.tenant_id == self.tenant_id,
                    MaintenanceWindow.status == "in_progress",
                    MaintenanceWindow.start_time <= now,
                    MaintenanceWindow.end_time >= now,
                    MaintenanceWindow.suppress_alarms == True,  # noqa: E712
                )
            )
        )

        windows = result.scalars().all()

        for window in windows:
            # Check if resource is affected
            affected_key = f"{resource_type}s"  # e.g., "devices", "services"
            if affected_key in window.affected_resources:
                affected_ids = window.affected_resources[affected_key]
                if resource_id in affected_ids:
                    return True

        return False
