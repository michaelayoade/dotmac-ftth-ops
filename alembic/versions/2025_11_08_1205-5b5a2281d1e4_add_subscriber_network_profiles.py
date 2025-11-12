"""add subscriber network profiles

Revision ID: 5b5a2281d1e4
Revises: df42dd51d483
Create Date: 2025-11-08 12:05:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.dialects.postgresql import ENUM


# revision identifiers, used by Alembic.
revision = "5b5a2281d1e4"
down_revision = "df42dd51d483"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enums if they don't exist, catching DuplicateObject errors
    conn = op.get_bind()

    # Define enum types
    option82_enum = sa.Enum("enforce", "log", "ignore", name="option82policy")
    ipv6_mode_enum = sa.Enum("none", "slaac", "stateful", "pd", "dual_stack", name="ipv6assignmentmode")

    try:
        option82_enum.create(conn, checkfirst=False)
    except ProgrammingError:
        # Enum already exists, continue
        pass

    try:
        ipv6_mode_enum.create(conn, checkfirst=False)
    except ProgrammingError:
        # Enum already exists, continue
        pass

    # Reference existing enum types for columns
    option82_type = ENUM("enforce", "log", "ignore", name="option82policy", create_type=False)
    ipv6_mode_type = ENUM("none", "slaac", "stateful", "pd", "dual_stack", name="ipv6assignmentmode", create_type=False)

    op.create_table(
        "subscriber_network_profiles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("subscriber_id", sa.String(length=255), nullable=False),
        sa.Column("circuit_id", sa.String(length=255), nullable=True),
        sa.Column("remote_id", sa.String(length=255), nullable=True),
        sa.Column("service_vlan", sa.Integer(), nullable=True),
        sa.Column("inner_vlan", sa.Integer(), nullable=True),
        sa.Column("vlan_pool", sa.String(length=100), nullable=True),
        sa.Column("qinq_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("static_ipv4", sa.String(length=45), nullable=True),
        sa.Column("static_ipv6", sa.String(length=45), nullable=True),
        sa.Column("delegated_ipv6_prefix", sa.String(length=64), nullable=True),
        sa.Column("ipv6_pd_size", sa.Integer(), nullable=True),
        sa.Column("ipv6_assignment_mode", ipv6_mode_type, nullable=False, server_default=sa.text("'none'")),
        sa.Column("option82_policy", option82_type, nullable=False, server_default=sa.text("'log'")),
        sa.Column("metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.ForeignKeyConstraint(
            ["subscriber_id"],
            ["subscribers.id"],
            name="fk_network_profile_subscriber",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_network_profile_tenant",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "subscriber_id",
            name="uq_subscriber_network_profile_tenant_subscriber",
        ),
    )

    op.create_index(
        "ix_network_profile_subscriber",
        "subscriber_network_profiles",
        ["subscriber_id"],
    )
    op.create_index(
        "ix_network_profile_tenant",
        "subscriber_network_profiles",
        ["tenant_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_network_profile_tenant", table_name="subscriber_network_profiles")
    op.drop_index("ix_network_profile_subscriber", table_name="subscriber_network_profiles")
    op.drop_table("subscriber_network_profiles")

    # Drop enums (define them again for downgrade)
    option82_enum = sa.Enum("enforce", "log", "ignore", name="option82policy")
    ipv6_mode_enum = sa.Enum("none", "slaac", "stateful", "pd", "dual_stack", name="ipv6assignmentmode")

    option82_enum.drop(op.get_bind(), checkfirst=True)
    ipv6_mode_enum.drop(op.get_bind(), checkfirst=True)
