"""
Replace customer email uniqueness constraint with partial index.

This allows re-creating customers with the same email after soft deletion.
The partial index only enforces uniqueness on non-deleted rows (where deleted_at IS NULL).

Revision ID: 2025_10_25_1400
Revises: 2025_10_24_1200
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "2025_10_25_1400"
down_revision: str = "2025_10_24_1200"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    """Replace unique constraint with partial unique index."""
    # Drop the old unique constraint
    op.drop_constraint("uq_tenant_email", "customers", type_="unique")

    # Create partial unique index that only applies to non-deleted rows
    # Use sa.text() for the WHERE clause SQL expression
    # Support both PostgreSQL and SQLite
    op.create_index(
        "uq_tenant_email_active",
        "customers",
        ["tenant_id", "email"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    """Revert to the original unique constraint."""
    # Drop the partial index
    op.drop_index("uq_tenant_email_active", table_name="customers")

    # Recreate the original unique constraint
    # Note: This will fail if there are soft-deleted customers with duplicate emails
    op.create_unique_constraint("uq_tenant_email", "customers", ["tenant_id", "email"])
