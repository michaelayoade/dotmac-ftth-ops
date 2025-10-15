"""
Alarm Correlation Engine

Intelligent alarm correlation to reduce noise and identify root causes.
"""

import re
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import structlog
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmRule,
    AlarmSeverity,
    AlarmStatus,
    CorrelationAction,
)

logger = structlog.get_logger(__name__)


class CorrelationEngine:
    """
    Alarm correlation engine with rule-based processing.

    Implements:
    - Topology-based correlation
    - Time-based correlation
    - Pattern-based correlation
    - Flapping detection
    - Duplicate suppression
    """

    def __init__(self, session: AsyncSession, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id

    async def correlate(self, alarm: Alarm) -> None:
        """
        Correlate an alarm with existing alarms.

        Args:
            alarm: New alarm to correlate
        """
        logger.info(
            "correlation.start",
            alarm_id=alarm.id,
            alarm_type=alarm.alarm_type,
            resource_type=alarm.resource_type,
        )

        # Load active rules
        rules = await self._load_active_rules()

        # Try each rule in priority order
        for rule in rules:
            if await self._apply_rule(alarm, rule):
                logger.info(
                    "correlation.rule_applied",
                    alarm_id=alarm.id,
                    rule_name=rule.name,
                    action=alarm.correlation_action.value,
                )
                break

        # If no rules matched, check for duplicates
        if alarm.correlation_action == CorrelationAction.NONE:
            await self._check_duplicates(alarm)

        # Check for flapping
        await self._check_flapping(alarm)

        await self.session.commit()

    async def _load_active_rules(self) -> list[AlarmRule]:
        """Load active correlation rules ordered by priority"""
        result = await self.session.execute(
            select(AlarmRule)
            .where(
                and_(
                    AlarmRule.tenant_id == self.tenant_id,
                    AlarmRule.enabled == True,  # noqa: E712
                )
            )
            .order_by(AlarmRule.priority)
        )
        return list(result.scalars().all())

    async def _apply_rule(self, alarm: Alarm, rule: AlarmRule) -> bool:
        """
        Apply correlation rule to alarm.

        Returns:
            True if rule matched and was applied
        """
        if rule.rule_type != "correlation":
            return False

        conditions = rule.conditions
        actions = rule.actions

        # Check if alarm matches rule conditions
        if not await self._matches_conditions(alarm, conditions):
            return False

        # Look for potential parent alarm
        parent = await self._find_parent_alarm(alarm, conditions, rule.time_window)

        if parent:
            # Apply correlation
            await self._correlate_with_parent(alarm, parent, actions)
            return True

        # Check if this alarm could be a parent for others
        children = await self._find_child_alarms(alarm, conditions, rule.time_window)

        if children:
            # Mark this as root cause
            await self._mark_as_root_cause(alarm, children, actions)
            return True

        return False

    async def _matches_conditions(self, alarm: Alarm, conditions: dict[str, Any]) -> bool:
        """Check if alarm matches rule conditions"""
        child_conditions = conditions.get("child", {})

        for field, pattern in child_conditions.items():
            alarm_value = getattr(alarm, field, None)

            if alarm_value is None:
                return False

            # String pattern matching
            if isinstance(pattern, str):
                if isinstance(alarm_value, str):
                    if not re.match(pattern, alarm_value):
                        return False
                elif str(alarm_value) != pattern:
                    return False

            # Exact match
            elif alarm_value != pattern:
                return False

        return True

    async def _find_parent_alarm(
        self, alarm: Alarm, conditions: dict[str, Any], time_window: int
    ) -> Alarm | None:
        """Find potential parent alarm based on conditions"""
        parent_conditions = conditions.get("parent", {})

        if not parent_conditions:
            return None

        # Build query for parent alarm
        filters = [
            Alarm.tenant_id == self.tenant_id,
            Alarm.status.in_([AlarmStatus.ACTIVE, AlarmStatus.ACKNOWLEDGED]),
            Alarm.first_occurrence
            >= datetime.now(UTC) - timedelta(seconds=time_window),
        ]

        # Add condition filters
        for field, value in parent_conditions.items():
            if hasattr(Alarm, field):
                filters.append(getattr(Alarm, field) == value)

        result = await self.session.execute(
            select(Alarm).where(and_(*filters)).order_by(Alarm.first_occurrence).limit(1)
        )

        return result.scalar_one_or_none()

    async def _find_child_alarms(
        self, alarm: Alarm, conditions: dict[str, Any], time_window: int
    ) -> list[Alarm]:
        """Find potential child alarms that should correlate to this one"""
        child_conditions = conditions.get("child", {})

        if not child_conditions:
            return []

        # Build query for child alarms
        filters = [
            Alarm.tenant_id == self.tenant_id,
            Alarm.status.in_([AlarmStatus.ACTIVE, AlarmStatus.ACKNOWLEDGED]),
            Alarm.id != alarm.id,
            Alarm.first_occurrence >= alarm.first_occurrence,
            Alarm.first_occurrence
            <= alarm.first_occurrence + timedelta(seconds=time_window),
        ]

        # Add condition filters
        for field, value in child_conditions.items():
            if hasattr(Alarm, field):
                filters.append(getattr(Alarm, field) == value)

        result = await self.session.execute(select(Alarm).where(and_(*filters)))

        return list(result.scalars().all())

    async def _correlate_with_parent(
        self, alarm: Alarm, parent: Alarm, actions: dict[str, Any]
    ) -> None:
        """Correlate alarm with parent alarm"""
        # Get or create correlation ID
        if parent.correlation_id:
            correlation_id = parent.correlation_id
        else:
            correlation_id = uuid4()
            parent.correlation_id = correlation_id
            parent.is_root_cause = True

        # Update child alarm
        alarm.correlation_id = correlation_id
        alarm.parent_alarm_id = parent.id
        alarm.correlation_action = CorrelationAction.CHILD_ALARM

        # Apply actions
        if actions.get("suppress_child_alarms"):
            alarm.status = AlarmStatus.SUPPRESSED

        logger.info(
            "correlation.parent_found",
            child_alarm_id=alarm.id,
            parent_alarm_id=parent.id,
            correlation_id=correlation_id,
        )

    async def _mark_as_root_cause(
        self, alarm: Alarm, children: list[Alarm], actions: dict[str, Any]
    ) -> None:
        """Mark alarm as root cause and correlate children"""
        correlation_id = uuid4()

        # Mark as root cause
        alarm.correlation_id = correlation_id
        alarm.is_root_cause = True
        alarm.correlation_action = CorrelationAction.ROOT_CAUSE

        # Correlate children
        for child in children:
            child.correlation_id = correlation_id
            child.parent_alarm_id = alarm.id
            child.correlation_action = CorrelationAction.CHILD_ALARM

            if actions.get("suppress_child_alarms"):
                child.status = AlarmStatus.SUPPRESSED

        logger.info(
            "correlation.root_cause_identified",
            alarm_id=alarm.id,
            child_count=len(children),
            correlation_id=correlation_id,
        )

    async def _check_duplicates(self, alarm: Alarm) -> None:
        """Check for duplicate alarms"""
        # Look for active alarm with same external ID
        result = await self.session.execute(
            select(Alarm).where(
                and_(
                    Alarm.tenant_id == self.tenant_id,
                    Alarm.alarm_id == alarm.alarm_id,
                    Alarm.id != alarm.id,
                    Alarm.status.in_([AlarmStatus.ACTIVE, AlarmStatus.ACKNOWLEDGED]),
                )
            )
        )

        existing = result.scalar_one_or_none()

        if existing:
            # Update existing alarm occurrence count
            existing.occurrence_count += 1
            existing.last_occurrence = datetime.now(UTC)

            # Mark new alarm as duplicate
            alarm.correlation_id = existing.correlation_id or existing.id
            alarm.parent_alarm_id = existing.id
            alarm.correlation_action = CorrelationAction.DUPLICATE
            alarm.status = AlarmStatus.SUPPRESSED

            logger.info(
                "correlation.duplicate_found",
                alarm_id=alarm.id,
                original_alarm_id=existing.id,
                occurrence_count=existing.occurrence_count,
            )

    async def _check_flapping(self, alarm: Alarm) -> None:
        """Check if alarm is flapping"""
        # Look for recent occurrences of same alarm
        time_window = timedelta(minutes=15)  # Configurable

        result = await self.session.execute(
            select(Alarm).where(
                and_(
                    Alarm.tenant_id == self.tenant_id,
                    Alarm.alarm_type == alarm.alarm_type,
                    Alarm.resource_id == alarm.resource_id,
                    Alarm.first_occurrence >= datetime.now(UTC) - time_window,
                )
            )
        )

        recent_alarms = list(result.scalars().all())

        # Flapping if more than 5 occurrences in window
        if len(recent_alarms) >= 5:
            alarm.correlation_action = CorrelationAction.FLAPPING
            alarm.status = AlarmStatus.SUPPRESSED

            logger.warning(
                "correlation.flapping_detected",
                alarm_id=alarm.id,
                alarm_type=alarm.alarm_type,
                resource_id=alarm.resource_id,
                occurrence_count=len(recent_alarms),
            )

    async def clear_correlation(self, alarm_id: UUID) -> None:
        """
        Clear alarm and its correlated children.

        Args:
            alarm_id: ID of alarm to clear
        """
        result = await self.session.execute(select(Alarm).where(Alarm.id == alarm_id))
        alarm = result.scalar_one_or_none()

        if not alarm:
            return

        # Clear the alarm
        alarm.status = AlarmStatus.CLEARED
        alarm.cleared_at = datetime.now(UTC)

        # If this is a root cause, clear children
        if alarm.is_root_cause and alarm.correlation_id:
            result = await self.session.execute(
                select(Alarm).where(
                    and_(
                        Alarm.correlation_id == alarm.correlation_id,
                        Alarm.id != alarm.id,
                        Alarm.status != AlarmStatus.CLEARED,
                    )
                )
            )

            children = result.scalars().all()

            for child in children:
                child.status = AlarmStatus.CLEARED
                child.cleared_at = datetime.now(UTC)

            logger.info(
                "correlation.cleared_with_children",
                alarm_id=alarm_id,
                child_count=len(children),
            )

        await self.session.commit()

    async def get_correlation_group(self, correlation_id: UUID) -> list[Alarm]:
        """Get all alarms in a correlation group"""
        result = await self.session.execute(
            select(Alarm)
            .where(Alarm.correlation_id == correlation_id)
            .order_by(Alarm.is_root_cause.desc(), Alarm.first_occurrence)
        )

        return list(result.scalars().all())

    async def recorrelate_all(self) -> int:
        """
        Recorrelate all active alarms.

        Useful after rule changes or for periodic cleanup.

        Returns:
            Number of alarms recorrelated
        """
        result = await self.session.execute(
            select(Alarm).where(
                and_(
                    Alarm.tenant_id == self.tenant_id,
                    Alarm.status.in_([AlarmStatus.ACTIVE, AlarmStatus.ACKNOWLEDGED]),
                )
            )
        )

        alarms = list(result.scalars().all())

        # Reset correlation
        for alarm in alarms:
            alarm.correlation_id = None
            alarm.parent_alarm_id = None
            alarm.is_root_cause = False
            alarm.correlation_action = CorrelationAction.NONE

        await self.session.commit()

        # Recorrelate
        for alarm in alarms:
            await self.correlate(alarm)

        logger.info("correlation.recorrelate_complete", alarm_count=len(alarms))

        return len(alarms)
