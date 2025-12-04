"""fix_crm_audit_columns

Revision ID: cc3d4857f4f5
Revises: 68dbbb28bb5e
Create Date: 2025-10-28 09:46:38.498436

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "cc3d4857f4f5"
down_revision = "68dbbb28bb5e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Fix CRM tables to match model audit columns."""

    # Add is_active column to all CRM tables (from SoftDeleteMixin)
    for table_name in ["leads", "quotes", "site_surveys"]:
        op.add_column(
            table_name,
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        )

    # Replace created_by_id/updated_by_id (UUID) with created_by/updated_by (String)
    for table_name in ["leads", "quotes", "site_surveys"]:
        # Drop old UUID columns
        op.drop_column(table_name, "created_by_id")
        op.drop_column(table_name, "updated_by_id")

        # Add new String columns (from AuditMixin)
        op.add_column(
            table_name,
            sa.Column("created_by", sa.String(255), nullable=True),
        )
        op.add_column(
            table_name,
            sa.Column("updated_by", sa.String(255), nullable=True),
        )


def downgrade() -> None:
    """Revert CRM audit columns to original state."""

    # Remove is_active column
    for table_name in ["leads", "quotes", "site_surveys"]:
        op.drop_column(table_name, "is_active")

    # Revert to UUID columns
    for table_name in ["leads", "quotes", "site_surveys"]:
        # Drop String columns
        op.drop_column(table_name, "created_by")
        op.drop_column(table_name, "updated_by")

        # Add back UUID columns
        from sqlalchemy.dialects import postgresql
        op.add_column(
            table_name,
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.add_column(
            table_name,
            sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
