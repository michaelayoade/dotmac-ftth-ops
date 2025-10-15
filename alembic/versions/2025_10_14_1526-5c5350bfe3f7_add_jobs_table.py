"""add_jobs_table

Revision ID: 5c5350bfe3f7
Revises: fe97cfcb6546
Create Date: 2025-10-14 15:26:06.411496

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

from alembic import op

# revision identifiers, used by Alembic.
revision = "5c5350bfe3f7"
down_revision = "fe97cfcb6546"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create jobs table for generic async job tracking."""
    op.create_table(
        "jobs",
        # Primary key
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        # Multi-tenancy
        sa.Column("tenant_id", sa.String(255), nullable=False, index=True),
        # Job metadata
        sa.Column("job_type", sa.String(50), nullable=False, index=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        # Progress tracking
        sa.Column("progress_percent", sa.Integer, nullable=False, server_default="0"),
        sa.Column("items_total", sa.Integer, nullable=True),
        sa.Column("items_processed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("items_succeeded", sa.Integer, nullable=False, server_default="0"),
        sa.Column("items_failed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("current_item", sa.String(500), nullable=True),
        # Error tracking
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("error_details", JSON, nullable=True),
        sa.Column(
            "failed_items",
            JSON,
            nullable=True,
            comment="List of failed item IDs or references for retry",
        ),
        # Job parameters and results
        sa.Column("parameters", JSON, nullable=True, comment="Input parameters for the job"),
        sa.Column("result", JSON, nullable=True, comment="Job execution result data"),
        # User tracking
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("cancelled_by", sa.String(255), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("cancelled_at", sa.DateTime, nullable=True),
    )

    # Create additional indexes for common queries
    op.create_index("ix_jobs_tenant_status", "jobs", ["tenant_id", "status"])
    op.create_index("ix_jobs_tenant_type", "jobs", ["tenant_id", "job_type"])
    op.create_index("ix_jobs_created_at", "jobs", ["created_at"])


def downgrade() -> None:
    """Drop jobs table."""
    op.drop_index("ix_jobs_created_at", table_name="jobs")
    op.drop_index("ix_jobs_tenant_type", table_name="jobs")
    op.drop_index("ix_jobs_tenant_status", table_name="jobs")
    op.drop_table("jobs")
