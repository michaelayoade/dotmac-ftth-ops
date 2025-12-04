"""add_teams_and_team_members_tables

Revision ID: 5ed78a920bc4
Revises: 4cdd601e0cb3
Create Date: 2025-10-12 16:42:39.586965

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "5ed78a920bc4"
down_revision = "4cdd601e0cb3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create teams table
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("team_lead_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("metadata", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )

    # Create indexes for teams
    op.create_index("ix_teams_tenant_id", "teams", ["tenant_id"])
    op.create_index("ix_teams_name", "teams", ["name"])
    op.create_index("ix_teams_slug", "teams", ["slug"])
    op.create_index("ix_teams_team_lead_id", "teams", ["team_lead_id"])

    # Create unique constraints for teams
    op.create_unique_constraint("uq_teams_tenant_name", "teams", ["tenant_id", "name"])
    op.create_unique_constraint("uq_teams_tenant_slug", "teams", ["tenant_id", "slug"])

    # Create foreign key for tenant
    op.create_foreign_key(
        "fk_teams_tenant_id",
        "teams",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Create team_members table
    op.create_table(
        "team_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )

    # Create indexes for team_members
    op.create_index("ix_team_members_tenant_id", "team_members", ["tenant_id"])
    op.create_index("ix_team_members_team_id", "team_members", ["team_id"])
    op.create_index("ix_team_members_user_id", "team_members", ["user_id"])
    op.create_index("ix_team_members_role", "team_members", ["role"])

    # Create unique constraint for team_members
    op.create_unique_constraint(
        "uq_team_members_tenant_team_user",
        "team_members",
        ["tenant_id", "team_id", "user_id"],
    )

    # Create foreign keys for team_members
    op.create_foreign_key(
        "fk_team_members_tenant_id",
        "team_members",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "fk_team_members_team_id",
        "team_members",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "fk_team_members_user_id",
        "team_members",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # Drop team_members table
    op.drop_table("team_members")

    # Drop teams table
    op.drop_table("teams")
