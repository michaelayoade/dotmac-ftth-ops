"""
Geofencing Service for Technician Location-Based Automation

Detects when technicians arrive/depart from job sites and triggers automated actions.
"""

import logging
import math
from datetime import datetime, timedelta
from typing import cast
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.field_service.models import (
    TechnicianLocationHistory,
)
from dotmac.platform.jobs.models import Job, JobStatus

logger = logging.getLogger(__name__)


class GeofenceEvent:
    """Represents a geofence event (enter/exit)."""

    def __init__(
        self,
        technician_id: UUID,
        job_id: UUID,
        event_type: str,  # "enter" or "exit"
        timestamp: datetime,
        distance_meters: float,
    ):
        self.technician_id = technician_id
        self.job_id = job_id
        self.event_type = event_type
        self.timestamp = timestamp
        self.distance_meters = distance_meters


class GeofencingService:
    """
    Service for geofencing-based automation.

    Features:
    - Detect when technician enters/exits job site radius
    - Auto-update job status on arrival/departure
    - Track time spent on-site
    - Generate geofence events for notifications
    """

    # Default geofence radius in meters
    DEFAULT_RADIUS_METERS = 100.0

    # Minimum time before re-triggering same geofence (prevent flapping)
    DEBOUNCE_SECONDS = 300  # 5 minutes

    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """
        Calculate distance between two GPS coordinates using Haversine formula.

        Args:
            lat1: Latitude of point 1
            lng1: Longitude of point 1
            lat2: Latitude of point 2
            lng2: Longitude of point 2

        Returns:
            Distance in meters
        """
        # Earth's radius in meters
        R = 6371000

        # Convert to radians
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)

        # Haversine formula
        a = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        distance = R * c

        return distance

    async def check_geofence(
        self,
        technician_id: UUID,
        current_lat: float,
        current_lng: float,
        job_id: UUID | None = None,
        radius_meters: float | None = None,
    ) -> GeofenceEvent | None:
        """
        Check if technician is within geofence of assigned job.

        Args:
            technician_id: Technician ID
            current_lat: Current latitude
            current_lng: Current longitude
            job_id: Optional specific job to check. If None, checks all assigned jobs
            radius_meters: Optional custom radius. If None, uses DEFAULT_RADIUS_METERS

        Returns:
            GeofenceEvent if entered/exited a geofence, None otherwise
        """
        radius = radius_meters or self.DEFAULT_RADIUS_METERS

        # Get technician's assigned jobs
        query = select(Job).where(
            and_(
                Job.assigned_technician_id == technician_id,
                Job.status.in_([JobStatus.ASSIGNED, JobStatus.RUNNING]),
                Job.location_lat.isnot(None),
                Job.location_lng.isnot(None),
            )
        )

        if job_id:
            query = query.where(Job.id == job_id)

        result = await self.session.execute(query)
        jobs = list(result.scalars().all())

        # Check each job's geofence
        for job in jobs:
            job_lat = job.location_lat
            job_lng = job.location_lng
            if job_lat is None or job_lng is None:
                continue

            distance = self.calculate_distance(
                current_lat,
                current_lng,
                job_lat,
                job_lng,
            )

            # Check if within geofence
            is_inside = distance <= radius

            # Get previous state
            job_uuid = cast(UUID, job.id)
            previous_inside = await self._get_previous_geofence_state(
                technician_id,
                job_uuid,
            )

            # Detect entry/exit
            if is_inside and not previous_inside:
                # Entered geofence
                logger.info(
                    f"Technician {technician_id} entered job {job.id} geofence "
                    f"(distance: {distance:.1f}m)"
                )
                return GeofenceEvent(
                    technician_id=technician_id,
                    job_id=job_uuid,
                    event_type="enter",
                    timestamp=datetime.utcnow(),
                    distance_meters=distance,
                )

            elif not is_inside and previous_inside:
                # Exited geofence
                logger.info(
                    f"Technician {technician_id} exited job {job.id} geofence "
                    f"(distance: {distance:.1f}m)"
                )
                return GeofenceEvent(
                    technician_id=technician_id,
                    job_id=job_uuid,
                    event_type="exit",
                    timestamp=datetime.utcnow(),
                    distance_meters=distance,
                )

        return None

    async def _get_previous_geofence_state(self, technician_id: UUID, job_id: UUID) -> bool:
        """
        Get previous geofence state (inside/outside) for debouncing.

        Checks the last location update to determine if technician was inside geofence.

        Args:
            technician_id: Technician ID
            job_id: Job ID

        Returns:
            True if previously inside geofence, False otherwise
        """
        # Get job location
        job_query = select(Job).where(Job.id == job_id)
        job_result = await self.session.execute(job_query)
        job = job_result.scalar_one_or_none()

        if not job or job.location_lat is None or job.location_lng is None:
            return False

        # Get previous location (within debounce period)
        cutoff_time = datetime.utcnow() - timedelta(seconds=self.DEBOUNCE_SECONDS)

        location_query = (
            select(TechnicianLocationHistory)
            .where(
                and_(
                    TechnicianLocationHistory.technician_id == technician_id,
                    TechnicianLocationHistory.recorded_at >= cutoff_time,
                )
            )
            .order_by(TechnicianLocationHistory.recorded_at.desc())
            .limit(1)
        )

        result = await self.session.execute(location_query)
        previous_location = result.scalar_one_or_none()

        if not previous_location:
            return False

        # Calculate distance of previous location to job site
        distance = self.calculate_distance(
            previous_location.latitude,
            previous_location.longitude,
            job.location_lat,
            job.location_lng,
        )

        return distance <= self.DEFAULT_RADIUS_METERS

    async def auto_update_job_status(self, event: GeofenceEvent) -> tuple[bool, str | None]:
        """
        Automatically update job status based on geofence event.

        Rules:
        - Enter geofence + job is ASSIGNED → Change to RUNNING
        - Exit geofence + job is RUNNING → Change to COMPLETED (with confirmation)

        Args:
            event: GeofenceEvent

        Returns:
            Tuple of (success: bool, message: Optional[str])
        """
        # Get job
        job_query = select(Job).where(Job.id == event.job_id)
        result = await self.session.execute(job_query)
        job = result.scalar_one_or_none()

        if not job:
            return False, f"Job {event.job_id} not found"

        if event.event_type == "enter":
            # Technician arrived at job site
            if job.status == JobStatus.ASSIGNED:
                # Start the job
                job.status = JobStatus.RUNNING
                job.started_at = event.timestamp

                # Update metadata
                if not job.metadata:
                    job.metadata = {}
                job.metadata["geofence_arrival"] = event.timestamp.isoformat()
                job.metadata["arrival_distance_meters"] = event.distance_meters

                await self.session.commit()

                logger.info(f"Auto-started job {job.id} (technician {event.technician_id} arrived)")
                return True, "Job automatically started (arrival detected)"

        elif event.event_type == "exit":
            # Technician left job site
            if job.status == JobStatus.RUNNING:
                # Calculate time on-site
                time_on_site = None
                if job.started_at:
                    time_on_site = event.timestamp - job.started_at

                # Update metadata with departure info
                if not job.metadata:
                    job.metadata = {}
                job.metadata["geofence_departure"] = event.timestamp.isoformat()
                job.metadata["departure_distance_meters"] = event.distance_meters
                if time_on_site:
                    job.metadata["time_on_site_seconds"] = int(time_on_site.total_seconds())

                await self.session.commit()

                logger.info(
                    f"Technician {event.technician_id} left job {job.id} site "
                    f"(time on-site: {time_on_site})"
                )

                # Note: We don't auto-complete on exit, just log it
                # Completion requires manual confirmation or additional logic
                return True, f"Departure logged (time on-site: {time_on_site})"

        return False, "No status change required"

    async def get_nearby_jobs(
        self,
        technician_id: UUID,
        current_lat: float,
        current_lng: float,
        radius_meters: float = 1000.0,
    ) -> list[tuple[Job, float]]:
        """
        Get jobs near technician's current location.

        Args:
            technician_id: Technician ID
            current_lat: Current latitude
            current_lng: Current longitude
            radius_meters: Search radius in meters

        Returns:
            List of (Job, distance) tuples sorted by distance
        """
        # Get all jobs with locations
        query = select(Job).where(
            and_(
                Job.location_lat.isnot(None),
                Job.location_lng.isnot(None),
                Job.status.in_([JobStatus.PENDING, JobStatus.ASSIGNED]),
            )
        )

        result = await self.session.execute(query)
        all_jobs = list(result.scalars().all())

        # Calculate distances and filter by radius
        nearby = []
        for job in all_jobs:
            job_lat = job.location_lat
            job_lng = job.location_lng
            if job_lat is None or job_lng is None:
                continue

            distance = self.calculate_distance(
                current_lat,
                current_lng,
                job_lat,
                job_lng,
            )

            if distance <= radius_meters:
                nearby.append((job, distance))

        # Sort by distance
        nearby.sort(key=lambda x: x[1])

        return nearby

    async def get_time_on_site(self, job_id: UUID) -> timedelta | None:
        """
        Get total time technician spent on job site.

        Args:
            job_id: Job ID

        Returns:
            Time spent on-site, or None if not applicable
        """
        job_query = select(Job).where(Job.id == job_id)
        result = await self.session.execute(job_query)
        job = result.scalar_one_or_none()

        if not job or not job.metadata:
            return None

        # Check for geofence arrival/departure times
        arrival_str = job.metadata.get("geofence_arrival")
        departure_str = job.metadata.get("geofence_departure")

        if not arrival_str:
            return None

        arrival = datetime.fromisoformat(arrival_str)
        departure = datetime.fromisoformat(departure_str) if departure_str else datetime.utcnow()

        return departure - arrival
