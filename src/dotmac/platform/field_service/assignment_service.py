"""
Technician Assignment Service

Intelligent job assignment based on location, skills, and availability.
"""

from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any, cast
from uuid import UUID

import structlog
from sqlalchemy import and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from dotmac.platform.field_service.models import (
    Technician,
    TechnicianAvailability,
    TechnicianSkillLevel,
    TechnicianStatus,
)

logger = structlog.get_logger(__name__)


class TechnicianAssignmentService:
    """
    Service for assigning jobs to technicians based on multiple criteria.

    Assignment algorithm considers:
    - Technician availability status
    - Geographic distance from job site
    - Required skills match
    - Current workload
    - Working hours/schedule
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def find_best_technician(
        self,
        tenant_id: str,
        job_location: Mapping[str, float],  # {"lat": float, "lng": float}
        required_skills: list[str] | None = None,
        priority: str = "normal",
        scheduled_time: datetime | None = None,
    ) -> Technician | None:
        """
        Find the best available technician for a job.

        Args:
            tenant_id: Tenant ID
            job_location: Job location {"lat": 6.5244, "lng": 3.3792}
            required_skills: List of required skills ["fiber_splicing", "ont_config"]
            priority: Job priority ("normal", "high", "urgent")
            scheduled_time: When the job is scheduled (None = ASAP)

        Returns:
            Best matching technician or None if no match found
        """
        lat = job_location.get("lat")
        lng = job_location.get("lng")

        if lat is None or lng is None:
            logger.warning("Job location missing, cannot assign by proximity")
            return await self._find_any_available_technician(tenant_id, required_skills)

        # Get all available technicians
        available_techs = await self._get_available_technicians(
            tenant_id=tenant_id,
            scheduled_time=scheduled_time,
        )

        if not available_techs:
            logger.warning(
                "No available technicians found",
                tenant_id=tenant_id,
                scheduled_time=scheduled_time,
            )
            return None

        # Filter by required skills
        if required_skills:
            available_techs = [
                tech for tech in available_techs if self._has_required_skills(tech, required_skills)
            ]

        if not available_techs:
            logger.warning(
                "No technicians with required skills found",
                tenant_id=tenant_id,
                required_skills=required_skills,
            )
            return None

        # Calculate distance and score for each technician
        scored_techs: list[tuple[Technician, float, float]] = []
        for tech in available_techs:
            distance = tech.distance_from(lat, lng)
            if distance is None:
                # Technician location unknown, give lower priority
                distance = 9999.0

            score = self._calculate_technician_score(
                tech=tech,
                distance_km=distance,
                priority=priority,
            )

            scored_techs.append((tech, distance, score))

        # Sort by score (higher is better)
        scored_techs.sort(key=lambda item: item[2], reverse=True)

        best_technician, best_distance, best_score = scored_techs[0]
        logger.info(
            "Best technician found",
            technician_id=best_technician.id,
            technician_name=best_technician.full_name,
            distance_km=round(best_distance, 2),
            score=round(best_score, 2),
        )

        return best_technician

    async def assign_technician_to_job(
        self,
        job_id: UUID,
        technician: Technician,
        scheduled_start: datetime | None = None,
        scheduled_end: datetime | None = None,
    ) -> bool:
        """
        Assign a technician to a job and update statuses.

        Args:
            job_id: Job ID to assign
            technician: Technician to assign
            scheduled_start: Scheduled start time
            scheduled_end: Scheduled end time

        Returns:
            True if assignment successful, False otherwise
        """
        try:
            from dotmac.platform.jobs.models import Job

            # Get the job
            result = await self.session.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()

            if not job:
                logger.error("Job not found for assignment", job_id=job_id)
                return False

            job_untyped = cast(Any, job)

            # Update job with technician assignment
            job_untyped.assigned_technician_id = technician.id
            job_untyped.assigned_to = str(technician.id)  # Legacy field
            job_untyped.scheduled_start = scheduled_start or datetime.utcnow()
            job_untyped.scheduled_end = scheduled_end or (
                (scheduled_start or datetime.utcnow()) + timedelta(hours=2)
            )

            # Update job status to assigned
            if job_untyped.status == "pending":
                job_untyped.status = "assigned"

            # Update technician status if they're currently available
            if technician.status == TechnicianStatus.AVAILABLE:
                technician.status = TechnicianStatus.ON_JOB

            await self.session.commit()

            logger.info(
                "Technician assigned to job",
                job_id=job_id,
                technician_id=technician.id,
                technician_name=technician.full_name,
            )

            return True

        except Exception as e:
            await self.session.rollback()
            logger.error(
                "Failed to assign technician to job",
                job_id=job_id,
                technician_id=technician.id,
                error=str(e),
                exc_info=True,
            )
            return False

    async def _get_available_technicians(
        self,
        tenant_id: str,
        scheduled_time: datetime | None = None,
    ) -> list[Technician]:
        """Get all available technicians for the tenant."""
        query_time = scheduled_time or datetime.utcnow()

        # Base query: active technicians with available status
        query = select(Technician).where(
            and_(
                Technician.tenant_id == tenant_id,
                Technician.is_active == True,  # noqa: E712
                Technician.status.in_(
                    [
                        TechnicianStatus.AVAILABLE,
                        TechnicianStatus.ON_BREAK,  # Can interrupt break for urgent jobs
                    ]
                ),
            )
        )

        result = await self.session.execute(query)
        technicians = list(result.scalars().all())

        # Filter by availability records (vacation, sick leave, etc.)
        available_techs = []
        for tech in technicians:
            is_available = await self._check_availability(tech, query_time)
            if is_available:
                available_techs.append(tech)

        return available_techs

    async def _check_availability(
        self,
        technician: Technician,
        check_time: datetime,
    ) -> bool:
        """Check if technician is available at the given time."""
        # Check availability records
        query = select(TechnicianAvailability).where(
            and_(
                TechnicianAvailability.technician_id == technician.id,
                TechnicianAvailability.start_datetime <= check_time,
                TechnicianAvailability.end_datetime >= check_time,
                TechnicianAvailability.is_available == False,  # noqa: E712
            )
        )

        result = await self.session.execute(query)
        unavailable_record = result.scalar_one_or_none()

        if unavailable_record:
            logger.debug(
                "Technician unavailable",
                technician_id=technician.id,
                reason=unavailable_record.reason,
            )
            return False

        # Check working hours if defined
        if technician.working_hours_start and technician.working_hours_end:
            current_time = check_time.time()
            if not (technician.working_hours_start <= current_time <= technician.working_hours_end):
                logger.debug(
                    "Technician outside working hours",
                    technician_id=technician.id,
                    current_time=str(current_time),
                )
                return False

        # Check working days if defined
        if technician.working_days:
            current_day = check_time.weekday()  # 0=Monday, 6=Sunday
            if current_day not in technician.working_days:
                logger.debug(
                    "Technician not working today",
                    technician_id=technician.id,
                    day=current_day,
                )
                return False

        return True

    def _has_required_skills(
        self,
        technician: Technician,
        required_skills: list[str],
    ) -> bool:
        """Check if technician has all required skills."""
        if not required_skills:
            return True

        if not technician.skills:
            return False

        for skill in required_skills:
            if not technician.has_skill(skill):
                return False

        return True

    def _calculate_technician_score(
        self,
        tech: Technician,
        distance_km: float,
        priority: str,
    ) -> float:
        """
        Calculate a score for technician assignment.

        Higher score = better match

        Factors:
        - Distance (closer is better)
        - Skill level (higher is better)
        - Completion rate (higher is better)
        - Average rating (higher is better)
        - Current status (available > on_break)
        """
        score = 0.0

        # Distance factor (max 100 points)
        # Closer technicians get more points
        if distance_km < 5:
            score += 100
        elif distance_km < 10:
            score += 80
        elif distance_km < 20:
            score += 60
        elif distance_km < 50:
            score += 40
        else:
            score += 20

        # Skill level factor (max 50 points)
        skill_points = {
            TechnicianSkillLevel.EXPERT: 50,
            TechnicianSkillLevel.SENIOR: 40,
            TechnicianSkillLevel.INTERMEDIATE: 30,
            TechnicianSkillLevel.JUNIOR: 20,
            TechnicianSkillLevel.TRAINEE: 10,
        }
        score += skill_points.get(tech.skill_level, 20)

        # Performance factors (max 50 points)
        if tech.completion_rate:
            score += tech.completion_rate * 25  # 0-100% = 0-25 points

        if tech.average_rating:
            score += (tech.average_rating / 5.0) * 25  # 0-5 rating = 0-25 points

        # Status factor (max 20 points)
        if tech.status == TechnicianStatus.AVAILABLE:
            score += 20
        elif tech.status == TechnicianStatus.ON_BREAK:
            score += 10

        # Priority boost for urgent jobs
        if priority == "urgent" and distance_km < 10:
            score += 30  # Prefer nearby techs for urgent jobs

        return score

    async def _find_any_available_technician(
        self,
        tenant_id: str,
        required_skills: list[str] | None = None,
    ) -> Technician | None:
        """Fallback: find any available technician without location matching."""
        available_techs = await self._get_available_technicians(tenant_id, None)

        if required_skills:
            available_techs = [
                tech for tech in available_techs if self._has_required_skills(tech, required_skills)
            ]

        if not available_techs:
            return None

        # Return the technician with highest skill level
        available_techs.sort(
            key=lambda t: (
                t.skill_level.value,
                t.completion_rate or 0,
                t.average_rating or 0,
            ),
            reverse=True,
        )

        return available_techs[0]
