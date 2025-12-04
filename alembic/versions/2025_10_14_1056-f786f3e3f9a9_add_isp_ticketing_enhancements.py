"""add_isp_ticketing_enhancements

Revision ID: f786f3e3f9a9
Revises: 7f409fc1431c
Create Date: 2025-10-14 10:56:07.993069

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "f786f3e3f9a9"
down_revision = "7f409fc1431c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add ISP-specific ticketing fields for enhanced support workflows."""

    # Create TicketType enum
    ticket_type_enum = sa.Enum(
        "general_inquiry",
        "billing_issue",
        "technical_support",
        "installation_request",
        "outage_report",
        "service_upgrade",
        "service_downgrade",
        "cancellation_request",
        "equipment_issue",
        "speed_issue",
        "network_issue",
        "connectivity_issue",
        name="tickettype",
    )
    ticket_type_enum.create(op.get_bind())

    # Add ISP-specific categorization fields
    op.add_column(
        "tickets",
        sa.Column(
            "ticket_type",
            ticket_type_enum,
            nullable=True,
            comment="ISP-specific ticket categorization",
        ),
    )
    op.add_column(
        "tickets",
        sa.Column(
            "service_address",
            sa.String(length=500),
            nullable=True,
            comment="Service location address for field operations",
        ),
    )
    op.add_column(
        "tickets",
        sa.Column(
            "affected_services",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
            comment="List of affected services: internet, voip, tv, etc",
        ),
    )
    op.add_column(
        "tickets",
        sa.Column(
            "device_serial_numbers",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
            comment="Serial numbers of involved equipment",
        ),
    )

    # Add SLA tracking fields
    op.add_column(
        "tickets",
        sa.Column(
            "sla_due_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="SLA deadline for resolution",
        ),
    )
    op.add_column(
        "tickets",
        sa.Column(
            "sla_breached",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="Whether SLA was breached",
        ),
    )
    op.add_column(
        "tickets",
        sa.Column(
            "first_response_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp of first agent response",
        ),
    )
    op.add_column(
        "tickets",
        sa.Column(
            "resolution_time_minutes",
            sa.Integer(),
            nullable=True,
            comment="Total time to resolution in minutes",
        ),
    )

    # Add escalation tracking fields
    op.add_column(
        "tickets",
        sa.Column(
            "escalation_level",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Escalation tier: 0=L1, 1=L2, 2=L3, etc",
        ),
    )
    op.add_column(
        "tickets",
        sa.Column(
            "escalated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When ticket was escalated",
        ),
    )
    op.add_column(
        "tickets",
        sa.Column(
            "escalated_to_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="User ID ticket was escalated to",
        ),
    )

    # Create indexes for performance
    op.create_index("ix_tickets_ticket_type", "tickets", ["ticket_type"])
    op.create_index("ix_tickets_tenant_type", "tickets", ["tenant_id", "ticket_type"])
    op.create_index("ix_tickets_sla_due", "tickets", ["sla_due_date"])
    op.create_index("ix_tickets_sla_breach", "tickets", ["sla_breached", "sla_due_date"])


def downgrade() -> None:
    """Remove ISP-specific ticketing enhancements."""
    # Drop indexes
    op.drop_index("ix_tickets_sla_breach", table_name="tickets")
    op.drop_index("ix_tickets_sla_due", table_name="tickets")
    op.drop_index("ix_tickets_tenant_type", table_name="tickets")
    op.drop_index("ix_tickets_ticket_type", table_name="tickets")

    # Drop columns
    op.drop_column("tickets", "escalated_to_user_id")
    op.drop_column("tickets", "escalated_at")
    op.drop_column("tickets", "escalation_level")
    op.drop_column("tickets", "resolution_time_minutes")
    op.drop_column("tickets", "first_response_at")
    op.drop_column("tickets", "sla_breached")
    op.drop_column("tickets", "sla_due_date")
    op.drop_column("tickets", "device_serial_numbers")
    op.drop_column("tickets", "affected_services")
    op.drop_column("tickets", "service_address")
    op.drop_column("tickets", "ticket_type")

    # Drop enum
    sa.Enum(name="tickettype").drop(op.get_bind())
