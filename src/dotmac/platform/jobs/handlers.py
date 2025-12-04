"""
Event handlers for job events.

This module provides event handlers for job lifecycle events, including
automatic job creation from installation tickets and field service workflows.
"""

from typing import Any, Final

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import ActivitySeverity, ActivityType
from dotmac.platform.audit.service import AuditService
from dotmac.platform.events.decorators import subscribe
from dotmac.platform.events.models import Event

logger = structlog.get_logger(__name__)

# Initialize services
audit_service = AuditService()

RESOURCE_CREATED: Final[ActivityType] = ActivityType("resource.created")
RESOURCE_UPDATED: Final[ActivityType] = ActivityType("resource.updated")


async def _auto_assign_technician(
    session: AsyncSession,
    job: Any,
    ticket: Any,
    tenant_id: str,
) -> None:
    """
    Helper function to auto-assign best available technician to a job.

    Args:
        session: Database session
        job: Job object
        ticket: Ticket object
        tenant_id: Tenant ID
    """
    try:
        from dotmac.platform.field_service.assignment_service import TechnicianAssignmentService

        # Extract location from ticket or job parameters
        job_location = None
        service_address = ticket.service_address

        # Try to get coordinates from job parameters
        if job.parameters:
            lat = job.parameters.get("location_lat")
            lng = job.parameters.get("location_lng")
            if lat and lng:
                job_location = {"lat": float(lat), "lng": float(lng)}

        # If no coordinates but have address, we'd need geocoding here
        # For now, skip location-based assignment if no coords
        if not job_location:
            logger.warning(
                "No job location coordinates available, skipping auto-assignment",
                job_id=job.id,
                service_address=service_address,
            )
            return

        # Determine required skills from job metadata
        required_skills = []
        if job.parameters:
            skills = job.parameters.get("required_skills", [])
            if skills:
                required_skills = skills
            else:
                # Default skills for fiber installation
                required_skills = ["fiber_installation", "ont_configuration"]

        # Get priority from ticket
        priority = ticket.priority.value if ticket.priority else "normal"

        # Find best technician
        assignment_service = TechnicianAssignmentService(session)
        best_tech = await assignment_service.find_best_technician(
            tenant_id=tenant_id,
            job_location=job_location,
            required_skills=required_skills,
            priority=priority,
        )

        if best_tech:
            # Assign technician to job
            assigned = await assignment_service.assign_technician_to_job(
                job_id=job.id,
                technician=best_tech,
            )

            if assigned:
                logger.info(
                    "Technician auto-assigned to job",
                    job_id=job.id,
                    technician_id=best_tech.id,
                    technician_name=best_tech.full_name,
                )

                # Create audit log for assignment
                await audit_service.log_activity(
                    activity_type=RESOURCE_UPDATED,
                    action="job.technician_assigned",
                    description=f"Technician {best_tech.full_name} auto-assigned to job {job.id}",
                    tenant_id=tenant_id,
                    user_id=None,  # System-generated
                    resource_type="job",
                    resource_id=str(job.id),
                    severity=ActivitySeverity.MEDIUM,
                    details={
                        "job_id": str(job.id),
                        "technician_id": str(best_tech.id),
                        "technician_name": best_tech.full_name,
                        "auto_assigned": True,
                    },
                )
        else:
            logger.warning(
                "No available technician found for job",
                job_id=job.id,
                tenant_id=tenant_id,
            )

    except Exception as e:
        logger.error(
            "Failed to auto-assign technician",
            job_id=job.id,
            error=str(e),
            exc_info=True,
        )


