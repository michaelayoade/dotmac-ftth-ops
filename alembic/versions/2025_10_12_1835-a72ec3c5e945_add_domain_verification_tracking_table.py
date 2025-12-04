"""add_domain_verification_tracking_table

Revision ID: a72ec3c5e945
Revises: 8c352b665e18
Create Date: 2025-10-12 18:35:50.259054

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "a72ec3c5e945"
down_revision = "8c352b665e18"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add domain_verification_attempts table for tracking domain verification."""
    op.create_table(
        "domain_verification_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("verification_method", sa.String(length=50), nullable=False),
        sa.Column("verification_token", sa.String(length=64), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("initiated_by", sa.String(length=255), nullable=False),
        sa.Column("initiated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name=op.f("fk_domain_verification_attempts_tenant_id_tenants"),
            ondelete="CASCADE",
        ),
    )

    # Create indexes for efficient queries
    op.create_index(
        op.f("ix_domain_verification_attempts_tenant_id"),
        "domain_verification_attempts",
        ["tenant_id"],
    )
    op.create_index(
        op.f("ix_domain_verification_attempts_domain"),
        "domain_verification_attempts",
        ["domain"],
    )
    op.create_index(
        op.f("ix_domain_verification_attempts_status"),
        "domain_verification_attempts",
        ["status"],
    )
    op.create_index(
        op.f("ix_domain_verification_attempts_token"),
        "domain_verification_attempts",
        ["verification_token"],
    )

    # Create composite index for active verifications lookup
    op.create_index(
        "ix_domain_verification_active",
        "domain_verification_attempts",
        ["tenant_id", "status", "expires_at"],
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    """Drop domain_verification_attempts table."""
    op.drop_index("ix_domain_verification_active", table_name="domain_verification_attempts")
    op.drop_index(
        op.f("ix_domain_verification_attempts_token"),
        table_name="domain_verification_attempts",
    )
    op.drop_index(
        op.f("ix_domain_verification_attempts_status"),
        table_name="domain_verification_attempts",
    )
    op.drop_index(
        op.f("ix_domain_verification_attempts_domain"),
        table_name="domain_verification_attempts",
    )
    op.drop_index(
        op.f("ix_domain_verification_attempts_tenant_id"),
        table_name="domain_verification_attempts",
    )
    op.drop_table("domain_verification_attempts")
