"""Add ticketing tables for customer and partner support workflows

Revision ID: 4cdd601e0cb3
Revises: b2d9d2cfe304
Create Date: 2025-10-12 15:55:56.154233

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "4cdd601e0cb3"
down_revision = "b2d9d2cfe304"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types (only if they don't exist)
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE ticketactortype AS ENUM ('customer', 'tenant', 'partner', 'platform');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE ticketstatus AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE ticketpriority AS ENUM ('low', 'normal', 'high', 'urgent');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    # Create tickets table
    op.create_table(
        "tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ticket_number", sa.String(32), nullable=False, unique=True),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "open",
                "in_progress",
                "waiting",
                "resolved",
                "closed",
                name="ticketstatus",
                create_type=False,
            ),
            nullable=False,
            server_default="open",
        ),
        sa.Column(
            "priority",
            postgresql.ENUM(
                "low", "normal", "high", "urgent", name="ticketpriority", create_type=False
            ),
            nullable=False,
            server_default="normal",
        ),
        sa.Column(
            "origin_type",
            postgresql.ENUM(
                "customer",
                "tenant",
                "partner",
                "platform",
                name="ticketactortype",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "target_type",
            postgresql.ENUM(
                "customer",
                "tenant",
                "partner",
                "platform",
                name="ticketactortype",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("origin_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_to_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("partners.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("last_response_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("context", postgresql.JSON, nullable=False, server_default="{}"),
        # TenantMixin fields
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        # TimestampMixin fields
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        # AuditMixin fields
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Create indexes for tickets
    op.create_index("ix_tickets_ticket_number", "tickets", ["ticket_number"])
    op.create_index("ix_tickets_status", "tickets", ["status"])
    op.create_index("ix_tickets_priority", "tickets", ["priority"])
    op.create_index("ix_tickets_origin_type", "tickets", ["origin_type"])
    op.create_index("ix_tickets_target_type", "tickets", ["target_type"])
    op.create_index("ix_tickets_origin_user_id", "tickets", ["origin_user_id"])
    op.create_index("ix_tickets_assigned_to_user_id", "tickets", ["assigned_to_user_id"])
    op.create_index("ix_tickets_customer_id", "tickets", ["customer_id"])
    op.create_index("ix_tickets_partner_id", "tickets", ["partner_id"])
    op.create_index("ix_tickets_tenant_status", "tickets", ["tenant_id", "status"])
    op.create_index("ix_tickets_partner_status", "tickets", ["partner_id", "status"])

    # Create ticket_messages table
    op.create_table(
        "ticket_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "ticket_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tickets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_type",
            postgresql.ENUM(
                "customer",
                "tenant",
                "partner",
                "platform",
                name="ticketactortype",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("sender_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("attachments", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column(
            "partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("partners.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # TenantMixin fields
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        # TimestampMixin fields
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        # AuditMixin fields
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Create indexes for ticket_messages
    op.create_index("ix_ticket_messages_ticket_id", "ticket_messages", ["ticket_id"])
    op.create_index("ix_ticket_messages_sender_type", "ticket_messages", ["sender_type"])
    op.create_index(
        "ix_ticket_messages_ticket_created", "ticket_messages", ["ticket_id", "created_at"]
    )


def downgrade() -> None:
    # Drop tables
    op.drop_index("ix_ticket_messages_ticket_created", table_name="ticket_messages")
    op.drop_index("ix_ticket_messages_sender_type", table_name="ticket_messages")
    op.drop_index("ix_ticket_messages_ticket_id", table_name="ticket_messages")
    op.drop_table("ticket_messages")

    op.drop_index("ix_tickets_partner_status", table_name="tickets")
    op.drop_index("ix_tickets_tenant_status", table_name="tickets")
    op.drop_index("ix_tickets_partner_id", table_name="tickets")
    op.drop_index("ix_tickets_customer_id", table_name="tickets")
    op.drop_index("ix_tickets_assigned_to_user_id", table_name="tickets")
    op.drop_index("ix_tickets_origin_user_id", table_name="tickets")
    op.drop_index("ix_tickets_target_type", table_name="tickets")
    op.drop_index("ix_tickets_origin_type", table_name="tickets")
    op.drop_index("ix_tickets_priority", table_name="tickets")
    op.drop_index("ix_tickets_status", table_name="tickets")
    op.drop_index("ix_tickets_ticket_number", table_name="tickets")
    op.drop_table("tickets")

    # Drop enum types
    op.execute("DROP TYPE ticketpriority")
    op.execute("DROP TYPE ticketstatus")
    op.execute("DROP TYPE ticketactortype")
