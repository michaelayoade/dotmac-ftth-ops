"""fix_audit_columns_remaining_tables

Revision ID: c9fa6cb000e2
Revises: cc3d4857f4f5
Create Date: 2025-10-28 10:01:04.460174

"""


from alembic import op

# revision identifiers, used by Alembic.
revision = "c9fa6cb000e2"
down_revision = "cc3d4857f4f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Fix audit columns for remaining tables to match model expectations."""

    # Tables that need audit column fixes
    tables_to_fix = [
        "dunning_campaigns",
        "dunning_executions",
        "tickets",
        "usage_records",
    ]

    for table_name in tables_to_fix:
        # Check if is_active column exists, add if missing (from SoftDeleteMixin)
        # Use raw SQL to check if column exists first
        op.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'is_active'
                ) THEN
                    ALTER TABLE {table_name} ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
                END IF;
            END $$;
        """)

        # Drop old UUID columns if they exist
        op.execute(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'created_by_user_id'
                ) THEN
                    ALTER TABLE {table_name} DROP COLUMN created_by_user_id;
                END IF;
            END $$;
        """)

        op.execute(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'updated_by_user_id'
                ) THEN
                    ALTER TABLE {table_name} DROP COLUMN updated_by_user_id;
                END IF;
            END $$;
        """)

        # Add new String columns (from AuditMixin)
        op.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'created_by'
                ) THEN
                    ALTER TABLE {table_name} ADD COLUMN created_by VARCHAR(255);
                END IF;
            END $$;
        """)

        op.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'updated_by'
                ) THEN
                    ALTER TABLE {table_name} ADD COLUMN updated_by VARCHAR(255);
                END IF;
            END $$;
        """)


def downgrade() -> None:
    """Revert audit columns to original state."""

    tables_to_revert = [
        "dunning_campaigns",
        "dunning_executions",
        "tickets",
        "usage_records",
    ]

    for table_name in tables_to_revert:
        # Remove is_active if it exists
        op.execute(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'is_active'
                ) THEN
                    ALTER TABLE {table_name} DROP COLUMN is_active;
                END IF;
            END $$;
        """)

        # Drop String columns
        op.execute(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'created_by'
                ) THEN
                    ALTER TABLE {table_name} DROP COLUMN created_by;
                END IF;
            END $$;
        """)

        op.execute(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'updated_by'
                ) THEN
                    ALTER TABLE {table_name} DROP COLUMN updated_by;
                END IF;
            END $$;
        """)

        # Add back UUID columns

        op.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'created_by_user_id'
                ) THEN
                    ALTER TABLE {table_name} ADD COLUMN created_by_user_id UUID;
                END IF;
            END $$;
        """)

        op.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'updated_by_user_id'
                ) THEN
                    ALTER TABLE {table_name} ADD COLUMN updated_by_user_id UUID;
                END IF;
            END $$;
        """)
