"""add_is_active_to_tenants

Revision ID: d3db200d30ec
Revises: 364eab9b9915
Create Date: 2025-10-09 11:36:25.202059

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "d3db200d30ec"
down_revision = "364eab9b9915"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_active column to tenants table (from SoftDeleteMixin)
    op.add_column(
        "tenants",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    # Remove is_active column from tenants table
    op.drop_column("tenants", "is_active")
