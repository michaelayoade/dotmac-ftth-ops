"""Add workflow orchestration tables

Revision ID: b9981f13539b
Revises: 25eed1ceec2d
Create Date: 2025-10-16 15:09:57.058890

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "b9981f13539b"
down_revision = "25eed1ceec2d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types (check if they exist first)
    bind = op.get_bind()

    # Check and create workflowstatus enum
    result = bind.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname = 'workflowstatus'"
    )).scalar()
    if not result:
        sa.Enum(
            "pending", "running", "completed", "failed", "cancelled", name="workflowstatus"
        ).create(bind)

    # Check and create stepstatus enum
    result = bind.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname = 'stepstatus'"
    )).scalar()
    if not result:
        sa.Enum(
            "pending", "running", "completed", "failed", "skipped", name="stepstatus"
        ).create(bind)

    # Define enums for column creation (create_type=False prevents re-creation)
    workflow_status_enum = sa.Enum(
        "pending", "running", "completed", "failed", "cancelled",
        name="workflowstatus",
        create_type=False
    )
    step_status_enum = sa.Enum(
        "pending", "running", "completed", "failed", "skipped",
        name="stepstatus",
        create_type=False
    )

    # Create workflows table
    op.create_table(
        "workflows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("definition", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("version", sa.String(20), server_default="1.0.0"),
        sa.Column("tags", sa.JSON()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflows_name", "workflows", ["name"], unique=True)

    # Create workflow_executions table
    op.create_table(
        "workflow_executions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workflow_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            workflow_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("context", sa.JSON()),
        sa.Column("result", sa.JSON()),
        sa.Column("error_message", sa.Text()),
        sa.Column("started_at", sa.DateTime()),
        sa.Column("completed_at", sa.DateTime()),
        sa.Column("trigger_type", sa.String(50)),
        sa.Column("trigger_source", sa.String(255)),
        sa.Column("tenant_id", sa.String(length=255)),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflow_executions_workflow_id", "workflow_executions", ["workflow_id"])
    op.create_index("ix_workflow_executions_status", "workflow_executions", ["status"])
    op.create_index("ix_workflow_executions_tenant_id", "workflow_executions", ["tenant_id"])

    # Create workflow_steps table
    op.create_table(
        "workflow_steps",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("execution_id", sa.Integer(), nullable=False),
        sa.Column("step_name", sa.String(255), nullable=False),
        sa.Column("step_type", sa.String(50), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            step_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("input_data", sa.JSON()),
        sa.Column("output_data", sa.JSON()),
        sa.Column("error_message", sa.Text()),
        sa.Column("error_details", sa.JSON()),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("max_retries", sa.Integer(), server_default="3"),
        sa.Column("started_at", sa.DateTime()),
        sa.Column("completed_at", sa.DateTime()),
        sa.Column("duration_seconds", sa.Integer()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["execution_id"], ["workflow_executions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflow_steps_execution_id", "workflow_steps", ["execution_id"])
    op.create_index("ix_workflow_steps_status", "workflow_steps", ["status"])
    op.create_index("ix_workflow_steps_sequence", "workflow_steps", ["execution_id", "sequence_number"])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index("ix_workflow_steps_sequence", "workflow_steps")
    op.drop_index("ix_workflow_steps_status", "workflow_steps")
    op.drop_index("ix_workflow_steps_execution_id", "workflow_steps")
    op.drop_table("workflow_steps")

    op.drop_index("ix_workflow_executions_tenant_id", "workflow_executions")
    op.drop_index("ix_workflow_executions_status", "workflow_executions")
    op.drop_index("ix_workflow_executions_workflow_id", "workflow_executions")
    op.drop_table("workflow_executions")

    op.drop_index("ix_workflows_name", "workflows")
    op.drop_table("workflows")

    # Drop enums
    sa.Enum(name="stepstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="workflowstatus").drop(op.get_bind(), checkfirst=True)
