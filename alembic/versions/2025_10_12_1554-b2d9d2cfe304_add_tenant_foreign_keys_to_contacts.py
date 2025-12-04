"""add_tenant_foreign_keys_to_contacts

Revision ID: b2d9d2cfe304
Revises: d3db200d30ec
Create Date: 2025-10-12 15:54:10.673715

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "b2d9d2cfe304"
down_revision = "d3db200d30ec"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add foreign key constraints to tenant_id columns in contact tables.

    Note: tenant_id columns already exist but were UUIDs without FK constraints.
    This migration:
    1. Converts tenant_id from UUID to String(255) to match tenants.id
    2. Adds foreign key constraints with CASCADE delete
    3. Adds indexes for performance
    """
    # Contacts table
    with op.batch_alter_table("contacts", schema=None) as batch_op:
        # Drop existing column and recreate with proper type and FK
        batch_op.drop_column("tenant_id")
        batch_op.add_column(
            sa.Column(
                "tenant_id",
                sa.String(length=255),
                nullable=False,
                server_default="default",  # Temporary default for migration
            )
        )
        batch_op.create_foreign_key(
            "fk_contacts_tenant_id",
            "tenants",
            ["tenant_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("ix_contacts_tenant_id", ["tenant_id"])
        # Remove temporary default
        batch_op.alter_column("tenant_id", server_default=None)

    # Contact label definitions table
    with op.batch_alter_table("contact_label_definitions", schema=None) as batch_op:
        batch_op.drop_column("tenant_id")
        batch_op.add_column(
            sa.Column(
                "tenant_id",
                sa.String(length=255),
                nullable=False,
                server_default="default",
            )
        )
        batch_op.create_foreign_key(
            "fk_contact_label_definitions_tenant_id",
            "tenants",
            ["tenant_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("ix_contact_label_definitions_tenant_id", ["tenant_id"])
        batch_op.alter_column("tenant_id", server_default=None)

    # Contact field definitions table
    with op.batch_alter_table("contact_field_definitions", schema=None) as batch_op:
        batch_op.drop_column("tenant_id")
        batch_op.add_column(
            sa.Column(
                "tenant_id",
                sa.String(length=255),
                nullable=False,
                server_default="default",
            )
        )
        batch_op.create_foreign_key(
            "fk_contact_field_definitions_tenant_id",
            "tenants",
            ["tenant_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("ix_contact_field_definitions_tenant_id", ["tenant_id"])
        batch_op.alter_column("tenant_id", server_default=None)


def downgrade() -> None:
    """Revert tenant_id columns to UUID without foreign keys."""
    # Contact field definitions table
    with op.batch_alter_table("contact_field_definitions", schema=None) as batch_op:
        batch_op.drop_index("ix_contact_field_definitions_tenant_id")
        batch_op.drop_constraint("fk_contact_field_definitions_tenant_id", type_="foreignkey")
        batch_op.drop_column("tenant_id")
        batch_op.add_column(
            sa.Column("tenant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False)
        )

    # Contact label definitions table
    with op.batch_alter_table("contact_label_definitions", schema=None) as batch_op:
        batch_op.drop_index("ix_contact_label_definitions_tenant_id")
        batch_op.drop_constraint("fk_contact_label_definitions_tenant_id", type_="foreignkey")
        batch_op.drop_column("tenant_id")
        batch_op.add_column(
            sa.Column("tenant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False)
        )

    # Contacts table
    with op.batch_alter_table("contacts", schema=None) as batch_op:
        batch_op.drop_index("ix_contacts_tenant_id")
        batch_op.drop_constraint("fk_contacts_tenant_id", type_="foreignkey")
        batch_op.drop_column("tenant_id")
        batch_op.add_column(
            sa.Column("tenant_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False)
        )
