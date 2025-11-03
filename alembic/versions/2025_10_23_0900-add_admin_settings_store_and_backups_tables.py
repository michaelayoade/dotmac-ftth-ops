"""
Add admin_settings_store and admin_settings_backups tables.

Creates two new tables for persisting admin settings configuration:
- admin_settings_store: Stores current settings by category
- admin_settings_backups: Stores backup snapshots of settings
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "2025_10_23_0900"
down_revision: str = "2025_10_22_1530"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Create admin_settings_store table
    op.create_table(
        "admin_settings_store",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "settings_data",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "updated_by",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Create indexes for admin_settings_store
    op.create_index(
        "ix_admin_settings_store_id",
        "admin_settings_store",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_admin_settings_store_category",
        "admin_settings_store",
        ["category"],
        unique=True,
    )

    # Create admin_settings_backups table
    op.create_table(
        "admin_settings_backups",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "categories",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "settings_data",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Create indexes for admin_settings_backups
    op.create_index(
        "ix_admin_settings_backups_id",
        "admin_settings_backups",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_admin_settings_backups_name",
        "admin_settings_backups",
        ["name"],
        unique=False,
    )
    op.create_index(
        "ix_admin_settings_backups_created_by",
        "admin_settings_backups",
        ["created_by"],
        unique=False,
    )
    op.create_index(
        "ix_admin_settings_backups_created_at",
        "admin_settings_backups",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    # Drop admin_settings_backups table and its indexes
    op.drop_index("ix_admin_settings_backups_created_at", table_name="admin_settings_backups")
    op.drop_index("ix_admin_settings_backups_created_by", table_name="admin_settings_backups")
    op.drop_index("ix_admin_settings_backups_name", table_name="admin_settings_backups")
    op.drop_index("ix_admin_settings_backups_id", table_name="admin_settings_backups")
    op.drop_table("admin_settings_backups")

    # Drop admin_settings_store table and its indexes
    op.drop_index("ix_admin_settings_store_category", table_name="admin_settings_store")
    op.drop_index("ix_admin_settings_store_id", table_name="admin_settings_store")
    op.drop_table("admin_settings_store")
