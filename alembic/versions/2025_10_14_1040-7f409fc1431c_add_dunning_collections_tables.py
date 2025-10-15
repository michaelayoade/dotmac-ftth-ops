"""add_dunning_collections_tables

Revision ID: 7f409fc1431c
Revises: d3f4e8a1b2c5
Create Date: 2025-10-14 10:40:59.073601

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "7f409fc1431c"
down_revision = "d3f4e8a1b2c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add dunning & collections tables for automated payment recovery workflows."""

    # Create enums (with checkfirst to avoid duplicate errors)
    dunning_action_type = sa.Enum(
        "email",
        "sms",
        "suspend_service",
        "terminate_service",
        "webhook",
        "custom",
        name="dunningactiontype",
    )
    dunning_action_type.create(op.get_bind(), checkfirst=True)

    dunning_execution_status = sa.Enum(
        "pending",
        "in_progress",
        "completed",
        "failed",
        "canceled",
        name="dunningexecutionstatus",
    )
    dunning_execution_status.create(op.get_bind(), checkfirst=True)

    # Create dunning_campaigns table
    op.create_table(
        "dunning_campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False, comment="Campaign name"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "trigger_after_days",
            sa.Integer(),
            nullable=False,
            comment="Days past due before triggering campaign",
        ),
        sa.Column(
            "max_retries",
            sa.Integer(),
            nullable=False,
            server_default="3",
            comment="Maximum number of retry attempts",
        ),
        sa.Column(
            "retry_interval_days",
            sa.Integer(),
            nullable=False,
            server_default="3",
            comment="Days between retry attempts",
        ),
        sa.Column(
            "actions",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
            comment="Ordered list of actions to execute",
        ),
        sa.Column(
            "exclusion_rules",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
            comment="Rules for excluding customers from dunning",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        # Statistics (denormalized for performance)
        sa.Column("total_executions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("successful_executions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_recovered_amount", sa.Integer(), nullable=False, server_default="0"),
        # Audit fields
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("deleted_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Indexes for campaigns
    op.create_index(
        "ix_dunning_campaigns_tenant_active", "dunning_campaigns", ["tenant_id", "is_active"]
    )
    op.create_index(
        "ix_dunning_campaigns_tenant_priority", "dunning_campaigns", ["tenant_id", "priority"]
    )

    # Create dunning_executions table
    op.create_table(
        "dunning_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", sa.String(length=50), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subscription_id", sa.String(length=50), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_id", sa.String(length=50), nullable=True),
        # Status tracking
        sa.Column(
            "status",
            postgresql.ENUM(name="dunningexecutionstatus", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("current_step", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_steps", sa.Integer(), nullable=False),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        # Timing
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        # Amounts (in cents)
        sa.Column(
            "outstanding_amount", sa.Integer(), nullable=False, comment="Amount owed in cents"
        ),
        sa.Column("recovered_amount", sa.Integer(), nullable=False, server_default="0"),
        # Execution log (JSON array)
        sa.Column(
            "execution_log",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        # Cancellation
        sa.Column("canceled_reason", sa.Text(), nullable=True),
        sa.Column("canceled_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Metadata
        sa.Column(
            "metadata",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        # Audit fields
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["dunning_campaigns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Indexes for executions
    op.create_index(
        "ix_dunning_executions_tenant_status", "dunning_executions", ["tenant_id", "status"]
    )
    op.create_index("ix_dunning_executions_next_action", "dunning_executions", ["next_action_at"])
    op.create_index(
        "ix_dunning_executions_subscription_status",
        "dunning_executions",
        ["subscription_id", "status"],
    )

    # Create dunning_action_logs table
    op.create_table(
        "dunning_action_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("execution_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "action_type",
            postgresql.ENUM(name="dunningactiontype", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "action_config",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            comment="Action configuration at execution time",
        ),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status", sa.String(length=20), nullable=False, comment="success, failed, skipped"
        ),
        sa.Column(
            "result",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
            comment="Execution result details",
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "external_id",
            sa.String(length=100),
            nullable=True,
            comment="External system reference ID",
        ),
        sa.ForeignKeyConstraint(["execution_id"], ["dunning_executions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Indexes for action logs
    op.create_index(
        "ix_dunning_action_logs_execution_step",
        "dunning_action_logs",
        ["execution_id", "step_number"],
    )
    op.create_index(
        "ix_dunning_action_logs_action_status", "dunning_action_logs", ["action_type", "status"]
    )


def downgrade() -> None:
    """Drop dunning & collections tables."""
    op.drop_index("ix_dunning_action_logs_action_status", table_name="dunning_action_logs")
    op.drop_index("ix_dunning_action_logs_execution_step", table_name="dunning_action_logs")
    op.drop_table("dunning_action_logs")

    op.drop_index("ix_dunning_executions_subscription_status", table_name="dunning_executions")
    op.drop_index("ix_dunning_executions_next_action", table_name="dunning_executions")
    op.drop_index("ix_dunning_executions_tenant_status", table_name="dunning_executions")
    op.drop_table("dunning_executions")

    op.drop_index("ix_dunning_campaigns_tenant_priority", table_name="dunning_campaigns")
    op.drop_index("ix_dunning_campaigns_tenant_active", table_name="dunning_campaigns")
    op.drop_table("dunning_campaigns")

    # Drop enums
    sa.Enum(name="dunningexecutionstatus").drop(op.get_bind())
    sa.Enum(name="dunningactiontype").drop(op.get_bind())
