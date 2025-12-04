"""add_is_active_to_service_instances

Revision ID: c64d9a16fa9d
Revises: 809c5a665392
Create Date: 2025-10-29 04:57:38.787784

"""


from alembic import op

# revision identifiers, used by Alembic.
revision = "c64d9a16fa9d"
down_revision = "809c5a665392"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add is_active column to service_instances table."""

    # Add is_active column if missing
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'service_instances' AND column_name = 'is_active'
            ) THEN
                ALTER TABLE service_instances ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Remove is_active column from service_instances table."""

    # Drop is_active if it exists
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'service_instances' AND column_name = 'is_active'
            ) THEN
                ALTER TABLE service_instances DROP COLUMN is_active;
            END IF;
        END $$;
    """)
