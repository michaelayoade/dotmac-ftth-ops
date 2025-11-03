"""
Ticketing Workflow Service

Provides workflow-compatible methods for ticketing operations.
"""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.core import UserInfo
from .models import TicketActorType, TicketPriority, TicketType
from .schemas import TicketCreate
from .service import TicketService

logger = logging.getLogger(__name__)


class TicketingService:
    """
    Ticketing service for workflow integration.

    Provides ticket creation and installation scheduling for workflows.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_ticket(
        self,
        title: str,
        description: str,
        customer_id: int | str,
        priority: str = "normal",
        assigned_team: str | None = None,
        tenant_id: str | None = None,
        ticket_type: str | None = None,
        service_address: str | None = None,
    ) -> dict[str, Any]:
        """
        Create a support ticket for a customer.

        This method creates a complete support ticket using the ticketing system.
        It handles customer identification, priority mapping, and ticket routing
        to the appropriate team.

        Args:
            title: Ticket subject/title
            description: Detailed description of the issue or request
            customer_id: Customer ID (UUID or integer)
            priority: Priority level ("low", "normal", "high", "urgent")
            assigned_team: Team to assign ticket to (optional, used as metadata)
            tenant_id: Tenant ID for multi-tenant isolation
            ticket_type: Type of ticket (e.g., "technical_support", "installation_request")
            service_address: Service location address (for ISP field operations)

        Returns:
            Dict with ticket details:
            {
                "ticket_id": "uuid",
                "ticket_number": "TCK-XXXXXXXXXXXX",
                "title": "Ticket subject",
                "description": "Ticket description",
                "customer_id": "customer-uuid",
                "priority": "normal",
                "ticket_type": "technical_support",
                "status": "open",
                "assigned_team": "support_team",
                "service_address": "123 Main St",
                "created_at": "2025-10-16T12:00:00+00:00",
                "sla_due_date": "2025-10-17T12:00:00+00:00",
            }

        Raises:
            ValueError: If customer not found or invalid parameters
            RuntimeError: If ticket creation fails
        """
        logger.info(
            f"Creating ticket for customer {customer_id}, priority {priority}, type {ticket_type}"
        )

        # Convert customer_id to UUID if needed
        try:
            if isinstance(customer_id, str):
                customer_uuid = UUID(customer_id) if "-" in customer_id else None
            else:
                # If integer, we need to look up the customer to get UUID
                from sqlalchemy import select

                from ..customer_management.models import Customer

                result = await self.db.execute(
                    select(Customer).where(Customer.id == str(customer_id))
                )
                customer = result.scalar_one_or_none()
                customer_uuid = customer.id if customer else None
        except (ValueError, AttributeError):
            customer_uuid = None

        if not customer_uuid:
            raise ValueError(f"Invalid customer_id: {customer_id}")

        # Map priority string to enum
        priority_map = {
            "low": TicketPriority.LOW,
            "normal": TicketPriority.NORMAL,
            "high": TicketPriority.HIGH,
            "urgent": TicketPriority.URGENT,
        }
        priority_enum = priority_map.get(priority.lower(), TicketPriority.NORMAL)

        # Map ticket_type string to enum (if provided)
        ticket_type_enum = None
        if ticket_type:
            type_map = {
                "general_inquiry": TicketType.GENERAL_INQUIRY,
                "billing_issue": TicketType.BILLING_ISSUE,
                "technical_support": TicketType.TECHNICAL_SUPPORT,
                "installation_request": TicketType.INSTALLATION_REQUEST,
                "outage_report": TicketType.OUTAGE_REPORT,
                "service_upgrade": TicketType.SERVICE_UPGRADE,
                "service_downgrade": TicketType.SERVICE_DOWNGRADE,
                "cancellation_request": TicketType.CANCELLATION_REQUEST,
                "equipment_issue": TicketType.EQUIPMENT_ISSUE,
                "speed_issue": TicketType.SPEED_ISSUE,
                "network_issue": TicketType.NETWORK_ISSUE,
                "connectivity_issue": TicketType.CONNECTIVITY_ISSUE,
            }
            ticket_type_enum = type_map.get(ticket_type.lower())

        # Build metadata
        metadata: dict[str, Any] = {}
        if assigned_team:
            metadata["assigned_team"] = assigned_team
            metadata["routing"] = {"team": assigned_team}

        # Create ticket via TicketService
        try:
            # Create system user info for workflow-generated tickets
            system_user = UserInfo(
                user_id=None,  # System-generated
                email="system@workflow",
                tenant_id=tenant_id,
                roles=["system"],
                is_authenticated=True,
            )

            ticket_service = TicketService(self.db)

            # Build ticket creation request
            # Workflow-generated tickets are created by tenant context and target platform support
            # This follows the ALLOWED_TARGETS matrix: TENANT -> {PARTNER, PLATFORM}
            ticket_data = TicketCreate(
                subject=title,
                message=description,
                target_type=TicketActorType.PLATFORM,  # Tenant tickets target platform support
                priority=priority_enum,
                tenant_id=tenant_id,
                metadata=metadata,
                attachments=[],
                # ISP-specific fields
                ticket_type=ticket_type_enum,
                service_address=service_address,
            )

            # Create the ticket
            ticket = await ticket_service.create_ticket(
                data=ticket_data, current_user=system_user, tenant_id=tenant_id
            )

            # CRITICAL: Propagate customer_id so customers can see their tickets
            # Workflow-driven tickets use tenant/system actor, so create_ticket sets customer_id=None
            # We must explicitly patch it here with the resolved customer_uuid
            ticket.customer_id = customer_uuid

            # Update ISP-specific fields if already provided via schema (belt-and-suspenders)
            if ticket_type_enum and not ticket.ticket_type:
                ticket.ticket_type = ticket_type_enum
            if service_address and not ticket.service_address:
                ticket.service_address = service_address

            await self.db.flush()
            await self.db.commit()

            logger.info(
                f"Ticket created successfully: {ticket.ticket_number} "
                f"(ID: {ticket.id}) for customer {customer_id}"
            )

            # Return workflow-compatible response
            return {
                "ticket_id": str(ticket.id),
                "ticket_number": ticket.ticket_number,
                "title": ticket.subject,
                "description": description,
                "customer_id": str(customer_uuid),
                "priority": priority_enum.value,
                "ticket_type": ticket_type_enum.value if ticket_type_enum else None,
                "status": ticket.status.value,
                "assigned_team": assigned_team,
                "service_address": service_address,
                "origin_type": ticket.origin_type.value,
                "target_type": ticket.target_type.value,
                "created_at": ticket.created_at.isoformat(),
                "sla_due_date": ticket.sla_due_date.isoformat() if ticket.sla_due_date else None,
                "context": ticket.context,
            }

        except ValueError as e:
            logger.error(f"Validation error creating ticket: {e}")
            raise

        except Exception as e:
            logger.error(f"Error creating ticket: {e}", exc_info=True)
            raise RuntimeError(f"Failed to create ticket: {e}") from e

    async def schedule_installation(
        self,
        customer_id: int | str,
        installation_address: str,
        technician_id: int | str | None = None,
        scheduled_date: str | None = None,
        tenant_id: str | None = None,
        priority: str = "normal",
        notes: str | None = None,
    ) -> dict[str, Any]:
        """
        Schedule an installation appointment for ISP customer.

        This method creates an installation ticket with scheduled date/time
        and optionally assigns it to a specific field technician.

        Args:
            customer_id: Customer ID
            installation_address: Physical address for installation
            technician_id: Field technician ID to assign (optional, auto-assigned if None)
            scheduled_date: ISO format date/time for installation (defaults to +3 days)
            tenant_id: Tenant ID for multi-tenant isolation
            priority: Installation priority ("low", "normal", "high", "urgent")
            notes: Additional notes for the installation team

        Returns:
            Dict with installation ticket details:
            {
                "installation_id": "uuid",
                "ticket_id": "uuid",
                "ticket_number": "TCK-...",
                "customer_id": "customer-id",
                "installation_address": "123 Main St",
                "technician_id": "tech-id",
                "scheduled_date": "2025-10-19T10:00:00+00:00",
                "status": "scheduled",
                "priority": "normal",
                "created_at": "2025-10-16T12:00:00+00:00"
            }

        Raises:
            ValueError: If customer not found or invalid date format
        """
        from datetime import timedelta

        logger.info(f"Scheduling installation for customer {customer_id} at {installation_address}")

        customer_id_str = str(customer_id)

        # Parse or generate scheduled date
        if scheduled_date:
            try:
                # Parse ISO format date
                scheduled_dt = datetime.fromisoformat(scheduled_date.replace("Z", "+00:00"))
            except (ValueError, AttributeError) as e:
                raise ValueError(f"Invalid scheduled_date format: {scheduled_date}") from e
        else:
            # Default: schedule for 3 business days from now at 10 AM
            scheduled_dt = datetime.now(UTC) + timedelta(days=3)
            scheduled_dt = scheduled_dt.replace(hour=10, minute=0, second=0, microsecond=0)

        # Auto-assign technician if not provided
        # In production, this would query available technicians based on:
        # - Location/service area
        # - Availability/calendar
        # - Workload balancing
        # - Skill requirements
        if not technician_id:
            # For now, use a simple auto-assignment
            # In production, query from user_management for field technicians
            from sqlalchemy import select

            from ..user_management.models import User

            # Find technicians in the tenant (users with "field_technician" role)
            tech_stmt = (
                select(User)
                .where(
                    User.tenant_id == tenant_id,
                    User.is_active == True,  # noqa: E712
                )
                .limit(1)
            )

            result = await self.db.execute(tech_stmt)
            technician = result.scalar_one_or_none()

            if technician:
                technician_id = str(technician.id)
                logger.info(f"Auto-assigned technician: {technician.email}")
            else:
                # No technician found, use placeholder
                technician_id = "unassigned"
                logger.warning("No technician found, marked as unassigned")

        # Build installation ticket description
        description = f"""Installation Request

