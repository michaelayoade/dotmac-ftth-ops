"""fix_wireguard_audit_columns

Revision ID: c8366d789a42
Revises: dc94afeffd28
Create Date: 2025-10-28 11:10:22.736365

"""


from alembic import op

# revision identifiers, used by Alembic.
revision = "c8366d789a42"
down_revision = "dc94afeffd28"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Fix WireGuard audit columns to match model expectations."""

    # Tables that need audit column fixes
    tables_to_fix = [
        "wireguard_servers",
        "wireguard_peers",
    ]

    for table_name in tables_to_fix:
        # Add is_active column (from SoftDeleteMixin)
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

        # Convert created_by from UUID to VARCHAR(255)
        op.execute(f"""
            ALTER TABLE {table_name}
            ALTER COLUMN created_by TYPE VARCHAR(255) USING created_by::text
        """)

        # Convert updated_by from UUID to VARCHAR(255)
        op.execute(f"""
            ALTER TABLE {table_name}
            ALTER COLUMN updated_by TYPE VARCHAR(255) USING updated_by::text
        """)

        # Drop deleted_by column if it exists (not in standard AuditMixin)
        op.execute(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'deleted_by'
                ) THEN
                    ALTER TABLE {table_name} DROP COLUMN deleted_by;
                END IF;
            END $$;
        """)


def downgrade() -> None:
    """Revert WireGuard audit columns to original state."""

    tables_to_revert = [
        "wireguard_servers",
        "wireguard_peers",
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

        # Convert created_by back to UUID
        op.execute(f"""
            ALTER TABLE {table_name}
            ALTER COLUMN created_by TYPE UUID USING created_by::uuid
        """)

        # Convert updated_by back to UUID
        op.execute(f"""
            ALTER TABLE {table_name}
            ALTER COLUMN updated_by TYPE UUID USING updated_by::uuid
        """)

        # Add back deleted_by column
        op.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table_name}' AND column_name = 'deleted_by'
                ) THEN
                    ALTER TABLE {table_name} ADD COLUMN deleted_by UUID;
                END IF;
            END $$;
        """)
