"""normalize_tenant_enum_values

Revision ID: 1c4f4d118c39
Revises: ee4f9c4fb5b3
Create Date: 2025-11-07 12:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "1c4f4d118c39"
down_revision = "ee4f9c4fb5b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Normalize enum columns to lowercase to match canonical values."""
    statements = [
        "UPDATE tenants SET status = LOWER(status::text)::tenantstatus WHERE status::text <> LOWER(status::text);",
        "UPDATE tenants SET plan_type = LOWER(plan_type::text)::tenantplantype WHERE plan_type::text <> LOWER(plan_type::text);",
        "UPDATE tenants SET billing_cycle = LOWER(billing_cycle::text)::billingcycle WHERE billing_cycle::text <> LOWER(billing_cycle::text);",
        "UPDATE tenant_invitations SET status = LOWER(status::text)::tenantinvitationstatus WHERE status::text <> LOWER(status::text);",
        "UPDATE tenant_provisioning_jobs SET status = LOWER(status::text)::tenantprovisioningstatus WHERE status::text <> LOWER(status::text);",
        "UPDATE tenant_provisioning_jobs SET deployment_mode = LOWER(deployment_mode::text)::tenantdeploymentmode WHERE deployment_mode::text <> LOWER(deployment_mode::text);",
    ]

    for stmt in statements:
        op.execute(stmt)


def downgrade() -> None:
    """Revert enum values to uppercase (previous behaviour)."""
    statements = [
        "UPDATE tenants SET status = UPPER(status::text)::tenantstatus WHERE status::text <> UPPER(status::text);",
        "UPDATE tenants SET plan_type = UPPER(plan_type::text)::tenantplantype WHERE plan_type::text <> UPPER(plan_type::text);",
        "UPDATE tenants SET billing_cycle = UPPER(billing_cycle::text)::billingcycle WHERE billing_cycle::text <> UPPER(billing_cycle::text);",
        "UPDATE tenant_invitations SET status = UPPER(status::text)::tenantinvitationstatus WHERE status::text <> UPPER(status::text);",
        "UPDATE tenant_provisioning_jobs SET status = UPPER(status::text)::tenantprovisioningstatus WHERE status::text <> UPPER(status::text);",
        "UPDATE tenant_provisioning_jobs SET deployment_mode = UPPER(deployment_mode::text)::tenantdeploymentmode WHERE deployment_mode::text <> UPPER(deployment_mode::text);",
    ]

    for stmt in statements:
        op.execute(stmt)
