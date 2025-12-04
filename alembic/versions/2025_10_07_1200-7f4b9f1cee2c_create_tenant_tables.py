"""Create tenant core tables

Revision ID: 7f4b9f1cee2c
Revises: 51aa0da58b97
Create Date: 2025-10-07 12:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "7f4b9f1cee2c"
down_revision = "51aa0da58b97"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    tenant_status_enum = postgresql.ENUM(
        "active",
        "suspended",
        "trial",
        "inactive",
        "pending",
        "cancelled",
        name="tenantstatus",
        create_type=False,
    )
    tenant_status_enum.create(bind, checkfirst=True)

    tenant_plan_type_enum = postgresql.ENUM(
        "free",
        "starter",
        "professional",
        "enterprise",
        "custom",
        name="tenantplantype",
        create_type=False,
    )
    tenant_plan_type_enum.create(bind, checkfirst=True)

    billing_cycle_enum = postgresql.ENUM(
        "monthly",
        "quarterly",
        "yearly",
        "custom",
        name="billingcycle",
        create_type=False,
    )
    billing_cycle_enum.create(bind, checkfirst=True)

    tenant_invitation_status_enum = postgresql.ENUM(
        "pending",
        "accepted",
        "expired",
        "revoked",
        name="tenantinvitationstatus",
        create_type=False,
    )
    tenant_invitation_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "tenants",
        sa.Column("id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=True),
        sa.Column("status", tenant_status_enum, nullable=False),
        sa.Column("plan_type", tenant_plan_type_enum, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("billing_email", sa.String(length=255), nullable=True),
        sa.Column("billing_cycle", billing_cycle_enum, nullable=False),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("subscription_starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("subscription_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("max_users", sa.Integer(), nullable=False),
        sa.Column("max_api_calls_per_month", sa.Integer(), nullable=False),
        sa.Column("max_storage_gb", sa.Integer(), nullable=False),
        sa.Column("current_users", sa.Integer(), nullable=False),
        sa.Column("current_api_calls", sa.Integer(), nullable=False),
        sa.Column("current_storage_gb", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("features", sa.JSON(), nullable=False),
        sa.Column("settings", sa.JSON(), nullable=False),
        sa.Column("custom_metadata", sa.JSON(), nullable=False),
        sa.Column("company_size", sa.String(length=50), nullable=True),
        sa.Column("industry", sa.String(length=100), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("timezone", sa.String(length=50), nullable=False),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("primary_color", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
        sa.UniqueConstraint("domain"),
    )
    op.create_index(op.f("ix_tenants_status"), "tenants", ["status"], unique=False)

    op.create_table(
        "tenant_settings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "tenant_id",
            sa.String(length=255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(length=255), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("value_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_encrypted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "key", name="uq_tenant_setting_key"),
    )
    op.create_index(
        op.f("ix_tenant_settings_tenant_id"), "tenant_settings", ["tenant_id"], unique=False
    )
    op.create_index(op.f("ix_tenant_settings_key"), "tenant_settings", ["key"], unique=False)

    op.create_table(
        "tenant_usage",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "tenant_id",
            sa.String(length=255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("api_calls", sa.Integer(), nullable=False),
        sa.Column("storage_gb", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("active_users", sa.Integer(), nullable=False),
        sa.Column("bandwidth_gb", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tenant_usage_tenant_id"), "tenant_usage", ["tenant_id"], unique=False)
    op.create_index(
        "ix_tenant_usage_period",
        "tenant_usage",
        ["tenant_id", "period_start", "period_end"],
        unique=False,
    )

    op.create_table(
        "tenant_invitations",
        sa.Column("id", sa.String(length=255), nullable=False),
        sa.Column(
            "tenant_id",
            sa.String(length=255),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=100), nullable=False),
        sa.Column("invited_by", sa.String(length=255), nullable=False),
        sa.Column("status", tenant_invitation_status_enum, nullable=False),
        sa.Column("token", sa.String(length=500), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index(
        op.f("ix_tenant_invitations_tenant_id"),
        "tenant_invitations",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_tenant_invitations_email"), "tenant_invitations", ["email"], unique=False
    )
    op.create_index(
        op.f("ix_tenant_invitations_status"),
        "tenant_invitations",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_tenant_invitations_status"), table_name="tenant_invitations")
    op.drop_index(op.f("ix_tenant_invitations_email"), table_name="tenant_invitations")
    op.drop_index(
        op.f("ix_tenant_invitations_tenant_id"),
        table_name="tenant_invitations",
    )
    op.drop_table("tenant_invitations")

    op.drop_index("ix_tenant_usage_period", table_name="tenant_usage")
    op.drop_index(op.f("ix_tenant_usage_tenant_id"), table_name="tenant_usage")
    op.drop_table("tenant_usage")

    op.drop_index(op.f("ix_tenant_settings_key"), table_name="tenant_settings")
    op.drop_index(op.f("ix_tenant_settings_tenant_id"), table_name="tenant_settings")
    op.drop_table("tenant_settings")

    op.drop_index(op.f("ix_tenants_status"), table_name="tenants")
    op.drop_table("tenants")

    bind = op.get_bind()
    postgresql.ENUM(name="tenantinvitationstatus").drop(bind, checkfirst=True)
    postgresql.ENUM(name="billingcycle").drop(bind, checkfirst=True)
    postgresql.ENUM(name="tenantplantype").drop(bind, checkfirst=True)
    postgresql.ENUM(name="tenantstatus").drop(bind, checkfirst=True)
