"""add_audit_columns_to_subscribers

Revision ID: 809c5a665392
Revises: c8366d789a42
Create Date: 2025-10-29 04:49:26.157535

"""


from alembic import op

# revision identifiers, used by Alembic.
revision = "809c5a665392"
down_revision = "c8366d789a42"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add audit columns to subscribers table."""

    # Add created_by column if missing
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'subscribers' AND column_name = 'created_by'
            ) THEN
                ALTER TABLE subscribers ADD COLUMN created_by VARCHAR(255);
            END IF;
        END $$;
    """)

    # Add updated_by column if missing
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'subscribers' AND column_name = 'updated_by'
            ) THEN
                ALTER TABLE subscribers ADD COLUMN updated_by VARCHAR(255);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Remove audit columns from subscribers table."""

    # Drop created_by if it exists
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'subscribers' AND column_name = 'created_by'
            ) THEN
                ALTER TABLE subscribers DROP COLUMN created_by;
            END IF;
        END $$;
    """)

    # Drop updated_by if it exists
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'subscribers' AND column_name = 'updated_by'
            ) THEN
                ALTER TABLE subscribers DROP COLUMN updated_by;
            END IF;
        END $$;
    """)