@subscribe("ticket.created")  # type: ignore[misc]  # Custom decorator is untyped
async def handle_installation_ticket_create_job(event: Event) -> None:
    """
    Handle installation ticket creation and create field service job.

    When an INSTALLATION_REQUEST ticket is created, automatically create
    a field service job for technician assignment and scheduling.

    Actions:
    - Create field service job from installation ticket
    - Set job parameters with ticket details
    - Queue for technician assignment
    - Create audit log
    """
    from dotmac.platform.db import AsyncSessionLocal
    from dotmac.platform.jobs.schemas import JobCreate
    from dotmac.platform.jobs.service import JobService
    from dotmac.platform.ticketing.models import TicketType

    ticket_id = event.payload.get("ticket_id")
    ticket_number = event.payload.get("ticket_number")
    ticket_type = event.payload.get("ticket_type")
    tenant_id = event.payload.get("tenant_id") or event.metadata.tenant_id
    if tenant_id is None:
        logger.error("Missing tenant_id on ticket.created event", ticket_id=ticket_id)
        return

    # Only process INSTALLATION_REQUEST tickets
    if ticket_type != TicketType.INSTALLATION_REQUEST.value:
        logger.debug(
            "Skipping job creation - not an installation ticket",
            ticket_type=ticket_type,
            ticket_number=ticket_number,
        )
        return

    logger.info(
        "Handling installation ticket for job creation",
        ticket_id=ticket_id,
        ticket_number=ticket_number,
        tenant_id=tenant_id,
    )

    try:
        from sqlalchemy.future import select

        from dotmac.platform.ticketing.models import Ticket

        # Fetch ticket details
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Ticket).where(Ticket.id == ticket_id))
            ticket = result.scalar_one_or_none()

            if not ticket:
                logger.error("Ticket not found", ticket_id=ticket_id)
                return

            # Prepare job parameters
            job_parameters = {
                "ticket_id": str(ticket_id),
                "ticket_number": ticket_number,
                "service_address": ticket.service_address,
                "customer_id": str(ticket.customer_id) if ticket.customer_id else None,
                "priority": ticket.priority.value if ticket.priority else "normal",
                "affected_services": ticket.affected_services or [],
                "device_serial_numbers": ticket.device_serial_numbers or [],
                "metadata": ticket.metadata or {},
            }

            # Extract order information from ticket metadata if available
            ticket_metadata = ticket.metadata or {}
            if "order_id" in ticket_metadata:
                job_parameters["order_id"] = ticket_metadata["order_id"]
                job_parameters["order_number"] = ticket_metadata.get("order_number")

            # Create job data
            job_data = JobCreate(
                job_type="field_installation",  # New job type for field service
                title=f"Installation - Ticket #{ticket_number}",
                description=f"""
Field installation job for ticket {ticket_number}.

Service Address: {ticket.service_address or "N/A"}
Priority: {ticket.priority.value if ticket.priority else "normal"}

This job was automatically created from installation ticket.
                """.strip(),
                items_total=1,  # One installation
                parameters=job_parameters,
            )

            # Create the job
            job_service = JobService(session=session, redis_client=None)
            job = await job_service.create_job(
                tenant_id=tenant_id,
                created_by="system",  # System-generated job
                job_data=job_data,
            )

            await session.commit()

            logger.info(
                "Field service job created from installation ticket",
                job_id=job.id,
                ticket_id=ticket_id,
                ticket_number=ticket_number,
                job_type="field_installation",
            )

            # Auto-assign technician if location is available
            await _auto_assign_technician(session, job, ticket, tenant_id)

            # Create audit log
        await audit_service.log_activity(
            activity_type=RESOURCE_CREATED,
            action="field_job.auto_created",
            description=f"Field installation job {job.id} auto-created from ticket {ticket_number}",
            tenant_id=tenant_id,
            user_id=None,  # System-generated
            resource_type="job",
            resource_id=str(job.id),
            severity=ActivitySeverity.MEDIUM,
            details={
                "job_id": str(job.id),
                "job_type": "field_installation",
                "ticket_id": str(ticket_id),
                "ticket_number": ticket_number,
                "auto_created": True,
                "source": "installation_ticket_workflow",
            },
        )

    except Exception as e:
        logger.error(
            "Failed to create field service job from installation ticket",
            ticket_id=ticket_id,
            ticket_number=ticket_number,
            error=str(e),
            exc_info=True,
        )


__all__ = [
    "handle_installation_ticket_create_job",
]
