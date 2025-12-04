"""Add tenant scoping to workflows

SECURITY NOTE: This migration enforces explicit scoping decisions.
You must either backfill all workflows to a tenant (recommended) or explicitly
allow global workflows with is_global before the migration will run.
"""

from __future__ import annotations

import os

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "2025_11_30_1200"
down_revision = "2025_11_27_1200"
branch_labels = None
depends_on = None

ALLOW_GLOBAL_ENV = "WORKFLOW_ALLOW_GLOBAL_WORKFLOWS"
BACKFILL_ENV = "WORKFLOW_DEFAULT_TENANT_ID"


def _get_unique_constraints(conn):
    inspector = inspect(conn)
    return {c["name"] for c in inspector.get_unique_constraints("workflows")}


def _get_indexes(conn):
    inspector = inspect(conn)
    return inspector.get_indexes("workflows")


def _create_global_unique_index(conn):
    # PostgreSQL allows a partial unique index to keep global names unique
    if conn.dialect.name != "postgresql":
        return

    op.create_index(
        "uq_workflows_global_name",
        "workflows",
        ["name"],
        unique=True,
        postgresql_where=sa.text("tenant_id IS NULL AND is_global IS TRUE"),
    )


def upgrade() -> None:
    conn = op.get_bind()
    existing_constraints = _get_unique_constraints(conn)
    existing_indexes = _get_indexes(conn)

    with op.batch_alter_table("workflows") as batch_op:
        # Drop the previous global uniqueness so tenant-specific duplicates are allowed
        if "workflows_name_key" in existing_constraints:
            batch_op.drop_constraint("workflows_name_key", type_="unique")
        if any(idx["name"] == "ix_workflows_name" for idx in existing_indexes):
            batch_op.drop_index("ix_workflows_name")
        batch_op.add_column(sa.Column("tenant_id", sa.String(length=255), nullable=True))
        batch_op.add_column(
            sa.Column(
                "is_global",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.create_index("ix_workflows_tenant_id", ["tenant_id"], unique=False)
        batch_op.create_unique_constraint(
            "uq_workflows_tenant_name", ["tenant_id", "name"]
        )
        batch_op.create_foreign_key(
            "fk_workflows_tenant_id",
            "tenants",
            ["tenant_id"],
            ["id"],
            ondelete="CASCADE",
        )

    _create_global_unique_index(conn)

    default_tenant_id = os.environ.get(BACKFILL_ENV)
    allow_global_workflows = os.environ.get(ALLOW_GLOBAL_ENV, "").lower() in {
        "1",
        "true",
        "yes",
        "y",
    }

    if not default_tenant_id and not allow_global_workflows:
        raise RuntimeError(
            "Workflows must be tenant-scoped during migration. "
            f"Set {BACKFILL_ENV} to backfill existing workflows to a tenant, or set "
            f"{ALLOW_GLOBAL_ENV}=true to explicitly retain global workflows with is_global."
        )

    if default_tenant_id:
        # Use raw SQL to avoid ORM dependencies in migration
        op.execute(
            sa.text(
                "UPDATE workflows SET tenant_id = :tenant_id WHERE tenant_id IS NULL"
            ).bindparams(tenant_id=default_tenant_id)
        )
    elif allow_global_workflows:
        op.execute(
            sa.text("UPDATE workflows SET is_global = TRUE WHERE tenant_id IS NULL")
        )

    with op.batch_alter_table("workflows") as batch_op:
        batch_op.create_check_constraint(
            "ck_workflows_scope",
            sa.text(
                "(is_global = TRUE AND tenant_id IS NULL) "
                "OR (is_global = FALSE AND tenant_id IS NOT NULL)"
            ),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        op.drop_index("uq_workflows_global_name", table_name="workflows")

    with op.batch_alter_table("workflows") as batch_op:
        batch_op.drop_constraint("fk_workflows_tenant_id", type_="foreignkey")
        batch_op.drop_constraint("uq_workflows_tenant_name", type_="unique")
        batch_op.drop_constraint("ck_workflows_scope", type_="check")
        batch_op.drop_index("ix_workflows_tenant_id")
        batch_op.drop_column("is_global")
        batch_op.drop_column("tenant_id")

    op.create_index("ix_workflows_name", "workflows", ["name"], unique=True)
