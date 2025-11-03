"""
Alarm Correlation Engine

Intelligent alarm correlation to reduce noise and identify root causes.
"""

import re
from datetime import datetime, timedelta, timezone

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = timezone.utc
from typing import Any
from uuid import UUID, uuid4

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmRule,
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

    def _normalize_rule_conditions(self, rule: AlarmRule) -> tuple[dict[str, Any], int]:
        """Normalize legacy rule conditions into parent/child mappings."""
        conditions = rule.conditions or {}
        time_window = rule.time_window or 300

        if "time_window_seconds" in conditions:
            time_window = int(conditions["time_window_seconds"])
        elif "time_window_minutes" in conditions:
            time_window = int(conditions["time_window_minutes"]) * 60

        # Already normalized structure
        parent_filters: dict[str, Any]
        child_filters: dict[str, Any]

        if "parent" in conditions or "child" in conditions:
            parent_filters = conditions.get("parent") or {}
            child_filters = conditions.get("child") or {}
            return {"parent": parent_filters, "child": child_filters}, time_window

        parent_filters = {}
        child_filters = {}

        if parent_alarm_type := conditions.get("parent_alarm_type"):
            parent_filters["alarm_type"] = parent_alarm_type
        if parent_resource_type := conditions.get("parent_resource_type"):
            parent_filters["resource_type"] = parent_resource_type
        if parent_resource_id := conditions.get("parent_resource_id"):
            parent_filters["resource_id"] = parent_resource_id
        if parent_pattern := conditions.get("parent_pattern"):
            parent_filters["title"] = re.compile(parent_pattern, re.IGNORECASE)

        if child_alarm_type := conditions.get("child_alarm_type"):
            child_filters["alarm_type"] = child_alarm_type
        if child_resource_type := conditions.get("child_resource_type"):
            child_filters["resource_type"] = child_resource_type
        if child_resource_id := conditions.get("child_resource_id"):
            child_filters["resource_id"] = child_resource_id
        if child_pattern := conditions.get("child_pattern"):
            child_filters["title"] = re.compile(child_pattern, re.IGNORECASE)

        return {"parent": parent_filters, "child": child_filters}, time_window

    def _matches_fields(self, alarm: Alarm, criteria: dict[str, Any]) -> bool:
        """Check whether an alarm matches the provided criteria."""
        if not criteria:
            return False

        for field, expected in criteria.items():
            value = getattr(alarm, field, None)

            if value is None:
                return False

            if isinstance(expected, re.Pattern):
                if not isinstance(value, str) or not expected.search(value):
                    return False
                continue

            compare_value = value.value if hasattr(value, "value") else value

            if compare_value != expected:
                return False

        return True

    def _matches_simple_conditions(self, alarm: Alarm, conditions: dict[str, Any]) -> bool:
        """Match flat rule conditions (used for suppression rules)."""
        if not conditions:
            return False

        for field, expected in conditions.items():
            value = getattr(alarm, field, None)

            if value is None:
                return False

            compare_value = value.value if hasattr(value, "value") else value

            if isinstance(expected, str):
                if not re.fullmatch(expected, str(compare_value)):
                    return False
            else:
                if compare_value != expected:
                    return False

        return True

    def _determine_role(self, alarm: Alarm, conditions: dict[str, Any]) -> str:
        """Determine whether alarm acts as parent or child for the rule."""
        child_conditions = conditions.get("child") or {}
        parent_conditions = conditions.get("parent") or {}

        if child_conditions and self._matches_fields(alarm, child_conditions):
            return "child"
        if parent_conditions and self._matches_fields(alarm, parent_conditions):
            return "parent"

        # Fallback: if only parent conditions provided and empty, treat as parent
        if parent_conditions and not child_conditions:
            return "parent"

        return "unknown"

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

        # Group similar alarms (same type/resource) when still uncorrelated
        if alarm.correlation_action == CorrelationAction.NONE:
            await self._group_similar(alarm)

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
        if rule.rule_type == "suppression":
            if self._matches_simple_conditions(alarm, rule.conditions or {}):
                alarm.status = AlarmStatus.SUPPRESSED
                alarm.correlation_action = CorrelationAction.NONE
                logger.info(
                    "correlation.suppression_applied",
                    alarm_id=alarm.id,
                    rule_name=rule.name,
                )
                return True
            return False

        if rule.rule_type != "correlation":
            return False

        conditions, time_window = self._normalize_rule_conditions(rule)
        actions = rule.actions

        role = self._determine_role(alarm, conditions)

        if role == "unknown":
            return False

        if role == "child":
            parent = await self._find_parent_alarm(alarm, conditions, time_window)

            if parent:
                # Apply correlation
                await self._correlate_with_parent(alarm, parent, actions)
                return True

        elif role == "parent":
            children = await self._find_child_alarms(alarm, conditions, time_window)

            if children:
                await self._mark_as_root_cause(alarm, children, actions)
                return True

            if actions.get("mark_root_cause"):
                await self._mark_as_root_cause(alarm, [], actions)
                return True

        return False

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
            Alarm.first_occurrence >= datetime.now(UTC) - timedelta(seconds=time_window),
            Alarm.id != alarm.id,
        ]

        for field, value in parent_conditions.items():
            if isinstance(value, re.Pattern):
                continue
            if hasattr(Alarm, field):
                filters.append(getattr(Alarm, field) == value)

        result = await self.session.execute(
            select(Alarm).where(and_(*filters)).order_by(Alarm.first_occurrence).limit(1)
        )

        candidate = result.scalar_one_or_none()

        if candidate and (
            not parent_conditions or self._matches_fields(candidate, parent_conditions)
        ):
            return candidate

        return None

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
            Alarm.first_occurrence <= alarm.first_occurrence + timedelta(seconds=time_window),
        ]

        for field, value in child_conditions.items():
            if isinstance(value, re.Pattern):
                continue
            if hasattr(Alarm, field):
                filters.append(getattr(Alarm, field) == value)

        result = await self.session.execute(select(Alarm).where(and_(*filters)))

        candidates = list(result.scalars().all())

        if not child_conditions:
            return candidates

        return [
            candidate
            for candidate in candidates
            if self._matches_fields(candidate, child_conditions)
        ]

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
        correlation_id = alarm.correlation_id or uuid4()

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
            # Ensure the anchor alarm carries a correlation identifier
            if not existing.correlation_id:
                existing.correlation_id = existing.id
                existing.is_root_cause = True
                existing.correlation_action = CorrelationAction.ROOT_CAUSE

            # Update existing alarm occurrence count
            existing.occurrence_count += 1
            existing.last_occurrence = datetime.now(UTC)

            # Mark new alarm as duplicate
            alarm.correlation_id = existing.correlation_id
            alarm.parent_alarm_id = existing.id
            alarm.correlation_action = CorrelationAction.DUPLICATE
            alarm.status = AlarmStatus.SUPPRESSED
            alarm.is_root_cause = False

            logger.info(
                "correlation.duplicate_found",
                alarm_id=alarm.id,
                original_alarm_id=existing.id,
                occurrence_count=existing.occurrence_count,
            )

    async def _group_similar(self, alarm: Alarm) -> None:
        """Group alarms with matching type and resource within a short window."""
        window = timedelta(minutes=5)

        result = await self.session.execute(
            select(Alarm)
            .where(
                and_(
                    Alarm.tenant_id == self.tenant_id,
                    Alarm.id != alarm.id,
                    Alarm.alarm_type == alarm.alarm_type,
                    Alarm.resource_id == alarm.resource_id,
                    Alarm.status.in_([AlarmStatus.ACTIVE, AlarmStatus.ACKNOWLEDGED]),
                    Alarm.first_occurrence >= alarm.first_occurrence - window,
                )
            )
            .order_by(Alarm.first_occurrence.asc())
        )

        similar = list(result.scalars().all())

        if not similar:
            if not alarm.correlation_id:
                alarm.correlation_id = alarm.id
                alarm.is_root_cause = True
                alarm.correlation_action = CorrelationAction.ROOT_CAUSE
            return

        anchor = similar[0]

        if not anchor.correlation_id:
            anchor.correlation_id = anchor.id
            anchor.is_root_cause = True
            anchor.correlation_action = CorrelationAction.ROOT_CAUSE

        alarm.correlation_id = anchor.correlation_id
        alarm.parent_alarm_id = anchor.id
        alarm.correlation_action = CorrelationAction.CHILD_ALARM
        alarm.is_root_cause = False

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
            alarm.correlation_id = None  # type: ignore[assignment]
            alarm.parent_alarm_id = None  # type: ignore[assignment]
            alarm.is_root_cause = False
            alarm.correlation_action = CorrelationAction.NONE

        await self.session.commit()

        # Recorrelate
        for alarm in alarms:
            await self.correlate(alarm)

        logger.info("correlation.recorrelate_complete", alarm_count=len(alarms))

        return len(alarms)
