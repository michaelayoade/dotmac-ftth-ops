"""add communication_bulk_jobs table

Revision ID: 2025_11_10_0600
Revises: 2025_11_10_0530
Create Date: 2025-11-10 06:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


# revision identifiers, used by Alembic.
revision: str = "2025_11_10_0600"
down_revision: Union[str, None] = "2025_11_10_0530"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create communication_bulk_jobs table for tracking bulk communications."""
    op.create_table(
        "communication_bulk_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("job_id", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("task_id", sa.String(255), nullable=True),
        sa.Column("template_id", sa.String(255), nullable=True),
        sa.Column("recipient_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(50), nullable=False, server_default="queued"),
        sa.Column("metadata", JSON, nullable=False, server_default="{}"),
        sa.Column("tenant_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index(
        "ix_comm_bulk_jobs_job_id",
        "communication_bulk_jobs",
        ["job_id"],
        unique=True,
    )
    op.create_index(
        "ix_comm_bulk_jobs_task_id",
        "communication_bulk_jobs",
        ["task_id"],
        unique=False,
    )
    op.create_index(
        "ix_comm_bulk_jobs_tenant_status",
        "communication_bulk_jobs",
        ["tenant_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_comm_bulk_jobs_created_at",
        "communication_bulk_jobs",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop communication_bulk_jobs table and indexes."""
    op.drop_index("ix_comm_bulk_jobs_created_at", table_name="communication_bulk_jobs")
    op.drop_index("ix_comm_bulk_jobs_tenant_status", table_name="communication_bulk_jobs")
    op.drop_index("ix_comm_bulk_jobs_task_id", table_name="communication_bulk_jobs")
    op.drop_index("ix_comm_bulk_jobs_job_id", table_name="communication_bulk_jobs")
    op.drop_table("communication_bulk_jobs")
