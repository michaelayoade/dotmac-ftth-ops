"""
Add tenant_provisioning_jobs table to track dedicated infra provisioning.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "2025_10_24_0900"
down_revision: str = "2025_10_23_0900"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


TENANT_STATUS_NEW_VALUES = (
    "provisioning",
    "provisioned",
    "failed_provisioning",
)

PROVISIONING_STATUS_VALUES = (
    "queued",
    "in_progress",
    "succeeded",
    "failed",
    "cancelled",
    "timed_out",
)

DEPLOYMENT_MODE_VALUES = (
    "dotmac_hosted",
    "customer_hosted",
)


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        for value in TENANT_STATUS_NEW_VALUES:
            op.execute(
                sa.text("ALTER TYPE tenantstatus ADD VALUE IF NOT EXISTS :value").bindparams(
                    value=value
                )
            )

        provisioning_status_enum = postgresql.ENUM(
            *PROVISIONING_STATUS_VALUES,
            name="tenantprovisioningstatus",
            create_type=False,
        )
        provisioning_status_enum.create(bind, checkfirst=True)

        deployment_mode_enum = postgresql.ENUM(
            *DEPLOYMENT_MODE_VALUES,
            name="tenantdeploymentmode",
            create_type=False,
        )
        deployment_mode_enum.create(bind, checkfirst=True)
    else:
        provisioning_status_enum = sa.Enum(
            *PROVISIONING_STATUS_VALUES,
            name="tenantprovisioningstatus",
        )
        deployment_mode_enum = sa.Enum(
            *DEPLOYMENT_MODE_VALUES,
            name="tenantdeploymentmode",
        )

    op.create_table(
        "tenant_provisioning_jobs",
        sa.Column("id", sa.String(length=255), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("status", provisioning_status_enum, nullable=False),
        sa.Column("deployment_mode", deployment_mode_enum, nullable=False),
        sa.Column("awx_template_id", sa.Integer(), nullable=True),
        sa.Column("awx_job_id", sa.Integer(), nullable=True),
        sa.Column("requested_by", sa.String(length=255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "retry_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("extra_vars", sa.JSON(), nullable=True),
        sa.Column("connection_profile", sa.JSON(), nullable=True),
        sa.Column("last_acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()") if is_postgres else None,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()") if is_postgres else None,
        ),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_tenant_provisioning_jobs_tenant",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_tenant_provisioning_jobs_tenant_id",
        "tenant_provisioning_jobs",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_tenant_provisioning_jobs_status",
        "tenant_provisioning_jobs",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_tenant_provisioning_jobs_awx_job_id",
        "tenant_provisioning_jobs",
        ["awx_job_id"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    op.drop_index("ix_tenant_provisioning_jobs_awx_job_id", table_name="tenant_provisioning_jobs")
    op.drop_index("ix_tenant_provisioning_jobs_status", table_name="tenant_provisioning_jobs")
    op.drop_index("ix_tenant_provisioning_jobs_tenant_id", table_name="tenant_provisioning_jobs")
    op.drop_table("tenant_provisioning_jobs")

    if is_postgres:
        provisioning_status_enum = postgresql.ENUM(
            *PROVISIONING_STATUS_VALUES, name="tenantprovisioningstatus"
        )
        deployment_mode_enum = postgresql.ENUM(
            *DEPLOYMENT_MODE_VALUES, name="tenantdeploymentmode"
        )
        deployment_mode_enum.drop(bind, checkfirst=True)
        provisioning_status_enum.drop(bind, checkfirst=True)

        # Recreate tenantstatus enum without the provisioning values
        op.execute("ALTER TYPE tenantstatus RENAME TO tenantstatus_old")
        tenant_status_enum = postgresql.ENUM(
            "active",
            "suspended",
            "trial",
            "inactive",
            "pending",
            "cancelled",
            name="tenantstatus",
        )
        tenant_status_enum.create(bind, checkfirst=True)
        op.execute(
            "ALTER TABLE tenants ALTER COLUMN status TYPE tenantstatus "
            "USING status::text::tenantstatus"
        )
        op.execute("DROP TYPE tenantstatus_old")
