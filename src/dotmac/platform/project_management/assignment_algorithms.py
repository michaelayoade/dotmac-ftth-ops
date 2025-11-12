"""
Smart Task Assignment Algorithms

Intelligent algorithms for assigning tasks to technicians based on multiple criteria:
- Skills & certifications
- Location & travel time
- Workload balancing
- SLA compliance
- Equipment availability
"""

import math
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.field_service.models import Technician, TechnicianStatus
from dotmac.platform.project_management.models import Task
from dotmac.platform.project_management.scheduling_models import (
    AssignmentStatus,
    ScheduleStatus,
    TaskAssignment,
    TechnicianSchedule,
)

logger = structlog.get_logger(__name__)


@dataclass
class AssignmentScore:
    """
    Score breakdown for a technician-task assignment.

    Higher scores are better. Total score is weighted sum of components.
    """

    technician_id: UUID
    technician_name: str

    # Score components (0-100 each)
    skill_match_score: float = 0.0
    location_score: float = 0.0
    availability_score: float = 0.0
    workload_score: float = 0.0
    priority_score: float = 0.0
    certification_score: float = 0.0

    # Metadata
    distance_km: float | None = None
    travel_time_minutes: int | None = None
    current_workload: int = 0
    missing_skills: list[str] = field(default_factory=list)
    missing_certifications: list[str] = field(default_factory=list)

    # Component weights (must sum to 1.0)
    SKILL_WEIGHT = 0.35
    LOCATION_WEIGHT = 0.25
    AVAILABILITY_WEIGHT = 0.20
    WORKLOAD_WEIGHT = 0.15
    CERTIFICATION_WEIGHT = 0.05

    @property
    def total_score(self) -> float:
        """Calculate weighted total score"""
        return (
            self.skill_match_score * self.SKILL_WEIGHT
            + self.location_score * self.LOCATION_WEIGHT
            + self.availability_score * self.AVAILABILITY_WEIGHT
            + self.workload_score * self.WORKLOAD_WEIGHT
            + self.certification_score * self.CERTIFICATION_WEIGHT
        )

    @property
    def is_qualified(self) -> bool:
        """Check if technician meets minimum requirements"""
        # Must have all required skills and certifications
        return self.skill_match_score >= 100.0 and self.certification_score >= 100.0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API response"""
        return {
            "technician_id": str(self.technician_id),
            "technician_name": self.technician_name,
            "total_score": round(self.total_score, 2),
            "is_qualified": self.is_qualified,
            "breakdown": {
                "skill_match": round(self.skill_match_score, 2),
                "location": round(self.location_score, 2),
                "availability": round(self.availability_score, 2),
                "workload": round(self.workload_score, 2),
                "certification": round(self.certification_score, 2),
            },
            "metadata": {
                "distance_km": round(self.distance_km, 2) if self.distance_km else None,
                "travel_time_minutes": self.travel_time_minutes,
                "current_workload": self.current_workload,
                "missing_skills": self.missing_skills or [],
                "missing_certifications": self.missing_certifications or [],
            },
        }


class TaskAssignmentAlgorithm:
    """
    Smart task assignment algorithm that scores technicians based on multiple criteria.
    """

    def __init__(self, session: AsyncSession, tenant_id: str):
        self.session = session
        self.tenant_id = tenant_id

    async def find_best_technician(
        self,
        task: Task,
        scheduled_start: datetime,
        scheduled_end: datetime,
        required_skills: dict[str, bool] | None = None,
        required_certifications: list[str] | None = None,
        task_location: tuple[float, float] | None = None,
        max_candidates: int = 10,
    ) -> list[AssignmentScore]:
        """
        Find the best technicians for a task, ranked by score.

        Args:
            task: Task to assign
            scheduled_start: When task should start
            scheduled_end: When task should end
            required_skills: Skills needed for task
            required_certifications: Certifications needed
            task_location: (lat, lng) tuple for task location
            max_candidates: Max number of candidates to return

        Returns:
            List of AssignmentScore objects, sorted by total_score descending
        """
        logger.info(
            "Finding best technician for task",
            task_id=str(task.id),
            scheduled_start=scheduled_start.isoformat(),
        )

        # Get all active technicians
        technicians = await self._get_available_technicians(
            scheduled_start,
            scheduled_end,
        )

        if not technicians:
            logger.warning("No available technicians found", tenant_id=self.tenant_id)
            return []

        # Score each technician
        scores = []
        for tech in technicians:
            score = await self._score_technician(
                technician=tech,
                task=task,
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_end,
                required_skills=required_skills or {},
                required_certifications=required_certifications or [],
                task_location=task_location,
            )
            scores.append(score)

        # Sort by total score (highest first)
        scores.sort(key=lambda x: x.total_score, reverse=True)

        # Return top candidates
        top_candidates = scores[:max_candidates]

        logger.info(
            "Found technician candidates",
            task_id=str(task.id),
            candidates=len(top_candidates),
            best_score=round(top_candidates[0].total_score, 2) if top_candidates else 0,
        )

        return top_candidates

    async def _get_available_technicians(
        self,
        start_time: datetime,
        end_time: datetime,
    ) -> list[Technician]:
        """Get technicians who are potentially available during the time window"""

        # Query for active technicians
        query = select(Technician).where(
            and_(
                Technician.tenant_id == self.tenant_id,
                Technician.is_active,
                Technician.status.in_(
                    [
                        TechnicianStatus.AVAILABLE,
                        TechnicianStatus.ON_JOB,  # Might have capacity
                    ]
                ),
            )
        )

        result = await self.session.execute(query)
        technicians = list(result.scalars().all())

        logger.debug(
            "Found potentially available technicians",
            count=len(technicians),
            tenant_id=self.tenant_id,
        )

        return technicians

    async def _score_technician(
        self,
        technician: Technician,
        task: Task,
        scheduled_start: datetime,
        scheduled_end: datetime,
        required_skills: dict[str, bool],
        required_certifications: list[str],
        task_location: tuple[float, float] | None,
    ) -> AssignmentScore:
        """Score a technician for this task"""

        score = AssignmentScore(
            technician_id=technician.id,
            technician_name=technician.full_name,
        )

        # 1. Skill matching (35% weight)
        score.skill_match_score, score.missing_skills = self._score_skills(
            technician,
            required_skills,
        )

        # 2. Location/distance (25% weight)
        if task_location:
            (
                score.location_score,
                score.distance_km,
                score.travel_time_minutes,
            ) = self._score_location(technician, task_location)
        else:
            score.location_score = 50.0  # Neutral score if location unknown

        # 3. Availability (20% weight)
        score.availability_score = await self._score_availability(
            technician,
            scheduled_start,
            scheduled_end,
        )

        # 4. Workload balancing (15% weight)
        score.workload_score, score.current_workload = await self._score_workload(
            technician,
            scheduled_start.date(),
        )

        # 5. Certifications (5% weight)
        score.certification_score, score.missing_certifications = self._score_certifications(
            technician,
            required_certifications,
        )

        return score

    def _score_skills(
        self,
        technician: Technician,
        required_skills: dict[str, bool],
    ) -> tuple[float, list[str]]:
        """
        Score technician's skill match.

        Returns:
            (score, missing_skills)
            - score: 100 if all skills present, proportional if partial
            - missing_skills: List of missing skill names
        """
        if not required_skills:
            return 100.0, []

        tech_skills = technician.skills or {}

        matched = 0
        missing = []

        for skill, required in required_skills.items():
            if not required:
                continue  # Skill is optional

            if tech_skills.get(skill, False):
                matched += 1
            else:
                missing.append(skill)

        total_required = sum(1 for v in required_skills.values() if v)

        if total_required == 0:
            return 100.0, []

        score = (matched / total_required) * 100
        return score, missing

    def _score_location(
        self,
        technician: Technician,
        task_location: tuple[float, float],
    ) -> tuple[float, float, int]:
        """
        Score based on distance from technician to task.

        Returns:
            (score, distance_km, travel_time_minutes)
            - score: 100 for <5km, decreasing to 0 at 50km+
            - distance_km: Haversine distance
            - travel_time_minutes: Estimated travel time
        """
        task_lat, task_lng = task_location
        tech_lat = technician.current_lat
        tech_lng = technician.current_lng

        if tech_lat is None or tech_lng is None:
            return 50.0, float("inf"), 9999

        # Calculate Haversine distance
        distance_km = self._calculate_distance(
            float(tech_lat),
            float(tech_lng),
            task_lat,
            task_lng,
        )

        # Estimate travel time (assume 40 km/h average speed in city)
        travel_time_minutes = int((distance_km / 40) * 60)

        # Score: 100 for <5km, linear decrease to 0 at 50km
        if distance_km < 5:
            score = 100.0
        elif distance_km > 50:
            score = 0.0
        else:
            # Linear interpolation between 100 and 0
            score = 100.0 - ((distance_km - 5) / 45) * 100

        return score, distance_km, travel_time_minutes

    @staticmethod
    def _calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """
        Calculate Haversine distance between two points in kilometers.
        """
        R = 6371  # Earth's radius in km

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)

        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        distance = R * c
        return distance

    async def _score_availability(
        self,
        technician: Technician,
        scheduled_start: datetime,
        scheduled_end: datetime,
    ) -> float:
        """
        Score technician's availability during the time window.

        Returns:
            score: 100 if fully available, 0 if busy/conflicting assignment
        """
        # Check for schedule on this date
        schedule_date = scheduled_start.date()

        schedule_query = select(TechnicianSchedule).where(
            and_(
                TechnicianSchedule.technician_id == technician.id,
                TechnicianSchedule.schedule_date == schedule_date,
            )
        )

        result = await self.session.execute(schedule_query)
        schedule = result.scalar_one_or_none()

        # No schedule = not available
        if not schedule:
            return 0.0

        # Check schedule status
        if schedule.status != ScheduleStatus.AVAILABLE:
            return 0.0

        # Check for conflicting assignments
        conflict_query = select(func.count(TaskAssignment.id)).where(
            and_(
                TaskAssignment.technician_id == technician.id,
                TaskAssignment.status.in_(
                    [
                        AssignmentStatus.SCHEDULED,
                        AssignmentStatus.CONFIRMED,
                        AssignmentStatus.IN_PROGRESS,
                    ]
                ),
                # Time overlap check
                TaskAssignment.scheduled_start < scheduled_end,
                TaskAssignment.scheduled_end > scheduled_start,
            )
        )

        conflict_result = await self.session.execute(conflict_query)
        raw_conflicts = conflict_result.scalar()
        conflicts = raw_conflicts if isinstance(raw_conflicts, int) else 0

        if conflicts > 0:
            return 0.0  # Hard conflict

        # Check if within working hours
        if schedule.shift_start and schedule.shift_end:
            task_start_time = scheduled_start.time()
            task_end_time = scheduled_end.time()

            if task_start_time < schedule.shift_start or task_end_time > schedule.shift_end:
                return 50.0  # Outside normal hours but might be acceptable

        # Fully available
        return 100.0

    async def _score_workload(
        self,
        technician: Technician,
        schedule_date: date,
    ) -> tuple[float, int]:
        """
        Score based on current workload to balance assignments.

        Returns:
            (score, current_workload)
            - score: 100 for low workload, decreasing with more tasks
            - current_workload: Number of tasks assigned this day
        """
        # Count tasks assigned to this technician on this date
        workload_query = select(func.count(TaskAssignment.id)).where(
            and_(
                TaskAssignment.technician_id == technician.id,
                TaskAssignment.status.in_(
                    [
                        AssignmentStatus.SCHEDULED,
                        AssignmentStatus.CONFIRMED,
                        AssignmentStatus.IN_PROGRESS,
                    ]
                ),
                func.date(TaskAssignment.scheduled_start) == schedule_date,
            )
        )

        result = await self.session.execute(workload_query)
        current_workload = result.scalar() or 0

        # Score: 100 for 0-2 tasks, decreasing to 0 at 8+ tasks
        if current_workload <= 2:
            score = 100.0
        elif current_workload >= 8:
            score = 0.0
        else:
            # Linear decrease from 100 to 0
            score = 100.0 - ((current_workload - 2) / 6) * 100

        return score, current_workload

    def _score_certifications(
        self,
        technician: Technician,
        required_certifications: list[str],
    ) -> tuple[float, list[str]]:
        """
        Score based on certifications.

        Returns:
            (score, missing_certifications)
        """
        if not required_certifications:
            return 100.0, []

        tech_certs = technician.certifications or []
        tech_cert_names = {
            cert.get("name", "").lower() for cert in tech_certs if isinstance(cert, dict)
        }

        missing = []
        matched = 0

        for required_cert in required_certifications:
            if required_cert.lower() in tech_cert_names:
                matched += 1
            else:
                missing.append(required_cert)

        score = (matched / len(required_certifications)) * 100
        return score, missing


async def assign_task_automatically(
    session: AsyncSession,
    tenant_id: str,
    task: Task,
    scheduled_start: datetime,
    scheduled_end: datetime,
    required_skills: dict[str, bool] | None = None,
    required_certifications: list[str] | None = None,
    task_location: tuple[float, float] | None = None,
) -> TaskAssignment | None:
    """
    Automatically assign a task to the best available technician.

    Args:
        session: Database session
        tenant_id: Tenant ID
        task: Task to assign
        scheduled_start: Scheduled start time
        scheduled_end: Scheduled end time
        required_skills: Required skills dict
        required_certifications: Required certifications list
        task_location: Task location (lat, lng)

    Returns:
        TaskAssignment if successful, None if no suitable technician found
    """
    algorithm = TaskAssignmentAlgorithm(session, tenant_id)

    candidates = await algorithm.find_best_technician(
        task=task,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        required_skills=required_skills,
        required_certifications=required_certifications,
        task_location=task_location,
        max_candidates=5,
    )

    if not candidates:
        logger.warning("No candidates found for task", task_id=str(task.id))
        return None

    # Take the best qualified candidate
    best = candidates[0]

    if not best.is_qualified:
        logger.warning(
            "Best candidate is not qualified",
            task_id=str(task.id),
            technician_id=str(best.technician_id),
            missing_skills=best.missing_skills,
            missing_certifications=best.missing_certifications,
        )
        return None

    # Create assignment
    assignment = TaskAssignment(
        tenant_id=tenant_id,
        task_id=task.id,
        technician_id=best.technician_id,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        status=AssignmentStatus.SCHEDULED,
        assignment_method="auto",
        assignment_score=best.total_score,
        travel_time_minutes=best.travel_time_minutes,
        travel_distance_km=best.distance_km,
    )

    if task_location:
        assignment.task_location_lat = task_location[0]
        assignment.task_location_lng = task_location[1]

    session.add(assignment)

    logger.info(
        "Task automatically assigned",
        task_id=str(task.id),
        technician_id=str(best.technician_id),
        score=round(best.total_score, 2),
    )

    return assignment
