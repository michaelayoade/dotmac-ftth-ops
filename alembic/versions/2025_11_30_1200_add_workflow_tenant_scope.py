"""Add tenant scoping to workflows

SECURITY NOTE: This migration adds tenant isolation to workflows.
Existing workflows with NULL tenant_id will remain global (visible to all tenants).

For strict tenant isolation, run the data migration after this schema migration:
    UPDATE workflows SET tenant_id = '<default_tenant_id>' WHERE tenant_id IS NULL;

Or, if you want to keep some global templates, mark them explicitly and migrate the rest:
    1. Create a backup: SELECT * FROM workflows WHERE tenant_id IS NULL;
    2. Identify global templates that should remain visible to all tenants
    3. Backfill tenant_id for the rest
"""

from __future__ import annotations

import os

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "2025_11_30_1200"
down_revision = "2025_11_27_1200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove global uniqueness to allow per-tenant templates
    # First try to drop the constraint if it exists (may not exist in all environments)
    from sqlalchemy import inspect
    from alembic import op as alembic_op

    conn = alembic_op.get_bind()
    inspector = inspect(conn)
    existing_constraints = [c["name"] for c in inspector.get_unique_constraints("workflows")]

    with op.batch_alter_table("workflows") as batch_op:
        if "workflows_name_key" in existing_constraints:
            batch_op.drop_constraint("workflows_name_key", type_="unique")
        batch_op.add_column(sa.Column("tenant_id", sa.String(length=255), nullable=True))
        batch_op.create_index("ix_workflows_tenant_id", ["tenant_id"], unique=False)
        batch_op.create_unique_constraint(
            "uq_workflows_tenant_name", ["tenant_id", "name"]
        )

    # Optional: Backfill existing workflows with a default tenant_id
    # This prevents data leakage where NULL tenant_id records are visible to all tenants
    # Set WORKFLOW_DEFAULT_TENANT_ID env var to enable backfill during migration
    default_tenant_id = os.environ.get("WORKFLOW_DEFAULT_TENANT_ID")
    if default_tenant_id:
        # Use raw SQL to avoid ORM dependencies in migration
        op.execute(
            sa.text(
                "UPDATE workflows SET tenant_id = :tenant_id WHERE tenant_id IS NULL"
            ).bindparams(tenant_id=default_tenant_id)
        )


def downgrade() -> None:
    with op.batch_alter_table("workflows") as batch_op:
        batch_op.drop_constraint("uq_workflows_tenant_name", type_="unique")
        batch_op.drop_index("ix_workflows_tenant_id")
        batch_op.drop_column("tenant_id")
        batch_op.create_unique_constraint("workflows_name_key", ["name"])
