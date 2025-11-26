"""
Pydantic schemas for ticketing API endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .models import TicketActorType, TicketPriority, TicketStatus, TicketType


class TicketCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Payload for opening a new ticket."""

    model_config = ConfigDict()

    subject: str = Field(..., min_length=3, max_length=255)
    message: str = Field(..., min_length=1)
    target_type: TicketActorType = Field(
        ...,
        description="Audience the ticket is targeting (tenant, partner, platform).",
    )
    priority: TicketPriority = Field(
        default=TicketPriority.NORMAL,
        description="Operational priority for the ticket.",
    )
    partner_id: UUID | None = Field(
        default=None,
        description="Partner identifier when escalating to a partner.",
    )
    tenant_id: str | None = Field(
        default=None,
        description="Tenant context override (required for platform admins creating tickets).",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary structured data associated with the ticket.",
    )
    attachments: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Optional attachment metadata bundled with the initial message.",
    )

    # ISP-specific fields
    ticket_type: TicketType | None = Field(
        default=None,
        description="ISP-specific ticket categorization",
    )
    service_address: str | None = Field(
        default=None,
        max_length=500,
        description="Service location address for field operations",
    )
    affected_services: list[str] = Field(
        default_factory=list,
        description="Affected services: internet, voip, tv, etc",
    )
    device_serial_numbers: list[str] = Field(
        default_factory=list,
        description="Serial numbers of involved equipment",
    )


class TicketMessageCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Payload for appending a message to an existing ticket."""

    model_config = ConfigDict()

    message: str = Field(..., min_length=1)
    attachments: list[dict[str, Any]] = Field(default_factory=lambda: [])
    new_status: TicketStatus | None = Field(
        default=None,
        description="Optional status transition to apply after posting the message.",
    )


class TicketMessageResponse(BaseModel):
    """Serialized ticket message for list endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    sender_type: TicketActorType | None = None
    sender_user_id: UUID | None = None
    author_name: str | None = None
    author_email: str | None = None
    is_staff: bool | None = None
    body: str | None = None
    message: str | None = None  # fallback for legacy field name
    attachments: list[dict[str, Any]] = Field(default_factory=lambda: [])
    is_internal: bool | None = None
    created_at: datetime
    updated_at: datetime | None = None


class TicketUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Partial update payload for ticket metadata."""

    model_config = ConfigDict()

    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    assigned_to_user_id: UUID | None = None
    metadata: dict[str, Any] | None = None

    # ISP-specific updates
    ticket_type: TicketType | None = None
    service_address: str | None = None
    affected_services: list[str] | None = None
    device_serial_numbers: list[str] | None = None
    escalation_level: int | None = None
    escalated_to_user_id: UUID | None = None


class TicketMessageRead(BaseModel):  # BaseModel resolves to Any in isolation
    """Serialized ticket message."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    sender_type: TicketActorType
    sender_user_id: UUID | None
    body: str
    attachments: list[dict[str, Any]] = Field(default_factory=lambda: [])
    created_at: datetime
    updated_at: datetime


class TicketSummary(BaseModel):  # BaseModel resolves to Any in isolation
    """Lightweight representation of a ticket for list views."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_number: str
    subject: str
    status: TicketStatus
    priority: TicketPriority
    origin_type: TicketActorType
    target_type: TicketActorType
    tenant_id: str | None
    customer_id: UUID | None
    partner_id: UUID | None
    assigned_to_user_id: UUID | None
    last_response_at: datetime | None
    context: dict[str, Any] = Field(default_factory=lambda: {})

    # ISP-specific fields
    ticket_type: TicketType | None = None
    service_address: str | None = None
    sla_due_date: datetime | None = None
    sla_breached: bool = False
    escalation_level: int = 0

    created_at: datetime
    updated_at: datetime


class TicketDetail(TicketSummary):
    """Detailed ticket representation with threaded messages."""

    messages: list[TicketMessageRead] = Field(default_factory=lambda: [])

    # Additional ISP-specific detailed fields
    affected_services: list[str] = Field(default_factory=lambda: [])
    device_serial_numbers: list[str] = Field(default_factory=lambda: [])
    first_response_at: datetime | None = None
    resolution_time_minutes: int | None = None
    escalated_at: datetime | None = None
    escalated_to_user_id: UUID | None = None


class AgentPerformanceMetrics(BaseModel):
    """Performance metrics for a support agent."""

    model_config = ConfigDict()

    agent_id: UUID
    agent_name: str | None = None
    agent_email: str | None = None
    total_assigned: int = Field(0, description="Total tickets assigned to agent")
    total_resolved: int = Field(0, description="Total tickets resolved by agent")
    total_open: int = Field(0, description="Currently open tickets")
    total_in_progress: int = Field(0, description="Tickets currently in progress")
    avg_resolution_time_minutes: float | None = Field(
        None, description="Average time to resolve tickets"
    )
    avg_first_response_time_minutes: float | None = Field(
        None, description="Average time to first response"
    )
    sla_compliance_rate: float | None = Field(
        None, description="Percentage of tickets meeting SLA (0-100)"
    )
    escalation_rate: float | None = Field(
        None, description="Percentage of tickets escalated (0-100)"
    )


class TicketCountStats(BaseModel):
    """Ticket counts by status."""

    model_config = ConfigDict(from_attributes=True)

    total_tickets: int
    open_tickets: int
    in_progress_tickets: int
    waiting_tickets: int
    resolved_tickets: int
    closed_tickets: int


class TicketStats(BaseModel):
    """Aggregated ticket statistics for dashboards."""

    model_config = ConfigDict(from_attributes=True)

    total: int
    open: int
    in_progress: int
    waiting: int
    resolved: int
    closed: int
    sla_breached: int
    by_priority: dict[str, int] = Field(default_factory=dict)
    by_type: dict[str, int] = Field(default_factory=dict)


__all__ = [
    "AgentPerformanceMetrics",
    "TicketCreate",
    "TicketMessageCreate",
    "TicketMessageResponse",
    "TicketUpdate",
    "TicketSummary",
    "TicketDetail",
    "TicketMessageRead",
    "TicketCountStats",
    "TicketStats",
]
