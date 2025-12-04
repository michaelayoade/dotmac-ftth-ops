"""add_assigned_team_id_to_contacts

Revision ID: 4061a8796d56
Revises: 5ed78a920bc4
Create Date: 2025-10-12 16:51:01.590036

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "4061a8796d56"
down_revision = "5ed78a920bc4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add assigned_team_id column to contacts table
    op.add_column(
        "contacts",
        sa.Column("assigned_team_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Create index for assigned_team_id
    op.create_index(
        "ix_contacts_assigned_team_id",
        "contacts",
        ["assigned_team_id"],
    )

    # Create foreign key to teams table
    op.create_foreign_key(
        "fk_contacts_assigned_team_id",
        "contacts",
        "teams",
        ["assigned_team_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Drop foreign key
    op.drop_constraint("fk_contacts_assigned_team_id", "contacts", type_="foreignkey")

    # Drop index
    op.drop_index("ix_contacts_assigned_team_id", table_name="contacts")

    # Drop column
    op.drop_column("contacts", "assigned_team_id")
