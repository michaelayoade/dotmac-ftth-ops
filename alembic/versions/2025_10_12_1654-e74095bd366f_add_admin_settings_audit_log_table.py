"""add_admin_settings_audit_log_table

Revision ID: e74095bd366f
Revises: 4061a8796d56
Create Date: 2025-10-12 16:54:03.113345

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "e74095bd366f"
down_revision = "4061a8796d56"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create admin_settings_audit_log table
    op.create_table(
        "admin_settings_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=True, index=True),
        sa.Column("user_email", sa.String(255), nullable=True),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("changes", postgresql.JSON, nullable=False),
        # TenantMixin fields
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        # TimestampMixin fields
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # Create indexes
    op.create_index(
        "ix_admin_settings_audit_log_tenant_category",
        "admin_settings_audit_log",
        ["tenant_id", "category"],
    )
    op.create_index(
        "ix_admin_settings_audit_log_created_at",
        "admin_settings_audit_log",
        ["created_at"],
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_admin_settings_audit_log_created_at", table_name="admin_settings_audit_log")
    op.drop_index(
        "ix_admin_settings_audit_log_tenant_category", table_name="admin_settings_audit_log"
    )

    # Drop table
    op.drop_table("admin_settings_audit_log")
