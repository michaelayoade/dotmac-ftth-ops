"""add_notification_tables

Revision ID: e1f2g3h4i5j6
Revises: 5c5350bfe3f7
Create Date: 2025-01-15 17:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "e1f2g3h4i5j6"
down_revision = "5a517bdd0997"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create notification tables and enums."""

    # Create enums
    op.execute(
        """
        CREATE TYPE notificationtype AS ENUM (
            'subscriber_provisioned', 'subscriber_deprovisioned', 'subscriber_suspended',
            'subscriber_reactivated', 'service_activated', 'service_failed',
            'service_outage', 'service_restored', 'bandwidth_limit_reached',
            'connection_quality_degraded', 'invoice_generated', 'invoice_due',
            'invoice_overdue', 'payment_received', 'payment_failed',
            'subscription_renewed', 'subscription_cancelled', 'dunning_reminder',
            'dunning_suspension_warning', 'dunning_final_notice', 'lead_assigned',
            'quote_sent', 'quote_accepted', 'quote_rejected', 'site_survey_scheduled',
            'site_survey_completed', 'ticket_created', 'ticket_assigned',
            'ticket_updated', 'ticket_resolved', 'ticket_closed', 'ticket_reopened',
            'password_reset', 'account_locked', 'two_factor_enabled',
            'api_key_expiring', 'system_announcement', 'custom'
        )
    """
    )

    op.execute(
        """
        CREATE TYPE notificationpriority AS ENUM ('low', 'medium', 'high', 'urgent')
    """
    )

    # Create notifications table
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "type",
            postgresql.ENUM(name="notificationtype", create_type=False),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "priority",
            postgresql.ENUM(name="notificationpriority", create_type=False),
            nullable=False,
            server_default="medium",
            index=True,
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("action_url", sa.String(1000), nullable=True),
        sa.Column("action_label", sa.String(100), nullable=True),
        sa.Column("related_entity_type", sa.String(100), nullable=True, index=True),
        sa.Column("related_entity_id", sa.String(255), nullable=True, index=True),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false", index=True),
        sa.Column("read_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("is_archived", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("archived_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("channels", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("email_sent", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("email_sent_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("sms_sent", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("sms_sent_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("push_sent", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("push_sent_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("metadata", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    # Create indexes for notifications
    op.create_index(
        "ix_notification_user_unread", "notifications", ["tenant_id", "user_id", "is_read"]
    )
    op.create_index(
        "ix_notification_user_priority", "notifications", ["tenant_id", "user_id", "priority"]
    )
    op.create_index("ix_notification_created", "notifications", ["created_at"])

    # Create notification_preferences table
    op.create_table(
        "notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("email_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sms_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("push_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("quiet_hours_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("quiet_hours_start", sa.String(5), nullable=True),
        sa.Column("quiet_hours_end", sa.String(5), nullable=True),
        sa.Column("quiet_hours_timezone", sa.String(50), nullable=True),
        sa.Column("type_preferences", postgresql.JSON, nullable=False, server_default="{}"),
        sa.Column(
            "minimum_priority",
            postgresql.ENUM(name="notificationpriority", create_type=False),
            nullable=False,
            server_default="low",
        ),
        sa.Column("email_digest_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("email_digest_frequency", sa.String(20), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # Create notification_templates table
    op.create_table(
        "notification_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.String(255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "type",
            postgresql.ENUM(name="notificationtype", create_type=False),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("title_template", sa.String(500), nullable=False),
        sa.Column("message_template", sa.Text, nullable=False),
        sa.Column("action_url_template", sa.String(1000), nullable=True),
        sa.Column("action_label", sa.String(100), nullable=True),
        sa.Column("email_template_name", sa.String(255), nullable=True),
        sa.Column("sms_template", sa.String(160), nullable=True),
        sa.Column("push_title_template", sa.String(100), nullable=True),
        sa.Column("push_body_template", sa.String(200), nullable=True),
        sa.Column(
            "default_priority",
            postgresql.ENUM(name="notificationpriority", create_type=False),
            nullable=False,
            server_default="medium",
        ),
        sa.Column("default_channels", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("required_variables", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )


def downgrade() -> None:
    """Drop notification tables and enums."""

    op.drop_table("notification_templates")
    op.drop_table("notification_preferences")
    op.drop_table("notifications")

    op.execute("DROP TYPE IF EXISTS notificationpriority")
    op.execute("DROP TYPE IF EXISTS notificationtype")
