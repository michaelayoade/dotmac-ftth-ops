"""Fix subscriber constraints and password security

This migration addresses three critical issues in the subscribers table:
1. Soft-delete conflicts with unique constraints
2. Nullable subscriber_number with UniqueConstraint
3. Add password hashing support

Changes:
- Replace UniqueConstraints with partial indexes that exclude soft-deleted rows
- Change subscriber_number to NOT NULL with default empty string
- Add password_hash_method column
- Update indexes to support efficient queries

Revision ID: m7n8o9p0q1r2
Revises: f7g8h9i0j1k2
Create Date: 2025-10-25 18:00:00.000000

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = 'm7n8o9p0q1r2'
down_revision = 'f7g8h9i0j1k2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply changes to fix subscriber constraints and add password security."""

    # Step 1: Add password_hash_method column
    op.add_column(
        'subscribers',
        sa.Column(
            'password_hash_method',
            sa.String(length=20),
            nullable=False,
            server_default='sha256',
            comment='Hashing method used for password (cleartext, md5, sha256, bcrypt)',
        )
    )

    # Step 2: Update subscriber_number NULL values to empty string
    op.execute("UPDATE subscribers SET subscriber_number = '' WHERE subscriber_number IS NULL")

    # Step 3: Alter subscriber_number to NOT NULL
    op.alter_column(
        'subscribers',
        'subscriber_number',
        existing_type=sa.String(length=50),
        nullable=False,
        server_default='',
        comment='Human-readable subscriber ID (empty string if not assigned, unique per tenant when not soft-deleted)',
    )

    # Step 4: Drop old unique constraints
    op.drop_constraint('uq_subscriber_tenant_username', 'subscribers', type_='unique')
    op.drop_constraint('uq_subscriber_tenant_number', 'subscribers', type_='unique')

    # Step 5: Create partial unique index for username (excludes soft-deleted)
    op.execute("""
        CREATE UNIQUE INDEX uq_subscriber_tenant_username_active
        ON subscribers (tenant_id, username)
        WHERE deleted_at IS NULL
    """)

    # Step 6: Create partial unique index for subscriber_number (excludes soft-deleted and empty)
    op.execute("""
        CREATE UNIQUE INDEX uq_subscriber_tenant_number_active
        ON subscribers (tenant_id, subscriber_number)
        WHERE deleted_at IS NULL AND subscriber_number != ''
    """)

    # Step 7: Add index on deleted_at for efficient soft-delete queries
    op.create_index(
        'ix_subscriber_deleted_at',
        'subscribers',
        ['deleted_at'],
        unique=False,
    )

    # Step 8: Update password column comment
    op.alter_column(
        'subscribers',
        'password',
        existing_type=sa.String(length=255),
        comment="RADIUS password - stored with hash method prefix (e.g., 'sha256:abc123...'). "
                "Use set_password() method to hash automatically. "
                "Supports: cleartext (insecure), md5 (legacy), sha256 (recommended), bcrypt (future).",
    )

    # Step 9: Update username column comment
    op.alter_column(
        'subscribers',
        'username',
        existing_type=sa.String(length=64),
        comment='RADIUS username (unique per tenant when not soft-deleted)',
    )


def downgrade() -> None:
    """Revert changes."""

    # Step 1: Drop partial unique indexes
    op.drop_index('uq_subscriber_tenant_username_active', table_name='subscribers')
    op.drop_index('uq_subscriber_tenant_number_active', table_name='subscribers')
    op.drop_index('ix_subscriber_deleted_at', table_name='subscribers')

    # Step 2: Recreate old unique constraints
    op.create_unique_constraint(
        'uq_subscriber_tenant_username',
        'subscribers',
        ['tenant_id', 'username'],
    )
    op.create_unique_constraint(
        'uq_subscriber_tenant_number',
        'subscribers',
        ['tenant_id', 'subscriber_number'],
    )

    # Step 3: Revert subscriber_number to nullable
    op.alter_column(
        'subscribers',
        'subscriber_number',
        existing_type=sa.String(length=50),
        nullable=True,
        server_default=None,
        comment='Human-readable subscriber ID',
    )

    # Step 4: Convert empty strings back to NULL
    op.execute("UPDATE subscribers SET subscriber_number = NULL WHERE subscriber_number = ''")

    # Step 5: Drop password_hash_method column
    op.drop_column('subscribers', 'password_hash_method')

    # Step 6: Revert password column comment
    op.alter_column(
        'subscribers',
        'password',
        existing_type=sa.String(length=255),
        comment='RADIUS password (hashed or cleartext depending on NAS)',
    )

    # Step 7: Revert username column comment
    op.alter_column(
        'subscribers',
        'username',
        existing_type=sa.String(length=64),
        comment='RADIUS username (unique per tenant)',
    )