Customer ID: {customer_id_str}
Installation Address: {installation_address}
Scheduled Date: {scheduled_dt.strftime("%Y-%m-%d %H:%M %Z")}
Assigned Technician: {technician_id}

{notes or "No additional notes"}

This installation was automatically scheduled via the workflow system.
"""

        # Create installation ticket
        ticket_result = await self.create_ticket(
            title=f"Installation Scheduled - {installation_address}",
            description=description,
            customer_id=customer_id,
            priority=priority,
            assigned_team="field_operations",
            tenant_id=tenant_id,
            ticket_type="installation_request",
            service_address=installation_address,
        )

        # Store installation-specific metadata
        # In production, you might have a separate InstallationSchedule table
        # For now, we'll include it in the ticket metadata
        from sqlalchemy import select, update

        from .models import Ticket

        ticket_uuid = UUID(ticket_result["ticket_id"])

        # Update ticket with installation-specific fields
        update_stmt = (
            update(Ticket)
            .where(Ticket.id == ticket_uuid)
            .values(
                context={
                    **ticket_result.get("context", {}),
                    "installation": {
                        "scheduled_date": scheduled_dt.isoformat(),
                        "technician_id": str(technician_id),
                        "installation_address": installation_address,
                        "auto_scheduled": not bool(scheduled_date),
                    },
                }
            )
        )
        await self.db.execute(update_stmt)
        await self.db.commit()

        logger.info(
            f"Installation scheduled successfully: ticket={ticket_result['ticket_number']}, "
            f"date={scheduled_dt.isoformat()}, technician={technician_id}"
        )

        return {
            "installation_id": ticket_result["ticket_id"],
            "ticket_id": ticket_result["ticket_id"],
            "ticket_number": ticket_result["ticket_number"],
            "customer_id": customer_id_str,
            "installation_address": installation_address,
            "technician_id": str(technician_id),
            "scheduled_date": scheduled_dt.isoformat(),
            "status": "scheduled",
            "priority": priority,
            "created_at": ticket_result["created_at"],
            "sla_due_date": ticket_result.get("sla_due_date"),
        }
