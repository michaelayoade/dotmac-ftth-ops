"""add_audit_columns_to_service_instances

Revision ID: c6b208ba7659
Revises: c64d9a16fa9d
Create Date: 2025-10-29 05:07:36.091068

"""


from alembic import op

# revision identifiers, used by Alembic.
revision = "c6b208ba7659"
down_revision = "c64d9a16fa9d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add audit columns to service_instances table."""

    # Add created_by column if missing
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'service_instances' AND column_name = 'created_by'
            ) THEN
                ALTER TABLE service_instances ADD COLUMN created_by VARCHAR(255);
            END IF;
        END $$;
    """)

    # Add updated_by column if missing
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'service_instances' AND column_name = 'updated_by'
            ) THEN
                ALTER TABLE service_instances ADD COLUMN updated_by VARCHAR(255);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Remove audit columns from service_instances table."""

    # Drop created_by if it exists
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'service_instances' AND column_name = 'created_by'
            ) THEN
                ALTER TABLE service_instances DROP COLUMN created_by;
            END IF;
        END $$;
    """)

    # Drop updated_by if it exists
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'service_instances' AND column_name = 'updated_by'
            ) THEN
                ALTER TABLE service_instances DROP COLUMN updated_by;
            END IF;
        END $$;
    """)
