"""add genieacs schedules and jobs

Revision ID: abc123genieacs
Revises: 5a517bdd0997
Create Date: 2025-10-14 22:27:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "abc123genieacs"
down_revision: str | None = "5a517bdd0997"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create firmware_upgrade_schedules table
    op.create_table(
        "firmware_upgrade_schedules",
        sa.Column("schedule_id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("firmware_file", sa.String(length=255), nullable=False),
        sa.Column(
            "file_type",
            sa.String(length=100),
            nullable=True,
            server_default="1 Firmware Upgrade Image",
        ),
        sa.Column("device_filter", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=50), nullable=True, server_default="UTC"),
        sa.Column("max_concurrent", sa.Integer(), nullable=True, server_default="10"),
        sa.Column("status", sa.String(length=50), nullable=True, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_firmware_schedules_tenant"),
        sa.PrimaryKeyConstraint("schedule_id", name="pk_firmware_upgrade_schedules"),
    )

    # Create indexes for firmware_upgrade_schedules
    op.create_index("ix_firmware_schedules_tenant_id", "firmware_upgrade_schedules", ["tenant_id"])
    op.create_index("ix_firmware_schedules_status", "firmware_upgrade_schedules", ["status"])
    op.create_index(
        "ix_firmware_schedules_tenant_status", "firmware_upgrade_schedules", ["tenant_id", "status"]
    )
    op.create_index(
        "ix_firmware_schedules_scheduled_at", "firmware_upgrade_schedules", ["scheduled_at"]
    )

    # Create firmware_upgrade_results table
    op.create_table(
        "firmware_upgrade_results",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("schedule_id", sa.String(length=36), nullable=False),
        sa.Column("device_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=True, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["schedule_id"],
            ["firmware_upgrade_schedules.schedule_id"],
            name="fk_firmware_results_schedule",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_firmware_upgrade_results"),
    )

    # Create indexes for firmware_upgrade_results
    op.create_index("ix_firmware_results_schedule_id", "firmware_upgrade_results", ["schedule_id"])
    op.create_index("ix_firmware_results_device", "firmware_upgrade_results", ["device_id"])
    op.create_index("ix_firmware_results_status", "firmware_upgrade_results", ["status"])
    op.create_index(
        "ix_firmware_results_schedule_status", "firmware_upgrade_results", ["schedule_id", "status"]
    )

    # Create mass_config_jobs table
    op.create_table(
        "mass_config_jobs",
        sa.Column("job_id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("device_filter", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("config_changes", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("total_devices", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("completed_devices", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("failed_devices", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("pending_devices", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("status", sa.String(length=50), nullable=True, server_default="pending"),
        sa.Column("dry_run", sa.String(length=10), nullable=True, server_default="false"),
        sa.Column("max_concurrent", sa.Integer(), nullable=True, server_default="10"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_mass_config_jobs_tenant"),
        sa.PrimaryKeyConstraint("job_id", name="pk_mass_config_jobs"),
    )

    # Create indexes for mass_config_jobs
    op.create_index("ix_mass_config_jobs_tenant_id", "mass_config_jobs", ["tenant_id"])
    op.create_index("ix_mass_config_jobs_status", "mass_config_jobs", ["status"])
    op.create_index(
        "ix_mass_config_jobs_tenant_status", "mass_config_jobs", ["tenant_id", "status"]
    )
    op.create_index("ix_mass_config_jobs_created_at", "mass_config_jobs", ["created_at"])

    # Create mass_config_results table
    op.create_table(
        "mass_config_results",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=False),
        sa.Column("device_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=True, server_default="pending"),
        sa.Column("parameters_changed", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["mass_config_jobs.job_id"],
            name="fk_mass_config_results_job",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_mass_config_results"),
    )

    # Create indexes for mass_config_results
    op.create_index("ix_mass_config_results_job_id", "mass_config_results", ["job_id"])
    op.create_index("ix_mass_config_results_device", "mass_config_results", ["device_id"])
    op.create_index("ix_mass_config_results_status", "mass_config_results", ["status"])
    op.create_index(
        "ix_mass_config_results_job_status", "mass_config_results", ["job_id", "status"]
    )


def downgrade() -> None:
    # Drop mass_config_results table
    op.drop_index("ix_mass_config_results_job_status", table_name="mass_config_results")
    op.drop_index("ix_mass_config_results_status", table_name="mass_config_results")
    op.drop_index("ix_mass_config_results_device", table_name="mass_config_results")
    op.drop_index("ix_mass_config_results_job_id", table_name="mass_config_results")
    op.drop_table("mass_config_results")

    # Drop mass_config_jobs table
    op.drop_index("ix_mass_config_jobs_created_at", table_name="mass_config_jobs")
    op.drop_index("ix_mass_config_jobs_tenant_status", table_name="mass_config_jobs")
    op.drop_index("ix_mass_config_jobs_status", table_name="mass_config_jobs")
    op.drop_index("ix_mass_config_jobs_tenant_id", table_name="mass_config_jobs")
    op.drop_table("mass_config_jobs")

    # Drop firmware_upgrade_results table
    op.drop_index("ix_firmware_results_schedule_status", table_name="firmware_upgrade_results")
    op.drop_index("ix_firmware_results_status", table_name="firmware_upgrade_results")
    op.drop_index("ix_firmware_results_device", table_name="firmware_upgrade_results")
    op.drop_index("ix_firmware_results_schedule_id", table_name="firmware_upgrade_results")
    op.drop_table("firmware_upgrade_results")

    # Drop firmware_upgrade_schedules table
    op.drop_index("ix_firmware_schedules_scheduled_at", table_name="firmware_upgrade_schedules")
    op.drop_index("ix_firmware_schedules_tenant_status", table_name="firmware_upgrade_schedules")
    op.drop_index("ix_firmware_schedules_status", table_name="firmware_upgrade_schedules")
    op.drop_index("ix_firmware_schedules_tenant_id", table_name="firmware_upgrade_schedules")
    op.drop_table("firmware_upgrade_schedules")
